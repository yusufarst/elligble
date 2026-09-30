import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createServer } from '../../src/server.ts';
import { StaticSiteError, loadStaticSite } from '../../src/http/static-site.ts';

function buildSite(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'elligble-static-'));
    mkdirSync(path.join(root, 'assets'));
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><html lang="id"><body><div id="root"></div></body></html>');
    writeFileSync(path.join(root, 'assets', 'index-abc123.js'), `console.log(${JSON.stringify('x'.repeat(5000))});`);
    writeFileSync(path.join(root, 'assets', 'index-abc123.css'), 'body{margin:0}');
    writeFileSync(path.join(root, 'secret.env'), 'DATABASE_URL=postgres://should-never-be-served');
    return root;
}

async function withServer(root: string, run: (base: string) => Promise<void>) {
    const server = createServer({
        checkReadiness: async () => true,
        pool: {} as never,
        staticSite: loadStaticSite(root),
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    try {
        await run(`http://127.0.0.1:${port}`);
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
}

/** Raw request so paths are sent exactly as written (fetch would normalise dot segments). */
function rawGet(base: string, rawPath: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
    const { hostname, port } = new URL(base);
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname, port, path: rawPath, method: 'GET', headers }, res => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.end();
    });
}

test('static web client hosting', async (t) => {
    const root = buildSite();
    t.after(() => rmSync(root, { recursive: true, force: true }));

    await withServer(root, async base => {
        await t.test('serves index.html for the root and for client-side deep links', async () => {
            for (const target of ['/', '/?attemptId=11111111-1111-4111-8111-111111111111', '/ujian/lanjut']) {
                const res = await fetch(base + target);
                assert.equal(res.status, 200, target);
                assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
                assert.equal(res.headers.get('cache-control'), 'no-cache');
                assert.match(await res.text(), /<div id="root">/);
            }
        });

        await t.test('hashed assets are immutable and compressed when accepted', async () => {
            const res = await rawGet(base, '/assets/index-abc123.js', { 'Accept-Encoding': 'gzip, br' });
            assert.equal(res.status, 200);
            assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
            assert.equal(res.headers['content-encoding'], 'gzip');
            assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8');
            assert.match(gunzipSync(res.body).toString(), /^console\.log/);
            const plain = await rawGet(base, '/assets/index-abc123.js');
            assert.equal(plain.headers['content-encoding'], undefined);
            assert.equal(Number(plain.headers['content-length']), plain.body.length);
        });

        await t.test('conditional requests return 304 with the same validator', async () => {
            const first = await fetch(base + '/assets/index-abc123.css');
            const etag = first.headers.get('etag')!;
            assert.ok(etag);
            const second = await rawGet(base, '/assets/index-abc123.css', { 'If-None-Match': etag });
            assert.equal(second.status, 304);
            assert.equal(second.body.length, 0);
        });

        await t.test('security headers apply to the client too', async () => {
            const res = await fetch(base + '/');
            assert.equal(res.headers.get('x-frame-options'), 'DENY');
            assert.match(res.headers.get('content-security-policy') ?? '', /script-src 'self'/);
            assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        });

        await t.test('unknown assets are 404, never the HTML shell', async () => {
            const res = await fetch(base + '/assets/missing-file.js');
            assert.equal(res.status, 404);
            assert.match(res.headers.get('content-type') ?? '', /application\/json/);
        });

        await t.test('files without a known web type are never served', async () => {
            assert.equal((await fetch(base + '/secret.env')).status, 404);
        });

        await t.test('path traversal cannot leave the build directory', async () => {
            for (const target of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/%2e%2e/etc/passwd', '/assets/..%2f..%2fsecret.env', '/assets%2f..%2fsecret.env']) {
                const res = await rawGet(base, target);
                assert.notEqual(res.status, 500, target);
                assert.doesNotMatch(res.body.toString(), /should-never-be-served|root:x:|"name"/, target);
            }
            assert.equal((await rawGet(base, '/%00index.html')).status, 400);
            assert.equal((await rawGet(base, '/%E0%A4%A')).status, 400);
        });

        await t.test('state-changing methods on client paths are refused', async () => {
            const res = await fetch(base + '/', { method: 'POST', body: 'x' });
            assert.equal(res.status, 405);
            assert.equal(res.headers.get('allow'), 'GET, HEAD');
        });

        await t.test('HEAD returns headers only', async () => {
            const res = await fetch(base + '/', { method: 'HEAD' });
            assert.equal(res.status, 200);
            assert.equal((await res.arrayBuffer()).byteLength, 0);
        });

        await t.test('API paths are never answered by the client fallback', async () => {
            const res = await fetch(base + '/api/v1/unknown-route');
            assert.equal(res.status, 404);
            assert.deepEqual(await res.json(), { error: 'not found' });
            assert.equal(res.headers.get('cache-control'), 'no-store');
        });

        await t.test('health endpoints keep working next to the client', async () => {
            const res = await fetch(base + '/healthz');
            assert.deepEqual(await res.json(), { status: 'alive' });
            assert.equal(res.headers.get('cache-control'), 'no-store');
        });
    });
});

test('static site loading fails fast on a bad build directory', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'elligble-static-empty-'));
    try {
        assert.throws(() => loadStaticSite(empty), StaticSiteError);
        assert.throws(() => loadStaticSite(path.join(empty, 'missing')), StaticSiteError);
    } finally {
        rmSync(empty, { recursive: true, force: true });
    }
});

test('symbolic links inside the build directory are not followed', () => {
    const root = buildSite();
    try {
        symlinkSync('/etc/hostname', path.join(root, 'assets', 'linked.txt'));
        const site = loadStaticSite(root);
        // index.html + 2 assets; secret.env (unknown type) and the link are skipped.
        assert.equal(site.fileCount, 3);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
