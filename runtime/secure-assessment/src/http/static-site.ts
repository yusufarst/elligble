import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';
import type * as http from 'node:http';
import { sendError } from './http-utils.ts';

// Serves the built web client from memory. Every file of the build directory is read once
// at startup, so a request can only resolve to one of those files: there is no filesystem
// access and no path traversal at request time. Paths without a file extension fall back
// to index.html (client-side routes and deep links); unknown assets are 404.

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const GZIP_MIN_BYTES = 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
/** Vite emits content-hashed file names here, so they can be cached forever. */
const IMMUTABLE_PREFIX = '/assets/';

interface StaticFile {
    body: Buffer;
    gzip: Buffer | null;
    contentType: string;
    etag: string;
    cacheControl: string;
}

export interface StaticSite {
    readonly fileCount: number;
    readonly totalBytes: number;
    /** Answers a GET/HEAD for a non-API path (405 for other methods). */
    handle(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void;
}

export class StaticSiteError extends Error {}

function readTree(root: string): Map<string, StaticFile> {
    const files = new Map<string, StaticFile>();
    let total = 0;
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            // Symbolic links and special files are never served.
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            const contentType = CONTENT_TYPES[ext];
            if (!contentType) continue;
            const key = '/' + path.relative(root, full).split(path.sep).join('/');
            const size = statSync(full).size;
            if (size > MAX_FILE_BYTES) throw new StaticSiteError(`Static file exceeds the size limit: ${key}`);
            total += size;
            if (total > MAX_TOTAL_BYTES) throw new StaticSiteError('Static site exceeds the total size limit.');
            const body = readFileSync(full);
            files.set(key, {
                body,
                gzip: COMPRESSIBLE.has(ext) && body.length >= GZIP_MIN_BYTES ? gzipSync(body, { level: 9 }) : null,
                contentType,
                etag: `"${createHash('sha256').update(body).digest('base64url').slice(0, 32)}"`,
                cacheControl: key.startsWith(IMMUTABLE_PREFIX) ? 'public, max-age=31536000, immutable' : 'no-cache',
            });
        }
    };
    walk(root);
    return files;
}

function matchesEtag(header: string | undefined, etag: string): boolean {
    if (!header) return false;
    return header.split(',').some(candidate => {
        const value = candidate.trim();
        return value === '*' || value === etag || value === `W/${etag}`;
    });
}

export function loadStaticSite(rootDir: string): StaticSite {
    const root = path.resolve(rootDir);
    let files: Map<string, StaticFile>;
    try {
        files = readTree(root);
    } catch (err) {
        if (err instanceof StaticSiteError) throw err;
        throw new StaticSiteError(`Static site directory cannot be read: ${root}`);
    }
    const index = files.get('/index.html');
    if (!index) throw new StaticSiteError(`Static site has no index.html: ${root}`);
    let totalBytes = 0;
    for (const file of files.values()) totalBytes += file.body.length;

    return {
        fileCount: files.size,
        totalBytes,
        handle(req, res, pathname) {
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                req.resume();
                sendError(res, 405, 'method_not_allowed', { Allow: 'GET, HEAD' });
                return;
            }
            let key: string;
            try {
                key = decodeURIComponent(pathname);
            } catch {
                sendError(res, 400, 'invalid_request');
                return;
            }
            if (key.includes('\0')) {
                sendError(res, 400, 'invalid_request');
                return;
            }
            let file = files.get(key) ?? (key.endsWith('/') ? files.get(`${key}index.html`) : undefined);
            if (!file) {
                if (path.posix.extname(key) !== '') {
                    sendError(res, 404, 'not_found');
                    return;
                }
                file = index;
            }
            const headers: http.OutgoingHttpHeaders = {
                'Content-Type': file.contentType,
                'Cache-Control': file.cacheControl,
                ETag: file.etag,
                Vary: 'Accept-Encoding',
            };
            if (matchesEtag(req.headers['if-none-match'], file.etag)) {
                res.writeHead(304, headers);
                res.end();
                return;
            }
            const useGzip = file.gzip !== null && /\bgzip\b/i.test(String(req.headers['accept-encoding'] ?? ''));
            const body = useGzip && file.gzip ? file.gzip : file.body;
            if (useGzip) headers['Content-Encoding'] = 'gzip';
            headers['Content-Length'] = body.length;
            res.writeHead(200, headers);
            res.end(req.method === 'HEAD' ? undefined : body);
        },
    };
}
