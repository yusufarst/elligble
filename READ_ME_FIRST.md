# READ ME FIRST — ELLIGBLE

You are working on the ELLIGBLE platform.

Before doing anything:

1. Read `AGENTS.md`.
2. Read the canonical New-Agent/New-Chat protocol: `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md`
3. Execute its Git baseline / working-state inspection.
4. Read the execution model `docs/00-governance/00.10_CONTINUOUS_PRODUCTION_COMPLETION.md` (DEC-042).
5. Read the living plan `docs/production/PRODUCTION_COMPLETION_PLAN.md`: current production state, P0/P1 gaps, critical path, Owner decisions and next work.
6. Preserve existing working changes.
7. Verify work before `DONE` (00.10 §4).
8. Do not reuse legacy CBT code/migrations/RLS/RPC without audit.
9. Do not introduce paid AI dependencies into baseline ELLIGBLE.
10. Do not create Build Units or Stage lifecycle records. Work the critical path and keep the living plan current.

Current high-level phase truth:

```text
Recovery:         COMPLETE / FROZEN v1.0.0
Discovery 01–04:  COMPLETE / LOCKED
Master Blueprint: COMPLETE / LOCKED v1.0.0
Architecture:     COMPLETE / EXIT GATE PASSED
Build:            CONTINUOUS PRODUCTION COMPLETION (DEC-042)
                  BU-001..BU-090 historical construction assets (BU-090 TERMINAL)
```

Live state: `docs/production/PRODUCTION_COMPLETION_PLAN.md`.
Historical Build Unit state (frozen at BU-090): `docs/state/CURRENT_STATE.md`, `docs/state/HANDOFF_PACKET.md`, `docs/build/BUILD_PHASE_INDEX.md`.

## NEW AGENT / NEW CHAT ENTRY PATH

For a new agent or new chat, you MUST use `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` as the canonical New-Agent/New-Chat protocol.

**Core Context Requirements:**
1. Perform a Git baseline check (`git status --short`) BEFORE trusting any state document.
2. A dirty working tree may represent in-progress work.
3. Prohibit destructive handling of unknown modified/untracked files.

**Important Context Rules:**
- do not ask owner to repeat documented decisions
- do not rely on chat memory
- do not reopen LOCKED/FROZEN decisions without explicit conflict
- context reconstruction must PASS before making changes
