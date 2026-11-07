import { apiFetch } from './http.ts';
export interface RosterInput { academicYearId:string; academicPeriodId:string; csv:string }
export interface RosterPreview {
  protocolVersion:1; inputDigest:string; stateDigest:string; canConfirm:boolean;
  rows:Array<{line:number;sourceKey:string;fullName:string;nis:string;groupLabel:string|null;status:'INSERT'|'UNCHANGED'|'CORRECTION'|'INVALID'|'REVIEW_REQUIRED'}>;
}
export interface RosterReceipt { id:string;outcome:'APPLIED'|'NO_OP';summary:{inserted:number;corrected:number;unchanged:number};replayed:boolean }
export class RosterApiError extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.code=code;}
}
async function request<T>(path:string,input:unknown):Promise<T> {
  const res=await apiFetch('/api/v1/identity/roster/'+path,{method:'POST',json:input});
  if(!res.ok){const body:unknown=await res.json().catch(()=>null);throw new RosterApiError(typeof body==='object'&&body!==null&&'error' in body&&typeof body.error==='string'?body.error:'unavailable');}
  return res.json() as Promise<T>;
}
export const previewRoster=(input:RosterInput)=>request<RosterPreview>('preview',input);
export const confirmRoster=(input:RosterInput,intent:{inputDigest:string;stateDigest:string;requestKey:string;reason:string;confirmed:true})=>request<RosterReceipt>('confirm',{...input,...intent});

// AUTH-002 Student claim and scoped verification (record §7). The public submission is a
// non-trusted request with a uniform receipt; review and decision need a scoped verifier.
export interface ClaimSubmission { tenantId:string; fullName:string; nisn:string; birthDate:string; requestKey:string }
export interface ClaimReceipt { status:'received'; requestKey:string }
export type ClaimState='PENDING_REVIEW'|'REVIEW_REQUIRED'|'APPROVED_PENDING_ACTIVATION';
export interface ClaimReviewItem {
  claimId:string; revision:number; state:ClaimState; expired:boolean; createdAt:string; expiresAt:string;
  submitted:{fullName:string;nisn:string;birthDate:string};
  roster:{revision:number;fullName:string;groupLabel:string|null;bound:boolean;nameMatches:boolean}|null;
}
export interface ClaimReview { authority:'school_operator'|'homeroom'; claims:ClaimReviewItem[]; offset:number; truncated:boolean }
export type ClaimAdjudication='EXISTING_BINDING'|'EXISTING_ACCOUNT_CONTINUITY'|'NEW_IDENTITY_REVIEWED';
export interface ClaimDecisionInput {
  claimId:string; expectedRevision:number; expectedRosterRevision?:number; decision:'APPROVE'|'REJECT'|'CANCEL';
  adjudication?:ClaimAdjudication; elligbleId?:string; noExistingAccountConfirmed?:true;
  reason:string; confirmed:true; requestKey:string;
}
export type ClaimDecisionResult =
  | {outcome:'APPROVED';claimId:string;revision:number;elligbleId:string;activationCode:string;activationExpiresAt:string;claimExpiresAt:string;replayed:false}
  | {outcome:'APPROVED_EXISTING_ACCOUNT';claimId:string;revision:number;elligbleId:string;replayed:false}
  | {outcome:string;claimId:string;revision:number;replayed:boolean};
export class ClaimApiError extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.code=code;}
}
async function claimRequest<T>(url:string,init:{method:'GET'|'POST';json?:unknown}):Promise<T> {
  let res:Response;
  try{res=await apiFetch(url,init);}catch{throw new ClaimApiError('unavailable');}
  if(!res.ok){const body:unknown=await res.json().catch(()=>null);throw new ClaimApiError(typeof body==='object'&&body!==null&&'error' in body&&typeof body.error==='string'?body.error:'unavailable');}
  return res.json() as Promise<T>;
}
export const submitClaim=(input:ClaimSubmission)=>claimRequest<ClaimReceipt>('/api/v1/identity/claims',{method:'POST',json:input});
export const getClaimReview=(offset=0)=>claimRequest<ClaimReview>('/api/v1/identity/claims/review'+(offset>0?`?offset=${offset}`:''),{method:'GET'});
export const decideClaim=(input:ClaimDecisionInput)=>claimRequest<ClaimDecisionResult>('/api/v1/identity/claims/decision',{method:'POST',json:input});

// AUTH-003 in-person recovery (record §7): scoped verifier preview, then a reasoned issue.
export interface RecoveryPreview { phase:'preview'; elligbleId:string; roster:{fullName:string;nisn:string;birthDate:string;groupLabel:string|null;revision:number} }
export type RecoveryIssue =
  | { phase:'issued'; elligbleId:string; recoveryCode:string; expiresAt:string; replayed:false }
  | { phase:'issued'; elligbleId:string; expiresAt:string; replayed:true };
export type RecoveryAuthorizeInput =
  | { elligbleId:string; confirmed:false }
  | { elligbleId:string; confirmed:true; expectedRosterRevision:number; reason:string; requestKey:string; inPersonVerified:true };
export const authorizeRecovery=<T extends RecoveryPreview|RecoveryIssue>(input:RecoveryAuthorizeInput)=>claimRequest<T>('/api/v1/identity/recovery/authorize',{method:'POST',json:input});
