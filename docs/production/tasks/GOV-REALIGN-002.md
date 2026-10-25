# GOV-REALIGN-002 — Execution Context, Toolchain Record and Landing Records

> **PRE-P11 / PRE-BASELINE TASK. NOT COUNTED IN P11 BASELINE.** Completes P0 of the AICWDF mapping (00.12 §3): `docs/production/EXECUTION_CONTEXT.md` and `docs/production/TOOLCHAIN.md`, and the landing records GOV-REALIGN-001 §5.5 and E2E-002 §5.6. Documentation only. This file is both the contract and the durable Task record. The executor never edits it by hand: the package script `GOV-REALIGN-002.sh` writes it in the content commit and fills §1, §5 and the status history in the evidence commit.

## 1. Task record

| Field | Value |
|---|---|
| Task ID | GOV-REALIGN-002 |
| Classification | PRE-P11 / PRE-BASELINE TASK; NOT COUNTED IN P11 BASELINE |
| Risk class | STANDARD (00.12 §5: documentation only; no product, test, workflow, dependency or data change; no governance authority change: AGENTS.md, READ_ME_FIRST.md, 00.01 to 00.12 and the decision log are not touched, and EXECUTION_CONTEXT.md is non-canonical, every rule in it a pointer to its authority) |
| Status | DONE |
| Contract | v0.1, prepared 2026-10-25 by the planning agent (Claude Project chat) on `main` at `2cf2f21`, as the package `GOV-REALIGN-002.sh` (this record, the two new documents and the four record edits, with the script that applies and verifies them) |
| Owner decisions | 2026-10-25: "LANJUTKAN PEMBANGUNAN APLIKASI": GOV-REALIGN-002 minimal, then the P11 baseline, then CBT-R1 feature work; nothing that already passed is repeated |
| Contract approval | YES (Owner, 2026-10-25; package SHA-256 8fd517cb7063dd3c33dc3e4b86c277009fcca027d0d0b0d5003dfde4f996bd8f, LF-normalized) |
| Execution authorization | 2026-10-25: base 2cf2f2136b617b009e6ed4c1ac670e9b3776b968; push yes; pull request yes |
| Base commit | 2cf2f2136b617b009e6ed4c1ac670e9b3776b968 |
| Branch | `task/gov-realign-002-execution-context` |
| Executor | Claude Code Desktop on C:\Projects\ELLIGBLE |
| Pull request / CI | pull request #6 (https://github.com/yusufarst/elligble/pull/6); content commit `1cf346e2610fdb5940946accf09276c77b36b403`: CI run 40217721568 attempt 1 (push), all eight jobs success on ubuntu-24.04 (§5.2) |
| Independent review | NOT REQUIRED (risk class STANDARD, 00.12 §5); the Owner reviews the pull request before the squash merge |

### Status history

| Date | Status | Note |
|---|---|---|
| 2026-10-25 | TODO | contract v0.1 prepared; waiting for the Owner's approval of the package and the execution authorization |
| 2026-10-25 | READY | the Owner approved the package (SHA-256 8fd517cb7063dd3c33dc3e4b86c277009fcca027d0d0b0d5003dfde4f996bd8f) and authorized GOV-REALIGN-002 on base 2cf2f2136b617b009e6ed4c1ac670e9b3776b968: push yes, pull request yes |
| 2026-10-26 | VERIFYING | content commit prepared by `GOV-REALIGN-002.sh apply`; waiting for its full CI |
| 2026-10-26 | DONE | full CI of the content commit green (run 40217721568 attempt 1, all eight jobs on ubuntu-24.04); landing facts re-verified (§5.1); this evidence commit records it |

## 2. Contract

**OBJECTIVE:** a new agent with no chat history finds, from the repository alone, the executor read path and the rules that stop work (EXECUTION_CONTEXT.md), the verified toolchain with the CI runner pin (TOOLCHAIN.md, decision D-R3 of E2E-003), the landing commits of GOV-REALIGN-001 and E2E-002, and a living-plan checkpoint that matches `main`.

**DEPENDS ON:** E2E-002 DONE and landed (`2cf2f21`, CI run 61 green); the Owner's package approval and authorization. **BLOCKS:** the P1 release definition, the P11 baseline. **PARALLEL SAFE:** NO.

### 2.1 Expected change set (7 paths: 3 added, 4 modified, against `2cf2f21`)

| Path | Change |
|---|---|
| A `docs/production/tasks/GOV-REALIGN-002.md` | this record |
| A `docs/production/EXECUTION_CONTEXT.md` | P0 navigation aid (00.12 §3, §4) |
| A `docs/production/TOOLCHAIN.md` | verified toolchain (00.12 §8), CI runner pin (E2E-003 D-R3) |
| M `docs/production/PRODUCTION_COMPLETION_PLAN.md` | Last Updated; §11 E2E-002 landing row; §12 actionlint and runner pin; §13 pull request #1 landed; §14 rows Branch and pull request, Last CI-verified commit, Checkpoint commit, Current Task, Next task, Decisions in force, Verification baseline, Resume procedure |
| M `docs/production/tasks/GOV-REALIGN-001.md` | §5.5 landing record of `00f3ef6` |
| M `docs/production/tasks/E2E-002.md` | §5.6 landing record of `2cf2f21` |
| M `docs/DOCUMENT_MANIFEST.md` | v1.2.1: two rows and the administrative note |

The script refuses to run unless each modified path on the branch is the blob of `2cf2f21`, and stops unless exactly these 7 paths are staged.

### 2.2 Out of scope (carried, each named in living plan §14)

- The durable record of OD-10 (repository visibility): the Owner's decision is not in the repository; on 2026-10-25 the repository was observed public (GitHub API `private: false`). Stays in "Waiting on the Owner" until the Owner states it.
- The remaining DEC-042 wording in AGENTS.md ("authorized when it serves the critical path", "PRODUCT COMPLETION FIRST") and READ_ME_FIRST.md step 11: governance files, so a change there is HIGH risk; carried to the P1 Task.
- P1 to P11 documents (`CBT_RELEASE_DEFINITION.md`, the P2 specifications, `TASK_PLAN.md`); any code, test, workflow or dependency change.

### 2.3 Acceptance criteria

- **AC-01** The content commit changes exactly the 7 paths of §2.1 against `2cf2f21`; the evidence commit changes only this record.
- **AC-02** Every landing fact in GOV-REALIGN-001 §5.5 and E2E-002 §5.6 is re-read by the script from Git and the GitHub API and matches (§5.1).
- **AC-03** No `@@` placeholder is left in any staged file; `git diff --cached --check` is clean.
- **AC-04** Both commits carry the Owner's identity as author and committer and exactly the subject the script gives, no trailer, no AI or tool attribution; normal pushes only.
- **AC-05** Full CI of the content commit (attempt 1, push): all eight jobs success on `ubuntu-24.04`.

### 2.4 Stops (each ends the script with `STOP:` and a nonzero exit; nothing is retried or worked around)

Package hash differs from the Owner's; working tree not clean; Git identity not the Owner's; `origin/main` not `2cf2f21`; branch already exists; a modified path not at its base blob; a landing fact differs; staged paths not exactly §2.1; a placeholder left; an attribution or trailer in a commit; a push or pull request result not as expected; at evidence: the run not of the content commit, not attempt 1, not completed, or any job not success on `ubuntu-24.04`. After a stop the executor reports the output and waits; a failed CI is never re-run.

## 3. Execution

```text
bash <package> apply <AUTH_DATE> <PKG_SHA>    # checks, branch, files, content commit, push, pull request; then STOP
bash <package> evidence <PR> <RUN>            # after CI run <RUN> of the content commit completed: checks, evidence commit, push; then STOP
```

The Owner reviews pull request `<PR>` and squash-merges it; the next Task records the landing commit.

## 4. First response of the executor (AICWDF §38)

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-002 (PRE-P11 / PRE-BASELINE, not counted in P11 baseline)
TASK STATUS: READY / NOT READY
DEPENDENCIES: package SHA-256 matches the Owner's: yes / no; main at 2cf2f21: yes / no; working tree clean: yes / no
AUTHORIZATION AS GIVEN BY THE OWNER: push yes / no; pull request yes / no
TOOLCHAIN: git, Git Bash, Node.js, gh (authenticated as yusufarst): available / missing
RISK CLASS: STANDARD
DATABASE IMPACT: NONE
COST IMPACT: NONE (GitHub Actions minutes only)
SAFE TO IMPLEMENT: YES / NO
IF NO, BLOCKER: ...
```

## 5. Completion evidence (written by the script in the evidence commit)

### 5.1 Landing facts, re-verified on 2026-10-26 from Git and the GitHub API

```text
landing 00f3ef6d0386ceac23c32560c3dedba14f982d88: tree 75577edc0de585391f7d6249a2577b4a16aacee6, equal to 2bd7b06abd2840e1a8d2a6fdb62f085cd6895a8d (head of pull request #2); parent 8fdd60948a7c0f0de51c663b7b61b02dc38445fa; author Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>; committer GitHub <noreply@github.com>; signature verified; subject: docs(governance): record the CBT release realignment, AICWDF v4.3 adoption and as-built stack decision; no trailer, no attribution; pull request #2 merged 2026-10-10T20:54:28Z by yusufarst
main run 53 (38085576996) attempt 1 on 00f3ef6: Browser end-to-end (desktop-1280) success ubuntu-latest; Browser end-to-end (firefox-1280) failure ubuntu-latest; Browser end-to-end (mobile-360) success ubuntu-latest; Browser end-to-end (tablet-768) success ubuntu-latest; Browser end-to-end (webkit-390) success ubuntu-latest; Container image (build and smoke test) success ubuntu-latest; Runtime (typecheck, unit, PostgreSQL integration) success ubuntu-latest; Web client (typecheck, tests, build) success ubuntu-latest
landing 2cf2f2136b617b009e6ed4c1ac670e9b3776b968: tree 444a7b42eaf2c016b26042ef93b0a2ef2468bbdb, equal to f4423795a9338533d6793b3ab171a9b73777b990 (head of pull request #5); parent b13fd40c00197b7712d1335f2a02681ba9dd8a46; author Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>; committer GitHub <noreply@github.com>; signature verified; subject: test(e2e): reload and navigate pages without waiting for the load event (#5); no trailer, no attribution; pull request #5 merged 2026-10-25T15:25:18Z by yusufarst
main run 61 (40206851655) attempt 1 on 2cf2f21: Browser end-to-end (desktop-1280) success ubuntu-24.04; Browser end-to-end (firefox-1280) success ubuntu-24.04; Browser end-to-end (mobile-360) success ubuntu-24.04; Browser end-to-end (tablet-768) success ubuntu-24.04; Browser end-to-end (webkit-390) success ubuntu-24.04; Container image (build and smoke test) success ubuntu-24.04; Runtime (typecheck, unit, PostgreSQL integration) success ubuntu-24.04; Web client (typecheck, tests, build) success ubuntu-24.04
main run 57 (40191939042) attempt 1 on b13fd40: Browser end-to-end (desktop-1280) success ubuntu-24.04; Browser end-to-end (firefox-1280) success ubuntu-24.04; Browser end-to-end (mobile-360) success ubuntu-24.04; Browser end-to-end (tablet-768) success ubuntu-24.04; Browser end-to-end (webkit-390) success ubuntu-24.04; Container image (build and smoke test) success ubuntu-24.04; Runtime (typecheck, unit, PostgreSQL integration) success ubuntu-24.04; Web client (typecheck, tests, build) success ubuntu-24.04
pull request #3: closed, not merged
```

### 5.2 Content commit, pull request and full CI

```text
committed 1cf346e2610fdb5940946accf09276c77b36b403 docs(production): add the execution context and toolchain records and complete the landing records (parent 2cf2f2136b617b009e6ed4c1ac670e9b3776b968; author and committer Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>; no trailer, no attribution; exactly the seven paths of 2.1)
pr 6 https://github.com/yusufarst/elligble/pull/6 (head 1cf346e2610fdb5940946accf09276c77b36b403, base main)
ci 40217721568 attempt 1 (push) on 1cf346e2610fdb5940946accf09276c77b36b403: Browser end-to-end (desktop-1280) success ubuntu-24.04; Browser end-to-end (firefox-1280) success ubuntu-24.04; Browser end-to-end (mobile-360) success ubuntu-24.04; Browser end-to-end (tablet-768) success ubuntu-24.04; Browser end-to-end (webkit-390) success ubuntu-24.04; Container image (build and smoke test) success ubuntu-24.04; Runtime (typecheck, unit, PostgreSQL integration) success ubuntu-24.04; Web client (typecheck, tests, build) success ubuntu-24.04
```

## 6. Review

NOT REQUIRED (risk class STANDARD). If the Owner requests one, its reviewer, date, scope and result are recorded here.

## 7. Safe next Task

After the squash merge: the next Task the Owner authorizes by ID records this Task's landing commit. Planned order (living plan §14): the P1 CBT release definition with the P11 Task baseline, and the carried READY Task UI-SYSTEM-002 part 2.
