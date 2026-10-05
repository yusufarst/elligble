import test from 'node:test';
import assert from 'node:assert';
import { isValidTimeZone } from '../src/provisioning.ts';

test('school time zones are IANA names the runtime knows (D04.2-36)', () => {
    for (const zone of ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura', 'UTC', 'America/Argentina/Buenos_Aires']) {
        assert.equal(isValidTimeZone(zone), true, zone);
    }
    for (const zone of ['', 'WIB', 'Asia/Atlantis', '+07:00', 'Asia/Jakarta; DROP TABLE', 'Asia//Jakarta', 42, null, 'A'.repeat(65)]) {
        assert.equal(isValidTimeZone(zone), false, String(zone));
    }
});
