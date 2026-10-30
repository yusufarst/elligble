**Status:** OWNER-APPROVED DESIGN INTENT (2026-10-31); preservation document, NOT a production-token specification
**Task:** GOV-DESIGN-001; HIGH; PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE
**Task publication:** VERIFYING; Independent HIGH-risk Review and Owner acceptance of this preservation artifact pending
**Supersession:** NONE; no new LOCKED decision ID

# ELLIGBLE Calm Progress — Owner design intent

## 1. Purpose and authority

Preserve the Owner-approved direction received on **2026-10-31** so later authorized work can recover its intent without treating a chat summary as a token contract. Approval of this direction is distinct from acceptance of this document's exact content, implementation authorization and approval of any exact production value.

[Decision hierarchy](../00-governance/00.02_DECISION_HIERARCHY.md), [DEC-044](../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) and [DEC-045](../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) remain binding. This document supersedes no clause of DEC-039/040/043 or any LOCKED/FROZEN source. When a candidate conflicts with a locked value, retain the locked implementation and obtain an explicit, exact-clause Owner-approved reconciliation before changing it.

## 2. Approved direction, candidate values and reuse

ELLIGBLE Calm Progress is an original ELLIGBLE identity: professional, elegant, premium, formal, warm, calm and age-appropriate for secondary education. Duolingo inspires intuitive progression and understandable feedback patterns only. Do not copy its brand assets, mascot, illustrations, wording, layouts or trade dress; no reference scraping or prototype copying is authorized.

- Warm-neutral surfaces, high readability and accessible contrast; clear content hierarchy and proportionate whitespace rather than dashboard clutter.
- Soft, desaturated **sage green and muted teal are candidate accents**. Exact hex values, usage roles, combinations and production tokens are **NOT APPROVED** here. No swatches, replacement token table, new font, icon library or dependency is selected.
- Restrained spacing, radii and elevation within existing shared scales; consistent outline iconography and predictable controls.
- Purposeful micro-interactions may clarify action/feedback in a future authorized Task. Use existing motion constraints and reduced-motion support; no distracting loops, tap-target movement, layout instability or delayed critical action.
- Reuse existing shared ELLIGBLE components and the approved **shadcn/ui** foundation, themed with current canonical tokens. No duplicate page themes, role-specific palettes, parallel component system or global redesign.

## 3. One system, role-appropriate behavior

Student, Teacher, Homeroom Teacher, Proctor and School Operator use one coherent typography/token/component/interaction system. Future roles inherit that principle only when their domains and implementation Tasks are separately authorized; this document does not reopen deferred DEC-044 domains.

Student progress outside active exams may feel encouraging and interactive with truthful progress and respectful feedback. This is an intent, not authorization to build a progress, streak, XP or reward feature. Operational screens remain formal, information-first and efficient: status, freshness, scope, errors and accountable actions take precedence over decoration. Role variation changes useful density/content, not the product's identity or authority boundaries.

## 4. Active CBT: distraction-free and truthful

Preserve [DEC-039 exam focus](SECURE_ASSESSMENT_EXAM_FOCUS_WORKSPACE.md): question/stimulus/answers lead, compact context follows authoritative Subject → assigned Exam Room → omit, with the existing command dock and focused navigation. Do not introduce a large application header or duplicate timer.

- No streak, XP, gamification, distracting celebration or reward pressure during exams.
- Server-authoritative timer, pause/lock/expiry and submission behavior unchanged; animation never implies extra time or delays answering/submission.
- Selection feedback is distinct from persistence: pending/saving is not saved. ACK/saved feedback requires matching server acknowledgement; offline, failed and refused states remain explicit and honest. No success animation before ACK.
- Preserve answer durability/reconciliation, session/device authority, tenant/object authorization, privacy, immutable snapshots and scoring integrity.
- Preserve keyboard/native input behavior, visible focus, screen-reader semantics, color-independent states, >=44px touch targets, responsive reflow and reduced motion. Existing WCAG 2.1 AA constraints remain; source review or this document does not certify rendered accessibility.

## 5. Locked boundaries and potential conflicts

Sources: [DEC-040 foundation](ELLIGBLE_WARM_MONOCHROME_VISUAL_FOUNDATION.md), [frontend design system](FRONTEND_DESIGN_SYSTEM.md), [DEC-043](../decisions/DECISION_LOG.md), [copy rules](UI_CONTENT_AND_COPY_STYLE.md), and [global consistency contract](../production/PRODUCTION_COMPLETION_PLAN.md).

| Exact applicable source | Compatibility or potential conflict | Required future resolution; current rule |
|---|---|---|
| DEC-040 foundation §2 items 1 and 5, and §5; design system §10/§11 | Warm calm surfaces are compatible. Decorative sage/teal, large tinted fields or new accent semantics could conflict with monochrome dominance and semantic-only accents | Candidate exploration only. Specify exact clause/value/role delta, contrast and state rationale, then obtain explicit Owner approval; current palette remains |
| DEC-040 §4/§5/§14; design system §10 | Colored primary actions would conflict with locked black primary/white foreground and existing token roles | No replacement of primary/action/focus tokens. Any later change requires exact-clause supersession and centralized reconciliation |
| DEC-040 §7–§15 and §23 | Premium typography, restrained spacing/radii/shadows and outline icons are compatible in principle; arbitrary new fonts, geometry, elevation or weakened focus are not | Preserve current values, delivery/fallbacks and accessibility. Review proposed deviations explicitly; no package/font/icon selected here |
| DEC-040 §17/§18 and exam workspace §3/§4 | Encouraging feedback cannot reinterpret green selection as server save or replace compact honest save status | Retain selection/save separation and authoritative context; no semantic supersession proposed |
| DEC-040 §3/§4 | The locked ElevenLabs-inspired foundation remains; Duolingo progression inspiration is a new intent reference, not replacement visual authority | Keep original ELLIGBLE assets; do not silently substitute a new brand/theme or rewrite the locked reference |
| DEC-043 and living plan §10.1 | shadcn/ui/shared primitives remain approved; DesainPakeAI authority must be reconciled with this recorded intent before implementation | Verify approved project identity and revision via dpai CLI only in a separately authorized Task. No access/revision/alignment is claimed here, no key printed, no different project substituted. UI-SYSTEM-005 remains BLOCKED |
| Owner 2026-10-27 cosmetic deferral; UI-SYSTEM-004 record §9.6 | Preserving intent now does not authorize cosmetic redesign or sticky-header polish | Deferral remains; functional UX/accessibility and CBT security/integrity gates are never waived |

No active canonical conflict is resolved or new decision approved by this conflict register: it identifies possible future implementation conflicts. **DEC-040 remains LOCKED** until an explicitly approved exact-clause supersession.

## 6. Future reconciliation gate and present non-goals

A later separately authorized Task must identify proposed surface/role/interaction and exact affected canonical clauses, verify the approved DesainPakeAI project/revision, distinguish compatible refinements from proposed supersessions, and secure explicit Owner approval for every conflicting change. Only then may an authorized bounded implementation modify centrally shared tokens/primitives and provide actual rendered mobile/tablet/desktop, accessibility, interaction and regression evidence. No blanket supersession or per-page workaround.

This Task preserves design intent only. It changes no UI, design source, production token, API, schema, dependency or test. No rendered visual PASS, prototype, production-ready, deployment or implementation claim. No vendor/cost added. GOV-REALIGN-006 remains DONE for candidate preparation only; final P11 remains NOT APPROVED / NOT ACTIVE, O01–O09/PB05 and other applicable blockers remain OPEN. Approval of this document never implies any of those approvals or another Task's execution.

Acceptance of the preservation artifact requires exact-content CI, Independent HIGH-risk Review and explicit Owner acceptance under [GOV-DESIGN-001](../production/tasks/GOV-DESIGN-001.md). No implementation or LOCKED supersession is required to complete this documentation outcome.
