import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceParticipantPresenceReadiness } from '../src/exam-instance-participant-presence-readiness-preflight.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'database', 'migrations');

const pgPassword = process.env.PGPASSWORD;

function clientConfig(connectionString: string) {
  return pgPassword
    ? { connectionString, password: pgPassword }
    : { connectionString };
}

async function run() {
  let dbName = '';
  let rootClient: Client | null = null;
  let testClient: Client | null = null;

  try {
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu062_${runId}`;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is required');

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    rootClient = new Client(clientConfig(adminUrl.toString()));
    await rootClient.connect();
    await rootClient.query(`CREATE DATABASE ${dbName}`);

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${dbName}`;

    testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();

    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (let i = 1; i <= 30; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = sqlFiles.filter(f => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 30) {
      throw new Error(`Expected exactly 30 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // Fixtures
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const otherTenantId = '00000000-0000-0000-0000-000000000002';
    
    await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES ($1)`, [tenantId]);
    await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES ($1)`, [otherTenantId]);

    const examInstanceId = '11111111-1111-1111-1111-111111111111';
    const otherExamInstanceId = '22222222-2222-2222-2222-222222222222';
    const draftExamInstanceId = '33333333-3333-3333-3333-333333333333';
    const assessmentTypeId = '99999999-9999-9999-9999-999999999999';
    const otherAssessmentTypeId = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';

    await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (id, tenant_id, display_label) VALUES ($1, $2, 'EXAM')`, [assessmentTypeId, tenantId]);
    await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (id, tenant_id, display_label) VALUES ($1, $2, 'OTHER EXAM')`, [otherAssessmentTypeId, otherTenantId]);

    await testClient.query(`INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, assessment_type_id, lifecycle_state) VALUES ($1, $2, $3, 'SCHEDULED')`, [examInstanceId, tenantId, assessmentTypeId]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, assessment_type_id, lifecycle_state) VALUES ($1, $2, $3, 'SCHEDULED')`, [otherExamInstanceId, otherTenantId, otherAssessmentTypeId]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, assessment_type_id, lifecycle_state) VALUES ($1, $2, $3, 'DRAFT')`, [draftExamInstanceId, tenantId, assessmentTypeId]);

    const genericGranted = async () => 'granted' as const;

    // Proof 1: SCHEDULED Exam Instance with zero participants
    const res1 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, examInstanceId, genericGranted);
    if (res1.type !== 'not_ready' || (res1 as any).blocker !== 'participant_empty') {
      throw new Error(`Expected not_ready participant_empty, got: ${JSON.stringify(res1)}`);
    }

    // Setup person for participant
    const personId1 = '44444444-4444-4444-4444-444444444441';
    await testClient.query(`INSERT INTO public.identity_persons (id) VALUES ($1)`, [personId1]);
    
    // Proof 2: Insert/create one canonical same-tenant Exam Participant
    const participantId1 = '55555555-5555-5555-5555-555555555551';
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) 
      VALUES ($1, $2, $3, $4)
    `, [participantId1, tenantId, examInstanceId, personId1]);

    const res2 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, examInstanceId, genericGranted);
    if (res2.type !== 'participant_presence_ready' || res2.participantCount !== 1) {
      throw new Error(`Expected participant_presence_ready with count 1, got: ${JSON.stringify(res2)}`);
    }

    // Proof 3: Add a second different canonical participant to same Exam Instance
    const personId2 = '44444444-4444-4444-4444-444444444442';
    await testClient.query(`INSERT INTO public.identity_persons (id) VALUES ($1)`, [personId2]);
    const participantId2 = '55555555-5555-5555-5555-555555555552';
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) 
      VALUES ($1, $2, $3, $4)
    `, [participantId2, tenantId, examInstanceId, personId2]);

    const res3 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, examInstanceId, genericGranted);
    if (res3.type !== 'participant_presence_ready' || res3.participantCount !== 2) {
      throw new Error(`Expected participant_presence_ready with count 2, got: ${JSON.stringify(res3)}`);
    }

    // Proof 4: non-SCHEDULED Exam Instance -> invalid_state
    const res4 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, draftExamInstanceId, genericGranted);
    if (res4.type !== 'invalid_state') {
      throw new Error(`Expected invalid_state, got: ${JSON.stringify(res4)}`);
    }

    // Proof 5: wrong tenant / inaccessible Exam Instance
    const res5 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, otherExamInstanceId, genericGranted);
    if (res5.type !== 'denied') {
      throw new Error(`Expected denied, got: ${JSON.stringify(res5)}`);
    }

    // Setup another instance + participant to check cross-pollination
    const personId3 = '44444444-4444-4444-4444-444444444443';
    await testClient.query(`INSERT INTO public.identity_persons (id) VALUES ($1)`, [personId3]);
    const examInstanceIdOtherSameTenant = '66666666-6666-6666-6666-666666666666';
    await testClient.query(`INSERT INTO public.secure_assessment_exam_instances (id, tenant_id, assessment_type_id, lifecycle_state) VALUES ($1, $2, $3, 'SCHEDULED')`, [examInstanceIdOtherSameTenant, tenantId, assessmentTypeId]);
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) 
      VALUES ($1, $2, $3, $4)
    `, ['55555555-5555-5555-5555-555555555553', tenantId, examInstanceIdOtherSameTenant, personId3]);

    const personIdOther = '77777777-7777-7777-7777-777777777777';
    await testClient.query(`INSERT INTO public.identity_persons (id) VALUES ($1)`, [personIdOther]);
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) 
      VALUES ($1, $2, $3, $4)
    `, ['55555555-5555-5555-5555-555555555554', otherTenantId, otherExamInstanceId, personIdOther]);

    // Re-check count on primary instance (still 2)
    const res6 = await checkExamInstanceParticipantPresenceReadiness(testClient as any, tenantId, examInstanceId, genericGranted);
    if (res6.type !== 'participant_presence_ready' || res6.participantCount !== 2) {
      throw new Error(`Expected count 2, confirming no cross-instance or cross-tenant leaks. Got: ${JSON.stringify(res6)}`);
    }

    // Proof 11: preserve BU-051 exact uniqueness constraint uq_sa_exam_participants_tenant_instance_person
    let caughtDuplicateError = false;
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) 
        VALUES ($1, $2, $3, $4)
      `, ['55555555-5555-5555-5555-555555555559', tenantId, examInstanceId, personId1]); // personId1 again
    } catch (err: any) {
      if (err.message.includes('uq_sa_exam_participants_tenant_instance_person')) {
        caughtDuplicateError = true;
      }
    }
    if (!caughtDuplicateError) {
      throw new Error(`Expected uniqueness constraint uq_sa_exam_participants_tenant_instance_person to trigger on duplicate participant insertion.`);
    }

    console.log('REAL POSTGRESQL VERIFICATION: PASS');

  } catch (err) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', err);
    process.exitCode = 1;
  } finally {
    if (testClient) await testClient.end();
    if (rootClient) {
      if (dbName) {
        await rootClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
      }
      await rootClient.end();
    }
  }
}

run();
