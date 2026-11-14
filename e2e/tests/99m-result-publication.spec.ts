import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type BrowserContext } from '@playwright/test';
import { login, option, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// RESULT-003 C07/C08. Five conceptual scenarios; the published Student scenario has
// two capture states (masked and revealed): six states, ten conditions, five projects.
// The capture step is copied from final 99l, changing only its prefix and Task ID.
test.describe.configure({ mode: 'serial' });
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('RESULT-003 capture SHA mismatch');
const BASELINE = { run: 265, commit: 'deee8a66d8518544a82b011c5070745a475cc153', frontendTree: '6851be1471d706593b43d6a844fe4d815c4aeb4d', manifestSha256: '2705bbe681110fb241baa47ec16c8f7b78e39653b64037c7a94454a857f5f7dc', record: 'RESULT-003 §10' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT_A = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const STUDENT_B = ['siswa.e2e.01', 'bintang-kejora-2026'] as const;
const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);

async function capture(page: Page, scenario: string, root: () => Locator, variants = FULL): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    try {
        for (const v of variants) for (let attempt = 1; ; attempt++) {
            let retryVariant = false;
            await page.setViewportSize({ width: v.width, height: v.height });
            const name = ['workspace-result-publication', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
            const metadataPath = test.info().outputPath(`${name}.json`);
            let captureWritten = false;
            await expect(root()).toBeVisible();
            await page.evaluate(async () => { await document.fonts.ready; });
            // Snapshot every baseline BEFORE any mutation. Leave the root font unchanged so
            // rem-based geometry is not zoomed along with the text, and inheritance cannot compound.
            const calibration = v.text === 2 ? await page.evaluateHandle(() => ({
                rootStyle: document.documentElement.getAttribute('style'),
                rootFont: getComputedStyle(document.documentElement).fontSize,
                nodes: [document.body, ...document.body.querySelectorAll<HTMLElement>('*')]
                    .filter((node): node is HTMLElement => node instanceof HTMLElement)
                    .map(node => {
                        const style = getComputedStyle(node);
                        return { node, originalStyle: node.getAttribute('style'), font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
                    }),
            })) : null;
            try {
                if (calibration) await calibration.evaluate(snapshot => {
                    for (const { node, font, line } of snapshot.nodes) {
                        node.style.fontSize = String(font * 2) + 'px';
                        if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                    }
                });
                await page.evaluate(async () => { await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); });
                const textCalibration = calibration ? await calibration.evaluate(snapshot => {
                    const calibrated = new Set(snapshot.nodes.map(({ node }) => node));
                    const current = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')].filter((node): node is HTMLElement => node instanceof HTMLElement);
                    const measured = snapshot.nodes.map(({ node, font, line }) => {
                        const style = getComputedStyle(node);
                        return { font, line, actualFont: parseFloat(style.fontSize), actualLine: parseFloat(style.lineHeight) };
                    });
                    const ratios = measured.filter(n => Number.isFinite(n.font) && Number.isFinite(n.actualFont) && n.font > 0).map(n => n.actualFont / n.font);
                    return {
                        method: 'two-pass-computed-text-only', elements: measured.length,
                        detachedElements: snapshot.nodes.filter(({ node }) => !node.isConnected).length,
                        unscaledElements: current.filter(node => !calibrated.has(node)).length,
                        minFontRatio: Math.min(...ratios), maxFontRatio: Math.max(...ratios),
                        fontMismatches: measured.filter(n => !Number.isFinite(n.font) || !Number.isFinite(n.actualFont) || Math.abs(n.actualFont - n.font * 2) > 0.02).length,
                        lineMismatches: measured.filter(n => Number.isFinite(n.line) && (!Number.isFinite(n.actualLine) || Math.abs(n.actualLine - n.line * 2) > 0.02)).length,
                        rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont,
                    };
                }) : undefined;
                // The Operator screens refresh themselves every 20 s. A refresh that replaces elements during a
                // 200 % capture invalidates its snapshot (CI #248, webkit-390), so the variant starts again from a
                // fresh snapshot, at most three times; the exact assertions below then decide.
                if (textCalibration && (textCalibration.detachedElements > 0 || textCalibration.unscaledElements > 0) && attempt < 3) {
                    retryVariant = true;
                    continue;
                }
                if (textCalibration) {
                    expect(textCalibration.elements).toBeGreaterThan(0);
                    expect(textCalibration.detachedElements, 'No calibrated element was replaced before capture').toBe(0);
                    expect(textCalibration.unscaledElements, 'Every current HTML element belongs to the calibrated snapshot').toBe(0);
                    expect(textCalibration.fontMismatches, 'Every captured element has 200% of its original computed text size').toBe(0);
                    expect(textCalibration.lineMismatches, 'Every numeric line height is doubled once').toBe(0);
                    expect(textCalibration.rootUnchanged, 'Text resize must not zoom rem geometry').toBe(true);
                }
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select, summary')].filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
                        .map(n => { const t = n instanceof HTMLInputElement && ['checkbox', 'radio'].includes(n.type) ? n.closest('label') ?? n : n; const b = t.getBoundingClientRect(); return { name: n.getAttribute('aria-label') ?? t.textContent?.trim().slice(0, 60) ?? n.tagName, width: b.width, height: b.height }; });
                    const active = document.activeElement as HTMLElement | null;
                    // Metric labels wrap at spaces only (F7): no metric uses overflow-wrap: anywhere.
                    const metricWraps = [...document.querySelectorAll<HTMLElement>('[data-slot="metric"] dt')].map(n => getComputedStyle(n).overflowWrap).filter(w => w === 'anywhere');
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets, metricWraps,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        // The outermost elements past the right edge that no scrolling or clipping ancestor contains, with their right edge and text.
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => {
                            if (n.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5) return false;
                            for (let up = n.parentElement; up && up !== document.body; up = up.parentElement) {
                                if (getComputedStyle(up).overflowX !== 'visible') return false;
                                if (up.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5) return false;
                            }
                            return true;
                        }).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.getAttribute('class') ?? '').slice(0, 80)} right=${Math.round(n.getBoundingClientRect().right)} ${(n.textContent ?? '').trim().slice(0, 40)}`),
                    };
                });
                const screenshot = `${name}.png`;
                // The larger of the document and body heights: with a dialog open, WebKit sizes the full page by
                // the body. A screenshot WebKit still refuses as too large falls back to the viewport, recorded
                // as fullPage false (as 99h, CI #223).
                let fullPage = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) * window.devicePixelRatio)) <= 30000;
                try {
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                } catch (error) {
                    if (!fullPage || !String(error).includes('larger than')) throw error;
                    fullPage = false;
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                }
                writeFileSync(metadataPath, JSON.stringify({
                    task: 'RESULT-003', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256 },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, textCalibration, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                captureWritten = true;
                // The calibrated DOM must survive until the screenshot and metrics are taken: a self-refresh
                // between the calibration check and the screenshot left unscaled nodes in it (CI #249, webkit-390).
                if (calibration) {
                    const afterCapture = await calibration.evaluate(snapshot => {
                        const calibrated = new Set(snapshot.nodes.map(({ node }) => node));
                        const current = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')].filter((node): node is HTMLElement => node instanceof HTMLElement);
                        return {
                            detachedElements: snapshot.nodes.filter(({ node }) => !node.isConnected).length,
                            unscaledElements: current.filter(node => !calibrated.has(node)).length,
                            fontMismatches: snapshot.nodes.filter(({ node, font }) => node.isConnected && Number.isFinite(font) && Math.abs(parseFloat(getComputedStyle(node).fontSize) - font * 2) > 0.02).length,
                        };
                    });
                    const metadata: Record<string, unknown> = JSON.parse(readFileSync(metadataPath, 'utf8'));
                    writeFileSync(metadataPath, JSON.stringify({ ...metadata, captureAttempt: attempt, textIntegrityAfterCapture: afterCapture }, null, 2));
                    if ((afterCapture.detachedElements > 0 || afterCapture.unscaledElements > 0 || afterCapture.fontMismatches > 0) && attempt < 3) {
                        retryVariant = true;
                        continue;
                    }
                    expect(afterCapture, 'The calibrated DOM stayed unchanged through the screenshot and metrics').toEqual({ detachedElements: 0, unscaledElements: 0, fontMismatches: 0 });
                }
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow ${JSON.stringify(metrics.overflowing)}`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
                expect.soft(metrics.metricWraps, `${scenario} ${v.width}x${v.height} text${v.text}: mid-word metric labels`).toEqual([]);
            } finally {
                if (calibration) {
                    try {
                        const restoration = await calibration.evaluate(snapshot => {
                            for (const { node, originalStyle } of snapshot.nodes) {
                                if (originalStyle === null) node.removeAttribute('style'); else node.setAttribute('style', originalStyle);
                            }
                            return {
                                elements: snapshot.nodes.length,
                                inlineStyleMismatches: snapshot.nodes.filter(({ node, originalStyle }) => node.getAttribute('style') !== originalStyle).length,
                                rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont,
                            };
                        });
                        if (captureWritten) {
                            const metadata: Record<string, unknown> = JSON.parse(readFileSync(metadataPath, 'utf8'));
                            writeFileSync(metadataPath, JSON.stringify({ ...metadata, textRestoration: restoration }, null, 2));
                        }
                        expect(restoration.inlineStyleMismatches, 'Restore every exact original inline style before the next capture').toBe(0);
                        expect(restoration.rootUnchanged, 'Root font and inline style remain at their original values').toBe(true);
                    } finally { await calibration.dispose(); }
                }
            }
            if (!retryVariant) break;
        }
    } finally { await page.setViewportSize(original); }
}


// RESULT-003 E13/C07/C08: teacher-managed PG/PGK/ES, two answering Students and one absent.
// Real product import, answer, grading, finalization, publication/withdrawal/republication.
// Five conceptual capture scenarios; the Student published scenario has masked/revealed states.
// The capture function above is copied verbatim from final 99l except its filename prefix/task.
const FILE_NAME='publikasi-hasil-e2e.csv';
const ABSENT=['siswa.e2e.02',STUDENT_A[1]] as const;
const PROMPTS=['Hasil dari 2 + 3 adalah','Bilangan prima adalah','Jelaskan dua manfaat hutan.'];
const HEADER=['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',...Array.from({length:10},(_,i)=>'left_'+(i+1)),...'abcdefghijkl'.split('').map(l=>'right_'+l),'tolerance','rubric'].join(';');
const row=(head:string,rubric='')=>[head,...Array(23).fill(''),rubric].join(';');
const FILE=[HEADER,row('1;PG;'+PROMPTS[0]+';4;5;6;7;8;B;2'),row('2;PGK;'+PROMPTS[1]+';2;4;5;8;9;A,C;3'),row('3;ES;'+PROMPTS[2]+';;;;;;;5','Nilai dua manfaat yang benar.')].join('\r\n')+'\r\n';
const REASON='Hasil sudah diperiksa dan siap dibagikan';
type Receipt={examInstanceId:string;published:boolean;revision:number;changedAt:string;replayed:boolean};
const main=(page:Page)=>()=>page.locator('main').first();
const assignment=(page:Page,id:string)=>page.getByTestId('assignment-'+id);
const teacherCard=(page:Page,id:string)=>page.getByTestId('teacher-exam-'+id);
const stateLine=(page:Page,text:RegExp)=>page.getByRole('status').filter({hasText:text});
const focusOnBody=(page:Page)=>page.evaluate(()=>document.activeElement===null||document.activeElement===document.body);
async function request(page:Page,path:string,body?:Record<string,unknown>){
    return page.evaluate(async({path,body,tenant})=>{
        const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:{'X-Tenant-ID':tenant,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
        return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json() as unknown};
    },{path,body,tenant:state.tenantId});
}
async function operatorAssignment(action:'ASSIGN'|'REVOKE'){
    await withDatabase(async c=>{
        const person=(await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id=a.id WHERE cr.username=$1',[OPERATOR[0]])).rows[0].person_id as string;
        await c.query('BEGIN');
        try{await setSchoolOperator(c,{tenantId:state.tenantId,personId:person,action,operator:'Synthetic CI operator',caseReference:'RESULT-003',reason:'Synthetic publication journey'});await c.query('COMMIT')}
        catch(e){await c.query('ROLLBACK');throw e}
    });
}
async function openWindowNow(examId:string){
    await withDatabase(async c=>{
        await c.query("UPDATE secure_assessment_exam_instances SET window_starts_at=statement_timestamp()-interval '2 minutes',window_ends_at=statement_timestamp()+interval '120 minutes' WHERE id=$1",[examId]);
        // The teacher-managed exam has no institution session. Free overlapping earlier
        // exams of this same class/proctors, as the bounded fixture of 99l does.
        await c.query(`UPDATE secure_assessment_exam_instances i SET lifecycle_state='ENDED'
            FROM secure_assessment_exam_instances own WHERE own.id=$2 AND i.tenant_id=$1 AND i.id<>own.id
            AND i.lifecycle_state IN('SCHEDULED','READY','ACTIVE','PAUSED')
            AND i.window_starts_at<own.window_ends_at AND i.window_ends_at>own.window_starts_at
            AND (EXISTS(SELECT 1 FROM secure_assessment_exam_participants p JOIN secure_assessment_exam_participants x
                ON x.person_id=p.person_id AND x.tenant_id=p.tenant_id AND x.exam_instance_id=own.id
                WHERE p.exam_instance_id=i.id AND p.tenant_id=i.tenant_id)
                OR EXISTS(SELECT 1 FROM secure_assessment_proctor_assignments p JOIN secure_assessment_proctor_assignments x
                ON x.person_id=p.person_id AND x.tenant_id=p.tenant_id AND x.exam_instance_id=own.id AND x.revoked_at IS NULL
                WHERE p.exam_instance_id=i.id AND p.tenant_id=i.tenant_id AND p.revoked_at IS NULL))`,[state.tenantId,examId]);
    });
}
async function storage(page:Page){
    return page.evaluate(async()=>{
        const values:unknown[]=[];
        for(const info of await indexedDB.databases()){
            if(!info.name)continue;
            const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(info.name!);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            try{for(const name of [...db.objectStoreNames]){
                const entries=await new Promise<unknown[]>((resolve,reject)=>{const tx=db.transaction(name,'readonly'),r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
                values.push({database:info.name,store:name,entries});
            }}finally{db.close()}
        }
        return {local:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort(),indexed:values};
    });
}
async function noStoredResults(page:Page){
    const values=JSON.stringify(await storage(page));
    expect(values).not.toMatch(/"scaledScore"|"publishedAt"|"publication"|"revealed"/);
}
async function studentCapture(page:Page,id:string,scenario:string){
    // Preserve the unmodified capture step while ensuring a viewport fallback includes
    // the new Student card on a long list, at every frozen condition.
    const original=page.viewportSize();
    try{for(const v of FULL){
        await page.setViewportSize({width:v.width,height:v.height});
        await assignment(page,id).scrollIntoViewIfNeeded();
        await capture(page,scenario,()=>assignment(page,id),[v]);
    }}finally{if(original)await page.setViewportSize(original)}
}
test('RESULT-003: publish, own masked score, withdraw, republish and privacy',async({page,browser})=>{
    test.setTimeout(35*60_000);
    page.setDefaultTimeout(120_000);page.setDefaultNavigationTimeout(120_000);
    await page.emulateMedia({reducedMotion:'reduce'});
    await operatorAssignment('ASSIGN');
    const contexts:BrowserContext[]=[];
    try{
        await login(page,...TEACHER);
        const nav=page.getByRole('navigation',{name:'Ruang kerja'});
        if(await nav.getByRole('button',{name:'Pelaksanaan Ujian',exact:true}).isVisible())await nav.getByRole('button',{name:'Pelaksanaan Ujian',exact:true}).click();
        await page.getByRole('button',{name:'Buat Ujian'}).first().click();
        await expect(page.getByRole('heading',{name:'Buat Ujian dari Berkas Soal'})).toBeVisible();
        const subject=page.getByRole('radio',{name:/Matematika Wajib.*X-E2E/});
        if(await subject.isVisible())await subject.check();
        await page.getByLabel('Jenis penilaian').selectOption({label:'Ulangan Harian'});
        await page.getByLabel('Mulai (WIB)').fill(wib(3*24*60));
        await page.getByLabel('Selesai (WIB)').fill(wib(3*24*60+120));
        await page.getByLabel('Durasi pengerjaan (menit)').fill('30');
        await page.getByRole('radio',{name:/Durasi penuh/}).check();
        await page.getByLabel('Berkas CSV').setInputFiles({name:FILE_NAME,mimeType:'text/csv',buffer:Buffer.from(FILE,'utf8')});
        await page.getByRole('button',{name:'Periksa Soal dan Jadwal'}).click();
        const participants=page.getByRole('region',{name:/^Peserta \(/});
        for(const box of await participants.getByRole('checkbox').all()){
            const label=(await box.evaluate(e=>(e as HTMLInputElement).labels?.[0]?.textContent??'')).trim();
            if([STUDENT_A[0],STUDENT_B[0],ABSENT[0]].some(id=>id===label))await box.check();else if(await box.isChecked())await box.uncheck();
        }
        // Reassert the exact three fixture participants after any "select all" control.
        for(const id of [STUDENT_A[0],STUDENT_B[0],ABSENT[0]])await participants.getByRole('checkbox',{name:id,exact:true}).check();
        await page.getByRole('button',{name:'Periksa Lagi'}).click();
        await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
        await page.getByRole('button',{name:'Jadwalkan Ujian'}).click();
        await page.getByRole('dialog',{name:'Jadwalkan Ujian Ini?'}).getByRole('button',{name:'Jadwalkan Ujian'}).click();
        await expect(page.getByRole('status').filter({hasText:'dijadwalkan dengan 3 soal dan 3 peserta'})).toBeVisible();
        const examId:string=await withDatabase(async c=>(await c.query('SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name=$1',[FILE_NAME])).rows[0].exam_instance_id);
        await openWindowNow(examId);
        const card=teacherCard(page,examId);
        await card.getByRole('button',{name:'Tandai Siap'}).click();
        await card.getByRole('button',{name:'Buka Ujian',exact:true}).click();
        await page.getByRole('dialog').getByLabel('Alasan tindakan',{exact:true}).fill('Ujian dimulai sesuai jadwal');
        await page.getByRole('dialog').getByRole('button',{name:'Buka Ujian',exact:true}).click();
        await expect(card).toContainText('Berlangsung');
        async function tab(credentials:readonly[string,string]){
            const context=await browser.newContext({viewport:page.viewportSize()??undefined,locale:'id-ID',timezoneId:'UTC',reducedMotion:'reduce'});contexts.push(context);
            const p=await context.newPage();p.setDefaultTimeout(120_000);p.setDefaultNavigationTimeout(120_000);await login(p,...credentials);return p;
        }
        const a=await tab(STUDENT_A),b=await tab(STUDENT_B),absent=await tab(ABSENT),op=await tab(OPERATOR);
        async function complete(p:Page,choice:string,essay:string){
            await assignment(p,examId).getByRole('button',{name:'Mulai Ujian'}).click();
            await p.getByRole('button',{name:'Mulai Ujian Sekarang'}).click();
            await expect(p.getByText(PROMPTS[0],{exact:true})).toBeVisible();
            await option(p,choice==='B'?1:0).click();await expect(saveStatus(p)).toHaveText('Tersimpan');
            await p.getByRole('button',{name:'Soal Berikutnya'}).click();
            await expect(p.getByText(PROMPTS[1],{exact:true})).toBeVisible();
            await option(p,0).click();await option(p,2).click();await expect(saveStatus(p)).toHaveText('Tersimpan');
            await p.getByRole('button',{name:'Soal Berikutnya'}).click();
            await p.getByLabel('Jawaban esai').fill(essay);await expect(saveStatus(p)).toHaveText('Tersimpan');
            await p.getByRole('button',{name:'Selesaikan Ujian'}).click();await p.getByRole('dialog').getByRole('checkbox').check();
            await p.getByRole('button',{name:'Kirim Jawaban Sekarang'}).click();await expect(p.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
        }
        await complete(a,'B','Hutan menyimpan air dan menghasilkan oksigen.');
        await complete(b,'A','Hutan menyimpan air.');
        await card.getByRole('button',{name:'Akhiri Ujian',exact:true}).click();
        await page.getByRole('dialog').getByLabel('Alasan tindakan',{exact:true}).fill('Waktu pelaksanaan selesai');
        await page.getByRole('dialog').getByRole('button',{name:'Akhiri Ujian',exact:true}).click();await expect(card).toContainText('Diakhiri');
        await card.getByRole('button',{name:'Nilai Esai'}).click();
        await expect(page.getByRole('heading',{name:'Penilaian Esai',exact:true})).toBeVisible();
        for(const[id,value]of[[STUDENT_A[0],'4'],[STUDENT_B[0],'2,5']]){
            const group=page.getByRole('group',{name:'Soal 3 · '+id});
            await group.getByLabel('Skor (0 sampai 5)').fill(value);await group.getByRole('button',{name:'Simpan Nilai'}).click();
            await expect(group.getByText('Nilai tersimpan.')).toBeVisible();
        }
        await page.getByRole('button',{name:'Kembali ke Pelaksanaan Ujian'}).click();
        await card.getByRole('button',{name:'Finalisasi Hasil'}).click();
        const finalization=page.getByRole('dialog',{name:'Finalisasi Hasil Ujian?'});
        await finalization.getByLabel('Alasan tindakan',{exact:true}).fill('Semua jawaban telah dinilai');
        await finalization.getByRole('button',{name:'Finalisasi Hasil',exact:true}).click();await expect(card).toContainText('Hasil Final');
        async function studentList(p:Page){
            // No refresh/navigation is in flight: Student has no in-app refresh (E13).
            await reloadPage(p);await expect(assignment(p,examId)).toBeVisible();
        }
        for(const p of[a,b,absent]){
            await studentList(p);await expect(assignment(p,examId).getByText('Hasil belum tersedia.',{exact:true})).toBeVisible();
            await expect(p.getByTestId('result-value-'+examId)).toHaveCount(0);await noStoredResults(p);
            const r=await request(p,'/api/v1/assessment/my-results');expect(r.status).toBe(200);expect(r.cache).toContain('no-store');expect(r.body).toEqual({results:[]});
        }
        await card.getByRole('button',{name:'Lihat Hasil'}).click();
        await expect(stateLine(page,/^Belum dipublikasikan\./)).toBeVisible();
        await capture(page,'results-unpublished',main(page));
        async function publication(action:'publish'|'withdraw',captureDialog=false):Promise<Receipt>{
            const label=action==='publish'?'Publikasikan Hasil':'Tarik Publikasi';
            await page.getByRole('button',{name:label,exact:true}).click();const d=page.getByRole('dialog');
            const confirm=d.getByRole('button',{name:label,exact:true});await expect(confirm).toBeDisabled();
            await d.getByLabel('Alasan tindakan',{exact:true}).fill(REASON);
            if(captureDialog)await capture(page,'publish-dialog',()=>page.getByRole('dialog'));
            const receipt=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/assessment/result-publications'&&r.request().method()==='POST');
            await confirm.click();const response=await receipt;expect(response.status()).toBe(200);
            const body=await response.json() as Receipt;
            expect(Object.keys(body).sort()).toEqual(['examInstanceId','published','revision','changedAt','replayed'].sort());
            expect(body.examInstanceId).toBe(examId);expect(body.published).toBe(action==='publish');
            await expect(d).toHaveCount(0);
            const next=page.getByRole('button',{name:action==='publish'?'Tarik Publikasi':'Publikasikan Hasil',exact:true});
            await expect(next).toBeFocused();expect(await focusOnBody(page)).toBe(false);return body;
        }
        const first=await publication('publish',true);expect(first.revision).toBe(1);
        await expect(stateLine(page,/^Dipublikasikan kepada siswa /)).toBeVisible();
        await capture(page,'results-published',main(page));
        const expected=(score:number|null,standing:'SUBMITTED'|'ABSENT'='SUBMITTED')=>({examInstanceId:examId,publishedAt:first.changedAt,standing,scaledScore:score});
        for(const[p,score]of[[a,90],[b,55]] as Array<[Page,number]>){
            await studentList(p);const own=assignment(p,examId),toggle=own.getByRole('button',{name:'Tampilkan Nilai',exact:true});
            await expect(toggle).toHaveAttribute('aria-pressed','false');await expect(own.getByLabel('Disembunyikan')).toBeVisible();
            await expect(p.getByTestId('result-value-'+examId)).toHaveCount(0);await noStoredResults(p);
            const response=await request(p,'/api/v1/assessment/my-results');expect(response.cache).toContain('no-store');expect(response.body).toEqual({results:[expected(score)]});
            if(p===a)await studentCapture(p,examId,'student-published-masked');
            await toggle.click();await expect(p.getByTestId('result-value-'+examId)).toHaveText(String(score));
            await expect(own.getByRole('button',{name:'Sembunyikan Nilai',exact:true})).toHaveAttribute('aria-pressed','true');
            await expect(p.getByText(p===a?STUDENT_B[0]:STUDENT_A[0],{exact:true})).toHaveCount(0);
            if(p===a)await studentCapture(p,examId,'student-published-revealed');
            await noStoredResults(p);
            await own.getByRole('button',{name:'Sembunyikan Nilai',exact:true}).click();await expect(p.getByTestId('result-value-'+examId)).toHaveCount(0);
            await own.getByRole('button',{name:'Tampilkan Nilai',exact:true}).click();await studentList(p);
            await expect(assignment(p,examId).getByRole('button',{name:'Tampilkan Nilai',exact:true})).toHaveAttribute('aria-pressed','false');
            await expect(p.getByTestId('result-value-'+examId)).toHaveCount(0);
        }
        await studentList(absent);await expect(assignment(absent,examId).getByText('Anda tercatat tidak mengerjakan ujian ini, sehingga tidak ada nilai.',{exact:true})).toBeVisible();
        await expect(assignment(absent,examId).getByRole('button',{name:'Tampilkan Nilai'})).toHaveCount(0);
        expect((await request(absent,'/api/v1/assessment/my-results')).body).toEqual({results:[expected(null,'ABSENT')]});
        const count=()=>withDatabase(async c=>Number((await c.query('SELECT count(*) AS n FROM secure_assessment_result_publication_events WHERE exam_instance_id=$1',[examId])).rows[0].n));
        const before=await count();
        for(const p of[a,op]){
            const r=await request(p,'/api/v1/assessment/result-publications',{examInstanceId:examId,action:'withdraw',expectedRevision:1,reason:REASON,confirmed:true,actionKey:crypto.randomUUID()});
            expect(r.status).toBe(403);expect(r.body).toEqual({error:'forbidden'});
        }
        expect((await request(a,'/api/v1/assessment/my-results?examInstanceId='+examId)).status).toBe(400);expect(await count()).toBe(before);
        // X-1: actual browser CSV retains the 19 fixed RESULT-004 columns and the three question columns.
        const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh CSV',exact:true}).click();
        const download=await downloaded,path=await download.path();if(!path)throw new Error('Missing browser CSV');
        const columns=readFileSync(path,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)[0].split(';');
        expect(columns).toHaveLength(22);expect(columns.slice(19)).toEqual(['Soal 1 (PG, maks 2)','Soal 2 (PGK, maks 3)','Soal 3 (ES, maks 5)']);expect(columns.join(';')).not.toMatch(/publikasi|publication/i);
        const withdrawn=await publication('withdraw');expect(withdrawn.revision).toBe(2);
        await expect(stateLine(page,/^Publikasi ditarik /)).toBeVisible();
        for(const p of[a,b,absent]){
            await studentList(p);await expect(assignment(p,examId).getByText('Hasil belum tersedia.',{exact:true})).toBeVisible();
            await expect(p.getByTestId('result-value-'+examId)).toHaveCount(0);await noStoredResults(p);expect((await request(p,'/api/v1/assessment/my-results')).body).toEqual({results:[]});
        }
        await studentCapture(a,examId,'student-withdrawn');
        const republished=await publication('publish');expect(republished.revision).toBe(3);
        await studentList(a);const again=await request(a,'/api/v1/assessment/my-results');
        expect(again.body).toEqual({results:[{...expected(90),publishedAt:republished.changedAt}]});
        await assignment(a,examId).getByRole('button',{name:'Tampilkan Nilai',exact:true}).click();
        await expect(a.getByTestId('result-value-'+examId)).toHaveText('90');await noStoredResults(a);
    }finally{await Promise.all(contexts.map(c=>c.close()));await operatorAssignment('REVOKE')}
});
