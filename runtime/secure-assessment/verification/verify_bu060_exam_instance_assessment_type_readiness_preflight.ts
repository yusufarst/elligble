import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { checkExamInstanceAssessmentTypeReadiness } from '../src/exam-instance-assessment-type-readiness-preflight.ts';

async function runVerification() {
  const runId = Math.floor(Math.random() * 1000000);
  const dbName = `elligble_bu060_${runId}`;
  
  const rootClient = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: 'postgres'
  });

  await rootClient.connect();
  
  try {
    await rootClient.query(`CREATE DATABASE ${dbName}`);
  } catch (error) {
    console.error('Failed to create disposable database:', error);
    await rootClient.end();
    process.exit(1);
  }
  
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: dbName
  });

  await client.connect();

  try {
    // Apply migrations here externally before running this script in a real CI setup.
    // For this verifier, we setup minimal required schema to prove the runtime logic.
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE public.identity_tenants (id UUID PRIMARY KEY, name TEXT, status TEXT);
      CREATE TABLE public.identity_organizations (id UUID PRIMARY KEY, tenant_id UUID, name TEXT);
      CREATE TABLE public.secure_assessment_assessment_types (id UUID PRIMARY KEY, tenant_id UUID, display_label TEXT);
      CREATE TABLE public.secure_assessment_exam_instances (
        id UUID PRIMARY KEY, 
        tenant_id UUID, 
        lifecycle_state TEXT, 
        assessment_type_id UUID
      );
    `);

    // Tenant A
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const orgId = randomUUID();
    const atId = randomUUID();
    
    // Setup Tenant A data
    await client.query(
      `INSERT INTO public.identity_tenants (id, name, status) VALUES ($1, 'Tenant A', 'ACTIVE')`,
      [tenantA]
    );
    await client.query(
      `INSERT INTO public.identity_tenants (id, name, status) VALUES ($1, 'Tenant B', 'ACTIVE')`,
      [tenantB]
    );
    await client.query(
      `INSERT INTO public.identity_organizations (id, tenant_id, name) VALUES ($1, $2, 'Org A')`,
      [orgId, tenantA]
    );

    // Assessment Type
    await client.query(`
      INSERT INTO public.secure_assessment_assessment_types (id, tenant_id, display_label)
      VALUES ($1, $2, 'Test Assessment Type');
    `, [atId, tenantA]);

    // Exam Instances
    const eiReady = randomUUID();
    const eiNull = randomUUID();
    const eiDraft = randomUUID();

    await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, lifecycle_state, assessment_type_id)
      VALUES ($1, $2, 'SCHEDULED', $3);
    `, [eiReady, tenantA, atId]);

    await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, lifecycle_state, assessment_type_id)
      VALUES ($1, $2, 'SCHEDULED', NULL);
    `, [eiNull, tenantA]);

    await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, lifecycle_state, assessment_type_id)
      VALUES ($1, $2, 'DRAFT', $3);
    `, [eiDraft, tenantA, atId]);

    // Track state to prove no mutation
    const beforeEi = await client.query(`SELECT xmin, * FROM public.secure_assessment_exam_instances ORDER BY id`);
    const beforeAt = await client.query(`SELECT xmin, * FROM public.secure_assessment_assessment_types ORDER BY id`);

    // 2. tenant A Assessment Type + SCHEDULED Exam Instance bound to that type -> assessment_type_ready.
    const resReady = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiReady, 'granted');
    if (resReady.type !== 'assessment_type_ready') throw new Error('Expected assessment_type_ready');
    
    // 3. returned Assessment Type identity and display label are exact.
    if (resReady.assessmentTypeId !== atId || resReady.assessmentTypeDisplayLabel !== 'Test Assessment Type') {
      throw new Error('Exact identity mismatch');
    }

    // 4. SCHEDULED Exam Instance with NULL assessment_type_id -> not_ready / assessment_type_missing.
    const resNull = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiNull, 'granted');
    if (resNull.type !== 'not_ready' || resNull.blocker !== 'assessment_type_missing') {
      throw new Error('Expected not_ready / assessment_type_missing');
    }

    // 5. non-SCHEDULED Exam Instance -> invalid_state.
    const resDraft = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiDraft, 'granted');
    if (resDraft.type !== 'invalid_state') {
      throw new Error('Expected invalid_state');
    }

    // 6. wrong tenant cannot observe or classify another tenant's Exam Instance as ready.
    const resWrong = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantB, eiReady, 'granted');
    if (resWrong.type !== 'denied') {
      throw new Error('Expected denied for wrong tenant');
    }

    // Check no mutation
    const afterEi = await client.query(`SELECT xmin, * FROM public.secure_assessment_exam_instances ORDER BY id`);
    const afterAt = await client.query(`SELECT xmin, * FROM public.secure_assessment_assessment_types ORDER BY id`);

    // 7. no Exam Instance row mutation.
    if (JSON.stringify(beforeEi.rows) !== JSON.stringify(afterEi.rows)) throw new Error('Mutation detected on exam_instances');
    
    // 8. no Assessment Type row mutation.
    if (JSON.stringify(beforeAt.rows) !== JSON.stringify(afterAt.rows)) throw new Error('Mutation detected on assessment_types');

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    // 12. cleanup occurs on PASS and FAIL.
    await client.end();
    try {
      await rootClient.query(`DROP DATABASE ${dbName}`);
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      process.exitCode = 1;
    }
    await rootClient.end();
  }
}

runVerification().catch((e) => {
  console.error('FATAL ERROR', e);
  process.exitCode = 1;
});
