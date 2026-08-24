**Status:** ACTIVE  
**Version:** 1.0.68
**Canonical:** YES  
**Last Reviewed:** 2026-08-24

# ELLIGBLE Document Manifest

## Agent Read Policy

```text
ALWAYS
= read every execution

PHASE
= read when working in that phase

DOMAIN
= read only when the current task needs that domain

ON_DEMAND
= historical/reference only

NEVER_DEFAULT
= do not load unless a specific unresolved historical question requires it
```

| File | Purpose | Authority | Read Policy |
|---|---|---|---|
| `READ_ME_FIRST.md` | Repository entry path | Canonical | ALWAYS |
| `AGENTS.md` | Agent behavior rules | Canonical | ALWAYS |
| `docs/master/MASTER_CONTEXT.md` | Cross-project context | Canonical | ALWAYS |
| `docs/state/CURRENT_STATE.md` | Active phase/task guard | Canonical/Dynamic | ALWAYS |
| `docs/00-governance/00.02_DECISION_HIERARCHY.md` | Authority/status rules | Canonical | ALWAYS |
| `docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md` | Naming vocabulary | Canonical | ALWAYS |
| `docs/00-governance/00.01_DISCOVERY_PROCESS.md` | Discovery execution process | DRAFT — FOR REVIEW v0.3.0 | PHASE: Discovery |
| `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` | Context loading limits | Canonical | ALWAYS/Agent setup |
| `docs/00-governance/00.05_BUILD_EXECUTION_RULES.md` | Build execution safety | Canonical | PHASE: Build |
| `docs/00-governance/00.06_PROACTIVE_GAP_GOVERNANCE.md` | Proactive gap review | Canonical | PHASE/Review |
| `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md` | Domain ownership/contracts | Canonical | DOMAIN/Architecture |
| `docs/00-recovery/00.00_ELLIGBLE_MASTER_RECOVERY_INDEX.md` | Recovery index/handoff | Frozen index | ON_DEMAND |
| `docs/00-recovery/00.01_PRODUCT_IDENTITY_AND_PURPOSE.md` | Product Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.02_TENANT_IDENTITY_AND_ACCESS.md` | Identity/Tenant Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.03_ACADEMIC_CORE.md` | Academic Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.04_SECURE_ASSESSMENT.md` | Assessment Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.05_LEARN_TRACK_CARE_PARENT.md` | School OS Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.06_PROFILE_PASSPORT_AND_PATH.md` | Passport/Path Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.07_PARTNER_OPPORTUNITY_AND_ALUMNI.md` | Ecosystem Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.08_SHARED_PLATFORM_CAPABILITIES.md` | Shared capabilities Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.09_PLATFORM_OPERATIONS_AND_COMMERCIAL.md` | Platform/commercial Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.10_SECURITY_PRIVACY_AND_DATA_GOVERNANCE.md` | Security/privacy Recovery | Frozen | DOMAIN |
| `docs/00-recovery/00.11_LEGACY_CBT_RECOVERY.md` | Legacy classification | Frozen | ON_DEMAND |
| `docs/00-recovery/00.12_OPEN_PROVISIONAL_FUTURE_REGISTER.md` | Unresolved status register | Frozen/Canonical handoff | PHASE/DOMAIN |
| `docs/00-recovery/archive/ELLIGBLE_RECOVERY_FULL_ARCHIVE.md` | Complete Recovery history | Frozen historical | NEVER_DEFAULT |
| `docs/decisions/DECISION_LOG.md` | Concise decision register | Canonical/Dynamic | PHASE |
| `docs/01-discovery/01.01_PRODUCT_VISION_AND_BOUNDARIES.md` | Discovery 01 — Product Vision & Boundaries | Canonical / FINAL / LOCKED v1.0.0 | PHASE: Discovery |
| `docs/01-discovery/02.01_TENANT_ORGANIZATION_IDENTITY_ACCESS.md` | Discovery 02 — Tenant / Organization / Identity / Access Foundation | Canonical / FINAL / LOCKED v1.0.0 | PHASE: Discovery |
| `docs/01-discovery/03.01_ACADEMIC_CORE.md` | Discovery 03 — Academic Core | Canonical / FINAL / LOCKED v1.0.0 | PHASE: Discovery |
| `docs/01-discovery/04.01_SECURE_ASSESSMENT.md` | Discovery 04 — Secure Assessment | Canonical / FINAL / LOCKED v1.0.1 | PHASE: Discovery |
| `README.md` | Repository overview / navigation | non-authoritative | ON_DEMAND |
| `docs/01-discovery/README.md` | Discovery navigation/index | navigation | PHASE: Discovery |
| `docs/architecture/ARCHITECTURE_PHASE_INDEX.md` | Architecture phase control index, coverage register, Production Blocker Architecture tracking, and control-approved Architecture workstream order. | DYNAMIC CONTROL / PHASE INDEX - DOES NOT SUPERSEDE LOCKED/FROZEN SOURCES | PHASE: Architecture |
| `docs/architecture/SYSTEM_AND_DOMAIN_BOUNDARIES.md` | Architecture Sequence 1 system context, logical system/domain responsibility boundaries, source-of-truth ownership boundaries, isolation constraints, and Sequence 1 deferrals. | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/DATA_TENANCY_AND_TRUST_ARCHITECTURE.md` | Architecture Sequence 2 Data / Tenancy / Trust architecture covering data ownership, tenant isolation, lifecycle continuity, provenance/trust, canonical vs derived state, historical continuity, conceptual consistency boundaries, privacy/classification/consent hooks, retention/deletion hooks, and Sequence 2 cross-sequence deferrals. (90C7EC4B393026C31A7FC2F47B040500D82208F1B6B96BAD6244A2B313F2A43A) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md` | Architecture Sequence 3 Identity / Access / Security architecture covering Person / User Account / Membership separation, authentication architecture requirements, scoped authorization / capabilities, administrative and domain-specific authority boundaries, privacy/security enforcement, revocation/lifecycle access safety, break-glass architecture boundary, and cross-sequence handoffs. (B14DE48CC1F10F6FC597C3901E2A67CE02073862CF93C7818003152D9D052E6B) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md` | Architecture Sequence 4 Secure Assessment Critical Architecture covering mission-critical active-exam continuity, Zero Lost Answers, server-authoritative timer, idempotent submission, reconnect/resume continuity, Participant / Attempt / Session separation, immutable Exam Question Snapshot, authoritative assessment state, failure containment, and assessment risk/security boundaries. (92C79A80FCE277BDA9A537C8D78B03ED8A7CB44F092A61855CD8C78E56A79BEA) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/CROSS_DOMAIN_AND_INTEGRATION_ARCHITECTURE.md` | Architecture Sequence 5 Cross-Domain & Integration Architecture covering canonical cross-domain contracts and external integration boundaries. (DFF344E799EA014C2FB2276505697FA97844505CC66F675A1586CA3CEDB03A24) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/RUNTIME_RELIABILITY_AND_OPERATIONS_ARCHITECTURE.md` | Architecture Sequence 6 Runtime / Reliability / Operations Architecture covering runtime boundaries, failure containment, observability, backup/restore, incident-response hooks, deployment requirements, technology-selection criteria. (63863D539E875190A69610166AB03AE5B212C4879FAAD3C9AD93F559CCD9CDD1) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/ARCHITECTURE_TRACEABILITY_AND_EXIT_GATE.md` | Architecture Sequence 7 traceability, coverage, contradiction verification, Architecture exit gate, and Build-entry control boundary. (947D8EF2F0D94478FA5F84A0DA322B00FB0BC96D5CD8804BA81A4EC9B34DFF73) | Canonical / LOCKED v1.0.0 | PHASE: Architecture |
| `docs/architecture/README.md` | Architecture phase gate / placeholder | phase-state guidance | PHASE: Architecture |
| `docs/design/README.md` | Design phase gate / placeholder | phase-state guidance | PHASE: Design |
| `docs/build/BUILD_PHASE_INDEX.md` | Build Phase Control and Index. Status: ACTIVE / CONTROL BASELINE. Version: 0.1.37. (C0603D47D5800E44E1F95047AB40FA504147835F7951F2C05172335CF4840D58) | DYNAMIC BUILD CONTROL / DOES NOT SUPERSEDE LOCKED SOURCES | PHASE: Build |
| `docs/build/units/BU-001_MINIMUM_FOUNDATION_IDENTITY_TENANT_PERSISTENCE_BOOTSTRAP.md` | BU-001 Specification - Minimum Foundation: Identity/Tenant Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (2952AD2EDC5AA5EA8CA559AD71A441D5FC003357C849548B4CBCB6C6BC3BD5B9) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-002_SECURE_ASSESSMENT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-002 Specification - Secure Assessment Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (C2D2A111ACE7B0E615AFF69992E980DD61C9F503CB6ABBA2564DFA40996CAB46) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-003_SECURE_ASSESSMENT_QUESTION_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-003 Specification - Secure Assessment Question Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (19DE33263442893B9DDFDDD9F0244467FFC5F66E714F46E79E58597978E1EE10) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-004_SECURE_ASSESSMENT_ANSWER_PERSISTENCE_CORE_STATE_BOOTSTRAP.md` | BU-004 Specification - Secure Assessment Answer Persistence Core State Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (C9457A8390DC9012B24BB3841952F93D4A02B1DD6F4F7DB0F778C77ACA7D4067) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-005_SECURE_ASSESSMENT_MINIMUM_RUNTIME_FOUNDATION_BOOTSTRAP.md` | BU-005 Specification - Secure Assessment Minimum Runtime Foundation Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / RUNTIME-DATA-ACCESS GATE PASS / REPOSITORY FINALIZED. (C4827AAFE465C81C94FBCCE614412FE182FB7DCDCEC63E6FDA9DBD92EE773B2D) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-006_SECURE_ASSESSMENT_ANSWER_SAVE_ACKNOWLEDGEMENT_RUNTIME_BOOTSTRAP.md` | BU-006 Specification — Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (0E40C2F2D6A348C4D3EAFBC6CB1D7025452FFEFDC0CF5C26B4AC50C7449FD781) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-007_SECURE_ASSESSMENT_SERVER_AUTHORITATIVE_TIMER_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-007 Specification — Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (2656FE17E815F168C2B9FEFB1C245BC1CB225212F9DCAE93BD7954E864A01394) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-008_SECURE_ASSESSMENT_SERVER_AUTHORITATIVE_TIMER_START_REMAINING_TIME_RUNTIME_BOOTSTRAP.md` | BU-008 Specification — Secure Assessment Server-Authoritative Timer Start / Remaining-Time Runtime Bootstrap. Status: IMPLEMENTATION COMPLETE / CLOSURE PACKAGE CONTROLLER AUDIT PASS / CLOSURE PACKAGE OWNER ACCEPTANCE COMPLETE / CLOSURE STATE-SYNC GIT FINALIZATION PENDING. (ED13C2A753F1091164725DF7547FBD7DA9A739D7FB98187AE0585F32C5C30E39) | BUILD UNIT SPEC | PHASE: Build |
| `docs/state/HANDOFF_PACKET.md` | cross-session/agent context recovery snapshot | Canonical/Dynamic Navigation | ALWAYS |
| `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md` | Persistent control backlog for controlled closure of the 12 carried-forward Production Blockers. | CONTROL / DERIVED — DOES NOT SUPERSEDE CANONICAL SOURCES | PHASE/Review |
| `docs/02-master-blueprint/02.00_MASTER_BLUEPRINT_INDEX.md` | Master Blueprint phase index / unit state | Canonical/Dynamic | PHASE: Master Blueprint |
| `docs/02-master-blueprint/02.01_PLATFORM_SYSTEM_MAP.md` | Authoritative Platform System Map for MB-02 and subsequent Master Blueprint units. | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-01 |
| `docs/02-master-blueprint/02.02_DOMAIN_AND_MODULE_MAP.md` | Domain & Module Map | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-02 |
| `docs/02-master-blueprint/02.03_ACTOR_ROLE_AND_CONTEXT_MAP.md` | Actor, Role & Context Map | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-03 |
| `docs/02-master-blueprint/02.04_CORE_JOURNEYS_AND_CRITICAL_FLOWS.md` | Core Journeys & Critical Flows | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-04 |
| `docs/02-master-blueprint/02.05_DATA_TRUST_AND_CONTINUITY_MODEL.md` | Data Trust & Continuity Model | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-05 |
| `docs/02-master-blueprint/02.06_SECURITY_PRIVACY_AND_RISK_BOUNDARIES.md` | Security, Privacy & Risk Boundaries | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-06 |
| `docs/02-master-blueprint/02.07_RELIABILITY_AND_FAILURE_CONTAINMENT.md` | Reliability & Failure Containment | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-07 |
| `docs/02-master-blueprint/02.08_CROSS_DOMAIN_CONTRACTS_AND_INTEGRATIONS.md` | Cross-Domain Contracts & Integrations | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-08 |
| `docs/02-master-blueprint/02.09_DELIVERY_SEQUENCE_AND_DEPENDENCIES.md` | Delivery Sequence & Dependencies | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-09 |
| `docs/02-master-blueprint/02.10_BASELINE_FUTURE_AND_EXCLUSIONS.md` | Baseline, Future & Exclusions | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-10 |
| `docs/02-master-blueprint/02.11_TRACEABILITY_MATRIX.md` | Traceability Matrix | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-11 |
| `docs/02-master-blueprint/02.12_MASTER_BLUEPRINT_EXIT_GATE.md` | Master Blueprint Exit Gate | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-12 |
