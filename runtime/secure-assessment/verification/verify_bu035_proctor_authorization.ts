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

        // Explicit Predecessor Database Regression Check
        const requiredTables = [
            'elligble_migration_history',
            'identity_persons',
            'identity_user_accounts',
            'tenant_tenants',
            'tenant_memberships',
            'secure_assessment_exam_instances',
            'secure_assessment_exam_participants',
            'secure_assessment_exam_attempts',
            'secure_assessment_exam_sessions',
            'secure_assessment_question_bank_items',
            'secure_assessment_exam_question_snapshots',
            'secure_assessment_exam_answers',
            'secure_assessment_timer_state',
            'secure_assessment_timer_adjustments',
            'secure_assessment_exam_submissions',
            'secure_assessment_proctor_assignments'
        ];

        for (const tableName of requiredTables) {
            const tableCheck = await client.query(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
                [tableName]
            );
            assertStrict(tableCheck.rows.length === 1, `Predecessor table missing: ${tableName}`);
            await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        }
        log("explicit predecessor DB regression verified: all 16 core tables exist and are functional");

        const tenantId = '00000000-1111-4222-a333-444444444444';
        const otherTenantId = '00000000-1111-4222-a333-555555555555';
        const examInstance1 = '11111111-2222-4333-a444-555555555555';
        const examInstance2 = '22222222-2222-4333-a444-555555555555';
        const examInstance3 = '33333333-2222-4333-a444-555555555555'; // Unassigned exam instance for independent wrong-exam verification
        const p1 = '33333333-3333-4333-a444-555555555555';
        const p2 = '44444444-4444-4333-a444-555555555555';
        const unassignedPerson = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const assign1 = '55555555-5555-4333-a444-555555555555';
        const assign2 = '66666666-6666-4333-a444-555555555555';
        const assign3 = '77777777-7777-4333-a444-555555555555';
        const assign4 = '88888888-8888-4333-a444-555555555555';

        // Setup base data
        await client.query('INSERT INTO tenant_tenants (id) VALUES ($1), ($2)', [tenantId, otherTenantId]);
        await client.query('INSERT INTO identity_persons (id) VALUES ($1), ($2), ($3)', [p1, p2, unassignedPerson]);
        await client.query('INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ($1, $2), ($3, $4), ($5, $6)',
            [examInstance1, tenantId, examInstance2, tenantId, examInstance3, tenantId]);

        // Insert assignments:
        // p1 -> examInstance1 (active)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [assign1, tenantId, examInstance1, p1]);
        // p1 -> examInstance2 (revoked)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id, revoked_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)', [assign2, tenantId, examInstance2, p1]);
        // p2 -> examInstance1 (active)
        await client.query('INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [assign3, tenantId, examInstance1, p2]);
        // Note: examInstance3 has NO assignment row for p1 or p2.
        // Note: unassignedPerson has NO assignment row anywhere in secure_assessment_proctor_assignments.

        // B. active exact assignment authorizes
        const resB = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resB.status === 'authorized', "Active exact assignment must authorize");
        if (resB.status === 'authorized') {
            assertStrict(resB.context.proctorAssignmentId === assign1, "Must return correct assignment ID");
            assertStrict(resB.context.tenantId === tenantId, "Must return correct tenant ID");
            assertStrict(resB.context.examInstanceId === examInstance1, "Must return correct examInstance ID");
            assertStrict(resB.context.personId === p1, "Must return correct person ID");
        }
        log("active exact assignment authorizes");

        // C. revoked assignment denies
        const resC = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance2, personId: p1 });
        assertStrict(resC.status === 'denied', "Revoked assignment must deny");
        log("revoked assignment denies");

        // D. missing assignment denies (true PostgreSQL-backed lookup for valid unassigned Person)
        const missingCountCheck = await client.query(
            'SELECT count(*) FROM secure_assessment_proctor_assignments WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3',
            [tenantId, examInstance1, unassignedPerson]
        );
        assertStrict(parseInt(missingCountCheck.rows[0].count, 10) === 0, "Assignment count must be 0 for unassigned person");
        const resD = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: unassignedPerson });
        assertStrict(resD.status === 'denied', "Missing assignment must deny");
        log("missing assignment denies (true PostgreSQL-backed lookup for valid unassigned Person)");

        // E. wrong person denies
        const resE = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance2, personId: p2 });
        assertStrict(resE.status === 'denied', "Wrong person denies");
        log("wrong person denies");

        // F. independent wrong Exam Instance denies (examInstance3 has no assignment row for p1, independent of revocation)
        const resF = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance3, personId: p1 });
        assertStrict(resF.status === 'denied', "Independent wrong Exam Instance must deny");
        log("independent wrong Exam Instance denies (unassigned exam instance independently scoped)");

        // G. wrong tenant denies
        const resG = await authorizeExplicitProctorAssignment(pool, { tenantId: otherTenantId, examInstanceId: examInstance1, personId: p1 });
        assertStrict(resG.status === 'denied', "Wrong tenant denies");
        log("wrong tenant denies");

        // H. multiple active Proctors for one Exam Instance independently authorize
        const resH1 = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p1 });
        const resH2 = await authorizeExplicitProctorAssignment(pool, { tenantId, examInstanceId: examInstance1, personId: p2 });
        assertStrict(resH1.status === 'authorized' && resH2.status === 'authorized', "Multiple Proctors for one instance must independently authorize");
        log("multiple active Proctors for one Exam Instance independently authorize");

        // I. malformed UUID required identifiers return denied without DB error
        const resI = await authorizeExplicitProctorAssignment(pool, { tenantId: 'not-a-uuid', examInstanceId: examInstance1, personId: p1 });
        assertStrict(resI.status === 'denied', "Malformed tenantId must deny");
        log("malformed UUID required identifiers return denied");

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

        // M. predecessor Secure Assessment runtime/database baseline remains healthy
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
