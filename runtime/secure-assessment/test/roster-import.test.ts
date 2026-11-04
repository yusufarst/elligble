import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterError } from '../src/roster-import.ts';
import { RosterRefusal } from '../../academic-core/src/roster-import.ts';
test('roster failures project bounded codes, never database messages or row contents',()=>{
    assert.deepEqual(rosterError(new Error('NISN private row and SQL')),{status:503,code:'persistence_unavailable'});
    assert.deepEqual(rosterError(new RosterRefusal(409,'stale_conflict')),{status:409,code:'stale_conflict'});
});
