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
