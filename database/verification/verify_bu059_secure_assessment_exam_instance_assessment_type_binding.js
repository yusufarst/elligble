let pg;
try {
    pg = require('../../runtime/secure-assessment/node_modules/pg');
} catch (e) {
    pg = require('pg');
}
const { Client } = pg;
const fs = require('fs');
const path = require('path');

function assertStrict(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

function log(message) {
    console.log(`- PASS: ${message}`);
}

async function runTest() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("FAIL: DATABASE_URL not set");
        process.exitCode = 1;
        return;
    }

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => /^\d{4}_.*\.sql$/.test(f))
        .sort();

    console.log("\n--- VERIFYING CANONICAL MIGRATIONS 0001-0030 ---");
    for (let i = 1; i <= 30; i++) {
        const prefix = String(i).padStart(4, '0') + '_';
        const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
        assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
    }
    log("1. Exactly one canonical migration exists for each prefix 0001-0030");

    const migration0030Files = allMigrationFiles.filter(f => f.startsWith('0030_'));
    const migration0030Sql = fs.readFileSync(path.join(migrationsDir, migration0030Files[0]), 'utf8');
    const exactMigrationId = '0030_bu059_secure_assessment_exam_instance_assessment_type_binding';

    const disposableDbName = `elligble_bu059_${runId}`;
    const openClients = [];
    let caughtError = null;
    let cleanupFailed = false;

    try {
        console.log(`\n--- CREATING DISPOSABLE DATABASE: ${disposableDbName} ---`);
        const setupClient = new Client({ connectionString: adminUrl.toString() });
        await setupClient.connect();
        await setupClient.query(`CREATE DATABASE "${disposableDbName}"`);
        await setupClient.end();
        log(`Disposable database created: ${disposableDbName}`);

        const targetUrl = new URL(dbUrl);
        targetUrl.pathname = `/${disposableDbName}`;
        const client = new Client({ connectionString: targetUrl.toString() });
        await client.connect();
        openClients.push(client);

        console.log("\n--- APPLYING CANONICAL MIGRATIONS 0001-0029 ---");
        for (let i = 1; i <= 29; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await client.query(sql);
        }
        log("2. Canonical migrations 0001-0029 apply before BU-059");

        // Set up tenants and dependent records
        const t1 = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const t2 = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

        const p1 = (await client.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await client.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const teacher1 = (await client.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [t1, m1])).rows[0].id;
        const year1 = (await client.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await client.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const subject1 = (await client.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Math') RETURNING id`, [t1])).rows[0].id;
        const grade1 = (await client.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'G1') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await client.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '1A') RETURNING id`, [t1, year1, grade1])).rows[0].id;
        const offering1 = (await client.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, subject1, period1, grade1])).rows[0].id;
        const ta1 = (await client.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, teacher1, offering1, group1])).rows[0].id;
        await client.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE', 'BU059') RETURNING id`, [t1, m1, year1, group1, period1]);

        // Create pre-existing Exam Instance
        const examIdPre = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW')
            RETURNING id
        `, [t1, ta1])).rows[0].id;
        
        // Create an assessment type for T1 and T2
        const atT1 = (await client.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'Type T1') RETURNING id`, [t1])).rows[0].id;
        const atT2 = (await client.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'Type T2') RETURNING id`, [t2])).rows[0].id;

        // Apply 0030
        console.log("\n--- CANONICAL APPLY OF MIGRATION 0030 ---");
        await client.query(migration0030Sql);
        log("3. Migration 0030 applies successfully");

        const histCountRes = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(histCountRes.rows[0].c, 10) === 30, "Migration history count reaches exactly 30");

        // Verify column
        const colRes = await client.query(`
            SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = 'secure_assessment_exam_instances' AND c.column_name = 'assessment_type_id'
        `);
        assertStrict(colRes.rows.length === 1, "assessment_type_id column exists");
        assertStrict(colRes.rows[0].data_type === 'uuid', "assessment_type_id is uuid");
        assertStrict(colRes.rows[0].is_nullable === 'YES', "assessment_type_id is NULLable");
        assertStrict(colRes.rows[0].column_default === null, "assessment_type_id has NO DEFAULT");
        log("4. assessment_type_id column is UUID NULL NO DEFAULT");

        // Verify pre-existing data has NULL
        const preDataRes = await client.query(`SELECT assessment_type_id FROM public.secure_assessment_exam_instances WHERE id = $1`, [examIdPre]);
        assertStrict(preDataRes.rows[0].assessment_type_id === null, "Pre-existing exam instance assessment_type_id is NULL");
        log("5. Pre-existing records default to NULL (backward compatible)");

        // Verify FK constraint
        const fkRes = await client.query(`
            SELECT pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_instances' AND c.conname = 'fk_sa_exam_instances_assessment_type'
        `);
        assertStrict(fkRes.rows.length === 1, "FK constraint exists");
        assertStrict(fkRes.rows[0].def === 'FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES secure_assessment_assessment_types(id, tenant_id) ON DELETE RESTRICT', "FK definition is correct");
        log("6. FK constraint fk_sa_exam_instances_assessment_type exists and enforces referential integrity on (id, tenant_id)");

        // Verify index
        const idxRes = await client.query(`
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'secure_assessment_exam_instances' AND indexname = 'idx_sa_exam_instances_assessment_type'
        `);
        assertStrict(idxRes.rows.length === 1, "Index exists");
        log("7. Index idx_sa_exam_instances_assessment_type exists");

        // Testing data integrity
        console.log("\n--- TESTING BINDING NEGATIVE SCENARIOS ---");
        
        // 1. Invalid assessment_type_id
        let threwInvalidId = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', gen_random_uuid())
            `, [t1, ta1]);
        } catch (e) {
            threwInvalidId = true;
        }
        assertStrict(threwInvalidId, "Invalid assessment_type_id must be rejected");
        log("8. Invalid assessment_type_id violates FK and is rejected");

        // 2. Cross-tenant assessment_type_id
        let threwCrossTenant = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3)
            `, [t1, ta1, atT2]);
        } catch (e) {
            threwCrossTenant = true;
        }
        assertStrict(threwCrossTenant, "Cross-tenant assessment_type_id must be rejected");
        log("9. Cross-tenant assessment_type_id violates composite FK and is rejected");

        // 3. Valid assessment_type_id
        const validIns = await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3)
            RETURNING id, assessment_type_id
        `, [t1, ta1, atT1]);
        assertStrict(validIns.rows.length === 1, "Valid assessment_type_id must be accepted");
        log("10. Valid assessment_type_id successfully bound to exam instance");

        // Idempotency
        await client.query(migration0030Sql);
        const repeatCount = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(repeatCount.rows[0].c, 10) === 30, "Repeat invocation does not duplicate migration history");
        log("11. Exact repeat invocation is safe and idempotent");

    } catch (err) {
        caughtError = err;
        console.error("FAIL: Verification failed with error:", err);
    } finally {
        for (const c of openClients) {
            try { await c.end(); } catch (e) { console.error("Error closing client:", e); }
        }
        console.log("\n--- CLEANING UP DISPOSABLE DATABASE ---");
        let teardownClient = null;
        try {
            teardownClient = new Client({ connectionString: adminUrl.toString() });
            await teardownClient.connect();
            await teardownClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [disposableDbName]);
            await teardownClient.query(`DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`);
            const remRes = await teardownClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu059_%'`);
            if (remRes.rows.length > 0) {
                console.error("FAIL: Leaked disposable databases remaining");
                cleanupFailed = true;
            } else {
                log("12. Disposable database cleanup PASS");
            }
        } catch (e) {
            console.error("FAIL during teardown:", e);
            cleanupFailed = true;
        } finally {
            if (teardownClient) {
                try { await teardownClient.end(); } catch (e) {}
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            console.log("\n==================================================");
            console.log("BU-059 SECURE ASSESSMENT EXAM INSTANCE ASSESSMENT TYPE BINDING VERIFICATION PASS");
            console.log("==================================================");
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
