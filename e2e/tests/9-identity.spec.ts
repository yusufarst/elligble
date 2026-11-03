import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { login, withDatabase, state } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

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
