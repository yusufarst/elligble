const { Client } = require('../../runtime/secure-assessment/node_modules/pg');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTest() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("FAIL: DATABASE_URL not set");
        process.exit(1);
    }

    console.log("Setting up test data...");
    const setupClient = new Client({ connectionString: dbUrl });
    await setupClient.connect();
    
    // Create base data
    const tenantId = '10000000-0000-0000-0000-000000000000';
    const yearIdA = 'c0000000-0000-0000-0000-000000000001';
    const yearIdB = 'c0000000-0000-0000-0000-000000000002';
    
    await setupClient.query(`
        INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) 
        VALUES ($1, $2, 'Year A', '2025-01-01', '2025-12-31') ON CONFLICT DO NOTHING;
    `, [yearIdA, tenantId]);

    await setupClient.query(`
        INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) 
        VALUES ($1, $2, 'Year B', '2026-01-01', '2026-12-31') ON CONFLICT DO NOTHING;
    `, [yearIdB, tenantId]);
    
    await setupClient.end();

    console.log("Running RACE A...");
    await runRaceA(dbUrl, tenantId, yearIdA);
    
    console.log("Running RACE B...");
    await runRaceB(dbUrl, tenantId, yearIdB);
    
    console.log("Verifying final invariant...");
    const verifyClient = new Client({ connectionString: dbUrl });
    await verifyClient.connect();
    const result = await verifyClient.query(`
        SELECT count(*) as cnt 
        FROM academic_core_academic_periods p
        JOIN academic_core_academic_years y ON p.academic_year_id = y.id AND p.tenant_id = y.tenant_id
        WHERE p.start_date < y.start_date OR p.end_date > y.end_date
    `);
    const count = parseInt(result.rows[0].cnt, 10);
    await verifyClient.end();

    if (count > 0) {
        console.error("FAIL: " + count + " Period rows exist outside their parent Academic Year");
        process.exit(1);
    }

    console.log("FINAL OUT-OF-RANGE PERIOD COUNT: " + count);
    console.log("RACE A: PASS");
    console.log("RACE B: PASS");
    console.log("concurrency verifier: PASS");
}

async function runRaceA(dbUrl, tenantId, yearId) {
    const clientA = new Client({ connectionString: dbUrl });
    const clientB = new Client({ connectionString: dbUrl });
    await clientA.connect();
    await clientB.connect();

    try {
        await clientA.query('BEGIN');
        await clientB.query('BEGIN');
        await clientA.query("SET lock_timeout = '10s'");
        await clientB.query("SET lock_timeout = '10s'");

        // A begins contraction to end at 2025-06-30
        await clientA.query(`
            UPDATE academic_core_academic_years 
            SET end_date = '2025-06-30' 
            WHERE id = $1 AND tenant_id = $2
        `, [yearId, tenantId]);

        // B attempts to INSERT period that extends to 2025-08-01 (valid originally, invalid after A)
        let bFinished = false;
        let bError = null;
        
        const pB = clientB.query(`
            INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, start_date, end_date)
            VALUES ($1, $2, 'Period Race A', '2025-07-01', '2025-08-01')
        `, [tenantId, yearId]).then(() => {
            bFinished = true;
        }).catch(err => {
            bError = err;
        });

        // Bounded observation interval to verify B is blocked/pending
        await sleep(300);

        if (bFinished || bError !== null) {
            console.error("FAIL: Race A: Transaction 2 did not remain pending while Transaction 1 held lock. completed=" + bFinished + ", error=" + (bError ? bError.message : "none"));
            process.exit(1);
        }
        console.log("RACE A BLOCKED BEFORE RELEASE: PASS");

        // A commits
        await clientA.query('COMMIT');
        
        // Wait for B to finish
        await pB;
        if (bFinished) {
            await clientB.query('COMMIT').catch(() => {});
            console.error("FAIL: Race A allowed B to insert invalid child");
            process.exit(1);
        } else {
            await clientB.query('ROLLBACK').catch(() => {});
        }

        if (!bError) {
            console.error("FAIL: Race A: Transaction 2 did not produce an error");
            process.exit(1);
        }

        const msg = bError.message || '';
        if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('deadlock')) {
            console.error("FAIL: Race A: Transaction 2 failed with timeout/deadlock instead of domain containment error: " + msg);
            process.exit(1);
        }

        if (!msg.includes('cannot succeed parent Academic Year') && !msg.includes('cannot precede parent Academic Year')) {
            console.error("FAIL: Race A gave wrong error for B: " + msg);
            process.exit(1);
        }

        console.log("RACE A DOMAIN REJECTION AFTER RELEASE: PASS");

    } finally {
        await clientA.end();
        await clientB.end();
    }
}

async function runRaceB(dbUrl, tenantId, yearId) {
    const clientA = new Client({ connectionString: dbUrl });
    const clientB = new Client({ connectionString: dbUrl });
    await clientA.connect();
    await clientB.connect();

    try {
        await clientA.query('BEGIN');
        await clientB.query('BEGIN');
        await clientA.query("SET lock_timeout = '10s'");
        await clientB.query("SET lock_timeout = '10s'");

        // A begins valid child Period INSERT
        await clientA.query(`
            INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, start_date, end_date)
            VALUES ($1, $2, 'Period Race B', '2026-07-01', '2026-08-01')
        `, [tenantId, yearId]);

        // B concurrently attempts to contract parent Year so it excludes Period (end_date = 2026-06-30)
        let bFinished = false;
        let bError = null;

        const pB = clientB.query(`
            UPDATE academic_core_academic_years 
            SET end_date = '2026-06-30' 
            WHERE id = $1 AND tenant_id = $2
        `, [yearId, tenantId]).then(() => {
            bFinished = true;
        }).catch(err => {
            bError = err;
        });

        // Bounded observation interval to verify B is blocked/pending
        await sleep(300);

        if (bFinished || bError !== null) {
            console.error("FAIL: Race B: Transaction 2 did not remain pending while Transaction 1 held lock. completed=" + bFinished + ", error=" + (bError ? bError.message : "none"));
            process.exit(1);
        }
        console.log("RACE B BLOCKED BEFORE RELEASE: PASS");

        // A commits
        await clientA.query('COMMIT');

        // Wait for B to finish
        await pB;
        if (bFinished) {
            await clientB.query('COMMIT').catch(() => {});
            console.error("FAIL: Race B allowed B to update parent invalidly");
            process.exit(1);
        } else {
            await clientB.query('ROLLBACK').catch(() => {});
        }

        if (!bError) {
            console.error("FAIL: Race B: Transaction 2 did not produce an error");
            process.exit(1);
        }

        const msg = bError.message || '';
        if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('deadlock')) {
            console.error("FAIL: Race B: Transaction 2 failed with timeout/deadlock instead of domain containment error: " + msg);
            process.exit(1);
        }

        if (!msg.includes('contain all child Academic Periods')) {
            console.error("FAIL: Race B gave wrong error for B: " + msg);
            process.exit(1);
        }

        console.log("RACE B DOMAIN REJECTION AFTER RELEASE: PASS");

    } finally {
        await clientA.end();
        await clientB.end();
    }
}

runTest().catch(err => {
    console.error("FAIL: Unhandled exception", err);
    process.exit(1);
});
