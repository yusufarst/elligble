**Status:** LOCKED
**Version:** 1.0.0
**Canonical:** YES
**Depends On:** DEC-036, DEC-037, DEC-038, DEC-039, DEC-040, FRONTEND_DESIGN_SYSTEM.md, UI_CONTENT_AND_COPY_STYLE.md, SECURE_ASSESSMENT_EXAM_FOCUS_WORKSPACE.md
**Used By:** All ELLIGBLE frontend implementations, future Student, Teacher, Proctor, School Administrator, Guardian, Partner interfaces
**Last Reviewed:** 2026-09-13

# ELLIGBLE Warm Monochrome Institutional Visual Foundation

## 1. Purpose

This document establishes the canonical platform-wide visual foundation for ELLIGBLE in accordance with Owner decision **DEC-040**. It defines the visual principles, color palette, typography hierarchy, component grammar, iconography language, and elevation model that govern all user-facing surfaces across the product ecosystem.

This foundation elevates ELLIGBLE to a premium, modern, elegant, calm, unhurried, and institution-grade visual standard while rigorously eliminating generic AI-generated template appearance ("AI slop") and replacing the previous institution-navy-dominant interaction model with a restrained warm monochrome system.

---

## 2. Visual Principles

1. **Restrained Warm Monochrome:** The core canvas and components rely on pure and warm-tinted whites, deep black primary foregrounds, refined neutral borders, and dark gray secondary text. Visual hierarchy is achieved through proportion, weight, and whitespace rather than saturated colors.
2. **Calm & Unhurried Composition:** Educational workflows—particularly high-stakes assessments—require extreme visual calmness. Interfaces must feel spacious, clear, and focused, freeing cognitive capacity for academic tasks.
3. **Institutional Trust Without Stodginess:** ELLIGBLE serves Indonesian secondary education (SMA, SMK, MA, MAK, and equivalent). The visual tone is serious, authoritative, and stable, yet modern, polished, and contemporary.
4. **Content-First Hierarchy:** User content (questions, passages, options, academic data, operational records) commands primary visual prominence. Navigation, headers, and toolbars recede into quiet, supportive frames.
5. **Sparse, Purposeful Semantic Accents:** Semantic colors (green, blue, amber, red) are reserved exclusively for critical status signals, verified confirmations, warnings, and errors. They are never used decoratively or as expansive backdrops.
6. **Tactile Clarity & Generous Hitboxes:** Interactive controls feel responsive and tangible with minimum 44x44px (recommended 48px to 52px for primary targets) touch targets, clear active states, and unambiguous boundaries.

---

## 3. Relationship to ElevenLabs / NeedMCP Reference

The visual foundation adopts the design language and refined craftsmanship exemplified by the Owner-supplied ElevenLabs design reference and the NeedMCP `elevenlabs` style specification.

- **Visual Reference Role:** The reference serves as an architectural pattern for surface restraint, subtle low-opacity elevation, modern typography, minimal outline iconography, and elegant component proportions.
- **Supplemental Tooling Only:** NeedMCP and its `elevenlabs` style profile represent supplemental tooling. They hold zero canonical governance authority over ELLIGBLE.
- **Authority Boundary:** Canonical repository documentation and explicit Owner decisions remain absolute. NeedMCP guidance is subordinate to this document, the Frontend Design System, and locked domain contracts.

---

## 4. Inspiration vs. Copying Boundary

ELLIGBLE adopts an **ElevenLabs-inspired visual system**, but strictly prohibits copying ElevenLabs brand assets or intellectual property:

### Strictly Prohibited (Do NOT Copy)
- ElevenLabs logo, emblem, or mark.
- ElevenLabs wordmark or typography lockup.
- Proprietary ElevenLabs illustrations, 3D assets, or marketing artwork.
- Product-specific wording, marketing copy, or voice-synthesis terminology.
- Proprietary SVG icons or raw component source extracted from ElevenLabs websites.
- Any ElevenLabs trademark or brand identity element as ELLIGBLE identity.

### Adopted Visual Characteristics
- Restrained monochrome foundation (black, gray, white, warm-white).
- Crisp white and warm-neutral cards and background surfaces.
- Solid black primary action buttons with white foreground.
- Refined dark-gray secondary typography (`#4E4E4E`).
- Subtle light borders (`#E5E5E5`).
- Generous, deliberate whitespace and breathing room.
- Multi-layer, low-opacity subtle drop shadows.
- Minimal outline iconography with consistent geometric stroke (1.5px–2px).
- Sparse, restrained semantic color accents.
- Quiet, unhurried, premium layout composition.

---

## 5. Color Palette Foundation

Canonical light-mode dominant token values:

| Role | Token Name | Hex Value | Application |
|---|---|---|---|
| **Primary / Action** | `--color-primary` / `--color-primary-action` | `#000000` | Primary buttons, active markers, high-emphasis icons, primary headings |
| **Primary Foreground** | `--color-primary-fg` | `#FFFFFF` | Text on black primary surfaces |
| **Secondary Text** | `--color-secondary` | `#4E4E4E` | Subheadings, helper text, secondary metadata, inactive labels |
| **Canvas Background** | `--color-background` | `#FFFFFF` | Base viewport background (with restrained warm-stone variants) |
| **Card / Surface** | `--color-surface` | `#FFFFFF` | Workstations, dialogs, cards, elevated sheets |
| **Muted Surface** | `--color-surface-muted` | `#F9F9FB` | Secondary panels, stimulus background, table headers |
| **Border Default** | `--color-border` | `#E5E5E5` | Standard element borders, dividers, inactive option borders |
| **Border Subtle** | `--color-border-subtle` | `#F0F0F0` | Interior row dividers, table lines |
| **Success Base** | `--color-success-base` | `#10B981` | Positive feedback, verified status, selected option accents |
| **Success Surface** | `--color-success-subtle` | `#ECFDF5` | Selected answer background tint, saved status badge background |
| **Success Border** | `--color-success-border` | `#A7F3D0` | Selected option border, saved indicator border |
| **Info Base** | `--color-info-base` | `#3B82F6` | Informational announcements, guidance cues |
| **Info Surface** | `--color-info-subtle` | `#EFF6FF` | Info banner background |
| **Warning Base** | `--color-warning-base` | `#F59E0B` | Timer under 5 minutes, unsaved queue alert, attention cues |
| **Warning Surface** | `--color-warning-subtle` | `#FFFBEB` | Warning banner background |
| **Danger Base** | `--color-danger-base` | `#EF4444` | Timer critical (<1m), save failure, validation errors, destructive actions |
| **Danger Surface** | `--color-danger-subtle` | `#FEF2F2` | Error banner background |

### Color Usage Constraints
- Saturated semantic colors must never be used as large background areas.
- High contrast (minimum 4.5:1 for body copy, 3:1 for large/graphical elements) is mandatory for all text and interactive states.
- Dark mode is not preselected in this baseline; the light-mode warm monochrome system is the sole canonical production target.

---

## 6. Institution Navy Supersession

Per Owner decision **DEC-040**, the previous institution-navy-dominant interaction model is explicitly superseded:

- **Superseded Roles:** Institution navy (`#243b53`, `#102a43`, `#334e68`) is **NO LONGER** the dominant UI interaction language.
- **Prohibited Navy Uses:** Navy must NOT remain the default:
  - primary button color;
  - selected-control or radio-checked color;
  - dominant navigation bar background;
  - focus ring or focus surface color;
  - default high-emphasis action treatment.
- **Permitted Limited Role:** Historical institution navy tokens remain in token registries for backwards compatibility and may be used solely as a limited ELLIGBLE brand accent where future institutional identity specifically requires it.

---

## 7. Typography Direction

- **Primary Preferred UI Typography:** **Inter** (clean, neutral, highly legible at micro and macro scales).
- **Preferred Modern Technical / Monospace Direction:** **Geist Mono** or equivalent approved monospace face (tabular numerals, precise timer, code/key readouts).
- **System Fallback Stack (Mandatory):**
  ```css
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Geist Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  ```
- **Implementation & Delivery Guardrail:**
  - This execution is docs-only.
  - Zero fonts downloaded, zero external font CDN URLs, zero npm font packages, zero binary font assets added.
  - Inter and preferred monospace faces may be adopted only via separately verified, safe delivery mechanisms (e.g. self-hosted assets).
  - Robust system fallbacks remain mandatory. No production UI may fail or block rendering because an external font service is unreachable.

---

## 8. Spacing Scale

A restrained harmonic spatial rhythm centered on 5 key step values:

| Value | Token | Primary Application |
|---|---|---|
| **4px** | `--space-1` | Micro-gap, badge padding, border offset |
| **8px** | `--space-2` | Element spacing, button icon gaps, compact padding |
| **16px** | `--space-4` | Card padding, standard element gap, mobile container margin |
| **24px** | `--space-6` | Section separation, desktop card padding, modal interior gap |
| **32px** | `--space-8` | Major workspace block division, page separation |

Existing functional intermediate spacing tokens (`12px`, `20px`, `40px`, `48px`) remain valid where operational layout requires them. Arbitrary one-off spacing proliferation is prohibited.

---

## 9. Radii Scale

| Radius | Application |
|---|---|
| **4px** | Checkboxes, micro-tags, small status chips |
| **8px** | Input fields, standard cards, dropdown menus, table cells |
| **12px** | Modals, bottom sheet top corners, major workstation containers |
| **16px** | Standalone elevated hero cards, large dialogs |
| **Full Pill (`9999px`)** | Compact status badges, dedicated pill CTAs, question number bubbles |

### Radii Guardrails
- Full pill geometry is reserved for genuinely pill-like compact controls and badges.
- Do NOT turn every rectangular container, input field, or card into a pill.
- Radii >= 24px on rectangular content cards are exceptional and prohibited by default.

---

## 10. Elevation and Shadows

Multi-layer, low-opacity shadows provide subtle depth without visual weight:

```css
--shadow-subtle: 0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.02);
--shadow-card: 0 2px 4px -1px rgba(0, 0, 0, 0.04), 0 4px 8px -2px rgba(0, 0, 0, 0.03);
--shadow-elevated: 0 8px 16px -4px rgba(0, 0, 0, 0.06), 0 4px 8px -2px rgba(0, 0, 0, 0.03);
--shadow-modal: 0 16px 32px -8px rgba(0, 0, 0, 0.08), 0 8px 16px -4px rgba(0, 0, 0, 0.04);
```

### Elevation Constraints
- Shadows must have very low opacity (3%–8% total opacity).
- Functional hierarchy only: bottom sheets, floating docks, dialogs.
- Strictly prohibited: neon glows, colored halos, heavy floating-card stacks, or 3D skeuomorphism.
- Not every component receives elevation. Most surfaces rely on subtle `#E5E5E5` borders.

---

## 11. Iconography Language (Owner Lock)

- **Style:** Minimal outline icons with a consistent single-family visual geometry.
- **Stroke Width:** 1.5px to 2.0px stroke with rounded caps (`stroke-linecap: round`) and rounded joins (`stroke-linejoin: round`).
- **Geometry:** Clean geometric construction, balanced bounding box, functional metaphor first.
- **Colors:**
  - Default: Near-black (`#000000` or `#1F2937`).
  - Low-Emphasis / Secondary: Secondary gray (`#4E4E4E` or `#6B7280`).
  - Semantic: Green (`#10B981`), Blue (`#3B82F6`), Amber (`#F59E0B`), Red (`#EF4444`) only when conveying verified status.
- **Prohibitions:**
  - Do NOT use emoji as production controls.
  - Do NOT use raw Unicode glyphs (e.g. `◷`, `✓`, `☰`, `←`, `→`) as the primary production icon system.
- **Canonical Functional Metaphors:**
  - **Timer:** Clock outline.
  - **Saved:** Check-circle or checkmark outline.
  - **Saving:** Restrained progress ring / spinner indicator.
  - **Failed:** Alert-circle outline.
  - **Question Navigator:** Grid or list outline.
  - **Previous:** Chevron-left.
  - **Next:** Chevron-right.
  - **Close / Dismiss:** X outline.
  - **Information:** Info-circle outline.

---

## 12. Icon Asset Ownership & Delivery

- Proprietary ElevenLabs SVG assets must NOT be copied, scraped, or vendored into ELLIGBLE.
- Production implementation will use:
  1. Project-controlled SVG components authored directly in the codebase;
  2. Locally maintained SVG assets;
  3. Or a future explicitly approved open-source icon package (e.g. Lucide, Heroicons, or equivalent) approved via controlled execution.
- No third-party icon package is pre-approved or installed in this docs-only execution.

---

## 13. Icon Containers

Restrained icon containers are permitted where they strengthen visual affordance or hierarchy:
- **Shape:** Soft circle or small rounded square (`radius: 8px`).
- **Surface:** Warm/light neutral background (`#F4F4F5` or `#F9F9FB`).
- **Semantic Tint:** Subtle tinted background (`#ECFDF5` for success, `#FEF2F2` for error) only when communicating verified status.
- **Restraint Rule:** Do NOT place every icon inside a container. Use containers selectively for status indicators, section callouts, or prominent action buttons.

---

## 14. Button Hierarchy

| Variant | Surface | Foreground | Border | Application |
|---|---|---|---|---|
| **Primary** | `#000000` | `#FFFFFF` | None | High-emphasis actions ("Selesai", "Kirim Jawaban", "Simpan"). Strong, restrained emphasis. |
| **Secondary** | `#FFFFFF` | `#000000` | `1px solid #E5E5E5` | Standard navigation ("Berikutnya", "Daftar Soal"), dialog cancel. |
| **Low-Emphasis / Ghost** | Transparent | `#4E4E4E` | None / subtle hover | Secondary navigation ("Sebelumnya"), back actions. |
| **Danger** | `#EF4444` | `#FFFFFF` | None | Destructive actions (session termination). Multi-step confirmation required. |

- Compact controls may use pill geometry where ergonomically appropriate.
- High-stakes actions retain confirmation dialog requirements.

---

## 15. Component and Surface Language

### Characteristics
- Dominant white / warm-white surfaces.
- Near-black text for primary content; dark gray for supporting metadata.
- `#E5E5E5`-class subtle, clean borders.
- Precise vertical and horizontal alignment.
- Generous, controlled internal padding.
- Modern, balanced component proportions.
- Clean composition pairing outline icon with short, clear text.

### Anti-Patterns to Avoid
- Heavy card stacks with nested borders and deep shadows.
- Navy-heavy surfaces, bars, or backgrounds.
- Saturated navigation bars or gradient headers.
- Thick 2px+ borders on non-active containers.
- Giant, blurry drop shadows.
- Excessive pill wrapping around standard rectangular inputs.
- Glassmorphism, backdrop blurs, glow effects, or 3D skeuomorphism.
- AI-template bento box grids.

---

## 16. Mobile Navigation and Command Dock

Mobile navigation adheres to the ElevenLabs-inspired component grammar:
- **Composition:** Minimal outline icon + short, unambiguous text label.
- **Ergonomics:** Single-row viewport-bottom sticky Command Dock.
- **Touch Target:** Minimum 44x44px (recommended 48px height) touch targets.
- **Responsive Layout:** Symmetric, non-wrapping 4-button row at canonical 360px baseline:
  - `Sebelumnya`: Low emphasis (ghost or subtle border).
  - `Daftar Soal`: Navigation trigger (white surface, subtle border).
  - `Berikutnya`: Clear navigation (white surface, subtle border).
  - `Selesai`: High action emphasis (black primary surface, white text).
- Previous and next controls must NOT be icon-only; text labels remain mandatory for accessibility and clarity.

---

## 17. Selected Answer States (Owner Lock)

- **Immediate Visual Feedback:** When a student taps or clicks an answer option, the option becomes **GREEN IMMEDIATELY**.
- **Exact Meaning:** Green selected option means **CURRENT STUDENT SELECTION**. It does **NOT** mean server save completed.
- **Styling Treatment:**
  - Background: Pale green tint (`#ECFDF5` / `--color-success-subtle`).
  - Border: Refined green accent (`#10B981` / `--color-success-base`).
  - Indicator: Green radio checked circle.
  - Text: Readable dark foreground (`#064E3B` or `#1F2937`).
  - Restraint: No saturated dark-green block, no neon glow, no celebratory animation.
- **Single-Choice Rule:** Exactly one option in a single-choice question may appear selected at any time.
- **Dual Encoding:** Radio checked state + distinct border + surface tint (never color alone).

---

## 18. Save Status Presentation (Owner Lock)

- **Separation of Concerns:** Save state is **STRICTLY SEPARATE** from selected-answer styling.
- **Placement Rules:**
  - Do NOT place save text ("Tersimpan", "Menyimpan...", "Gagal menyimpan") inside the answer option.
  - Do NOT place the normal save-status block underneath the entire list of answer options.
  - Save status belongs to the **compact upper exam information area**.
- **Exact Semantic States:**
  1. `Belum dijawab`: No selection made.
  2. `Menyimpan...`: Mutation in flight immediately upon student input.
  3. `Tersimpan`: Displayed **ONLY** after explicit server HTTP 200/201 acknowledgement with matching write version.
  4. `Gagal menyimpan`: Network or server rejection, with retry capability.
- **Sequence:**
  ```text
  Student selects Option B
  │
  ├─► Option B becomes GREEN immediately (Current Selection)
  │
  ├─► Upper Info Area shows "Menyimpan..."
  │
  ├─► Server returns 200 ACK with write_version
  │
  └─► Upper Info Area transitions to "Tersimpan"
  ```
  If save fails: Option B remains visibly green (student selection), while upper info area displays high-contrast "Gagal menyimpan".

---

## 19. Authoritative Timer Presentation

- **Criticality:** Countdown timer is mission-critical and continuously visible.
- **Display Style:** Compact, prominent numeric readout in monospace / tabular figures (`font-variant-numeric: tabular-nums`).
- **Icon:** Optional minimal clock outline.
- **Appearance:** Clean typography, NOT an input-box or button-like container.
- **Prohibition:** No duplicated timer anywhere on the screen. No fake OS or system clock.

---

## 20. Device & Connectivity Information Restraint

- **Battery State:** Do NOT display battery icons or percentage merely for visual ornamentation. Normal battery state displays nothing. Low-battery warnings may appear only when backed by reliable, authorized native device APIs.
- **Connectivity State:** Normal connectivity displays nothing ("Online", "Aman", and "Sinkron" are suppressed). Only exceptional disconnected or sync-recovery states appear, backed by verified runtime state.

---

## 21. Question Navigator Bottom Sheet

- **Dialog Semantics:** `role="dialog"`, `aria-modal="true"`, focus containment trap, Escape key closure, focus restoration to trigger button.
- **Layout:** Non-scrolling fixed header with title, answered count summary, and minimal outline close icon (`✕`); scrollable middle question number grid; non-scrolling footer with primary black "Selesai" submission button.
- **Grid Item Styling:**
  - Current: Black primary border and indicator.
  - Answered: Subtle green tint (`#ECFDF5`) with green border and checkmark (`✓`).
  - Unanswered: Clean light neutral border (`#E5E5E5`).
- **Information Density:** Numbers lead; descriptive labels recede.

---

## 22. Desktop Workspace Specialization (>= 1024px)

- **Split-Screen Layout:** Left pane (~280px to 320px) Question Navigator Map; Right pane Question & Answer Focus Workspace.
- **Unified Language:** Desktop adopts the identical Warm Monochrome visual foundation—dominant white surfaces, black primary buttons, light `#E5E5E5` borders. Desktop must NOT revert to a navy theme.
- **Progress Map:** Clean, instrumental navigation matrix rather than a heavy, calculator-like button block.

---

## 23. Accessibility Baseline (WCAG 2.1 AA)

- Contrast ratio >= 4.5:1 for normal body text; >= 3:1 for graphical UI elements and large headings.
- Visible focus indicator: 2px solid `#000000` with 2px offset (`:focus-visible`).
- Semantic HTML tags (`<main>`, `<nav>`, `<header>`, `<button>`, `<fieldset>`, `<legend>`, `<input type="radio">`).
- Full keyboard flow: `Tab`, `Shift+Tab`, `Arrow` keys, `Enter`, `Space`, `Escape`.
- Screen-reader labels (`aria-label`, `aria-live="polite"` for save-status updates).

---

## 24. NeedMCP Governance & Authority Boundary

- **Tooling Classification:** NeedMCP is supplemental tooling, NOT canonical authority.
- **Command Invocation:** When NeedMCP is installed in a future controlled execution, commands such as `npx needmcp style set elevenlabs` or prompts invoking `style:elevenlabs` provide assistive code suggestions.
- **Subordination:** NeedMCP suggestions must conform to this document and the locked Frontend Design System. If NeedMCP proposes proprietary assets, brand marks, arbitrary dependencies, or conflicting colors, the repository canonical rules win absolutely.
- **Current Status:** **NEEDMCP: NOT YET INSTALLED / NOT YET ACTIVATED.**
