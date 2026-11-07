import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// SEC-OPS-001 units (record §6/§6A, C02): the `session revoke` command validates operator,
// case, reason, ELLIGBLE ID and tenant before any connection, also in a dry run, and no HTTP
// route or School Operator path reaches the intervention.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const CLI = path.join(SRC, 'ops/provision-cli.ts');
const TENANT = '11111111-1111-4111-8111-111111111111';

// No DATABASE_URL: a command that passes validation stops at the connection check instead.
function cli(...args: string[]) {
    const res = spawnSync(process.execPath, [CLI, 'session', 'revoke', ...args], { env: { PATH: process.env['PATH'] ?? '' }, encoding: 'utf8' });
    return { code: res.status, out: res.stdout + res.stderr };
}
const VALID = ['--tenant', TENANT, '--elligble-id', 'elg-abcd-efgh-jkmn', '--reason', 'Sesi dicurigai diambil alih', '--operator', 'Pemilik Platform', '--case', 'INC-2026-001'];
const without = (flag: string) => { const i = VALID.indexOf(flag); return [...VALID.slice(0, i), ...VALID.slice(i + 2)]; };
const withValue = (flag: string, value: string) => { const a = [...VALID]; a[a.indexOf(flag) + 1] = value; return a; };

test('a valid command passes validation and only then needs the database', () => {
    for (const args of [VALID, [...VALID, '--dry-run']]) {
        const r = cli(...args);
        assert.equal(r.code, 2);
        assert.match(r.out, /DATABASE_URL is not set/);
    }
});

test('operator, case, reason, ELLIGBLE ID and tenant are required and bounded, also in a dry run', () => {
    const cases: Array<[string[], RegExp]> = [
        [without('--operator'), /--operator and --case are required/],
        [without('--case'), /--operator and --case are required/],
        [[...without('--operator'), '--dry-run'], /--operator and --case are required/],
        [[...without('--case'), '--dry-run'], /--operator and --case are required/],
        [withValue('--operator', ' '), /--operator and --case are required/],
        [withValue('--case', 'x'.repeat(201)), /--operator and --case are required/],
        [without('--reason'), /--reason is required \(1 to 200 characters\)/],
        [[...without('--reason'), '--dry-run'], /--reason is required/],
        [withValue('--reason', '   '), /--reason is required/],
        [withValue('--reason', 'x'.repeat(201)), /--reason is required/],
        [without('--elligble-id'), /--elligble-id is required/],
        [withValue('--elligble-id', ' '), /--elligble-id is required/],
        [without('--tenant'), /--tenant is required/],
        [withValue('--tenant', 'bukan-uuid'), /--tenant must be/],
        [[...VALID, '--unknown', 'x'], /Usage error/],
    ];
    for (const [args, message] of cases) {
        const r = cli(...args);
        assert.equal(r.code, 2, `${args.join(' ')} -> ${r.out}`);
        assert.match(r.out, message);
        assert.doesNotMatch(r.out, /DATABASE_URL is not set/, 'validation happens before any connection');
    }
    assert.match(cli('--help').out, /session revoke/);
});

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? sources(full) : full.endsWith('.ts') ? [full] : [];
    });
}

test('no HTTP route or School Operator path reaches the intervention (no-route assertion)', () => {
    const users = sources(SRC).filter(f => /revokeAccountSessions\b|provisioning\/sessions(\.ts)?['"]/.test(readFileSync(f, 'utf8')))
        .map(f => path.relative(SRC, f).split(path.sep).join('/')).sort();
    assert.deepEqual(users, ['ops/provision-cli.ts', 'ops/provisioning/sessions.ts']);
    const routes = sources(SRC).flatMap(f => [...readFileSync(f, 'utf8').matchAll(/['"`](\/api\/v1\/[^'"`]*)['"`]/g)].map(m => m[1]));
    assert.ok(routes.length > 0, 'the route table was read');
    for (const route of routes) assert.doesNotMatch(route, /session[^/]*\/?.*revok|revok.*session|intervention/i, route);
});
