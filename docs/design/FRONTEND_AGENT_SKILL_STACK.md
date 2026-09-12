**Status:** LOCKED
**Version:** 1.0.0
**Canonical:** YES
**Source:** Owner approval / DEC-038
**Depends On:** DEC-036, DEC-037, DEC-038, FRONTEND_DESIGN_SYSTEM.md, UI_CONTENT_AND_COPY_STYLE.md
**Used By:** All frontend Build Units, UI component development, mobile/desktop responsive hardening, and visual QA

# ELLIGBLE Frontend Agent Skill Stack

## 1. Purpose

This document defines the canonical agent skill stack supporting frontend engineering, visual design, responsive adaptation, and rendered quality verification across the ELLIGBLE product suite. It establishes the operational division of responsibility among purpose-fit skills, sets strict non-authority boundaries for external skills, and provides invocation and token discipline guidance for AI coding agents.

This stack is designed to elevate ELLIGBLE's user-facing surfaces to a premium, modern, elegant, calm, institution-grade, and responsive standard across all supported viewports without introducing generic AI-generated template appearance ("AI slop").

---

## 2. Canonical Authority Hierarchy

When designing, implementing, reviewing, or remediating frontend code, agents MUST adhere strictly to the following authority hierarchy:

1. **Repository Canonical Decisions & LOCKED Design Documents** (`FRONTEND_DESIGN_SYSTEM.md`, `UI_CONTENT_AND_COPY_STYLE.md`, `DECISION_LOG.md`, BU specs)
2. **Explicit Owner-Approved UX Direction** (Recorded Controller/Owner guidance, user review findings)
3. **`frontend-design` Supplemental Design/UX Guidance** (Design craft, hierarchy, composition, visual cohesion, accessibility)
4. **`frontend-responsive-ui` Responsive/Adaptive Guidance** (Mobile-first layout, fluid typography/spacing, breakpoint discipline, touch ergonomics)
5. **`react-typescript-vite` Implementation-Engineering Discipline** (Strict TypeScript typing, Vite bundling, component structure, DOM/ARIA interaction)
6. **`web-design-reviewer` Rendered/Browser Verification** (Rendered DOM inspection, defect identification, multi-viewport layout validation)
7. **Owner Actual Visual Review** (Final gate for user-facing visual changes when Controller explicitly requires it)

### Strict Non-Authority Rule for External Skills
External agent skills are **SUPPLEMENTAL ONLY**. They provide techniques, heuristics, patterns, and checklists, but hold ZERO governance authority over ELLIGBLE architecture or locked design decisions.

External skills may **NOT**:
- Replace or circumvent the [ELLIGBLE Frontend Design System](file:///c:/Projects/ELLIGBLE/docs/design/FRONTEND_DESIGN_SYSTEM.md).
- Alter canonical colors, typography, surfaces, elevations, or tokens without explicit Owner-approved supersession.
- Automatically introduce external CSS frameworks (Tailwind, Bootstrap, etc.) or component libraries (shadcn/ui, MUI, Chakra, etc.).
- Automatically introduce animation libraries (Framer Motion, GSAP, etc.) or utility packages.
- Override Secure Assessment distraction-control rules (e.g. no unnecessary decorative animations, badges, or clutter).
- Override canonical UI copy rules in [UI Content and Copy Style Guide](file:///c:/Projects/ELLIGBLE/docs/design/UI_CONTENT_AND_COPY_STYLE.md) (including the prohibition of the em dash "—" in user-facing copy).
- Override accessibility requirements (WCAG 2.1 AA) or scope/build gates.

### Conflict Rule
**REPOSITORY WINS.** In any conflict between an external skill's guidance and canonical repository documentation, canonical repository documentation is absolute and unchallengeable.

---

## 3. Installed Skill Stack Inventory

All canonical skills are installed in the Antigravity global skill root: `~/.gemini/config/skills/` (`C:\Users\Yusuf Setiawan\.gemini\config\skills\`).

| Role | Skill Directory / Name | Global Installed Path | Version / Provenance | Pinned Source Commit / Reference | SKILL.md SHA256 |
|---|---|---|---|---|---|
| **Engineering Foundation** | `react-typescript-vite` | `~/.gemini/config/skills/react-typescript-vite/` | v1.0.0 | Built-in / Antigravity Customization Ecosystem | `450285288FBA41F497991F074F100A43ED2D714E51818CAAE3294663E5CCD558` |
| **Supplemental Design & UX** | `frontend-design` | `~/.gemini/config/skills/frontend-design/` | v2.0 | `https://github.com/PracticalSwan/agent-skills` (path: `frontend-design/`) | `afbb609dec5b7bf08c8384a013b6b3b535517da2` | `77E13F66849F575579E2E1CB0E102265AA4D00A847DF6AF27053967BDE5E1F8D` |
| **Responsive Specialist** | `frontend-responsive-ui`<br>*(Frontmatter: Frontend Responsive Design Standards)* | `~/.gemini/config/skills/frontend-responsive-ui/` | SOURCE PIN | `https://github.com/am-will/codex-skills` (path: `skills/frontend-responsive-ui/`) | `198e289b6f8f891ca411d0f04cc625ea18e9e97a` | `D72A56FA99D64B54C9AF01037802006EBE9E1C711F4CFC75A2FB0F34A2904EC1` |
| **Rendered Visual QA** | `web-design-reviewer` | `~/.gemini/config/skills/web-design-reviewer/` | SOURCE PIN | `https://github.com/github/awesome-copilot` (path: `skills/web-design-reviewer/`) | `421418928715158da3610571cb9e9cbb18d4747d` | `A08A147CFE555DABE30F2C8F2E267F287E992F74F2B802E68989884338E23B17` |

---

## 4. Skill Responsibilities & Division of Labor

### 4.1 Engineering Foundation: `react-typescript-vite`
- **Primary Responsibility:** Functional correctness, strict typing, build performance, component structure.
- **Key Tasks:**
  - TypeScript interface definitions for props, state, and event models.
  - Component lifecycle, state hook isolation, and memoization where justified.
  - DOM/ARIA semantics, keyboard navigation, focus management, and focus trap implementation.
  - Vite bundling optimization and vanilla CSS module/stylesheet structure.

### 4.2 Supplemental Design & UX: `frontend-design`
- **Primary Responsibility:** Design craft, visual hierarchy, information architecture, art direction within locked tokens.
- **Key Tasks:**
  - Ensuring layouts feel deliberate, calm, and purpose-fit for educational workflows rather than generic dashboards.
  - Applying typographic scale, spacing rhythm, and surface contrast strictly through canonical design tokens.
  - Designing comprehensive state treatments (idle, loading, active, success, warning, error, disabled).
  - Validating accessibility contrast and interaction clarity before code finalization.

### 4.3 Responsive Specialist: `frontend-responsive-ui`
- **Primary Responsibility:** Mobile-first responsive and adaptive architecture across all form factors.
- **Key Tasks:**
  - Enforcing mobile-first base CSS with progressive enhancement via `min-width` media queries.
  - Fluid layouts using dynamic viewport units (`100dvh`), `viewport-fit=cover`, and safe-area insets (`env(safe-area-inset-*)`).
  - Strict touch target sizing (minimum 44x44px, recommended >= 48px/52px for assessment options).
  - Viewport-specific ergonomics: bottom sheets and compact sticky bars on mobile; split-screen sidebars on desktop.
  - Preventing horizontal overflow across all breakpoints (minimum 360px width supported baseline).

### 4.4 Rendered Visual QA: `web-design-reviewer`
- **Primary Responsibility:** Post-implementation browser and rendered visual verification.
- **Key Tasks:**
  - Verifying actual rendered output in a browser environment across representative viewports.
  - Detecting visual regressions: clipped text, unexpected wrapping, second-row overflow, misaligned flex items, overlapping sticky elements.
  - Inspecting touch target hitboxes and contrast ratios on actual rendered elements.
  - Formulating targeted, minimal source-level CSS/JSX fixes for observed visual defects.

---

## 5. Non-Mandatory Skills / On-Demand Candidates

The following skills were evaluated but are **NOT** installed as mandatory stack components in this execution:
- `ui-ux-pro-max`: Retained as an optional / on-demand candidate only. Not loaded by default to prevent overlapping instruction overhead and token bloat.
- `TasteSkill`: Not selected in current mandatory baseline.
- `Impeccable`: Not selected in current mandatory baseline.

Agents must not activate or install additional design skills unless explicitly authorized by Controller or Owner decision.

---

## 6. Operational Discipline & Invocation Guidelines

### 6.1 Token & Context Discipline
- **Do not load all skills simultaneously:** Agents must exercise token discipline. Activate only the specific skill relevant to the active sub-task.
- **When writing React/TypeScript code:** Consult `react-typescript-vite`.
- **When refining layout composition, visual hierarchy, or styling:** Consult `frontend-design`.
- **When structuring responsive layouts, breakpoints, or touch targets:** Consult `frontend-responsive-ui`.
- **When verifying rendered output or performing visual audit:** Consult `web-design-reviewer`.

### 6.2 Rendered Visual Verification Rule
- **Source / Static / Test PASS is NOT Sufficient:** Passing typecheck, unit tests, and production build is a required engineering gate, but it does NOT prove visual quality or responsive correctness.
- **Mandatory Rendered QA:** Any Build Unit that alters user-facing visual presentation MUST undergo rendered/browser inspection across representative viewports before visual BU closure.
- **Required Viewport Range:**
  1. *Narrow Mobile:* 360px – 375px width (strict one-row actions, zero horizontal scroll, compact header).
  2. *Standard Mobile:* 390px – 430px width.
  3. *Tablet:* 768px – 834px width.
  4. *Laptop / Desktop:* 1024px – 1440px width (split layout, desktop question navigator).
  5. *Wide Desktop:* 1920px+ width (contained readable line length).
- **Never claim "Responsive PASS" from CSS inspection alone:** Always verify the rendered layout behavior under actual browser dimensions.

### 6.3 Owner Actual Visual Review Gate
When a Build Unit introduces material user-facing visual changes, final closure is subject to actual Owner visual review. Identified visual findings must be recorded canonically and addressed through targeted remediation before stage completion.

---

## 7. External Skill Installation Safety Rules

Future external skill retrieval and installation MUST adhere strictly to the following safety protocols:
- **Pinned Source Commit:** Always specify and retrieve an exact, immutable Git commit hash rather than tracking a floating branch (`main` or `master`).
- **Exact Skill-Path Retrieval / Sparse Checkout:** Retrieve only the exact targeted skill directory via sparse checkout or specific file fetch. Never perform an unvetted full catalog clone of third-party repositories.
- **Pre-Installation Inspection:** Inspect directory structure, frontmatter, file contents, and subdirectories before copying into active skill directories. Verify that no unrelated fixtures, test catalogs, or suspicious binaries exist.
- **Global Antigravity Skill Directory:** Install vetted skills exclusively into the user's global Antigravity skill directory (`~/.gemini/config/skills/`).
- **No Unnecessary Full Catalog Clones:** Do not clone entire multi-skill mono-repos into temporary or local directories.
- **No Automatic Script Execution:** Bundled third-party scripts (e.g. Python helpers, automation scripts) must NOT be automatically executed by agents during installation, discovery, or verification.
- **No Repository Vendoring:** Do NOT vendor external skills directly into the application repository codebase unless explicitly authorized by Owner decision.
