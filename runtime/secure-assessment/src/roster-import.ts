import type { Pool } from 'pg';
import type { IncomingMessage } from 'node:http';
import { buildAuthenticatedContext, AuthenticationError } from './http/authenticated-context.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { operatorUuid, schoolOperatorAssignment } from '../../tenant-access/src/school-operator.ts';
import { parseRoster,previewRoster,applyRoster,findRosterReceipt,rosterDigest,RosterRefusal,type RosterInput } from '../../academic-core/src/roster-import.ts';
import { parseCsv } from './ops/provisioning/csv.ts';
import { normalizePermissionReason } from './permission-action-audit.ts';

export async function runRoster(pool:Pool,req:IncomingMessage,cookie:SessionCookieConfig,body:Record<string,unknown>,confirm:boolean) {
    const allowed=confirm?['academicYearId','academicPeriodId','csv','inputDigest','stateDigest','requestKey','reason','confirmed']:['academicYearId','academicPeriodId','csv'];
    if(Object.keys(body).some(k=>!allowed.includes(k))) throw new RosterRefusal(400,'invalid_request');
    const input=body as unknown as RosterInput;
    const parsed=parseRoster(input,parseCsv);
    const reason=confirm?normalizePermissionReason(body.reason):null;
    if(confirm && (!reason || body.confirmed!==true || !operatorUuid(body.requestKey) || typeof body.inputDigest!=='string' || typeof body.stateDigest!=='string')) throw new RosterRefusal(400,'invalid_request');
    const initial=await buildAuthenticatedContext(req,pool,{cookie});
    if(!initial) throw new RosterRefusal(403,'forbidden');
    const c=await pool.connect();
    try {
        // Preview needs a consistent snapshot but preserves ordinary session bookkeeping.
        await c.query(confirm?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ');
        const tenant=initial.tenantId.toLowerCase(),actor=initial.personId.toLowerCase();
        if(confirm) {
            await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`roster-request:${tenant}:${actor}:${String(body.requestKey).toLowerCase()}`]);
            await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`roster-tenant:${tenant}`]);
        }
        const membership=await buildAuthenticatedContext(req,pool,{cookie,client:c,mutation:confirm});
        if(!membership || membership.tenantId.toLowerCase()!==tenant || membership.personId.toLowerCase()!==actor || !(await schoolOperatorAssignment(c,tenant,membership.membershipId,confirm))) throw new RosterRefusal(403,'forbidden');
        // Assignment acquisition can wait; recheck authoritative time before replay disclosure too.
        if(confirm && !(await buildAuthenticatedContext(req,pool,{cookie,client:c,mutation:true}))) throw new RosterRefusal(401,'unauthorized');
        const digest=rosterDigest({version:1,tenant,actor,year:input.academicYearId.toLowerCase(),period:input.academicPeriodId.toLowerCase(),csv:input.csv,inputDigest:body.inputDigest,stateDigest:body.stateDigest,reason,confirmed:confirm});
        if(confirm) {
            const earlier=await findRosterReceipt(c,tenant,actor,String(body.requestKey).toLowerCase(),digest);
            if(earlier) {await c.query('COMMIT');return earlier;}
        }
        const preview=await previewRoster(c,tenant,input,parsed,confirm);
        if(!confirm) {await c.query('COMMIT');return preview;}
        if(!preview.canConfirm) throw new RosterRefusal(409,'REVIEW_REQUIRED');
        if(preview.inputDigest!==body.inputDigest || preview.stateDigest!==body.stateDigest) throw new RosterRefusal(409,'stale_conflict');
        if(!(await buildAuthenticatedContext(req,pool,{cookie,client:c,mutation:true}))) throw new RosterRefusal(401,'unauthorized');
        const receipt=await applyRoster(c,tenant,actor,String(body.requestKey).toLowerCase(),digest,reason!,input,parsed,preview);
        await c.query('COMMIT');return receipt;
    } catch(e) {await c.query('ROLLBACK').catch(()=>{});throw e;} finally {c.release();}
}

export function rosterError(error:unknown):{status:number;code:string} {
    if(error instanceof RosterRefusal)return{status:error.status,code:error.code};
    if(error instanceof AuthenticationError)return{status:error.statusCode,code:error.message};
    return {status:503,code:'persistence_unavailable'};
}
