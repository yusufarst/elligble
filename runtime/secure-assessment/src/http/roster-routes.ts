import type { IncomingMessage,ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import type { SessionCookieConfig } from './session-credentials.ts';
import { HttpError,readJsonObject,sendError,sendJson } from './http-utils.ts';
import { runRoster,rosterError } from '../roster-import.ts';

export async function handleRoster(req:IncomingMessage,res:ServerResponse,pool:Pool,cookie:SessionCookieConfig,confirm:boolean) {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){req.resume();sendError(res,405,'method_not_allowed');return;}
    try {
        const body=await readJsonObject(req,1024*1024);
        sendJson(res,200,await runRoster(pool,req,cookie,body,confirm));
    } catch(e) {
        if(e instanceof HttpError){sendError(res,e.statusCode,e.message);return;}
        const error=rosterError(e);sendError(res,error.status,error.code);
    }
}
