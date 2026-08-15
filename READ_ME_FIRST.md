# READ ME FIRST — ELLIGBLE

You are working on the ELLIGBLE platform.

Before doing anything:

1. Read `AGENTS.md`.
2. Read the canonical New-Agent/New-Chat protocol: `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md`
3. Execute its Git baseline / working-state inspection.
4. Then load canonical baseline/state/context according to that protocol.
5. Do not build unauthorized phases/items.
6. Preserve existing working changes.
7. Verify work before `DONE`.
8. Do not reuse legacy CBT code/migrations/RLS/RPC without audit.
9. Do not introduce paid AI dependencies into baseline ELLIGBLE.
10. Use one controlled unit of work per agent execution.

**Current State Guardrails:**
- Do not jump ahead beyond the phase authorized by the reconstructed actual project state.
- `CURRENT_STATE.md` may represent LAST SYNCHRONIZED BASELINE during an authorized active unit.
- If working tree evidence shows an active draft/correction/review, reconstruct it using 00.04 before determining next action.

Current project state:

```text
Recovery: FROZEN v1.0.0
Discovery 01–04: COMPLETE / LOCKED
Master Blueprint: IN PROGRESS
Architecture: NOT STARTED
Implementation: NOT AUTHORIZED YET
```

## NEW AGENT / NEW CHAT ENTRY PATH

For a new agent or new chat, you MUST use `docs/00-governance/00.04_AGENT_CONTEXT_RULES.md` as the canonical New-Agent/New-Chat protocol.

**Core Context Requirements:**
1. Perform a Git baseline check (`git status --short`) BEFORE trusting `CURRENT_STATE.md` as the full active state.
2. A dirty working tree may represent authorized in-progress work.
3. State files (`CURRENT_STATE.md`, `HANDOFF_PACKET.md`, `DOCUMENT_MANIFEST.md`, active phase index) may represent the last synchronized baseline until the normal LOCK -> SYNC STATE stage occurs.
4. Do NOT restart active work solely because `CURRENT_STATE.md` says the next unit has not started.
5. Prohibit destructive handling of unknown modified/untracked files.

**Important Context Rules:**
- do not ask owner to repeat documented decisions
- do not rely on chat memory
- do not reopen LOCKED/FROZEN decisions without explicit conflict
- context reconstruction must PASS before making changes
- preserve relevant terminology/hierarchy reads by referencing the canonical protocol
