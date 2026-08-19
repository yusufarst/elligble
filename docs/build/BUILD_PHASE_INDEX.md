**Status:** ACTIVE / CONTROL BASELINE
**Version:** 0.1.1
**Artifact Type:** BUILD PHASE CONTROL / INDEX
**Canonical:** DYNAMIC BUILD CONTROL / DOES NOT SUPERSEDE LOCKED SOURCES
**Phase:** BUILD

# ELLIGBLE Build Phase Index

## Build Control Invariants

- **Build Entry Control Authorization:** AUTHORIZED / EFFECTIVE
- **Build Implementation:** NOT STARTED before BU-001 implementation execution.
- **Unit Scope:** exactly one Build Unit per implementation execution.
- **Scope Expansion:** no silent scope expansion.
- **Progression:** verify before progressing.
- **Authority:** LOCKED/FROZEN upstream decisions cannot be silently changed.
- **Production Blockers:** remain OPEN until actual closure evidence exists.
- **Maturity:** OPEN / PROVISIONAL / FUTURE maturity is preserved.
- **Priority:** Secure Assessment becomes the highest implementation priority after the verified minimum foundation.
- **ID Convention:** Build Unit IDs use BU-###.
- **Specification Convention:** Build Unit specification files use `docs/build/units/BU-###_<SLUG>.md`.
- **Lifecycle:** includes registration, implementation, terminal verification, Controller audit, Owner acceptance where applicable, controlled Git finalization, and state synchronization.
- **Terminal Verification:** requirements inherit `docs/00-governance/00.05_BUILD_EXECUTION_RULES.md`.

## Active Build Unit Register

### BU-001
- **ACTIVE BUILD UNIT:** BU-001
- **TITLE:** Minimum Foundation: Identity/Tenant Persistence Bootstrap
- **STATUS:** IMPLEMENTED / TERMINAL VERIFICATION PASS / AWAITING CONTROLLER AUDIT
- **IMPLEMENTATION:** EXECUTED
- **REPOSITORY FINALIZED:** NO
- **DONE:** NO
- **NEXT CONTROL ACTION:** CONTROLLER AUDIT OF BU-001 IMPLEMENTATION PACKAGE
