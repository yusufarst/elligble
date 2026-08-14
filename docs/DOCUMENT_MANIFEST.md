**Status:** ACTIVE  
**Version:** 1.0.4  
**Canonical:** YES  
**Last Reviewed:** 2026-08-15

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
| `docs/architecture/README.md` | Architecture phase gate / placeholder | phase-state guidance | PHASE: Architecture |
| `docs/design/README.md` | Design phase gate / placeholder | phase-state guidance | PHASE: Design |
| `docs/state/HANDOFF_PACKET.md` | cross-session/agent context recovery snapshot | Canonical/Dynamic Navigation | ALWAYS |
| `docs/02-master-blueprint/02.00_MASTER_BLUEPRINT_INDEX.md` | Master Blueprint phase index / unit state | Canonical/Dynamic | PHASE: Master Blueprint |
| `docs/02-master-blueprint/02.01_PLATFORM_SYSTEM_MAP.md` | Authoritative Platform System Map for MB-02 and subsequent Master Blueprint units. | Canonical / LOCKED v1.0.0 | PHASE: Master Blueprint / MB-01 |
