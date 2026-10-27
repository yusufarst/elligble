# UI-SYSTEM-004 Part 2 — Student Exam Workspace, Reading and Responsive Accessibility

> PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This record covers Part 2 only. It does not complete the rest of UI-SYSTEM-004 or unblock UI-SYSTEM-005.

## 1. Contract and authority

| Field | Value |
|---|---|
| Status | VERIFYING: baseline #70 PASS; first presentation #71 eight SUCCESS; final spacing/alignment candidate and required human reviews pending |
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

Baseline commit `2097232268d8d26cd90e861ef52ebfa2bb0ee1c2`: CI #68 FAILED; tree correction `9585d2e83223506f6ff2b829fa907b4b7c0ad57d`: CI #69 FAILED in WebKit. Owner-approved harness correction **`dbe626535d363f02ffc13db0b83d035b24f994c8`**, CI #70, now has baseline exit **PASS**, with all eight jobs SUCCESS and five retrieved/validated visual artifacts. Historical failures remain below. Bounded UI presentation was started only after that full gate. Final content SHA/CI: PENDING. Independent Second Reviewer: PENDING. Actual Owner visual review: PENDING. Final evidence commit: NOT AUTHORIZED UNTIL THOSE GATES PASS. Part 2 is NOT DONE.

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

## 6. Bounded presentation candidate and pending final verification

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
