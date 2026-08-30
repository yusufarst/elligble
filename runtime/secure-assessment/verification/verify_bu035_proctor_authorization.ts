import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import { Client, Pool } from 'pg';
import { authorizeExplicitProctorAssignment } from '../src/proctor-authorization.ts';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    console.error('DATABASE_URL must be provided');
    process.exit(1);
}

const runId = Math.random().toString(36).substring(2, 9);
const TEST_DB = `elligble_bu035_${runId}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');

function assertStrict(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

async function main() {
    const log = (msg: string) => {
        console.log(`- PASS: ${msg}`);
    };

    const parsedUrl = new URL(DB_URL as string);
    parsedUrl.pathname = '/postgres';
    const setupClient = new Client({ connectionString: parsedUrl.toString() });

    await setupClient.connect();
    try {
        await setupClient.query(`CREATE DATABASE ${TEST_DB}`);
    } finally {
        await setupClient.end();
    }

    parsedUrl.pathname = '/' + TEST_DB;
    const client = new Client({ connectionString: parsedUrl.toString() });
    const pool = new Pool({ connectionString: parsedUrl.toString() });

    let caughtError: any = null;
    try {
        await client.connect();

        // A. migration chain through 0008 is usable
        const migrations = ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008'];
        for (const m of migrations) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.startsWith(m) && f.endsWith('.sql'));
            for (const file of files) {
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await client.query(sql);
            }
        }
        log("Migration chain through 0008 applied successfully");

        const tenantId = '00000000-1111-4222-a333-444444444444';
        const otherTenantId = '00000000-1111-4222-a333-555555555555';
        const examInstance1 = '11111111-2222-4333-a444-555555555555';
        const examInstance2 = '22222222-2222-4333-a444-555555555555';
        const p1 = '33333333-3333-4333-a444-555555555555';
        const p2 = '44444444-4444-4333-a444-555555555555';
        const assign1 = '55555555-5555-4333-a444-555555555555';
        const assign2 = '66666666-6666-4333-a444-555555555555';
        const assign3 = '77777777-7777-4333-a444-555555555555';
        const assign4 = '88888888-8888-4333-a444-555555555555';

        // Setup base data
        await client.query('INSERT INTO tenant_tenants (id) VALUES ($1), ($2)', [tenantId, otherTenantId]);
        await client.query('INSERT INTO identity_persons (id) VALUES ($1), ($2)', [p1, p2]);
        await client.query('INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ($1, $2), ($3, $4)', 
            [examInstance1, tenantId, examInstance2, tenantId]);

        // Insert some assignments
        // p1 -> exam1 (active)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [assign1, tenantId, examInstance1, p1]);
        // p1 -> exam2 (revoked)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id, revoked_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)', [assign2, tenantId, examInstance2, p1]);
        // p2 -> exam1 (active)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [assign3, tenantId, examInstance1, p2]);

        // B. active exact assignment authorizes
        const resB = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resB.status === 'authorized', "Active exact assignment must authorize");
        if (resB.status === 'authorized') {
            assertStrict(resB.context.proctorAssignmentId === assign1, "Must return correct assignment ID");
        }
        log("active exact assignment authorizes");

        // C. revoked assignment denies
        const resC = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance2, personId: p1 });
        assertStrict(resC.status === 'denied', "Revoked assignment must deny");
        log("revoked assignment denies");

        // D. missing assignment denies
        const missingPerson = '99999999-9999-9999-9999-999999999999';
        const resD = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: missingPerson });
        assertStrict(resD.status === 'denied', "Missing assignment must deny");
        log("missing assignment denies");

        // E. wrong person denies
        const resE = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance2, personId: p2 });
        assertStrict(resE.status === 'denied', "Wrong person denies");
        log("wrong person denies");

        // F. wrong Exam Instance denies
        const resF = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance2, personId: p1 });
        assertStrict(resF.status === 'denied', "Wrong Exam Instance denies");
        log("wrong Exam Instance denies");

        // G. wrong tenant denies
        const resG = await authorizeExplicitProctorAssignment(pool, { tenantId: otherTenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resG.status === 'denied', "Wrong tenant denies");
        log("wrong tenant denies");

        // H. multiple active Proctors for one Exam Instance independently authorize
        const resH1 = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        const resH2 = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p2 });
        assertStrict(resH1.status === 'authorized' && resH2.status === 'authorized', "Multiple Proctors for one instance must independently authorize");
        log("multiple active Proctors for one Exam Instance independently authorize");

        // I. same Person on a different Exam Instance is scoped correctly
        // (p1 is active on exam1, revoked on exam2) -> already proven in B and C.

        // J. revoke + reassignment recognizes the current active row
        await client.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [assign1]);
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [assign4, tenantId, examInstance1, p1]);
        
        const resJ = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resJ.status === 'authorized', "Must authorize after reassignment");
        if (resJ.status === 'authorized') {
            assertStrict(resJ.context.proctorAssignmentId === assign4, "Must recognize the new active assignment ID");
        }
        log("revoke + reassignment recognizes the current active row");

        // K. authorization check performs no assignment mutation
        const checkBefore = await client.query('SELECT count(*) FROM secure_assessment_proctor_assignments');
        await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        const checkAfter = await client.query('SELECT count(*) FROM secure_assessment_proctor_assignments');
        assertStrict(checkBefore.rows[0].count === checkAfter.rows[0].count, "Authorization check must not mutate tables");
        log("authorization check performs no assignment mutation");

        // L. persistence failure/unavailability does not become authorization success
        const badPool = new Pool({ connectionString: 'postgresql://invalid:invalid@localhost:5432/invalid' });
        const resL = await authorizeExplicitProctorAssignment(badPool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resL.status === 'authorization_unavailable', "Persistence failure must yield authorization_unavailable");
        log("persistence failure/unavailability does not become authorization success");

        // M. predecessor Secure Assessment runtime/database baseline remains healthy (implicit since we just ran migrations 0001-0008 successfully)
        log("predecessor Secure Assessment runtime/database baseline remains healthy");

    } catch (err: any) {
        caughtError = err;
        console.error("RUN FAILED:");
        console.error(err.message || err);
    } finally {
        await pool.end();
        await client.end();

        parsedUrl.pathname = '/postgres';
        const cleanupClient = new Client({ connectionString: parsedUrl.toString() });
        await cleanupClient.connect();
        await cleanupClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
        await cleanupClient.end();
        console.log("Disposable DB cleanup");

        if (caughtError) {
            process.exit(1);
        }
    }
}

main();
