# AI-FIRST COMPLEX WEB APPLICATION DELIVERY FRAMEWORK
## Master Template for Planning Agents, Execution Agents, Review Agents, Release Agents, and Long-Term AI Maintenance

**Framework ID:** AICWDF-4.3  
**Version:** 4.3 — English  
**Status:** Reusable master baseline  
**Default project class:** Large / complex / high-precision  
**Operating model:** Full or near-full AI-assisted planning, implementation, testing, deployment, and maintenance  
**Primary Source of Truth:** Repository  
**Execution model:** Explicit Tasks with automatic progress tracking  
**Core principle:** Planning may be deep; execution must never be ambiguous.

---

# 0. PURPOSE OF THIS FRAMEWORK

This file is a **master operating framework**, not a project-specific specification.

Its purpose is to allow a Planning Agent, Execution Agent, Review Agent, Release Agent, or Maintenance Agent to enter an active project, understand the current state, reuse valid work that already exists, fill only the real gaps, and continue safely without depending on hidden chat history.

The framework is designed for projects where:

- the owner may not be a programmer;
- most planning and implementation is delegated to AI agents;
- different AI agents may work on the same project over time;
- the project may become large, long-lived, and data-sensitive;
- repository documentation must remain understandable years later;
- every Task must be trackable, testable, and visibly completed.

---

# 1. FIRST RULE: ADAPT TO THE ACTIVE PROJECT, DO NOT RESET IT

When this file is given to an agent, the agent MUST first determine the actual project state.

Classify the project as:

```text
NEW
PARTIALLY_PLANNED
PARTIALLY_IMPLEMENTED
PRODUCTION
LEGACY
```

Then inspect:

- repository structure;
- existing documentation;
- existing task/roadmap files;
- architecture decisions;
- design system;
- current implementation;
- tests;
- deployment configuration;
- handoff/status files;
- current tools already installed.

The agent MUST NOT blindly recreate everything.

Preferred adoption flow:

```text
Inspect repository
↓
Inventory existing documents and tools
↓
Map existing material to this framework
↓
Reuse what is still valid
↓
Adapt what is incomplete or inconsistent
↓
Mark superseded material clearly
↓
Create only missing pieces
↓
Continue from the real project state
```

The agent MAY keep old filenames and old folder structures if they are already clear.

The agent MAY merge, split, rename, archive, or extend documents if that improves clarity.

The agent MUST NOT:

- discard valid project decisions merely because the template uses a different filename;
- create duplicate authoritative documents for the same subject;
- silently override an existing approved decision;
- perform a documentation reset unless the owner explicitly requests it.

---


## 1.1 Existing complex-project adoption mode

If earlier planning phases are already APPROVED, do not re-plan them merely because this framework is newer.

Example:

```text
P0 ✓
P1 ✓
P2 ✓
P3 ✓
P4 ✓
P5 ✓
P6 ✓
P7 not started
```

Correct adoption:

```text
Preserve P0–P6
↓
Map this framework to existing governance
↓
Continue from P7
↓
Complete P7–P10
↓
P11 generates the definitive Task baseline
↓
Planning freeze
↓
Execution starts
```

Approved historical artifacts, approval chains, decision logs and old terminology may remain unchanged when renaming would weaken traceability.

From the adoption point forward, **Task** is the preferred execution term.

## 1.2 Compatibility over conformity

The active project does not need to look exactly like this template.

The agent should optimize for:

```text
PRESERVE VALID DECISIONS
+
FILL REAL GAPS
+
REDUCE EXECUTOR AMBIGUITY
+
KEEP TRACEABILITY
```

Do not force cosmetic restructuring of a mature project.

---

# 2. REPOSITORY IS THE SOURCE OF TRUTH

The repository is the durable Source of Truth for:

- product requirements;
- business rules;
- domain model;
- workflows;
- routes;
- interactions;
- permissions;
- architecture;
- design system;
- navigation rules;
- Tasks;
- Task progress;
- tests;
- ADRs;
- operations;
- release procedures;
- maintenance state;
- handoff.

Chat is contextual.

If a decision is made in chat and affects the project, the responsible agent MUST write that decision back into the repository before relying on it as durable project truth.

---

# 3. SOURCE-OF-TRUTH AUTHORITY HIERARCHY

Unless the project explicitly defines another hierarchy, use:

```text
1. Latest owner-approved decision recorded in repository
2. AGENTS.md / active framework rules
3. Active Task contract
4. Current ADRs
5. Product / Domain / Workflow / Architecture / Security / Design docs
6. Current implementation and tests
7. CURRENT_HANDOFF.md
8. Chat/session context
```

When a contradiction is found:

```text
Detect conflict
↓
Determine whether one source supersedes another
↓
Update repository to remove persistent contradiction
↓
If unresolved → BLOCKED
```

Never silently choose between conflicting authoritative sources.

---

# 4. DEFAULT TECHNOLOGY STACK

Unless explicitly overridden by the owner:

## Backend
- Laravel

## Frontend
- Inertia
- React
- TypeScript

## UI
- shadcn/ui
- Tailwind CSS

## Database
- PostgreSQL

## Web Server
- Nginx

## Queue / Cache / Rate Limiter
- Valkey or Redis only when actually required

## Architecture
- Modular Monolith
- Layered Architecture
- MVC Web Layer
- Application Actions / Services
- Domain-oriented modules

Microservices are NOT the default.

A material deviation requires:

```text
ADR REQUIRED: YES
OWNER APPROVAL: REQUIRED
REASON: DOCUMENTED
RISK: DOCUMENTED
MIGRATION IMPACT: DOCUMENTED
ROLLBACK IMPACT: DOCUMENTED
```

---


# 4A. AUTHENTICATION DEFAULT — SIMPLE, FAST, NATIVE TO THE ACTIVE STACK

Authentication must be fast to build, easy to understand, modular, inexpensive to operate, and explicit enough that Planning and Execution Agents do not redesign it repeatedly.

## 4A.1 One-time stack decision

The Planning Agent decides the authentication implementation once and records it in the repository. Execution Agents reuse that decision.

```text
IF server/runtime = TypeScript/JavaScript
AND Better Auth is compatible:
→ AUTH IMPLEMENTATION = Better Auth core/basic

IF backend = Laravel/PHP:
→ AUTH IMPLEMENTATION = Laravel-native authentication
→ use the current official Laravel starter/auth stack as appropriate
→ use Laravel Socialite for Google OAuth
→ DO NOT add a separate Node/TypeScript auth service just to force Better Auth

OTHER STACK:
→ choose the simplest mature native/compatible authentication solution
→ document it once
```

The framework optimizes for **simple native integration**, not loyalty to one library.

## 4A.2 Shared DEFAULT CORE for normal web applications

Unless the project explicitly does not need one of these capabilities:

```text
DEFAULT CORE
✓ Email/password login
✓ Session management
✓ Account/profile management
✓ Password reset/recovery
✓ Email verification when email ownership matters
✓ Basic login throttling / rate limiting
✓ Secure password hashing using the selected framework's current safe defaults
✓ Google sign-in when OAuth is suitable for the application
```

Advanced authentication features remain OFF unless required:

```text
OFF BY DEFAULT
- Additional social providers
- Passkeys
- Magic link
- OTP login
- 2FA/MFA
- Enterprise SSO
- Organization/enterprise auth plugins
- Paid authentication SaaS
- Hosted auth infrastructure that adds recurring cost
```

Do not enable features merely because the library provides them.

## 4A.3 Google sign-in is the default convenience login when appropriate

Google login is considered sufficiently straightforward to be a default convenience option because:

- Better Auth has a direct Google social-provider integration on compatible TypeScript stacks;
- Laravel supports Google OAuth through Laravel Socialite;
- it does not require introducing a paid authentication SaaS;
- the main external setup is Google OAuth credentials, consent configuration, and redirect URI configuration.

Default policy:

```text
GOOGLE SIGN-IN:
ON BY DEFAULT for ordinary internet-connected web applications

SKIP / DISABLE when:
- the application is intentionally offline/local-only;
- the client/organization forbids Google identity;
- a different enterprise identity provider is mandatory;
- regulatory/contractual identity rules conflict;
- the feature would materially complicate a closed internal system without real benefit.
```

Google login MUST NOT automatically mean open self-registration.

```text
GOOGLE SIGN-IN = authentication method
AUTO-REGISTRATION = separate product/security decision
```

For closed/internal systems, the default should be:

```text
Google login: available when suitable
Automatic creation of unapproved users: OFF
```

The provider identity must map to the application's own user/account model. Domain records must not depend directly on Google-specific identifiers.

## 4A.4 Google implementation contract

When Google login is enabled, record:

```text
Provider: Google
Client ID: secret/environment-managed
Client Secret: secret/environment-managed
Redirect URI: environment-specific
Allowed registration behavior: OPEN / INVITE_ONLY / EXISTING_ACCOUNT_ONLY
Account-linking rule: documented
Failure/cancel behavior: documented
Indonesian label: "Lanjutkan dengan Google"
English label: "Continue with Google"
```

Secrets MUST NOT be committed to the repository.

If Google credentials require owner/client access to Google Cloud Console, the agent should complete all local implementation/configuration work first and request only the minimum credential/setup action needed.

## 4A.5 Owner-selected password baseline

The default project password profile is intentionally standardized for usability and predictable implementation:

```text
PASSWORD PROFILE: AICWDF-COMPAT-8
MINIMUM LENGTH: 8 characters
REQUIRE LETTER: YES
REQUIRE UPPERCASE + LOWERCASE: YES
REQUIRE NUMBER: YES
REQUIRE SYMBOL: YES
PASSWORD MANAGER / PASTE SUPPORT: YES
PERIODIC FORCED ROTATION: NO, unless externally required
```

Example shape:

```text
Minimum 8 characters
+ uppercase
+ lowercase
+ number
+ symbol
```

### Precedence rule

If an older project document uses a stricter length only because of an earlier internal/planner-selected project policy (for example 12 or 15 characters), adoption of AICWDF-4.3 by the Owner supersedes that internal baseline and the project should be normalized to `AICWDF-COMPAT-8`.

Do NOT silently lower a password requirement that is imposed by:

- law/regulation;
- contractual requirement;
- formal certification/compliance requirement;
- a binding external security standard the project explicitly claims to follow.

If one of those external requirements applies, report the conflict and use the required stronger policy.

### Security standards note

`AICWDF-COMPAT-8` is an **Owner-selected usability/compatibility profile**, not a claim of current NIST password-policy compliance. Current NIST guidance uses a longer minimum for single-factor passwords and does not recommend mandatory character-composition rules. Therefore, if a project explicitly targets NIST-aligned authentication, the Planning Agent must use the relevant current NIST profile instead of claiming this baseline is NIST-compliant.

## 4A.6 Better Auth implementation profile

When Better Auth is selected:

```text
BETTER AUTH DEFAULT CORE
✓ Email/password
✓ Session management
✓ Account management
✓ Password reset/recovery when required
✓ Email verification when required
✓ Google social provider when suitable
✓ Basic security/rate limiting
```

Use current Better Auth documentation for exact APIs and supported options. Do not rely on remembered APIs.

## 4A.7 Laravel/PHP implementation profile

When Laravel/PHP is selected:

```text
LARAVEL AUTH DEFAULT CORE
✓ Laravel-native form authentication
✓ Session management
✓ Account/profile management
✓ Password reset/recovery
✓ Email verification when required
✓ Login throttling / rate limiting
✓ Framework-native secure password hashing
✓ Google OAuth through Laravel Socialite when suitable
```

Password validation can use Laravel's current `Password` rule capabilities. Exact syntax must be verified against the current Laravel version before implementation.

Do not install Sanctum, Passport, OAuth server packages, or other authentication components unless the active application actually needs API/mobile/token behavior that requires them.

## 4A.8 Authentication and authorization remain separate

```text
AUTHENTICATION
→ Who is the user?
→ How is the session established?

AUTHORIZATION
→ What may this user do?
→ Roles, permissions, company/tenant scope, object/domain policies
```

The authentication library MUST NOT become the sole definition of authorization in a complex business application.

## 4A.9 Authentication boundary and modularity

Keep authentication behind a clear application boundary so:

- session/user mapping is explicit;
- Better Auth/Laravel/Google-specific types do not spread through unrelated domain modules;
- future authentication changes remain bounded;
- application authorization stays provider-neutral;
- testing can isolate authentication behavior;
- adding/removing a login provider does not rewrite core business rules.

## 4A.10 Login screen default pattern

The default login experience should be simple and visually calm:

```text
Welcome heading
Short supporting text

Email
Password
Primary Sign In button

──────── or ────────

[ Google icon ] Continue with Google

Terms / Privacy note only when applicable
```

Indonesian UI example:

```text
Selamat datang kembali!
Masuk dengan akun Anda atau lanjutkan dengan penyedia.

[ Lanjutkan dengan Google ]
```

The screen must follow the global breathing-room rules: generous spacing, clear hierarchy, minimal clutter, and no unnecessary authentication choices.

## 4A.11 Cost and documentation rule

Prefer self-hosted/open-source/native framework capability.

Do not add paid auth infrastructure unless genuinely required and explicitly approved.

Before implementing or upgrading authentication:

- consult current official documentation;
- use Context7/current docs when available;
- verify the active framework/library version;
- verify Google OAuth redirect/callback behavior;
- do not rely on remembered APIs.

---

# 4B. INDONESIAN-FIRST BILINGUAL USER EXPERIENCE


## 4B.1 Default user-facing language

All user-facing UI defaults to:

```text
id-ID
Bahasa Indonesia
```

Copy must be natural, concise and understandable by non-technical users.

Prefer:

```text
Gagal masuk
Data belum berhasil disimpan
Anda tidak memiliki akses
Data yang Anda cari tidak ditemukan
```

over developer-centric wording such as raw exception names, HTTP jargon or internal identifiers.

## 4B.2 English is mandatory as a second language

Supported locales:

```text
id-ID
en
```

A clear language switcher is required. The exact placement follows the design system.

## 4B.3 Technical naming remains English

Code, identifiers and technical internals should remain English where practical.

Example:

```text
StudentController
ApprovePaymentAction
InventoryService
```

while the user sees:

```text
Data Siswa
Setujui Pembayaran
Persediaan
```

## 4B.4 Localization architecture

Where localization applies:

```text
USER-FACING HARDCODED COPY: FORBIDDEN
```

Use an i18n/localization architecture suitable for the active stack.

The system should preserve locale preference when practical and must not break navigation after switching languages.

## 4B.5 Localization quality target

```text
INDONESIAN DEFAULT: PASS / FAIL
PLAIN INDONESIAN: PASS / FAIL
ENGLISH TRANSLATION: PASS / FAIL
LANGUAGE SWITCH: PASS / FAIL
MISSING TRANSLATION KEYS: 0
LAYOUT AFTER LOCALE CHANGE: PASS / FAIL
```

---

# 4C. NEAR-ZERO ADDITIONAL PRODUCTION COST POLICY

Default commercial assumption:

```text
DOMAIN COST:
CLIENT-FUNDED

VPS COST:
CLIENT-FUNDED

TARGET ADDITIONAL RECURRING PRODUCTION COST:
0
```

Technology decisions should optimize:

```text
QUALITY
+
SIMPLICITY
+
RELIABILITY
+
NEAR-ZERO ADDITIONAL RECURRING COST
```

## 4C.1 Technology selection order

Prefer:

```text
1. Existing project capability
2. Native framework/platform capability
3. Free open-source package
4. Self-hosted open-source capability on existing infrastructure
5. Reliable free-tier external service
6. Paid external service only with explicit owner approval
```

## 4C.2 Paid service stop condition

If a paid service is proposed:

```text
PAID SERVICE PROPOSED
↓
STOP THAT DECISION
↓
Explain the requirement
↓
Show free/open-source/self-hosted alternatives
↓
Show trade-offs
↓
Estimate recurring cost
↓
Request owner approval
```

## 4C.3 Production AI dependency

Default:

```text
PAID PRODUCTION AI DEPENDENCY: NONE
```

Do not introduce a paid AI API unless it is a real product requirement and explicitly approved.

## 4C.4 Free-tier caution

For critical free-tier dependencies, record limits, quota behavior, vendor lock-in, exit strategy and data portability.

---

# 5. MANDATORY ENGINEERING CAPABILITIES

Named tools are preferred, but the real requirement is the capability.

## 5.1 Current Documentation Capability

Preferred tool:

- Context7

Purpose:

- current Laravel documentation;
- current Inertia documentation;
- React APIs;
- TypeScript behavior;
- Tailwind CSS;
- shadcn/ui;
- PostgreSQL integration;
- third-party packages;
- SDKs;
- APIs.

Rule:

> Do not rely on model memory alone when current documentation can materially affect correctness.

## 5.2 Codebase Impact Analysis Capability

Preferred tool:

- Graphify

Purpose:

- dependency discovery;
- relationship mapping;
- affected-area analysis;
- callers/callees;
- shared component/service impact;
- codebase navigation;
- architecture drift detection.

Graphify is a map, not the authority.

Repository source code and approved project documentation remain authoritative.

## 5.3 Browser E2E Capability

Preferred tool:

- Playwright

Purpose:

- actual click behavior;
- route verification;
- forms;
- navigation;
- back actions;
- browser console errors;
- failed network requests;
- critical user journeys.

## 5.4 UI Component Capability

Preferred:

- shadcn/ui

## 5.5 Visual Reference Capability

Preferred:

- DesainPakaiAI

Or:

- another project-relevant design reference approved or selected for the active project.

## 5.6 Static and Automated Verification Capability

Must cover as applicable:

- lint;
- typecheck;
- unit tests;
- feature tests;
- integration tests;
- authorization tests;
- route integrity;
- E2E;
- build verification;
- security checks.

---

# 6. AUTOMATIC TOOLCHAIN BOOTSTRAP

The agent owns routine technical tool setup.

The owner should not be asked to manually install ordinary development tools that the agent can safely install and verify itself.

## 6.1 Tool detection

Before planning or executing work that needs a tool:

```text
Detect required capability
↓
Check whether a suitable tool already exists
↓
If existing equivalent is good → reuse it
↓
If missing → determine safest installation method
↓
Install/configure automatically when safe
↓
Verify
↓
Record setup
↓
Continue original Task
```

## 6.2 Installation preference

Prefer:

```text
PROJECT-LOCAL
↓
DEV DEPENDENCY
↓
USER-LOCAL TOOL
↓
GLOBAL/SYSTEM-WIDE only when genuinely necessary
```

## 6.3 Automatic installation is allowed when

- installation is reversible;
- it does not destroy project state;
- it does not expose secrets;
- it does not silently upgrade the entire framework;
- it does not require dangerous production changes;
- current environment permissions allow it;
- compatibility with the active project has been checked.

## 6.4 Do not install tools blindly

A tool must be:

- required by the active Task/project; or
- materially useful for safety, correctness, testing, impact analysis, or maintainability.

Example:

```text
Graphify on an empty new repository
→ may be deferred

Graphify on a large mature codebase
→ strongly preferred

Playwright on a real UI application
→ required unless an equivalent E2E capability already exists

Redis/Valkey without a concrete use case
→ do not install
```

## 6.5 Existing equivalent tools

If the project already has an equivalent capability, do not replace it simply because this framework names another preferred tool.

Example:

```text
Existing browser E2E tool already satisfies requirements
→ reuse it
→ do not remove it merely to install Playwright
```

## 6.6 Authentication / paid services / privileged operations

If installation or setup reaches a step requiring:

- OAuth;
- login;
- API key;
- subscription/billing;
- admin/root approval;
- external account connection;
- risky infrastructure change;

the agent MUST automatically complete every safe step it can first.

Only then:

```text
STATUS: BLOCKED FOR MINIMUM OWNER ACTION
REQUIRED ACTION: ...
WHY: ...
WHAT IS ALREADY COMPLETED: ...
WHAT WILL CONTINUE AFTER APPROVAL: ...
```

## 6.7 No silent compatibility upgrades

Installing a tool MUST NOT silently trigger unrelated major upgrades.

If a tool requires a major incompatible upgrade:

```text
STOP
↓
Compatibility impact analysis
↓
Separate upgrade proposal
↓
Approval
```

## 6.8 Tool verification

After installing/configuring a tool, verify it actually works.

Record:

```text
TOOL:
PURPOSE:
STATUS:
VERSION:
INSTALLATION SCOPE:
VERIFICATION:
FILES/CONFIG CHANGED:
SAFE TO CONTINUE: YES / NO
```

---

# 6A. MCP CONTEXT BUDGET & ON-DEMAND ACTIVATION POLICY

Installing a tool and exposing its complete MCP tool schema to every coding turn are different decisions.

The framework MUST optimize both:

```text
TOOL AVAILABILITY
+
CONTEXT EFFICIENCY
```

## 6A.1 Core rule

> Install reusable tools when justified, but activate/expose only the MCP servers required for the current planning or coding session.

Do NOT keep large MCP servers active merely because they may be useful later.

## 6A.2 Session-scoped MCP workflow

At the start of a planning/execution session:

```text
Read active Task
↓
Determine required capabilities
↓
Inspect currently configured/active MCP servers
↓
Keep only relevant MCP capabilities exposed
↓
Use native CLI/package instead of MCP when it is sufficient
↓
Execute Task
↓
Deactivate/remove session-irrelevant heavy MCP exposure when practical
```

## 6A.3 Example policy

```text
TASK: Backend domain validation

Required:
- Repository/code tools
- Context7 only if current docs are needed

Not required:
- Playwright MCP
- AWS MCP
- Figma MCP
- Cloud infrastructure MCP

Result:
Do not expose irrelevant MCP schemas to the session.
```

For a browser E2E Task:

```text
Playwright capability: REQUIRED

Preferred order:
1. Existing project Playwright package/CLI if sufficient
2. Playwright MCP only when interactive MCP capability materially helps
```

## 6A.4 Claude Code example

Where Claude Code is the active client, inspect configured MCP servers using currently supported client commands, for example:

```bash
claude mcp list
```

Use current Claude Code documentation for management commands. Do not invent enable/disable commands.

If the client does not support temporary disablement cleanly, prefer:

- project/local scoping;
- separate session profiles;
- removing an irrelevant server from the current scope and restoring it later if needed;
- using the underlying CLI/package instead of MCP.

## 6A.5 Do not hardcode universal token numbers

Do NOT assume every MCP server costs a fixed number of tokens.

Actual context overhead depends on:

- the client;
- tool-schema size;
- number of exposed tools;
- server implementation;
- current product behavior.

Policy:

```text
MEASURE / INSPECT
→ MINIMIZE
→ ACTIVATE ON DEMAND
```

## 6A.6 MCP states in TOOLCHAIN.md

Record where relevant:

```text
MCP SERVER:
CAPABILITY:
INSTALLED: YES / NO
SESSION DEFAULT: OFF / ON
ACTIVATE WHEN:
DEACTIVATE WHEN:
SCOPE: LOCAL / PROJECT / USER
HEAVY CONTEXT RISK: LOW / MEDIUM / HIGH / UNKNOWN
```

Default for heavy/specialized MCP servers:

```text
SESSION DEFAULT: OFF
```

unless required for nearly every Task in the project.

## 6A.7 Agent behavior

The agent MUST NOT:

- load every installed MCP by default;
- keep Playwright MCP active during non-browser work;
- keep cloud/infrastructure MCP active during unrelated application coding;
- duplicate the same capability through several MCP servers without reason;
- sacrifice correctness by removing a tool genuinely required by the active Task.

The agent SHOULD:

- prefer the smallest active MCP set;
- activate capability only when needed;
- reuse installed tools without repeatedly reinstalling them;
- prefer native project tools when they avoid unnecessary MCP context overhead;
- record stable tool/session policy in TOOLCHAIN.md.

---

# 7. PROJECT TOOLCHAIN REGISTRY

Maintain a project toolchain record, recommended:

```text
/docs/00-governance/TOOLCHAIN.md
```

Example:

```text
Context7
Capability: current documentation
Status: REQUIRED
Available: YES
Verified: YES

Graphify
Capability: impact analysis
Status: REQUIRED_FOR_SIGNIFICANT_CHANGES
Available: YES
Graph freshness policy: update after material code changes

Playwright
Capability: browser E2E
Status: REQUIRED_FOR_UI
Available: YES
Verified: YES

shadcn/ui
Capability: UI component system
Status: REQUIRED
Available: YES
```

---

# 8. TOKEN-EFFICIENT WORKING RULES

Agents MUST minimize unnecessary context usage without reducing quality.

Preferred sequence:

```text
AGENTS.md
↓
CURRENT_HANDOFF.md
↓
Active TASK-XXX.md
↓
Referenced project docs
↓
Graphify / targeted search
↓
Relevant source files
↓
Context7 if needed
```

Prefer:

- targeted repository search;
- symbol search;
- `rg`/ripgrep or equivalent;
- small file ranges;
- existing architecture maps;
- existing ADRs;
- existing tests;
- small bounded diffs.

Avoid:

- rereading the entire repository every Task;
- repeatedly loading unchanged large documents;
- recreating information that already exists;
- duplicating documentation.

Token efficiency MUST NOT override correctness or safety.

---

# 9. AGENT ROLE DETECTION

Every agent must identify its role before acting.

## 9.1 Planning Agent

Primary responsibilities:

- inspect actual project state;
- map existing documentation;
- complete/refine P0–P11;
- resolve ambiguity;
- define product/domain/workflows;
- define architecture;
- define security;
- define UX/navigation;
- define route and interaction contracts;
- define testing;
- define infrastructure/release;
- generate Task baseline;
- define total Task count;
- define dependencies;
- make Tasks executor-ready.

The Planning Agent should not implement large features unless explicitly requested.

## 9.2 Execution / Coding Agent

Primary responsibilities:

- select a `READY` Task;
- load only the minimum required execution context;
- confirm prerequisites;
- auto-bootstrap missing tools when safe;
- perform targeted impact analysis;
- implement within scope;
- run mandatory tests;
- collect evidence;
- update Task status;
- update master Task checklist;
- update handoff.

Default executor read path:

```text
1. AGENTS.md
2. EXECUTION_CONTEXT.md
3. CURRENT_HANDOFF.md
4. TASK_PLAN.md
5. Active TASK-XXX.md
6. Exact documents/sections referenced by the Task
7. Relevant source files only
```

The executor SHOULD NOT reread the entire P0–P11 corpus for every Task.

The Execution Agent MUST NOT silently redefine requirements, reopen approved project decisions, redesign unrelated architecture, or expand scope because adjacent work appears convenient.

## 9.3 Review / QA Agent

Primary responsibilities:

- compare implementation with Task contracts;
- verify tests and evidence;
- verify route/interaction integrity;
- verify design/navigation consistency;
- detect architecture drift;
- reject false completion.

## 9.4 Release Agent

Primary responsibilities:

- verify all release Tasks;
- verify regression;
- verify staging/UAT;
- confirm DB declaration;
- confirm backup/rollback;
- release through approved path;
- health/smoke verification.

## 9.5 Maintenance / Incident Agent

Primary responsibilities:

- reproduce issues safely;
- default DB impact to NONE;
- create or use a maintenance Task;
- fix application logic;
- run targeted + regression tests;
- avoid direct production DB manipulation;
- preserve long-term data and compatibility.

---

# 10. MASTER DELIVERY MODEL

```text
P0 FOUNDATION
↓
P1–P10 DEEP PLANNING
↓
P11 TASK PLANNING
↓
TASK BASELINE + TOTAL COUNT
↓
TASK DEPENDENCY GRAPH
↓
READY TASK QUEUE
↓
TASK-001 → IMPLEMENT → TEST → EVIDENCE → DONE ✓
↓
TASK-002 → IMPLEMENT → TEST → EVIDENCE → DONE ✓
↓
...
↓
ALL REQUIRED TASKS = DONE
↓
FULL REGRESSION
↓
STAGING
↓
UAT
↓
RELEASE READINESS
↓
main
↓
Coolify
↓
Hostinger VPS
↓
Health + Smoke
↓
LIVE
↓
OPERATE / MAINTAIN
```

---

# 11. P0 — GOVERNANCE, FOUNDATION & AGENT CONTINUITY

Define:

- project identity;
- repository;
- authority map;
- document map;
- branch strategy;
- environments;
- agent rules;
- handoff rules;
- ADR policy;
- stack baseline;
- production-data policy;
- toolchain policy;
- Context7 policy;
- Graphify policy;
- E2E policy;
- design-reference policy;
- token-efficiency rules.

Planning Agent must also inspect and map existing documents rather than assume a blank repository.

Exit when a new agent can answer:

```text
What is authoritative?
What is the current project state?
What Task is active?
What can I safely change?
What must I not change?
What should I read next?
```

---

# 12. P1 — PRODUCT DEFINITION, SCOPE & ACCEPTANCE

Define:

- problem statement;
- product goals;
- non-goals;
- users;
- roles;
- primary journeys;
- in scope;
- out of scope;
- functional requirements;
- non-functional requirements;
- acceptance criteria;
- release boundaries;
- success criteria;
- default user-facing language and localization requirement;
- recurring-cost constraints.

Default global product assumptions unless overridden:

```text
UI DEFAULT: Indonesian
SECONDARY LOCALE: English
ADDITIONAL RECURRING PRODUCTION COST TARGET: 0
```

Avoid vague requirements.

Bad:

```text
Build a modern dashboard.
```

Preferred:

```text
The School Admin dashboard must show X, Y, Z,
allow actions A and B,
hide action C from role D,
and work on mobile and desktop.
```

---

# 13. P2 — DOMAIN MODEL & BUSINESS RULES

Define:

- domain glossary;
- entities;
- ownership;
- relationships;
- states;
- transitions;
- invariants;
- validation;
- lifecycle;
- retention;
- archive;
- deletion;
- anonymization;
- restore;
- audit requirements.

Every important entity must state whether it can be:

- created;
- edited;
- archived;
- restored;
- soft-deleted;
- hard-deleted;
- anonymized.

Execution Agents must not invent data-lifecycle rules.

---

# 14. P3 — CRITICAL WORKFLOWS, ROUTES & INTERACTIONS

P3 contains:

```text
BUSINESS WORKFLOWS
+
ROUTE CONTRACTS
+
INTERACTION CONTRACTS
```

## 14.1 Workflow contract

For each critical workflow define:

- actor;
- entry condition;
- preconditions;
- happy path;
- alternative paths;
- failure paths;
- authorization;
- state changes;
- audit events;
- retry/recovery;
- expected end state.

## 14.2 Route contract

Maintain a route/action matrix:

| ID | UI/Action | Method | Route | Handler | Permission | Expected Result |
|---|---|---|---|---|---|---|

No visible user-facing action may remain structurally orphaned.

## 14.3 Interaction contract

For important buttons, links, forms, menu items, tabs, pagination, filters, and CTAs:

```text
INTERACTION ID:
PAGE:
ELEMENT:
VISIBLE TO:
ACTION:
ROUTE / HANDLER:
SUCCESS RESULT:
VALIDATION RESULT:
ERROR RESULT:
BACK/CANCEL BEHAVIOR:
TEST REQUIRED:
```

Hard rule:

```text
VISIBLE + CLICKABLE + NOT IMPLEMENTED = FORBIDDEN
```

A visible interaction must be:

- working;
- intentionally disabled;
- intentionally hidden.

---

# 15. P4 — DATABASE & APPLICATION ARCHITECTURE

Default:

```text
Laravel Application
│
├─ MVC Web Layer
│  ├─ Routes
│  ├─ Controllers
│  └─ Inertia Responses
│
├─ Application Layer
│  ├─ Actions
│  ├─ Services
│  └─ Use-case orchestration
│
├─ Domain-oriented Modules
│  ├─ Domain rules
│  ├─ Models / value concepts
│  └─ Module policies
│
├─ Infrastructure
│  ├─ Persistence
│  ├─ External integrations
│  ├─ Queue/cache when justified
│  └─ Storage
│
└─ PostgreSQL
```

Rules:

- thin controllers;
- no business logic hidden in presentation components;
- no god services;
- explicit module boundaries;
- avoid unnecessary abstractions;
- prefer standard Laravel patterns when sufficient;
- use Actions/Services for clear use cases;
- record inter-module dependencies;
- use ADRs for major changes.

---


## 15.1 FUTURE-READY MODULARITY & REPLACEABLE INTEGRATION RULE

The codebase MUST be designed so that future capabilities can be added without requiring broad rewrites of unrelated modules.

The goal is **extension-ready modularity**, not speculative over-engineering.

Use this principle:

> Stable business rules stay inside the domain/application core. Volatile technologies, vendors, and external services stay behind explicit boundaries.

Typical boundaries that may need to remain replaceable include:

- payment gateways;
- email/SMS/WhatsApp providers;
- object/file storage;
- search engines;
- maps/geocoding;
- AI providers;
- accounting integrations;
- shipping/logistics providers;
- identity/SSO providers;
- e-signature providers;
- analytics;
- external marketplaces;
- external APIs/webhooks.

### 15.1.1 Do not hardcode external vendors into core business logic

Bad:

```text
OrderService
→ directly calls VendorXPaymentSDK everywhere
→ stores VendorX-specific concepts in core domain
→ UI/business logic depends on VendorX response format
```

Preferred:

```text
Core Business Flow
↓
Application Contract / Port
↓
Integration Adapter
├─ ManualPaymentAdapter
├─ FutureGatewayAAdapter
└─ FutureGatewayBAdapter
```

Provider-specific SDKs, request formats, credentials, callbacks, and failure mapping should remain inside the integration boundary.

### 15.1.2 Example — payment gateway not needed yet

If the current project only needs manual payment:

```text
Payment Domain
↓
Payment Application Contract
↓
Manual Payment Implementation
```

Do NOT integrate a paid gateway merely for future possibility.

However, if payment is a real domain capability and future third-party processing is reasonably foreseeable, the code should avoid assumptions that make a later provider require rewriting the entire payment domain.

Future evolution should ideally become:

```text
Payment Application Contract
├─ ManualPaymentAdapter
├─ Midtrans/Xendit/Other Adapter
└─ Test/Fake Adapter
```

The exact provider should remain replaceable where practical.

### 15.1.3 Separate stable and volatile code

Prefer:

```text
STABLE
- domain rules
- entities/value concepts
- use-case orchestration
- authorization rules
- validation that belongs to the business

VOLATILE
- vendor SDKs
- external API schemas
- webhook payloads
- transport details
- credentials/config
- provider-specific retry rules
```

Volatile code must not leak unnecessarily into stable modules.

### 15.1.4 Configuration over scattered code edits

Where provider selection or behavior may vary, prefer:

- configuration;
- environment variables;
- provider registry;
- dependency injection;
- feature flags when justified;

instead of scattering vendor-specific `if/else` branches throughout the application.

### 15.1.5 Provider-neutral data model where practical

Core tables and domain concepts should use provider-neutral terminology when the business concept itself is provider-neutral.

Provider-specific identifiers/metadata should be isolated in:

- integration tables;
- provider metadata fields;
- adapter-specific storage;
- dedicated integration records;

rather than contaminating unrelated core entities.

### 15.1.6 Contract-first external integrations

For important external integrations define:

```text
INTEGRATION CONTRACT
- capability
- inputs
- outputs
- errors
- retries
- idempotency
- timeout behavior
- observability
- security
- fallback behavior
```

The internal application depends on this contract, not directly on a vendor SDK.

### 15.1.7 Testability

Replaceable integration boundaries should support:

- fake/stub implementations;
- integration tests;
- failure simulation;
- timeout simulation;
- retry/idempotency verification;

without requiring real paid external services during normal development/testing.

### 15.1.8 Avoid speculative abstraction

Do NOT create interfaces, layers, factories, or plugin systems everywhere "just in case".

Create an extension boundary when at least one applies:

- an external vendor/service is involved;
- technology is likely to change independently of business rules;
- multiple implementations are plausible;
- the project roadmap explicitly anticipates future integration;
- test isolation materially benefits from a boundary;
- security/data residency requires swappable infrastructure.

For stable internal logic with no meaningful variability, prefer the simplest clear implementation.

### 15.1.9 Modularity quality questions

Before completing architecture-sensitive work, ask:

```text
Can this module change without rewriting unrelated modules?
Can an external provider be replaced without rewriting core business rules?
Are vendor SDKs isolated?
Are provider-specific fields isolated?
Can the boundary be tested with a fake implementation?
Is the abstraction justified by real variability?
```

For relevant Tasks:

```text
MODULARITY: PASS / FAIL
INTEGRATION BOUNDARY: PASS / N/A
PROVIDER LOCK-IN RISK: NONE / ACCEPTED / DESCRIBE
FUTURE EXTENSION IMPACT: LOW / MEDIUM / HIGH
```


# 16. P5 — SECURITY, AUTHENTICATION & AUTHORIZATION

Define:

- authentication;
- sessions;
- roles;
- permissions;
- object-level authorization;
- tenant isolation if relevant;
- secrets;
- sensitive data;
- audit logs;
- threat model;
- rate limits;
- security tests.

Frontend visibility and backend authorization MUST agree.

Example:

```text
User lacks delete permission
↓
Delete action hidden/disabled according to UX contract
↓
Direct route access still denied by backend
```

---

# 17. P6 — CONCURRENCY, IDEMPOTENCY, API & PERFORMANCE

Define:

- request/API contracts;
- validation;
- errors;
- transaction boundaries;
- race conditions;
- idempotency;
- webhook deduplication;
- retries;
- timeouts;
- queue strategy;
- cache strategy;
- rate limits;
- performance budgets;
- load expectations.

Use Valkey/Redis only when justified.

---

# 18. P7 — UX, INFORMATION ARCHITECTURE, DESIGN SYSTEM, NAVIGATION & LOCALIZATION

P7 must prevent design drift across agents and convert business, security and concurrency behavior into explicit user experience.

P7 should produce, as relevant:

- Information Architecture;
- Page Inventory;
- Role-based Navigation;
- Interaction Inventory;
- Route ↔ UI mapping;
- Navigation Contracts;
- Back Action Contracts;
- Design System;
- shadcn component rules;
- mobile-first rules;
- responsive/adaptive rules;
- ID/EN localization architecture;
- plain Indonesian copy rules;
- loading/empty/error states;
- authorization-visible UI rules;
- stale/conflict/retry/duplicate UI;
- search/filter/pagination behavior;
- desktop productivity patterns;
- mobile interaction patterns;
- design references.

## 18.1 Design quality target

UI must be:

- modern;
- clean;
- professional;
- visually calm;
- purposeful;
- consistent;
- accessible;
- mobile-first;
- responsive;
- adaptive.

"Modern" does NOT mean:

- excessive gradients;
- glass effects everywhere;
- unnecessary cards;
- excessive animations;
- too many colors;
- redundant buttons;
- oversized controls without purpose.

## 18.2 Visual Breathing Room & Comfortable Density

The interface MUST provide enough visual breathing room to remain comfortable during long use.

Whitespace is a functional design tool, not wasted space.

Required principles:

- clear separation between sections;
- consistent vertical rhythm;
- adequate padding inside cards, forms, dialogs, tables, and panels;
- avoid wall-to-wall content unless the workflow genuinely benefits from dense data presentation;
- avoid stacking too many controls in one visual cluster;
- preserve readable line length for text-heavy content;
- use progressive disclosure for secondary details;
- keep primary actions visually obvious without filling the screen with buttons;
- use spacing tokens consistently rather than arbitrary per-screen values;
- on mobile, avoid cramped forms and tightly packed touch targets;
- on desktop, use available space intelligently without stretching every content block to full viewport width.

Goal:

```text
NOT TOO DENSE
NOT ARTIFICIALLY EMPTY
CLEAR HIERARCHY
COMFORTABLE TO SCAN
COMFORTABLE FOR LONG USE
```

Data-heavy screens may use a denser mode where justified, but density must be intentional and must not become the default visual language for the entire application.

Quality gate:

```text
VISUAL BREATHING ROOM: PASS / FAIL
CONTENT DENSITY APPROPRIATE: PASS / FAIL
AUTH SCREEN SIMPLICITY: PASS / N/A
GOOGLE LOGIN VISUAL CONSISTENCY: PASS / N/A
SECTION SEPARATION: PASS / FAIL
SPACING CONSISTENCY: PASS / FAIL
READABILITY: PASS / FAIL
```

## 18.3 Action hierarchy

```text
PRIMARY
→ one dominant action for current context

SECONDARY
→ supporting action

DESTRUCTIVE
→ clearly separated visually and behaviorally
```

Rule:

> No unnecessary duplicate buttons. Contextually useful duplication is allowed only when it materially improves usability.

## 18.4 Back action

Every child/detail/create/edit flow must have a clear return path.

Prefer deterministic contextual back actions:

```text
← Back to Student List
← Back to Student Detail
```

Do not rely only on browser history when it may return to an unrelated origin.

## 18.5 Navigation contract

For relevant pages:

```text
PAGE:
PARENT:
ENTRY:
BACK ACTION:
CANCEL ACTION:
SUCCESS DESTINATION:
ERROR BEHAVIOR:
STATE PRESERVATION:
MOBILE BEHAVIOR:
```

## 18.6 Preserve navigation state

When reasonable, preserve:

- search;
- filters;
- sort;
- pagination;
- selected tab;
- relevant local context.

## 18.7 Standard page patterns

### List

```text
Title                          Primary Action
Description

Search / Filter

Content
```

### Detail

```text
Contextual Back

Title                          Primary Action
Description

Content
```

### Create/Edit

```text
Contextual Back

Title

Form

Cancel / Secondary            Primary Save
```

## 18.8 Minor actions

Prefer overflow for lower-priority actions:

```text
[View] [Edit] [⋮]
```

instead of exposing many equal-weight buttons.

## 18.9 Required states

Design and test as applicable:

- loading;
- empty;
- success;
- validation error;
- permission denied;
- system error;
- network/offline state.

## 18.10 UI inventory

Maintain:

```text
PAGE INVENTORY
+
INTERACTION INVENTORY
+
NAVIGATION CONTRACTS
```

## 18.11 Localization contract

For user-facing pages define:

```text
DEFAULT LOCALE: id-ID
SUPPORTED LOCALES: id-ID, en
PLAIN-LANGUAGE INDONESIAN: REQUIRED
LANGUAGE SWITCH: REQUIRED
HARDCODED LOCALIZABLE COPY: FORBIDDEN
```

Verify that longer/shorter translated strings do not break responsive layouts.

## 18.12 Design reference record

Record:

- reference source;
- relevant screens;
- extracted principles;
- intentionally not copied patterns;
- shadcn mapping;
- tokens;
- responsive rules.

---

# 19. P8 — TESTING, QUALITY & DEFINITION OF DONE

Testing is inside each Task.

Applicable layers:

- lint;
- typecheck;
- unit;
- feature;
- integration;
- authorization;
- route integrity;
- interaction;
- E2E/browser;
- localization/language-switch tests;
- responsive;
- accessibility critical checks;
- production build;
- security;
- performance;
- migration tests.

Allowed Task statuses:

```text
TODO
READY
IN_PROGRESS
BLOCKED
VERIFYING
DONE
SUPERSEDED
```

`VERIFYING` is NOT `DONE`.

---

# 20. P9 — INFRASTRUCTURE, OBSERVABILITY, BACKUP & RECOVERY

Default topology:

```text
User
↓
Domain / Cloudflare
↓
Hostinger VPS
↓
Nginx / Coolify-managed routing
↓
Laravel + Inertia/React
↓
PostgreSQL
└─ Valkey/Redis if required
```

Define:

- containers;
- Nginx;
- environment variables;
- secrets;
- staging;
- production;
- logs;
- metrics;
- uptime;
- error tracking;
- security monitoring;
- backup;
- offsite backup;
- restore;
- restore testing;
- incident visibility;
- recurring-cost inventory;
- paid-service exception registry if any.

Infrastructure design should prefer existing VPS capability and free/open-source components when they safely satisfy the requirement.

---

# 21. P10 — RELEASE, MIGRATION, CUTOVER, ROLLBACK & UAT

Every release declares:

```text
DB CHANGE:
NONE / APPROVED CONTROLLED MIGRATION

ADDITIONAL RECURRING COST CHANGE:
NONE / APPROVED EXCEPTION
```

Release requires:

- required Tasks DONE;
- CI passes;
- staging;
- critical E2E;
- localization verification;
- regression;
- UAT when required;
- release approval;
- rollback target;
- backup readiness when relevant;
- health check;
- smoke test;
- monitoring.

---

# 22. P11 — TASK PLANNING, DEPENDENCIES & EXECUTION SPECS

P11 is the execution backbone.

## 22.1 Clear Task baseline

Before implementation begins, Planning Agent MUST publish:

```text
TASK BASELINE

Baseline Total Tasks: XX
Current Total Tasks: XX

DONE: 0
READY: X
IN_PROGRESS: 0
BLOCKED: X
VERIFYING: 0
TODO: X
SUPERSEDED: 0
```

The total may not remain undefined once P11 is approved.

## 22.2 Master checklist

`TASK_PLAN.md` MUST include a visible checkbox list:

```markdown
- [x] TASK-001 — Project Foundation
- [x] TASK-002 — Authentication Foundation
- [ ] TASK-003 — User Identity
- [ ] TASK-004 — Roles & Permissions
```

A Task can be checked `[x]` ONLY when:

```text
STATUS = DONE
AND
ALL REQUIRED TESTS = PASS
AND
COMPLETION EVIDENCE EXISTS
```

## 22.3 Automatic progress update

When a Task reaches DONE, Execution Agent MUST automatically:

```text
TASK-XXX.md
STATUS → DONE

TASK_PLAN.md
[ ] → [x]

Progress counters
→ updated

CURRENT_HANDOFF.md
→ updated
```

The owner should be able to open `TASK_PLAN.md` and immediately see what has been completed.

## 22.4 Stable Task IDs

Task IDs are permanent references.

Do not silently renumber completed or existing Tasks.

If a Task is split:

```text
TASK-018
STATUS: SUPERSEDED

REPLACED BY:
TASK-043
TASK-044
TASK-045
```

Keep history.

## 22.5 Baseline vs Current Total

Keep both:

```text
Baseline Total Tasks: 42
Current Total Tasks: 47
```

This makes scope growth visible.

## 22.6 Controlled Task-plan changes

If adding/splitting/merging:

```text
TASK PLAN CHANGE

Reason:
Affected Task(s):
New Task(s):
Baseline Total:
Previous Current Total:
New Current Total:
Dependencies Updated: YES
Scope Change: YES / NO
Owner Approval Required: YES / NO
```

## 22.7 Dependency graph

Every Task declares:

```text
DEPENDS ON:
BLOCKS:
PARALLEL SAFE: YES / NO
```

## 22.8 READY gate

Task becomes `READY` only if:

- dependencies are DONE;
- requirement is clear;
- scope is bounded;
- acceptance criteria exist;
- tests are defined;
- DB impact is known;
- route/interaction impact is known if relevant;
- UI/navigation/localization requirements are known if relevant;
- cost impact is known;
- required tools/capabilities are available or safely auto-installable;
- no blocking ambiguity remains.

## 22.9 One Task at a time

Default executor behavior:

```text
One Execution Agent
→ one active Task
```

Multiple Tasks may run in parallel only if explicitly `PARALLEL SAFE: YES`.

---


## 22.10 Task sizing rule

A Task should represent **one coherent outcome that can be implemented and verified end-to-end**.

Too large:

```text
TASK-020 — Build Entire Inventory Module
```

Too small:

```text
TASK-020 — Add One Button
```

Preferred:

```text
TASK-020 — Inventory Foundation
TASK-021 — Stock Receipt
TASK-022 — Stock Reservation
TASK-023 — Stock Issue
TASK-024 — Stock Correction
```

Avoid both context overload and excessive micro-task administration.

## 22.11 Standard vs High-Risk Tasks

Use `RISK CLASS: STANDARD` for normal bounded work.

Use `RISK CLASS: HIGH` for changes involving, for example:

- authentication;
- authorization;
- money;
- inventory truth;
- schema evolution;
- tenant/company isolation;
- critical concurrency;
- security;
- production infrastructure;
- major architecture changes.

High-risk Tasks require broader impact analysis and verification.

---

# 23. REQUIRED TASK CONTRACT TEMPLATE

Every Task must be understandable by a new Execution Agent without hidden chat context.

```text
# TASK-XXX — TITLE

STATUS:
TODO / READY / IN_PROGRESS / BLOCKED / VERIFYING / DONE / SUPERSEDED

RISK CLASS:
STANDARD / HIGH

OBJECTIVE:
...

WHY THIS EXISTS:
...

DEPENDS ON:
- TASK-...

BLOCKS:
- TASK-...

PARALLEL SAFE:
YES / NO

IN SCOPE:
- ...

OUT OF SCOPE:
- ...

REFERENCES:
- exact project docs / sections
- ADRs
- design references
- related implementation
- related tests

EXPECTED MODULES / FILE AREAS:
- ...

BUSINESS RULES:
- BR-...

ARCHITECTURE RULES:
- ...

SECURITY / PERMISSION REQUIREMENTS:
- ...

DATABASE IMPACT ASSESSMENT:
- Schema change: NONE / PROPOSED
- Migration required: NO / YES
- Existing data transformation: NONE / PROPOSED
- Direct production DB access: FORBIDDEN
- Data-loss risk: NONE KNOWN / DESCRIBE

MODULARITY / EXTENSIBILITY:
- Module boundary affected:
- Stable core kept provider-neutral: YES / NO / N/A
- External/vendor-specific code isolated: YES / NO / N/A
- Replaceable adapter/contract required: YES / NO
- Provider lock-in risk: NONE / ACCEPTED / DESCRIBE
- Future extension impact: LOW / MEDIUM / HIGH
- Speculative abstraction avoided: YES / NO

AUTH IMPACT:
- Authentication change: NONE / PROPOSED
- Authentication implementation: BETTER_AUTH / LARAVEL_NATIVE / EXISTING / N/A
- Auth profile: AICWDF-COMPAT-8 / EXTERNAL_COMPLIANCE / N/A
- Google sign-in: ON / OFF / N/A
- Google registration behavior: OPEN / INVITE_ONLY / EXISTING_ACCOUNT_ONLY / N/A
- Google credentials owner action required: YES / NO
- Authorization change: NONE / PROPOSED
- Provider/library-specific leakage into domain: NO / DESCRIBE

COST IMPACT:
- New recurring cost: NONE / PROPOSED
- Paid third-party service: NO / YES
- Free/open-source alternative: YES / NO / N/A
- Estimated additional monthly production cost: 0 / ...
- Owner approval required: NO / YES

MCP SESSION PROFILE:
- Required MCP servers:
- MCP servers that should remain OFF:
- Native CLI/package preferred over MCP:
- Post-Task deactivation/cleanup:

TOOL REQUIREMENTS:
- Context7: REQUIRED / OPTIONAL / N/A
- Graphify: REQUIRED / OPTIONAL / N/A
- Browser E2E: REQUIRED / OPTIONAL / N/A
- Other:
- Missing safe tool behavior: AUTO-INSTALL / AUTO-CONFIGURE

GRAPHIFY / IMPACT ANALYSIS:
- Graph freshness:
- Pre-change questions:
- Expected affected areas:

CONTEXT7:
- Topics to verify:
- Version-sensitive assumptions:

UI / UX REQUIREMENTS:
- Follow global design rules: YES
- Indonesian default: YES / N/A
- English support: YES / N/A
- Plain-language Indonesian: YES / N/A
- Language switch impact: NONE / DESCRIBE
- Mobile-first: YES / N/A
- Responsive: YES / N/A
- Adaptive: YES / N/A
- Visual breathing room: REQUIRED / N/A
- Comfortable density: REQUIRED / N/A
- shadcn/ui reuse:
- Design reference:
- Primary action:
- Secondary actions:
- Destructive actions:
- Redundancy constraints:
- Loading state:
- Empty state:
- Error state:

ROUTE IMPACT:
- ...

INTERACTION CONTRACTS:
- INT-...

NAVIGATION CONTRACT:
- Parent:
- Entry:
- Back action:
- Cancel:
- Success destination:
- Error behavior:
- State preservation:
- Mobile behavior:

ACCEPTANCE CRITERIA:
- AC-01 ...
- AC-02 ...

TEST REQUIREMENTS:
- Lint:
- Typecheck:
- Unit:
- Feature:
- Integration:
- Authorization:
- Route integrity:
- Interaction:
- Browser E2E:
- Localization/language switch:
- Visual breathing room/density:
- Responsive:
- Accessibility:
- Production build:
- Security:
- Performance:
- Migration:
- Other:

TEST CHECKLIST:
- [ ] Lint
- [ ] Typecheck
- [ ] Relevant automated tests
- [ ] Authorization
- [ ] Route integrity
- [ ] Interaction behavior
- [ ] Browser E2E if required
- [ ] Responsive/adaptive if required
- [ ] Visual breathing room/density if UI
- [ ] Production build
- [ ] Security checks if required
- [ ] Database safety review
- [ ] Final diff review

COMPLETION EVIDENCE:
- Test outputs:
- Build result:
- Route evidence:
- Interaction evidence:
- Browser evidence:
- Localization evidence:
- Cost evidence/exception if applicable:
- Files changed:
- Commit SHA:
- Notes:

SAFE NEXT TASK:
- ...

DO NOT DO:
- ...
```

---

# 24. TASK EXECUTION FLOW

```text
Select READY Task
↓
Read AGENTS.md
↓
Read EXECUTION_CONTEXT.md
↓
Read CURRENT_HANDOFF.md
↓
Read TASK_PLAN.md
↓
Read active TASK-XXX.md
↓
Read only exact referenced docs
↓
Check required capabilities/tools
↓
Missing tool?
├─ YES → safely auto-install/configure/verify
└─ NO
↓
Graph freshness check
↓
Graphify impact analysis if required
↓
Targeted source inspection
↓
Context7 if required
↓
Implement smallest safe diff
↓
Lint
↓
Typecheck
↓
Unit / Feature / Integration
↓
Authorization
↓
Route integrity
↓
Interaction testing
↓
Browser E2E
↓
Localization / language-switch verification if UI
↓
Responsive / Adaptive
↓
Cost-impact verification
↓
Production build
↓
Security
↓
Database safety
↓
Graphify post-change check if required
↓
Final diff review
↓
Record evidence
↓
All required checks PASS?
├─ NO → VERIFYING / BLOCKED
└─ YES
    ↓
TASK = DONE
    ↓
Auto-check [x] in TASK_PLAN.md
    ↓
Update counters
    ↓
Update CURRENT_HANDOFF.md
```

---

# 25. ROUTE & INTERACTION INTEGRITY — ZERO DEAD INTERACTIONS

Release blockers include:

- visible button does nothing;
- broken link;
- missing route;
- wrong HTTP method;
- wrong handler;
- unexpected 404;
- unexpected 405;
- unexpected 500;
- authorization mismatch;
- visible action but unusable backend path;
- form submit without feedback;
- wrong success redirect;
- missing/unclear back or cancel;
- critical browser console errors;
- critical failed network requests.

Target:

```text
ORPHAN UI ACTIONS: 0
BROKEN ROUTES: 0
DEAD BUTTONS: 0
UNHANDLED CRITICAL ACTIONS: 0
UNEXPECTED 404: 0
UNEXPECTED 405: 0
UNEXPECTED 500: 0
CRITICAL CONSOLE ERRORS: 0
CRITICAL FAILED NETWORK REQUESTS: 0
```

---

# 26. BROWSER E2E REQUIREMENT

For critical UI journeys, use browser automation.

Example:

```text
Login
↓
Open Student List
↓
Create Student
↓
Verify success feedback
↓
Open Student Detail
↓
Edit
↓
Verify update
↓
Use contextual Back
↓
Verify list state preserved
```

Do not accept:

```text
"Should work."
```

Require:

```text
E2E: PASS
Evidence: ...
```

---

# 27. UI/UX CONSISTENCY GATE

For every UI Task:

```text
MODERN VISUAL QUALITY: PASS / FAIL
DESIGN SYSTEM CONSISTENCY: PASS / FAIL
PRIMARY ACTION CLEAR: PASS / FAIL
UNNECESSARY DUPLICATE ACTIONS: 0
BACK ACTION CLEAR: PASS / FAIL
NAVIGATION CONTRACT VALID: PASS / FAIL
INDONESIAN DEFAULT: PASS / FAIL
PLAIN INDONESIAN: PASS / FAIL
ENGLISH AVAILABLE: PASS / FAIL
MISSING TRANSLATIONS: 0
LANGUAGE SWITCH: PASS / FAIL
MOBILE-FIRST: PASS / FAIL
RESPONSIVE: PASS / FAIL
ADAPTIVE: PASS / FAIL
LOADING STATE: PASS / N/A
EMPTY STATE: PASS / N/A
ERROR STATE: PASS / N/A
DESTRUCTIVE ACTION SAFETY: PASS / N/A
ACCESSIBILITY CRITICAL CHECKS: PASS / FAIL
VISUAL BREATHING ROOM: PASS / FAIL
CONTENT DENSITY APPROPRIATE: PASS / FAIL
```

---

# 28. TESTING STRATEGY: FAST WITHOUT LOWERING QUALITY

Use three layers.

## Layer 1 — Task Verification

Run targeted tests relevant to the active Task plus mandatory static/build gates.

## Layer 2 — Critical Journey Regression

Run after a meaningful group of completed Tasks or before staging.

Examples:

- login/logout;
- create/edit/delete;
- search/filter;
- approval;
- permissions;
- payments if applicable;
- examinations if applicable;
- reporting.

## Layer 3 — Full Release Regression

Before production:

- all critical journeys;
- major roles;
- major routes;
- core forms;
- mobile;
- desktop;
- critical integrations;
- security;
- release-critical performance checks.

---

# 29. PRODUCTION DATABASE ZERO-TOUCH

## 29.1 Non-negotiable default

Ordinary AI coding agents MUST NOT directly access or mutate production DB.

Forbidden:

- direct production DB connection;
- manual SQL;
- ORM commands against production;
- reset;
- wipe;
- truncate;
- reseed;
- destructive migration;
- direct restore;
- drop database/schema/table;
- delete production DB volumes;
- change production DB credentials or ownership ad hoc.

Generic requests such as:

```text
Fix production.
Make it work.
Do whatever is needed.
```

do NOT authorize production-data access.

## 29.2 Normal maintenance default

```text
DB CHANGE: NONE
DIRECT PRODUCTION DB ACCESS: FORBIDDEN
```

## 29.3 Legitimate schema evolution

AI may:

- design migration;
- create migration file;
- test migration outside production;
- document risk;
- prepare rollback/recovery.

AI coding agent MUST NOT directly execute the migration against live production data.

Use:

```text
Explicit Need
↓
Migration Design
↓
Staging Rehearsal
↓
Backup Verification
↓
Approval
↓
Controlled Executor
↓
Verification
```

---

# 30. FORBIDDEN PRODUCTION DATA ACTIONS

Examples:

```bash
php artisan migrate:fresh
php artisan db:wipe
prisma migrate reset
prisma db push --force-reset
docker compose down -v
docker volume prune
```

Also forbidden:

- drop/recreate production DB;
- delete production storage;
- ad-hoc restore over live DB;
- bulk-delete records as a quick fix;
- manually edit production data to hide application bugs.

---

# 31. LONG-TERM MAINTENANCE RULE

Assume years of real data.

Every maintenance Task must:

- preserve old data;
- preserve semantics;
- avoid destructive shortcuts;
- preserve backward compatibility where practical;
- reproduce issues in local/staging;
- use synthetic/anonymized data where needed;
- use controlled remediation for historical anomalies;
- preserve traceability;
- treat old records as valuable.

---

# 32. BRANCH & ENVIRONMENT MODEL

Default:

```text
feature/* or hotfix/*
↓
PR
↓
CI
↓
develop
↓
STAGING
↓
Verification / UAT
↓
PR develop → main
↓
Required CI / approval
↓
main
↓
Coolify
↓
PRODUCTION
```

Protect `main`.

---

# 33. RECOMMENDED DOCUMENTATION STRUCTURE

Existing clear structures may be retained. Approved mature repositories should not be cosmetically reorganized merely to match this layout.

Recommended for large projects:

```text
/
├── AGENTS.md
├── README.md
├── docs/
│   ├── 00-governance/
│   │   ├── PROJECT_RULES.md
│   │   ├── SOURCE_OF_TRUTH.md
│   │   ├── TOOLCHAIN.md
│   │   ├── COST_POLICY.md
│   │   └── PRODUCTION_DATA_SAFETY.md
│   ├── 01-product/
│   │   └── PRODUCT_BLUEPRINT.md
│   ├── 02-domain/
│   │   └── DOMAIN_MODEL.md
│   ├── 03-workflows/
│   │   ├── CRITICAL_FLOWS.md
│   │   ├── ROUTE_CONTRACTS.md
│   │   └── INTERACTION_CONTRACTS.md
│   ├── 04-architecture/
│   │   ├── ARCHITECTURE.md
│   │   └── STACK_AND_MODULES.md
│   ├── 05-security/
│   │   └── SECURITY_MODEL.md
│   ├── 06-api-performance/
│   │   └── TECHNICAL_RULES.md
│   ├── 07-ux-design/
│   │   ├── DESIGN_SYSTEM.md
│   │   ├── NAVIGATION_CONTRACTS.md
│   │   ├── LOCALIZATION.md
│   │   └── DESIGN_REFERENCES.md
│   ├── 08-testing/
│   │   └── TEST_STRATEGY.md
│   ├── 09-operations/
│   │   ├── INFRASTRUCTURE.md
│   │   └── BACKUP_RESTORE.md
│   ├── 10-release/
│   │   ├── RELEASE_RUNBOOK.md
│   │   └── ROLLBACK_RUNBOOK.md
│   ├── 11-tasks/
│   │   ├── EXECUTION_CONTEXT.md
│   │   ├── TASK_PLAN.md
│   │   ├── TASK-001.md
│   │   ├── TASK-002.md
│   │   └── ...
│   ├── adr/
│   └── handoff/
│       └── CURRENT_HANDOFF.md
```

---

# 34. AGENTS.md MINIMUM CONTRACT

Recommended minimum:

```text
1. Repository is the Source of Truth.
2. Preserve approved historical decisions and approval chains.
3. Inspect existing docs before creating replacements.
4. Reuse valid existing project decisions.
5. Read EXECUTION_CONTEXT, CURRENT_HANDOFF, TASK_PLAN and active Task before coding.
5. Work only on READY Tasks by default.
6. Use Context7 for version-sensitive current documentation.
7. Use Graphify/targeted analysis for significant impact analysis.
8. Auto-install/configure missing safe development tools when genuinely needed.
9. Reuse an equivalent existing tool rather than replacing it unnecessarily.
10. Use shadcn/ui before creating new primitives.
11. Follow the active design system/reference.
12. Mobile-first, responsive, adaptive.
13. No dead buttons, routes, forms, links, or interactions.
14. Clear contextual back action is required for child flows.
15. No redundant actions without UX justification.
16. Direct production DB access is forbidden to ordinary coding agents.
17. A Task is DONE only after required tests pass.
18. When DONE, automatically check the Task in TASK_PLAN.md.
19. Update progress counters and CURRENT_HANDOFF before stopping.
20. User-facing UI defaults to plain Indonesian and English must remain available.
21. Additional recurring production cost target is 0 outside client-funded domain/VPS.
22. Paid dependencies require explicit owner approval.
23. Reuse the recorded authentication profile; do not redesign auth per Task.
24. Google sign-in is the default convenience login when suitable, but does not imply open registration.
25. AICWDF-COMPAT-8 is the default owner-selected password profile unless an external binding requirement requires another profile.
26. Do not silently change stack, architecture, scope, schema, or design direction.
```

Tool-specific agent files should point back to repository rules instead of duplicating this entire framework.

---


# 34A. EXECUTION_CONTEXT.md

Purpose: give coding agents the minimum stable context required to execute Tasks without rereading the entire planning history.

Recommended content:

```text
PROJECT:
CURRENT RELEASE:
CURRENT PHASE:

DEFAULT STACK:
...

AUTH PROFILE:
- implementation: BETTER_AUTH / LARAVEL_NATIVE / OTHER
- password profile: AICWDF-COMPAT-8 / EXTERNAL_COMPLIANCE
- Google sign-in: ON / OFF
- Google registration behavior: OPEN / INVITE_ONLY / EXISTING_ACCOUNT_ONLY

GLOBAL UI RULES:
- Indonesian default
- English supported
- plain-language user copy
- mobile-first
- responsive/adaptive
- no redundant actions
- clear contextual back actions

GLOBAL COST RULE:
- additional recurring production cost target = 0
- paid service requires approval

GLOBAL SAFETY:
- production DB zero-touch

TOOLCHAIN:
...

EXECUTION ENTRY:
- read active Task
- read exact references only

DO NOT REOPEN:
- approved historical decisions unless a real conflict is detected
```

If an existing approved `AGENTS.md` is long because it contains governance history, prefer adding this lightweight file rather than rewriting approved governance merely to shorten it.

---

# 35. TASK_PLAN.md FORMAT

`TASK_PLAN.md` is the owner's primary progress dashboard.

It MUST show:

```text
PROJECT TASK STATUS

Baseline Total Tasks:
Current Total Tasks:

DONE:
READY:
IN_PROGRESS:
BLOCKED:
VERIFYING:
TODO:
SUPERSEDED:

Progress:
DONE / CURRENT TOTAL
Percentage:
...
```

Recommended checklist:

```markdown
## Master Task Checklist

- [x] TASK-001 — Project Foundation
- [x] TASK-002 — Authentication Foundation
- [ ] TASK-003 — User Identity
- [ ] TASK-004 — Roles & Permissions
- [ ] TASK-005 — Main Navigation
```

Recommended table:

| Task | Title | Status | Depends On | Parallel Safe | DB Impact | UI Impact |
|---|---|---|---|---|---|---|

Also include:

```text
CURRENT TASK:
NEXT READY TASK:
LAST TASK PLAN CHANGE:
ADDITIONAL RECURRING PRODUCTION COST:
PAID SERVICE EXCEPTIONS:
```

Totals MUST reconcile with the Task list.

---

# 36. CURRENT_HANDOFF.md FORMAT

Keep the handoff concise. Git already stores historical detail; the handoff should describe the current operational state.

```text
PROJECT:
CURRENT PHASE:
CURRENT TASK:
CURRENT TASK STATUS:

LAST COMPLETED ACTION:
EVIDENCE:

TASK PLAN
- Baseline total:
- Current total:
- Done:
- Ready:
- In progress:
- Blocked:
- Verifying:
- Todo:
- Superseded:
- Progress %:

OPEN BLOCKERS:
OPEN NON-BLOCKING GAPS:

DECISIONS MADE:
DECISIONS PENDING:

FILES CHANGED:

TOOLCHAIN
- tools checked:
- tools installed/configured:
- verification:
- remaining tool blocker:

GRAPHIFY
- freshness:
- pre-change findings:
- post-change findings:

CONTEXT7
- docs consulted:
- version-sensitive findings:

COST
- new recurring cost:
- paid exception:

UI / UX / LOCALIZATION
- design reference:
- Indonesian default:
- English support:
- mobile-first:
- responsive:
- adaptive:
- back action:
- redundant actions:
- route integrity:
- interaction integrity:

DATABASE
- direct production DB touched: NO
- schema change:
- migration:

TESTS
- lint:
- typecheck:
- unit:
- feature:
- integration:
- authorization:
- route:
- interaction:
- E2E:
- responsive:
- build:
- security:

SAFE NEXT ACTION:
NEXT READY TASK:
DO NOT DO:
```

---

# 37. FIRST RESPONSE REQUIRED FROM A PLANNING AGENT

```text
ROLE: PLANNING AGENT

PROJECT STATE:
NEW / PARTIALLY_PLANNED / PARTIALLY_IMPLEMENTED / PRODUCTION / LEGACY

REPOSITORY SOURCE OF TRUTH:
FOUND / NOT FOUND / NEEDS CLARIFICATION

EXISTING DOCUMENTATION:
- ...

DOCUMENT ADOPTION PLAN:
- reuse:
- adapt:
- merge:
- supersede:
- create:

EXISTING TOOLCHAIN:
- ...

LANGUAGE POLICY:
- Indonesian default:
- English support:

COST POLICY:
- recurring target:
- exceptions:

MISSING CAPABILITIES:
- ...

AUTO-BOOTSTRAP PLAN:
- ...

P0–P11 COVERAGE:
P0:
P1:
P2:
P3:
P4:
P5:
P6:
P7:
P8:
P9:
P10:
P11:

BLOCKERS:
RISKS:

TASK BASELINE:
NOT READY YET / READY

If ready:
- Baseline Total Tasks:
- Current Total Tasks:
- Ready Tasks:
- Blocked Tasks:

NEXT SAFE PLANNING ACTION:
...
```

Planning Agent MUST NOT invent a final Task count before planning is sufficiently complete.

---

# 38. FIRST RESPONSE REQUIRED FROM AN EXECUTION AGENT

```text
ROLE: EXECUTION AGENT

ACTIVE TASK:
TASK-...

TASK STATUS:
READY / NOT READY

DEPENDENCIES:
PASS / FAIL

REFERENCES LOADED:
- ...

TOOLCHAIN:
- required tools:
- available:
- missing:
- safe auto-install required:

GRAPHIFY:
Fresh: YES / NO / N/A
Pre-change analysis: ...

CONTEXT7:
Required: YES / NO
Topics: ...

RISK CLASS:
STANDARD / HIGH

DATABASE IMPACT:
NONE / PROPOSED / UNKNOWN
Direct production DB access: FORBIDDEN

COST IMPACT:
NONE / PROPOSED / UNKNOWN

ROUTE / INTERACTION IMPACT:
...

UI / NAVIGATION / LOCALIZATION IMPACT:
...

TEST PLAN:
...

SAFE TO IMPLEMENT:
YES / NO

IF NO:
BLOCKER:
...
```

---

# 39. RELEASE INTEGRITY REPORT

Before production:

```text
APPLICATION INTEGRITY REPORT

TASKS
Current Total: ...
Done: ...
Blocked: 0
Verifying: 0
Todo required for release: 0

ROUTES
Routes reviewed: ...
Broken routes: 0
Unexpected 404: 0
Unexpected 405: 0
Unexpected 500: 0

INTERACTIONS
Critical controls tested: ...
Dead controls: 0
Unclear controls: 0

CRITICAL JOURNEYS
Total: ...
Passed: ...
Failed: 0

UI/UX
Indonesian default: PASS
English: PASS
Missing translations: 0
Mobile critical flows: PASS
Desktop critical flows: PASS
Back/navigation integrity: PASS
Redundant critical actions: 0
Critical accessibility checks: PASS

BROWSER
Critical console errors: 0
Critical failed network requests: 0

TOOLCHAIN
Required capabilities available: PASS

COST
Additional recurring production cost: ...
Paid exceptions: ...
Approval status: ...

DATABASE
DB change: NONE / APPROVED CONTROLLED MIGRATION
Direct production DB mutation by coding agent: NO

BUILD
Production build: PASS

RELEASE STATUS:
PASS / FAIL
```

---

# 40. MAINTENANCE FLOW AFTER YEARS IN PRODUCTION

```text
Owner reports bug/change
↓
Agent reads repository + handoff
↓
Create/identify maintenance Task
↓
DB impact assessment (default NONE)
↓
Cost impact assessment (default NONE)
↓
Check required tools
↓
Auto-bootstrap safe missing tools
↓
Graphify/impact analysis
↓
Reproduce local/staging
↓
Create hotfix/feature branch
↓
Implement bounded fix
↓
Targeted tests
↓
Route/interaction tests if relevant
↓
E2E
↓
Build
↓
Staging
↓
Approval
↓
main
↓
Auto-deploy
↓
Health/smoke
↓
Monitor
↓
Mark maintenance Task DONE ✓
↓
Update docs/handoff
```

---

# 41. FRAMEWORK ADAPTATION RULE

The agent is explicitly allowed to adapt this framework to the active project.

Allowed:

- keep good existing docs and approved historical phase outputs;
- keep existing naming;
- combine docs;
- split oversized docs;
- add project-specific sections;
- skip irrelevant sections;
- convert existing roadmap items into Tasks;
- reuse existing tests;
- reuse an equivalent tool instead of installing the preferred named tool;
- use a stronger existing design system;
- use a more relevant visual reference;
- use equivalent current documentation if Context7 is unavailable and approved;
- use equivalent impact-analysis tooling if Graphify is unavailable;
- create project-specific Task fields if needed.

Not allowed without explicit approval:

- removing repository Source-of-Truth discipline;
- removing Task counts;
- removing automatic Task checklist updates;
- weakening Indonesian-first bilingual UI requirements;
- weakening near-zero recurring-cost controls;
- allowing vague/unbounded Tasks;
- marking Tasks DONE without tests;
- allowing dead interactions;
- weakening route integrity;
- weakening UI/navigation consistency;
- weakening production DB zero-touch;
- silently changing stack/architecture;
- silently replacing design direction;
- removing staging/release verification for production systems.

---

# 42. FINAL AGENT OPERATING CONTRACT

Every agent receiving this framework agrees:

1. Repository remains the durable Source of Truth.
2. Existing valid project documents are reused rather than discarded.
3. The framework adapts to actual project state.
4. Ambiguity is resolved before execution.
5. P11 produces a clear Task baseline and total count.
6. Every Task has scope, dependencies, acceptance criteria, tests, and evidence.
7. Only READY Tasks are implemented by default.
8. A Task is not DONE until required tests pass.
9. DONE automatically updates `[x]` in `TASK_PLAN.md`.
10. Progress counters are updated automatically.
11. Task IDs remain stable.
12. Task-plan changes are traceable.
13. Missing safe development tools are auto-installed/configured when genuinely required.
14. Equivalent existing tools are reused when they already satisfy the capability.
15. Context7 is used for version-sensitive current documentation.
16. Graphify or equivalent targeted analysis is used for significant impact analysis.
17. Browser E2E is required for critical UI journeys.
18. shadcn/ui is the default component source.
19. DesainPakaiAI or another approved relevant reference guides visual direction.
20. UI remains modern, clean, non-redundant, mobile-first, responsive, and adaptive.
21. Every important child flow has a clear deterministic back/navigation path.
22. No visible clickable interaction may remain unimplemented.
23. Route, permission, interaction, and navigation integrity are quality gates.
24. Direct production DB access is forbidden to ordinary coding agents.
25. Production data is never reset/reseeded/destroyed to solve normal bugs.
26. Major stack/architecture/design changes require documented approval.
27. Changes remain bounded and avoid scope creep.
28. Important project knowledge is stored in repository docs, not only chat.
29. Every meaningful stop leaves an updated handoff.
30. A new agent must be able to continue without hidden context.
31. Success must be supported by evidence, not assertion.
32. Approved historical phases are not reset without a real reason or owner request.
33. Planning may use broad context, but execution uses minimal targeted context.
34. User-facing UI defaults to simple Indonesian and English remains available.
35. Additional recurring production cost target is 0 outside client-funded domain/VPS.
36. Paid services require explicit approval.
37. Authentication implementation is decided once per project and reused by executors.
38. Better Auth is the default core auth for compatible TypeScript server stacks; Laravel-native auth is the default for Laravel/PHP.
39. Google sign-in is enabled by default when suitable and must not silently create unauthorized users.
40. AICWDF-COMPAT-8 is the Owner-selected default password profile unless a binding external requirement requires another profile.
41. The framework must not falsely describe AICWDF-COMPAT-8 as NIST-compliant.
42. Authentication and application authorization remain separate concerns.
37. Compatible TypeScript server stacks default to Better Auth core/basic unless project needs justify another approach.
38. Laravel/PHP projects must not add a separate TypeScript auth service merely to force Better Auth.
39. Authentication and application authorization remain separate concerns.
40. Heavy/specialized MCP servers default to on-demand session activation rather than always-on exposure.
41. Native CLI/package capability should be preferred over MCP when it satisfies the Task with lower context overhead.
42. UI must preserve visual breathing room and comfortable content density.

---

# 43. FINAL PRINCIPLE

> **Preserve what is already correct. Plan deeply only where needed. Execute one clear Task at a time.**

> **The Planning Agent may understand the whole system. The Execution Agent should understand only the exact slice required for the active Task.**

> **Planning may be complex. Tasks must not be ambiguous.**

> **Every Task must tell the executor what to build, what not to build, dependencies, required tools, expected behavior, expected UI, route/interaction behavior, navigation/back behavior, required tests, and completion evidence.**

> **When a Task is truly complete, it must become visibly complete in the repository checklist automatically.**

> **User-facing software defaults to simple Indonesian, remains bilingual with English, and avoids unnecessary recurring production cost.**

> **Authentication should feel simple to the user and simple to the executor: one recorded auth profile, email/password, Google sign-in when appropriate, and advanced auth features only when actually required.**

> **Installed tools do not need to be exposed to every session. Keep MCP capability task-scoped and context-efficient.**

> **Authentication should be simple by default: Better Auth core/basic for compatible TypeScript server stacks, Laravel-native for Laravel/PHP.**

> **Interfaces should have enough whitespace to breathe: clear hierarchy, comfortable density, and intentional spacing.**

> **AI agents may change software. Production data, architecture intent, product rules, task history, and design consistency are durable project state and must remain protected across agents, tools, and time.**
