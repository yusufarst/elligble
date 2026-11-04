import test from 'node:test';
import assert from 'node:assert/strict';
import type { ClientBase } from 'pg';
import { operatorUuid,schoolOperatorAssignment,setSchoolOperator } from '../src/school-operator.ts';
test('Operator authority never comes from malformed scope or a supplied label',async()=>{
    let calls=0;const c={query:async()=>{calls++;throw new Error('Unexpected SQL');}} as unknown as ClientBase;
    assert.equal(operatorUuid('operator'),false);
    assert.equal(await schoolOperatorAssignment(c,'wrong','wrong'),null);
    await assert.rejects(setSchoolOperator(c,{tenantId:'bad',personId:'bad',action:'ASSIGN',operator:'Admin',caseReference:'case',reason:'test'}));
    assert.equal(calls,0);
});
