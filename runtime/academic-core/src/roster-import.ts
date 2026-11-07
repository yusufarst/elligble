import { createHash, randomUUID } from 'node:crypto';
import type { ClientBase } from 'pg';
import { enrollmentSlotKey, isIsoDate } from './provisioning.ts';
import { findMembership } from '../../tenant-access/src/provisioning.ts';

export const ROSTER_HEADER = ['source_student_key','full_name','nis','nisn','date_of_birth','academic_group_id'];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export class RosterRefusal extends Error {
    readonly status: number; readonly code: string;
    constructor(status: number, code: string) { super(code); this.status=status; this.code=code; }
}
export interface RosterInput { academicYearId: string; academicPeriodId: string; csv: string }
export interface CsvCells { line: number; cells: string[] }
export interface RosterRow { line: number; key: string; name: string; nis: string; nisn: string; birth: string; group: string; invalid: boolean }
export interface PreviewRow { line: number; sourceKey: string; fullName: string; nis: string; groupLabel: string | null; status: 'INSERT'|'UNCHANGED'|'CORRECTION'|'INVALID'|'REVIEW_REQUIRED' }
export interface RosterPreview { protocolVersion: 1; inputDigest: string; stateDigest: string; canConfirm: boolean; rows: PreviewRow[] }
interface Stored { id:string; source_student_key:string; revision:number; full_name:string; nis:string; nisn:string; birth:string; academic_group_id:string; academic_year_id:string; academic_period_id:string; person_id:string|null }
export const rosterDigest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

/** Shared parser is injected by the trusted coordinator, never from an HTTP payload. */
export function parseRoster(input: RosterInput, parser: (text:string)=>CsvCells[]): RosterRow[] {
    if (!uuid(input.academicYearId) || !uuid(input.academicPeriodId) || typeof input.csv!=='string' || Buffer.byteLength(input.csv)>1024*1024) throw new RosterRefusal(400,'invalid_request');
    let cells: CsvCells[];
    try { cells=parser(input.csv); } catch { throw new RosterRefusal(400,'invalid_csv'); }
    if (!cells.length || cells[0].cells.map(c=>c.trim().toLowerCase()).join(',')!==ROSTER_HEADER.join(',')) throw new RosterRefusal(400,'invalid_csv');
    const data=cells.slice(1);
    if (!data.length || data.length>1000) throw new RosterRefusal(400,'invalid_csv');
    const bounded=(v:string,n:number)=>v.length>0 && [...v].length<=n && !/[\u0000-\u001f\u007f]/u.test(v);
    return data.map(r=>{
        const [key='',name='',nis='',nisn='',birth='',group='']=r.cells.map(c=>c.trim());
        return {line:r.line,key,name,nis,nisn,birth,group:group.toLowerCase(),invalid:r.cells.length!==6 || !bounded(key,64)||!bounded(name,200)||!bounded(nis,64)||!bounded(nisn,64)||!isIsoDate(birth)||!uuid(group)};
    });
}

async function storedRows(c:ClientBase,tenant:string,lock=false):Promise<Stored[]> {
    // Effective identity: the immutable 0056 person_id or the AUTH-002 claim binding, so later
    // corrections still check the same Person's enrollment. A disagreement is never resolved here.
    const rows=(await c.query(`SELECT r.id,r.source_student_key,r.revision,r.full_name,r.nis,r.nisn,to_char(r.date_of_birth,'YYYY-MM-DD') AS birth,
        r.academic_year_id,r.academic_period_id,r.academic_group_id,r.person_id AS recorded_person,b.person_id AS bound_person
        FROM academic_core_student_roster_records r LEFT JOIN academic_core_roster_identity_bindings b ON b.roster_id=r.id AND b.tenant_id=r.tenant_id
        WHERE r.tenant_id=$1 ORDER BY r.id ${lock?'FOR UPDATE OF r':''}`,[tenant])).rows;
    return rows.map(({recorded_person,bound_person,...row})=>{
        if(recorded_person&&bound_person&&recorded_person!==bound_person) throw new RosterRefusal(409,'REVIEW_REQUIRED');
        return {...row,person_id:recorded_person??bound_person??null};
    });
}
const same=(s:Stored,r:RosterRow,i:RosterInput)=>s.full_name===r.name && s.nis===r.nis && s.nisn===r.nisn && s.birth===r.birth && s.academic_group_id===r.group && s.academic_year_id===i.academicYearId.toLowerCase() && s.academic_period_id===i.academicPeriodId.toLowerCase();

/** Academic read model. Caller authenticates first; one snapshot for preview, tenant fence for confirm. */
export async function previewRoster(c:ClientBase,tenant:string,input:RosterInput,parsed:RosterRow[],lock=false):Promise<RosterPreview> {
    tenant=tenant.toLowerCase();
    const current=await storedRows(c,tenant);
    const byKey=new Map(current.map(r=>[r.source_student_key,r]));
    const memberships=new Map<string,string|null>();
    const slots:string[]=[];
    for(const row of parsed) {
        const old=byKey.get(row.key);
        if(old?.person_id) {
            let member:string|null=null;
            try { member=await findMembership(c,tenant,old.person_id); } catch { /* ambiguity remains REVIEW_REQUIRED */ }
            memberships.set(row.key,member);
            if(member) slots.push(enrollmentSlotKey(tenant,member,input.academicPeriodId));
        }
    }
    if(lock) for(const key of [...new Set(slots)].sort()) {
        const held=await c.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS held',[key]);
        if(held.rows[0].held!==true) throw new RosterRefusal(409,'stale_conflict');
    }
    const period=await c.query(`SELECT p.id FROM academic_core_academic_periods p JOIN academic_core_academic_years y
        ON y.id=p.academic_year_id AND y.tenant_id=p.tenant_id WHERE p.id=$1 AND p.tenant_id=$2 AND y.id=$3 ${lock?'FOR SHARE OF y,p':''}`,[input.academicPeriodId.toLowerCase(),tenant,input.academicYearId.toLowerCase()]);
    const groups=await c.query(`SELECT id,display_label FROM academic_core_academic_groups WHERE tenant_id=$1 AND academic_year_id=$2 ORDER BY id ${lock?'FOR SHARE':''}`,[tenant,input.academicYearId.toLowerCase()]);
    const groupMap=new Map<string,string>(groups.rows.map(g=>[g.id,g.display_label]));
    if(lock) {
        const latest=await storedRows(c,tenant,true);
        if(rosterDigest(latest)!==rosterDigest(current)) throw new RosterRefusal(409,'stale_conflict');
    }
    const enrollmentState:unknown[]=[];
    const rows:PreviewRow[]=[];
    for(const row of parsed) {
        const old=byKey.get(row.key);
        let status:PreviewRow['status']=old?(same(old,row,input)?'UNCHANGED':'CORRECTION'):'INSERT';
        if(row.invalid || !period.rows.length || !groupMap.has(row.group)) status='INVALID';
        if(parsed.some(other=>other!==row&&(other.key===row.key||other.nis===row.nis||(other.nisn===row.nisn&&other.birth===row.birth)))) status='REVIEW_REQUIRED';
        if(current.some(other=>other.source_student_key!==row.key&&(other.nis===row.nis||(other.nisn===row.nisn&&other.birth===row.birth)))) status='REVIEW_REQUIRED';
        if(old?.person_id) {
            const member=memberships.get(row.key);
            if(!member) status='REVIEW_REQUIRED';
            else {
                // Always fresh after slot acquisition, including initially absent slots.
                const es=await c.query(`SELECT id,academic_group_id FROM academic_core_student_enrollments WHERE tenant_id=$1 AND membership_id=$2 AND academic_period_id=$3 AND end_date IS NULL ORDER BY id`,[tenant,member,input.academicPeriodId.toLowerCase()]);
                enrollmentState.push({key:row.key,member,rows:es.rows});
                if(es.rows.length>1 || es.rows.some(e=>e.academic_group_id!==row.group)) status='REVIEW_REQUIRED';
            }
        }
        rows.push({line:row.line,sourceKey:row.key,fullName:row.name,nis:row.nis,groupLabel:groupMap.get(row.group)??null,status});
    }
    return {protocolVersion:1,inputDigest:rosterDigest({year:input.academicYearId.toLowerCase(),period:input.academicPeriodId.toLowerCase(),csv:input.csv}),
        stateDigest:rosterDigest({current,groups:groups.rows,period:period.rows,enrollmentState}),canConfirm:rows.every(r=>!['INVALID','REVIEW_REQUIRED'].includes(r.status)),rows};
}

export interface RosterReceipt { id:string; outcome:'APPLIED'|'NO_OP'; summary:{inserted:number;corrected:number;unchanged:number}; replayed:boolean }
export async function findRosterReceipt(c:ClientBase,tenant:string,actor:string,key:string,digest:string):Promise<RosterReceipt|null> {
    const r=await c.query('SELECT id,request_digest,outcome,summary FROM academic_core_roster_import_receipts WHERE tenant_id=$1 AND actor_person_id=$2 AND request_key=$3',[tenant,actor,key]);
    if(!r.rows.length) return null;
    if(r.rows[0].request_digest!==digest) throw new RosterRefusal(409,'action_key_reused');
    return {id:r.rows[0].id,outcome:r.rows[0].outcome,summary:r.rows[0].summary,replayed:true};
}
export async function applyRoster(c:ClientBase,tenant:string,actor:string,key:string,digest:string,reason:string,input:RosterInput,parsed:RosterRow[],preview:RosterPreview):Promise<RosterReceipt> {
    if(!preview.canConfirm) throw new RosterRefusal(409,'REVIEW_REQUIRED');
    const receipt=randomUUID(),summary={inserted:0,corrected:0,unchanged:0};
    for(let n=0;n<parsed.length;n++) {
        const row=parsed[n],state=preview.rows[n];
        if(state.status==='UNCHANGED') { summary.unchanged++;continue; }
        const values=[tenant,row.key,row.name,row.nis,row.nisn,row.birth,input.academicYearId.toLowerCase(),input.academicPeriodId.toLowerCase(),row.group];
        const result=state.status==='INSERT'
            ?await c.query(`INSERT INTO academic_core_student_roster_records(tenant_id,source_student_key,full_name,nis,nisn,date_of_birth,academic_year_id,academic_period_id,academic_group_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,revision`,values)
            :await c.query(`UPDATE academic_core_student_roster_records SET full_name=$3,nis=$4,nisn=$5,date_of_birth=$6,academic_year_id=$7,academic_period_id=$8,academic_group_id=$9,revision=revision+1,updated_at=statement_timestamp() WHERE tenant_id=$1 AND source_student_key=$2 RETURNING id,revision`,values);
        const record=result.rows[0];if(!record) throw new RosterRefusal(409,'stale_conflict');
        await c.query(`INSERT INTO academic_core_student_roster_revisions(roster_id,tenant_id,previous_revision,resulting_revision,receipt_id,protected_values) VALUES($1,$2,$3,$4,$5,$6)`,[record.id,tenant,record.revision-1,record.revision,receipt,JSON.stringify({name:row.name,nis:row.nis,nisn:row.nisn,birth:row.birth,group:row.group,year:input.academicYearId.toLowerCase(),period:input.academicPeriodId.toLowerCase()})]);
        if(state.status==='INSERT')summary.inserted++;else summary.corrected++;
    }
    const outcome=summary.inserted+summary.corrected?'APPLIED':'NO_OP';
    await c.query(`INSERT INTO academic_core_roster_import_receipts(id,tenant_id,actor_person_id,request_key,input_digest,request_digest,preview_digest,reason,outcome,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[receipt,tenant,actor,key,preview.inputDigest,digest,preview.stateDigest,reason,outcome,JSON.stringify(summary)]);
    return {id:receipt,outcome,summary,replayed:false};
}
