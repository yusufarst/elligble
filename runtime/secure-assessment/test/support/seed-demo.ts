import pg from 'pg';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from './fixtures.ts';

// Demo data for local development, rendered checks and browser E2E. Test support only:
// never imported by production code. Usage:
//   DATABASE_URL=postgres://.../elligble_dev node test/support/seed-demo.ts
// Accounts (password for all: kata-sandi-demo):
//   siswa.demo      student in SMA Negeri 1 Contoh, assigned to one SCHEDULED exam
//   guru.demo       teacher of that exam (teacher-managed mode): marks it ready and opens it
//   pengawas.demo   proctor assigned to that exam
//   guru.dua        member of both demo schools (tenant selection)

export const DEMO_PASSWORD = 'kata-sandi-demo';

export async function seedDemo(pool: pg.Pool) {
    const tenantA = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const tenantB = await createTenant(pool, 'SMA Negeri 2 Contoh');
    const student = await createPersonWithAccount(pool, 'siswa.demo', DEMO_PASSWORD);
    const teacher = await createPersonWithAccount(pool, 'guru.demo', DEMO_PASSWORD);
    const proctor = await createPersonWithAccount(pool, 'pengawas.demo', DEMO_PASSWORD);
    const multi = await createPersonWithAccount(pool, 'guru.dua', DEMO_PASSWORD);
    await addMembership(pool, tenantA, student.personId);
    const teacherMembership = await addMembership(pool, tenantA, teacher.personId);
    await addMembership(pool, tenantA, proctor.personId);
    await addMembership(pool, tenantA, multi.personId);
    await addMembership(pool, tenantB, multi.personId);

    const teaching = await createTeachingContext(pool, tenantA, teacherMembership, 'Matematika Wajib');
    const exam = await createExamInstance(pool, tenantA, teaching, { lifecycleState: 'SCHEDULED', durationSeconds: 45 * 60 });
    await addQuestionSnapshots(pool, tenantA, exam, 5);
    await addParticipant(pool, tenantA, exam, student.personId);
    await addProctorAssignment(pool, tenantA, exam, proctor.personId);
    return { tenantA, tenantB, exam, student, teacher, proctor, multi };
}

if (import.meta.main) {
    const url = process.env['DATABASE_URL'];
    if (!url) {
        process.stderr.write('DATABASE_URL is not set\n');
        process.exit(2);
    }
    const pool = new pg.Pool({ connectionString: url });
    seedDemo(pool)
        .then(result => process.stdout.write(JSON.stringify({ seeded: true, tenantA: result.tenantA, exam: result.exam }) + '\n'))
        .finally(() => pool.end());
}
