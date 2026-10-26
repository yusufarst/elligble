# UI-SYSTEM-004 Part 2 — Student Exam Workspace, Reading and Responsive Accessibility

> PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This record covers Part 2 only. It does not complete the rest of UI-SYSTEM-004 or unblock UI-SYSTEM-005.

## 1. Contract and authority

| Field | Value |
|---|---|
| Status | IN_PROGRESS: baseline evidence preparation; no application change yet |
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

Baseline commit/CI/artifact retrieval: PENDING. Application remediation: NOT STARTED. Final content SHA/CI: PENDING. Independent Second Reviewer: PENDING. Actual Owner visual review: PENDING. Final evidence commit: NOT AUTHORIZED UNTIL THOSE GATES PASS. Part 2 is not DONE.

### 5.1 Lightweight baseline preconditions

Fixture gate PASS using the application's actual `parseQuestionFile` under Node.js (no server/database/test suite): three questions, original first two rows unchanged, third prompt 766 characters, option lengths 181/180/1/183/159, C exactly `9`, correct index 2, score 1, zero parser problems. Normalized source comparison proves that only the third CSV string changed in global setup. Every pre-existing assertion line in the two touched specs is retained; `5-lifecycle.spec.ts` and application source remain unchanged. Node syntax checks on the four touched TS files and `git diff --check` PASS. Full TypeScript and execution verification remain CI gates, not inferred from syntax.

Workflow validation: actionlint is unavailable on this workstation; do not install a dependency for this Task. Exact diff review and a guard removing the one approved success-upload block must reproduce the original workflow byte-for-byte after line-ending normalization. It adds only PNG/JSON workspace artifacts with success condition, missing-files error and seven-day retention; the original failure artifacts remain. GitHub's automatic workflow acceptance/execution is still required.

Engineering skill selected/verified: existing `react-typescript-vite` (SHA-256 `450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558`); canonical skill-stack roles and locked repository authority take precedence. No package installed during this Task.
