import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, open, withDatabase, state } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';
import { hashPassword } from '../../runtime/identity-access/src/crypto.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const BASE_TREE = 'aef3abfb4c233105026f11167c92da13d2664337';
const commit = git('rev-parse', 'HEAD');
const applicationTree = git('rev-parse', 'HEAD:frontend/web/src');
let rosterEvidenceHash:string|null=null;
const fixtureHash = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url))).digest('hex');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('Roster evidence SHA mismatch');

async function capture(page: Page, scenario: string) {
    await page.evaluate(async () => { await document.fonts.ready; });
    const viewport = page.viewportSize();
    const name = `workspace-admin-${scenario}-${viewport?.width}x${viewport?.height}-${test.info().project.name}`;
    const browser = page.context().browser();
    const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
        heading: document.querySelector('h1')?.textContent,
        selectedFiles:document.querySelector<HTMLInputElement>('#roster-file')?.files?.length??null,
        previewPresent:document.querySelector('#roster-preview-heading')!==null,
        focus:(()=>{const el=document.activeElement as HTMLElement|null,r=el?.getBoundingClientRect();return{id:el?.id,tag:el?.tagName,enabled:el instanceof HTMLInputElement?!el.disabled:null,inViewport:r? r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth:false};})(),
        targets:[...document.querySelectorAll<HTMLElement>('#school-roster button,#school-roster input,[role=dialog] button,[role=dialog] textarea')].map(el=>{
            const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')??el.textContent,width:r.width,height:r.height};
        }).filter(r=>r.width>0&&r.height>0),
    }));
    await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
        task: 'ADMIN-001', phase: applicationTree === BASE_TREE ? 'before' : 'after', commit,
        baseline: { ref: '1d3eff56ed4a796191a09503fd850454ab5f0d8d', sourceTree: BASE_TREE },
        applicationTree, fixture: { synthetic: true, sha256: fixtureHash },
        browser: { engine: browser?.browserType().name(), version: browser?.version(), project: test.info().project.name },
        viewport, scenario, rosterFixtureSha256:rosterEvidenceHash, screenshot: `${name}.png`, metrics, physicalDevice: false,
    }, null, 2));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.targets.filter(t=>t.width<43.99||t.height<43.99)).toEqual([]);
}

test('ADMIN-001 actual workspace baseline before Operator implementation', async ({ page }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Siswa', exact: true })).toHaveCount(0);
    const original = page.viewportSize();
    for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await capture(page, 'missing-operator-entry');
    }
    await page.setViewportSize({ width: 768, height: 360 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await capture(page, 'missing-operator-entry-text-200');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    if (original) await page.setViewportSize(original);
});

async function keyboardReach(page:Page,target:ReturnType<Page['getByRole']>){
    for(let step=0;step<100;step++){
        if(await target.evaluate(el=>el===document.activeElement))break;
        await page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
}

if(applicationTree!==BASE_TREE)test('ADMIN-001 Operator roster preview, keyboard confirmation, refusal and atomic import',async({page})=>{
    const academic=await withDatabase(async c=>{
        const r=await c.query(`SELECT g.id AS group_id,g.academic_year_id,p.id AS period_id FROM academic_core_academic_groups g
            JOIN academic_core_academic_periods p ON p.tenant_id=g.tenant_id AND p.academic_year_id=g.academic_year_id
            WHERE g.tenant_id=$1 AND g.display_label='X-E2E'`,[state.tenantId]);
        expect(r.rows).toHaveLength(1);
        const person=(await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id=a.id WHERE cr.username=$1',['guru.e2e'])).rows[0].person_id as string;
        await c.query('BEGIN');try{await setSchoolOperator(c,{tenantId:state.tenantId,personId:person,action:'ASSIGN',operator:'Synthetic CI operator',caseReference:'ADMIN-001',reason:'Synthetic roster verification'});await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
        return{...r.rows[0],person};
    });
    try{
        await login(page,'guru.e2e','papan-tulis-hijau');
        await page.getByRole('button',{name:'Data Siswa',exact:true}).click();
        await expect(page.getByRole('heading',{name:'Data Siswa',exact:true})).toBeVisible();
        for(const width of [360,390,430,768,1024,1280,1440]){await page.setViewportSize({width,height:800});await capture(page,'operator-empty');}
        await page.getByLabel('Referensi Tahun Ajaran').fill(academic.academic_year_id);
        await page.getByLabel('Referensi Periode Akademik').fill(academic.period_id);
        const csv='source_student_key,full_name,nis,nisn,date_of_birth,academic_group_id\nadmin-ci-source,Siswa Sintetis dengan nama panjang untuk memeriksa pembungkusan teks pada layar sempit,00091,9990000091,2010-01-02,'+academic.group_id;
        const upload=async(text:string)=>{rosterEvidenceHash=createHash('sha256').update(text).digest('hex');await page.getByLabel('Berkas Daftar Siswa CSV').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(text)});};
        await upload(csv.replace('2010-01-02','2010-02-30'));
        await page.getByRole('button',{name:'Periksa Berkas',exact:true}).click();await expect(page.getByText('Perlu diperbaiki',{exact:false})).toBeVisible();
        await expect(page.getByRole('button',{name:'Konfirmasi Impor'})).toBeDisabled();await capture(page,'operator-invalid');
        await upload(csv+'\n'+csv.split('\n')[1]);await page.getByRole('button',{name:'Periksa Berkas',exact:true}).click();
        await expect(page.getByText('Baris 2: Perlu ditinjau',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Konfirmasi Impor'})).toBeDisabled();await capture(page,'operator-review-required');
        await upload(csv);
        await page.getByRole('button',{name:'Periksa Berkas',exact:true}).click();
        const trigger=page.getByRole('button',{name:'Konfirmasi Impor'});await expect(trigger).toBeEnabled();
        await expect(page.locator('#school-roster')).not.toContainText('9990000091');await expect(page.locator('#school-roster')).not.toContainText('2010-01-02');
        const before=await withDatabase(c=>c.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records').then(r=>r.rows[0].n));
        const rosterState=()=>withDatabase(async c=>{const result:Record<string,unknown>={};for(const table of ['academic_core_student_roster_records','academic_core_student_roster_revisions','academic_core_roster_import_receipts'])result[table]=(await c.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;return result;});
        const cancellationState=await rosterState(),attempts:Array<{key:unknown;reason:unknown}>=[];
        page.on('request',req=>{if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/v1/identity/roster/confirm'){const body=req.postDataJSON() as Record<string,unknown>;attempts.push({key:body.requestKey,reason:body.reason});}});
        for(const width of [360,390,430,768,1024,1280,1440]){await page.setViewportSize({width,height:800});await capture(page,'operator-preview');}
        await page.setViewportSize({width:768,height:360});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await capture(page,'operator-preview-text-200');await page.evaluate(()=>{document.documentElement.style.fontSize='';});
        await keyboardReach(page,trigger);await page.keyboard.press('Enter');
        const dialog=page.getByRole('dialog',{name:'Simpan Daftar Siswa?'});await expect(dialog).toBeVisible();
        await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
        for(const direction of ['Tab','Shift+Tab'])for(let n=0;n<7;n++){await page.keyboard.press(direction);await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
        await expect(dialog.getByRole('textbox',{name:'Alasan tindakan'})).toHaveAccessibleName('Alasan tindakan');
        const file=page.getByLabel('Berkas Daftar Siswa CSV');
        const purged=async()=>{await expect(dialog).toBeHidden();await expect(trigger).toHaveCount(0);await expect(page.getByRole('heading',{name:'Hasil Pemeriksaan',exact:true})).toHaveCount(0);await expect(file).toHaveValue('');expect(await file.evaluate(el=>(el as HTMLInputElement).files?.length)).toBe(0);await expect(file).toBeVisible();await expect(file).toBeEnabled();await expect(file).toBeFocused();await expect(file).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:'Periksa Berkas',exact:true})).toBeDisabled();expect(attempts).toHaveLength(0);expect(await rosterState()).toEqual(cancellationState);};
        const reopen=async()=>{await upload(csv);await expect(trigger).toHaveCount(0);await page.getByRole('button',{name:'Periksa Berkas',exact:true}).click();await expect(trigger).toBeEnabled();await keyboardReach(page,trigger);await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Alasan tindakan'})).toHaveValue('');await expect(dialog.getByRole('button',{name:'Simpan Daftar',exact:true})).toBeDisabled();await expect(dialog.getByRole('alert')).toHaveCount(0);};
        await keyboardReach(page,dialog.getByRole('textbox',{name:'Alasan tindakan'}));await page.keyboard.type('Alasan sintetis yang dibatalkan');
        await keyboardReach(page,dialog.getByRole('button',{name:'Batal',exact:true}));await page.keyboard.press('Enter');await purged();rosterEvidenceHash=null;await capture(page,'operator-cancel-button');
        await reopen();await keyboardReach(page,dialog.getByRole('textbox',{name:'Alasan tindakan'}));await page.keyboard.type('Alasan sintetis untuk Escape');
        await page.keyboard.press('Escape');await purged();rosterEvidenceHash=null;await capture(page,'operator-cancel-escape');
        expect(await withDatabase(c=>c.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records').then(r=>r.rows[0].n))).toBe(before);
        await reopen();await keyboardReach(page,dialog.getByRole('textbox',{name:'Alasan tindakan'}));await page.keyboard.type('Pembaruan daftar sintetis yang disetujui');
        await capture(page,'operator-confirm');
        // A failed transport must leave actual DB state unchanged and focus an enabled retry.
        let releaseFailure!:()=>void,requestArrived!:()=>void;const released=new Promise<void>(r=>{releaseFailure=r;}),arrived=new Promise<void>(r=>{requestArrived=r;});
        await page.route('**/api/v1/identity/roster/confirm',async route=>{requestArrived();await released;await route.fulfill({status:503,contentType:'application/json',body:'{"error":"persistence_unavailable"}'});},{times:1});
        const send=dialog.getByRole('button',{name:'Simpan Daftar',exact:true});await keyboardReach(page,send);await page.keyboard.press('Enter');
        await arrived;try{await expect(dialog.getByRole('button',{name:'Batal',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();expect(attempts).toHaveLength(1);expect(await rosterState()).toEqual(cancellationState);}finally{releaseFailure();}
        await expect(dialog.getByRole('alert')).toBeVisible();const retry=dialog.getByRole('button',{name:'Kirim Ulang Tindakan'});await expect(retry).toBeFocused();await expect(retry).toBeEnabled();
        expect(await withDatabase(c=>c.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records').then(r=>r.rows[0].n))).toBe(before);await capture(page,'operator-request-failed');
        await page.keyboard.press('Enter');await expect(page.getByRole('status').filter({hasText:'Data tersimpan.'})).toBeVisible();await expect(page.getByLabel('Berkas Daftar Siswa CSV')).toBeFocused();
        expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);
        expect(await withDatabase(c=>c.query('SELECT count(*)::int AS n FROM academic_core_student_roster_records').then(r=>r.rows[0].n))).toBe(before+1);await capture(page,'operator-success');
    }finally{
        await withDatabase(async c=>{await c.query('BEGIN');try{await setSchoolOperator(c,{tenantId:state.tenantId,personId:academic.person,action:'REVOKE',operator:'Synthetic CI operator',caseReference:'ADMIN-001',reason:'End synthetic verification'});await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}});
    }
});

// AUTH-002 capture-only baseline (record §12.3 step 2): the same capture runs before and after
// the claim/review implementation. Before, it records the existing Login/Activation screens and
// the absent claim/verifier entries without asserting them; after, it enforces the UI gates.
const AUTH_BASE_TREE = 'b11e1f64f2321ca05e3aa6d24ccde1fb9c041996';
const authPhase = applicationTree === AUTH_BASE_TREE ? 'before' : 'after';
const AUTH_WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440];
// One capture routine serves each identity Task's own before/after evidence.
interface CaptureTask { task: string; baseTree: string; phase: 'before' | 'after'; prefix: string }
const AUTH002_CAPTURE: CaptureTask = { task: 'AUTH-002', baseTree: AUTH_BASE_TREE, phase: authPhase, prefix: 'workspace-auth-' };
// AUTH-003 capture-only baseline (record §13): the frontend tree at main 38259da.
const RECOVERY_BASE_TREE = '2a4f9f399167ac1947e4c2130eae354daf9ad9b3';
const RECOVERY_CAPTURE: CaptureTask = { task: 'AUTH-003', baseTree: RECOVERY_BASE_TREE, phase: applicationTree === RECOVERY_BASE_TREE ? 'before' : 'after', prefix: 'workspace-recovery-' };

async function captureAuth(page: Page, scenario: string, mask: Locator[] = [], ctx: CaptureTask = AUTH002_CAPTURE) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const viewport = page.viewportSize();
    const name = `${ctx.prefix}${scenario}-${viewport?.width}x${viewport?.height}-${test.info().project.name}`;
    const browser = page.context().browser();
    const metrics = await page.evaluate(() => {
        const box = (el: Element) => el.getBoundingClientRect();
        const active = document.activeElement as HTMLElement | null;
        return {
            scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
            heading: document.querySelector('h1')?.textContent ?? null,
            claimEntry: [...document.querySelectorAll('button,a')].filter(el => /pendaftaran akun/i.test(el.textContent ?? '')).length,
            verifierEntry: [...document.querySelectorAll('button,a')].filter(el => /verifikasi pendaftaran/i.test(el.textContent ?? '')).length,
            recoveryEntry: [...document.querySelectorAll('button,a')].filter(el => /pemulihan/i.test(el.textContent ?? '')).length,
            focus: { tag: active?.tagName ?? null, id: active?.id ?? null },
            // Text cut off inside a scrolling dialog does not widen the page: measure each value cell.
            clipped: [...document.querySelectorAll<HTMLElement>('[role=dialog] dd, [role=dialog] dt, [role=dialog] label')]
                .filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent ?? ''),
            targets: [...document.querySelectorAll<HTMLElement>('main button, main input, main a, main select, main textarea, [role=dialog] button, [role=dialog] input, [role=dialog] textarea')]
                // A checkbox or radio is operated through its whole label, which is the measured target.
                .map(el => (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) && el.closest('label')) ? el.closest('label')! : el)
                .map(el => ({ name: el.getAttribute('aria-label') ?? el.textContent ?? el.id, width: box(el).width, height: box(el).height }))
                .filter(t => t.width > 0 && t.height > 0),
        };
    });
    // Activation codes are live secrets of the disposable CI database: masked, never captured.
    await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true, animations: 'disabled', mask });
    writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
        task: ctx.task, masked: mask.length > 0, phase: ctx.phase, commit,
        baseline: { sourceTree: ctx.baseTree }, applicationTree, fixture: { synthetic: true, sha256: fixtureHash },
        browser: { engine: browser?.browserType().name(), version: browser?.version(), project: test.info().project.name },
        viewport, scenario, screenshot: `${name}.png`, metrics, physicalDevice: false,
    }, null, 2));
    if (ctx.phase === 'after') {
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.targets.filter(t => t.width < 43.99 || t.height < 43.99)).toEqual([]);
        expect(metrics.clipped).toEqual([]);
    }
}

async function captureAuthWidths(page: Page, scenario: string, mask: Locator[] = [], ctx: CaptureTask = AUTH002_CAPTURE) {
    const original = page.viewportSize();
    for (const width of AUTH_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await captureAuth(page, scenario, mask, ctx);
    }
    await page.setViewportSize({ width: 768, height: 360 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await captureAuth(page, `${scenario}-text-200`, mask, ctx);
    // A dialog scrolls inside the short viewport: also capture its end, so the whole dialog is evidenced.
    if (await page.locator('[role=dialog]').count()) {
        await page.locator('[role=dialog]').last().evaluate(el => { el.scrollTop = el.scrollHeight; });
        await captureAuth(page, `${scenario}-text-200-scrolled`, mask, ctx);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    if (original) await page.setViewportSize(original);
}

test('AUTH-002 actual entry baseline: login, activation and verifier workspace', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Masuk ke ELLIGBLE', exact: true })).toBeVisible();
    await captureAuthWidths(page, 'login-entry');
    await page.getByRole('button', { name: 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi' }).click();
    await expect(page.getByRole('heading', { name: 'Aktivasi Akun', exact: true })).toBeVisible();
    await captureAuthWidths(page, 'activation-entry');
    await page.getByRole('button', { name: 'Kembali ke halaman masuk' }).click();
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian', exact: true })).toBeVisible();
    await captureAuthWidths(page, 'staff-workspace');
});

async function tabTo(page: Page, target: Locator) {
    for (let step = 0; step < 60; step++) {
        if (await target.evaluate(el => el === document.activeElement)) return;
        await page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
}

if (authPhase === 'after') test('AUTH-002 synthetic claim, scoped approval, one-time handoff and Student activation', async ({ page }) => {
    const nisn = '9990000092', name = 'Siswa Klaim Sintetis', birth = '2010-04-05';
    const fixture = await withDatabase(async c => {
        const r = await c.query(`SELECT g.id AS group_id, g.academic_year_id, p.id AS period_id FROM academic_core_academic_groups g
            JOIN academic_core_academic_periods p ON p.tenant_id = g.tenant_id AND p.academic_year_id = g.academic_year_id
            WHERE g.tenant_id = $1 AND g.display_label = 'X-E2E'`, [state.tenantId]);
        expect(r.rows).toHaveLength(1);
        await c.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth,
            academic_year_id, academic_period_id, academic_group_id) VALUES($1,'auth-002-ci',$2,'auth-002-nis',$3,$4,$5,$6,$7)`,
            [state.tenantId, name, nisn, birth, r.rows[0].academic_year_id, r.rows[0].period_id, r.rows[0].group_id]);
        const person = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id=a.id WHERE cr.username=$1', ['guru.e2e'])).rows[0].person_id as string;
        await c.query('BEGIN');
        try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action: 'ASSIGN', operator: 'Synthetic CI operator', caseReference: 'AUTH-002', reason: 'Synthetic claim verification' }); await c.query('COMMIT'); }
        catch (e) { await c.query('ROLLBACK'); throw e; }
        return { person };
    });
    const trusted = () => withDatabase(async c => (await c.query(`SELECT (SELECT count(*) FROM identity_persons)::int AS persons, (SELECT count(*) FROM identity_user_accounts)::int AS accounts,
        (SELECT count(*) FROM identity_sessions)::int AS sessions, (SELECT count(*) FROM tenant_memberships)::int AS memberships`)).rows[0]);
    try {
        // Student: the school's claim link carries only its school code.
        await open(page, `/?sekolah=${state.tenantId}`);
        await page.getByRole('button', { name: 'Belum punya akun? Ajukan pendaftaran akun' }).click();
        await expect(page.getByRole('heading', { name: 'Ajukan Pendaftaran Akun', exact: true })).toBeVisible();
        await expect(page.locator('input[type=password]')).toHaveCount(0);
        await captureAuthWidths(page, 'claim-form');
        const before = await trusted();
        await page.getByLabel('Nama Lengkap').fill(name);
        await page.getByLabel('NISN').fill(nisn);
        await page.getByLabel('Tanggal Lahir').fill(birth);
        await page.getByRole('button', { name: 'Kirim Pengajuan' }).click();
        await expect(page.getByRole('status')).toContainText('Pengajuan sudah dikirim');
        await expect(page.getByRole('status')).toBeFocused();
        expect(await trusted()).toEqual(before);
        expect(page.url()).not.toContain(nisn);
        await captureAuthWidths(page, 'claim-received');
        await page.getByRole('button', { name: 'Kembali ke halaman masuk' }).click();

        // Verifier: scoped queue, explicit adjudication, in-person confirmation, keyboard dialog.
        await login(page, 'guru.e2e', 'papan-tulis-hijau');
        await page.getByRole('button', { name: 'Verifikasi Pendaftaran', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Verifikasi Pendaftaran', exact: true })).toBeVisible();
        await expect(page.locator('#claim-review')).toContainText(name);
        await captureAuthWidths(page, 'verifier-queue');
        const approve = page.getByRole('button', { name: `Setujui pengajuan ${name}` });
        await tabTo(page, approve);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Setujui Pengajuan?' });
        await expect(dialog).toBeVisible();
        for (const key of ['Tab', 'Shift+Tab']) for (let n = 0; n < 8; n++) {
            await page.keyboard.press(key);
            await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
        }
        await dialog.getByLabel('Siswa belum punya akun ELLIGBLE').check();
        await dialog.getByLabel('Saya sudah menanyakan langsung dan siswa tidak memiliki kartu atau ELLIGBLE ID lama.').check();
        await dialog.getByLabel('Saya sudah memverifikasi siswa ini secara langsung.').check();
        await dialog.getByRole('textbox', { name: 'Alasan tindakan' }).fill('Diverifikasi langsung dengan kartu pelajar sintetis');
        await captureAuthWidths(page, 'verifier-approve');
        await dialog.getByRole('button', { name: 'Setujui', exact: true }).click();
        const handoff = page.getByRole('dialog', { name: 'Serahkan Kode Aktivasi' });
        await expect(handoff).toBeVisible();
        const values = handoff.locator('dd');
        const elligbleId = (await values.nth(0).textContent())!.trim(), code = (await values.nth(1).textContent())!.trim();
        expect(elligbleId).toMatch(/^elg-/);
        await captureAuthWidths(page, 'verifier-handoff', [values.nth(1)]);
        await handoff.getByRole('button', { name: 'Selesai, Tutup Kode' }).click();
        await expect(page.getByText(code)).toHaveCount(0);
        await expect(page.locator('#claim-review')).toContainText('Disetujui, menunggu aktivasi');
        await page.getByRole('button', { name: 'Keluar' }).click();
        // Wait for the completed logout (login screen) instead of navigating while it is in flight.
        await expect(page.getByRole('heading', { name: 'Masuk ke ELLIGBLE', exact: true })).toBeVisible();

        // Student sets their own password with the handed-over code; a wrong code is refused.
        await page.getByRole('button', { name: 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi' }).click();
        const fillActivation = async (value: string) => {
            await page.getByLabel('ELLIGBLE ID', { exact: true }).fill(elligbleId);
            await page.getByLabel('Kode Aktivasi').fill(value);
            await page.getByLabel('Kata Sandi Baru', { exact: true }).fill('KlaimSintetisAman2026!');
            await page.getByLabel('Ulangi Kata Sandi Baru').fill('KlaimSintetisAman2026!');
            await page.getByRole('button', { name: 'Aktifkan dan Masuk' }).click();
        };
        await fillActivation('AAAA-BBBB-CCCC');
        await expect(page.getByRole('alert')).toBeVisible();
        await fillActivation(code);
        await expect(page.getByRole('heading', { name: 'Belum Ada Ruang Kerja', exact: true })).toBeVisible();
        await withDatabase(async c => {
            const claim = (await c.query('SELECT state FROM identity_student_claims WHERE submitted_nisn = $1', [nisn])).rows;
            expect(claim).toEqual([{ state: 'ACTIVATED' }]);
        });
    } finally {
        await withDatabase(async c => { await c.query('BEGIN'); try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: fixture.person, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'AUTH-002', reason: 'End synthetic verification' }); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } });
    }
});

test('AUTH-003 actual entry baseline: login and verifier workspace before recovery', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Masuk ke ELLIGBLE', exact: true })).toBeVisible();
    await captureAuthWidths(page, 'login-entry', [], RECOVERY_CAPTURE);
    const person = await withDatabase(async c => {
        const id = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id=a.id WHERE cr.username=$1', ['guru.e2e'])).rows[0].person_id as string;
        await c.query('BEGIN');
        try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: id, action: 'ASSIGN', operator: 'Synthetic CI operator', caseReference: 'AUTH-003', reason: 'Synthetic recovery baseline' }); await c.query('COMMIT'); }
        catch (e) { await c.query('ROLLBACK'); throw e; }
        return id;
    });
    try {
        await login(page, 'guru.e2e', 'papan-tulis-hijau');
        await page.getByRole('button', { name: 'Verifikasi Pendaftaran', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Verifikasi Pendaftaran', exact: true })).toBeVisible();
        await captureAuthWidths(page, 'verifier-workspace', [], RECOVERY_CAPTURE);
    } finally {
        await withDatabase(async c => { await c.query('BEGIN'); try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'AUTH-003', reason: 'End synthetic baseline' }); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } });
    }
});

if (RECOVERY_CAPTURE.phase === 'after') test('AUTH-003 in-person recovery: scoped issue, one-time handoff, Student recovery and expiry', async ({ page }) => {
    const oldPassword = 'SandiLamaSintetis2026!', newPassword = 'SandiBaruSintetis2026!';
    const fixture = await withDatabase(async c => {
        const r = await c.query(`SELECT g.id AS group_id, g.academic_year_id, p.id AS period_id FROM academic_core_academic_groups g
            JOIN academic_core_academic_periods p ON p.tenant_id = g.tenant_id AND p.academic_year_id = g.academic_year_id
            WHERE g.tenant_id = $1 AND g.display_label = 'X-E2E'`, [state.tenantId]);
        const guru = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id=a.id WHERE cr.username=$1', ['guru.e2e'])).rows[0].person_id as string;
        const make = async (username: string, nisn: string) => {
            const person = (await c.query('INSERT INTO identity_persons(id) VALUES(gen_random_uuid()) RETURNING id')).rows[0].id as string;
            const account = (await c.query('INSERT INTO identity_user_accounts(id, person_id) VALUES(gen_random_uuid(), $1) RETURNING id', [person])).rows[0].id as string;
            await c.query('INSERT INTO identity_account_credentials(user_account_id, username, password_verifier, last_successful_login_at) VALUES($1,$2,$3,now())', [account, username, hashPassword(oldPassword)]);
            await c.query('INSERT INTO tenant_memberships(id, tenant_id, person_id) VALUES(gen_random_uuid(),$1,$2)', [state.tenantId, person]);
            const roster = (await c.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth, academic_year_id, academic_period_id, academic_group_id, person_id)
                VALUES($1,$2,'Siswa Pulih Sintetis',$3,$4,'2010-06-07',$5,$6,$7,$8) RETURNING id`, [state.tenantId, `rec-${username}`, `nis-${username}`, nisn, r.rows[0].academic_year_id, r.rows[0].period_id, r.rows[0].group_id, person])).rows[0].id as string;
            return { person, account, roster };
        };
        const main = await make('pulih.e2e', '9990000093'), expired = await make('pulih.kedaluwarsa', '9990000094');
        await c.query('BEGIN');
        try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: guru, action: 'ASSIGN', operator: 'Synthetic CI operator', caseReference: 'AUTH-003', reason: 'Synthetic recovery verification' }); await c.query('COMMIT'); }
        catch (e) { await c.query('ROLLBACK'); throw e; }
        // A synthetic, already expired code renders the honest expiry refusal; no fixture change.
        await c.query(`INSERT INTO identity_account_recovery_codes(tenant_id, user_account_id, person_id, roster_id, issuer_person_id, issuer_kind, reason, request_key, request_digest, code_verifier, issued_at, expires_at)
            VALUES($1,$2,$3,$4,$5,'school_operator','Synthetic expired',gen_random_uuid(),repeat('0',64),$6,now() - interval '20 minutes',now() - interval '5 minutes')`,
            [state.tenantId, expired.account, expired.person, expired.roster, guru, hashPassword('ABCDEFGHJKMN')]);
        return { guru, main };
    });
    try {
        await login(page, 'guru.e2e', 'papan-tulis-hijau');
        await page.getByRole('button', { name: 'Pemulihan Akun', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Pemulihan Akun', exact: true })).toBeVisible();
        await captureAuthWidths(page, 'recovery-empty', [], RECOVERY_CAPTURE);
        await page.getByLabel('ELLIGBLE ID siswa').fill('pulih.e2e');
        await page.getByRole('button', { name: 'Periksa', exact: true }).click();
        await expect(page.locator('#account-recovery')).toContainText('9990000093');
        await captureAuthWidths(page, 'recovery-compare', [], RECOVERY_CAPTURE);
        const trigger = page.getByRole('button', { name: 'Terbitkan Kode Pemulihan' });
        await tabTo(page, trigger);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Terbitkan Kode Pemulihan?' });
        await expect(dialog).toBeVisible();
        for (const key of ['Tab', 'Shift+Tab']) for (let n = 0; n < 6; n++) {
            await page.keyboard.press(key);
            await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
        }
        await dialog.getByLabel('Saya sudah memverifikasi siswa ini secara langsung dengan kartu pelajar.').check();
        await dialog.getByRole('textbox', { name: 'Alasan tindakan' }).fill('Lupa kata sandi, diverifikasi langsung');
        await captureAuthWidths(page, 'recovery-issue', [], RECOVERY_CAPTURE);
        await dialog.getByRole('button', { name: 'Terbitkan', exact: true }).click();
        const handoff = page.getByRole('dialog', { name: 'Serahkan Kode Pemulihan' });
        await expect(handoff).toBeVisible();
        const code = (await handoff.locator('dd').nth(1).textContent())!.trim();
        await captureAuthWidths(page, 'recovery-handoff', [handoff.locator('dd').nth(1)], RECOVERY_CAPTURE);
        await handoff.getByRole('button', { name: 'Selesai, Tutup Kode' }).click();
        await expect(page.getByText(code)).toHaveCount(0);
        await expect(page.locator('#account-recovery')).not.toContainText('9990000093');
        await page.getByRole('button', { name: 'Keluar' }).click();
        await expect(page.getByRole('heading', { name: 'Masuk ke ELLIGBLE', exact: true })).toBeVisible();

        // Student: expired code refused honestly, then the handed-over code recovers the same Account.
        await page.getByRole('button', { name: 'Lupa kata sandi? Gunakan kode pemulihan dari sekolah' }).click();
        await expect(page.getByRole('heading', { name: 'Pulihkan Akun', exact: true })).toBeVisible();
        await captureAuthWidths(page, 'recovery-form', [], RECOVERY_CAPTURE);
        const fill = async (username: string, value: string) => {
            await page.getByLabel('ELLIGBLE ID', { exact: true }).fill(username);
            await page.getByLabel('Kode Pemulihan').fill(value);
            await page.getByLabel('Kata Sandi Baru', { exact: true }).fill(newPassword);
            await page.getByLabel('Ulangi Kata Sandi Baru').fill(newPassword);
            await page.getByRole('button', { name: 'Pulihkan dan Masuk' }).click();
        };
        await fill('pulih.kedaluwarsa', 'ABCD-EFGH-JKMN');
        await expect(page.getByRole('alert')).toContainText('kedaluwarsa');
        await captureAuthWidths(page, 'recovery-refused', [], RECOVERY_CAPTURE);
        await fill('pulih.e2e', code);
        await expect(page.getByRole('heading', { name: 'Belum Ada Ruang Kerja', exact: true })).toBeVisible();
        await withDatabase(async c => {
            const row = (await c.query('SELECT consumed_at IS NOT NULL AS consumed FROM identity_account_recovery_codes WHERE user_account_id = $1', [fixture.main.account])).rows;
            expect(row).toEqual([{ consumed: true }]);
            expect((await c.query('SELECT count(*)::int AS n FROM identity_user_accounts WHERE person_id = $1', [fixture.main.person])).rows[0].n).toBe(1);
        });
    } finally {
        await withDatabase(async c => { await c.query('BEGIN'); try { await setSchoolOperator(c, { tenantId: state.tenantId, personId: fixture.guru, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'AUTH-003', reason: 'End synthetic verification' }); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } });
    }
});
