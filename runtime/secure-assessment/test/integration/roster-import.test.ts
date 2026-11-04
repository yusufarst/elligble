import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir,readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import type pg from 'pg';
import { createDisposableDatabase,skipWithoutDatabase } from '../support/pg-harness.ts';
import { createTenant,createPersonWithAccount,addMembership,createTeachingContext } from '../support/fixtures.ts';
import { startProductionWiredServer,BrowserLikeClient } from '../support/test-server.ts';
import { provisionSchoolOperator } from '../../src/ops/provisioning/school-operator.ts';
import { enrollmentSlotKey,ensureStudentEnrollment } from '../../../academic-core/src/provisioning.ts';

const context={operator:'Synthetic authorized platform operator',caseReference:'ADMIN-001 synthetic'};
const PREFIX='/api/v1/identity/roster/';
const header='source_student_key,full_name,nis,nisn,date_of_birth,academic_group_id\n';
function barrier(){let acquired!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{acquired=r;}),proceed=new Promise<void>(r=>{release=r;});return{acquired,release,reached,proceed,pid:0};}
function observed<T>(p:Promise<T>){return p.then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));}
async function blocking(c:pg.PoolClient,pid:number,holder:number,pending:Promise<unknown>){
    const until=Date.now()+10000;
    while(Date.now()<until){
        const r=await Promise.race([c.query('SELECT pg_blocking_pids($1::int) AS ids',[pid]),pending.then(()=>{throw new Error('Writer finished before contention');})]);
        if((r.rows[0].ids as number[]).includes(holder))return;
    }throw new Error('No real PostgreSQL contention observed');
}
function gatedPool(pool:pg.Pool,gate:ReturnType<typeof barrier>,enabled:()=>boolean):pg.Pool{
    let held=false;
    return new Proxy(pool,{get(target,key){
        if(key==='connect')return async()=>{
            const c=await target.connect();
            return new Proxy(c,{get(client,property){
                if(property==='query')return async(...args:unknown[])=>{
                    const result=await Reflect.apply(client.query,client,args);
                    if(enabled()&&!held&&typeof args[0]==='string'&&args[0].includes('pg_try_advisory_xact_lock')){
                        held=true;gate.pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;gate.acquired();await gate.proceed;
                    }return result;
                };const v=Reflect.get(client,property);return typeof v==='function'?v.bind(client):v;
            }});
        };const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;
    }}) as pg.Pool;
}
async function setup(pool:pg.Pool){
    const tenant=await createTenant(pool),account=await createPersonWithAccount(pool),membership=await addMembership(pool,tenant,account.personId);
    const teaching=await createTeachingContext(pool,tenant,membership);
    const group=(await pool.query('SELECT academic_year_id FROM academic_core_academic_groups WHERE id=$1',[teaching.academicGroupId])).rows[0];
    const period=(await pool.query('SELECT academic_period_id FROM academic_core_subject_offerings o JOIN academic_core_teaching_assignments a ON a.subject_offering_id=o.id WHERE a.id=$1',[teaching.teachingAssignmentId])).rows[0].academic_period_id as string;
    return{tenant,account,membership,group:teaching.academicGroupId,year:group.academic_year_id as string,period};
}
async function state(pool:pg.Pool){
    const result:Record<string,unknown>={};
    for(const table of ['identity_persons','identity_user_accounts','identity_account_credentials','identity_person_account_bindings','identity_login_identifiers','tenant_memberships','academic_core_student_roster_records','academic_core_student_roster_revisions','academic_core_roster_import_receipts','academic_core_student_enrollments'])
        result[table]=(await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    return result;
}

test('ADMIN-001 real production authorization, privacy, atomic correction, replay and revocation',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase();const app=await startProductionWiredServer(db.pool);t.after(async()=>{await app.close();await db.close();});
    const f=await setup(db.pool),other=await createPersonWithAccount(db.pool);await addMembership(db.pool,f.tenant,other.personId);
    const login=async(a:typeof f.account)=>{const c=new BrowserLikeClient(app.baseUrl);assert.equal((await c.login(a.username,a.password)).status,200);c.tenantId=f.tenant;return c;};
    const operator=await login(f.account),outsider=await login(other),anonymous=new BrowserLikeClient(app.baseUrl);
    const input={academicYearId:f.year,academicPeriodId:f.period,csv:header+`source-1,Nama Sintetis,001,000123,2010-01-02,${f.group}`};
    const post=(c:BrowserLikeClient,route:string,body:unknown)=>c.request(PREFIX+route,{method:'POST',body});
    const original=await state(db.pool);
    assert.equal((await post(operator,'preview',input)).status,403);
    assert.equal((await post(anonymous,'preview',input)).status,401);
    assert.deepEqual(await state(db.pool),original);
    // Exercise the actual existing privileged CLI boundary, with no fixture or workflow changes.
    execFileSync(process.execPath,[new URL('../../src/ops/provision-cli.ts',import.meta.url).pathname,'operator','assign','--tenant',f.tenant.toUpperCase(),'--elligble-id',f.account.username,'--operator',context.operator,'--case',context.caseReference,'--reason','Synthetic assignment'],{env:{...process.env,DATABASE_URL:db.url},stdio:'pipe'});
    assert.equal((await operator.request('/api/v1/me/context')).body.capabilities.schoolOperator,true);
    const before=await state(db.pool),preview=await post(operator,'preview',input);assert.equal(preview.status,200);assert.equal(preview.body.canConfirm,true);
    assert.ok(!JSON.stringify(preview.body).includes('000123'));assert.ok(!JSON.stringify(preview.body).includes('2010-01-02'));assert.equal(preview.headers.get('cache-control'),'no-store');
    assert.deepEqual(await state(db.pool),before);
    assert.equal((await operator.request(PREFIX+'preview',{method:'POST',rawBody:JSON.stringify({...input,csv:'x'.repeat(1024*1024)}) ,headers:{'Content-Type':'application/json'}})).status,413);
    assert.equal((await post(operator,'preview',{...input,csv:header+'broken'})).body.canConfirm,false);
    assert.deepEqual(await state(db.pool),before);
    const intent={...input,inputDigest:preview.body.inputDigest,stateDigest:preview.body.stateDigest,requestKey:randomUUID(),reason:'Synthetic authorized import',confirmed:true};
    assert.equal((await post(outsider,'confirm',intent)).status,403);
    operator.tenantId=await createTenant(db.pool);assert.equal((await post(operator,'confirm',intent)).status,403);operator.tenantId=f.tenant;
    for(const field of ['actorPersonId','personId','tenantId','timestamp','audit'])assert.equal((await post(operator,'confirm',{...intent,[field]:randomUUID()})).status,400);
    assert.equal((await post(operator,'confirm',{...intent,confirmed:false})).status,400);
    const committed=await post(operator,'confirm',intent);assert.equal(committed.status,200);assert.equal(committed.body.summary.inserted,1);
    const after=await state(db.pool);for(const table of ['identity_persons','identity_user_accounts','identity_account_credentials','identity_person_account_bindings','identity_login_identifiers'])assert.deepEqual(after[table],before[table]);
    const replay=await post(operator,'confirm',intent);assert.equal(replay.body.id,committed.body.id);assert.equal(replay.body.replayed,true);assert.deepEqual(await state(db.pool),after);
    assert.equal((await post(operator,'confirm',{...intent,reason:'Altered'})).status,409);assert.deepEqual(await state(db.pool),after);
    const correction={...input,csv:input.csv.replace('Nama Sintetis','Nama Koreksi')},p=await post(operator,'preview',correction);
    assert.equal(p.body.rows[0].status,'CORRECTION');
    const corrected=await post(operator,'confirm',{...correction,inputDigest:p.body.inputDigest,stateDigest:p.body.stateDigest,requestKey:randomUUID(),reason:'Synthetic correction',confirmed:true});assert.equal(corrected.body.summary.corrected,1);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_student_roster_revisions')).rows[0].n,2);
    const staleBefore=await state(db.pool);assert.equal((await post(operator,'confirm',{...intent,requestKey:randomUUID()})).status,409);assert.deepEqual(await state(db.pool),staleBefore);
    const bad=await post(operator,'preview',{...input,csv:input.csv+'\nsource-2,Nama Lain,001,999,2010-01-01,'+f.group});assert.equal(bad.body.canConfirm,false);
    const foreign=await post(operator,'preview',{...input,academicYearId:randomUUID()});assert.equal(foreign.body.canConfirm,false);
    const key=randomUUID(),fresh=await post(operator,'preview',correction),sameIntent={...correction,inputDigest:fresh.body.inputDigest,stateDigest:fresh.body.stateDigest,requestKey:key,reason:'Concurrent NO_OP',confirmed:true};
    const both=await Promise.all([post(operator,'confirm',sameIntent),post(operator,'confirm',sameIntent)]);assert.equal(both[0].body.id,both[1].body.id);assert.equal(both.filter(x=>x.body.replayed===false).length,1);
    for(const result of both){assert.equal(result.status,200);assert.equal(result.body.outcome,'NO_OP');assert.deepEqual(result.body.summary,{inserted:0,corrected:0,unchanged:1});}
    // Audit/receipt failure must roll back all earlier row changes, not just return an error.
    const fail={...input,csv:input.csv.replace('Nama Sintetis','Rollback Name')},fp=await post(operator,'preview',fail),snapshot=await state(db.pool);
    await db.pool.query("CREATE FUNCTION synthetic_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER synthetic_failure BEFORE INSERT ON academic_core_roster_import_receipts FOR EACH ROW EXECUTE FUNCTION synthetic_receipt_failure()");
    try{assert.equal((await post(operator,'confirm',{...fail,inputDigest:fp.body.inputDigest,stateDigest:fp.body.stateDigest,requestKey:randomUUID(),reason:'Rollback oracle',confirmed:true})).status,503);assert.deepEqual(await state(db.pool),snapshot);}finally{await db.pool.query('DROP TRIGGER synthetic_failure ON academic_core_roster_import_receipts; DROP FUNCTION synthetic_receipt_failure()');}
    await assert.rejects(db.pool.query('DELETE FROM academic_core_student_roster_records'));
    await assert.rejects(db.pool.query('UPDATE academic_core_roster_import_receipts SET reason=$1',['tamper']));
    await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'REVOKE',context,reason:'Synthetic revoke'});
    const revoked=await state(db.pool);assert.equal((await post(operator,'confirm',intent)).status,403);assert.deepEqual(await state(db.pool),revoked);
});

test('ADMIN-001 distinct keys, opposite row orders, stale references and middle-row failure are atomic',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase(),app=await startProductionWiredServer(db.pool);t.after(async()=>{await app.close();await db.close();});
    const f=await setup(db.pool);await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN',context,reason:'Atomic oracle'});
    const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=f.tenant;
    const rows=[`one,First,001,101,2010-01-01,${f.group}`,`two,Second,002,102,2010-01-02,${f.group}`];
    const input={academicYearId:f.year,academicPeriodId:f.period,csv:header+rows.join('\n')};
    const post=(route:string,body:unknown)=>client.request(PREFIX+route,{method:'POST',body});
    const prepared=async(csv:string)=>{const body={...input,csv},p=await post('preview',body);assert.equal(p.status,200);assert.equal(p.body.canConfirm,true);return{...body,inputDigest:p.body.inputDigest,stateDigest:p.body.stateDigest,requestKey:randomUUID(),reason:'Atomic oracle',confirmed:true};};
    const first=await prepared(input.csv),second=await prepared(header+[...rows].reverse().join('\n'));
    const before=await state(db.pool);
    await db.pool.query("CREATE FUNCTION synthetic_middle_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.source_student_key='two' THEN RAISE EXCEPTION 'synthetic middle row'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_middle BEFORE INSERT ON academic_core_student_roster_records FOR EACH ROW EXECUTE FUNCTION synthetic_middle_failure()");
    try{assert.equal((await post('confirm',first)).status,503);assert.deepEqual(await state(db.pool),before);}finally{await db.pool.query('DROP TRIGGER synthetic_middle ON academic_core_student_roster_records; DROP FUNCTION synthetic_middle_failure()');}
    const results=await Promise.all([post('confirm',first),post('confirm',second)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(results.find(r=>r.status===409)!.body.error,'stale_conflict');
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records')).rows[0].n,2);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_roster_import_receipts')).rows[0].n,1);
    const one=await prepared(input.csv.replace('First','Correction A')),two=await prepared(input.csv.replace('First','Correction B'));
    const corrections=await Promise.all([post('confirm',one),post('confirm',two)]);assert.deepEqual(corrections.map(r=>r.status).sort(),[200,409]);
    const group=(await db.pool.query('SELECT display_label FROM academic_core_academic_groups WHERE id=$1',[f.group])).rows[0].display_label;
    const reference=await prepared(input.csv);await db.pool.query("UPDATE academic_core_academic_groups SET display_label='Reference changed' WHERE id=$1",[f.group]);
    const stable=await state(db.pool);assert.equal((await post('confirm',reference)).status,409);assert.deepEqual(await state(db.pool),stable);
    await db.pool.query('UPDATE academic_core_academic_groups SET display_label=$2 WHERE id=$1',[f.group,group]);
    // Missing rows are never interpreted as deletion, even after a successful correction.
    const subset=await prepared(header+rows[0]);assert.equal((await post('confirm',subset)).status,200);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records')).rows[0].n,2);
});

test('ADMIN-001 session revocation and expiry winning the roster namespace deny before mutation',{skip:skipWithoutDatabase,timeout:60000},async t=>{
    const db=await createDisposableDatabase(),app=await startProductionWiredServer(db.pool);t.after(async()=>{await app.close();await db.close();});
    for(const kind of ['revoked','expired'] as const)await t.test(kind,async()=>{
        const f=await setup(db.pool);await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN',context,reason:'Session oracle'});
        const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=f.tenant;
        const input={academicYearId:f.year,academicPeriodId:f.period,csv:header+`session,Student,001,101,2010-01-01,${f.group}`};
        const p=await client.request(PREFIX+'preview',{method:'POST',body:input});assert.equal(p.status,200);
        const intent={...input,inputDigest:p.body.inputDigest,stateDigest:p.body.stateDigest,requestKey:randomUUID(),reason:'Session oracle',confirmed:true};
        const holder=await db.pool.connect(),watch=await db.pool.connect();let pending:ReturnType<typeof observed<Awaited<ReturnType<BrowserLikeClient['request']>>>>|null=null;
        try{
            await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`roster-tenant:${f.tenant}`]);
            const pid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            pending=observed(client.request(PREFIX+'confirm',{method:'POST',body:intent}));
            let waiter=0;const until=Date.now()+10000;
            while(Date.now()<until){const r=await Promise.race([watch.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%' AND $1::int=ANY(pg_blocking_pids(pid))",[pid]),pending.then(v=>{throw v.ok?new Error('Request did not wait'):v.error;})]);if(r.rows.length){waiter=r.rows[0].pid;break;}}
            assert.ok(waiter>0);
            if(kind==='revoked')await db.pool.query('UPDATE identity_sessions SET is_revoked=TRUE WHERE user_account_id=$1',[f.account.accountId]);
            else await db.pool.query("UPDATE identity_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_account_id=$1",[f.account.accountId]);
            const before=await state(db.pool);await holder.query('COMMIT');const result=await pending;if(!result.ok)throw result.error;assert.equal(result.value.status,401);assert.deepEqual(await state(db.pool),before);
        }finally{await holder.query('ROLLBACK');if(pending)await pending;holder.release();watch.release();}
    });
});

test('ADMIN-001 C06 actual enrollment/roster writers share effective locks including case variants and empty slots',{skip:skipWithoutDatabase,timeout:120000},async t=>{
    const db=await createDisposableDatabase();t.after(()=>db.close());
    for(const first of ['enrollment','roster'] as const)for(const occupied of [false,true])for(const casing of ['lower','upper','mixed'] as const)await t.test(`${first} first / ${occupied?'existing':'empty'} / ${casing}`,async()=>{
        const f=await setup(db.pool),gate=barrier();let enabled=false;
        const app=await startProductionWiredServer(gatedPool(db.pool,gate,()=>enabled));
        const a=await db.pool.connect(),watch=await db.pool.connect();let pending:ReturnType<typeof observed<Awaited<ReturnType<BrowserLikeClient['request']>>>>|null=null;let writer:ReturnType<typeof observed<Awaited<ReturnType<typeof ensureStudentEnrollment>>>>|null=null;
        try{
            await a.query("SET statement_timeout='15s'");await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN',context,reason:'C06 synthetic'});
            const student=await createPersonWithAccount(db.pool),member=await addMembership(db.pool,f.tenant,student.personId);
            await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id,source_student_key,full_name,nis,nisn,date_of_birth,academic_year_id,academic_period_id,academic_group_id,person_id) VALUES($1,$2,'Original',$2,$2,'2010-01-01',$3,$4,$5,$6)`,[f.tenant,randomUUID(),f.year,f.period,f.group,student.personId]);
            const record=(await db.pool.query('SELECT source_student_key,nis FROM academic_core_student_roster_records WHERE tenant_id=$1',[f.tenant])).rows[0];
            const change=(v:string)=>casing==='upper'?v.toUpperCase():casing==='mixed'?v.split('').map((c,i)=>i%2?c.toUpperCase():c).join(''):v;
            const enrollment={academicYearId:f.year,academicPeriodId:change(f.period),academicGroupId:f.group,membershipId:change(member),startDate:'2026-07-01',source:'OPERATOR_IMPORT'};
            if(occupied){await a.query('BEGIN');await ensureStudentEnrollment(a,f.tenant,enrollment);await a.query('COMMIT');}
            const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=change(f.tenant);
            const input={academicYearId:change(f.year),academicPeriodId:change(f.period),csv:header+`${record.source_student_key},Updated,${record.nis},${record.nis},2010-01-01,${f.group}`};
            const preview=await client.request(PREFIX+'preview',{method:'POST',body:input});assert.equal(preview.body.canConfirm,true);
            const intent={...input,inputDigest:preview.body.inputDigest,stateDigest:preview.body.stateDigest,requestKey:randomUUID(),reason:'C06 synthetic',confirmed:true};
            const old=await state(db.pool),pid=(await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            assert.equal(enrollmentSlotKey(change(f.tenant),change(member),change(f.period)),enrollmentSlotKey(f.tenant,member,f.period));
            await a.query('BEGIN');
            if(first==='enrollment'){
                await ensureStudentEnrollment(a,change(f.tenant),enrollment);
                const locks=await watch.query("SELECT count(*)::int AS n FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND granted",[pid]);assert.ok(locks.rows[0].n>0);
                const denied=await client.request(PREFIX+'confirm',{method:'POST',body:intent});assert.equal(denied.status,409);assert.equal(denied.body.error,'stale_conflict');
                // The separate winner's uncommitted enrollment is not visible to this snapshot.
                assert.deepEqual(await state(db.pool),old);await a.query('COMMIT');
                const otherGroup=(await db.pool.query(`INSERT INTO academic_core_academic_groups(tenant_id,academic_year_id,grade_level_id,display_label) SELECT tenant_id,academic_year_id,grade_level_id,'Conflicting' FROM academic_core_academic_groups WHERE id=$1 RETURNING id`,[f.group])).rows[0].id as string;
                const conflicting={...input,csv:input.csv.replace(f.group,otherGroup)},fresh=await client.request(PREFIX+'preview',{method:'POST',body:conflicting});
                assert.equal(fresh.status,200);assert.equal(fresh.body.rows[0].status,'REVIEW_REQUIRED');
                const stable=await state(db.pool),deniedFresh=await client.request(PREFIX+'confirm',{method:'POST',body:{...conflicting,inputDigest:fresh.body.inputDigest,stateDigest:fresh.body.stateDigest,requestKey:randomUUID(),reason:'Fresh enrollment conflict',confirmed:true}});
                assert.equal(deniedFresh.status,409);assert.equal(deniedFresh.body.error,'REVIEW_REQUIRED');assert.deepEqual(await state(db.pool),stable);
            }else{
                enabled=true;pending=observed(client.request(PREFIX+'confirm',{method:'POST',body:intent}));await Promise.race([gate.reached,pending.then(result=>{throw result.ok?new Error('Roster completed before barrier'):result.error;})]);
                writer=observed(ensureStudentEnrollment(a,change(f.tenant),enrollment));await blocking(watch,pid,gate.pid,writer);
                gate.release();const result=await pending;if(!result.ok)throw result.error;assert.equal(result.value.status,200);
                const done=await writer;if(!done.ok)throw done.error;await a.query('COMMIT');
                assert.equal((await db.pool.query('SELECT full_name FROM academic_core_student_roster_records WHERE tenant_id=$1',[f.tenant])).rows[0].full_name,'Updated');
            }
            const current=await state(db.pool);for(const table of ['identity_persons','identity_user_accounts','identity_account_credentials','identity_person_account_bindings','identity_login_identifiers'])assert.deepEqual(current[table],old[table]);
            assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_student_enrollments WHERE tenant_id=$1 AND membership_id=$2 AND end_date IS NULL',[f.tenant,member])).rows[0].n,1);
        }finally{
            gate.release();await a.query('ROLLBACK');if(pending)await pending;if(writer)await writer;a.release();watch.release();await app.close();
        }
    });
});

test('ADMIN-001 reversed multi-slot legacy batch, conflicting enrollment and ambiguous membership refuse atomically',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase(),app=await startProductionWiredServer(db.pool);t.after(async()=>{await app.close();await db.close();});
    const f=await setup(db.pool);await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN',context,reason:'Synthetic C06'});
    const students=[];
    for(let n=0;n<2;n++){
        const student=await createPersonWithAccount(db.pool),member=await addMembership(db.pool,f.tenant,student.personId),source='slot-'+n;
        await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id,source_student_key,full_name,nis,nisn,date_of_birth,academic_year_id,academic_period_id,academic_group_id,person_id) VALUES($1,$2,'Original',$2,$2,'2010-01-01',$3,$4,$5,$6)`,[f.tenant,source,f.year,f.period,f.group,student.personId]);
        students.push({student,member,source,key:enrollmentSlotKey(f.tenant,member,f.period)});
    }
    students.sort((a,b)=>a.key.localeCompare(b.key));
    const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=f.tenant;
    const input={academicYearId:f.year,academicPeriodId:f.period,csv:header+students.map(s=>`${s.source},Updated,${s.source},${s.source},2010-01-01,${f.group}`).join('\n')};
    const post=(route:string,body:unknown)=>client.request(PREFIX+route,{method:'POST',body});
    const p=await post('preview',input);assert.equal(p.body.canConfirm,true);
    const intent={...input,inputDigest:p.body.inputDigest,stateDigest:p.body.stateDigest,requestKey:randomUUID(),reason:'Reverse batch',confirmed:true};
    const before=await state(db.pool),a=await db.pool.connect();
    try{
        await a.query("SET statement_timeout='10s'");await a.query('BEGIN');
        const enroll=(member:string)=>ensureStudentEnrollment(a,f.tenant,{academicYearId:f.year,academicPeriodId:f.period,academicGroupId:f.group,membershipId:member,startDate:'2026-07-01',source:'OPERATOR_IMPORT'});
        // Legacy file order holds the lexicographically later slot before requesting the first.
        await enroll(students[1].member);
        const denied=await post('confirm',intent);assert.equal(denied.status,409);assert.equal(denied.body.error,'stale_conflict');assert.deepEqual(await state(db.pool),before);
        // Proves the failed roster transaction released its earlier slot; no cycle or retry.
        await enroll(students[0].member);await a.query('COMMIT');
    }finally{await a.query('ROLLBACK');a.release();}
    const group=(await db.pool.query(`INSERT INTO academic_core_academic_groups(tenant_id,academic_year_id,grade_level_id,display_label) SELECT tenant_id,academic_year_id,grade_level_id,'Other' FROM academic_core_academic_groups WHERE id=$1 RETURNING id`,[f.group])).rows[0].id as string;
    const conflict={...input,csv:input.csv.replaceAll(f.group,group)},cp=await post('preview',conflict);assert.equal(cp.body.canConfirm,false);assert.ok(cp.body.rows.every((r:{status:string})=>r.status==='REVIEW_REQUIRED'));
    const stable=await state(db.pool);const refusal=await post('confirm',{...conflict,inputDigest:cp.body.inputDigest,stateDigest:cp.body.stateDigest,requestKey:randomUUID(),reason:'Conflicting group',confirmed:true});assert.equal(refusal.status,409);assert.equal(refusal.body.error,'REVIEW_REQUIRED');assert.deepEqual(await state(db.pool),stable);
    await addMembership(db.pool,f.tenant,students[0].student.personId);
    const ambiguous=await post('preview',input);assert.equal(ambiguous.body.canConfirm,false);assert.equal(ambiguous.body.rows[0].status,'REVIEW_REQUIRED');
});

test('ADMIN-001 assignment revocation serializes with in-flight import in both orders',{skip:skipWithoutDatabase,timeout:60000},async t=>{
    const db=await createDisposableDatabase();t.after(()=>db.close());
    for(const first of ['revoke','import'])await t.test(first+' first',async()=>{
        const f=await setup(db.pool),gate=barrier();let enabled=false;
        const app=await startProductionWiredServer(gatedPool(db.pool,gate,()=>enabled));const a=await db.pool.connect(),watch=await db.pool.connect();
        let pending:ReturnType<typeof observed<Awaited<ReturnType<BrowserLikeClient['request']>>>>|null=null;
        let revocation:ReturnType<typeof observed<Awaited<ReturnType<typeof setSchoolOperator>>>>|null=null;
        try{
            await provisionSchoolOperator(db.pool,{tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN',context,reason:'Concurrency setup'});
            const student=await createPersonWithAccount(db.pool);await addMembership(db.pool,f.tenant,student.personId);
            await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id,source_student_key,full_name,nis,nisn,date_of_birth,academic_year_id,academic_period_id,academic_group_id,person_id) VALUES($1,'concurrent','Original','1','2','2010-01-01',$2,$3,$4,$5)`,[f.tenant,f.year,f.period,f.group,student.personId]);
            const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=f.tenant;
            const input={academicYearId:f.year,academicPeriodId:f.period,csv:header+`concurrent,Updated,1,2,2010-01-01,${f.group}`};
            const preview=await client.request(PREFIX+'preview',{method:'POST',body:input});assert.equal(preview.body.canConfirm,true);
            const intent={...input,inputDigest:preview.body.inputDigest,stateDigest:preview.body.stateDigest,requestKey:randomUUID(),reason:'Synthetic race',confirmed:true};
            const old=await state(db.pool);await a.query("SET statement_timeout='15s'");await a.query('BEGIN');const pid=(await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            const revoke=()=>setSchoolOperator(a,{tenantId:f.tenant,personId:f.account.personId,action:'REVOKE',...context,reason:'Synthetic revocation'});
            if(first==='revoke'){
                await revoke();pending=observed(client.request(PREFIX+'confirm',{method:'POST',body:intent}));
                let seen=false;const until=Date.now()+10000;
                while(Date.now()<until){const r=await Promise.race([watch.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%tenant_school_operator_assignments%'"),pending.then(v=>{throw v.ok?new Error('Import did not wait for revocation'):v.error;})]);if(r.rows.some(x=>x.pid!==pid)){seen=true;break;}}
                assert.equal(seen,true);await a.query('COMMIT');const result=await pending;if(!result.ok)throw result.error;assert.equal(result.value.status,403);assert.deepEqual(await state(db.pool),old);
            }else{
                enabled=true;pending=observed(client.request(PREFIX+'confirm',{method:'POST',body:intent}));await Promise.race([gate.reached,pending.then(v=>{throw v.ok?new Error('No import barrier'):v.error;})]);
                revocation=observed(revoke());await blocking(watch,pid,gate.pid,revocation);gate.release();const result=await pending;if(!result.ok)throw result.error;assert.equal(result.value.status,200);
                const revoked=await revocation;if(!revoked.ok)throw revoked.error;await a.query('COMMIT');
                const after=await state(db.pool);assert.equal((await client.request(PREFIX+'confirm',{method:'POST',body:intent})).status,403);assert.deepEqual(await state(db.pool),after);
            }
        }finally{gate.release();await a.query('ROLLBACK');if(pending)await pending;if(revocation)await revocation;a.release();watch.release();await app.close();}
    });
});

test('ADMIN-001 migration 0055 upgrade and repeat preserve identity without backfill',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase({migrate:false});t.after(()=>db.close());const c=await db.pool.connect();
    try{
        const dir=new URL('../../../../database/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(n=>/^\d{4}.*\.sql$/.test(n)&&n<'0056').sort())await c.query(await readFile(new URL(file,dir),'utf8'));
        const tenant=await createTenant(db.pool),person=await createPersonWithAccount(db.pool),before=(await c.query('SELECT to_jsonb(t) AS row FROM identity_account_credentials t')).rows;
        const sql=await readFile(new URL('0056_school_operator_authoritative_roster.sql',dir),'utf8');
        const failing=sql.replace("INSERT INTO elligble_migration_history(migration_id) VALUES('0056_school_operator_authoritative_roster');","RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing,sql);
        await assert.rejects(c.query(failing),/synthetic migration rollback/);await c.query('ROLLBACK');
        assert.equal((await c.query("SELECT to_regclass('academic_core_student_roster_records') AS relation")).rows[0].relation,null);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0056_school_operator_authoritative_roster'")).rows[0].n,0);
        assert.deepEqual((await c.query('SELECT to_jsonb(t) AS row FROM identity_account_credentials t')).rows,before);
        await c.query(sql);await c.query(sql);
        assert.deepEqual((await c.query('SELECT to_jsonb(t) AS row FROM identity_account_credentials t')).rows,before);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records')).rows[0].n,0);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM tenant_school_operator_assignments')).rows[0].n,0);
        assert.ok(tenant&&person.personId);
    }finally{c.release();}
});

test('ADMIN-001 bootstrap audit failure rolls back and concurrent grants remain singular',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase(),app=await startProductionWiredServer(db.pool);t.after(async()=>{await app.close();await db.close();});
    const f=await setup(db.pool),input={tenantId:f.tenant,elligbleId:f.account.username,action:'ASSIGN' as const,context,reason:'Bootstrap oracle'};
    const before=await state(db.pool);
    await assert.rejects(provisionSchoolOperator(db.pool,{...input,reason:''}));
    await assert.rejects(provisionSchoolOperator(db.pool,{...input,tenantId:await createTenant(db.pool)}));
    await db.pool.query("CREATE FUNCTION synthetic_operator_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit'; END $$; CREATE TRIGGER synthetic_operator BEFORE INSERT ON tenant_school_operator_events FOR EACH ROW EXECUTE FUNCTION synthetic_operator_failure()");
    try{await assert.rejects(provisionSchoolOperator(db.pool,input),/synthetic audit/);assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM tenant_school_operator_assignments')).rows[0].n,0);assert.deepEqual(await state(db.pool),before);}finally{await db.pool.query('DROP TRIGGER synthetic_operator ON tenant_school_operator_events; DROP FUNCTION synthetic_operator_failure()');}
    const grants=await Promise.all([provisionSchoolOperator(db.pool,input),provisionSchoolOperator(db.pool,input)]);
    assert.equal(grants[0].assignmentId,grants[1].assignmentId);assert.equal(grants.filter(r=>r.changed).length,1);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM tenant_school_operator_events')).rows[0].n,1);
    await assert.rejects(db.pool.query('UPDATE tenant_school_operator_assignments SET membership_id=$1',[randomUUID()]));
    await assert.rejects(db.pool.query('DELETE FROM tenant_school_operator_events'));
    const client=new BrowserLikeClient(app.baseUrl);await client.login(f.account.username,f.account.password);client.tenantId=f.tenant;
    await addMembership(db.pool,f.tenant,f.account.personId);
    const stable=await state(db.pool),response=await client.request(PREFIX+'preview',{method:'POST',body:{academicYearId:f.year,academicPeriodId:f.period,csv:header+`row,Name,001,101,2010-01-01,${f.group}`}});
    assert.equal(response.status,403);assert.deepEqual(await state(db.pool),stable);
});
