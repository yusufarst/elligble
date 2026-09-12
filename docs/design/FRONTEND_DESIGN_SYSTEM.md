**Status:** LOCKED
**Version:** 1.0.0
**Canonical:** YES
**Depends On:** DEC-036, DEC-037, 00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md, 04.01_SECURE_ASSESSMENT.md
**Used By:** All frontend implementations, UI components, future Build Units
**Last Reviewed:** 2026-09-12

# ELLIGBLE — Frontend Design System

## 1. Design Principles

ELLIGBLE is an institutional education platform delivering mission-critical academic services across Indonesian secondary schools (SMA, SMK, MA, MAK, and equivalent). The platform design communicates:
- **Seriousness & Trust:** Clean, stable, and institution-grade. Built for official school records, high-stakes assessments, and longitudinal student progress.
- **Clarity & Calmness:** Distraction-free user experience. Visual hierarchy prioritizes operational comprehension over decorative noise.
- **Accessibility & Inclusion:** Mobile-first, device-resilient, screen-reader friendly, and compliant with WCAG 2.1 AA standards.
- **Coherence Across Roles:** A single design language unified across Student, Teacher, Proctor, School Administrator, Guardian, and Partner interfaces. Individual Build Units may not invent proprietary styling.

## 2. React + TypeScript + Vite Implementation Foundation

- **Core Stack:** React (functional components, strictly typed hooks), TypeScript (strict mode, zero `any`), and Vite (fast ESM native bundling).
- **Styling Architecture:** Standard CSS custom properties (design tokens) combined with modular CSS / component styles.
- **Decoupled Boundary:** Client builds are static artifacts communicating over bounded HTTP/JSON REST APIs with the authoritative backend (`runtime/secure-assessment/src/server.ts`).
- **No Unapproved Frameworks:** The canonical approval of React + TypeScript + Vite does not permit arbitrary introduction of Tailwind, shadcn/ui, Material UI, Chakra, Bootstrap, or heavy third-party UI component suites without explicit Owner approval.

## 3. Mobile-First Responsive Strategy

- **Baseline Viewport:** Layouts are authored mobile-first (360px minimum width) and progressively enhanced for larger viewports.
- **Touch Targets:** All interactive elements (buttons, inputs, options, tabs) must maintain a minimum bounding box of 44x44 CSS pixels on touch viewports.
- **Safe Areas:** Adhere to `env(safe-area-inset-*)` for notched displays and mobile browser navigation bars.
- **No Horizontal Overflow:** Core content containers must never force horizontal scrolling on any supported screen size.

## 4. Breakpoints

| Breakpoint Name | Min-Width | Target Devices | Behavior |
| :--- | :--- | :--- | :--- |
| `sm` | 640px | Large phones, small tablets | 2-column forms, expanded action bars |
| `md` | 768px | Tablets, portrait iPad | Dual-pane navigation, table views |
| `lg` | 1024px | Small laptops, landscape iPad | Split assessment layout, sidebars |
| `xl` | 1280px | Desktop monitors, workstations | Standard desktop container |
| `2xl` | 1536px | Large monitors | Capped content width with balanced margins |

## 5. Page, Grid, and Layout System

- **Layout Structure:** Standard layout consists of a Top Bar / Header, Main Content Stage, and optional contextual Drawer/Sidebar.
- **Grid System:** 12-column CSS Grid with responsive gutters:
  - Mobile (`< 640px`): 4 columns, 16px gutter.
  - Tablet (`640px - 1023px`): 8 columns, 20px gutter.
  - Desktop (`>= 1024px`): 12 columns, 24px gutter.
- **Assessment Mode Layout:** Single-focus layout. Global navigation is suppressed. Two-column split-screen layout on desktop (Question Navigator / Question & Answer Workstation); single-column tabbed view on mobile.

## 6. Maximum Content Widths

- `max-w-prose`: 65ch to 75ch for readable text blocks and long-form reading passages.
- `max-w-form`: 540px for single-column form inputs and auth dialogs.
- `max-w-assessment`: 1200px for the locked Secure Assessment workstation.
- `max-w-dashboard`: 1440px for administrative tables and operational dashboards.
- Centering: Block containers utilize `margin-inline: auto` with minimum `16px` padding on mobile, `24px` on desktop.

## 7. Spacing Scale

Based on an 8-point harmonic spatial grid with a 4px sub-step:

| Token | Value | Rem Equivalent | Primary Application |
| :--- | :--- | :--- | :--- |
| `--space-1` | 4px | 0.25rem | Micro-spacing, badge padding, border offsets |
| `--space-2` | 8px | 0.5rem | Inline element gaps, compact padding |
| `--space-3` | 12px | 0.75rem | Input vertical padding, button small gap |
| `--space-4` | 16px | 1.0rem | Standard card padding, standard gap |
| `--space-5` | 20px | 1.25rem | Intermediate section spacing |
| `--space-6` | 24px | 1.5rem | Modal padding, major section gutters |
| `--space-8` | 32px | 2.0rem | Page layout vertical separation |
| `--space-10` | 40px | 2.5rem | Major header separation |
| `--space-12` | 48px | 3.0rem | Empty state vertical padding |
| `--space-16` | 64px | 4.0rem | Large display boundary spacing |

## 8. Typography Hierarchy

Typographic scale is fluid, readable, and structured:

| Role | Font Size | Line Height | Weight | Application |
| :--- | :--- | :--- | :--- | :--- |
| `display` | 32px / 2.0rem | 1.25 | 700 | Primary product screen titles |
| `h1` | 24px / 1.5rem | 1.3 | 600 | Page headings, exam title |
| `h2` | 20px / 1.25rem | 1.35 | 600 | Section headings, dialog titles |
| `h3` | 18px / 1.125rem | 1.4 | 600 | Card titles, question numbers |
| `body-large`| 18px / 1.125rem | 1.5 | 400 | Exam question stimulus passages |
| `body` | 16px / 1.0rem | 1.5 | 400 | Primary UI text, form labels |
| `body-sm` | 14px / 0.875rem | 1.45 | 400 / 500 | Metadata, table content, captions |
| `caption` | 12px / 0.75rem | 1.4 | 500 | Badges, helper text, timestamps |
| `mono` | 14px / 0.875rem | 1.4 | 500 | Timer, codes, keys, session IDs |

## 9. Font Strategy and Fallback Policy

- **Primary Sans-Serif Stack:**
  `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";`
  Zero external webfont blocking. Leverages high-performance system fonts for instant rendering without flash of unstyled text (FOUT) or layout shifts (CLS).
- **Monospace Stack (Timer & Codes):**
  `font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;`
  Used for authoritative countdown timer, attempt tokens, and verification hashes to guarantee tabular numeric alignment.

## 10. Color Roles and Semantic Tokens

Colors are defined via CSS custom properties adhering to strict contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text):

### Primary Brand & Action (Institution Navy)
- `--color-primary-50`: `#f0f4f8`
- `--color-primary-100`: `#d9e2ec`
- `--color-primary-500`: `#334e68`
- `--color-primary-600`: `#243b53` (Primary interactive buttons, focused states)
- `--color-primary-700`: `#102a43` (Primary brand header, headings)
- `--color-primary-900`: `#0b1d30`

### Neutral Grays
- `--color-neutral-0`: `#ffffff` (Card and dialog surface)
- `--color-neutral-50`: `#f8fafc` (Canvas background)
- `--color-neutral-100`: `#f1f5f9` (Subtle borders, disabled inputs)
- `--color-neutral-200`: `#e2e8f0` (Standard element borders)
- `--color-neutral-300`: `#cbd5e1` (Input borders)
- `--color-neutral-400`: `#94a3b8` (Placeholder text)
- `--color-neutral-500`: `#64748b` (Secondary metadata text)
- `--color-neutral-700`: `#334155` (Primary body text)
- `--color-neutral-900`: `#0f172a` (Headings and emphasis)

## 11. Semantic States

- **Success (Green):**
  `--color-success-bg`: `#f0fdf4`, `--color-success-border`: `#bbf7d0`, `--color-success-text`: `#166534`.
  Application: Answer successfully saved, exam submitted, readiness preflight verified.
- **Warning (Amber):**
  `--color-warning-bg`: `#fffbeb`, `--color-warning-border`: `#fde68a`, `--color-warning-text`: `#92400e`.
  Application: Timer under 5 minutes, answer save pending sync, proctor alert.
- **Danger (Red):**
  `--color-danger-bg`: `#fef2f2`, `--color-danger-border`: `#fecaca`, `--color-danger-text`: `#991b1b`.
  Application: Validation errors, timer expired, connection failure, destructive actions.
- **Info (Blue):**
  `--color-info-bg`: `#eff6ff`, `--color-info-border`: `#bfdbfe`, `--color-info-text`: `#1e40af`.
  Application: System notices, instructions, room announcements.
- **Neutral (Slate):**
  `--color-neutral-badge-bg`: `#f1f5f9`, `--color-neutral-badge-text`: `#475569`.
  Application: Inactive questions, informational status tags.

## 12. Surfaces and Background Hierarchy

- **Surface 0 (Base Canvas):** `--color-neutral-50` (`#f8fafc`). Background for viewport.
- **Surface 1 (Card/Container):** `--color-neutral-0` (`#ffffff`). Background for content sections and question workbenches.
- **Surface 2 (Elevated/Flyout):** `--color-neutral-0` with standard elevation. Dialogs, dropdowns, and modals.
- **Surface Inset:** `--color-neutral-100` (`#f1f5f9`). Used for question stimulus code blocks, helper panels, and disabled states.

## 13. Borders

- `--border-subtle`: `1px solid var(--color-neutral-100)`
- `--border-default`: `1px solid var(--color-neutral-200)`
- `--border-active`: `1px solid var(--color-primary-600)`
- `--border-error`: `1px solid var(--color-danger-text)`
- `--border-focus`: `2px solid var(--color-primary-600)`

## 14. Radii Scale

- `--radius-sm`: `4px` (Small badges, tags, checkboxes)
- `--radius-md`: `6px` (Standard buttons, input fields, dropdowns)
- `--radius-lg`: `8px` (Cards, panels, assessment workstation)
- `--radius-xl`: `12px` (Modals, alert dialogs)
- `--radius-full`: `9999px` (Status indicators, avatar placeholders)
- Prohibited: Arbitrary oversized radii (`24px+`) on rectangular content cards.

## 15. Shadows and Elevation

- `--shadow-none`: `none`
- `--shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (Cards, input fields)
- `--shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)` (Floating bars, dropdowns)
- `--shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)` (Modals, confirm dialogs)
- Prohibited: Heavy neon glows, diffuse colored drop shadows, or floating aesthetic halos.

## 16. Iconography Rules

- **Family:** Consistent, single-family outline icons (stroke width `1.5px` or `2px`).
- **Sizes:** Micro `14x14px`, Default `18x18px`, Medium `24x24px`, Large `32x32px`.
- **Purpose:** Icons must serve functional clarity (e.g. checkmark for saved, warning triangle for unsaved, clock for timer). Never use floating purely decorative icons.

## 17. Button Hierarchy

- **Primary:** High-emphasis actions. Solid background (`--color-primary-600`), white text. One primary button per visual view (e.g. "Simpan & Lanjutkan" or "Kirim Jawaban").
- **Secondary:** Neutral emphasis. White background, `--border-default`, neutral text. (e.g. "Soal Sebelumnya").
- **Subtle / Ghost:** Low-emphasis actions. Transparent background, neutral text, subtle hover. (e.g. "Daftar Soal").
- **Destructive:** Irreversible or high-risk actions. Red background (`--color-danger-text`), white text. Always accompanied by a secondary confirmation modal.

## 18. Links

- Default: Underlined or distinctly colored text (`--color-primary-600`).
- Focus: Visible focus ring matching `--border-focus`.
- Security: External links open with `rel="noopener noreferrer"`.

## 19. Forms & Inputs

- Layout: Vertical stack (label -> helper text -> input field -> validation error).
- Labels: Explicit `<label>` elements connected via `htmlFor`.
- Height: 44px minimum touch target.
- Spacing: 16px vertical gap between form groups.

## 20. Input Fields

- Border: `--border-default` transitioning to `--border-focus` on focus.
- Background: `--color-neutral-0`.
- Padding: `10px 14px`.
- Placeholder: Descriptive, non-essential hint text.

## 21. Checkboxes, Radios, and Selects

- Radio Options (Multiple Choice Questions): Full-width selectable card component with radio indicator. Minimum 48px height to ensure effortless touch selection.
- Selected State: Outlined in `--color-primary-600` with subtle `--color-primary-50` background tint.

## 22. Validation States

- Visual: Red border (`--color-danger-text`) and red error message below the field.
- Programmatic: `aria-invalid="true"` and `aria-describedby="field-error-id"`.

## 23. Tables

- Header: Sticky header, uppercase caption font, `--color-neutral-50` background.
- Row Borders: `--border-subtle`. Alternating zebra striping is optional, clean white with hover state preferred.
- Compact Density: 12px padding for dense data tables, 16px for standard lists.

## 24. Cards

- Surface: White background, `--border-default`, `--radius-lg`, `--shadow-sm`.
- Padding: 16px on mobile, 24px on desktop.
- Header / Content / Footer separation via `--border-subtle` where necessary.

## 25. Navigation

- Top Bar: Fixed or sticky top navigation with school tenant label, role identifier, user avatar, and session actions.
- Assessment Navigation: Suppressed global navigation. Only contains Exam Title, Question Progress Indicator, Authoritative Timer, and Connectivity Status.

## 26. Tabs

- Style: Underlined active tab or pill-button tab.
- State: Active tab indicated by solid 2px primary border and bold font.

## 27. Badges and Status Indicators

- Shape: Rounded rectangle (`--radius-sm` or `--radius-md`).
- Padding: 2px 8px.
- Semantics: Success (Tersimpan / Selesai), Warning (Menunggu Sinkronisasi), Danger (Gagal Simpan / Waktu Habis), Neutral (Belum Dijawab).

## 28. Modal and Dialog Rules

- Backdrop: Semi-transparent dark overlay (`rgba(15, 23, 42, 0.6)`).
- Accessibility: Focus trapped inside modal; `Escape` closes non-critical modals; focus returned to trigger on close.
- High-Stakes Submission Modal: `Escape` disabled; explicit confirmation checkbox or button click required.

## 29. Drawer and Sheet Rules

- Application: Question navigation grid on mobile screens.
- Animation: Slides smoothly from bottom or right side.

## 30. Toast and Notification Rules

- Position: Top-right on desktop, top-center on mobile.
- Persistence: Auto-dismisses after 4 seconds for success messages; persistent until dismissed for errors or warnings.

## 31. Loading States

- Spinner: Smooth rotating vector circle in primary color.
- Avoid full-screen blocking spinners when background synchronization is occurring.

## 32. Skeleton and Progress Rules

- Progress Bar: Height 6px to 8px, solid fill, smooth transition.
- Skeleton Screens: Subtle gray pulse animation for initial data loads.

## 33. Empty States

- Structure: Neutral icon, clear heading ("Belum ada data"), concise explanation, and optional primary action button.

## 34. Error States

- Inline Error: Contained warning card with explicit error message and "Coba Lagi" (Retry) action.
- Global Error Boundary: Clean error page with contact support / return home action.

## 35. Accessibility Baseline (WCAG 2.1 AA)

- Full compliance with WCAG 2.1 AA.
- Contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text and UI components.
- Semantic HTML tags used throughout.

## 36. Keyboard Navigation

- Complete operability without a mouse:
  - `Tab` / `Shift+Tab`: Navigate focusable elements.
  - `Enter` / `Space`: Activate buttons and toggle options.
  - `Arrow keys`: Navigate question list and radio options.
  - `Escape`: Dismiss dialogs and drawers.

## 37. Visible Focus

- `:focus-visible` ring of 2px solid `--color-primary-600` with 2px offset.
- `outline: none` is strictly prohibited without an explicit `:focus-visible` replacement.

## 38. Contrast Requirements

- Automated verification of color pairings.
- No light gray text on white backgrounds.

## 39. Reduced-Motion Handling

- `@media (prefers-reduced-motion: reduce)` disables all non-essential transitions and animations.

## 40. Motion and Animation Principles

- Purpose-driven micro-interactions only (150ms to 200ms ease-out transitions).
- Prohibited: Parallax scrolling, bounce effects, decorative particle animations.

## 41. Cross-Role Visual Consistency

- Students, Teachers, Proctors, and Admins experience the exact same typography, token colors, and component patterns.
- Role differentiation is communicated via layout and context, not separate design themes.

## 42. Tenant Branding Boundaries

- School Tenant name and optional emblem appear in the top navigation header within strict boundaries (max height 40px).
- School branding may NOT alter core system typography, colors, or accessibility tokens.

## 43. Student UX Rules

- Mobile-first, low cognitive load, unambiguous buttons.
- No promotional banners, social elements, or distracting notifications during academic tasks.

## 44. Teacher UX Rules

- Dense, structured operational views for class management and exam assignment.
- Clear confirmation dialogs for exam publishing or schedule changes.

## 45. Proctor UX Rules

- Real-time room status grid.
- High-contrast visual alerts for schedule conflicts, student disconnects, or room coverage warnings.

## 46. School Staff / Admin UX Rules

- Standardized master-detail layouts.
- Filterable tables with clear pagination and export capabilities.

## 47. Guardian UX Rules

- Simplified read-only student academic progress and attendance summary views.
- Mobile-optimized card layout.

## 48. Partner UX Rules

- Scoped, professional dashboard for opportunity listings and applicant reviews.
- Strict boundaries preventing unauthorized access to school internal records.

## 49. Alumni UX Rules

- Focused profile and verified achievement records.

## 50. Secure Assessment Distraction-Control Rules

- Total elimination of headers, sidebars, footer links, notification centers, and feedback widgets during active exam attempts.
- Clean white or neutral gray viewport with maximum contrast on question stimulus and options.

## 51. Secure Assessment Exam-Room Layout Rules

- Desktop: Left pane (30% width) Question Navigator & Status; Right pane (70% width) Question Stimulus & Answer Workstation.
- Mobile: Fullscreen Question Workstation with sticky bottom navigation bar and drawer for Question Navigator.

## 52. Authoritative Timer Visibility Principles

- Persistent, fixed timer displaying authoritative remaining time.
- Tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shaking.
- Color transitions: Normal (Navy/Slate), Under 5 minutes (Amber Warning), Under 1 minute (Red Urgent).

## 53. Answer Save and Sync State Visual Rules

- Clear, immediate feedback for student selections:
  - "Tersimpan": Subtle green checkmark indicator.
  - "Menyimpan...": Subtle spinning indicator.
  - "Belum Tersinkronisasi": Amber indicator with offline retry status.

## 54. Connectivity and Recovery State Presentation

- Non-intrusive top banner when offline: "Koneksi terputus. Jawaban tersimpan di perangkat Anda dan akan disinkronkan otomatis saat kembali terhubung."
- No panic modals or disruptive alerts that interrupt student concentration.

## 55. High-Stakes Submit Interaction Rules

- Two-step submission flow:
  1. Click "Selesaikan Ujian".
  2. Modal summary showing total answered vs unanswered questions, explicit confirmation checkbox ("Saya yakin ingin mengumpulkan ujian ini"), and primary "Kirim Jawaban" button.

## 56. Destructive Action Hierarchy

- Destructive actions (e.g. final submission, session termination) require deliberate multi-click confirmation with clear warning copy.

## 57. Anti-Cheating and Risk Signal Visual Restraint

- Split-screen / window-blur events are logged silently and surfaced only through proportional, calm notifications.
- No flashing alarm banners or accusatory visual styling.

## 58. Privacy and Sensitive-Data Visual Handling

- Sensitive student identification and grade information is masked by default on shared screens.
- Counseling (Care) notes are strictly partitioned with visual lock icons indicating access restriction.

## 59. Anti-AI-Slop Quality Rules

- Zero gratuitous purple/blue gradients or glassmorphism.
- Zero arbitrary bento grids or rounded pill badges.
- Zero decorative 3D illustrations or generic stock graphics.
- All visual elements must serve verified operational workflows.

## 60. Forbidden Arbitrary Per-BU Visual Invention

- Individual Build Units must strictly reuse tokens and components defined in this Design System.
- Adding ad-hoc colors, custom fonts, non-standard button sizes, or independent design systems in any Build Unit is strictly prohibited.
