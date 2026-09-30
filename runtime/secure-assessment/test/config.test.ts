import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseConfig } from '../src/config.ts';

test('valid configuration and frozen', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_HOST: '127.0.0.1',
        SA_PORT: '8080',
        SA_DB_POOL_MAX: '20',
        SA_DB_CONNECT_TIMEOUT_MS: '1000'
    };

    const config = parseConfig(env);

    assert.equal(config.DATABASE_URL, 'postgres://user:pass@localhost:5432/db');
    assert.equal(config.SA_HOST, '127.0.0.1');
    assert.equal(config.SA_PORT, 8080);
    assert.equal(config.SA_DB_POOL_MAX, 20);
    assert.equal(config.SA_DB_CONNECT_TIMEOUT_MS, 1000);
    assert.ok(Object.isFrozen(config), 'Configuration object must be frozen');
});

test('missing DATABASE_URL', () => {
    const env = {
        SA_PORT: '8080'
    };

    let error: Error | undefined;
    try {
        parseConfig(env);
    } catch (e) {
        error = e as Error;
    }

    assert.ok(error);
    assert.match(error.message, /DATABASE_URL is not set/);
    assert.doesNotMatch(error.message, /secret|password/i);
});

test('malformed SA_PORT', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_PORT: 'notaport'
    };
    assert.throws(() => parseConfig(env), /SA_PORT must be a positive bounded integer/);
});

test('malformed trailing junk', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_PORT: '8080abc'
    };
    assert.throws(() => parseConfig(env), /SA_PORT must be a positive bounded integer/);
});

test('decimal integer input rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_PORT: '8080.5'
    };
    assert.throws(() => parseConfig(env), /SA_PORT must be a positive bounded integer/);
});

test('port > 65535 rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_PORT: '65536'
    };
    assert.throws(() => parseConfig(env), /SA_PORT must be between 1 and 65535/);
});

test('SA_DB_POOL_MAX > 100 rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_DB_POOL_MAX: '101'
    };
    assert.throws(() => parseConfig(env), /SA_DB_POOL_MAX must be between 1 and 100/);
});

test('SA_DB_CONNECT_TIMEOUT_MS > 60000 rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_DB_CONNECT_TIMEOUT_MS: '60001'
    };
    assert.throws(() => parseConfig(env), /SA_DB_CONNECT_TIMEOUT_MS must be between 1 and 60000/);
});

test('secret sentinel leak test', () => {
    const env = {
        DATABASE_URL: 'postgres://secret-user:ULTRA_SECRET_VALUE@localhost:5432/db',
        SA_PORT: 'not_a_number'
    };

    let error: Error | undefined;
    try {
        parseConfig(env);
    } catch (e) {
        error = e as Error;
    }

    assert.ok(error);
    assert.match(error.message, /SA_PORT must be a positive bounded integer/);
    assert.doesNotMatch(error.message, /ULTRA_SECRET_VALUE/);
});

test('explicit empty SA_PORT is rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_PORT: ''
    };
    assert.throws(() => parseConfig(env), /SA_PORT must be a positive bounded integer/);
});

test('explicit empty SA_DB_POOL_MAX is rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_DB_POOL_MAX: ''
    };
    assert.throws(() => parseConfig(env), /SA_DB_POOL_MAX must be a positive bounded integer/);
});

test('explicit empty SA_DB_CONNECT_TIMEOUT_MS is rejected', () => {
    const env = {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        SA_DB_CONNECT_TIMEOUT_MS: ''
    };
    assert.throws(() => parseConfig(env), /SA_DB_CONNECT_TIMEOUT_MS must be a positive bounded integer/);
});

test('deployment environment defaults to production with secure cookies', () => {
    const config = parseConfig({ DATABASE_URL: 'postgres://localhost/db' });
    assert.equal(config.ELLIGBLE_ENV, 'production');
    assert.equal(config.SA_COOKIE_SECURE, true);
    assert.deepEqual(config.SA_ALLOWED_ORIGINS, []);
    assert.equal(config.SA_STATIC_DIR, null);
});

test('insecure cookies are refused in production', () => {
    assert.throws(
        () => parseConfig({ DATABASE_URL: 'postgres://localhost/db', SA_COOKIE_SECURE: 'false' }),
        /SA_COOKIE_SECURE cannot be false when ELLIGBLE_ENV is production/
    );
});

test('development defaults to insecure cookies for plain-http local work', () => {
    const config = parseConfig({ DATABASE_URL: 'postgres://localhost/db', ELLIGBLE_ENV: 'development' });
    assert.equal(config.SA_COOKIE_SECURE, false);
});

test('unknown environment and malformed booleans or origins are rejected', () => {
    assert.throws(() => parseConfig({ DATABASE_URL: 'postgres://u@h/db', ELLIGBLE_ENV: 'staging' }), /ELLIGBLE_ENV must be/);
    assert.throws(() => parseConfig({ DATABASE_URL: 'postgres://u@h/db', SA_COOKIE_SECURE: 'yes' }), /SA_COOKIE_SECURE must be true or false/);
    assert.throws(() => parseConfig({ DATABASE_URL: 'postgres://u@h/db', SA_ALLOWED_ORIGINS: 'https://a.example/path' }), /bare http\(s\) origins/);
    assert.throws(() => parseConfig({ DATABASE_URL: 'postgres://u@h/db', SA_ALLOWED_ORIGINS: 'ftp://a.example' }), /bare http\(s\) origins/);
});

test('allowed origins are parsed and frozen', () => {
    const config = parseConfig({ DATABASE_URL: 'postgres://u@h/db', SA_ALLOWED_ORIGINS: 'https://ujian.sekolah.sch.id, https://admin.sekolah.sch.id' });
    assert.deepEqual(config.SA_ALLOWED_ORIGINS, ['https://ujian.sekolah.sch.id', 'https://admin.sekolah.sch.id']);
    assert.ok(Object.isFrozen(config.SA_ALLOWED_ORIGINS));
});

test('DATABASE_URL must be a PostgreSQL URL and is never echoed', () => {
    for (const value of ['mysql://root:hunter2@db/app', 'not a url with hunter2', 'http://db:5432/app']) {
        assert.throws(
            () => parseConfig({ DATABASE_URL: value }),
            (err: Error) => /postgres:\/\/ or postgresql:\/\//.test(err.message) && !err.message.includes('hunter2')
        );
    }
    assert.equal(parseConfig({ DATABASE_URL: 'postgresql://u@h/db' }).DATABASE_URL, 'postgresql://u@h/db');
});

test('startup migration mode defaults to check and cannot be off in production', () => {
    const base = { DATABASE_URL: 'postgres://u@h/db' };
    assert.equal(parseConfig(base).SA_MIGRATIONS_ON_START, 'check');
    assert.equal(parseConfig({ ...base, SA_MIGRATIONS_ON_START: 'apply' }).SA_MIGRATIONS_ON_START, 'apply');
    assert.equal(parseConfig({ ...base, ELLIGBLE_ENV: 'development', SA_MIGRATIONS_ON_START: 'off' }).SA_MIGRATIONS_ON_START, 'off');
    assert.throws(() => parseConfig({ ...base, SA_MIGRATIONS_ON_START: 'off' }), /cannot be off/);
    assert.throws(() => parseConfig({ ...base, SA_MIGRATIONS_ON_START: 'yes' }), /check, apply or off/);
});

test('startup database wait is bounded', () => {
    const base = { DATABASE_URL: 'postgres://u@h/db' };
    assert.equal(parseConfig(base).SA_STARTUP_DB_WAIT_SECONDS, 60);
    assert.equal(parseConfig({ ...base, SA_STARTUP_DB_WAIT_SECONDS: '0' }).SA_STARTUP_DB_WAIT_SECONDS, 0);
    assert.throws(() => parseConfig({ ...base, SA_STARTUP_DB_WAIT_SECONDS: '601' }), /between 0 and 600/);
    assert.throws(() => parseConfig({ ...base, SA_STARTUP_DB_WAIT_SECONDS: '-1' }), /bounded integer/);
});

test('the expiry finalization interval is bounded', () => {
    const base = { DATABASE_URL: 'postgres://u@h/db' };
    assert.equal(parseConfig(base).SA_EXPIRY_SWEEP_SECONDS, 15);
    assert.equal(parseConfig({ ...base, SA_EXPIRY_SWEEP_SECONDS: '1' }).SA_EXPIRY_SWEEP_SECONDS, 1);
    assert.throws(() => parseConfig({ ...base, SA_EXPIRY_SWEEP_SECONDS: '0' }), /between 1 and 300/);
    assert.throws(() => parseConfig({ ...base, SA_EXPIRY_SWEEP_SECONDS: '301' }), /between 1 and 300/);
});

test('the metrics listener is off unless a separate port is configured', () => {
    const base = { DATABASE_URL: 'postgres://u@h/db' };
    assert.equal(parseConfig(base).SA_METRICS_PORT, null);
    assert.equal(parseConfig(base).SA_METRICS_HOST, '127.0.0.1');
    const on = parseConfig({ ...base, SA_METRICS_PORT: '9464', SA_METRICS_HOST: '10.0.0.5' });
    assert.equal(on.SA_METRICS_PORT, 9464);
    assert.equal(on.SA_METRICS_HOST, '10.0.0.5');
    assert.throws(() => parseConfig({ ...base, SA_PORT: '9464', SA_METRICS_PORT: '9464' }), /must differ from SA_PORT/);
    assert.throws(() => parseConfig({ ...base, SA_METRICS_PORT: '70000' }), /between 1 and 65535/);
    assert.throws(() => parseConfig({ ...base, SA_METRICS_PORT: 'abc' }), /bounded integer/);
});
