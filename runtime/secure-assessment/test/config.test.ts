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
