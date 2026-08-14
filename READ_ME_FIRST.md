# READ ME FIRST — ELLIGBLE

You are working on the ELLIGBLE platform.

Before doing anything:

1. Read `AGENTS.md`.
2. Read `docs/master/MASTER_CONTEXT.md`.
3. Read `docs/state/CURRENT_STATE.md`.
4. Read `docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md`.
5. Read `docs/00-governance/00.02_DECISION_HIERARCHY.md`.
6. Read only the context pack relevant to the current task.
7. Do not build `OPEN`, `FUTURE`, `DROP`, or unaudited `LEGACY` items.
8. Do not reuse legacy CBT code/migrations/RLS/RPC without audit.
9. Do not introduce paid AI dependencies into baseline ELLIGBLE.
10. Use one controlled unit of work per agent execution.
11. Verify work in the terminal before declaring `DONE`.
12. If `CURRENT_STATE.md` says a phase has not started, do not jump ahead.

Current project state:

```text
Recovery: FROZEN v1.0.0
Discovery 01–04: COMPLETE / LOCKED
Master Blueprint: IN PROGRESS
Architecture: NOT STARTED
Implementation: NOT AUTHORIZED YET
```

## NEW AGENT / NEW CHAT ENTRY PATH

For a new agent or new chat, you must read files in this exact order:

1. `READ_ME_FIRST.md`
2. `AGENTS.md`
3. `docs/master/MASTER_CONTEXT.md`
4. `docs/state/CURRENT_STATE.md`
5. `docs/state/HANDOFF_PACKET.md`
6. `docs/DOCUMENT_MANIFEST.md`
7. Decision Hierarchy (`docs/00-governance/00.02_DECISION_HIERARCHY.md`)
8. Canonical Terminology (`docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md`)
9. Active phase index
10. Relevant PHASE/DOMAIN docs

**Important Context Rules:**
- do not ask owner to repeat documented decisions
- do not rely on chat memory
- do not reopen LOCKED/FROZEN decisions without explicit conflict
- context reconstruction must PASS before making changes
