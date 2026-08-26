import * as http from 'node:http';
import * as pg from 'pg';
import { handleSaveAnswer, type AuthorizedAssessmentContext } from './answer.ts';
import { handleTimerStart, handleTimerGet } from './timer.ts';
import { handleSubmit, handleSubmissionGet } from './submission.ts';

export interface ServerDependencies {
    checkReadiness: () => Promise<boolean>;
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

export function createServer(deps: ServerDependencies): http.Server {
    const server = http.createServer();

    server.on('request', (req, res) => {
        if (req.method === 'GET' && req.url === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'alive' }));
            return;
        }

        if (req.method === 'GET' && req.url === '/readyz') {
            deps.checkReadiness().then(isReady => {
                if (isReady) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ready' }));
                } else {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'unavailable' }));
                }
            }).catch(() => {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error' }));
            });
            return;
        }

        if (req.url === '/api/v1/assessment/answer/save') {
            handleSaveAnswer(req, res, deps);
            return;
        }

        if (req.url === '/api/v1/assessment/timer/start') {
            handleTimerStart(req, res, deps);
            return;
        }

        if (req.url === '/api/v1/assessment/submit') {
            handleSubmit(req, res, deps);
            return;
        }

        if (req.url && req.url.startsWith('/api/v1/assessment/submission')) {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            if (parsedUrl.pathname === '/api/v1/assessment/submission') {
                handleSubmissionGet(req, res, deps);
                return;
            }
        }

        if (req.url && req.url.startsWith('/api/v1/assessment/timer')) {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            if (parsedUrl.pathname === '/api/v1/assessment/timer') {
                handleTimerGet(req, res, deps);
                return;
            }
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });

    return server;
}
