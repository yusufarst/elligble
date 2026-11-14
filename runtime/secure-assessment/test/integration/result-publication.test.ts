import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, addParticipant, addQuestionSnapshots, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant, type PersonAccount, type TeachingContext } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer, type ClientResponse } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { buildBaselineFrozenContent, buildEssayFrozenContent, buildMultipleResponseFrozenContent } from '../../src/exam-provisioning.ts';
import { readMyResults, type MyResultEntry, type ResultPublicationReceipt } from '../../src/result-publication.ts';

// RESULT-003 §5/C02-C04. Exact values, production-wired negatives, real lock races,
// append-only/frozen state and populated migration upgrade/rollback. PostgreSQL runs in CI only.
const PUB='/api/v1/assessment/result-publications', MINE='/api/v1/assessment/my-results';
const RESULTS='/api/v1/assessment/teacher-exams/results', TRANSITION='/api/v1/assessment/teacher-exams/transition';
const GRADE='/api/v1/assessment/teacher-exams/essays/grade', SCHOOL='/api/v1/assessment/institution-exams';
const TYPES={'X-Question-Types':'1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:ESSAY'};
const REASON='Hasil diperiksa dan siap dibagikan';
const TABLES=['secure_assessment_result_publication_events','secure_assessment_exam_result_finalizations','secure_assessment_attempt_results','secure_assessment_permission_action_events','secure_assessment_exam_lifecycle_events','secure_assessment_exam_instances','secure_assessment_exam_answers','secure_assessment_essay_grade_revisions','secure_assessment_exam_submissions'] as const;
const post=(c:BrowserLikeClient,path:string,body:object)=>c.request(path,{method:'POST',body});
function ok<T=Record<string,unknown>>(r:ClientResponse,status=200):T {
    assert.equal(r.status,status,JSON.stringify(r.body));assert.match(r.headers.get('cache-control')??'',/no-store/);return r.body as T;
}
async function rowsOf(pool:pg.Pool) {
    const rows:Record<string,string[]>={};
    for(const table of TABLES)rows[table]=(await pool.query(`SELECT to_jsonb(x)::text AS r FROM ${table} x ORDER BY 1`)).rows.map(r=>r.r as string);
    return rows;
}
function keysOf(value:unknown,out=new Set<string>()):Set<string> {
    if(Array.isArray(value))value.forEach(v=>keysOf(v,out));
    else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){out.add(k);keysOf(v,out)}
    return out;
}
function gate() {
    let release=()=>{},reached=()=>{};
    const arrived=new Promise<void>(r=>{reached=r}),proceed=new Promise<void>(r=>{release=r});
    return {release,reached,arrived,proceed};
}
function gatedPool(pool:pg.Pool,matches:(sql:string)=>boolean,g:ReturnType<typeof gate>):pg.Pool {
    let held=false;
    return new Proxy(pool,{get(target,key){
        if(key==='connect')return async()=>{
            const client=await target.connect();
            return new Proxy(client,{get(c,property){
                if(property==='query')return async(...args:unknown[])=>{
                    const result=await Reflect.apply(c.query,c,args);
                    if(!held&&typeof args[0]==='string'&&matches(args[0])){held=true;g.reached();await g.proceed}
                    return result;
                };
                const v=Reflect.get(c,property);return typeof v==='function'?v.bind(c):v;
            }});
        };
        const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;
    }}) as pg.Pool;
}
async function bounded<T>(pending:Promise<T>,label:string):Promise<T> {
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([pending,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+': exceeded 5 s')),5000)})])}
    finally{clearTimeout(timer)}
}
async function waitForLock(pool:pg.Pool) {
    for(let i=0;i<30;i++){
        if((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n>0)return;
        await new Promise(r=>setTimeout(r,50));
    }
    throw new Error('Expected a real PostgreSQL lock waiter');
}

test('RESULT-003 publication: real PostgreSQL, production wiring',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase(),pool=db.pool,app=await startProductionWiredServer(pool);
    t.after(async()=>{await app.close();await db.close()});
    const tenant=await createTenant(pool),t1=await createPersonWithAccount(pool,'guru.publikasi');
    const teaching=await createTeachingContext(pool,tenant,await addMembership(pool,tenant,t1.personId),'Ekonomi');
    const scope=(await pool.query(`SELECT o.academic_period_id,o.grade_level_id,g.academic_year_id FROM academic_core_teaching_assignments a
        JOIN academic_core_subject_offerings o ON o.id=a.subject_offering_id JOIN academic_core_academic_groups g ON g.id=a.academic_group_id WHERE a.id=$1`,[teaching.teachingAssignmentId])).rows[0];
    const staff=async(name:string)=>{const p=await createPersonWithAccount(pool,name);return {...p,membershipId:await addMembership(pool,tenant,p.personId)}};
    async function subject(name:string,label:string) {
        const p=await staff(name);
        const teacherAssignmentId=(await pool.query('INSERT INTO tenant_teacher_assignments(tenant_id,membership_id) VALUES($1,$2) RETURNING id',[tenant,p.membershipId])).rows[0].id as string;
        const sid=(await pool.query('INSERT INTO academic_core_subjects(tenant_id,display_label) VALUES($1,$2) RETURNING id',[tenant,label])).rows[0].id;
        const offering=(await pool.query('INSERT INTO academic_core_subject_offerings(tenant_id,subject_id,academic_period_id,grade_level_id) VALUES($1,$2,$3,$4) RETURNING id',[tenant,sid,scope.academic_period_id,scope.grade_level_id])).rows[0].id;
        const teachingAssignmentId=(await pool.query('INSERT INTO academic_core_teaching_assignments(tenant_id,teacher_assignment_id,subject_offering_id,academic_group_id) VALUES($1,$2,$3,$4) RETURNING id',[tenant,teacherAssignmentId,offering,teaching.academicGroupId])).rows[0].id as string;
        return {p,teaching:{...teaching,teacherAssignmentId,teachingAssignmentId,subjectLabel:label}};
    }
    const T2=await subject('guru.matematika','Matematika'),T3=await subject('guru.fisika','Fisika');
    const operator=await staff('operator.publikasi'),proctor=await staff('pengawas.publikasi'),homeroom=await staff('walikelas.publikasi'),actorA=await staff('staf.publikasi');
    await pool.query(`INSERT INTO academic_core_homeroom_responsibilities(tenant_id,membership_id,academic_year_id,academic_period_id,academic_group_id)
        VALUES($1,$2,$3,$4,$5)`,[tenant,homeroom.membershipId,scope.academic_year_id,scope.academic_period_id,teaching.academicGroupId]);
    async function assignOperator(personId:string,action:'ASSIGN'|'REVOKE') {
        const c=await pool.connect();
        try{await c.query('BEGIN');await setSchoolOperator(c,{tenantId:tenant,personId,action,operator:'Synthetic CI operator',caseReference:'RESULT-003',reason:'Synthetic publication coverage'});await c.query('COMMIT')}
        catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
    }
    await assignOperator(operator.personId,'ASSIGN');
    const s1=await staff('publikasi.satu'),s2=await staff('publikasi.dua'),s3=await staff('publikasi.absen');
    async function login(person:PersonAccount,tenantId=tenant) {
        const c=new BrowserLikeClient(app.baseUrl);assert.equal((await c.login(person.username,person.password)).status,200);c.tenantId=tenantId;return c;
    }
    const c1=await login(t1),c2=await login(T2.p),c3=await login(T3.p);
    const oc=await login(operator),pc=await login(proctor),hc=await login(homeroom),ac=await login(actorA);
    const sc1=await login(s1),sc2=await login(s2),sc3=await login(s3);
    const act=(c:BrowserLikeClient,examInstanceId:string,action:string)=>post(c,TRANSITION,{examInstanceId,action,reason:REASON,confirmed:true,actionKey:randomUUID()});
    const command=(examInstanceId:string,over:Record<string,unknown>={})=>({examInstanceId,action:'publish',expectedRevision:0,reason:REASON,confirmed:true,actionKey:randomUUID(),...over});
    const publish=(c:BrowserLikeClient,exam:string,over:Record<string,unknown>={})=>post(c,PUB,command(exam,over));
    const mine=async(c:BrowserLikeClient)=>ok<{results:MyResultEntry[]}>(await c.request(MINE)).results;
    async function unchanged(run:()=>Promise<void>){const before=await rowsOf(pool);await run();assert.deepEqual(await rowsOf(pool),before,'refusal writes nothing')}
    async function publicationOnly(run:()=>Promise<void>){
        const before=await rowsOf(pool);await run();const after=await rowsOf(pool);
        for(const table of TABLES.filter(n=>n!=='secure_assessment_result_publication_events'))assert.deepEqual(after[table],before[table],table);
    }
    async function store(exam:string,contents:readonly unknown[]) {
        const ids:string[]=[];
        for(const[i,content]of contents.entries())ids.push((await pool.query('INSERT INTO secure_assessment_exam_question_snapshots(tenant_id,exam_instance_id,frozen_content,display_order) VALUES($1,$2,$3,$4) RETURNING id',[tenant,exam,JSON.stringify(content),i+1])).rows[0].id as string);
        return ids;
    }
    const TM=await createExamInstance(pool,tenant,teaching,{lifecycleState:'ACTIVE'});
    const tmq=await store(TM,[
        buildBaselineFrozenContent({prompt:'Pertanyaan pilihan',options:['A','B','C','D','E'],correctIndex:1,maxScore:2}),
        buildMultipleResponseFrozenContent({prompt:'Pilih dua jawaban',options:['A','B','C','D','E'],correctIndexes:[0,2],maxScore:3}),
        buildEssayFrozenContent({prompt:'Jelaskan jawaban',maxScore:5,rubric:'Alasan yang benar.'}),
    ]);
    for(const p of[s1,s2,s3])await addParticipant(pool,tenant,TM,p.personId);
    const period=(await pool.query(`INSERT INTO secure_assessment_institution_exam_periods(tenant_id,academic_period_id,assessment_type_id,label,created_by_person_id,action_key,request_digest)
        VALUES($1,$2,$3,'PTS Publikasi',$4,gen_random_uuid(),repeat('a',64)) RETURNING id`,[tenant,scope.academic_period_id,teaching.assessmentTypeId,operator.personId])).rows[0].id as string;
    const session=(await pool.query(`INSERT INTO secure_assessment_institution_exam_sessions(tenant_id,period_id,starts_at,ends_at,created_by_person_id,action_key,request_digest)
        VALUES($1,$2,statement_timestamp()+interval '5 days',statement_timestamp()+interval '5 days 2 hours',$3,gen_random_uuid(),repeat('a',64)) RETURNING id`,[tenant,period,operator.personId])).rows[0].id as string;
    async function institution(ctx:TeachingContext,scores:number[]) {
        const exam=(await pool.query(`INSERT INTO secure_assessment_exam_instances(tenant_id,teaching_assignment_id,assessment_type_id,lifecycle_state,window_starts_at,window_ends_at,
            configured_attempt_duration_seconds,latest_start_policy,room_based_operations_enabled,proctor_per_room_required,institution_session_id)
            VALUES($1,$2,$3,'SCHEDULED',statement_timestamp()-interval '10 minutes',statement_timestamp()+interval '3 hours',3600,'FULL_DURATION_BEYOND_WINDOW',TRUE,TRUE,$4) RETURNING id`,[tenant,ctx.teachingAssignmentId,teaching.assessmentTypeId,session])).rows[0].id as string;
        await pool.query(`INSERT INTO secure_assessment_institution_preparation_deadlines(tenant_id,exam_instance_id,revision,deadline_at,set_by_person_id,action_key,request_digest)
            VALUES($1,$2,1,statement_timestamp()+interval '1 hour',$3,gen_random_uuid(),repeat('a',64))`,[tenant,exam,operator.personId]);
        const questions=await store(exam,scores.map((maxScore,i)=>buildBaselineFrozenContent({prompt:'Pertanyaan sekolah '+i,options:['A','B','C','D','E'],correctIndex:i,maxScore})));
        const room=(await pool.query('INSERT INTO secure_assessment_exam_rooms(tenant_id,exam_instance_id,display_label) VALUES($1,$2,$3) RETURNING id',[tenant,exam,'Ruang '+ctx.subjectLabel])).rows[0].id;
        const assignment=(await pool.query('INSERT INTO secure_assessment_proctor_assignments(tenant_id,exam_instance_id,person_id) VALUES($1,$2,$3) RETURNING id',[tenant,exam,proctor.personId])).rows[0].id;
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments(tenant_id,exam_instance_id,proctor_assignment_id,exam_room_id) VALUES($1,$2,$3,$4)',[tenant,exam,assignment,room]);
        await pool.query("UPDATE secure_assessment_exam_instances SET lifecycle_state='ACTIVE' WHERE id=$1",[exam]);
        for(const person of[s1,s2]){
            const p=await addParticipant(pool,tenant,exam,person.personId);
            await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments(tenant_id,exam_instance_id,exam_participant_id,exam_room_id) VALUES($1,$2,$3,$4)',[tenant,exam,p,room]);
        }
        return {exam,questions};
    }
    const E1=await institution(T2.teaching,[1,2]),E2=await institution(T3.teaching,[1,1]);
    async function answer(c:BrowserLikeClient,exam:string,questions:string[],payloads:unknown[]) {
        const {attemptId}=ok<{attemptId:string}>(await post(c,'/api/v1/assessment/attempts/start',{examInstanceId:exam}),201),sessionId=randomUUID();
        ok(await post(c,'/api/v1/assessment/session/activate',{attemptId,sessionId}));ok(await post(c,'/api/v1/assessment/timer/start',{attemptId}));
        for(const[i,answerPayload]of payloads.entries())ok(await c.request('/api/v1/assessment/answer/save',{method:'POST',headers:TYPES,body:{attemptId,sessionId,snapshotId:questions[i],answerPayload,clientWriteIdentity:randomUUID(),expectedWriteVersion:null}}));
        ok(await post(c,'/api/v1/assessment/submit',{attemptId}));return attemptId;
    }
    const a1=await answer(sc1,TM,tmq,[{selectedOptionId:'B'},{selectedOptionIds:['A','C']},{essayText:'Dua alasan yang benar.'}]);
    const a2=await answer(sc2,TM,tmq,[{selectedOptionId:'A'},{selectedOptionIds:['A','C']},{essayText:'Satu alasan yang benar.'}]);
    await answer(sc1,E1.exam,E1.questions,[{selectedOptionId:'A'},{selectedOptionId:'C'}]);
    await answer(sc2,E1.exam,E1.questions,[{selectedOptionId:'A'},{selectedOptionId:'B'}]);
    await answer(sc1,E2.exam,E2.questions,[{selectedOptionId:'A'}]);
    ok(await act(c1,TM,'end'));
    for(const examInstanceId of[E1.exam,E2.exam])ok(await post(oc,SCHOOL+'/supervision/transition',{examInstanceId,action:'end',reason:REASON,confirmed:true,actionKey:randomUUID()}));
    for(const[attemptId,score]of[[a1,'4'],[a2,'2,5']])ok(await post(c1,GRADE,{examInstanceId:TM,attemptId,snapshotId:tmq[2],score,expectedRevision:null}));
    const tenant9=await createTenant(pool,'Sekolah lain'),t9=await createPersonWithAccount(pool,'guru.sekolah.lain');
    const teaching9=await createTeachingContext(pool,tenant9,await addMembership(pool,tenant9,t9.personId));
    const s9=await createPersonWithAccount(pool,'siswa.sekolah.lain');await addMembership(pool,tenant9,s9.personId);
    const TM9=await createExamInstance(pool,tenant9,teaching9,{lifecycleState:'ACTIVE'}),q9=await addQuestionSnapshots(pool,tenant9,TM9,1);await addParticipant(pool,tenant9,TM9,s9.personId);
    const c9=await login(t9,tenant9),sc9=await login(s9,tenant9),c9Foreign=await login(t9);
    await answer(sc9,TM9,q9,[{selectedOptionId:'B'}]);ok(await act(c9,TM9,'end'));ok(await act(c9,TM9,'finalize'));ok(await publish(c9,TM9));
    const anonymous=new BrowserLikeClient(app.baseUrl);anonymous.tenantId=tenant;
    const originalKey=randomUUID(),original=command(TM,{actionKey:originalKey});
    let published:ResultPublicationReceipt={examInstanceId:TM,published:true,revision:0,changedAt:'',replayed:false};
    let first:MyResultEntry={examInstanceId:TM,publishedAt:'',standing:'SUBMITTED',scaledScore:90};

    await t.test('P-1 N06: ENDED is not FINALIZED, nothing written',async()=>{
        await unchanged(async()=>{for(const[c,exam]of[[c1,TM],[c3,E2.exam]] as const){
            const r=await publish(c,exam);assert.equal(r.status,409);assert.deepEqual(r.body,{error:'invalid_state',currentState:'ENDED'});
        }});
        assert.deepEqual(await mine(sc1),[]);assert.equal(ok<{publication:unknown}>(await c1.request(RESULTS+'?examInstanceId='+TM)).publication,null);
        ok(await act(c1,TM,'finalize'));ok(await act(c2,E1.exam,'finalize'));
    });
    await t.test('P-2 I-3: publish finalized TM, only 0066 changes, minimized receipt and Teacher views',async()=>{
        await publicationOnly(async()=>{published=ok<ResultPublicationReceipt>(await post(c1,PUB,original))});
        assert.deepEqual(Object.keys(published).sort(),['examInstanceId','published','revision','changedAt','replayed'].sort());
        assert.deepEqual([published.examInstanceId,published.published,published.revision,published.replayed],[TM,true,1,false]);
        const row=(await pool.query('SELECT sequence,action,actor_person_id,reason,confirmed,action_key,request_digest FROM secure_assessment_result_publication_events WHERE exam_instance_id=$1',[TM])).rows[0];
        assert.deepEqual([row.sequence,row.action,row.actor_person_id,row.reason,row.confirmed,row.action_key],[1,'PUBLISH',t1.personId,REASON,true,originalKey]);assert.match(row.request_digest,/^[0-9a-f]{64}$/);
        assert.deepEqual(ok<{publication:unknown}>(await c1.request(RESULTS+'?examInstanceId='+TM)).publication,{published:true,revision:1,changedAt:published.changedAt});
        const cards=ok<{exams:Array<{examInstanceId:string;publishedAt:string|null}>}>(await c1.request('/api/v1/assessment/teacher-readiness'));
        assert.equal(cards.exams.find(e=>e.examInstanceId===TM)?.publishedAt,published.changedAt);
    });
    await t.test('S-1/S-2/S-5 N05: exact own entries, absent is not zero, no cross-tenant or peer data',async()=>{
        first={examInstanceId:TM,publishedAt:published.changedAt,standing:'SUBMITTED',scaledScore:90};
        assert.deepEqual(await mine(sc1),[first]);assert.deepEqual(await mine(sc2),[{...first,scaledScore:55}]);
        assert.deepEqual(await mine(sc3),[{...first,standing:'ABSENT',scaledScore:null}]);
        const theirs=await mine(sc9);assert.equal(theirs.length,1);assert.equal(theirs[0].examInstanceId,TM9);assert.equal(theirs[0].scaledScore,100);assert.deepEqual(await mine(c1),[]);
        assert.deepEqual([...keysOf(await mine(sc1))].sort(),['examInstanceId','publishedAt','scaledScore','standing'].sort());
    });
    await t.test('P-3 N08: replay, changed body and authorized successor actor; original receipt retained',async()=>{
        await unchanged(async()=>{
            assert.deepEqual(ok(await post(c1,PUB,original)),{...published,replayed:true});
            const r=await post(c1,PUB,{...original,reason:'Alasan lain'});assert.equal(r.status,409);assert.equal(r.body.error,'action_key_reused');
        });
        // R6/E4: authorize T2 on the SAME exam before testing actor-only reuse, then restore T1.
        await pool.query('UPDATE academic_core_teaching_assignments SET teacher_assignment_id=$2 WHERE id=$1',[teaching.teachingAssignmentId,T2.teaching.teacherAssignmentId]);
        try{await unchanged(async()=>{const r=await post(c2,PUB,original);assert.equal(r.status,409);assert.equal(r.body.error,'action_key_reused')})}
        finally{await pool.query('UPDATE academic_core_teaching_assignments SET teacher_assignment_id=$2 WHERE id=$1',[teaching.teachingAssignmentId,teaching.teacherAssignmentId])}
    });
    await t.test('P-4/P-7 N06/N08: stale/wrong action and every malformed body, zero writes',async()=>{
        await unchanged(async()=>{
            for(const over of[{expectedRevision:0},{action:'withdraw',expectedRevision:0},{action:'publish',expectedRevision:1}]){
                const r=await publish(c1,TM,over);assert.equal(r.status,409);assert.deepEqual(r.body,{error:'publication_changed',published:true,revision:1});
            }
            for(const over of[{reason:''},{reason:'   '},{reason:'a'.repeat(201)},{confirmed:false},{actionKey:'x'},{action:'unpublish'},{expectedRevision:-1},{expectedRevision:1.5},{expectedRevision:'1'},{actorPersonId:t1.personId},{tenantId:tenant9}])assert.equal((await publish(c1,TM,over)).status,400,JSON.stringify(over));
            for(const key of Object.keys(original)){const body:Record<string,unknown>={...original};delete body[key];assert.equal((await post(c1,PUB,body)).status,400,key)}
        });
    });
    await t.test('P-5/P-6/S-3: withdraw hides, republish same frozen value, old key replays old receipt',async()=>{
        await publicationOnly(async()=>{const r=ok<ResultPublicationReceipt>(await publish(c1,TM,{action:'withdraw',expectedRevision:1}));assert.deepEqual([r.published,r.revision],[false,2])});
        assert.deepEqual(await mine(sc1),[]);
        const cards=ok<{exams:Array<{examInstanceId:string;publishedAt:unknown}>}>(await c1.request('/api/v1/assessment/teacher-readiness'));assert.equal(cards.exams.find(e=>e.examInstanceId===TM)?.publishedAt,null);
        await publicationOnly(async()=>{const r=ok<ResultPublicationReceipt>(await publish(c1,TM,{expectedRevision:2}));assert.deepEqual([r.published,r.revision],[true,3])});
        assert.deepEqual({...((await mine(sc1))[0]),publishedAt:first.publishedAt},first);
        await unchanged(async()=>{assert.deepEqual(ok(await post(c1,PUB,original)),{...published,replayed:true})});
    });
    await t.test('I-1/I-2/S-4/N03/N04: per-subject authority, combined roles and assignment revocation',async()=>{
        await unchanged(async()=>{
            for(const c of[oc,pc,hc,ac,sc1,c9Foreign])for(const exam of[TM,E1.exam])assert.equal((await publish(c,exam)).status,403);
            const wrong=await publish(c3,E1.exam),missing=await publish(c3,randomUUID()),foreign=await publish(c1,TM9);
            assert.equal(wrong.status,403);assert.deepEqual(wrong.body,missing.body);assert.deepEqual(wrong.body,foreign.body);
            assert.equal((await c3.request(RESULTS+'?examInstanceId='+E1.exam)).status,403);
        });
        for(const path of[SCHOOL+'/supervision?sessionId='+session,SCHOOL+'/supervision/exam?examInstanceId='+E1.exam]){
            const keys=keysOf(ok(await oc.request(path)));for(const key of['publication','publishedAt','scaledScore','score','results','rawScore','item_outcomes'])assert.equal(keys.has(key),false,'before publication: '+key);
        }
        await assignOperator(T2.p.personId,'ASSIGN');
        try{await publicationOnly(async()=>{ok(await publish(c2,E1.exam))})}finally{await assignOperator(T2.p.personId,'REVOKE')}
        const list=await mine(sc1);assert.deepEqual(list.map(e=>[e.examInstanceId,e.scaledScore]).sort(),[[TM,90],[E1.exam,33.33]].sort());
        assert.equal(list.some(e=>e.examInstanceId===E2.exam||e.examInstanceId===TM9),false);assert.equal((await mine(sc2)).find(e=>e.examInstanceId===E1.exam)?.scaledScore,100);
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at=statement_timestamp() WHERE id=$1',[T2.teaching.teachingAssignmentId]);
        try{await unchanged(async()=>{assert.equal((await publish(c2,E1.exam,{action:'withdraw',expectedRevision:1})).status,403)})}
        finally{await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at=NULL WHERE id=$1',[T2.teaching.teachingAssignmentId])}
    });
    await t.test('I-4 N04: Operator projections and forbidden results/export reveal no result field',async()=>{
        for(const path of[SCHOOL+'/supervision?sessionId='+session,SCHOOL+'/supervision/exam?examInstanceId='+E1.exam]){
            const keys=keysOf(ok(await oc.request(path)));for(const key of['publication','publishedAt','scaledScore','score','results','rawScore','item_outcomes'])assert.equal(keys.has(key),false,key);
        }
        await unchanged(async()=>{for(const c of[oc,pc,hc,sc1]){
            assert.equal((await c.request(RESULTS+'?examInstanceId='+E1.exam)).status,403);
            assert.equal((await post(c,RESULTS,{examInstanceId:E1.exam,format:'csv',actionKey:randomUUID()})).status,403);
        }});
    });
    await t.test('N01/N02/N10/S-5: anonymous, membership, substitution, methods, Origin, body limits and unavailable DB',async()=>{
        await unchanged(async()=>{
            assert.equal((await anonymous.request(MINE)).status,401);assert.equal((await publish(anonymous,TM)).status,401);
            const noMembership=await login(await createPersonWithAccount(pool,'sans.membre'));
            assert.equal((await noMembership.request(MINE)).status,403);assert.equal((await publish(noMembership,TM)).status,403);
            sc1.tenantId=tenant9;try{assert.equal((await sc1.request(MINE)).status,403)}finally{sc1.tenantId=tenant}
            for(const key of['examInstanceId','personId','participantId','tenantId'])assert.equal((await sc1.request(MINE+'?'+key+'='+E1.exam)).status,400,key);
            assert.equal((await post(sc1,MINE,{})).status,405);assert.equal((await c1.request(PUB)).status,405);
            for(const path of[PUB,MINE]){
                const r=await c1.request(path,{method:path===PUB?'POST':'GET',body:path===PUB?command(TM):undefined,headers:{Origin:'https://untrusted.invalid'},origin:'https://untrusted.invalid'});
                assert.equal(r.status,403);assert.equal(r.body.error,'origin_not_allowed');
            }
            assert.equal((await c1.request(PUB,{method:'POST',rawBody:JSON.stringify({...command(TM),reason:'a'.repeat(1_100_000)}),headers:{'Content-Type':'application/json'}})).status,413);
        });
        const broken=new Proxy(pool,{get(target,key){if(key==='query'||key==='connect')return async()=>{throw new Error('synthetic unavailable')};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v}}) as pg.Pool;
        const server=await startProductionWiredServer(broken);
        try{const c=new BrowserLikeClient(server.baseUrl);c.cookie=c1.cookie;c.tenantId=tenant;assert.equal((await c.request(MINE)).status,503);assert.equal((await publish(c,TM)).status,503)}finally{await server.close()}
    });
    await t.test('X-1: GET/export projection equality and safe export-key refusal across withdrawal',async()=>{
        const body={examInstanceId:TM,format:'csv',actionKey:randomUUID()},before=ok<{participants:unknown}>(await post(c1,RESULTS,body));
        assert.deepEqual(before,ok(await c1.request(RESULTS+'?examInstanceId='+TM)));
        ok(await publish(c1,TM,{action:'withdraw',expectedRevision:3}));
        await unchanged(async()=>{const r=await post(c1,RESULTS,body);assert.equal(r.status,409);assert.equal(r.body.error,'export_data_changed')});
        assert.deepEqual(ok<{participants:unknown}>(await post(c1,RESULTS,{...body,actionKey:randomUUID()})).participants,before.participants);
        ok(await publish(c1,TM,{expectedRevision:4}));
    });
    async function raceExam(){
        const exam=await createExamInstance(pool,tenant,teaching,{lifecycleState:'ACTIVE'});await addQuestionSnapshots(pool,tenant,exam,1);await addParticipant(pool,tenant,exam,s3.personId);ok(await act(c1,exam,'end'));return exam;
    }
    async function heldServer(matches:(sql:string)=>boolean){
        const g=gate(),server=await startProductionWiredServer(gatedPool(pool,matches,g)),client=new BrowserLikeClient(server.baseUrl);client.cookie=c1.cookie;client.tenantId=tenant;return {g,server,client};
    }
    await t.test('K-1: concurrent publishes yield one receipt, one stale refusal, one row within 5 s',async()=>{
        const exam=await raceExam();ok(await act(c1,exam,'finalize'));const before=await rowsOf(pool);
        const pair=await bounded(Promise.all([publish(c1,exam),publish(c1,exam)]),'concurrent publish');
        assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);assert.equal(pair.find(r=>r.status===409)?.body.error,'publication_changed');
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_result_publication_events WHERE exam_instance_id=$1',[exam])).rows[0].n,1);
        const after=await rowsOf(pool);for(const table of TABLES.filter(n=>n!=='secure_assessment_result_publication_events'))assert.deepEqual(after[table],before[table]);
    });
    await t.test('K-2: ENDED refuses; publish waits on finalization then succeeds without deadlock',async()=>{
        const exam=await raceExam();assert.equal((await publish(c1,exam)).body.error,'invalid_state');const held=await heldServer(sql=>sql.includes('FOR UPDATE OF i'));
        try{const finishing=act(held.client,exam,'finalize');await bounded(held.g.arrived,'finalizer lock');const publishing=publish(c1,exam);await waitForLock(pool);held.g.release();ok(await bounded(finishing,'finalize'));assert.equal(ok<ResultPublicationReceipt>(await bounded(publishing,'publish after finalize')).revision,1)}
        finally{held.g.release();await held.server.close()}
    });
    await t.test('K-3 N03: revocation waits for authority locks; no publication after revocation commits',async()=>{
        const exam=await raceExam();ok(await act(c1,exam,'finalize'));const held=await heldServer(sql=>sql.includes('FOR SHARE OF ata, tta, tm'));
        try{
            const publishing=publish(held.client,exam);await bounded(held.g.arrived,'authority lock');
            const revoking=pool.query('UPDATE academic_core_teaching_assignments SET revoked_at=statement_timestamp() WHERE id=$1',[teaching.teachingAssignmentId]);
            await waitForLock(pool);held.g.release();ok(await bounded(publishing,'publish'));await bounded(revoking,'revocation');
            await unchanged(async()=>{assert.equal((await publish(c1,exam,{action:'withdraw',expectedRevision:1})).status,403);assert.equal((await publish(c1,TM)).status,403)});
        }finally{held.g.release();await held.server.close();await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at=NULL WHERE id=$1',[teaching.teachingAssignmentId])}
    });
    await t.test('K-4: repeatable-read during publication observes wholly before or wholly after',async()=>{
        const exam=await raceExam();await addParticipant(pool,tenant,exam,s1.personId);ok(await act(c1,exam,'finalize'));
        const before=await mine(sc1),g=gate(),reading=readMyResults(gatedPool(pool,sql=>sql.includes('SELECT p.exam_instance_id, ev.occurred_at'),g),{tenantId:tenant,personId:s1.personId});
        try{await bounded(g.arrived,'read snapshot');ok(await publish(c1,exam));g.release();const r=await bounded(reading,'read completion');assert.equal(r.type,'ok');if(r.type==='ok')assert.deepEqual(r.results,before)}finally{g.release()}
        const after=await mine(sc1);assert.equal(after.length,before.length+1);assert.deepEqual(after.filter(e=>e.examInstanceId!==exam),before);
    });
    await t.test('T-1: append-only, first/alternating/contiguous events, finalization FK and unique key',async()=>{
        await assert.rejects(pool.query('UPDATE secure_assessment_result_publication_events SET reason=reason WHERE exam_instance_id=$1',[TM]),/append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_result_publication_events WHERE exam_instance_id=$1',[TM]),/append-only/);
        const raw=(exam:string,sequence:number,action:string,key=randomUUID())=>pool.query(`INSERT INTO secure_assessment_result_publication_events
            (tenant_id,exam_instance_id,sequence,action,actor_person_id,reason,confirmed,action_key,request_digest)
            VALUES($1,$2,$3,$4,$5,$6,TRUE,$7,repeat('b',64))`,[tenant,exam,sequence,action,t1.personId,REASON,key]);
        const exam=await raceExam();ok(await act(c1,exam,'finalize'));
        for(const[sequence,action]of[[1,'WITHDRAW'],[2,'PUBLISH']] as const)await assert.rejects(raw(exam,sequence,action),/next of its exam/);
        await raw(exam,1,'PUBLISH');await assert.rejects(raw(exam,2,'PUBLISH'),/next of its exam/);await assert.rejects(raw(exam,3,'WITHDRAW'),/next of its exam/);
        const code=(wanted:string)=>(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code===wanted;
        await assert.rejects(raw(E2.exam,1,'PUBLISH'),code('23503'));await assert.rejects(raw(exam,2,'WITHDRAW',originalKey),code('23505'));
    });
    await t.test('T-2: source answer, grade revision and maxScore changes leave published frozen values identical',async()=>{
        const before=await mine(sc1);
        await pool.query('UPDATE secure_assessment_exam_answers SET answer_payload=$2 WHERE exam_attempt_id=$1 AND exam_question_snapshot_id=$3',[a1,JSON.stringify({selectedOptionId:'A'}),tmq[0]]);
        await pool.query('INSERT INTO secure_assessment_essay_grade_revisions(tenant_id,exam_attempt_id,exam_question_snapshot_id,revision,score_micro,graded_by_person_id) VALUES($1,$2,$3,2,0,$4)',[tenant,a1,tmq[2],t1.personId]);
        const c=await pool.connect();
        try{await c.query('BEGIN');await c.query('ALTER TABLE secure_assessment_exam_question_snapshots DISABLE TRIGGER trg_prevent_snapshot_mutation');
            await c.query("UPDATE secure_assessment_exam_question_snapshots SET frozen_content=jsonb_set(frozen_content,'{maxScore}','100') WHERE id=$1",[tmq[0]]);
            await c.query('ALTER TABLE secure_assessment_exam_question_snapshots ENABLE TRIGGER trg_prevent_snapshot_mutation');await c.query('COMMIT')
        }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
        assert.deepEqual(await mine(sc1),before);
    });
});

test('RESULT-003 M-1: populated 0001-0065 upgrade, injected rollback and replay',{skip:skipWithoutDatabase},async t=>{
    const db=await createDisposableDatabase({migrate:false});t.after(()=>db.close());const c=await db.pool.connect();
    try{
        const dir=new URL('../../../../database/migrations/',import.meta.url);
        for(const name of(await readdir(dir)).filter(n=>/^[0-9]{4}.*[.]sql$/.test(n)&&n<'0066').sort())await c.query(await readFile(new URL(name,dir),'utf8'));
        const tenant=await createTenant(db.pool),teacher=await createPersonWithAccount(db.pool,'guru.upgrade');
        const teaching=await createTeachingContext(db.pool,tenant,await addMembership(db.pool,tenant,teacher.personId));
        const exam=await createExamInstance(db.pool,tenant,teaching,{lifecycleState:'ENDED'});await addQuestionSnapshots(db.pool,tenant,exam,1);
        const person=await createPersonWithAccount(db.pool,'siswa.upgrade');await addMembership(db.pool,tenant,person.personId);await addParticipant(db.pool,tenant,exam,person.personId);
        const server=await startProductionWiredServer(db.pool);
        try{const client=new BrowserLikeClient(server.baseUrl);assert.equal((await client.login(teacher.username,teacher.password)).status,200);client.tenantId=tenant;
            ok(await post(client,TRANSITION,{examInstanceId:exam,action:'finalize',reason:REASON,confirmed:true,actionKey:randomUUID()}))
        }finally{await server.close()}
        const rows=async()=>({heads:(await c.query('SELECT to_jsonb(x)::text AS r FROM secure_assessment_exam_result_finalizations x ORDER BY 1')).rows,results:(await c.query('SELECT to_jsonb(x)::text AS r FROM secure_assessment_attempt_results x ORDER BY 1')).rows});
        const before=await rows();assert.equal(before.heads.length,1);assert.equal(before.results.length,1);
        const absent=async()=>{assert.equal((await c.query("SELECT to_regclass('public.secure_assessment_result_publication_events') AS r")).rows[0].r,null);assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0066_secure_assessment_result_publications'")).rows[0].n,0)};
        await absent();const sql=await readFile(new URL('0066_secure_assessment_result_publications.sql',dir),'utf8');
        const failing=sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0066_secure_assessment_result_publications');","RAISE EXCEPTION 'synthetic migration rollback';");assert.notEqual(failing,sql);
        await assert.rejects(c.query(failing),/synthetic migration rollback/);await c.query('ROLLBACK');await absent();assert.deepEqual(await rows(),before);
        await c.query(sql);await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0066_secure_assessment_result_publications'")).rows[0].n,1);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM secure_assessment_result_publication_events')).rows[0].n,0);
        assert.deepEqual(await rows(),before,'no backfill or finalized-row change');
    }finally{c.release()}
});
