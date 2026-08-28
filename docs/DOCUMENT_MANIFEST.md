**Status:** ACTIVE  
**Version:** 1.0.118
**Supersedes:** 1.0.117
**Canonical:** YES  
**Last Reviewed:** 2026-08-24

# ELLIGBLE Document Manifest

> **Administrative Note:** v1.0.112 was not a canonical committed repository version; v1.0.113 contained a supersedes-chain metadata drift; v1.0.114 forward-corrects the chain without rewriting history.

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
| `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md` | Build Unit Fast-Track Control v1 for BU-011+. (347C201E50E78CB095BF01F469F05E07963841AF77DE06BA25A20FAE16F4775B) | Canonical / LOCKED v1.0.0 | PHASE: Build |
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
| `docs/decisions/DECISION_LOG.md` | Concise decision register. Version: 1.0.2. (7B8F61A36B4D05011DEECEF7D42D3685CDAA2312037DFA7C2B67A748C265CE94) | Canonical/Dynamic | PHASE |
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
| `docs/build/BUILD_PHASE_INDEX.md` | Build Phase Control and Index. Status: ACTIVE v0.1.82 / SHA256: ADCDEACA6726DBE810CBBFF738B135BCB0AAFD93EAD239BE42356D0F9948792F) | DYNAMIC BUILD CONTROL / DOES NOT SUPERSEDE LOCKED SOURCES | PHASE: Build |
| `docs/build/units/BU-001_MINIMUM_FOUNDATION_IDENTITY_TENANT_PERSISTENCE_BOOTSTRAP.md` | BU-001 Specification - Minimum Foundation: Identity/Tenant Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (2952AD2EDC5AA5EA8CA559AD71A441D5FC003357C849548B4CBCB6C6BC3BD5B9) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-002_SECURE_ASSESSMENT_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-002 Specification - Secure Assessment Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (C2D2A111ACE7B0E615AFF69992E980DD61C9F503CB6ABBA2564DFA40996CAB46) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-003_SECURE_ASSESSMENT_QUESTION_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-003 Specification - Secure Assessment Question Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (19DE33263442893B9DDFDDD9F0244467FFC5F66E714F46E79E58597978E1EE10) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-004_SECURE_ASSESSMENT_ANSWER_PERSISTENCE_CORE_STATE_BOOTSTRAP.md` | BU-004 Specification - Secure Assessment Answer Persistence Core State Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REPOSITORY FINALIZED. (C9457A8390DC9012B24BB3841952F93D4A02B1DD6F4F7DB0F778C77ACA7D4067) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-005_SECURE_ASSESSMENT_MINIMUM_RUNTIME_FOUNDATION_BOOTSTRAP.md` | BU-005 Specification - Secure Assessment Minimum Runtime Foundation Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / RUNTIME-DATA-ACCESS GATE PASS / REPOSITORY FINALIZED. (C4827AAFE465C81C94FBCCE614412FE182FB7DCDCEC63E6FDA9DBD92EE773B2D) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-006_SECURE_ASSESSMENT_ANSWER_SAVE_ACKNOWLEDGEMENT_RUNTIME_BOOTSTRAP.md` | BU-006 Specification — Secure Assessment Answer Save / Acknowledgement Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (0E40C2F2D6A348C4D3EAFBC6CB1D7025452FFEFDC0CF5C26B4AC50C7449FD781) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-007_SECURE_ASSESSMENT_SERVER_AUTHORITATIVE_TIMER_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-007 Specification — Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (2656FE17E815F168C2B9FEFB1C245BC1CB225212F9DCAE93BD7954E864A01394) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-008_SECURE_ASSESSMENT_SERVER_AUTHORITATIVE_TIMER_START_REMAINING_TIME_RUNTIME_BOOTSTRAP.md` | BU-008 Specification — Secure Assessment Server-Authoritative Timer Start / Remaining-Time Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (CB39EFC0E75A3B69643705BC287FDE4DEFC52378F9F0DB1CD349A7759541EFFB) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-009_SECURE_ASSESSMENT_IDEMPOTENT_SUBMISSION_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-009 Specification - Secure Assessment Idempotent Submission Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / QUERY-PERFORMANCE-DATA-ACCESS VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (796FA979C56EFF584433F82714BA23818FE838CF8F3014667435DCAB1660AC13) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-010_SECURE_ASSESSMENT_IDEMPOTENT_SUBMISSION_RUNTIME_BOOTSTRAP.md` | Secure Assessment Idempotent Submission Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / IMPLEMENTATION REPOSITORY FINALIZED / CLOSURE STATE-SYNC REPOSITORY FINALIZED. (AC864E127BFC7DFCF32AFC4DE69C793FC6F866E27B2730029D86874F3370F3F9) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-011_SECURE_ASSESSMENT_RECONNECT_RESUME_AUTHORITATIVE_STATE_READBACK_RUNTIME_BOOTSTRAP.md` | BU-011 Specification - Secure Assessment Reconnect / Resume Authoritative State Readback Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK REPOSITORY FINALIZED. (CC913400820787D381FCD3E8FE5F558F0F08BBF4F0CF67D5D83FC7619784816F) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-012_SECURE_ASSESSMENT_POST_SUBMISSION_ANSWER_WRITE_GUARD_RUNTIME_BOOTSTRAP.md` | BU-012 Specification - Secure Assessment Post-Submission Answer Write Guard Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK REPOSITORY FINALIZED. (ED233649EB2F18271BFDFF4D4E097C57F838A630712975B372FB749222057A54) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-013_SECURE_ASSESSMENT_SERVER_AUTHORITATIVE_TIMER_EXPIRY_ANSWER_WRITE_GUARD_RUNTIME_BOOTSTRAP.md` | BU-013 Specification - Secure Assessment Server-Authoritative Timer Expiry Answer Write Guard Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK REPOSITORY FINALIZED. (0FED9E6D4AD19F903F502AAE64EB4594B4C3688B2B342E203EFA79C185C9B5C9) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-014_SECURE_ASSESSMENT_INTEGRATED_CAPABILITY_VERIFICATION_BOOTSTRAP.md` | BU-014 Specification - Secure Assessment Integrated Capability Verification Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / INTEGRATED REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK REPOSITORY FINALIZED. (ED4934270B0BBBC7158D3DDF6C6FADADEFD8C792A30F6588074ADD5032599D18) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-015_SECURE_ASSESSMENT_CAPABILITY_MATRIX_PB06_GAP_QUALIFICATION_BOOTSTRAP.md` | BU-015 Specification - Secure Assessment Capability Matrix & PB06 Gap Qualification Bootstrap. Status: COMPLETE / CAPABILITY MATRIX QUALIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED. (B26C77A31D58A97F75746B71BBEBEA6E8F86798ACB6C45C81A500D2DD310E498) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-016_SECURE_ASSESSMENT_SERVER_SIDE_EXPIRY_FINALIZATION_RUNTIME_BOOTSTRAP.md` | BU-016 Specification - Secure Assessment Server-Side Expiry Finalization Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED. (6E901C930F84985B190D6DDB67E474446EC7509784E994BCEB3C7465001F2486) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-017_SECURE_ASSESSMENT_ONE_ACTIVE_SESSION_CORE_STATE_PERSISTENCE_BOOTSTRAP.md` | BU-017 Specification - Secure Assessment One-Active-Session Core State Persistence Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED. (C39CBD3F2D7642DB53C0B04C24108573FD7AD715789A17C9FE40176ACECA99C7) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-018_SECURE_ASSESSMENT_GOVERNED_SESSION_ACTIVATION_SUPERSESSION_RUNTIME_BOOTSTRAP.md` | BU-018 Specification - Secure Assessment Governed Session Activation / Supersession Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED. (2967F0A2B09C6FAD6FCF794870B9CE35E30FB9AB04D892F88D571FE85521A720) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-019_SECURE_ASSESSMENT_ACTIVE_SESSION_ANSWER_WRITE_AUTHORITY_GUARD_RUNTIME_BOOTSTRAP.md` | BU-019 Specification - Secure Assessment Active-Session Answer Write Authority Guard Runtime Bootstrap. Status: COMPLETE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / CONTROLLER PHYSICAL AUDIT PASS / FAST-TRACK REPOSITORY FINALIZED. (0DD76036B1C5489DB1067A1666D87E8272368CDDDEA1A2F98D1CF178EA09D7A3) | BUILD UNIT SPEC | PHASE: Build |
| `docs/build/units/BU-020_SECURE_ASSESSMENT_RESUME_AUTHORITATIVE_ACTIVE_SESSION_READBACK_RUNTIME_BOOTSTRAP.md` | BU-020 Specification - Secure Assessment Resume Authoritative Active-Session Readback Runtime Bootstrap. Status: ACTIVE / TERMINAL VERIFICATION PASS / REAL POSTGRESQL VERIFICATION PASS / FAST-TRACK MAIN EXECUTION. (8C87AE652180A552A338D52A1373A11131CA7FFCA412F66EF8B3B51258139420) | BUILD UNIT SPEC | PHASE: Build |
| `database/migrations/0007_bu017_secure_assessment_one_active_session_core_state.sql` | Migration 0007 - BU-017 Secure Assessment One-Active-Session Core State Persistence. (266651453EE6A4873E019684E57AF6DFF1C1F4EAA1FBDD7766CF37E34BD0B1D3) | DATABASE MIGRATION | PHASE: Build |
| `database/verification/verify_bu017_secure_assessment_one_active_session_core_state.sql` | BU-017 Verification SQL. (1F2C450EFE02E1A6ED13CC71ADE89E7AE0106C3C474180E92466C4B6478E1251) | VERIFICATION HARNESS | PHASE: Build |
| `docs/build/evidence/BU-014_ASSESSMENT_CAPABILITY_TESTING_EVIDENCE.md` | BU-014 Integrated Real PostgreSQL Capability Verification Evidence. (028BC688185A58D4B9EFE725B30193A7638591B9892E0E840E8F36BD43844E91) | BUILD UNIT EVIDENCE | PHASE: Build |
| `docs/build/evidence/BU-015_SECURE_ASSESSMENT_CAPABILITY_MATRIX.md` | BU-015 Secure Assessment Capability Matrix. (7C4C317B2FD29EFDA9C6E4B8B3A56E0A40B7014FBB4726822973B6CA18501D95) | BUILD UNIT EVIDENCE | PHASE: Build |
| `runtime/secure-assessment/verification/verify_bu014_active_exam.ts` | BU-014 Verification Harness. (2C549A7612E3F97920D483956384A35A1CECE8B6E08713C9B0E4C93B929FBDEC) | VERIFICATION HARNESS | PHASE: Build |
| `docs/state/HANDOFF_PACKET.md` | cross-session/agent context recovery snapshot | Canonical/Dynamic Navigation | ALWAYS |
| `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md` | Persistent control backlog for controlled closure of the 12 carried-forward Production Blockers. (5B5DF97432538AF7E48B85939091983CE488EBFAA702D4D84E94F88189CF693D) | CONTROL / DERIVED — DOES NOT SUPERSEDE CANONICAL SOURCES | PHASE/Review |
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
