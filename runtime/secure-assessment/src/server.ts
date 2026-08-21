import * as http from 'node:http';

export interface ServerDependencies {
    checkReadiness: () => Promise<boolean>;
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

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });

    return server;
}
