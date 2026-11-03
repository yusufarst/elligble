import test from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentSlotKey } from '../src/provisioning.ts';
import { parseRoster, ROSTER_HEADER, RosterRefusal } from '../src/roster-import.ts';
import { parseCsv } from '../../secure-assessment/src/ops/provisioning/csv.ts';

const id='abcdefab-1234-5678-abcd-123456abcdef';
test('enrollment keys canonicalize every UUID and refuse malformed scope',()=>{
    const expected=`ac_enrollment:${id}:${id}:${id}`;
    for(const a of [id,id.toUpperCase(),'AbCdEfAb-1234-5678-aBcD-123456AbCdEf'])
        for(const b of [id,id.toUpperCase()]) assert.equal(enrollmentSlotKey(a,b,id.toUpperCase()),expected);
    for(const value of ['',id+' ','{'+id+'}','not-a-uuid']) assert.throws(()=>enrollmentSlotKey(id,value,id));
});
test('roster CSV preserves leading zeros and validates dates/shape without evaluating content',()=>{
    const input={academicYearId:id,academicPeriodId:id,csv:'\ufeff'+ROSTER_HEADER.join(',')+'\nkey,"Nama, Sintetis",001,00002,2010-02-28,'+id};
    const [row]=parseRoster(input,parseCsv);assert.equal(row.nis,'001');assert.equal(row.nisn,'00002');assert.equal(row.name,'Nama, Sintetis');assert.equal(row.invalid,false);
    assert.equal(parseRoster({...input,csv:input.csv.replace('2010-02-28','2010-02-30')},parseCsv)[0].invalid,true);
    assert.throws(()=>parseRoster({...input,csv:'wrong\na'},parseCsv),RosterRefusal);
    assert.throws(()=>parseRoster({...input,csv:ROSTER_HEADER.join(',')+'\n'+Array(1001).fill('k,n,1,2,2010-01-01,'+id).join('\n')},parseCsv),RosterRefusal);
});
