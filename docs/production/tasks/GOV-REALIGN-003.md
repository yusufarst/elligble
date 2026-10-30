# GOV-REALIGN-003 — CBT-R1 Release Definition (P1) and Execution-Guard Alignment

## 1. Contract and Task record

| Field | Value |
|---|---|
| Classification | BUILD / PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Risk | HIGH: governance execution-guard alignment; no new governance policy or product semantics |
| Status | DONE (2026-10-30); final content/reviews/evidence in §6 |
| Owner authorization | Explicit GOV-REALIGN-003 bounded six-file contract, received 2026-10-30; branch/docs/content commit/normal push/one PR YES; squash merge/deployment NO |
| Objective | One complete derived P1 scope/acceptance/evidence/gap map for CBT-R1, and only the legacy execution wording carried by GOV-REALIGN-002 §2.2 aligned to DEC-045 |
| Base | `8f51c77c081a5aa06ecbeedf054ebb3c310d4fbb` on main; PR #9 merged; main CI #79 attempt 1, eight SUCCESS |
| Branch | `task/gov-realign-003-cbt-r1-release-definition` |
| Dependencies | GOV-REALIGN-002 DONE; DEC-044/045 LOCKED; ADR-001 ACCEPTED; completed UI Part 3 and clean verified main. P1 approval remains a separate exit gate |
| Parallel safe | NO; exactly one active Owner-authorized Task |
| Database / API / route / UI / localization impact | NONE; existing application, tests, fixtures and workflow immutable in this Task |
| Cost/vendor impact | No new vendor or recurring dependency; existing GitHub Actions usage only; no production action |
| Required tools | Git/Node/gh (dedicated ELLIGBLE GH_CONFIG_DIR), source inspection; existing automatic CI. Graphify consulted as derived navigation only |
| Independent review | PASS, Owner-confirmed Independent HIGH-risk Review of final content 6c9d311; recorded 2026-10-30 (§6) |
| Owner P1 approval | PASS, 2026-10-30: "P1 APPROVED — GOV-REALIGN-003 — SHA 6c9d311" (§6) |
| PR / content SHA / own CI | [PR #10](https://github.com/yusufarst/elligble/pull/10) OPEN; final content `6c9d3111674230dfafd78a152f10ba3b16ce9985`; CI #81 (41007229824), attempt 1, eight SUCCESS on ubuntu-24.04 (§6). This evidence commit never records its own SHA |

### Exact allowlist

1. `docs/production/CBT_RELEASE_DEFINITION.md` (new derived P1 artifact).
2. `docs/production/tasks/GOV-REALIGN-003.md` (this contract/status/evidence).
3. `docs/production/PRODUCTION_COMPLETION_PLAN.md` (current Task, predecessor landing and continuity/gaps references).
4. `docs/DOCUMENT_MANIFEST.md` (new artifact/record index).
5. `AGENTS.md` (only critical-path authorization sentence and PRODUCT COMPLETION FIRST item identified in GOV-REALIGN-002 §2.2).
6. `READ_ME_FIRST.md` (only step 11 identified by the same carry-forward).

All other paths forbidden. No application/tests/workflow/fixture/dependencies, TASK_PLAN.md, P2–P10 detailed specifications, baseline declaration, new policy, scope reduction, PB closure, Docker/heavy local tests, production intervention, other-project resources, history rewrite/force push/merge or next Task. PRODUCT COMPLETION FIRST remains the product priority; actual execution needs explicit Owner-authorized bounded READY Task under DEC-045. No other LOCKED/FROZEN rule is superseded.

### Acceptance criteria

- AC01: Exact six-file content diff against base; evidence commit later changes only this record. No source/test/workflow/dependency/fixture change.
- AC02: P1 covers every DEC-044 §3 area, all §4 roles, §5/§5A/§6/§12 invariants/policies, all eight question formats, G1–G10, PB01–PB12 and P2–P11 inputs; each requirement has implementation, evidence, gap, dependency, responsible party and measurable acceptance.
- AC03: DELIVERED/PARTIAL/MISSING/BLOCKED/EVIDENCE PENDING distinguished; no capacity/device/legal/UAT/production or complete-scope claim based only on pilot CI. PB04 CLOSED preserved; other blocker states preserved.
- AC04: Governance edits limited to the three carried wording locations; DEC-045 authority clarified without weakening product priority or other rules. No canonical conflict or new decision.
- AC05: Living plan records PR #9 landing/CI #79, Part 3 DONE, completed predecessors and cosmetic deferment; only this Task active, no P11 baseline/counters/other Task authorization.
- AC06: References/coverage/Markdown tables, exact diff, whitespace, secrets and attribution guards PASS; configured Owner author/committer, software-only raw message, no trailers/attribution; normal publication only.
- AC07: Exact content SHA automatic push CI, attempt 1, eight jobs SUCCESS on ubuntu-24.04, full actual inventories recorded; no skips/retries/test weakening or rerun/dispatch to obtain PASS.
- AC08: Independent HIGH-risk Review PASS and explicit Owner approval of P1 before DONE and exactly one record-only final evidence commit. No merge by executor.

## 2. Entry and first executor response (00.12 / AICWDF §38)

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-003; PRE-P11 / PRE-BASELINE, not counted in P11
TASK STATUS AT ENTRY: READY
ROOT: C:/Projects/ELLIGBLE
BRANCH AT ENTRY: main
HEAD / ORIGIN MAIN / REMOTE MAIN: 8f51c77c081a5aa06ecbeedf054ebb3c310d4fbb
WORKING TREE AT ENTRY: CLEAN (no staged, unstaged or untracked paths)
DEPENDENCIES: PASS; PR #9 MERGED, landing SHA above; CI #79 (40506126353), attempt 1, eight SUCCESS
OWNER IDENTITY: Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>, configured; gh user yusufarst
AUTHORIZATION: exact six paths, branch/content commit/normal push/one PR YES; merge/deployment NO
RISK: HIGH
DATABASE/API/UI/COST IMPACT: none; existing CI usage only
RELEASE / BASELINE GATE: NOT PASSED; P11 not yet published
RELEVANT GAPS: full DEC-044 scope, PB05/06/07/11/12 and legal blockers; missing P1–P11 artifacts
OWNER ITEMS: detailed P5 matrix, legal artifacts, ID format, production/device/UAT facts; final P1 approval
SAFE TO IMPLEMENT: YES, only this documentation contract
NEXT SAFE ACTION: create authorized Task branch, write bounded derived P1 and carried wording alignment
```

Physical entry checks and remote facts were re-read on 2026-10-30. Remote PR #9 merged at 2026-10-27T12:44:14Z, no open PR at entry. Main CI #79 jobs: Runtime, Web, image, desktop-1280, mobile-360, tablet-768, firefox-1280 and webkit-390 all SUCCESS. Existing Part 3 Task record §9.5/§9.6 takes precedence over stale living-plan checkpoints, corrected here without rewriting failure history.

## 3. Verification-order contract and stops

Owner authorizes **this Task's own CI-first order**: lightweight local deterministic scope/reference/coverage/whitespace checks → one controlled content commit → normal push/one PR → automatic full CI on exact content SHA → independent HIGH review and explicit Owner P1 approval → exactly one record-only evidence commit/normal push. Previous UI amendments are not reused as authorization. No local npm ci, heavy unit/build/browser suite or Docker.

Required CI: Web typecheck/full Vitest/build; Runtime typecheck/unit/real PostgreSQL integration; image build/smoke; all five existing browser projects. All eight jobs must finish SUCCESS on ubuntu-24.04, attempt 1. Record actual test counts from this run, not a copied baseline result. No workflow edit, manual dispatch, rerun, cancellation, skip, retry or assertion weakening. Local guards do not replace CI; documentation CI does not replace P1 human acceptance.

STOP for unexpected working/remote state, identity mismatch, invalid references/coverage, scope expansion, LOCKED conflict, secrets/attribution, failed CI or missing review/Owner P1 approval. Preserve all work. No automatic corrective commit or unrelated Task. At missing reviews stop after publishing the reviewable exact artifact/evidence; record PENDING honestly. Ordinary CI waiting is not approval.

## 4. Status history and evidence

| Date | Status | Evidence |
|---|---|---|
| 2026-10-30 | READY | Owner authorizes this exact HIGH-risk six-file contract; entry guards PASS on clean main 8f51c77 |
| 2026-10-30 | IN_PROGRESS | Exact authorized branch created; canonical sources and targeted implementation evidence re-read; P1 artifact and carried guard alignment prepared |
| 2026-10-30 | VERIFYING | Six-file content prepared for deterministic guards and publication; own CI and both required human approvals pending |
| 2026-10-30 | VERIFYING | Owner authorizes one targeted two-file corrective content commit for the Independent HIGH-risk Review finding in living plan §1; new exact-SHA CI, targeted independent re-review and Owner P1 approval required. No evidence commit authorized in this correction |
| 2026-10-30 | DONE | Final content 6c9d311, CI #81 attempt 1 eight SUCCESS, Independent HIGH-risk Review PASS and explicit Owner P1 Approval PASS; Owner authorizes exactly one final Task-record-only evidence commit and normal push to existing PR #10 (§6) |

### Local content verification

Review the exact staged diff and require: six allowed paths only; no untracked/unrelated work; no source/test/workflow/fixture delta; references exist; R01–R31, G1–G10 and PB01–PB12 present; original OPEN/CLOSED states retained; only the three allowed execution-wording edits; `git diff --cached --check`; Owner identity and raw software-only message inspection after commit. Actual guard outcome is recorded in the final evidence after execution; no unexecuted check is claimed PASS here.

### Completion evidence / Independent HIGH-risk Review / Owner P1 approval

PENDING. No DONE claim. After exact content CI PASS, submit the P1 artifact and PR for independent review and explicit Owner P1 approval. After both are received and verified against this content, record exact SHA/run/job/test evidence, guard outcomes, review reference/date/result and Owner approval in one Task-record-only evidence commit. The evidence commit does not record its own SHA and does not require a second evidence commit or its own CI as a DONE prerequisite (00.12 §5). Owner squash-merges separately; the next authorized Task records landing.

## 5. Owner-authorized targeted review remediation — 2026-10-30

The Owner reports an **Independent HIGH-risk Review finding** against content `eef796e41589ffe7a13834be77074118a9b530a8` on existing [PR #10](https://github.com/yusufarst/elligble/pull/10): living plan §1 still says the product is ready for a supervised pilot once infrastructure/legal blockers are satisfied. That retained sentence overstates readiness and can imply that those blockers are the only remaining conditions, despite the full DEC-044 scope and release gates. This is a documentation finding, not evidence of a new application defect. No Independent Review PASS or Owner P1 approval is claimed.

Historical content verification remains intact: [CI #80](https://github.com/yusufarst/elligble/actions/runs/40992238686), run 40992238686, automatic push attempt 1, exact eef796e content SHA above, COMPLETED / SUCCESS, all eight jobs on ubuntu-24.04. Web typecheck, 344/344 tests in 34 files and build; runtime typecheck/unit/real PostgreSQL; image build/smoke; 22/22 E2E in each of desktop-1280, mobile-360, tablet-768, firefox-1280 and webkit-390 PASS. This successful CI does not resolve the review finding or approve P1; #80 is not rerun.

The Owner explicitly authorizes **one corrective content commit**, normal push to the same branch/PR #10, changing only `docs/production/PRODUCTION_COMPLETION_PLAN.md` and this Task record. The correction qualifies the implemented/tested journey as teacher-managed single-choice, removes the supervised-pilot readiness claim, states that this bounded journey does not prove CBT-R1 production readiness, and explicitly preserves the entire DEC-044 §3 scope and mandatory G1–G10 with their required evidence. Infrastructure/legal blockers are not an exhaustive release checklist. All historical evidence, blocker states, completed predecessors and LOCKED decisions are preserved; the rest of the living plan and the P1 artifact are unchanged.

Entry reverified CLEAN at exact eef796e (full above), expected branch, remote PR #10 OPEN at that SHA, configured Owner identity and gh user yusufarst, and terminal CI #80 eight SUCCESS. Review the exact two-file diff and run lightweight scope/whitespace/identity/attribution guards only before commit. After creation inspect the raw commit and report its actual SHA outside its own contents; no commit records its own SHA. Require new automatic CI on the corrective SHA, attempt 1, all eight jobs SUCCESS on ubuntu-24.04 with the complete existing inventories. No source/test/workflow/dependency/fixture or unrelated document edit, local heavy test, CI #80 rerun, force push, evidence commit, merge or next Task.

**Exit: STOP for targeted Independent HIGH-risk re-review and explicit Owner P1 approval after the new CI PASS.** Both remain PENDING; Task remains VERIFYING / NOT DONE. Any CI failure or unexpected repository state stops publication/continuation as applicable. The corrective content SHA and its actual CI result are resolved after publication and reported; no prospective PASS or review approval is fabricated.

## 6. Final completion evidence and P1 approval — 2026-10-30

**GOV-REALIGN-003: DONE.** HIGH risk, PRE-P11 / PRE-BASELINE, **NOT COUNTED IN P11 BASELINE**. This final section resolves the earlier PENDING/VERIFYING checkpoints in §1–§5 without deleting their historical evidence. The Owner explicitly authorizes exactly one final evidence commit changing only this Task record, normal push to the existing branch/PR #10, no new PR and no merge.

### 6.1 Final content and complete CI

Approved final content: **`6c9d3111674230dfafd78a152f10ba3b16ce9985`**, subject `docs(production): correct CBT-R1 readiness qualification`, parent `eef796e41589ffe7a13834be77074118a9b530a8`. [CI #81](https://github.com/yusufarst/elligble/actions/runs/41007229824), run **41007229824**, automatic push, **attempt 1**, exact final content SHA, terminal **COMPLETED / SUCCESS**, all **eight jobs SUCCESS on ubuntu-24.04**. Run SHA, attempt, job conclusions/runner labels and the existing logs were re-read before this evidence edit.

| Job | Job ID | Verified result |
|---|---|---|
| Web client | 123904775830 | SUCCESS: typecheck, **344/344 tests in 34 files**, production build |
| Runtime | 123904775618 | SUCCESS: typecheck, unit tests, real PostgreSQL integration |
| Container image | 123905060934 | SUCCESS: image build and smoke test |
| Browser mobile-360 | 123905060977 | SUCCESS: **22/22 E2E** |
| Browser tablet-768 | 123905060982 | SUCCESS: **22/22 E2E** |
| Browser webkit-390 | 123905060991 | SUCCESS: **22/22 E2E** |
| Browser desktop-1280 | 123905061033 | SUCCESS: **22/22 E2E** |
| Browser firefox-1280 | 123905061052 | SUCCESS: **22/22 E2E** |

The complete existing suites were retained; no tests/assertions/workflows/dependencies were changed, skipped, retried or weakened by this Task. No heavy local tests or Docker/global-resource operations were performed. Previous content `eef796e41589ffe7a13834be77074118a9b530a8`, its successful CI #80 (40992238686, attempt 1, eight SUCCESS) and the Independent Review finding remain preserved in §5. Passing CI #80 did not resolve its documentation overstatement. The single Owner-authorized corrective content commit above changes only living plan §1 and this record: the teacher-managed single-choice journey is implemented/tested, not proof of CBT-R1 production or supervised-pilot readiness; full DEC-044 §3 and G1–G10 remain mandatory. CI #80 was not rerun.

Both content commits were inspected with `git log --format=fuller` and their raw messages: author and committer **Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>**, descriptive software-only subjects, no trailers or attribution. Initial content changed exactly the six approved paths; the authorized correction changed exactly its two approved paths. Deterministic guards verified exact scope, local references/requirement coverage and whitespace for the initial content, and unchanged living-plan content outside §1/historical record preservation for the correction.

### 6.2 Independent review and explicit Owner P1 approval

The Owner's final evidence authorization dated **2026-10-30** explicitly confirms **Independent HIGH-risk Review: PASS** and **Owner P1 Approval: PASS** for final content `6c9d3111674230dfafd78a152f10ba3b16ce9985`, CI #81 attempt 1 and existing open PR #10, after the targeted review remediation. These are Owner-confirmed review results, not executor self-approval; no reviewer identity or external report is invented. The explicit final approval is:

> P1 APPROVED — GOV-REALIGN-003 — SHA 6c9d311

The approved P1 scope remains **derived from DEC-044, DEC-045 and ADR-001**, with no policy supersession or scope reduction. Its R01–R31 requirement/evidence/gap map, roles, G1–G10, PB01–PB12 and P2–P11 prerequisites are accepted as P1 planning, not as delivery of the missing capabilities. Approval is durably established by this Task record, as provided in the unchanged P1 artifact §9; its earlier submitted-state header and other documents are not edited in this record-only commit.

### 6.3 Preserved release boundaries and final publication gate

- **All OPEN production blockers remain OPEN**; PB04 remains CLOSED. No blocker is closed by this evidence commit.
- Full DEC-044 §3 scope and **G1–G10 remain mandatory**, without a release-gate PASS claim.
- **P11 baseline NOT APPROVED; TASK_PLAN.md NOT CREATED; production readiness NOT ACHIEVED.** P1 approval alone does not authorize P11 or another Task.
- All previously completed Tasks retain their completed states; remaining unfinished scope and the Owner's cosmetic deferment remain unchanged.
- Living plan/manifest/P1 artifact/application/tests/fixtures/workflow/dependencies and all other files remain identical to approved content. The living plan's pre-evidence checkpoint is historical; this Task record supplies the completion state under DEC-045. The next separately authorized Task records the Owner's eventual landing SHA.

Pre-evidence entry was CLEAN on the expected Task branch with local HEAD, remote-tracking HEAD and actual PR #10 head equal to approved content; Owner author/committer identity and gh user yusufarst verified, PR #10 OPEN, exact-SHA CI #81 verified above. Final local deterministic gate requires exactly this one-file staged diff, preserved history/release boundaries, `git diff --cached --check`, no unknown changes/secrets/attribution, and unchanged content outside this record. Inspect the evidence commit's fuller log and raw software-only message after creation, report its actual SHA outside its own contents, then normal push to the same branch/PR #10. **Exactly one evidence commit; its own automatic CI is not a DONE prerequisite under 00.12 §5 and does not require another evidence commit.** Owner squash-merges separately. No merge, production deployment or next Task is performed here.
