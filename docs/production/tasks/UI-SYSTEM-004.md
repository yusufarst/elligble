# UI-SYSTEM-004 Part 2 — Student Exam Workspace, Reading and Responsive Accessibility

> Part 2 remains DONE. The separately authorized Part 3 contract and status start at §8.

> PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This record covers Part 2 only. It does not complete the rest of UI-SYSTEM-004 or unblock UI-SYSTEM-005.

## 1. Contract and authority

| Field | Value |
|---|---|
| Status | DONE: Part 2 only; final content 5ba9fb4, CI #72 attempt 1 eight SUCCESS, Independent Second Review PASS and Owner Visual Review PASS; final evidence authorized 2026-10-27 |
| Release | CBT-R1; Secure Assessment only (DEC-044) |
| Risk | STANDARD while presentation-only; stop on any material CBT defect or business-logic change |
| Owner approval | GRANTED 2026-10-27: corrected minimum scope, Task-specific CI-first order, baseline capture before UI changes, narrow successful-artifact upload, guarded commits/normal push/one PR; MERGE NO |
| Authorization provenance | Owner execution instruction attachment SHA-256 `cd45372f886cd7adaf1fe3b2a9dba7f076389f27ee336b601e9cee910b387b89`; subsequent explicit Owner approval adds only the third-question text fixture in `e2e/global-setup.ts` |
| Verified base | `b5c2ae7bf35b04e6610cd2c0f6c51ced8ad5191f`; frontend source tree `73b4d38c74363c8f765446f6a0028899c3b4b89f` |
| Branch | `task/ui-system-004-student-exam-workspace` |
| Predecessors | UI-SYSTEM-004 Part 1 `3cfefc4`; UI-SYSTEM-002 Part 2 DONE, PR #7 merged as `b5c2ae7`, main CI #67 (40375672081), attempt 1, eight jobs SUCCESS on ubuntu-24.04 |
| Owner identity | Yusuf Arif Setiawan; `134618411+yusufarst@users.noreply.github.com`; verify author and committer before every commit and inspect fuller/raw log after each |
| Review | Independent Second Reviewer AND actual Owner visual approval required by this Task authorization, even though risk is STANDARD |

Authority: AGENTS.md, context protocol 00.04, decision hierarchy 00.02, DEC-040/043 locked visual foundation, DEC-044 release scope, DEC-045/00.12 bounded Task execution, living plan §10.1, FRONTEND_DESIGN_SYSTEM, SECURE_ASSESSMENT_EXAM_FOCUS_WORKSPACE, UI_CONTENT_AND_COPY_STYLE and FRONTEND_AGENT_SKILL_STACK. Existing locked warm monochrome, shadcn-themed ELLIGBLE primitives and native answer radios remain authoritative. The Owner's minimum accessibility/responsive remediation is not a global design supersession.

The approved DesainPakeAI project remains inaccessible. No current alignment with it is claimed, nothing is copied from another project, no §10.1 dependency is waived, and substantial redesign/token convergence remains with BLOCKED UI-SYSTEM-005. Existing FDS §28 versus SubmitConfirmModal Escape behavior is an inherited discrepancy, outside this change; no modal behavior or focus contract is changed.

## 2. Objective and exact scope

Improve the existing Student workspace's reading comfort, hierarchy and responsive accessibility for 90–180-minute exams: visible native-radio focus, long-text wrapping, accessible local status contrast, minimum 44px targets, proportionate warm-neutral composition, stable timer/save status, safe-area-aware dock and navigator, quiet messages and restrained reduced motion. Reuse existing components and token values; no separate page design system. Preserve Teacher preview when touching shared selectors.

Approved paths (no others):

1. `frontend/web/src/components/StudentExamWorkstation.tsx`: presentation/classes only; preserve callbacks, labels, roles, disabled conditions, state and focus behavior.
2. `frontend/web/src/styles/workstation.css`: bounded Student presentation; scope additions to avoid Teacher regressions.
3. `frontend/web/src/components/ExamMessages.tsx`: presentation and shared Button sizing only.
4. `frontend/web/src/__tests__/designSystemGuard.test.ts`: strengthen/lower the hard-coded-color ceiling when colors are removed; never increase or weaken.
5. `e2e/tests/helpers.ts`: deterministic actual-app capture/metadata and bounded visual/accessibility checks using existing Playwright/Node tooling.
6. `e2e/tests/1-pilot-journey.spec.ts`: capture the unchanged pilot journey and the longer unanswered third question, preserving its original score and every assertion.
7. `e2e/tests/2-resilience.spec.ts`: capture existing pending/failed/recovered/flagged states and server-calculated timer presentation; retain assertions.
8. `docs/production/tasks/UI-SYSTEM-004.md`: this contract, execution and eventual evidence.
9. `docs/production/PRODUCTION_COMPLETION_PLAN.md`: active Task/checkpoint and predecessor landing in this change.
10. `.github/workflows/ci.yml`: one successful E2E artifact-upload step only; existing matrix, jobs, runner, permissions, services, commands, gates and failure artifacts unchanged; seven-day retention.
11. `e2e/global-setup.ts`: subsequent Owner-approved expansion, ONLY prompt/stimulus and distractor text on question 3 in the generated CSV. First two questions and all other setup code stay byte-equivalent after line-ending normalization.

Conditional paths remain unauthorized: Teacher adapters/tests, new shared answer-option component, extra fixture/harness files, new visual spec, shared Button/Page/Dialog changes, additional dependencies/manifests/lockfiles. No runtime, API, hooks, types/contracts, database/migrations, infrastructure, global tokens/fonts/palette, other role screens, UI-SYSTEM-005, exam data types/media or unrelated Task work.

Security/CBT invariants: unchanged answer identity, option order A–E, selection callbacks, persistence/ACK/reconciliation, authoritative timer, submission transaction/confirmation, lifecycle, session/device authority, tenant isolation and authorization. Selection is not save acknowledgement. Exactly one timer. No real student data, credentials or attribution in evidence/commit/PR metadata. UI copy remains Indonesian, without an em dash.

### 2.1 Owner-approved fixture expansion and fixture gate

Owner: “Hanya boleh memperpanjang teks stimulus/prompt dan pilihan jawaban sintetis pada soal ketiga dalam questions.csv yang dibentuk oleh global setup.” The original phrase `Akar kuadrat dari 81 adalah` remains the prompt prefix. Five choices in the same order; C remains exactly `9`, key C, score 1; three questions total. A/B/D/E retain their numeric starting values and gain synthetic explanatory distractor text. CSV-quoted paragraphs are deterministic, parser-valid plain text, no new schema/media/type. The first two rows and all existing assertions (including lifecycle/final-result scoring) remain unchanged. This dataset must land in the baseline commit and remain identical in every after capture.

Evidence helpers hold and then forward the real pending-save request unchanged (no fabricated ACK), use existing offline/failed-save scenarios, and read the actual app. Timer-warning/urgent fixture captures use the existing isolated-CI-database technique of `expireAttemptOf`: temporarily change only the student's synthetic timer start, read the server-calculated time through the real resume route, and restore the exact original start in `finally` before later tests. They never alter client/server clock logic or any workstation database. No content snapshots are rewritten after import.

## 3. Acceptance and visual evidence

- AC-01: exact allowlist, no app changes in baseline commit; fixture gate above PASS; same fixture SHA in before/after manifests. Existing assertions retained and every test run without skip/retry.
- AC-02: one coherent locked ELLIGBLE system. Native radios and semantic labels preserved; clearly visible >=2px keyboard outline on the option label; selection/current/answered/pending/failed/flagged states remain distinguishable through existing symbols/names, not color alone.
- AC-03: normal text contrast >=4.5:1; large text and required non-text indicators >=3:1. Local warning/status remedies use existing semantic tokens. No new global palette, font, dependency or page primitive.
- AC-04: all relevant Student answer/navigation/dismissal touch targets >=44×44 CSS px; readable long prompts/options; no unintended horizontal overflow, clipped text, overlap, or content hidden behind the dock. Keyboard/focus/screen-reader contracts remain equivalent.
- AC-05: single stable authoritative timer; status reflects real pending/failed/server-ACK state; no animation claims saving succeeded. Submit/confirm/lifecycle/session/security/persistence unchanged and full critical journeys PASS.
- AC-06: actual rendered primary matrix: 360×640, 390×844, 430×932, 768×1024, 1024×768, 1280×720, 1440×900 (Chromium). Existing Firefox desktop and WebKit mobile projects supply cross-engine evidence at their recorded project viewport. Stress: 320×568 reflow, 568×320 landscape, 360×480 and 1280×360 short screens, 200% text-resize emulation and reduced motion. Record emulation honestly; no physical-device/native-browser-zoom certification. Safe-area CSS and actual notch-device review remain distinct evidence.
- AC-07: no distracting loops/bounce, layout/tap movement or delayed answer/submit; purposeful short transitions use existing motion constraints and respect prefers-reduced-motion.
- AC-08: actual before/after screenshots inspected and material in-scope defects refined; Teacher preview and inherited paused/locked/message screenshots retained as supplementary related-consumer evidence. Do not claim WCAG/visual PASS solely from typing/unit tests or DOM metrics.

Manifests: actual capture SHA, baseline reference/source tree, candidate source tree, fixture ID/hash, browser engine/version/project, viewport, scenario/state, screenshot name, masking and variable fields. Main captures include viewport screenshots, selected full-page reading captures, real radio accessibility snapshots, typography/geometry/focus measurements. No masking: timer/timestamps may differ, documented explicitly. Existing pause/lock/message/Teacher screenshots are copied unchanged with provenance and project viewport; they are supplementary, without new layout measurements. Artifacts: `workspace-visual-<project>`, PNG+JSON only, seven days.

200% text stress explicitly doubles each element's precomputed font size, restores every original style afterwards, and is labeled emulation. It is not a claim that changing only root rem sizes resized all px text. All seven primary widths plus stress run in desktop Chromium; the other projects preserve their original viewport. Existing E2E retry count stays zero. Baseline geometry records known defects; after-source candidates additionally enforce new overflow/touch/focus acceptance assertions.

## 4. Own CI-first verification and publication contract

This is a new explicit Owner authorization, not reuse of UI-SYSTEM-002's amendment.

1. Physical Git/remote/base/predecessor/Owner-identity/scope verification. No unknown working change, divergence, reset, clean, stash, rebase, force, clone or replacement checkout. Use the existing authorized branch.
2. Register this Task and baseline plumbing. Check CSV with the actual parser and all fixture invariants; verify untouched application source/tree and all pre-existing assertions. No local npm ci, typecheck repeat, heavy tests/build, services, Docker or port/process/database operations.
3. Guarded baseline evidence content commit; normal push; one PR to main. Automatic push CI, attempt 1 only. Full existing eight jobs must SUCCESS on ubuntu-24.04 AND all five successful screenshot/manifest artifacts must be retrievable before any UI source edit. Missing evidence/failure means STOP, no rerun/dispatch or weakened gate.
4. Only then implement bounded presentation and capture the same fixture/scenarios. Refine material visual details within scope. A new content candidate gets its own automatic full CI; never reuse a different SHA's PASS. Inspect actual execution counts, not a promised previous count of 344.
5. Mandatory final content verification: web typecheck/all unit tests/build; runtime typecheck/unit/real PostgreSQL integration; image build/smoke; all five browser projects with every existing assertion plus approved new visual/accessibility checks; no failed/skipped/retried tests; actual before/after artifacts reviewed.
6. Present actual paired evidence and results for Independent Second Reviewer and Owner visual review. Do not claim their PASS. Only AFTER both required approvals and all content gates PASS, create exactly one final evidence commit changing only this Task record, inspect identity/raw message, normal push. Keep the one PR open for Owner squash merge. MERGE NO. Do not start another Task.

Before every commit: verify Owner name/email as both author and committer, exact branch/base ancestry and expected HEAD, allowed paths/staged diff, no unknown untracked work, no secrets or attribution, `git diff --cached --check`; review the actual diff. After: `git log -1 --format=fuller` and raw message; report unexpected attribution, never rewrite history. gh uses only `$HOME/ELLIGBLE-evidence/gh-config` in the command environment; no shared configuration change.

Stop on scope/dependency expansion, fixture/parser/assertion mismatch, unexpected Git state/identity, inaccessible required design authority, material CBT/security regression, any verification failure or missing/mismatched artifacts. Do not bypass a STOP with retry or a smaller test set. No Docker, ports, global configuration/process operations or resources of ELLIGBLE/MULTIPLECORP/BANTUKASIR/PRANATA UNY on the laptop; GitHub runners remain separate.

No vendor, production dependency or recurring production cost change. Five small PNG/JSON success artifacts per workflow use GitHub Actions/artifact quota with seven-day retention; no extra job or runner topology.

## 5. Execution evidence (not a PASS claim)

2026-10-27 entry: expected previous branch and clean physical tree verified. Owner Git identity matched. gh API user `yusufarst`; remote main `b5c2ae7`, PR #7 merged, main CI #67 attempt 1 eight SUCCESS verified. Existing main fast-forwarded and the authorized Task branch created at `b5c2ae7`; clean at entry. No application edits before baseline. The Owner subsequently approved exactly the one-file third-question expansion after the initial fixture STOP.

Baseline commit `2097232268d8d26cd90e861ef52ebfa2bb0ee1c2`: CI #68 FAILED; tree correction `9585d2e83223506f6ff2b829fa907b4b7c0ad57d`: CI #69 FAILED in WebKit. Owner-approved harness correction **`dbe626535d363f02ffc13db0b83d035b24f994c8`**, CI #70, now has baseline exit **PASS**, with all eight jobs SUCCESS and five retrieved/validated visual artifacts. Historical failures remain below. Bounded UI presentation was started only after that full gate. Final content and completion: see §7. CI #72 attempt 1 eight SUCCESS; Independent Second Review PASS and Owner Visual Review PASS confirmed by the Owner on 2026-10-27. The Owner authorizes exactly one final Task-record-only evidence commit and normal push. Part 2 is DONE; the remaining UI-SYSTEM-004 work and UI-SYSTEM-005 are not completed by this record.

### 5.1 Lightweight baseline preconditions

Fixture gate PASS using the application's actual `parseQuestionFile` under Node.js (no server/database/test suite): three questions, original first two rows unchanged, third prompt 766 characters, option lengths 181/180/1/183/159, C exactly `9`, correct index 2, score 1, zero parser problems. Normalized source comparison proves that only the third CSV string changed in global setup. Every pre-existing assertion line in the two touched specs is retained; `5-lifecycle.spec.ts` and application source remain unchanged. Node syntax checks on the four touched TS files and `git diff --check` PASS. Full TypeScript and execution verification remain CI gates, not inferred from syntax.

Workflow validation: actionlint is unavailable on this workstation; do not install a dependency for this Task. Exact diff review and a guard removing the one approved success-upload block must reproduce the original workflow byte-for-byte after line-ending normalization. It adds only PNG/JSON workspace artifacts with success condition, missing-files error and seven-day retention; the original failure artifacts remain. GitHub's automatic workflow acceptance/execution is still required.

Engineering skill selected/verified: existing `react-typescript-vite` (SHA-256 `450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558`); canonical skill-stack roles and locked repository authority take precedence. No package installed during this Task.

### 5.2 Baseline CI #68 failure and exact corrective authorization

[CI #68](https://github.com/yusufarst/elligble/actions/runs/40392077771), databaseId `40392077771`, push event, attempt **1**, head **`2097232268d8d26cd90e861ef52ebfa2bb0ee1c2`**, terminal **COMPLETED / FAILURE**, independently rechecked before this correction. Every job ran on `ubuntu-24.04`.

| Job | Job ID | Actual result |
|---|---|---|
| Web typecheck, unit, build | 121815357560 | SUCCESS; 34 test files, 344 tests PASS |
| Runtime typecheck, unit, real PostgreSQL integration | 121815357675 | SUCCESS |
| Container image build and smoke | 121815907311 | SUCCESS |
| E2E mobile-360 | 121815907671 | FAILURE |
| E2E tablet-768 | 121815907425 | FAILURE |
| E2E desktop-1280 | 121815907548 | FAILURE |
| E2E firefox-1280 | 121815907594 | FAILURE |
| E2E webkit-390 | 121815907540 | FAILURE |

Root cause: the new capture helper requested `git rev-parse b5c2ae7bf35b04e6610cd2c0f6c51ced8ad5191f:frontend/web/src`, but the unchanged checkout used `git fetch ... --depth=1` for the candidate commit. The historical base commit object was absent. E2E collection failed in helpers.ts; these are failed jobs, not evidence that browser assertions executed or passed. Successful visual uploads were skipped, so the required five before artifacts are not available from #68. Failure artifacts remain historical evidence. Nothing is reclassified as PASS.

The main baseline and candidate frontend source tree is **`73b4d38c74363c8f765446f6a0028899c3b4b89f`**, verified locally for both refs and independently by the Second Reviewer through GitHub Git Trees. The unchanged third-fixture capture SHA-256 is **`3a1aa51907bed05ea4687094534e3983f8ffaf52b5752d804aaea7669f9727fb`**. No application implementation started.

Owner explicitly approved one targeted corrective content commit, then confirmed that the terminal-status gate was resolved. Exactly three paths: this record, the living plan and `e2e/tests/helpers.ts`. Exactly one helper-line substitution: replace the unavailable historical tree lookup with the independently verified immutable tree literal. Keep WORKSPACE_BASE, candidate HEAD tree lookup, phase comparison, SHA assertion, fixture hash, screenshot logic and every assertion unchanged. No workflow change, additional correction, retry, rerun, dispatch, branch, PR or merge. Reuse PR #8 and normal push only. The earlier stop while #68 was still running is preserved as a correct pre-push stop; the run has now completed without cancellation.

The corrective content SHA is the commit carrying this section, a direct child of `2097232268d8d26cd90e861ef52ebfa2bb0ee1c2`; report its actual SHA after creation and record it at the next authorized checkpoint (a commit cannot embed its own resulting SHA). Its automatic CI must be attempt 1 on that exact SHA, all eight jobs SUCCESS, all five PNG/JSON artifacts actually retrievable with the expected tree, fixture hash and `before` classification. Until then baseline exit gate remains STOP and UI implementation is prohibited. Any further material failure means STOP; no automatic additional corrective commit. Only full baseline PASS permits resuming the previously authorized bounded UI work.

### 5.3 CI #69 WebKit failure and Owner-approved harness remediation

The preceding tree correction is **`9585d2e83223506f6ff2b829fa907b4b7c0ad57d`**. [CI #69](https://github.com/yusufarst/elligble/actions/runs/40396289718) (40396289718), push attempt **1**, is terminal **COMPLETED / FAILURE** on that exact SHA. Seven jobs SUCCESS: web (344/344 in 34 files, typecheck/build), runtime/PostgreSQL, container image/smoke, and mobile/tablet/desktop/Firefox (21/21 each). WebKit job 121830591033: **20 PASS, 1 FAILURE**, in the offline-recovery test after its original assertions had completed. Successful before artifacts for the other projects are historical partial evidence, not a full baseline PASS.

Trace facts: offline failed-save/disabled-submit assertions passed; reconnection reached Tersimpan, removed the banner and verified one server answer. The added timer helper completed the warning reload, warning-class assertion and screenshot (`pw:api@53`, `pw:api@64`). The next reload for urgent (`pw:api@67`) crashed after about 16.3 seconds. Cleanup then attempted another page operation, producing Target crashed and masking the original Page crashed exception. Rapid successive reloads after reconnect are a plausible trigger; an engine bug, OOM or CBT defect is NOT proven.

After a read-only assessment, the Owner explicitly approved one bounded WebKit harness fix in exactly four existing paths: `e2e/tests/helpers.ts`, `e2e/tests/2-resilience.spec.ts`, this record and the living plan. This supersedes the prior STOP only for this specific remediation; it is not a retry, new Task, redesign or workflow/dependency authorization.

Implementation contract: remove only the added timer call from the offline test, preserving every original assertion and the offline screenshot. Add one online-only test, using normal login/continueExam and explicit existing takeover UI if requested (no session storage/token copying or database session edits). The new test has a 30-second budget; existing test/config timeouts, workers, five projects and retries=0 remain unchanged. It verifies identical server answers, URL and a unique document marker before/after capture. Expected inventory becomes 22 tests per browser; actual CI counts remain authoritative.

Timer helper: keep 240-second warning and 45-second urgent synthetic fixtures, read the full original timer row, and replace document reloads with the production focus-event listener's actual timer API request. Correlate a newly issued same-origin GET with its response, assert HTTP 200, active/positive timer and matching database startedAt, and verify the rendered countdown and warning/urgent class before the unchanged capture function. The original started_at is restored and the entire returned row must equal the original snapshot. After a capture failure, perform database cleanup only, then throw the same exception; if restoration also fails, AggregateError retains the original as cause. Only a successful capture gets a final focus resync to the restored server timer. No crash is swallowed and no page is reused after failure. Generic reloadPage/replaceDocument and all metadata, baseline-tree, candidate-tree, fixture-hash and before/after guards stay unchanged.

New automatic push CI on the commit carrying this section must be attempt 1, eight SUCCESS on ubuntu-24.04, all tests without skip/retry, and all five workspace PNG/JSON artifacts retrievable and validated against that exact SHA, immutable source tree `73b4d38c74363c8f765446f6a0028899c3b4b89f`, unchanged fixture hash `3a1aa51907bed05ea4687094534e3983f8ffaf52b5752d804aaea7669f9727fb` and before phase. A new material failure means STOP, no automatic further correction. Full baseline PASS directly authorizes resuming the previously approved UI scope without another permission request. No UI implementation has started at this checkpoint. Task remains NOT DONE; PR #8 stays open, MERGE NO.

### 5.4 Baseline exit PASS before UI implementation

Harness correction **`dbe626535d363f02ffc13db0b83d035b24f994c8`**, [CI #70](https://github.com/yusufarst/elligble/actions/runs/40427880516) (40427880516), push attempt **1**, COMPLETED / SUCCESS. All eight job labels verified as ubuntu-24.04: web typecheck/344 tests in 34 files/build; runtime typecheck/unit/real PostgreSQL; image build/smoke; mobile, tablet, desktop, Firefox and WebKit each **22/22 PASS**. The new online timer case verifies unchanged answers/document, real warning/urgent timer responses and exact timer-row restoration. No reruns, skipped tests or local heavy suites.

All five artifacts were downloaded to ELLIGBLE-only scratch `UI-SYSTEM-004/ci-70-before` and checked, not merely listed:

| Artifact | Artifact ID | PNG/JSON pairs |
|---|---|---|
| workspace-visual-desktop-1280 | 12700459464 | 38 |
| workspace-visual-mobile-360 | 12700388384 | 15 |
| workspace-visual-tablet-768 | 12699994454 | 14 |
| workspace-visual-firefox-1280 | 12700242780 | 15 |
| workspace-visual-webkit-390 | 12699934754 | 14 |

**96 pairs**: capture SHA dbe6265 (full above), before classification, immutable base/candidate source tree 73b4d38c (full §5.2), fixture hash 3a1aa519 (full §5.3), browser/version, viewport and matching real PNG verified. All projects have pending/saved/failed/offline/flagged/focus and both timer states. Desktop contains all seven primary viewports plus 320×568, 568×320, 360×480 and 1280×360 stress captures, full-page reading and 200% text-resize/reduced-motion frames. WebKit's existing iPhone 13 profile uses DPR 3 (390 CSS px -> 1170 PNG pixels); other projects use DPR 1. A first external PNG-dimension check used CSS pixels directly and was corrected to verify device pixels against the locked profile; neither screenshots nor harness were changed for this unit correction.

Rendered before evidence confirms a dense all-bold passage with collapsed paragraph breaks, 15px choices, invisible option-label keyboard outline, 40px desktop dock targets and a clipped desktop legend at 200% text emulation. Warning text is RGB 217/119/6 on white. These are baseline observations, not baseline accessibility PASS claims. Actual bundled inventory is the 96 core captures above; supplementary pause/lock/message/Teacher-preview PNG copies intended in §3 were not present in these successful uploads. No paired supplementary visual PASS is claimed. Their real browser functional journeys did pass; the UI candidate must preserve their application markup and all non-Student CSS.

## 6. Bounded presentation candidate and verification history

The Owner explicitly authorized direct continuation after baseline PASS. Current application paths are only StudentExamWorkstation.tsx, ExamMessages.tsx and workstation.css, plus this record and the living plan. No test, workflow, dependency, global token or other-role file changes after the baseline gate.

- Native inputs, labels, accessible names, callbacks, disabled conditions, timer/answer/session/submission/lifecycle code remain unchanged. A reversible source guard removes only the documented presentation edits and recovers the original workstation source exactly.
- Body-large stimulus uses locked 18px/1.5/400 with authored paragraph breaks; its first line remains emphasized. Choices use body 16px/1.5 with wrapping and top-aligned A–E markers; a reserved check slot and stable text weight avoid reflow when selected. Selection remains immediate selection, not an ACK. Focus has the existing 2px primary outline on the visible label.
- Shared Button dock callsites compose canonical 44px minimum at desktop and allow text wrapping; shared Button definition is unchanged. Mengerti/Tutup use its existing default 44px size. No page-local button primitive.
- Warning text/flags and selected borders use existing accessible semantic inks. No new color/font/palette tokens; the existing 80-color ceiling stays unchanged, with no guard weakening. New styles are fenced by `.workstation-container`; existing CSS prefix remains byte-equivalent after line-ending normalization, preserving Teacher preview.
- Existing 640/1024 breakpoints, 1200px assessment cap and 680px reading composition; wrapping legends/actions, restrained flat surfaces and 150ms sheet entry, with existing reduced-motion override. Header/dock refs measure only chrome height via ResizeObserver into two local geometry properties, preventing sticky/sidebar offsets or fixed-dock spacing from assuming a single header height when text/notices wrap. No React exam state is written by this effect. Safe-area insets stay explicit; physical notch-device validation is not claimed.

Lightweight source-isolation, CSS-scope/color-ceiling and TSX syntax/transpile checks PASS (syntax only, not typecheck); full final CI and actual after images remain PENDING on this content candidate's own SHA. Before/after reuse the unchanged fixture, capture helpers and five browser profiles. No material visual PASS, Reviewer PASS, Owner PASS or DONE is claimed before those gates. After content CI/evidence, present the actual pairs for the two required human reviews; do not create the final record-only evidence commit before their approvals.

### 6.1 Rendered refinement of the first presentation candidate

First presentation content **`b412d6c4807016fcc014800e166b80917fa9f058`**, source tree **`093c8a88b30290969911899bac9cdd031a741f39`**, [CI #71](https://github.com/yusufarst/elligble/actions/runs/40430856364) (40430856364), push attempt 1, terminal **COMPLETED / SUCCESS**. All eight jobs on ubuntu-24.04: web 344/344/typecheck/build, runtime/PostgreSQL, image and mobile/tablet/desktop/Firefox/WebKit **22/22 each**. WebKit's installation was allowed to finish; no subsequent push, cancellation or rerun occurred while #71 was active.

All five actual after artifacts were retrieved to `UI-SYSTEM-004/ci-71-after`: **96 PNG/JSON pairs** (desktop 38, mobile 15, tablet 14, Firefox 15, WebKit 14). Comparison against baseline #70 verifies exact browser/version, viewport, fixture, radio accessibility snapshot (names and checked states) and expected immutable baseline tree; candidate SHA/tree and after classification match. All measured document/text overflow checks are clear, targets >=44px, keyboard option-label outline solid 2px; questions 18px/27px, choices 16px/24px, warning RGB 146/64/14 (7.09:1 on white). These are measured subset results and producing-agent visual inspection, not the two required human approvals or a blanket WCAG certification.

Actual renders identified two small in-scope composition refinements: the main grid inherited a 24px gap while the header grid had none, offsetting the desktop reading column by 12px; fieldset gap does not separate its legend, leaving question/choice spacing too tight after removing the old legend margin. This final candidate changes only the Student-scoped desktop grid gap to 0 and legend bottom margin to the existing 24px spacing token, plus the two records. No test, fixture, capture logic, component callback or token changes. This is the authorized iterative visual refinement, not a CI rerun; the resulting new content SHA needs its own complete CI and after evidence. The #71 terminal-success pre-push gate was checked before publication. Final candidate SHA/results must be reported after creation; it cannot embed its own SHA. Task and both human reviews remain pending.

Full-page PNGs preserve the sticky header at the capture's current scroll offset; use the matched viewport images to assess actual on-screen header/dock overlap. No screenshot is retouched or substituted. Emulation, physical-device/screen-reader limits and the absent supplementary paired screenshots remain explicitly qualified above. Task NOT DONE; human reviews and final record-only evidence remain pending.

## 7. Final completion evidence and review approval

**UI-SYSTEM-004 Part 2: DONE (2026-10-27).** PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This completes only the approved Student workspace remediation. It does not mark all UI-SYSTEM-004 or UI-SYSTEM-005 DONE, waive the inaccessible design dependency, authorize another Task or permit a merge. The pending statements in §6 describe earlier candidate checkpoints; this section records their final resolution. Historical CI #68/#69 failures and their evidence remain unchanged.

### 7.1 Final content and exact CI

Final content **`5ba9fb43802b0e81f094295e96d3b725893c5f9d`**, frontend source tree **`bd628231c9f5a00a6a103a89dd3a40cb8bdbba6f`**, [CI #72](https://github.com/yusufarst/elligble/actions/runs/40433037289) (40433037289), automatic push event, attempt **1**, terminal **COMPLETED / SUCCESS**. The run's head SHA and all eight ubuntu-24.04 job results were reverified before the final evidence commit.

| Job | Job ID | Final result |
|---|---|---|
| Web client | 121955067852 | SUCCESS; typecheck, **344/344 web tests in 34 files**, build |
| Runtime | 121955067553 | SUCCESS; typecheck, unit, real PostgreSQL integration |
| Container image | 121955380822 | SUCCESS; build and smoke |
| E2E mobile-360 | 121955380996 | SUCCESS; **22/22** |
| E2E tablet-768 | 121955380946 | SUCCESS; **22/22** |
| E2E desktop-1280 | 121955380910 | SUCCESS; **22/22** |
| E2E firefox-1280 | 121955380833 | SUCCESS; **22/22** |
| E2E webkit-390 | 121955380872 | SUCCESS; **22/22** |

All five existing browser projects retain their assertions; no failed/skipped/retried tests, CI rerun, manual dispatch or test-count reduction. Heavy verification ran on GitHub runners, without local heavy suites, Docker, ports, database or global-process operations. All five content commits, including the final content above, use the configured Owner author/committer identity; their fuller logs and raw software-only messages were inspected without unexpected attribution. No history was rewritten.

### 7.2 Final actual visual evidence

Before: approved harness commit `dbe626535d363f02ffc13db0b83d035b24f994c8`, CI #70, eight SUCCESS before any application styling change. After: final content SHA above, CI #72. All five final artifacts were retrieved to ELLIGBLE-only scratch `UI-SYSTEM-004/ci-72-after` and compared with `UI-SYSTEM-004/ci-70-before`.

| Final after artifact | Artifact ID | Matched before/after screenshot pairs |
|---|---|---|
| workspace-visual-desktop-1280 | 12702937508 | 38 |
| workspace-visual-mobile-360 | 12702203767 | 15 |
| workspace-visual-tablet-768 | 12702208799 | 14 |
| workspace-visual-firefox-1280 | 12702299788 | 15 |
| workspace-visual-webkit-390 | 12702199251 | 14 |

**96 matched visual before/after pairs**: 96 actual PNGs with JSON manifests per phase. Verified exact capture SHA/source tree, immutable baseline reference/tree, before/after classification, browser/version/project, viewport, fixture ID/hash and unchanged radio accessibility names/checked states. Real PNG dimensions account for WebKit DPR 3. Fixture SHA-256 remains **`3a1aa51907bed05ea4687094534e3983f8ffaf52b5752d804aaea7669f9727fb`**; baseline application tree remains **`73b4d38c74363c8f765446f6a0028899c3b4b89f`**.

Rendered evidence covers the seven approved primary widths, four narrow/short/landscape stress sizes, long questions/options, 200% text-resize emulation, reduced motion, native keyboard focus, unanswered/selected/pending/saved/failed/offline/flagged states, confirmation and actual server-calculated warning/urgent timer states. Final measured targets are at least 44×44 CSS px, option-label focus is solid 2px, document/text horizontal-overflow checks are clear, question typography is 18px/27px and choices 16px/24px. Warning ink measures 7.09:1 on white. Actual final images show corrected column alignment and prompt-to-choice separation. Original images are unmasked and unretouched; countdown/timestamps are documented variable fields.

The actual paired review gallery is `UI-SYSTEM-004-REVIEW-5ba9fb4.md` in the same ELLIGBLE-only scratch directory. The supplementary pause/lock/message/Teacher paired-image limitation and viewport/full-page, emulation, physical-device and screen-reader qualifications in §5.4/§6.1 remain explicit. No blanket WCAG certification or absent supplementary screenshot evidence is claimed.

### 7.3 Required human reviews and final publication authorization

The Owner's explicit final-evidence instruction on 2026-10-27 confirms **Independent Second Review: PASS** and **Owner Visual Review: PASS** for final content `5ba9fb43802b0e81f094295e96d3b725893c5f9d`, CI #72 attempt 1 eight SUCCESS, PR #8. These review results are recorded from the Owner's authorization, not self-awarded by the executor. The technical and required human review gates are therefore PASS.

That instruction authorizes exactly one controlled final evidence commit changing **only this Task record**, after verifying branch, expected HEAD, clean entry tree, Owner author/committer identity, exact diff and unchanged application/workflow/fixture/tests. The live plan is intentionally not edited in this final record-only commit. All content outside this file must remain byte-identical to the verified final content parent. The commit's actual SHA is reported after creation rather than embedded in its own contents. Inspect its fuller log and raw message, then normal push to the existing Task branch and [PR #8](https://github.com/yusufarst/elligble/pull/8).

Per 00.12 §5, the evidence commit is verified locally and deterministically; its own automatic CI is not a prerequisite for Part 2 DONE and does not require another evidence commit. No workflow dispatch/rerun, source change, new branch/PR or merge. PR #8 remains for Owner review and squash merge; no next Task is started.


## 8. Part 3 — Teacher Exam Preview Keyboard and Touch Accessibility

| Field | Value |
|---|---|
| Task / classification | UI-SYSTEM-004 Part 3; PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Status | DONE: Part 3 only; final content dcf6f88, CI #77 attempt 1 eight SUCCESS, 68 matched before/after pairs, Independent Second Review PASS and Owner Visual Review PASS on 2026-10-27 |
| Risk | STANDARD, presentation-only; STOP on business semantics or material defect |
| Owner authorization | GRANTED 2026-10-27 for the exact five-file scope and Task-specific CI-first order in this section; push YES, one PR YES, MERGE NO |
| Base / predecessor | main `5f7a018e9e5f95ff14af7b11413ad07b29b1f405`; Part 2 DONE, PR #8 MERGED at that SHA; [main CI #74](https://github.com/yusufarst/elligble/actions/runs/40479321925), attempt 1, eight SUCCESS on ubuntu-24.04 |
| Immutable baseline frontend tree | `bd628231c9f5a00a6a103a89dd3a40cb8bdbba6f` |
| Branch | `task/ui-system-004-teacher-preview-accessibility` |
| Reviews / completion | Independent Second Review PASS and Owner Visual Review PASS confirmed by the Owner on 2026-10-27 ("Visual PASS Part 3"); exactly one final Task-record-only evidence commit authorized; Part 3 DONE, Owner merges |

### 8.1 Objective, exact scope and invariants

Remedy only Teacher Preview's 36px back control, 40px question-number controls and invisible native-radio label focus. Preserve Part 2 DONE and Student source byte-for-byte; do not reopen its scope. Maintain the same locked ELLIGBLE design system, existing shared Button and native input/label contracts. No palette, font, token, shared primitive or global CSS change. This accessibility remediation does not claim new DesainPakeAI alignment or unblock UI-SYSTEM-005.

Exact maximum allowlist (all other paths forbidden):

1. `frontend/web/src/components/TeacherExamPreviewView.tsx`: presentation/classes only for back/question targets, visible >=2px answer-label focus including when keys are shown, and responsive wrapping necessary for those controls. Preserve all callbacks, labels, roles, state and conditions.
2. `frontend/web/src/__tests__/teacherExamPreview.test.tsx`: meaningful preview regression coverage if needed; keep existing tests/assertions. The Owner's formatted tests-path denotes this existing file, not a new folder.
3. `e2e/tests/6-teacher-import.spec.ts`: private Teacher capture/JSON inside this existing spec, actual keyboard/geometry checks and original journey preserved. Do not edit the shared Student capture helper or fixtures.
4. `docs/production/tasks/UI-SYSTEM-004.md`: append Part 3 registration/status/evidence separately; retain Part 2 DONE and historical failures.
5. `docs/production/PRODUCTION_COMPLETION_PLAN.md`: record PR #8/main CI #74 landing and synchronize stale §6/§14 in this Task; keep remaining work separate.

Native radios and browser Tab/arrow behavior, accessible names, question/option order/identity, local selection, key/score opt-in and no-attempt semantics stay unchanged. Existing `expect(attempts).toBe(0)` and every other original spec assertion remain intact. No API/database/runtime, answer persistence, lifecycle, timer, submission, authentication, session/device or tenant/security change. No Student screen, shared CSS/primitives, workflow, dependency, fixture, other role screen or UI-SYSTEM-005 work. No local heavy tests, npm ci, build, Docker, database, ports or global-process/environment operations; preserve all other projects.

### 8.2 Acceptance and evidence

- Back/question-number targets >=44x44 CSS px. Native answer labels show >=2px solid focus outline; correct-key label focus also has >=2px offset, distinguishing focus from the unfocused key outline. Keep the key marker and names visible.
- All loaded Preview controls remain usable without clipping, overlap or horizontal overflow at 360/768/1280 CSS px and 200% per-element text-size emulation. Text-size emulation is not native zoom or physical-device certification. Unrelated shared error-state retry controls are outside this bounded remediation.
- Browser Tab reaches the radio group; ArrowRight selects the next native radio without changing question identity. Key/score remain hidden until requested; local choices do not create an attempt or save answers. Existing complete journey assertions remain unchanged.
- Capture actual production Teacher Preview in all five existing browser projects, at its original viewport plus 360x640, 768x1024 and 1280x800 (deduplicated), both normal/200% text sizes and keys hidden/shown, with keyboard focus. Two scenarios times two text sizes yield 12 pairs for desktop/tablet/Firefox and 16 for mobile/WebKit: **68 screenshot/JSON pairs per phase**. Metadata records capture SHA, HEAD frontend tree, immutable baseline, phase, existing CSV fixture SHA, browser/version, viewport/DPR, scenario, accessibility snapshot and measured geometry/focus. No masks; school timestamps are variable fields.
- Use only the existing workflow's workspace-* PNG/JSON success-upload convention, within current five artifacts. Teacher metadata is distinct from Student Part 2 captures. No workflow or helper edits. Compare identical fixture/browser/scenario metadata before/after; inspect actual images and refine only within scope.
- Preserve all existing tests; no skip, weakened assertion or retry. Actual complete test inventory must be read from the candidate CI, not assumed from the previous 344/22 baseline. Full eight-job CI: web typecheck/unit/build, runtime typecheck/unit/real PostgreSQL, image smoke and all five browser projects on ubuntu-24.04.

### 8.3 Own verification-order and publication contract

1. Verify clean physical main at the approved SHA, Owner author/committer identity, remote main, merged PR #8 and eight main CI #74 jobs. Register Part 3 and synchronize the predecessor landing in the same Task.
2. Baseline changes ONLY this record, the living plan and Teacher E2E spec. Candidate frontend tree must equal bd628231 (full above); the fixture and original assertions must be unchanged. Lightweight syntax/integrity/diff guards only locally. Capture records known baseline geometry/focus defects without falsely declaring them PASS; native behavior and original journey still must PASS.
3. Guarded baseline content commit, normal push, one PR to main. Require that exact SHA's automatic push CI attempt 1 eight SUCCESS and all five success artifacts retrieved/validated, including all 68 Teacher before pairs, BEFORE any UI source edit. STOP on failed verification; no rerun, dispatch or automatic corrective commit.
4. After full baseline PASS, implement only the approved presentation changes and run complete automatic CI on that new content SHA. After-source captures enforce the new geometry/focus/reflow acceptance checks. Inspect all matched before/after evidence and retain actual counts. No local heavy suites or Docker.
5. Present evidence for required human visual reviews. Do not award their PASS. After both approvals and all technical gates PASS, exactly one final evidence commit changes only this Task record; inspect identity/raw message and normal push. Evidence commit's own CI is not a DONE prerequisite (00.12 §5). Owner squash-merges; no new Task is started.

Before each commit: exact expected HEAD/branch/base ancestry, Owner author AND committer name/email, exact allowed staged/working paths, no unknown untracked files, reviewed diff, no secrets/attribution, git diff --cached --check. After: fuller log/raw message; never rewrite history. gh uses only the ELLIGBLE-specific GH_CONFIG_DIR in child-process environment. No force push or destructive cleanup. STOP on unexpected state, scope expansion, failed gate or material semantics/security regression. No vendor/dependency/recurring production cost change; only existing CI/artifact quota, seven-day retention.

## 9. Part 3 execution evidence

### 9.1 Entry and baseline registration

2026-10-27: physical main, local/remote origin/main and HEAD all `5f7a018e9e5f95ff14af7b11413ad07b29b1f405`; CLEAN. Frontend source tree bd628231 (full §8). Configured author/committer Yusuf Arif Setiawan, `134618411+yusufarst@users.noreply.github.com`; gh user yusufarst. PR #8 merged at the approved baseline, CI #74 attempt 1 terminal eight SUCCESS; no open PR at entry. The existing main was already synchronized; only the exact new Owner-authorized Part 3 branch was created. No application implementation started.

Existing purpose-fit engineering skill react-typescript-vite SHA-256 450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558 and responsive skill frontend-responsive-ui SHA-256 d72a56fa99d64b54c9af01037802006ebe9e1c711f4cfc75a2fb0f34a2904ec1 are verified against the canonical inventory. No installation/dependency change.

The E2E addition preserves original CSV strings and assertions. It captures actual Teacher state, exercises native keyboard selection and reveals keys only through the existing checkbox. Per-element style and viewport restoration preserve any primary error; crashes are not swallowed. Baseline/after source comparison uses immutable tree literals and current HEAD, avoiding the earlier shallow-checkout failure. The baseline commit cannot contain its own SHA; its actual commit/PR/CI and downloaded artifact results will be recorded at the next authorized checkpoint. Baseline gate PENDING; Part 3 NOT DONE.


### 9.2 Baseline exit PASS before UI implementation

Baseline content **`1d2fcea8961ef1e19c920e6fff0601ae5d5f7951`**, [PR #9](https://github.com/yusufarst/elligble/pull/9), [CI #75](https://github.com/yusufarst/elligble/actions/runs/40482951720) (40482951720), automatic push attempt **1**, terminal **COMPLETED / SUCCESS**. All eight jobs on ubuntu-24.04 SUCCESS: web typecheck/**344/344 tests in 34 files**/build (122117568816); runtime typecheck/unit/real PostgreSQL (122117569232); container build/smoke (122117915143); mobile (122117915190), tablet (122117915368), desktop (122117915281), Firefox (122117915374) and WebKit (122117915238) each **22/22 PASS**. The desktop browser installation took longer; the original run was allowed to complete without cancellation, rerun or further push. No skipped tests/retries or heavy local suites.

All five actual successful artifacts were retrieved to ELLIGBLE-only scratch `UI-SYSTEM-004-PART3/ci-75-before` and inspected/validated before any application edit:

| Artifact | ID | Teacher PNG/JSON pairs |
|---|---|---|
| workspace-visual-desktop-1280 | 12724033080 | 12 |
| workspace-visual-mobile-360 | 12724330285 | 16 |
| workspace-visual-tablet-768 | 12723583410 | 12 |
| workspace-visual-firefox-1280 | 12724310507 | 12 |
| workspace-visual-webkit-390 | 12724271384 | 16 |

**68 before pairs**, in addition to the existing Student captures, all labeled UI-SYSTEM-004 Part 3 / before, exact baseline commit and source tree `bd628231c9f5a00a6a103a89dd3a40cb8bdbba6f`. Existing Teacher CSV SHA-256 **`11d4920fd5bed0eab02db6884f0437e498c2202cd090bdea6432dc7abdbd1c71`** is unchanged. Browser versions: Chromium 141.0.7390.37, Firefox 142.0.1, WebKit 26.0. Native viewport plus all three primary sizes, hidden/shown keys and normal/200% text sizes are present; real PNG dimensions account for recorded device scale and baseline horizontal overflow. PNG/JSON identity, fixture, phase, keyboard selection and radio accessibility snapshots verified. The original no-attempt assertion still PASS.

Actual normal/mobile images and DOM metrics confirm 36px back and 40px question-number targets; the focused non-key answer label has no outline, while a correct-key label retains its existing 2px outline with 0px offset. At 360px/200% text size, measured horizontal overflow is **109px** with back/next text outside the viewport across all five engines/projects. These are baseline defects, not failed baseline journey assertions or a false accessibility PASS. Full-page images can place sticky shared chrome at the capture's current scroll offset; this rendering limitation is recorded, no image is edited or substituted and no claim of physical-device/native-zoom certification is made.

### 9.3 Bounded presentation candidate

Only after the entire §9.2 gate PASS, TeacherExamPreviewView.tsx receives class-only edits:

- Existing shared back Button keeps its ghost/small typography and callback, but uses auto height, canonical 44px minimum, bounded width and wrapping.
- Existing question-number buttons use canonical 44px minimum height/width, preserving numbers, aria-current, accessible names and handlers.
- Native-radio labels gain the existing 2px focus outline/ring with 2px offset through focus-within. The key's existing marker/outline stays intact; focusing the correct key adds offset and focusing a different answer remains independently visible. No JavaScript focus behavior is changed.
- Existing previous/next shared Buttons allow text wrapping/auto height with 44px minimum, and their row wraps when text is enlarged. This directly addresses the observed 200% overflow. Disabled conditions and navigation callbacks are unchanged.

A reversible source guard must recover the entire original component by removing only those exact presentation strings. The inherited Student source, shared CSS/primitives, tokens, workflow, fixture, helper, types, hooks and runtime remain unchanged. No additional unit tests merely mirror class strings: existing preview semantic tests remain intact and the approved E2E checks exercise actual native keyboard behavior, painted focus and target/reflow geometry. Syntax/transpile-only and exact-diff guards are local checks; they do not claim typecheck or rendered PASS.

The new content commit's own automatic attempt-1 CI, complete actual test counts and all 68 matched after pairs are PENDING. Do not reuse baseline or another SHA's PASS. Inspect actual after images for material defects, then present paired evidence for the required Independent Second Reviewer and Owner approvals. Part 3 remains VERIFYING / NOT DONE; no final evidence commit before those approvals, no merge and no next Task.


### 9.4 CI #76 failure, read-only assessment and targeted corrective authorization

UI content **`d1ac5da16b9c2e44c1efe14416cc5ac35d14796c`**, frontend source tree **`042bd29f7fba6cff4b05c7be67544a602b7664c3`**, [CI #76](https://github.com/yusufarst/elligble/actions/runs/40485141852) (40485141852), push attempt **1**, terminal **COMPLETED / FAILURE**. Web job 122124934679: npm ci/typecheck SUCCESS, **343 PASS / 1 FAIL across 34 files**; build SKIPPED after the unit failure. Runtime/PostgreSQL job 122124935081 SUCCESS; browser matrix and image dependency jobs SKIPPED, so no final after evidence or eight-job PASS exists for #76. The failed case is participantTime.test.tsx, “says it on the paused screen too, next to the frozen time”, original line 301: missing exact 3-minute notification. Log SHA-256: `3849dd38b7958adda7ccb743b19ed31ee73b1b732a783597f5d83d8f8ba79e53`. The failure remains historical evidence; it is not reclassified or rerun.

The Owner authorized a read-only targeted assessment, then explicitly authorized **one** corrective commit on the existing branch/PR #9. This amends §8.1 only by adding the existing `frontend/web/src/__tests__/participantTime.test.tsx` for synchronization of this single paused testcase. The exact correction allowlist is that test plus this record and the living plan. No other original Task path may change in this correction. Student production behavior, Teacher UI content, E2E captures, baseline #75, original fixture, workflows and dependencies remain unchanged. No additional correction, baseline restart, skip/retry/sleep, timeout increase or CI #76 rerun/dispatch is authorized.

Assessment evidence: all relevant Student/test/timer/time-added/answer-manager/config/lockfile Git blobs are identical between #75 PASS and #76 FAILURE. The failure DOM shows **42:10**, the initial remaining time, not the expected **45:10**: the fresh added-time response was not applied, rather than only the notification being suppressed. The paused timer hook deliberately disables ticking/resync; the separate visible-state checker subscribes in an effect and otherwise polls after about 4–6 seconds. The old test waits only for a heading, dispatches online immediately inside act and waits about one second for its message. An initialization/listener-readiness race is the strongest supported explanation; #76 has no per-request/listener trace proving the exact interleaving. Shared map/storage are cleared before the test, and deduplication alone would not keep the remaining time at 42:10. No new production defect or causal link to Teacher styling is proven.

The approved test-only correction: await async act around initial render; retain the original heading assertion and additionally await the existing ready/answers-saved UI, assert visible-document precondition, snapshot existing timer-request count, mutate only the original synthetic added=180 state, dispatch the original online helper **once**, and assert exactly one new timer request before the unchanged 3-minute notice and **45:10** assertions. No production timer mock, data fixture change, direct API invocation or assertion weakening. The extra request assertion exposes a missing state check rather than accepting a coincidental heading. Only this testcase body changes; all other tests/helpers/assertions remain intact, inventory remains 344 tests.

Entry was reverified CLEAN on exact d1ac5da (full above), expected branch/PR #9, Owner configured author/committer and gh user yusufarst, #76 terminal failure. Review exact three-file diff; perform lightweight syntax/assertion/source-isolation guards only. The corrective commit cannot embed its own SHA; report it after creation and record final results at the next authorized evidence checkpoint. Normal push only after guards PASS. Require that exact new SHA's automatic attempt-1 CI **eight SUCCESS**, complete tests and all five retrieved after artifacts matching the original 68 baseline Teacher pairs. On any further failed verification or different material root cause: STOP, no automatic further corrective commit or retry. If technical gates PASS, present actual paired evidence for required human reviews, then one Task-record-only final evidence commit after approvals. Part 3 remains NOT DONE; Part 2 remains DONE; MERGE NO.


### 9.5 Final Part 3 completion, verification and review approval

**UI-SYSTEM-004 Part 3: DONE (2026-10-27).** PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This section resolves the earlier pending checkpoint statements in §9.1–§9.4 without erasing their history. Part 1 remains completed (`3cfefc4`); Part 2 remains DONE/merged as `5f7a018e9e5f95ff14af7b11413ad07b29b1f405`, PR #8/main CI #74. Other unfinished UI-SYSTEM-004 scope is not marked DONE, and **UI-SYSTEM-005 remains BLOCKED** on its documented dependency.

Final content and Owner-authorized correction: **`dcf6f88e5a34738b12f2f7dfd21b1559b8f790d0`**, frontend source tree **`a39d5a05aab6a81755b899cd0fd9dd007d383dad`** (includes the authorized test correction). [CI #77](https://github.com/yusufarst/elligble/actions/runs/40487676185), run ID 40487676185, automatic push attempt **1**, exact final content SHA, terminal **COMPLETED / SUCCESS**, all **eight jobs on ubuntu-24.04 SUCCESS**. Exact remote branch/PR head, CI SHA/attempt and job results were reverified before this evidence commit.

| Final CI job | Job ID | Result |
|---|---|---|
| Web client | 122133457753 | SUCCESS: typecheck, **344/344 tests in 34 files**, build; all nine participantTime cases PASS |
| Runtime | 122133457526 | SUCCESS: typecheck, unit, real PostgreSQL integration |
| Container image | 122133863044 | SUCCESS: build and smoke |
| E2E mobile-360 | 122133863206 | SUCCESS: **22/22** |
| E2E tablet-768 | 122133863168 | SUCCESS: **22/22** |
| E2E desktop-1280 | 122133863222 | SUCCESS: **22/22** |
| E2E firefox-1280 | 122133863459 | SUCCESS: **22/22** |
| E2E webkit-390 | 122133863108 | SUCCESS: **22/22** |

Final web log SHA-256: `7ae4cc6b12bd0c7af3607ffb9e67566471d549dc9c9c43fcafa58876f868c8ea`. Final tests were not skipped, retried or weakened. Heavy verification used GitHub runners; no heavy local tests or Docker/global-resource operations. Baseline **CI #75**, content `1d2fcea8961ef1e19c920e6fff0601ae5d5f7951`, remains the eight-job PASS before any UI edit (§9.2); it was not repeated. Historical **CI #76 FAILURE** on `d1ac5da16b9c2e44c1efe14416cc5ac35d14796c` remains intact (§9.4): 343 PASS/1 FAIL, remaining downstream jobs skipped as recorded. The Owner approved only the paused-test synchronization correction plus two records; #76 was not rerun. The correction leaves all production code and E2E/fixture/workflow content identical to d1ac5da, keeps the original 3-minute/45:10 assertions, and proves one fresh timer request after the single online event. The passing correction supports the readiness assessment; it does not retrospectively prove an unlogged #76 scheduling interleaving or a production timer defect.

All five final after artifacts were retrieved to ELLIGBLE-only scratch `UI-SYSTEM-004-PART3/ci-77-after`, compared against preserved `ci-75-before`, and **all 68 matched before/after visual pairs** validated. Each phase has 68 actual PNGs with matching JSON manifests:

| Project | Baseline #75 artifact ID | Final #77 artifact ID | Matched pairs |
|---|---|---|---|
| desktop-1280 | 12724033080 | 12725688397 | 12 |
| mobile-360 | 12724330285 | 12726635129 | 16 |
| tablet-768 | 12723583410 | 12725568792 | 12 |
| firefox-1280 | 12724310507 | 12726725038 | 12 |
| webkit-390 | 12724271384 | 12726311011 | 16 |

Exact capture SHA/source tree, immutable baseline reference/tree, before/after phase, browser/version/project, viewport/DPR, scenario, fixture and unchanged accessible radio names/checked states were verified. Teacher CSV SHA-256 remains **`11d4920fd5bed0eab02db6884f0437e498c2202cd090bdea6432dc7abdbd1c71`**. Coverage: 360/768/1280 CSS px in all five projects plus native viewport where distinct, normal/200% per-element text-size emulation, keys hidden/shown and native keyboard focus. Final measured target sizes are at least **44x44 CSS px**, non-key and correct-key answer focus is solid **2px with 2px offset**, and all measured clipping/Preview-target overlap/horizontal-overflow checks PASS. Baseline 109px horizontal overflow at 360px/200% becomes **0px**. Native Tab/arrow selection, opt-in key/score and the original `attempts === 0` assertion PASS in the complete browser journey.

Actual paired images, manifests and complete 68-pair index were presented in `UI-SYSTEM-004-PART3-REVIEW-dcf6f88.md` in the same Task-only scratch directory. Existing qualifications remain: full-page capture can place sticky shared chrome at its scroll offset and obscure header/context or key-toggle regions; the overlap measurement covers Preview controls, not every shared-chrome position. These are unmasked, unretouched captures; timestamps vary. No physical-device, native-browser-zoom, screen-reader or blanket WCAG certification is claimed, and not every visual concern is declared fixed.

The Owner's explicit final-evidence authorization on **2026-10-27** confirms **Independent Second Review: PASS** and **Owner Visual Review: PASS**, including the statement **"Visual PASS Part 3"**, for final content dcf6f88 (full above), CI #77 attempt 1, the 68 matched pairs and open PR #9. These are Owner-confirmed human review results, not self-awarded approvals. Both required review gates and all final content verification gates are PASS.

Publication: exactly **one** final evidence commit changes **only this Task record**. The live plan is intentionally not edited in this record-only commit. Pre-commit guards verify expected branch/parent, Owner author/committer identity, exact reviewed diff, no unknown work/secrets/attribution and unchanged content outside this record; local deterministic diff/evidence guards only. The three preceding content commits' fuller logs/raw software-only messages were inspected under Owner identity. Inspect the evidence commit's own fuller log/raw message after creation, report its actual SHA outside its own contents, and normal push to the same branch/[PR #9](https://github.com/yusufarst/elligble/pull/9). Per 00.12 §5, its own automatic CI is not a DONE prerequisite and does not require another evidence commit. No new PR, history rewrite, force push, merge or next Task.

### 9.6 Owner-approved production prioritization — 2026-10-27

The Owner prioritizes accelerating **CBT-R1 toward production**. Further visual polish, redesign and cosmetic sticky-header work that does not interfere with function or minimum accessibility is deferred to an appropriate later stage or post-production. This is an **Owner-approved prioritization/deferment**, not a claim that every visual issue, sticky-header concern or unfinished UI-SYSTEM-004 item has been fixed, and not a design supersession or authorization to expand scope/create another visual Task.

After Part 3 completion and **Owner merge of PR #9**, subsequent Task selection must follow the canonical repository's production critical path: CBT functionality, security, reliability, release blockers, deployment and UAT. Every security, answer-integrity and production-readiness gate remains mandatory; material functional/accessibility defects are not waived by cosmetic deferment. UI-SYSTEM-005 retains its BLOCKED dependency. The next Task records the landing SHA/checkpoint under 00.12 and still requires its own Owner authorization by ID. This evidence action starts no new Task and changes no design.
