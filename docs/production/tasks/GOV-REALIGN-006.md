# GOV-REALIGN-006 — CBT-R1 Finite P11 Baseline Candidate and Dependency Freeze

## 1. Contract and current state

| Field | Value |
|---|---|
| Classification | BUILD / PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Risk | HIGH: finite release execution/dependency/approval control; documentation only |
| Status | VERIFYING / NOT DONE; targeted correction authorized after Independent Review STOP; **TARGETED RE-REVIEW PENDING**. Corrective exact-content CI, targeted Independent HIGH-risk re-review, explicit Owner review and applicable final-P11 prerequisites remain required |
| Owner authorization | Received 2026-10-30: READY FOR CANDIDATE PREPARATION ONLY. Safe synchronization, one Task branch, exact four documentation files, one controlled content commit/normal push/one PR, Task-specific CI-first publication and review handoff authorized. Targeted two-file corrective content publication is separately Owner-authorized in §6. |
| Objective | One finite candidate covering all P1 R01–R31 and DEC-044 G1–G10 with bounded outcomes, dependencies, external approval/unblock conditions, evidence, risks, proposed execution scopes and mechanically consistent counters |
| Base | main `77756e38ff4e289e7b6ebcda63d753749854756d`; PR #12 MERGED; GOV-REALIGN-005 DONE planning only; main CI #89 exact-SHA attempt 1 eight SUCCESS |
| Branch | `task/gov-realign-006-p11-baseline` |
| Dependencies | DEC-044/045, ADR-001, accepted P0–P10 Task records, current implementation evidence and verified predecessor landing. O01–O09/PB05 OPEN do not block preparation; they do block their applicable approval/implementation gates |
| Parallel safe | NO; one active authorized Task |
| DB/API/UI/localization impact | NONE implemented. Candidate describes future impacts/scopes and existing invariants only; no UI polish, role/route/schema or language change |
| Cost/vendor impact | No dependency, provider, package or paid service introduced; existing automatic CI only. Actual school cost facts remain UNKNOWN |
| Independent HIGH-risk Review | STOP on original content 69f1564: external READY/DONE gate conflation, as reported by Owner. Targeted correction under §6; current status **TARGETED RE-REVIEW PENDING**, no PASS inferred |
| Owner review / final P11 approval | PENDING / NOT GRANTED. Preparation authorization is not final P11 approval; P1 §8 P5/O09 and P6/O07 prerequisite approvals remain absent |
| Content / CI / PR | Original content `69f156433832f849fa0d136b743cb004a9d90422`, PR #13 OPEN, CI #90 (41035113018) attempt 1 eight SUCCESS. Corrective SHA/CI reported after publication outside its own commit; no evidence commit authorized now |
| Definition of DONE | Accepted candidate outcome with required exact-content CI, independent/Owner reviews and applicable prerequisite approval gates explicitly recorded under separate final evidence authority. Until then VERIFYING; no activated P11 or successor |

### Original candidate-publication allowlist (historical; targeted scope in §6)

1. `docs/production/TASK_PLAN.md`
2. `docs/production/tasks/GOV-REALIGN-006.md`
3. `docs/production/PRODUCTION_COMPLETION_PLAN.md`
4. `docs/DOCUMENT_MANIFEST.md`

No fifth file, P1–P10 artifact edit, application/runtime/frontend/test/workflow/fixture/dependency/database/migration change, new ADR/policy approval, blocker closure, production access/deployment, heavy local suite, Docker/global environment/process/port operation, destructive Git/history rewrite, force push, merge or successor execution. MULTIPLECORP, BANTUKASIR and PRANATA UNY resources remain untouched. Future file proposals in the candidate grant no permission now.

### Acceptance and verification

- Exactly one unapproved/inactive finite baseline candidate; complete R01–R31 and G1–G10 mapping, with no delivered-history count or release-scope reduction.
- Every registered candidate row/card has stable ID, bounded outcome, requirement IDs, dependencies/status/priority/risk, acceptance/tests/evidence, DB/API/UI/localization/cost/vendor impacts, responsible approval authority and exact unblock conditions.
- Reconcile carried IDs and completed history; no reopening DONE or silently superseding existing Tasks. All new proposed IDs checked against current records/living plan.
- Distinguish BLOCKED/TODO/READY and actual active preparation. No implementation READY while policies/schema/scope/access/evidence/tools remain unresolved.
- Candidate counters/checklist/cards/requirement/gate tables match actual rows; graph acyclic, no dangling internal/external reference or final-gate self-dependency.
- Assess P1 §8 as well as DEC-045: detailed P5/O09 and numeric workload/budget P6/O07 approval are required before final P11 approval. P0–P10 planning acceptance is not those approvals. Other applicable P2/P4/P9/P10 sufficiency remains a required review judgment, not silently certified.
- Record actual PR #12 landing and CI #89; synchronize living-plan active/checkpoint fields and document index in same change, preserving historical verification, completed UI states/cosmetic deferment and all OPEN decisions.
- Lightweight local gates: exact four-file unstaged/staged scope, source/reference/ID/coverage checks, cycle/counter/status consistency, immutable P1–P10/application/test/workflow integrity, whitespace, Owner identity and secrets/attribution.
- Task-specific verification order: lightweight preconditions → one content commit → normal push/one PR → automatic unchanged existing CI on exact SHA, attempt 1, eight jobs SUCCESS on ubuntu-24.04. Read actual logs/test inventory; do not freeze future suites to historical counts or skip/weaken/rerun tests.
- STOP for Independent HIGH-risk Review, explicit Owner review and final P11 decision. No evidence commit or candidate approval until both reviews and applicable prerequisite gates are satisfied.

## 2. Physical entry and predecessor landing

Verified 2026-10-30 before mutation: root `C:/Projects/ELLIGBLE`; CLEAN on completed `task/gov-realign-005-integrated-p7-p10`, HEAD `c3caa1e0a57dddce3db4d10f3d487a20364a48d2`; local main/origin/main `a16cbf59265b7d6c2dae1b1c90c9e0b3eb10439e`. No staged/unstaged/untracked changes. Actual remote main `77756e38ff4e289e7b6ebcda63d753749854756d`; PR #12 CLOSED/MERGED with that landing SHA and task head c3caa1e; no open PRs.

Configured author and committer are **Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>**, verified through config and effective Git identity. No identity was set/changed. GitHub authenticated user **yusufarst**, using only the ELLIGBLE-specific `$HOME/ELLIGBLE-evidence/gh-config` for gh commands.

Safe fetch updated origin/main; local main was an ancestor and was fast-forwarded only. Created exactly the authorized Task branch from verified current main. HEAD and origin/main both equal the base above; CLEAN before documentation preparation. No reset, clean, stash, rebase, replacement checkout/worktree or discarded work.

### CI #89 independently verified

[Main CI #89](https://github.com/yusufarst/elligble/actions/runs/41028807175), run **41028807175**, automatic push, **attempt 1**, exact landing SHA above, COMPLETED/SUCCESS. All eight jobs individually read as SUCCESS, each runner label ubuntu-24.04:

| Job | Verified conclusion |
|---|---|
| Runtime typecheck/unit/real PostgreSQL integration | SUCCESS |
| Web typecheck/tests/build | SUCCESS |
| Container image build/smoke | SUCCESS |
| Browser webkit-390 | SUCCESS |
| Browser desktop-1280 | SUCCESS |
| Browser firefox-1280 | SUCCESS |
| Browser tablet-768 | SUCCESS |
| Browser mobile-360 | SUCCESS |

GOV-REALIGN-005 accepted P7–P10 planning on content `c5866da6988be47f43f3e2745cb70c05c9fa2e47`, CI #87, final evidence `c3caa1e0a57dddce3db4d10f3d487a20364a48d2`; its accepted record stays unchanged. CI #89 confirms existing regression, not capacity/physical-device/restore/UAT/release readiness. Historical content CI #87 records 344 web tests and 22 E2E per browser; this Task must read its own candidate logs rather than copy counts.

## 3. Context and authority gate

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-006
SAFE TO IMPLEMENT: YES, EXACT FOUR DOCUMENTATION FILES ONLY
ROOT: C:/Projects/ELLIGBLE
BRANCH: task/gov-realign-006-p11-baseline
HEAD / ORIGIN MAIN AT ENTRY: 77756e38ff4e289e7b6ebcda63d753749854756d
WORKING TREE BEFORE EDITS: CLEAN
TARGET: full CBT-R1 under DEC-044; production NOT READY
P11: NOT APPROVED; candidate preparation only
NEXT SAFE ACTION: prepare, validate and publish candidate; CI then stop for reviews
```

Rehydrated 00.04/AGENTS/READ_ME_FIRST, decision hierarchy/current-release scope/DEC-045/ADR-001, accepted predecessor records, P1 §8 and relevant P2–P10 planning/living plan/manifest and current source/test anchors. Read-only Graphify query used as derived navigation (old 491-node graph); actual repository files prevail, no graph rebuild. Source reread confirms v1 MULTIPLE_CHOICE_SINGLE/A–E validator, exact selectedOptionId answer contract, BASELINE_SINGLE_CHOICE_V1 scoring, honest server-ACK queue and existing role/API/operations limitations. No source inspection is claimed as new rendered/device/load evidence.

## 4. Candidate outcome and preserved gates

The candidate registers **33** unique remaining Tasks, **33 BLOCKED**, all other status counts zero and **0% progress**. Counts derive mechanically from candidate rows, not estimates. GOV-REALIGN-006 and completed PRE-P11/pre-adoption work are excluded. All 31 requirement rows have dedicated implementation/evidence ownership beyond final-regression catch-all; all ten G gates remain required/not PASS.

The first proposed implementation Task is **SEC-001**, currently BLOCKED, after approved O09/P5, applicable final P11 approvals, precise reason/audit/schema/route/file contract and separate Owner authorization. No execution begins here. Identity/all-type/transfer/security/integrity precede release evidence; cosmetic refinements remain deferred without functional-accessibility waiver.

Final P11 approval remains BLOCKED at minimum on P1 §8's explicit detailed P5/O09 approval and numeric/workload P6/O07 approval plus missing required reviews/Owner decision. Other applicable sufficiency gates must be reviewed, not inferred. O01–O09, PB05 and all applicable OPEN blockers remain OPEN; P6 numbers PROPOSED; actual school VPS/device/RPO/RTO/cost/signatory facts UNKNOWN. No P11 activation, TASK baseline DONE, policy/ADR approval, load/device/restore/UAT/release PASS or production-ready claim.

## 5. Original candidate verification/publication record and stop (history)

Local deterministic candidate guards **PASS**, before staging/publication: exact four approved paths; **33** unique registered rows/cards/unchecked checklist items; **78** internal dependency edges, acyclic, no dangling internal reference; **33** defined external gates; all **31** P1 requirements assigned beyond final-regression catch-all; all **10** G gates; all required per-Task contract fields; **16** existing local Markdown links; status/counters consistent (33 BLOCKED, other statuses zero, 0%); **26** new IDs checked against baseline canonical/history and **7** carried IDs retained. Protected application/runtime/frontend/database/test/workflow/governance/ADR/P1–P10/predecessor/PB-backlog content is unchanged. Whitespace and secret-shaped-content/attribution-trailer checks PASS, exact living-plan/manifest diff reviewed. No application or heavy local test PASS is implied.

The initial pre-publication ID guard found the proposed SEC-002/SEC-003 names already used by historical capability records. Before any commit/push, the candidate proposals were renamed to **SEC-OPS-001/SEC-RELEASE-001**; replacement names are absent from baseline history. Original historical IDs/content were preserved; full deterministic guards were rerun PASS after this in-scope correction. This is candidate-construction evidence, not a failed/retried CI run.

Final publication still requires rechecking exact staged four-file scope, `git diff --cached --check`, effective Owner identity and unchanged checkpoint; no staged guard or automatic content CI is predeclared PASS before it runs.

Create exactly one controlled content commit with Owner identity/software-only subject, inspect fuller/raw metadata and normal push to the existing authorized Task branch, then exactly one PR to main. Require automatic exact-content attempt-1 eight-job SUCCESS. The content commit cannot record its own SHA/CI; report actual values outside the commit. Do not create an interim/evidence follow-up commit to backfill them.

On any CI failure stop with original evidence, no rerun/dispatch/cancel or automatic corrective commit. After CI PASS hand over for independent/Owner review. **No final evidence commit authorized now**; no DONE, final P11 approval, merge, production action or next Task.

## 6. Owner-authorized targeted review remediation — 2026-10-30

### 6.1 Review finding, authority and entry checkpoint

Owner reports the Independent HIGH-risk Review result on original content `69f156433832f849fa0d136b743cb004a9d90422` as **STOP — external READY/DONE gate conflation**. CI #90 SUCCESS did not establish executable lifecycle semantics. No reviewer identity or external report is invented.

The original common §4.3 required every external gate to be satisfied before READY, while §8 mixed pre-execution authority/availability/inputs with outputs of the same Task. Exact findings:

- **LEGAL-001:** PB01/PB02/PB03/PB10 approved artifacts and controlled closure were included as entry blockers even though producing those approved artifacts/closure evidence is the Task outcome; LEGAL-SIGNATORIES also required already-approved final artifacts.
- **VERIFY-INTEGRITY-001:** PB07-REVIEW required the report review PASS before the Task producing/verifying that report could start.
- **SEC-RELEASE-001:** SECURITY-REVIEW required completed independent final review before execution of final security verification.
- **RELEASE-001:** UAT-SIGNATORIES combined prior nomination/authority with actual UA01–UA08 signoffs; RELEASE-AUTHORITY also included the same Task's completed rehearsal/final declarations as inputs.
- **Executor audit under Owner correction #5:** equivalent timing ambiguities were found in operating-fact manifests, final cost declarations and PB05/PB06/PB07/PB11/PB12 outcomes. These additional observations are the executor’s scoped audit, not an invented separate Independent Review report. No internal dependency defect was identified or changed.

Owner explicitly authorizes **one** corrective content commit/normal push to the existing Task branch and PR #13, limited to:

1. `docs/production/TASK_PLAN.md`
2. `docs/production/tasks/GOV-REALIGN-006.md`

This two-file correction supersedes the earlier four-file publication allowlist **only for this corrective action**. Living plan/manifest, approved phase documents, application/tests/CI/fixtures/dependencies/database and all other paths are unchanged. No new Task, second automatic correction, evidence commit, policy approval, blocker closure, baseline activation, implementation, force push, merge or deployment.

Physical entry reverified: root `C:/Projects/ELLIGBLE`, branch `task/gov-realign-006-p11-baseline`, HEAD and upstream both original content SHA above, working tree CLEAN with no staged/untracked work. Owner configured/effective author and committer **Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>**; no identity changed. GitHub user yusufarst via dedicated GH_CONFIG_DIR; PR #13 OPEN at exact SHA. CI #90/run 41035113018 completed SUCCESS, attempt 1; all eight jobs individually reverified SUCCESS. Its original 344-web/22-E2E-per-browser regression evidence remains historical, not a resolution of the governance review STOP.

### 6.2 Exact bounded correction

- §4 READY now consumes only applicable §8 input prerequisites: approved policy/design where required, authority, access, safe handling and reviewer/signatory availability. Approved expected outcomes and defined tests replace wording that could imply already-executed tests before implementation.
- Each of the 33 Task cards refers to those entry prerequisites; its own report/review/signoff/closure is generated during execution. Internal predecessor DONE evidence remains a valid input and all internal dependencies stay unchanged.
- §8 retains the same external gate IDs but gives **every definition** separate READY-input and DONE/release-outcome columns. LEGAL-001's master/card entry references only LEGAL-SIGNATORIES; its four PB artifact/closure outcomes remain mandatory.
- Four affected cards explicitly state timing: qualified legal authority/access/handling before LEGAL execution, independent reviewer availability/assignment before verification when needed, nominated/authorized school UAT participants/signatories before UAT; approved artifacts, review PASS, actual UA01–UA08 signoffs and authorized controlled closures before DONE/release as applicable.
- All other external definitions were reviewed: policy/architecture approvals remain real inputs; operating configuration/results, measured facts, tested alert/intervention/restore/device/security/integrity evidence and final declarations produced by the responsible Task remain completion evidence. Cost approval still precedes any new recurring expense; upstream completed evidence remains required where the unchanged dependency graph demands it.
- Preserve 33 candidate Tasks, all BLOCKED, 78 internal edges, original R01–R31/G1–G10 mappings, counters/history, O01–O09 OPEN, PB05/all applicable blockers OPEN, P5/O09 and P6/O07 final-P11 prerequisites, NOT APPROVED / NOT ACTIVE and all LOCKED/FROZEN decisions. No G7 permission for real student data is introduced.

### 6.3 Targeted verification and publication gates

Targeted local deterministic guards **PASS**, before staging/publication: exactly the two authorized paths; all **33** Task IDs, **78** internal edges, acyclic graph, all-BLOCKED statuses/counters and 0% progress unchanged; original **31** requirement and **10** release-gate mappings byte-preserved. All **33** external definitions now have distinct READY-input and DONE/release-outcome columns, with the same gate IDs. Master-row references recompute from **98 to 94**, across **26** referenced gate IDs: only the four legal closure references were removed from LEGAL-001 entry; they remain mandatory completion outcomes. **15** local Markdown links resolve in the two reviewed files. Per-Task acceptance/tests/impacts/proposed paths and historical completion evidence are preserved; all files outside this two-file allowlist remain unchanged. Owner identity, whitespace, secret-shaped-content and attribution-trailer guards PASS. Exact diff reviewed; final staged scope/whitespace/identity/tree checks remain required before committing. No application/heavy local tests or new CI PASS is implied.

After lightweight gates PASS, create exactly one controlled corrective content commit with Owner identity, inspect fuller/raw metadata and normal push to the existing PR #13. Its SHA and new automatic attempt-1 eight-job CI on ubuntu-24.04 must be independently read after publication; this commit never records its own SHA. No CI #90 rerun, manual dispatch/cancel or automatic second corrective commit. A new CI failure stops the work.

Current review status: **TARGETED RE-REVIEW PENDING**. After new exact-content CI PASS, STOP for targeted Independent HIGH-risk re-review and explicit Owner review. No evidence commit, DONE, final P11 approval, blocker closure or implementation is authorized.
