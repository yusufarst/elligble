# GOV-REALIGN-001 — Record the CBT release realignment, the AICWDF v4.3 adoption and the as-built stack decision

> **PRE-P11 / PRE-BASELINE GOVERNANCE TASK. NOT COUNTED IN P11 BASELINE.** Authorized under the DEC-045 transition rule (00.12 §2) before the P11 Task baseline exists. This Task does not create TASK_PLAN.md. This file is both the contract and the durable Task record: the executor places it at `docs/production/tasks/GOV-REALIGN-001.md` and fills only §1, §5 and §6.

## 1. Task record

| Field | Value |
|---|---|
| Task ID | GOV-REALIGN-001 |
| Classification | PRE-P11 / PRE-BASELINE GOVERNANCE TASK; NOT COUNTED IN P11 BASELINE |
| Risk class | HIGH (governance authority change; documentation only) |
| Status | DONE |
| Contract | realignment package v0.3, prepared 2026-10-05 by the planning agent (Claude Project chat) |
| Owner decisions | 2026-10-05: package v0.1 approved with four corrections; OD-01 to OD-11 approved (OD-05, OD-07 and OD-07b with refinements); OD-10 and the part C actions not authorized by that approval |
| Package v0.3 approval | YES (Owner, 2026-10-06) |
| Execution authorization | 2026-10-06: base 8fdd60948a7c0f0de51c663b7b61b02dc38445fa; push no (Step 6 needs a separate Owner authorization); commit-msg hook no. 2026-10-07, Step 6: push yes, only this branch at commit A, normal push; pull request by the executor with GitHub CLI; full CI of commit A awaited, no re-run, no workflow dispatch. 2026-10-08, Step 7 after the review FAIL: one content commit A2 changing only READ_ME_FIRST.md and docs/production/PRODUCTION_COMPLETION_PLAN.md (review fixes R1 to R4), normal push, full CI of A2 awaited, no re-run, no workflow dispatch. 2026-10-11, Step 7: commit B, then a normal push of this branch; the CI run on commit B observed only |
| Base commit | 8fdd60948a7c0f0de51c663b7b61b02dc38445fa |
| Branch | `task/gov-realign-001-cbt-aicwdf` |
| Executor | Claude Code Desktop on `C:\Projects\ELLIGBLE` |
| Pull request / CI | pull request #2, https://github.com/yusufarst/elligble/pull/2 (base main 8fdd60948a7c0f0de51c663b7b61b02dc38445fa); latest content commit A2 759d02029b8eada9ae25dc5ac800d305e0c6a4c1: full CI run 51 (databaseId 38078002666, attempt 1, push event) GREEN, all eight jobs success; commit A abd9a116de032d84b0b95ca1cd5005e241f8524b: full CI run 50 (databaseId 37557769730, attempt 1, push event) GREEN, all eight jobs success; see §5.4 |
| Independent review | PASS on the latest content commit A2 (planning agent, 2026-10-11, relayed by the Owner; the Owner's independent second review also PASS), after the FAIL on commit A of 2026-10-08 was remediated by A2; no unresolved finding; see §6 |

### Status history

| Date | Status | Note |
|---|---|---|
| 2026-10-05 | TODO | contract v0.3 prepared; waiting for the Owner's approval of package v0.3 and the execution authorization |
| 2026-10-06 | READY | Owner approved package v0.3 and authorized execution: base 8fdd609, push no, commit-msg hook no |
| 2026-10-06 | IN_PROGRESS | Step 0 passed |
| 2026-10-06 | VERIFYING | commit A prepared; waiting for the full CI of commit A and the independent review |
| 2026-10-11 | DONE | DONE gate held on the latest content commit A2 (759d020): full CI GREEN (run 51), independent review PASS (2026-10-11) after the FAIL of 2026-10-08 was remediated, no unresolved finding; commit B records the evidence and the review |

## 2. Contract

**STATUS RULE:** TODO → READY when the Owner approves package v0.3 and authorizes this Task, naming the base, push yes or no, and hook yes or no → IN_PROGRESS when Step 0 passes → VERIFYING at commit A → DONE at commit B, made only when the DONE gate holds: the full CI run on commit A is GREEN, the independent review is PASS, and no review finding is unresolved (Step 7). A CI run on commit B is not part of the DONE gate.

**RISK CLASS:** HIGH (governance authority change; documentation only; no code)

**OBJECTIVE:** write the Owner-approved realignment records into the repository, so that an agent with no chat history can determine the current release (CBT-R1) and its policy decisions, the execution framework (AICWDF v4.3, adapted) and the stack decision, with every superseded rule marked and this Task's own scope, evidence and review kept in the repository.

**WHY THIS EXISTS:** the Owner's decisions given in the Claude Project instructions and in chat are not durable until written into the repository (Project instructions; AICWDF §2; 00.04).

**DEPENDS ON:** Owner approval of package v0.3 with its date; the execution authorization; Step 0 PASS.
**BLOCKS:** GOV-REALIGN-002 (EXECUTION_CONTEXT.md and TOOLCHAIN.md); the P1 release definition; the P11 baseline.
**PARALLEL SAFE:** NO

### 2.1 Expected change set (18 files: 5 added, 13 modified)

Added:

1. `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md`
2. `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md`
3. `docs/00-governance/reference/AICWDF_v4.3_EN.md`
4. `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md`
5. `docs/production/tasks/GOV-REALIGN-001.md` (this file)

Modified, with exactly the edits E1 to E13 of Step 3 and nothing else in these files:

6. `AGENTS.md` (E8)
7. `README.md` (E10)
8. `READ_ME_FIRST.md` (E9)
9. `docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md` (E6)
10. `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md` (E3)
11. `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md` (E2)
12. `docs/01-discovery/04.01_SECURE_ASSESSMENT.md` (E5)
13. `docs/02-master-blueprint/02.10_BASELINE_FUTURE_AND_EXCLUSIONS.md` (E4)
14. `docs/DOCUMENT_MANIFEST.md` (E12)
15. `docs/architecture/README.md` (E13)
16. `docs/decisions/DECISION_LOG.md` (E1)
17. `docs/production/PRODUCTION_COMPLETION_PLAN.md` (E11)
18. `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md` (E7)

Commit A carries all 18 files. Commit B changes only file 5. The pull request diff against the base is exactly these 18 files.

### 2.2 Out of scope

- Code, tests, migrations, CI, Docker and deploy files.
- Frozen historical records: `docs/state/CURRENT_STATE.md`, `docs/state/HANDOFF_PACKET.md`, `docs/build/BUILD_PHASE_INDEX.md`, `docs/build/PRODUCT_COMPLETION_ROADMAP.md`, `docs/build/units/`.
- TASK_PLAN.md, EXECUTION_CONTEXT.md, TOOLCHAIN.md or any other P1 to P11 artifact.
- Closing or rewording any Production Blocker; renaming, deleting, moving or reformatting any file; any text not given by the approved package or this contract.
- OD-10 (repository visibility) and the part C actions of the decision sheet.
- Merging into `main`; force push; history rewrite; `git stash`, `git clean` or `git reset` on unknown work.

### 2.3 References

The approved package v0.3 (§2.5); `AGENTS.md`; `docs/00-governance/00.02_DECISION_HIERARCHY.md`; `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md`; `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md`.

### 2.4 Impact

- **Database:** schema change NONE; migration NO; data transformation NONE; direct production DB access FORBIDDEN; data-loss risk NONE KNOWN.
- **Auth / authorization:** NONE (policy documentation only).
- **Cost:** new recurring cost NONE.
- **Modularity, UI, routes, interactions, navigation, localization:** N/A (no user-facing change).
- **MCP session profile:** none required; keep heavy MCP servers off.
- **Tools:** Git and Git Bash (`sha256sum`, `sed`, `diff`). Context7 N/A; Graphify N/A; browser E2E N/A locally (it runs inside the full CI of commit A, which the DONE gate requires).

### 2.5 Input manifest (approved package v0.3)

The executor receives these files from the Owner together with this contract. SHA-256 is computed on the file with CRLF normalized to LF.

| Package file | Target path | SHA-256 (LF-normalized) |
|---|---|---|
| `00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` | `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` | `2ec3d5c30c79a134ab26d09d7889a2330292e23149035bde887ec722b1806efe` |
| `00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` | `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` | `ebef370a46938be26cbb23e8027cdd5243667cd956f177f69c90d06d21f31d05` |
| `ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md` | `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md` | `46922822f2a2fec9984d722db74ccf928c222581e9b1b7a8a3b6a9ccb11c1a19` |
| `AICWDF_v4.3_EN.md` | `docs/00-governance/reference/AICWDF_v4.3_EN.md` | `bb578adabcd8ebddcb97c278e6589b935137f26f851b7218dd86c141744b70fe` |

```sh
for f in 00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md 00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md AICWDF_v4.3_EN.md; do
  printf '%s  %s\n' "$(sed 's/\r$//' "<PACKAGE_DIR>/$f" | sha256sum | cut -d' ' -f1)" "$f"
done
```

Any mismatch: stop (S5).

---

## 3. Execution

`<D>` is the date of the Owner's approval of package v0.3 (YYYY-MM-DD). `<BASE>` is the base named in the execution authorization. `<PACKAGE_DIR>` is the folder holding the package files outside the repository.

### STEP 0 — Read-only checkpoint (stop on any failure)

**0.1 Run and record:**

```sh
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch
git stash list
git worktree list
git config --show-origin --get-all user.name
git config --show-origin --get-all user.email
git ls-remote origin refs/heads/main refs/heads/claude/laughing-mendel-p2l9gh
```

**0.2 Stop conditions:**

- **S1:** the working tree is not clean (any staged, unstaged or untracked file). Stop and report the list. Never stash, clean, reset or discard.
- **S2:** `user.name` or `user.email` is not the Owner's identity. Stop and ask the Owner. Never set an identity yourself.
- **S3:** the base is not available after an authorized `git fetch origin` (a ref update only), or the local `main` differs from `origin/main` other than by being strictly behind. Stop and report.
- **S3b:** `git diff --stat bad61d2 <BASE>` is not empty, meaning the base content differs from the reviewed branch tip `bad61d2` on which this contract was validated. Stop and report; the planning agent re-validates the anchors first.
- **S4:** an anchor text in Step 3 is not found exactly once. Stop for that edit and report it; do not improvise.
- **S5:** an input hash differs from §2.5. Stop.
- **S6:** the Owner's approval of package v0.3 or the execution authorization is missing, or the authorization does not name the base and whether push is allowed. Stop.

**0.3 Claude Code attribution (Owner machine, user settings, not a repository change; the Owner may do it):**

`%USERPROFILE%\.claude\settings.json` must contain, merged into the existing strict JSON:

```json
{ "attribution": { "commit": "", "pr": "" } }
```

Empty strings hide the commit trailer and the pull request line (`attribution.commit`, `attribution.pr` in https://code.claude.com/docs/en/settings-reference; `includeCoAuthoredBy` is deprecated). Cloud and Remote Control sessions also add a session link, governed by `attribution.sessionUrl`, and do not read user settings. The Step 5 checks stay mandatory whatever this setting says.

**0.4 Optional local guard (only if the authorization says hook yes):** a `commit-msg` hook in `.git/hooks/` (local, never committed) that rejects attribution:

```sh
#!/bin/sh
if grep -qiE '^(co-authored-by|generated-by|assisted-by|claude-session):|noreply@anthropic\.com|generated with \[?claude' "$1"; then
  echo "commit-msg: AI or tool attribution found; commit rejected." >&2
  exit 1
fi
```

### STEP 1 — Branch

```sh
git switch -c task/gov-realign-001-cbt-aicwdf <BASE>
```

### STEP 2 — Inputs and new files

1. Verify the input hashes (§2.5).
2. Copy the drafts of 00.11, 00.12 and ADR-001 to their target paths. In each, delete the first line (the `> DRAFT FOR OWNER REVIEW ...` banner) and the blank line after it.
3. In 00.11: `**Status:** PENDING OWNER APPROVAL` → `**Status:** LOCKED`; `**Owner Approved:** PENDING` → `**Owner Approved:** YES (Owner approval in chat, <D>; recorded as DEC-044)`. In 00.12: the same, with DEC-045. In ADR-001: `**Status:** PROPOSED` → `**Status:** ACCEPTED`; `**Owner Approved:** PENDING` → `**Owner Approved:** YES (Owner approval in chat, <D>; recorded as DEC-046)`. In all three, replace every `<APPROVAL_DATE>` with `<D>`.
4. Copy `AICWDF_v4.3_EN.md` unchanged to `docs/00-governance/reference/AICWDF_v4.3_EN.md`.
5. Copy this contract unchanged to `docs/production/tasks/GOV-REALIGN-001.md`. In its §1 set: Package v0.3 approval → `YES (Owner, <D>)`; Execution authorization → `<date>: base <BASE>; push <yes or no>; commit-msg hook <yes or no>`; Base commit → the full SHA of `<BASE>`; Executor → the executor and machine named by the Owner (default: Claude Code Desktop on `C:\Projects\ELLIGBLE`); Status → `IN_PROGRESS`. Add the status-history rows READY (authorization date) and IN_PROGRESS (today). Change nothing outside §1, §5 and §6.

### STEP 3 — Exact edits

Insert the given text exactly; `<D>` is the approval date.

#### E1 `docs/decisions/DECISION_LOG.md`

**a)** Header: `**Version:** 1.1.0` → `**Version:** 1.2.0`; `**Supersedes:** 1.0.9` → `**Supersedes:** 1.1.0`; `**Last Reviewed:** 2026-09-29` → `**Last Reviewed:** <D>`.

**b)** In the Status cell of these table rows, replace `LOCKED` with:

- row `| DEC-009 |`: `LOCKED; provider selection superseded for the current release by DEC-046 (ADR-001)`
- row `| DEC-019 |`: `LOCKED; deferred from the current release except minimal exam-journey help (DEC-044)`
- row `| DEC-032 |`: `LOCKED; D04.3-22 to D04.3-27 promoted into the current release by DEC-044`
- row `| DEC-042 |`: `LOCKED; partially superseded by DEC-045 (00.12 §2)`

**c)** Insert after the `| DEC-043 |` row:

```text
| DEC-044 | Current release scope | The current release is Secure Assessment / CBT only (CBT-R1) for one school; non-CBT domains are deferred, not deleted; the CBT Release Gate is the current release criterion; CBT-R1 policy decisions OD-05 to OD-09 in 00.11 §12 | LOCKED | Owner / 00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md |
| DEC-045 | Planning and execution framework | AICWDF v4.3 adopted and adapted; one Owner-authorized bounded Task at a time; Task records in docs/production/tasks/; finite P11 Task baseline | LOCKED | Owner / 00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md |
| DEC-046 | Stack and topology | As-built stack recorded; self-hosted on the school's VPS; InsForge not used in the current release; provider-agnostic principle retained | LOCKED | Owner / ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md |
```

**d)** Append at the end of the file, after one blank line:

```text
### DEC-044 — Current Release: Secure Assessment / CBT Scope Realignment (<D>)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifact:** `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md`

Owner narrowed the current release to Secure Assessment / CBT only (CBT-R1): one school, mobile-first web, about 1,000 concurrent students, on the school's own domain and VPS.

- A release boundary, not a product-identity change: DEC-001 and DEC-007 remain; tenant isolation is preserved.
- Deferred, not deleted: Learn, Track, Passport, Path, Care, Parent / Guardian, Alumni, Partner and Opportunity, Talent Assurance, AI features, social features, SIS/ERP, general attendance and timetable, payments.
- The CBT Release Gate (00.11 §9) replaces 02.10 §2 and 00.09 §4 as the current-release criterion; the platform baseline remains the long-term definition.
- D04.3-22 to D04.3-27 move into CBT-R1 and a numeric-answer type is added; media are images; audio, video and file-upload answers stay out.
- Student identity: registration creates a claim only; verification by HOMEROOM_TEACHER (own rombel) or SCHOOL_OPERATOR; at most one active account per official identity; no parallel claims that could produce duplicates; uniqueness enforced at the persistence layer; recovery never creates a second identity or account; audited.
- Participant room reassignment by an authorized School Operator, also during a running exam, with reason, confirmation and an append-only audit trail; it preserves the Attempt, accepted answers, remaining time and submission state, and never creates a retake or a new Attempt or resets answers or the timer.
- Owner policy decisions OD-05 to OD-09 (registration and recovery, personal data, role authority, institution-managed exams, risk signals, result publication) are recorded in 00.11 §12.
- Risk signals are evidence for human review, never automatic proof.
- PB-08 and PB-09 do not activate for CBT-R1.

Supersedes for the current release: 02.10 §2 and 00.09 §4 as the release criterion; the FUTURE status of D04.3-22 to D04.3-27; DEC-019 as a current-release requirement.

### DEC-045 — AICWDF v4.3 Adoption and Task Execution Model (<D>)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifact:** `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md`

Owner adopted AICWDF v4.3 as the planning and operating framework, adapted to the repository (compatibility over conformity):

- Execution: one Owner-authorized, bounded READY Task at a time by an executor (Claude Code Desktop on `C:\Projects\ELLIGBLE` by default); the executor never merges into `main`.
- Planning: P0 to P11 mapped onto the existing artifacts; a finite P11 Task baseline with counters and progress in `docs/production/TASK_PLAN.md`; pre-adoption work recorded as reused capabilities, not as baseline DONE.
- Task records: each Task contract in `docs/production/tasks/` records its status history, evidence and independent review; Tasks authorized before the P11 baseline (from GOV-REALIGN-001) are marked PRE-P11 / PRE-BASELINE and not counted in it.
- DONE requires the required tests and recorded evidence; HIGH-risk Tasks also need an independent review.
- Git: Owner identity only; no AI or tool attribution; post-commit inspection; no force push; no history rewrite.

Supersedes for new work: 00.10 §3 steps 2 and 6; 00.10 §5 as refined in 00.12 §2; the living plan's work-in-progress limit of 3 and Production Sprint Mode; the living plan as the only live Task tracker (from P11 approval).

Does NOT supersede: 00.02; the rest of DEC-042 (no new Build Units, verification standard); any LOCKED product, security, architecture, domain, privacy or design decision.

### DEC-046 — As-Built Stack and Self-Hosted Topology (<D>)

**Version:** 1.0.0
**Status:** LOCKED
**Canonical artifact:** `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md`

- The as-built stack is the current-release stack: Node.js 24 and TypeScript on `node:http`, `pg`, PostgreSQL, modular monolith; React, TypeScript, Vite and shadcn/ui; one Docker image; nginx edge; self-hosted on the school's VPS and domain.
- InsForge is not used in the current release; DEC-009's provider-agnostic principle and modular-monolith direction remain.
- No Redis or Valkey, queue, broker, Kubernetes or microservices without evidence and a new ADR.
- Capacity for about 1,000 concurrent students is not claimed until P6 load evidence exists.
```

#### E2 `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md`

Insert before the line `# Continuous Production Completion`, followed by one blank line:

```text
> **Partially superseded for new work (DEC-045, <D>):** §3 step 2 (the agent selects the next item) and step 6 (autonomous continuation), §5 as refined (Task records in `docs/production/tasks/` carry their own evidence), the living plan's work-in-progress limit and Production Sprint Mode, and the living plan's role as the only live Task tracker (from P11 approval) are replaced by `00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` §2. Everything else here stays in force. Current release scope: `00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` (DEC-044).
```

#### E3 `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md`

Insert after the paragraph that starts `> **Partially superseded for new work (DEC-042, 2026-09-29):**`, separated by one blank line:

```text
> **Current release criterion (DEC-044, <D>):** for the current release (Secure Assessment / CBT, CBT-R1) the CBT Release Gate in `00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` §9 replaces the Baseline Completion Gate (§4) as the release criterion, and the deferred domains are off the critical path. §4 remains the platform-wide definition for when the Owner reopens deferred domains.
```

#### E4 `docs/02-master-blueprint/02.10_BASELINE_FUTURE_AND_EXCLUSIONS.md`

Insert before the line `## 1. Purpose`, followed by one blank line:

```text
> **Current release boundary (DEC-044, <D>):** the current release is Secure Assessment / CBT only (CBT-R1). The matrices below remain the long-term platform baseline and are not the current-release gate. Current scope, deferred domains and the CBT Release Gate: `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md`.
```

#### E5 `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`

Insert before the line `# ELLIGBLE — Discovery 04: Secure Assessment`, followed by one blank line:

```text
> **Partially superseded for the current release (DEC-044, <D>):** D04.3-22 to D04.3-27 (multiple answer, true/false, short answer, essay, matching, ordering) move from FUTURE or FUTURE/OPTIONAL into the current release, and a numeric-answer type is added; the exact rules follow in the P2 question-type specification. D04.3-18, D04.3-20, D04.3-21, D04.3-28 and every other Discovery 04 decision stay authoritative. See `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` §7.
```

#### E6 `docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md`

Insert before the line `# ELLIGBLE Canonical Terminology`, followed by one blank line:

```text
> **Current-release role names (DEC-044, <D>):** the Owner's role terms for the current release map to canonical actors in `00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` §4. In repository code and the runbook, "operator" means the platform operator (audited provisioning CLI); "School Operator" always means the SCHOOL_OPERATOR assignment.
```

#### E7 `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md` (section 1)

- `- **Version:** 0.1.4` → `- **Version:** 0.1.5`
- `- **Last Reviewed:** 2026-09-18` → `- **Last Reviewed:** <D>`
- Insert after the Last Reviewed line:

```text
- **Current release applicability (DEC-044):** PB-08 and PB-09 are conditional and do not activate for the current CBT release (closure rule 6); they stay OPEN / CARRIED FORWARD. Every other blocker applies to the current release.
```

#### E8 `AGENTS.md`

**a)** In `## Mandatory Read Order`, in the **Core Requirements** list, insert after the bullet that starts with `- Read the living plan`:

```text
- Read `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` (DEC-044: the current release is Secure Assessment / CBT only) and `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` (DEC-045: execute only the Owner-authorized Task, one bounded READY Task at a time; Task records in `docs/production/tasks/`).
```

**b)** In `## Current Phase Guard`, insert as the first bullet:

```text
- Current release: Secure Assessment / CBT only (DEC-044). Deferred domains (00.11 §8) are not planned, built or put on the critical path unless the Owner reopens them.
```

**c)** In `## Architecture Guardrails`, replace the line `InsForge-first/provider-agnostic` with `Provider-agnostic; current release self-hosted on the school VPS (ADR-001 / DEC-046)`.

**d)** In `## Build Guardrail`, insert as the first bullet:

```text
- **AUTHORIZED TASK ONLY (DEC-045):** implement only the Task the Owner authorized, within its contract; the critical path is the P11 Task baseline.
```

**e)** Insert before `## Secrets`:

```text
## Git Identity and Attribution

- Commit only with the Owner's configured author and committer identity. Before the first commit of a session, check `git config user.name` and `git config user.email`; if they are not the Owner's identity, stop and ask. Never set an identity yourself.
- Never add AI, model or tool attribution to commits, trailers, pull request metadata or contributor metadata (no Co-Authored-By, Generated-By, Assisted-By or session links).
- After every commit, inspect `git log -1 --format=fuller` and the raw message; report any attribution instead of rewriting history.
- No force push. No rewriting of published history. The Owner merges into `main`.

```

#### E9 `READ_ME_FIRST.md`

**a)** After the step `1. Read \`AGENTS.md\`.`, insert the step below and renumber the following steps (3 to 11):

```text
2. Read `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` (current release: CBT only) and `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` (execution framework).
```

**b)** In the "Current high-level phase truth" block, insert after the line that contains `BU-001..BU-090 historical construction assets`:

```text
Current release:  SECURE ASSESSMENT / CBT ONLY (DEC-044)
Execution:        AICWDF v4.3 adapted (DEC-045): Owner-authorized Tasks, one at a time
```

#### E10 `README.md`

**a)** In the "Current program" code block, insert after the line that contains `Program 1: canonical baseline completion (Secure Assessment first)`:

```text
Current release → SECURE ASSESSMENT / CBT ONLY for one school (DEC-044)
Execution → AICWDF v4.3 adapted (DEC-045)
```

**b)** In "Start here", insert as the second bullet:

```text
- `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` and `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md`: current release scope and execution framework.
```

#### E11 `docs/production/PRODUCTION_COMPLETION_PLAN.md` (only these edits)

**a)** Line 1: replace `**Status:** LIVING PLAN (DEC-042) — the only live execution tracker` with:

```text
**Status:** LIVING PLAN (DEC-042, amended by DEC-045): live production state, gaps, evidence, Owner decisions and continuity checkpoint; Task records in `docs/production/tasks/`; from P11 approval, Task status lives only in `docs/production/TASK_PLAN.md`
```

**b)** `**Last Updated:** 2026-09-30` → `**Last Updated:** <D>`.

**c)** §3: at the end of the paragraph that starts `Track, Care, Passport, Path, Opportunity, Application, Verified Connection, Outcome and Alumni are not started`, append:

```text
 Like Parent / Guardian and Partner, they are deferred from the current release (DEC-044, `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` §8).
```

**d)** §6 introduction: replace `Work-in-progress limit: 3.` with `Work-in-progress limit: 3 (superseded by DEC-045: one Owner-authorized Task at a time).`

**e)** §6: insert directly after the heading `#### Blocked tasks`, followed by one blank line:

```text
> Re-evaluated in P11 against DEC-044 (<D>): OD-09 answers the Owner question of RESULT-003; OD-08 sets the D04.7 preset for ASSESS-PROCTOR-003; OD-07 names the School Operator as the role for ADMIN-001 and gives the principles for SEC-001, whose CBT permission matrix (PB-05) follows in P5. See `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` §12.
```

**f)** §7: replace these three rows in full.

Old row:

```text
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN |
```

New row:

```text
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN; CBT role-authority principles decided <D> (OD-07, OD-07b; 00.11 §12); the CBT matrix follows in P5 |
```

Old row:

```text
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | OPEN (not blocking critical path) |
```

New row:

```text
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | DECIDED <D> (OD-07b; 00.11 §12): the School Operator organizes institution-managed exams; subject teachers own content, essay grading and result finalization |
```

Old row:

```text
| Student result visibility (D04.8-16/21/22: options exist, "exact school-facing options later") | Showing scores to students | Hidden until the teacher publishes a finalized result, per exam; only the student's own score, no ranking or peer results (D04.8-50/51) | OPEN (students see no scores today; teachers see provisional results) |
```

New row:

```text
| Student result visibility (D04.8-16/21/22: options exist, "exact school-facing options later") | Showing scores to students | Hidden until the teacher publishes a finalized result, per exam; only the student's own score, no ranking or peer results (D04.8-50/51) | DECIDED <D> (OD-09; 00.11 §12): the recommended default; implementation is RESULT-003 |
```

**g)** §13: insert directly after the heading `## 13. Next engineering work`, followed by one blank line:

```text
> Amended by DEC-045: execution proceeds one Owner-authorized Task at a time; see §14 and `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md`.
```

**h)** §14 table: header `| Item | State (2026-09-30) |` → `| Item | State (<D>) |`. Replace these rows in full:

- the row that starts `| Active tasks (at most 3) |` →

```text
| Current Task | GOV-REALIGN-001 (pre-baseline governance Task; its status lives in its record `docs/production/tasks/GOV-REALIGN-001.md`); further Tasks start only when the Owner authorizes them by ID (DEC-045) |
```

- the row that starts `| Next task |` →

```text
| Next task | GOV-REALIGN-002 (EXECUTION_CONTEXT.md and TOOLCHAIN.md, pre-baseline) once GOV-REALIGN-001 is DONE; then planning: P1 CBT release definition and the P2 specifications (00.11), then the P11 Task baseline; READY items carried into the baseline: UI-SYSTEM-002 part 2, the remainder of UI-SYSTEM-004 |
```

- the row that starts `| Decisions in force |`: keep its current text and append before the closing `|`:

```text
; current release CBT only (DEC-044) with the CBT-R1 policy decisions OD-05 to OD-09 (00.11 §12); AICWDF v4.3 execution model (DEC-045); as-built stack and self-hosted topology (DEC-046, ADR-001)
```

- the row that starts `| Waiting on the Owner |` →

```text
| Waiting on the Owner | PB-05 CBT permission matrix (principles decided, matrix in P5); PB-01, PB-02, PB-03, PB-10, PB-12; the final ELLIGBLE ID format (AUTH-001); OPEN-05; OD-10 repository visibility; part C actions of the realignment decision sheet (VPS facts, real devices and UAT, legal contacts, DesainPakeAI access to project `b5a22aa4-...` (§10)) |
```

- the row that starts `| Execution mode |` →

```text
| Execution mode | AICWDF v4.3 adapted (DEC-045): one Owner-authorized bounded Task at a time, three verification layers (00.12 §6); Production Sprint Mode and the work-in-progress limit of 3 are superseded |
```

Leave every other row unchanged. The commit-SHA rows are updated by GOV-REALIGN-002; a commit never records its own SHA.

#### E12 `docs/DOCUMENT_MANIFEST.md`

**a)** Header: `**Version:** 1.1.3` → `**Version:** 1.2.0`; `**Supersedes:** 1.1.2` → `**Supersedes:** 1.1.3`.

**b)** Insert as the first administrative note, directly above the v1.1.3 note:

```text
> **Administrative Note:** v1.2.0 registers `00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` (DEC-044), `00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` (DEC-045), the AICWDF v4.3 reference copy, `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md` (DEC-046) and the Task records folder `docs/production/tasks/`, and updates the living plan and decision log descriptors.
```

**c)** Insert after the row for `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md`:

```text
| `docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md` | Current release: Secure Assessment / CBT only (CBT-R1); scope, roles, identity invariants, participant room reassignment, deferred domains, supersessions, CBT Release Gate, Owner policy decisions OD-05 to OD-09 (DEC-044). Version 1.0.0. | Canonical / LOCKED v1.0.0 | ALWAYS |
| `docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md` | AICWDF v4.3 adoption: Owner-authorized Task execution, Task records, P0-P11 mapping, Task rules, Git protocol (DEC-045). Version 1.0.0. | Canonical / LOCKED v1.0.0 | ALWAYS |
| `docs/00-governance/reference/AICWDF_v4.3_EN.md` | Reference copy of the AI-First Complex Web Application Delivery Framework v4.3 (external framework, unchanged, read-only); authority per 00.12 §1. | Reference | On demand |
```

**d)** Insert after the row for `docs/decisions/DECISION_LOG.md`:

```text
| `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md` | As-built stack and self-hosted topology for the current release (DEC-046). | Canonical / ACCEPTED | Architecture / Operations |
```

**e)** In the `docs/decisions/DECISION_LOG.md` row, replace `DEC-042 Continuous Production Completion; DEC-043 shadcn/ui foundation and DesainPakeAI UX direction. Version 1.1.0.` with `DEC-042 Continuous Production Completion; DEC-043 shadcn/ui foundation and DesainPakeAI UX direction; DEC-044 CBT-only current release; DEC-045 AICWDF adoption; DEC-046 as-built stack. Version 1.2.0.`

**f)** In the `docs/production/PRODUCTION_COMPLETION_PLAN.md` row, replace `The only live execution tracker.` with `Live production state, evidence and continuity; Task status moves to TASK_PLAN.md at P11 approval (DEC-045).`

**g)** Insert after the row for `docs/production/PRODUCTION_COMPLETION_PLAN.md`:

```text
| `docs/production/tasks/` | Task contracts and records (AICWDF §23; DEC-045): one file per Task with status history, evidence and independent review. GOV-REALIGN-001 is a pre-baseline governance Task, not counted in the P11 baseline. | Live Task records | When executing or reviewing a Task |
```

#### E13 `docs/architecture/README.md`

Insert at the top of the file, followed by one blank line:

```text
> **Stale index note (<D>):** this README predates the Architecture exit gate and the Build authorization and is not current navigation. Architecture control index: `ARCHITECTURE_PHASE_INDEX.md`; exit gate: `ARCHITECTURE_TRACEABILITY_AND_EXIT_GATE.md`; current-release stack and topology: `docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md` (DEC-046).
```

### STEP 4 — Verification before commit A (Git Bash)

**4.1 Stage exactly the 18 paths of §2.1 and check the working tree:**

```sh
git add -- <the 18 paths of §2.1>
git status --porcelain | grep -vE '^[AM]  ' && echo "UNEXPECTED WORKING-TREE STATE"
```

**4.2 Exact path set (18 files: 5 A, 13 M):**

```sh
cat > /tmp/gov-realign-001.expected <<'EOF'
A docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md
A docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md
A docs/00-governance/reference/AICWDF_v4.3_EN.md
A docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md
A docs/production/tasks/GOV-REALIGN-001.md
M AGENTS.md
M README.md
M READ_ME_FIRST.md
M docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md
M docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md
M docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md
M docs/01-discovery/04.01_SECURE_ASSESSMENT.md
M docs/02-master-blueprint/02.10_BASELINE_FUTURE_AND_EXCLUSIONS.md
M docs/DOCUMENT_MANIFEST.md
M docs/architecture/README.md
M docs/decisions/DECISION_LOG.md
M docs/production/PRODUCTION_COMPLETION_PLAN.md
M docs/state/PRODUCTION_BLOCKERS_BACKLOG.md
EOF
git diff --cached --no-renames --name-status | tr '\t' ' ' | LC_ALL=C sort > /tmp/gov-realign-001.actual
LC_ALL=C sort /tmp/gov-realign-001.expected | diff - /tmp/gov-realign-001.actual && echo "PATH SET OK"
wc -l < /tmp/gov-realign-001.actual
```

Expected: `PATH SET OK` and `18`.

**4.3 Content checks:**

```sh
git diff --cached --check -- . ':(exclude)docs/00-governance/reference/AICWDF_v4.3_EN.md' && echo "WHITESPACE OK"
git diff --cached --name-only -z -- . ':(exclude)docs/production/tasks/GOV-REALIGN-001.md' ':(exclude)docs/00-governance/reference/AICWDF_v4.3_EN.md' \
  | xargs -0 grep -nE 'DRAFT FOR OWNER REVIEW|PENDING OWNER APPROVAL|<APPROVAL_DATE>|<D>|Owner Approved:\*\* PENDING|\*\*Status:\*\* PROPOSED' && echo "DRAFT MARKER LEFT"
sed 's/\r$//' docs/00-governance/reference/AICWDF_v4.3_EN.md | sha256sum
for f in docs/00-governance/00.11_*.md docs/00-governance/00.12_*.md docs/decisions/ADR-001_*.md docs/production/tasks/GOV-REALIGN-001.md; do
  grep -oE '`(docs|runtime|deploy|database|frontend|e2e|\.github)/[^`* ]+`' "$f" | tr -d '`' | sort -u |
  while read -r p; do [ -e "$p" ] || echo "NOT FOUND in $f: $p"; done
done
```

Expected: `WHITESPACE OK` (the reference copy is excluded because it stays byte-identical to the framework file, whose Markdown line breaks end in two spaces); no draft marker; the reference hash equals §2.5; every NOT FOUND line names one of these planned future artifacts, and no other path:

- `docs/production/CBT_RELEASE_DEFINITION.md`
- `docs/production/EXECUTION_CONTEXT.md`
- `docs/production/PERFORMANCE_AND_LOAD_PLAN.md`
- `docs/production/ROUTE_INTERACTION_MATRIX.md`
- `docs/production/TASK_PLAN.md`
- `docs/production/TOOLCHAIN.md`

**4.4 Record the evidence, set VERIFYING, re-check:**

1. Fill §5.1 and §5.2 of `docs/production/tasks/GOV-REALIGN-001.md` with the Step 0, input-hash and Step 4 outputs.
2. Set its §1 Status to `VERIFYING`; add the status-history row VERIFYING (today; "commit A prepared; waiting for the full CI of commit A and the independent review").
3. Re-stage the file and run 4.1 to 4.3 again (all must still pass), then:

```sh
T=docs/production/tasks/GOV-REALIGN-001.md
grep -qE '^\| Status \| VERIFYING \|' "$T" || echo "TASK STATUS NOT VERIFYING"
grep -nE '^\| (Package v0\.3 approval|Execution authorization|Base commit|Executor) \| PENDING' "$T" && echo "TASK RECORD INCOMPLETE"
sed -n '/^### 5\.1 /,/^### 5\.3 /p' "$T" | grep -n 'PENDING' && echo "EVIDENCE 5.1 OR 5.2 MISSING"
```

### STEP 5 — Commit A and attribution check

```sh
git commit -m "docs(governance): record the CBT release realignment, AICWDF v4.3 adoption and as-built stack decision"
git log -1 --format='author:    %an <%ae>%ncommitter: %cn <%ce>'
git log -1 --format=%B
git log -1 --format=%B | grep -inE 'co-authored-by|generated-by|assisted-by|claude-session|noreply@anthropic|claude|anthropic|fable|opus|chatgpt|openai' && echo "ATTRIBUTION FOUND: STOP AND REPORT"
git diff --no-renames --name-status <BASE> HEAD | wc -l
```

Expected: author and committer are the Owner's identity; the message is exactly the subject line; no attribution match; `18`.

### STEP 6 — Push, pull request, full CI on commit A (only if the authorization says push yes)

1. `git push -u origin task/gov-realign-001-cbt-aicwdf` (normal push).
2. Open a pull request to `main` with the commit subject as its title. Body: the five new files, edits E1 to E13, the Owner approval date, and the statement "Task record: `docs/production/tasks/GOV-REALIGN-001.md` (VERIFYING)". No attribution line; read the body before submitting.
3. Wait until the full CI run on commit A has completed: every job of `.github/workflows/ci.yml` for the commit A SHA. Note the run number, the SHA it ran on and the result. Push nothing else to the branch while it runs: the workflow's concurrency setting cancels an in-progress run on the same branch. Full CI GREEN on commit A is mandatory for DONE.
4. Stop and report. Do not merge. The planning agent performs the independent review of: the complete pull request governance and content diff; the full CI evidence of commit A; the Step 0, Step 4 and Step 5 evidence; AC-01 onward as applicable at commit A.

If push is not authorized: stop after Step 5 and report. Without the full CI run on commit A the DONE gate cannot be met, so the Task stays VERIFYING until push is authorized.

### STEP 7 — DONE gate and commit B (evidence and review record)

**DONE gate.** GOV-REALIGN-001 may become DONE only when all three hold:

- the full CI run on commit A is GREEN;
- the independent review result is PASS;
- no review finding remains unresolved.

Commit B is made only after the Owner relays a review result that meets the gate. If the result is FAIL or a finding is unresolved, no commit B is made and the Task stays VERIFYING: make only the fixes the review names, within §2.1, as further content commits, each verified with Step 4 and Step 5 (the path set against the base stays the same 18 files); the gate then applies to the latest content commit (its full CI GREEN and a new review PASS): in that case "commit A" in the DONE gate, §5.3, §5.4, AC-09 and AC-11 means the latest content commit, and §5.3 records every content commit.

1. In `docs/production/tasks/GOV-REALIGN-001.md` only, record:
   - §5.3: the commit A SHA and its Step 5 attribution-check output;
   - §5.4: the pull request number and link if applicable, and the full CI run of commit A with its GREEN result;
   - §6: reviewer, date, scope, the PASS result and the findings with their resolution;
   - §1: the Pull request / CI and Independent review fields; Status → `DONE`; add the status-history row DONE.
2. Deterministic local verification of commit B. This is the complete verification requirement for commit B:

```sh
T=docs/production/tasks/GOV-REALIGN-001.md
git status --porcelain
git add -- "$T"
git diff --cached --no-renames --name-status
git diff --cached --check && echo "WHITESPACE OK"
git diff --cached -U0 -- "$T" | grep -E '^\+' | grep -nE 'DRAFT FOR OWNER REVIEW|<APPROVAL_DATE>|<D>|<BASE>|<PACKAGE_DIR>' && echo "PLACEHOLDER INTRODUCED"
grep -nE '^\| (Package v0\.3 approval|Execution authorization|Base commit|Executor|Pull request / CI|Independent review) \| PENDING' "$T" && echo "TASK RECORD INCOMPLETE"
sed -n '/^### 5\.1 /,/^### 5\.5 /p' "$T" | grep -n 'PENDING' && echo "EVIDENCE 5.1 TO 5.4 INCOMPLETE"
sed -n '/^## 6\. /,/^## 7\. /p' "$T" | grep -n 'PENDING' && echo "REVIEW RECORD INCOMPLETE"
grep -qE '^\| Status \| DONE \|' "$T" || echo "TASK STATUS NOT DONE"
git commit -m "docs(tasks): record GOV-REALIGN-001 evidence and independent review"
git log -1 --format='author:    %an <%ae>%ncommitter: %cn <%ce>'
git log -1 --format=%B | grep -inE 'co-authored-by|generated-by|assisted-by|claude-session|noreply@anthropic|claude|anthropic|fable|opus|chatgpt|openai' && echo "ATTRIBUTION FOUND: STOP AND REPORT"
git diff --no-renames --name-status <BASE> HEAD | tr '\t' ' ' | LC_ALL=C sort > /tmp/gov-realign-001.pr
LC_ALL=C sort /tmp/gov-realign-001.expected | diff - /tmp/gov-realign-001.pr && echo "PR PATH SET STILL 18"
```

Expected: `M docs/production/tasks/GOV-REALIGN-001.md` is the only staged change; `WHITESPACE OK`; no placeholder introduced; record, evidence and review complete; Status DONE; author and committer are the Owner's identity; no attribution; `PR PATH SET STILL 18`.

3. If push is authorized, push the branch again. A CI run that GitHub starts for commit B is observed and reported, but it is not part of the DONE gate: commit B only records evidence, and requiring its own CI result would recreate the evidence recursion. If that run reveals a real regression, stop and report it; the Owner does not merge until it is resolved.
4. Stop. The Owner squash-merges, removes any `Co-authored-by` trailer GitHub proposes, and checks the raw commit on `main`.

## 4. Acceptance criteria

- **AC-01** The four package inputs match the §2.5 hashes; the reference copy in the repository still matches its hash.
- **AC-02** At commit A the staged set equals §2.1 exactly: 18 files, 5 added, 13 modified. After commit B the pull request diff against the base is still exactly these 18 files.
- **AC-03** The three canonical files are LOCKED or ACCEPTED with the Owner approval line, and no draft marker or placeholder remains in any changed file other than this Task record and the reference copy.
- **AC-04** DECISION_LOG lists DEC-044, DEC-045 and DEC-046 in the table and as detail sections; version 1.2.0; the four superseded rows are annotated as specified.
- **AC-05** Header notes exist in 00.09, 00.10, 02.10, 04.01, 00.03 and `docs/architecture/README.md`; the Production Blockers backlog has the applicability line.
- **AC-06** AGENTS.md, READ_ME_FIRST.md and README.md point to 00.11 and 00.12; the AGENTS.md architecture guardrail no longer says InsForge-first; the Git Identity and Attribution section exists.
- **AC-07** The living plan changes are exactly E11 a) to h).
- **AC-08** DOCUMENT_MANIFEST is version 1.2.0 and registers 00.11, 00.12, the reference copy, ADR-001 and `docs/production/tasks/`.
- **AC-09** This Task record: at commit A Status VERIFYING, §1 approval, authorization, base and executor filled, §5.1 and §5.2 filled, §6 pending; commit B is made only when the DONE gate holds and fills §5.3, §5.4 (with the GREEN full CI of commit A) and §6, and sets Status DONE. Outside §1, §5 and §6 the record is identical to contract v0.3.
- **AC-10** Commits A and B have the Owner's identity as author and committer and no AI or tool attribution.
- **AC-11** No push or pull request without authorization. The full CI run on commit A is GREEN before commit B (DONE gate). Commit B passes the deterministic local verification of Step 7; a CI run on commit B is observed and reported but is not a DONE prerequisite.

## 5. Completion evidence (filled by the executor)

### 5.1 Step 0, base and input hashes (before any write)

```text
Step 0 executed 2026-10-06 15:25 local time on branch main, before any write.

Step 0.1 outputs, in contract order:
C:/Projects/ELLIGBLE
main
8fdd60948a7c0f0de51c663b7b61b02dc38445fa
## main...origin/main
(stash list: no output)
C:/Projects/ELLIGBLE 8fdd609 [main]
file:C:/Users/Yusuf Setiawan/.gitconfig	Yusuf Arif Setiawan
file:C:/Users/Yusuf Setiawan/.gitconfig	134618411+yusufarst@users.noreply.github.com
bad61d28a54e87bdfbd830efd58f90ee3ad9b2e7	refs/heads/claude/laughing-mendel-p2l9gh
8fdd60948a7c0f0de51c663b7b61b02dc38445fa	refs/heads/main

Additional base and identity outputs (Owner execution notes):
origin/main: 8fdd60948a7c0f0de51c663b7b61b02dc38445fa
divergence main...origin/main: 0	0
local task/* branches: (no output)
remote task/* heads: (no output)
bad61d2 present
diff stat from bad61d2 to the base: (no output)
effective user.name: Yusuf Arif Setiawan
effective user.email: 134618411+yusufarst@users.noreply.github.com
no GIT_AUTHOR/GIT_COMMITTER variables

Stop conditions:
S1 PASS: working tree clean (no staged, unstaged or untracked file)
S2 PASS: effective identity Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com> is the Owner's; no GIT_AUTHOR_* or GIT_COMMITTER_* variable set
S3 PASS: branch main; HEAD = origin/main = 8fdd60948a7c0f0de51c663b7b61b02dc38445fa; divergence 0 0; no fetch performed
S3b PASS: bad61d2 present locally; diff stat from bad61d2 to the base empty
S4 PASS: every Step 3 anchor found exactly once (read-only check of all anchors before any write); each edit applied once
S5 PASS: the four input hashes equal section 2.5; the contract hash equals the one in the Owner's authorization
S6 PASS: package v0.3 approved 2026-10-06; authorization names base 8fdd60948a7c0f0de51c663b7b61b02dc38445fa, push no, commit-msg hook no

Step 0.3 (user settings, read only): attribution = {"commit":"","pr":""}; includeCoAuthoredBy absent; no .claude/settings.json or .claude/settings.local.json in the repository root
Step 0.4: skipped (commit-msg hook no); no active hook in .git/hooks; core.hooksPath not set

Input hashes (SHA-256, LF-normalized; package directory outside the repository):
2ec3d5c30c79a134ab26d09d7889a2330292e23149035bde887ec722b1806efe  00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md
ebef370a46938be26cbb23e8027cdd5243667cd956f177f69c90d06d21f31d05  00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md
46922822f2a2fec9984d722db74ccf928c222581e9b1b7a8a3b6a9ccb11c1a19  ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md
bb578adabcd8ebddcb97c278e6589b935137f26f851b7218dd86c141744b70fe  AICWDF_v4.3_EN.md
b222b300cb38335e50dc4b9f1f1b23b1177bf4482ac4ef972e225888934b533b  GOV-REALIGN-001.md
Step 2.1 re-verification on the task branch: the same four input hashes.
```

### 5.2 Step 4, final run before commit A

```text
Step 4.1 to 4.3 outputs on branch task/gov-realign-001-cbt-aicwdf, after Step 3 and before this record was filled (Step 4.4 runs them again after filling).

4.1 staging (stderr included) and working-tree check:
warning: in the working copy of 'docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/01-discovery/04.01_SECURE_ASSESSMENT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/02-master-blueprint/02.10_BASELINE_FUTURE_AND_EXCLUSIONS.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/architecture/README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/00-governance/reference/AICWDF_v4.3_EN.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/production/tasks/GOV-REALIGN-001.md', LF will be replaced by CRLF the next time Git touches it
(working-tree check: no output)

4.2 path set:
PATH SET OK
18

4.3 content checks:
WHITESPACE OK
(draft marker check: no output)
bb578adabcd8ebddcb97c278e6589b935137f26f851b7218dd86c141744b70fe *-
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/CBT_RELEASE_DEFINITION.md
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/EXECUTION_CONTEXT.md
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/PERFORMANCE_AND_LOAD_PLAN.md
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/ROUTE_INTERACTION_MATRIX.md
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/TASK_PLAN.md
NOT FOUND in docs/00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md: docs/production/TOOLCHAIN.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/CBT_RELEASE_DEFINITION.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/EXECUTION_CONTEXT.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/PERFORMANCE_AND_LOAD_PLAN.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/ROUTE_INTERACTION_MATRIX.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/TASK_PLAN.md
NOT FOUND in docs/production/tasks/GOV-REALIGN-001.md: docs/production/TOOLCHAIN.md
```

### 5.3 Commit A SHA and attribution check (recorded in commit B)

```text
Step 5 outputs of every content commit, re-read from the commit objects before commit B:

commit A (2026-10-06): abd9a116de032d84b0b95ca1cd5005e241f8524b
tree 73f7b91f22326c1f231d35085f91f1024d62ca14; parent 8fdd60948a7c0f0de51c663b7b61b02dc38445fa
author:    Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>
committer: Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>
message: docs(governance): record the CBT release realignment, AICWDF v4.3 adoption and as-built stack decision
raw commit object: the subject line only; no body, no trailer
attribution check: no output
changed paths against the base: 18 (5 A, 13 M)

commit A2 (2026-10-11, review fix): 759d02029b8eada9ae25dc5ac800d305e0c6a4c1
tree d61523614d6e409d095c59216f316a90d79ab5c9; parent abd9a116de032d84b0b95ca1cd5005e241f8524b
author:    Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>
committer: Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>
message: docs(governance): restore the 00.04 entry order and mark superseded sprint rules in the living plan
raw commit object: the subject line only; no body, no trailer
attribution check: no output
changed against commit A: READ_ME_FIRST.md (blob 3f88eb989b8e4784d517d6557fb0f1f735eae9a9) and docs/production/PRODUCTION_COMPLETION_PLAN.md (blob 1e4854f6ae7017b84c3c43fa8871a2f312d579d6), 3 insertions and 3 deletions each
changed paths against the base: 18 (5 A, 13 M)
```

### 5.4 Pull request and full CI of commit A (recorded in commit B)

```text
Step 6 and the Step 7 fix, outputs as reported:

push of commit A (2026-10-07): new branch task/gov-realign-001-cbt-aicwdf, normal push, upstream set; remote branch at abd9a116de032d84b0b95ca1cd5005e241f8524b
push of A2 (2026-10-11): abd9a11..759d020, normal fast-forward push; remote branch at 759d02029b8eada9ae25dc5ac800d305e0c6a4c1

pull request #2: https://github.com/yusufarst/elligble/pull/2
opened 2026-10-07 by yusufarst, not a draft
title: docs(governance): record the CBT release realignment, AICWDF v4.3 adoption and as-built stack decision
at commit A: head abd9a116de032d84b0b95ca1cd5005e241f8524b, base main 8fdd60948a7c0f0de51c663b7b61b02dc38445fa, changedFiles 18, exactly one commit
PR FILES = COMMIT A PATHS
PR BODY EXACT
attribution check of title and body: no output
at A2: state OPEN, isDraft false, head 759d02029b8eada9ae25dc5ac800d305e0c6a4c1, base 8fdd60948a7c0f0de51c663b7b61b02dc38445fa, changedFiles 18; commits abd9a116de032d84b0b95ca1cd5005e241f8524b, 759d02029b8eada9ae25dc5ac800d305e0c6a4c1

full CI of the latest content commit A2: GREEN
run 51, databaseId 38078002666, attempt 1, event push, workflow CI
head task/gov-realign-001-cbt-aicwdf at 759d02029b8eada9ae25dc5ac800d305e0c6a4c1
status completed, conclusion success
startedAt 2026-10-10T18:59:36Z, updatedAt 2026-10-10T19:05:24Z
https://github.com/yusufarst/elligble/actions/runs/38078002666
Runtime (typecheck, unit, PostgreSQL integration): completed, success
Web client (typecheck, tests, build): completed, success
Container image (build and smoke test): completed, success
Browser end-to-end (firefox-1280): completed, success
Browser end-to-end (mobile-360): completed, success
Browser end-to-end (tablet-768): completed, success
Browser end-to-end (desktop-1280): completed, success
Browser end-to-end (webkit-390): completed, success
the only push run on A2; nothing re-run or dispatched

full CI of commit A (history): GREEN
run 50, databaseId 37557769730, attempt 1, event push, workflow CI
head task/gov-realign-001-cbt-aicwdf at abd9a116de032d84b0b95ca1cd5005e241f8524b
status completed, conclusion success
startedAt 2026-10-07T01:34:21Z, updatedAt 2026-10-07T01:41:54Z
https://github.com/yusufarst/elligble/actions/runs/37557769730
Runtime (typecheck, unit, PostgreSQL integration): completed, success
Web client (typecheck, tests, build): completed, success
Container image (build and smoke test): completed, success
Browser end-to-end (firefox-1280): completed, success
Browser end-to-end (tablet-768): completed, success
Browser end-to-end (webkit-390): completed, success
Browser end-to-end (mobile-360): completed, success
Browser end-to-end (desktop-1280): completed, success
the only push run on commit A; nothing re-run or dispatched

the executor did not poll either run (its app does not allow it); after the Owner signalled completion, it read each run record once
```

### 5.5 Landing commit on main (recorded by GOV-REALIGN-002)

Recorded by GOV-REALIGN-002 on 2026-10-26 (its §5.1 holds the check lines; first verified read-only by the E2E-002 Step 0 gate on 2026-10-12, E2E-002 §5.1):

| Field | Value |
|---|---|
| Landing commit | `00f3ef6d0386ceac23c32560c3dedba14f982d88`, the Owner's squash merge of pull request #2 (merged 2026-10-10T20:54:28Z by `yusufarst`) |
| Tree and parent | tree `75577edc0de585391f7d6249a2577b4a16aacee6`, equal to the tree of commit B `2bd7b06` (the pull request head); single parent `8fdd60948a7c0f0de51c663b7b61b02dc38445fa` |
| Identity and attribution | author `Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>`; committer `GitHub <noreply@github.com>` (GitHub's web squash merge, not an AI or tool attribution); signature verified by GitHub; message exactly `docs(governance): record the CBT release realignment, AICWDF v4.3 adoption and as-built stack decision`, no trailer, no AI attribution |
| CI on `main` | run 53 (databaseId 38085576996), attempt 1: seven jobs success, `firefox-1280` failed 7 of 21 (a reload waiting for a load event Playwright's Firefox driver did not report; not caused by this Task's documentation change); fixed by E2E-002; `main` green again from `b13fd40` (run 57) and `2cf2f21` (run 61) |

## 6. Independent review (RISK CLASS HIGH; recorded in commit B)

| Field | Value |
|---|---|
| Reviewer | Planning agent (Claude Project chat), relayed by the Owner; an independent second review for the Owner reached the same result |
| Date | 2026-10-11 (PASS on the latest content commit A2); earlier, 2026-10-08: FAIL on commit A |
| Scope | Complete pull request governance and content diff against §2.1, E1 to E13 and the review fixes R1 to R4 (pull request #2: commit A abd9a116de032d84b0b95ca1cd5005e241f8524b and A2 759d02029b8eada9ae25dc5ac800d305e0c6a4c1 on base 8fdd60948a7c0f0de51c663b7b61b02dc38445fa); full CI evidence of A2 (run 51) and of commit A (run 50); Step 0, Step 4 and Step 5 evidence of commit A and A2; AC-01 to AC-11 as applicable at A2; every review thread on pull request #2 |
| Result | PASS |
| Findings | No unresolved finding. The planning agent's first review passed commit A on 2026-10-07 without checking the pull request's open review threads; after the Owner's second review it was corrected to FAIL on 2026-10-08. Three review threads on pull request #2 (discussion_r4202171756, discussion_r4202171760, discussion_r4202171766), each resolved by the Owner and verified on GitHub on 2026-10-11: (1) AGENTS.md, commit identity: false positive; the thread cited commit 5697e64, which is not part of the pull request, and commits A and A2 both carry the Owner's author and committer identity; no change and no history rewrite. (2) Living plan: valid; §13 and the §6.1 IN PROGRESS row still stated rules that DEC-045 supersedes; fixed in A2 (R2 to R4). (3) READ_ME_FIRST.md: valid; 00.11 and 00.12 were read before 00.04 and its Git baseline inspection; fixed in A2 (R1). Both valid findings came from the package text, not from its execution. A2 was rebuilt independently: its tree d61523614d6e409d095c59216f316a90d79ab5c9 equals commit A plus exactly R1 to R4. Accepted without change: the nine Stage A execution notes, the Step 6 note that the executor did not poll CI, and the read-only thread listing re-run with an equivalent pattern. Carried to GOV-REALIGN-002, outside this Task: the durable record of the Owner's OD-10 decision; the living-plan text that predates that decision and the PR #1 landing; and the remaining DEC-042 wording (AGENTS.md "authorized when it serves the critical path" and "PRODUCT COMPLETION FIRST", READ_ME_FIRST.md step 11, living plan §14 "Resume procedure"). |

## 7. Safe next Task, limits and first response

**SAFE NEXT TASK:** GOV-REALIGN-002: `docs/production/EXECUTION_CONTEXT.md` and `docs/production/TOOLCHAIN.md` (pre-baseline P0 completion, including the verified toolchain state on the executor machine and the landing-commit record of GOV-REALIGN-001).

**DO NOT DO:**

- Do not change wording beyond what the approved package and Step 3 give.
- Do not change this record outside §1, §5 and §6.
- Do not edit frozen historical records.
- Do not close or reword any Production Blocker.
- Do not create TASK_PLAN.md or start any other Task.
- Do not stash, clean, reset, rebase, amend published commits, force push or merge.
- Do not add any AI, model or tool attribution anywhere.

**EXECUTOR FIRST RESPONSE (AICWDF §38), before any write:**

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-001 (PRE-P11 / PRE-BASELINE, not counted in P11 baseline)
TASK STATUS: READY / NOT READY
DEPENDENCIES: PASS / FAIL (package v0.3 approval and date; authorization with base, push, hook; Step 0; input hashes)
REFERENCES LOADED: ...
TOOLCHAIN: git, sha256sum, sed, diff: available / missing
GRAPHIFY: N/A
CONTEXT7: N/A
RISK CLASS: HIGH
DATABASE IMPACT: NONE; direct production DB access FORBIDDEN
COST IMPACT: NONE
ROUTE / INTERACTION IMPACT: NONE
UI / NAVIGATION / LOCALIZATION IMPACT: NONE
TEST PLAN: Step 4 and Step 5 checks; full CI on commit A; Step 7 local checks for commit B
SAFE TO IMPLEMENT: YES / NO
IF NO, BLOCKER: ...
```
