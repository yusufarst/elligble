# UI-SYSTEM-002 Part 2 — Exam Action Dock and Question List on the Shared Button; One Page Frame and Title

> **PRE-P11 / PRE-BASELINE TASK. NOT COUNTED IN P11 BASELINE.** A READY item carried into the baseline (00.12 §10), prioritized by the Owner on 2026-10-26 ("PRIORITAS CODING CBT-R1") under the DEC-045 transition rule. Part 1 (`71392ce`, CI run 47) predates DEC-045 and is recorded in living plan §6.2 and §11. This file is both the contract and the durable Task record. The original package remains unchanged. The Owner-authorized companion recovery gate records the CI recovery amendment and corrects verification claims before the content commit, then fills §1, §5 and the status history in the evidence commit.

## 1. Task record

| Field | Value |
|---|---|
| Task ID | UI-SYSTEM-002 (part 2) |
| Classification | PRE-P11 / PRE-BASELINE TASK; NOT COUNTED IN P11 BASELINE |
| Risk class | STANDARD (00.12 §5: presentation only. No change to answer state, saving, the timer, submission, session or device control, the API or the data: every handler, disabled condition, accessible name and focus return in the exam workspace is carried unchanged, which the diff shows and the full browser journey in five engines checks) |
| Status | VERIFYING |
| Contract | v0.1 with the Owner-approved CI recovery amendment (§2.5, recorded 2026-10-27); original contract prepared 2026-10-26 by the planning agent (Claude Project chat) on `main` at `c3eead5`, as the package `UI-SYSTEM-002.sh` (this record, the code change and the living-plan update, with the script that applies, verifies, commits and pushes them) |
| Owner decisions | 2026-10-26: UI-SYSTEM-002 part 2 first, as a pre-baseline Task (DEC-045); targeted verification; real application code as the Task's result |
| Contract approval | YES (Owner, 2026-10-26; package SHA-256 7616ff33e221b1c6431ecafd3c8049244fa304381ba090c47f42b3bb125eea42, LF-normalized) |
| Execution authorization | 2026-10-26: base c3eead59049d7362f53671ee7d32cecea66ef809; push yes; pull request yes |
| Base commit | c3eead59049d7362f53671ee7d32cecea66ef809 |
| Branch | `task/ui-system-002-dock-question-list-page` |
| Executor | Codex Desktop on C:\Projects\ELLIGBLE; Owner-authorized takeover from Claude Code Desktop |
| Pull request / CI | PENDING |
| Independent review | NOT REQUIRED (risk class STANDARD, 00.12 §5); the Owner reviews the pull request before the squash merge |

### Status history

| Date | Status | Note |
|---|---|---|
| 2026-10-26 | TODO | contract v0.1 prepared; waiting for the Owner's approval of the package and the execution authorization |
| 2026-10-26 | READY | the Owner approved the package (SHA-256 7616ff33e221b1c6431ecafd3c8049244fa304381ba090c47f42b3bb125eea42) and authorized UI-SYSTEM-002 part 2 on base c3eead59049d7362f53671ee7d32cecea66ef809: push yes, pull request yes |
| 2026-10-26 | VERIFYING | original apply staged the approved payload; npm ci and typecheck completed, but Vitest stopped on VirtualAlloc failure / ERR_IPC_CHANNEL_CLOSED and build was not reached; the original prefilled local-PASS claim is corrected by §2.5 |
| 2026-10-27 | VERIFYING | Owner-approved takeover and CI recovery: preserve application payload; no repeated local installation, typecheck, tests or build; guarded content commit before heavy checks is authorized; DONE waits for full content-commit CI |

## 2. Contract

**OBJECTIVE:** finish UI-SYSTEM-002 (living plan §6.2; UI consistency audit C2 and C3; §10.1.2, §10.1.5, §10.1.7, §10.1.9): the exam focus shell has no button of its own, both question lists draw the same question number button, and every screen of the role shell uses one page frame, three documented widths and one page title.

**READY GATE (00.12 §5):** dependencies DONE (part 1 `71392ce`; UI-SYSTEM-003 DONE; `main` green, CI run 64 on `c3eead5`); scope bounded (§2.1); acceptance and tests defined (§2.3); database, route and API impact NONE; localization: no user-facing text changes except the browser tab title; cost NONE; tools available (Node.js 24, npm, gh). DesainPakeAI is not used: the change converges onto the existing shared primitives and tokens only (UI-SYSTEM-005 stays BLOCKED).

### 2.1 Change set (against `c3eead5`)

| Area | Change |
|---|---|
| `components/ui/button.tsx` | documented `dock` size: below 1024 px a 44 px tile with the icon over a short label, from 1024 px an inline button with its full label |
| `components/ui/page.tsx` (new) | `Page` (one frame: padding, section spacing, widths `narrow` 540, `focused` 720, `standard` 960 px), `PageHeader` (title, lines under it, actions beside it from 640 px) and `PageTitle` (the level-one heading, also the browser tab title "<title> · ELLIGBLE", WCAG 2.4.2) |
| `components/QuestionNumberButton.tsx` (new) | one question number button for the side panel and the "Daftar Soal" sheet: 44 px, current (heavier border and a dot), answered (check mark), sending or refused (exclamation mark), "Ragu-ragu" (corner); the same accessible name as before |
| `StudentExamWorkstation.tsx`, `QuestionNavigatorSheet.tsx`, `ExamMessages.tsx` | the dock, the sheet's close (28 px → 44 px) and "Selesaikan Ujian" buttons, "Mengerti" and "Tutup" on the shared Button; both question lists on `QuestionNumberButton` |
| `AssignedExamDiscovery.tsx` (focused), `TeacherReadinessView.tsx`, `ProctorMonitoringView.tsx` (standard; were 800 and 1200 px), the four detail screens, `page-state.tsx`, `App.tsx` (narrow) | `Page` and `PageHeader` instead of page-local frames and titles |
| styles | page-local button, frame and title styles removed from `workstation.css` and `teacher-readiness.css`; `assigned-exam-discovery.css` and `proctor-monitoring.css` deleted |
| tests | `pageFrame.test.tsx` (new, 8 tests); the design system guard refuses page-local button styles, a raw `<button>` in the exam focus shell and a screen's own frame or width, and its hard-coded color ceiling for `workstation.css` goes from 147 to 80; the sheet tests query by role and state instead of removed class names |
| `docs/production/PRODUCTION_COMPLETION_PLAN.md` | §6.1, §6.2, §11 evidence block, §14 checkpoint |

The script refuses to run unless every modified or deleted path is at its blob of `c3eead5` and every new path is absent, and stops unless exactly the 24 paths of the package are staged.

### 2.2 Out of scope

The remainder of UI-SYSTEM-004 (touch targets and focus states elsewhere: the role shell's tabs, sign-in, preview choices), UI-SYSTEM-005 (tokens, the exam workspace palette), any change to the exam's behavior, the server, the E2E suite or the workflow.

### 2.3 Acceptance criteria

- **AC-01** The content commit changes exactly the 24 paths against `c3eead5`; the evidence commit changes only this record.
- **AC-02 (Owner-amended, §2.5)** Preserve the original local Node.js 24 npm ci and typecheck PASS. Local Vitest did not PASS (OOM); local build was not reached. The guarded content commit may precede heavy verification. Its existing GitHub Actions workflow must pass web typecheck, exactly 344 tests with none failed/skipped, and build, before DONE. No local heavy checks are rerun.
- **AC-03** Full CI of the content commit (attempt 1, push): all eight jobs success on `ubuntu-24.04`; the five browser projects run the whole exam journey (21 tests each) against the changed screens.
- **AC-04** Both commits carry the Owner's identity as author and committer and exactly the subject the script gives, no trailer, no AI or tool attribution; normal pushes only.
- **AC-05** The GOV-REALIGN-002 landing (`c3eead5`) is re-verified from Git and the GitHub API and recorded in §5.1.

### 2.4 Stops

The original apply-mode stops remain historical. For the Owner-approved in-place recovery, STOP on any mismatch in package hashes, preserved 24-path payload, allowed document amendments, branch/base, identity, landing facts, attribution, remote push or PR checks. CI must be the content commit's push run, attempt 1; every one of eight jobs must succeed on ubuntu-24.04, with the exact web count and full browser journeys. A failure is reported without a rerun, weakened test, cleanup or history rewrite.

### 2.5 Owner-approved CI recovery amendment (recorded 2026-10-27)

The Owner explicitly authorized replacing the local 344-test and build requirements with full GitHub Actions verification on the same content commit. This supersedes original AC-02's local-test/build-before-commit requirement and the original script-only apply/evidence procedure, solely for this recovery. It also supersedes the earlier recovery proposal's 2 GiB local-test gate because no heavy checks run on the laptop. Push YES; pull request YES; merge NO.

- Use the existing branch, HEAD c3eead59049d7362f53671ee7d32cecea66ef809, and approved 24 staged paths; never rerun original apply. All application, style and test payload bytes remain exactly those of package SHA-256 7616ff33e221b1c6431ecafd3c8049244fa304381ba090c47f42b3bb125eea42. Only this Task record and the living plan's unsupported verification claims receive deterministic recovery corrections, within their existing approved paths.
- Original npm ci and typecheck PASS are reused from the preserved log (SHA-256 0e2c8cb70ff8902497ad9a3818e2bd4b0a2975a6551af332c5e91b74d0ac1ce9). Vitest stopped at VirtualAlloc failed / ERR_IPC_CHANNEL_CLOSED; 344 local tests did not PASS and build was not reached. Later memory checks were below 2 GiB. No local installation, typecheck, Vitest, build, server, Docker or database operations occur during CI recovery.
- Verify the companion gate before Git mutations. It verifies all original and amended blobs, scope, Git identity, branch/base, package hashes, landing facts, normal-push access and PR invariants; it then records this amendment, commits, normally pushes and opens one PR. All gh commands use the ELLIGBLE-only GH_CONFIG_DIR at $HOME/ELLIGBLE-evidence/gh-config. No shared configuration changes.
- Verification location changes only: the unmodified workflow must run automatically from the content push, attempt 1, all eight jobs SUCCESS on ubuntu-24.04. Required: web typecheck, exactly 344 tests PASS, build, runtime/unit/real-PostgreSQL checks, image smoke, and 21 tests in each of five browser projects. No CI rerun or workflow dispatch.
- Only after those gates PASS, one evidence commit changes only this Task record, records actual content-commit CI results and recovery provenance, and is normally pushed. Its own CI is not a DONE prerequisite (00.12 §5). The Owner reviews and squash-merges; no other Task starts.

Companion artifact: UI-SYSTEM-002-ci-recovery.cjs, SHA-256 fdd0d716ef8f1e09511659f45d239392817d6c0fe0554220799c10e9444ef5f5, in ELLIGBLE-only scratch. Original package and original logs remain unchanged.

## 3. Execution

```text
node <companion> audit       # read-only checkpoint, payload, identity and landing gates; previews
node <companion> prepare     # deterministic recovery documentation corrections, stage only those two docs
node <companion> publish     # guarded content commit, normal push, one PR
node <companion> inspect RUN # read-only CI inspection; WAITING while incomplete; STOP on failure
node <companion> evidence RUN # only after all required content-commit CI passes; one-record evidence commit, push; STOP
```

The Owner reviews pull request `<PR>` and squash-merges it; the next Task records the landing commit.

## 4. First response of the executor (AICWDF §38)

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: UI-SYSTEM-002 part 2 (PRE-P11 / PRE-BASELINE, not counted in P11 baseline)
TASK STATUS: READY / NOT READY
DEPENDENCIES: package SHA-256 matches the Owner's: yes / no; main at c3eead5: yes / no; expected 24-path working change verified: yes / no (Owner-approved recovery, §2.5)
AUTHORIZATION AS GIVEN BY THE OWNER: push yes / no; pull request yes / no
TOOLCHAIN: git, Git Bash, Node.js 24, npm, gh (authenticated as yusufarst): available / missing
RISK CLASS: STANDARD
DATABASE IMPACT: NONE
COST IMPACT: NONE (GitHub Actions minutes only)
ROUTE / INTERACTION IMPACT: none (same handlers, routes and accessible names)
UI / NAVIGATION / LOCALIZATION IMPACT: exam dock and question lists on shared primitives; page widths 540/720/960; browser tab title per screen
SAFE TO IMPLEMENT: YES / NO
IF NO, BLOCKER: ...
```

## 5. Completion evidence (written by the script in the evidence commit)

PENDING.

## 6. Review

NOT REQUIRED (risk class STANDARD). If the Owner requests one, its reviewer, date, scope and result are recorded here.

## 7. Safe next Task

After the squash merge: the next Task the Owner authorizes by ID records this Task's landing commit. Planned: the P11 baseline package (P1 CBT release definition, compact P2 specifications, `TASK_PLAN.md`), or the remainder of UI-SYSTEM-004.
