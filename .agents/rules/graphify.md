---
trigger: always_on
description: Consult the graphify knowledge graph at graphify-out/ for codebase and architecture questions.
---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- For codebase or architecture questions, when `graphify-out/graph.json` exists, first run `graphify query "<question>"` (CLI) or `query_graph` (MCP). Use `graphify path "<A>" "<B>"` / `shortest_path` for relationships and `graphify explain "<concept>"` / `get_node` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## ELLIGBLE Authority Guard
Graphify is a derived navigation and analysis layer, never canonical authority.
Repository canonical sources remain the highest source of truth.
For governance, architecture, Build Unit, capability, Production Blocker, or implementation decisions: use Graphify to orient, then open and verify the canonical repository source before deciding.
If Graphify conflicts with canonical repository evidence, canonical repository evidence wins.
EXTRACTED Graphify relationships are navigation evidence, not governance authority.
INFERRED Graphify relationships are not Owner-approved architecture decisions.
Graphify must never reopen a completed Build Unit.
Graphify must never supersede LOCKED/FROZEN decisions.
Graphify must never alter current Build navigation by inference.
graphify-out/ must never become a runtime or production dependency.
Freshness policy:
graphify update . after meaningful source/runtime/schema changes.
Run it after material governance/architecture changes.
Run it after completed implementation BUs where relationships materially changed.
Run before complex repository-wide impact/dependency analysis when freshness is uncertain.
Do not rebuild for every trivial text edit.
Graphify freshness is DEVELOPMENT SUPPORT, not a production gate.
