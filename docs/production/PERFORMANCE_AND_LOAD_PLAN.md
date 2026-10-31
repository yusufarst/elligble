**Status:** DRAFT / SUBMITTED FOR REVIEW; NOT APPROVED; NO LOAD EXECUTION OR CAPACITY RESULT
**Task:** GOV-PERF-001; HIGH; PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE
**History:** GOV-REALIGN-004 accepted P6 planning only; original §1–§5 and every L/B numeric row preserved. Exact O07 approval submission in §6, NOT APPROVED.
**Original package baseline:** `2c6a4860a71a40b5cfb344eae3b964dd5b983125`; verified 2026-10-30
**Numeric budgets/workloads:** PROPOSED / OWNER APPROVAL REQUIRED (P2 O07)

# CBT-R1 performance, concurrency and integrity plan

## 1. Target, current evidence and safety

DEC-044 §9 G3/G4/G5 and §10 require approximately **1,000 concurrent Students**, school NAT, start/save/reconnect/submit bursts, restart/recovery, DB contention, timer/status and supervisor load. [ADR-001](../decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md) current one-process modular monolith/default pool has **no 1,000-student capacity evidence**. Existing reference nginx smoke/current five-browser CI are regression evidence, not load/real-device proof. No load result, tuning, infrastructure change or test execution is produced by this documentation Task.

Use [P1 R01–R31](CBT_RELEASE_DEFINITION.md), [P2 shared definitions/O01–O09/consolidated map](CBT_DOMAIN_RULES_SPECIFICATION.md), [P3 actual Wxx and proposed Fxx contracts](ROUTE_INTERACTION_MATRIX.md), [P4 A01–A05](CBT_ARCHITECTURE_DELTA_REVIEW.md) and [P5 enforcement](CBT_PERMISSION_MATRIX.md). Unimplemented types/identity/room/signal paths must later be included in full release load, not marked PASS by exercising a stub or substituting single choice. Workload acceptance is O07; related media/signal/grading limits O02/O06/O08 are separate unresolved inputs.

Future execution requires a separately authorized Task, approved workload/budgets and controlled **non-production staging-equivalent infrastructure**. Never use the Owner's 8GB shared workstation, other projects' Docker/processes/ports/DB, production data or an unapproved endpoint. Use synthetic roster/accounts/exams only; do not load real student data before G7. Load-generator host is separate from target so generator saturation is measurable, not mistaken for server capacity. Open-source tooling selection and version/configuration are recorded by that later Task; no dependency/vendor is selected/installed here and no new paid cost is approved.

## 2. Reproducibility and measurement contract

Record exact candidate Git SHA, image digest, schema/migration state, accepted P2/P5 versions, PostgreSQL/OS/runtime/nginx versions, CPU/RAM/disk/network/storage topology, pool/connect/expiry configuration, TLS/auth/edge settings, school NAT/device facts, fixture seed/hash, generator build/config/seed and clock synchronization. Staging and production must be comparable in resources/data cardinality/settings; disclose differences and don't extrapolate weaker tests into production claims. Freeze fixture and plan version for each measured run; first failure remains evidence, any later diagnostic run needs its own authorized protocol, not retry-to-PASS.

Instrument: offered/achieved arrivals and concurrency, endpoint/role/scenario throughput, latency p50/p95/p99/max, timeouts/5xx/unexpected 4xx/429, retries/queue age, answer-ack latency and pending convergence, authoritative timer/submit state, CPU/RSS/host available RAM/swap/OOM, event-loop delay, pool active/idle/wait/timeouts, DB lock waits/deadlocks/connections/slow-query/commit/storage/WAL, disk free/IO latency, nginx limits/TLS/upstream errors, media bandwidth/cache behavior and dashboard freshness. Use actual raw samples, not histogram-derived precision beyond existing buckets.

Existing `runtime/secure-assessment/src/metrics.ts` provides per-component request metrics on an internal listener; `config.ts` defaults pool max10, connect timeout5000ms, expiry sweep15s. These are defaults, not approved tuning. Supplement missing pool/DB/event-loop/queue evidence in future authorized measurement scope; do not expose internal metrics publicly or put student answers/IDs/credentials in metric labels/logs. P9/PB12 names observer/incident contact and stop authority. No missing instrumentation is falsely called available.

## 3. Proposed workload profile and rate model

**Every number in this section is PROPOSED / OWNER APPROVAL REQUIRED**, except the canonical approximate 1,000-student target and explicitly identified current code defaults. Use isolated accounts/participants/Attempts/sessions, realistic school roster size, whole exams/rooms and frozen questions. P2 type/media distribution, 90–180min exam lengths and school timetable/network assumptions are inputs to confirm, not production facts. No shared one-account shortcut that bypasses auth/idempotency contention.

| Scenario | Proposed offered load / timing | Required concurrent context and oracle |
|---|---|---|
| L01 Login + start bursts (R01/R07/R31) | 1,000 valid logins across 120s, then 1,000 starts across 60s; separate short peak at approved NAT burst envelope | Real password work/cookie/membership/discovery/start/activate/timer; exactly one intended Attempt, no systematic legitimate NAT lockout; include negative auth separately, not counted as valid throughput |
| L02 Steady answer load (R02/R04/R05/R31) | 1,000 active Students, mean one choice every 10s (~100 saves/s), with timing jitter; 10% simultaneous change bursts; 180min soak | Actual app-equivalent resume/timer/state/message polling, review flags, all approved types/media; per-student serial write/version identity, stale/conflict paths; every acknowledged final choice matches DB |
| L03 Save burst/contention (R02/R25/R31) | 1,000 Students save within 5s (~200 saves/s), plus same-question legitimate changes and concurrent finalization attempts in controlled exam fixtures | DB serialization, immutable snapshots, exactly applied logical writes, no lost/duplicate acknowledged intent; grade/export on separate scoped contexts without starving saves |
| L04 Offline/reconnect storm (R03/R31) | 300 Students offline 60s, each queues 6 changes; reconnect within 10s. Separate full 1,000-client reconnect case | Replay latest valid intent per question using real backoff/jitter/version, not arbitrary blind 1,800 writes; verify pending/server reconciliation. Late/expired/pause/lock outcomes follow P2 O04/current rules, not fake acceptance |
| L05 Submission/expiry storm (R06/R25/R31) | 1,000 participants submit within 10s, duplicates/lost acknowledgement for 10%; separate server/client expiry convergence at same boundary | Pending flush, one durable submission per Attempt, accepted answers stable; no double finalize/result; timer_not_expired resync tested rather than ignored |
| L06 Supervisor/School Operator dashboards (R21/R23/R28/R31) | 20 Proctors + 5 Teachers + 2 School Operators alongside L02/L04/L05; 10% receive scope-changing event | Current monitoring refresh default20s; future scoped paging/detail/risk feed per approved contracts; no peer-room leakage or privileged stale assignment; status freshness and fanout measured |
| L07 Shared NAT/edge (R07/R31) | All 1,000 Students behind one address, and comparison split over 10 addresses; L01–L05 repeated per approved protocol | Existing reference nginx auth10r/s, API300r/s plus configured bursts are **current reference**, not changed here; keep security/limits, measure delay/retry/429 recovery; no NAT exemption or unlimited rate configuration |
| L08 Process restart/recovery (R03/R04/R06/R29/R31) | One controlled graceful restart and separately abrupt process loss during steady/save/submit bursts; DB remains intact; generator retains local intents | No volume/reset/reseed; unanswered connection ≠ success. Restore service/reconcile same Attempt/answers/timer/submission. Test server expiry while clients absent; restart allowed only on isolated authorized test runner |
| L09 Room/session/pause/lock races (R03/R04/R22/R23) | 100 running transfers under L02, plus duplicate/opposed moves, takeover, expiry and pause/lock boundaries | P2 transfer/state contract and P5 TOCTOU checks; before/after answer/time/snapshot/randomization/Attempt invariant, no extra time/retake; new feature must exist before scenario can run |
| L10 Images and signals under load (R18/R24/R28/R31) | Representative five-image-option questions for 1,000 simultaneous views, plus each Student 2 signals/s for 30s as a bounded abuse case | Approved O06/O08 caps/backpressure; pinning/legibility/cache/auth remain; signal overload explicit and isolated from answers. This abuse case is not proposed normal signal cadence |

Actual polling model must include all sources without double-counting. Current `StudentExamWorkstation.tsx` active state check15s (~66.7 requests/s at1,000), paused/locked5s (~200/s); `ExamMonitoringView.tsx`20s; authoritative timer hook also resyncs on focus/visibility and local tick is not a server call. Derive observed timer/resume/inbox/focus/retry rates from actual candidate, with jitter and synchronized stress variant; don't assume browser local 1s timer means1,000 API requests/s or omit resync storms. Proposed save rates combine with these polls and dashboards when calculating offered load. Record observed request mix; if school workload differs, revise/approve plan before claiming capacity.

## 4. Proposed numeric acceptance budgets

**All performance thresholds below are PROPOSED / OWNER APPROVAL REQUIRED (O07)**. Canonical zero unauthorized access/zero silent answer loss/no duplicate submission are invariants regardless of performance budget approval. Do not accept data corruption because average latency passes. Thresholds apply at approved offered workload on production-equivalent target; report offered vs achieved load and failed/timeout requests, not only successful fast responses.

| Budget | Proposed threshold / interpretation |
|---|---|
| B01 Save/timer/resume | p95 ≤1s, p99 ≤2.5s at steady+approved burst envelope; measured end-to-end including proxy/queue; no exclusion of slow timeouts |
| B02 Login/start/submit | p95 ≤2s, p99 ≤5s per operation excluding human interaction; authoritative result receipt, not merely HTTP send |
| B03 Staff dashboards | p95 response ≤2s, p99 ≤5s; rendered visible status no older than30s when connected at current20s polling, stale explicitly shown |
| B04 Unexpected failures | ≤0.1% unexpected transport/5xx/timeout or unintended legitimate 4xx per scenario and endpoint; zero security/data violations. Expected negative requests and deliberate outages separate, never hide unplanned failures in their bucket |
| B05 Reconnect convergence | ≥99% eligible pending latest intents acknowledged within30s of stable connectivity, 100% within120s; any unexplained residual or silently discarded write fails integrity regardless of percentage |
| B06 Restart recovery | Service ready ≤60s after isolated restart; all valid pending eligible intents converge ≤120s after readiness/stable network; no acknowledged write lost, duplicate submission or timer reset |
| B07 Resource headroom | Steady CPU p95≤75% allocated CPU, peak sustained ≤90% over60s; target RAM≤80% allocated, no OOM or sustained swap; DB connections≤80% configured ceiling steady, disk free≥20% throughout; report baseline and measurement overhead |
| B08 Wait/loop budget | DB pool wait p95≤100ms/p99≤500ms, zero pool-timeout under accepted steady profile; event-loop delay p99≤100ms; no unresolved deadlock/retry-loop or unbounded queue growth |
| B09 Media | Preserve historical PROVISIONAL ~200–300KB preferred image, ~500KB ceiling/~1.5MB total-question targets only as evaluation inputs; don't adopt hard limits or destructive compression. O06/O07 approve byte/latency/readiness/high-detail exception criteria after real-device legibility and shared-network measurements |
| B10 Signal overload isolation | During L10, B01–B08 answer/timer/submit budgets still met; all unaccepted/deferred signals reported honestly, no silent infinite queue or automatic sanction. Exact ingress limits/drop/retention policy O08, not decided here |

Budget failure means FAIL or EVIDENCE PENDING with named missing input; not "close enough" and not authority to weaken auth/rate limits/assertions. PB06 device evidence, PB07 integrity artifact and PB11/PB12 operations must still pass their independent closure gates. A fast server with missing workload coverage is not a 1,000-student PASS.

## 5. Future execution protocol and answer-integrity oracle

1. Obtain explicit workload/budget/runner authorization; resolve Oxx relevant scenarios, implementation readiness, P9 target facts and scoped operator responsibility. Pin config/fixtures/code. Mark unimplemented scenario BLOCKED, never omit it silently from final G4 scope.
2. Use synthetic deterministic data via audited setup paths on isolated disposable test infrastructure, not manual production SQL. Keep observer reads separate; warmup/calibration and generator-capacity check disclosed. Stage smoke at50/250/500 before approved1,000; a phase failure stops escalation.
3. Run L01–L10 per accepted plan with timestamps/workload IDs. Retain raw request/error/latency/resource/DB records and exact offered/achieved profiles. Inject failures only into authorized target/client cohorts. Preserve security settings and existing assertions; no retry/re-run solely to obtain green evidence.
4. Integrity oracle: retain per-question Student intent journal, durable local state, server acknowledgement (write identity/version/payload), accepted DB state, snapshot/version, active session/Attempt and final receipt/result. Compare **every participant** at recovery/submission checkpoints. Latest acknowledged write must equal durable server truth unless a later authorized write supersedes it; all eligible pending intents reconcile, all policy-refused ones explicitly recorded under approved rules. Expected malformed/expired/refused writes never become fabricated accepted answers.
5. For concurrent/restart cases, verify no duplicate identity/account/Attempt/submission, no mutable snapshot/frozen result, no timer reset/extra time, no room-transfer answer/randomization change or cross-scope read/write. Audit sensitive actions and compare denied-request side effects. Mismatch/secret leak/unauthorized access immediately stops scenario and disqualifies PASS.
6. Stop for OOM, generator saturation, unexpected target contention/outage, unsafe storage/headroom, unauthorized resource touched or material failure. Preserve logs/state for read-only assessment, no destructive cleanup or automatic retuning. Changes/retest require authorized defect handling and complete new evidence; never erase failed runs.
7. Produce one candidate-specific report: scenario coverage/status, approved limits, exact SHA/image/config/fixture, rates/distributions/error denominators/resource plots, integrity comparisons for all users, limitations, failures and G3/G4 gate recommendation. Independent review and Owner acceptance required; report alone does not close PBs or authorize production.

P7 supplies realistic interaction/media behavior; P8 device/PB07 protocols and P9 infrastructure complete the measurement inputs; P10 stages/rehearses release and school UAT. G1–G10 remain mandatory; P11 not approved, TASK_PLAN.md not created, no production capacity/readiness demonstrated by this plan or this Task's automatic regression CI.

<a id="o07-submission"></a>

## 6. Exact P6/O07 numeric approval submission — GOV-PERF-001

**Status:** PROPOSED FOR OWNER O07 APPROVAL / NOT APPROVED; NO LOAD EXECUTION OR CAPACITY RESULT.
**Submission baseline:** 067713afe23cad0d9712ef5acafb4000f5642db8, 2026-10-31.
**Authority:** This is the approval envelope of the existing §1–§5 plan, not a new performance plan. L01–L10 and B01–B10, all numeric cells/rate models/durations and the restart/recovery/integrity protocol above are retained unchanged. The original package's final “TASK_PLAN.md not created” statement is historical: a finite candidate now exists, NOT APPROVED / NOT ACTIVE, with 33 BLOCKED Tasks and baseline DONE 0.

### 6.1 Classification and exact numerical authority

Each applicable original number/requirement is governed by these classes:

- **ESTABLISHED — CANONICAL:** approximate 1,000 concurrent Students is the release target under [DEC-044 §9–§10](../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), not measured capacity. Zero unauthorized access, no silent acknowledged-answer loss, immutable snapshots, one logical submission per Attempt and current active-session authority remain mandatory regardless of budget approval.
- **ESTABLISHED — OBSERVED DEFAULT:** actual baseline configuration/polling/reference values in §2–§3 are descriptive only. They are neither a school fact nor an approved tuning/performance budget. Pin and observe the future candidate; do not silently replace its rates with assumptions.
- **PROPOSED FOR OWNER O07 APPROVAL:** unchanged numeric offered workload/timing in L01–L10, explicit calibration steps in §5, and acceptance thresholds B01–B08; B10 only as the workload-isolation expectation tied to those budgets and subject to its C inputs. This submission grants no execution authority.
- **CONDITIONAL / DEFERRED:** actual school/VPS/NAT/device/network facts, production-equivalent hardware/access/cost, exact offered NAT peak envelope, implementation/type/media/signal contracts, actual timer/inbox/resume/retry request mix and load-tool/version/configuration. B09 numbers remain PROVISIONAL / NOT APPROVED; O06/O08 and all other unresolved policy stay open.

The original blanket “proposed” labels are read with these explicit distinctions: canonical invariants and observed defaults are not new tuning approvals, and conditional/provisional inputs are not approved merely by accepting this package.

| Original location / number or requirement | Exact classification and disposition |
|---|---|
| §1 and §3 approximate 1,000-Student target | ESTABLISHED — CANONICAL target. Offered synthetic concurrency/counts in scenarios are PROPOSED; no achieved-capacity claim |
| §2 pool max10, connect timeout5000ms, expiry sweep15s | ESTABLISHED — OBSERVED DEFAULT, checked at [config.ts](../../runtime/secure-assessment/src/config.ts). No tuning approval or production configuration claim |
| §3 active/paused state checks15s/5s and derived ~66.7/~200 requests/s, monitoring20s | ESTABLISHED — OBSERVED DEFAULT/reference arithmetic at the stated concurrency; checked in [StudentExamWorkstation](../../frontend/web/src/components/StudentExamWorkstation.tsx) and [ExamMonitoringView](../../frontend/web/src/components/ExamMonitoringView.tsx). Actual candidate and combined request mix remain CONDITIONAL |
| §3 reference nginx auth10r/s and API300r/s, configured bursts | ESTABLISHED — OBSERVED REFERENCE, checked in [nginx configuration](../../deploy/nginx/elligble.conf). No NAT exemption, unlimited rate or new burst envelope approved |
| §3 type/media distribution, 90–180min exam lengths, school timetable/network assumptions | CONDITIONAL inputs to confirm; not actual school facts. L02's explicit 180min soak remains an unchanged PROPOSED test duration, distinct from a claim about school exams |
| §5 calibration at50/250/500 before approved1,000 | PROPOSED FOR OWNER O07 APPROVAL; unchanged escalation sequence, phase failure stops escalation. No calibration run performed |
| §§1–§2 and §5 versions, resource ceilings/topology, generator/target separation and fixture/config reproducibility | Isolation/integrity/disclosure requirements preserved; exact hardware/software/device/NAT/tool settings and equivalence are CONDITIONAL facts/authority, not supplied by this Task |
| §4 zero security/data violations and §5 every-participant integrity/recovery checks | ESTABLISHED mandatory invariants, not relaxable numeric budgets. Performance percentiles/error allowance cannot excuse unauthorized access, silent ACK loss, duplicate submission or altered timer truth |
| §5 first-failure evidence, no retry-to-PASS, stop/independent-review/Owner acceptance | Preserved protocol obligations; no extra run, infrastructure change, report acceptance or release PASS granted |

### 6.2 L01–L10 offered-load and timing approval boundary

This table incorporates each original L row's offered counts, rates, percentages, durations, sequence and oracle **verbatim by reference to §3**. No alternative numeric profile is proposed. Conditional inputs do not remove a scenario: they block its future execution or full G4 acceptance until resolved.

| Scenario | PROPOSED FOR OWNER O07 APPROVAL from unchanged row | ESTABLISHED / CONDITIONAL boundary and future obligation |
|---|---|---|
| L01 | Login/start counts and windows, valid-throughput model | Real credential/session path and one intended Attempt required. Short NAT peak remains CONDITIONAL: exact school peak envelope is unknown and must be separately pinned/approved; no guessed peak or bypass |
| L02 | Active count, mean answer interval/rate, simultaneous-change share and soak duration | Every acknowledged final choice matches DB; actual all-source poll/retry/type/media mix and O02/O06/O08 inputs CONDITIONAL. Do not replace full workload with one account or single choice |
| L03 | Save cohort/window/rate and controlled contention/finalization mix | Exactly applied logical writes and immutable snapshots mandatory; full-type/grading/export contracts must exist and remain scoped |
| L04 | Offline cohort/duration/change count/reconnect window and separate full-client case | Real latest-intent/backoff/version reconciliation. Queue count is not an instruction for blind writes; O04 refusal/late-delivery boundary unchanged, no fabricated acceptance |
| L05 | Submit cohort/window, duplicate/lost-ACK share and separate expiry convergence | One durable submission/result, accepted-answer stability and authoritative timer resync remain invariants |
| L06 | Proctor/Teacher/School Operator counts, accompanying scenarios and scope-change share | Tenant/current room/assignment checks mandatory. Future paging/risk/institution capabilities and actual refresh/fanout are CONDITIONAL, not validated by current dashboards |
| L07 | Single-address/split-address synthetic comparison and linked scenario runs | Synthetic topology is not observed school NAT. Existing security/rate settings retained; actual NAT envelope/network facts and measured recovery CONDITIONAL. No rate exemption or universal capacity inference |
| L08 | Controlled graceful restart and separate abrupt loss under stated workloads | Only future isolated authorized runner, intact DB and retained intents. Target/resource authorization CONDITIONAL; no restart on laptop/production. ACK truth, same Attempt/timer/submission preserved |
| L09 | Running transfer cohort and duplicate/opposed/session/state races | O05/P4 transfer technical contract and implementation readiness CONDITIONAL; preserve answer/time/snapshot/randomization, no retake/extra time. Missing feature blocks execution, not scenario scope |
| L10 | Simultaneous image-option cohort plus bounded signal abuse cadence/duration | O06 media and O08 ingress/dedupe/retention/drop contracts unresolved; stress shape is not an approved normal signal rate or signal limit. Retain all image/answer/readiness/authorization and isolation obligations |

### 6.3 B01–B10 acceptance-budget approval boundary

The **exact threshold text in unchanged §4 is the approval candidate**. Every percentile, inequality, time, failure denominator, percentage and resource/wait/recovery limit remains unchanged; no rounding or “close enough” acceptance is introduced.

| Budget | Approval class and preserved interpretation |
|---|---|
| B01 | PROPOSED O07: exact save/timer/resume latency percentiles and stated steady/burst applicability; all proxy/queue/timeout samples retained |
| B02 | PROPOSED O07: exact login/start/submit latency limits per operation, authoritative result receipt rather than HTTP send |
| B03 | PROPOSED O07: exact response/freshness limits with stale indication; polling reference is OBSERVED, actual candidate behavior CONDITIONAL |
| B04 | PROPOSED O07: exact unexpected-failure allowance per scenario/endpoint; separate expected negatives/deliberate outages. ESTABLISHED zero security/data violations overrides any percentage allowance |
| B05 | PROPOSED O07: exact convergence percentages/windows from stable connectivity. ESTABLISHED any unexplained residual or silently discarded eligible intent fails integrity |
| B06 | PROPOSED O07: exact service readiness/reconciliation windows. ESTABLISHED no acknowledged loss, duplicate submission or timer reset |
| B07 | PROPOSED O07: exact CPU/RAM/DB/disk percentages/window/headroom limits. Actual allocated resources/ceilings/equivalence and school topology CONDITIONAL; original no-OOM/no-sustained-swap and safe-resource conditions unchanged |
| B08 | PROPOSED O07: exact pool wait/timeout/event-loop limits; preserve no unresolved deadlock/retry-loop/unbounded queue growth. Actual missing instrumentation must be supplied in future scope, not assumed |
| B09 | CONDITIONAL / PROVISIONAL / NOT APPROVED: unchanged preferred image/ceiling/total-question numbers are evaluation inputs only. No hard limit, destructive compression, rendition/legibility or media-byte/latency policy approved; O06 and later applicable approval still required |
| B10 | PROPOSED O07: workload isolation expectation, with exact B01–B08 obligations retained during L10. O08 ingress/drop/retention and O06 media inputs CONDITIONAL; never authorize silent signal loss/infinite queues/automatic sanctions |

### 6.4 Offered-versus-achieved evidence, exclusions and stop gate

Future reports must disclose offered and achieved arrivals/concurrency/endpoint mix, all latency/error denominators (including timeouts and unplanned negative responses), generator saturation, target resources, stop events and missing coverage. A run that fails to offer the accepted profile cannot claim capacity merely because the successful subset is fast. Keep intended negative traffic and deliberate outages labelled separately; never reclassify unplanned failure as expected. Preserve raw first-failure evidence and every-participant intent→ACK/version/payload→DB/snapshot/session→receipt comparison in §5. No silent acknowledged-answer loss, unauthorized access or duplicate finalization is permissible.

CONDITIONAL exclusions: actual school NAT peak envelope/address behavior, devices/network/bandwidth/VPS resources and production equivalence; scenario-ready application features and O02/O04/O05/O06/O08 contracts; actual all-source polling/retry/focus mix; staging/access/cost/observer/incident/stop authority; load-tool/version/generator configuration and capacity; required media/device/restore/load evidence. No school facts, tool selection, measured result or new numeric setting is invented. B09 and O06/O08 are not approved. All L scenarios remain mandatory future obligations with their unresolved inputs visible, not silently skipped.

Submit the unchanged numeric profile/acceptance text with the exact ESTABLISHED/PROPOSED/CONDITIONAL envelope above for Independent HIGH-risk/performance Review and explicit Owner exact-content numeric decision. Approval, if later granted, is not execution authorization, school-specific capacity certification or closure of O07's unknown facts. If conditional inputs prevent unconditional sufficiency at final P11/G4, retain named blockers and request the exact missing authority; no blanket approval or final-P11 activation inferred.

STOP future scenario/escalation on any integrity/security mismatch, OOM, generator saturation, unexpected contention/outage, unsafe headroom, missing/incorrect scope or unauthorized resource touched, as §5 already requires. Preserve logs/state; no automatic tuning, destructive cleanup or retest-to-PASS. These are protocol obligations only: this Task runs no load, provisions nothing and changes no application/security/rate settings.

Bounded Owner-approved P5/O09 P decisions from [GOV-POLICY-001 §7](tasks/GOV-POLICY-001.md) remain effective; K rules preserved and C/O01–O08 exclusions remain default-deny. Full DEC-044 scope/G1–G10 and security/answer-integrity gates remain unmet. P6/O07 numeric approval pending; school facts UNKNOWN; final P11 NOT APPROVED / NOT ACTIVE; 33 candidate Tasks BLOCKED, baseline DONE 0. No PB closure, production readiness/deployment, evidence commit/DONE, successor or implementation is authorized.
