**Status:** ACTIVE (working record)
**Version:** 1.3.0
**Canonical:** WORKING RECORD of UI-SYSTEM-001 (production task graph, `docs/production/PRODUCTION_COMPLETION_PLAN.md` §6.2)
**Depends On:** Global UI/UX consistency contract (plan §10.1, Owner 2026-09-30), DesainPakeAI project `b5a22aa4-7b38-49d2-9448-443eab6e8075` context revision `sha256-5d0d77796ab574177a840d227a99e7457d623564c9d40160703f32224073c2b8` ("Provenance Thread" alpha.1), FRONTEND_DESIGN_SYSTEM.md, UI_CONTENT_AND_COPY_STYLE.md
**Last Reviewed:** 2026-09-30

# UI Consistency Audit (UI-SYSTEM-001)

Every implemented screen checked against the contract of plan §10.1: does it look and behave like the same ELLIGBLE product as every other role and module? Findings are classified MATERIAL PRODUCT CONSISTENCY DEFECT (fixed at once) or COSMETIC / SAFE TO CONVERGE DURING NORMAL WORK (folded into the named task). Accessibility defects count as material: the design authority never overrides accessibility (DEC-043).

## 1. Scope and method

- Design authority inspected: the DesainPakeAI project above at the recorded revision (authenticated CLI, `dpai context --pretty`), tokens and component list of "Provenance Thread" alpha.1.
- Screens: sign-in; student exam list, launch, exam workspace and submit confirmation; teacher "Pelaksanaan Ujian" with its dialogs ("Tambah Peserta", "Ubah Jadwal", "Batalkan Ujian"), question import, question preview, participant monitoring and results; proctor "Monitoring Ujian".
- Rendering: the production process on a real PostgreSQL database after the whole browser journey, Chromium at 360, 768 and 1280 px.
- Accessibility: axe-core 4.13 (WCAG 2.0 and 2.1 A and AA, best practices) on every screen above, before and after the fixes.
- Code inventory: stylesheets and components for hard-coded colors, undefined tokens, page-local controls, state, badge and card patterns.

## 2. Findings

| ID | Where | Finding | Contract | Class | Resolution |
|---|---|---|---|---|---|
| M1 | every destructive button ("Akhiri Ujian", "Batalkan Ujian", their confirmations) | white text on `#ef4444`: 3.76:1, WCAG AA needs 4.5:1 | §10.1.14, WCAG 1.4.3 | MATERIAL | FIXED: the danger token is the DesainPakeAI danger `#b42318` (6.57:1; 5.6:1 on hover) |
| M2 | exam workspace: "Tersimpan", the answered counts | `#059669` on white: 3.77:1 | WCAG 1.4.3 | MATERIAL | FIXED: success text token (9.72:1) |
| M2b | exam workspace: "Menyimpan..." while an answer is being saved | `#d97706` on white: 3.19:1 (found at 768 px, where a save was in flight during the check) | WCAG 1.4.3 | MATERIAL | FIXED: warning text token (7.1:1); the failed state uses the danger text token |
| M3 | exam workspace: question summary labels ("Total Soal", "Sudah Dijawab", "Belum Dijawab") | `#71717a` on `#f4f4f3`: 4.39:1 | WCAG 1.4.3 | MATERIAL | FIXED: secondary text token (7.56:1) |
| M4 | student exam list, teacher "Pelaksanaan Ujian", proctor "Monitoring Ujian" | no main landmark, unlike every newer screen; content outside landmarks; a second banner on the student list | §10.1.5, WCAG 1.3.1 | MATERIAL | FIXED: the page root is `main`, as on the other screens |
| M5 | student exam list | a list whose children are articles | WCAG 1.3.1 | MATERIAL | FIXED: each card is a list item |
| M6 | sign-in and the other session screens | no level-one heading | WCAG 1.3.1, 2.4.6 | MATERIAL | FIXED: `CardTitle level="h1"`, a documented variant of the shared card title |
| M7 | teacher and proctor page headers, their error and empty states | "Perbarui Data" and "Coba Lagi" as page-local buttons styled as primary: two primary actions side by side, and the same action looking different in the empty state | §10.1.2, §10.1.6 | MATERIAL | FIXED: the shared Button, secondary variant; the page-local styles are gone |
| M8 | teacher stylesheet | three undefined tokens (`--color-bg-subtle`, `--color-disabled`, `--color-error-bg`) falling back to off-system colors, and 15 hard-coded fallbacks | §10.1.3 | MATERIAL | FIXED: mapped to defined tokens; no hard-coded color left in the file |
| M9 | status badges | three implementations: the teacher lifecycle badge (page CSS), the student status pill (page CSS, fully rounded) and the monitoring and results tone classes; a working participant is blue on monitoring while a running exam is green on the teacher card | §10.1.2, §10.1.7 | MATERIAL | FIXED (UI-SYSTEM-003 part 1): one `StatusBadge` primitive and one vocabulary of words and tones (`lib/status.ts`, §6) |
| M10 | loading, error and empty states | the older screens (student list, teacher list, proctor list, launch, exam workspace) use page-local state cards with generic titles ("Terjadi Kesalahan"); the newer screens use the shared Alert and a status line | §10.1.2, §10.1.6 | MATERIAL | FIXED for the lists and the newer screens (UI-SYSTEM-003 part 2): one page state pattern (`components/ui/page-state.tsx`); the full-screen states of the exam focus shell (launch, exam workspace) move with the shell to UI-SYSTEM-002 |
| M12 | teacher exam card at 768 px (found while verifying M9) | the five actions of a scheduled or ready exam run out of the card (by 7 px at 1280 px) | §10.1.9 | MATERIAL | FIXED (UI-SYSTEM-003 part 1): the action row wraps from 640 px; an E2E check keeps every action inside the card |
| M11 | exam lists across roles | the student and teacher lists use two page-local card styles (12 px radius with border; 8 px radius with shadow only); the proctor list shows its exams without cards at full width | §10.1.6 | MATERIAL | FIXED (UI-SYSTEM-003 part 3): one `ExamListCard` for the student, teacher and proctor lists |
| C1 | exam workspace stylesheet | 160 hard-coded colors, most equal to token values | §10.1.3 | COSMETIC / SAFE TO CONVERGE | UI-SYSTEM-005; the guard (§3) keeps the count from growing |
| C2 | launch screen, exam workspace, submit confirmation | page-local `.btn` buttons (bold) and a page-local modal instead of the shared Button and Dialog | §10.1.5 (the focus shell keeps the same controls) | COSMETIC / SAFE TO CONVERGE | UI-SYSTEM-002 (focus shell convergence), with the whole exam journey verified again |
| C3 | content width | 688, 752 and 960 px and full width on different pages | §10.1.5 | COSMETIC | UI-SYSTEM-002: width variants of the shell |
| C4 | metric cards | grey filled boxes on the teacher card, white bordered boxes on monitoring and results | §10.1.6 | COSMETIC | FIXED (UI-SYSTEM-003 part 3): one `Metric` box everywhere |
| C5 | scheduled exam card at 360 px | five stacked full-width actions | §10.1.9 | COSMETIC | FIXED (UI-SYSTEM-003 part 3): one `ActionGroup`, stacked below 640 px as the DesainPakeAI direction, a wrapping row above |
| C6 | typography | system font stack; the DesainPakeAI direction uses Inter, Geist Mono and Libre Baskerville | §10.1.8 | COSMETIC | UI-SYSTEM-005 (§4) |
| C7 | semantic palette and focus ring | success, warning, information and the focus ring differ from the DesainPakeAI values | §10.1.1 | COSMETIC | UI-SYSTEM-005 (§4) |

Clean in the audit: question import, question preview, participant monitoring and results (no axe finding), and the shared dialogs apart from M1.

After the fixes, axe reports no color-contrast, landmark, list or heading finding on the audited screens (see §5).

## 3. Automated guard

`frontend/web/src/__tests__/designSystemGuard.test.ts` runs with the web tests in CI:

1. every CSS variable a stylesheet or component uses is defined by the shared tokens;
2. hard-coded colors outside `styles/design-tokens.css` never grow: `styles/globals.css` 1 (the destructive foreground), `styles/workstation.css` 160, every other file 0; lower a ceiling when a file moves to tokens;
3. the text and action color pairs of the tokens keep 4.5:1 (primary and destructive actions, body and secondary text on the background and on the muted surface, and the success, warning, danger, information, neutral and active badge pairs);
4. no page stylesheet defines a badge, pill or chip class: statuses use the shared `StatusBadge` (the exam focus shell keeps its save state, timer and legend until UI-SYSTEM-002);
5. no page stylesheet defines state cards, state titles, loading lines or retry buttons: loading, failed, refused, empty and stale-data states use the shared page states (the exam focus shell keeps its full-screen states until UI-SYSTEM-002);
6. no page stylesheet defines a card, stat, metric, progress or actions class: exam cards, metric boxes and action groups use the shared primitives (the exam focus shell keeps its own until UI-SYSTEM-002).

Mutation-checked against a passing baseline: an undefined token, a new hard-coded color in a stylesheet and in a component, the old destructive red, a weaker secondary text and a workspace color moved back to a hard-coded value: each caught.

## 4. Token convergence proposal (UI-SYSTEM-005)

The DesainPakeAI intent is adapted into the shared tokens, never copied page by page (§10.1.12). Every pair must still pass the guard; where a DesainPakeAI value fails WCAG AA for text, a darker ink of the same hue is used.

| ELLIGBLE token | Today | Proposed | Check |
|---|---|---|---|
| primary action | `#000000`, hover `#262626` | ink `#08090a`, hover `#1b211e` | white text 19.9:1 |
| canvas (`--color-background`) | `#ffffff` | `#fefdfb`; surfaces stay white | body text `#121715` 17.8:1 |
| muted surface | `#f9f9fb` | `#faf8f5` | |
| text / secondary text | `#000000` / `#4e4e4e` | `#121715` / `#5e6965` | secondary 5.7:1 on white, 5.4:1 on the muted surface |
| border / strong border | `#e5e5e5` | `#ebe9e6` / `#cfcdca` | |
| focus ring | 2 px `#000000` | 2 px `#006b49` | 6.6:1 on white (3:1 needed) |
| brand | none | mint `#0c8c5e` for the brand mark, selected and active states only; as text `#08774f` | `#0c8c5e` is 4.26:1 on white, below AA for text |
| success | `#10b981` / `#ecfdf5` / ink `#064e3b` | positive `#16803a` / surface `#eaf7ee` | 4.55:1 on its surface |
| warning | `#f59e0b` / `#fffbeb` / ink `#92400e` | `#9a5a00` / `#fff4dd` | 5.0:1 |
| danger | `#b42318` (done) / `#fef2f2` / ink `#991b1b` | `#b42318` / `#fdecea` | 5.75:1 |
| information | `#3b82f6` / `#eff6ff` / ink `#1e40af` | ink `#1569a0` on `#eaf5fc` (the DesainPakeAI `#1878b8` is 4.29:1 there) | 5.3:1 |
| radii | 4 / 8 / 12 / 16 px | compact 4, control 6, card 12, panel 20 px | |
| motion | 0.2 s | 150 ms and 300 ms, `cubic-bezier(0.22, 1, 0.36, 1)`; reduced motion honoured | |
| typography | system stack, 16 px body | Inter for the interface, Geist Mono for ELLIGBLE IDs, codes and timers, Libre Baskerville for display headings only; all self-hosted (no third-party font request: student privacy and offline exams), `font-display: swap`; 16 px body and inputs on student screens (legibility, no zoom on phones), the 14 px DesainPakeAI body only for dense staff tables | |

Implementation order: tokens and fonts together behind the guard, then the exam workspace palette (C1), each step rendered at 360, 768 and 1280 px with the full browser journey; the font files count toward WEB-001 (bundle size).

## 5. Verification

| Check | Result |
|---|---|
| DesainPakeAI | authenticated; project `b5a22aa4-...`; revision `sha256-5d0d7779...` inspected |
| DesainPakeAI at the checkpoint | the stored CLI key resolved to another project, so the approved project was not inspected again; nothing in this record comes from the other project (plan §10) |
| axe-core 4.13 before the fixes (1280 and 360 px) | color contrast on the teacher list and its dialogs (every destructive button), the exam workspace and the submit confirmation; no main landmark and content outside landmarks on the student, teacher and proctor lists; a second banner and an invalid list on the student list; no level-one heading on sign-in |
| axe-core 4.13 after the fixes (1280, 768 and 360 px) | no violation on any of the 14 audited screens at any of the three widths, each checked once the screen had settled (plan §11) |
| guard | 3 checks, 6 of 6 mutations caught; the fourth check (UI-SYSTEM-003 part 1) with 9 of 9 mutations of the badge work caught; the fifth (part 2) with 8 of 8 mutations of the page states caught |

## 6. Status words and tones (UI-SYSTEM-003)

One state, one word and one tone for every role; the word always says what the tone shows (§10.1.7). The badge is a pill, as the DesainPakeAI status chip (revision `sha256-5d0d7779...`).

| Tone | Meaning | States |
|---|---|---|
| active | running now | "Berlangsung" (exam), "Mengerjakan" (monitoring), "Sedang mengerjakan" (results) |
| success | done as intended | "Dikumpulkan", "Hasil Final", "Sudah dikumpulkan" |
| warning | needs attention, not an error | "Dijeda", "Dikunci" |
| danger | failed or over | "Waktu habis" (FRONTEND_DESIGN_SYSTEM §27) |
| info | upcoming | "Siap Dibuka" |
| neutral | at rest, or metadata | "Terjadwal", "Diakhiri", "Diarsipkan", "Dibatalkan", "Belum mulai", "Tidak mengerjakan", "Dikumpulkan otomatis", "Ruang: ..." |
