**Status:** LOCKED
**Version:** 1.1.0
**Canonical:** YES
**Depends On:** DEC-036, DEC-037, DEC-038, DEC-039, DEC-040, FRONTEND_DESIGN_SYSTEM.md, ELLIGBLE_WARM_MONOCHROME_VISUAL_FOUNDATION.md, UI_CONTENT_AND_COPY_STYLE.md, FRONTEND_AGENT_SKILL_STACK.md, 04.01_SECURE_ASSESSMENT.md
**Used By:** Secure Assessment frontend implementations, BU-082, future assessment Build Units
**Last Reviewed:** 2026-09-13

# ELLIGBLE Secure Assessment Exam Focus Workspace

## 1. Purpose and Concept

The **ELLIGBLE Secure Assessment Exam Focus Workspace** is the canonical active-exam student environment. Its purpose is to provide a distinctive, calm, informative, responsive, and high-trust digital exam workspace that is recognizably ELLIGBLE while rigorously eliminating decorative noise, unnecessary chrome, and fabricated state.

### What It Is
- **An Exam Workspace:** A dedicated, single-purpose testing surface engineered for focus, stamina, and operational clarity under timed academic conditions.
- **Single-Focus:** All secondary navigation, ambient dashboard widgets, and institutional administrative overhead are suppressed during an active session.
- **Mobile-First:** Authored from a 360px minimum width baseline with native-feeling touch targets, dynamic viewport height (`100dvh`), and safe-area insets, progressing seamlessly to tablet and desktop viewports.
- **High-Stakes Capable:** Resilient against network instability, viewport resizing, and device interruptions with zero lost answers and server-authoritative timekeeping.
- **Calm & Institution-Grade:** Built with clean contrast, solid institutional tokens, and zero generic template artifacts ("AI slop").

### What It Is NOT
- It is NOT a generic multi-step form or survey.
- It is NOT an operational or administrative dashboard.
- It is NOT a marketing, landing, or portal page.
- It is NOT an admin or proctor console.
- It is NOT an AI-generated card stack with arbitrary decorative gradients, glowing borders, or floating aesthetic elements.

---

## 2. Terminology and Conceptual Boundaries

To maintain rigorous domain separation across ELLIGBLE, the following conceptual boundaries are strictly enforced:

- **Subject (Mata Pelajaran):** The primary academic context of an assessment (e.g. Matematika, Bahasa Indonesia, Fisika). This is the preferred student-facing academic identifier.
- **Exam Room (Ruang Ujian):** An operational Secure Assessment grouping used by proctors and administrators to supervise concurrent sessions (e.g. Ruang 03, Lab Komputer A). An Exam Room is an operational container; it is **NOT** a Rombel (Rombongan Belajar), NOT a class identity, NOT an academic enrollment, and NOT a Subject. A student participates in an Exam Room without altering their Academic Core truth.
- **Exam Title (Judul Ujian):** The administrative designation assigned by teachers or staff during exam authoring (e.g. Penilaian Akhir Semester Ganjil 2026/2027). While administratively valuable in scheduling and reporting lists, **Exam Title is NOT mandatory student-facing active-exam chrome.**
- **Generic Fallback Prohibition:** The placeholder heading "Ruang Ujian Aman" was an early bootstrap placeholder. It is **NOT** the final primary identity of the workspace and must not be used as an arbitrary fallback.

---

## 3. Active Exam Information Hierarchy

Per Owner direction and **DEC-040**, the active mobile exam is strictly **CONTENT-FIRST**. A large application header is prohibited. The student's cognitive focus belongs to the question content and responses. Information elements are prioritized in descending operational order:

1. **Primary Assessment Context:** Authoritative Subject; otherwise authoritative assigned Exam Room; omitted if neither exists.
2. **Question Progress:** Current question ordinal relative to total questions (e.g. "Soal 3 dari 40").
3. **Authoritative Remaining Time:** Server-governed countdown timer rendered in monospace tabular figures (`tabular-nums`) with optional minimal clock outline.
4. **Compact Honest Save State:** Real-time save feedback reflecting verified server state ("Belum dijawab", "Menyimpan...", "Tersimpan", "Gagal menyimpan") housed exclusively in the compact upper information area.
5. **Media / Stimulus (if present):** Visual diagrams, charts, reading passages, or tables.
6. **Question Prompt:** The core question text.
7. **Structured Answer Choices:** The interactive response options with immediate green selection feedback.
8. **Command Dock:** Direct tactile action bar ("Sebelumnya", "Daftar Soal", "Berikutnya", "Selesai") anchored at the bottom.

*The question prompt, stimulus media, and answer choices must visually dominate the viewport.*

---

## 4. Primary Assessment Context Resolution

In accordance with Owner decision DEC-039, the active exam header resolves exactly **ONE** primary context label according to the following strict waterfall:

```text
[ Authoritative Subject Available? ]
       │
       ├─► YES: Display Subject (e.g. "MATEMATIKA")
       │
       └─► NO: [ Authoritative Exam Room Available? ]
                     │
                     ├─► YES: Display Exam Room (e.g. "Ruang 03")
                     │
                     └─► NO: OMIT PRIMARY CONTEXT LABEL ENTIRELY
```

### Truth in Presentation Rules
- **No Fabricated Data:** If neither Subject nor Exam Room is exposed by the authoritative runtime data contract, the primary label must be omitted. Do not invent placeholder text, mock subjects, or synthetic room numbers.
- **No Generic Heading Fallback:** Do not fall back to "Ruang Ujian Aman" or hardcoded sample strings.
- **Single Context String:** Display either Subject or Exam Room, never a cluttered composite string.

---

## 5. Active-Exam Distraction Control & Mobile Information Composition

To maximize cognitive focus during timed examinations, the workspace suppresses all non-essential user-interface elements:
- No global platform navigation, app bars, or side drawers.
- No student user avatar, profile badge, or personal photo.
- No marketing banners, announcements, or school logos that consume vertical space.
- No social widgets, messaging alerts, or notification centers.
- No floating help widgets, feedback buttons, or ambient animations.
- The question stimulus and response options must remain the visually dominant elements of the viewport.

### Mobile Upper Information Area Composition
The intended compact upper information composition is structured conceptually as:
```text
[ Authoritative Subject/Room if available ]        [ Remaining Time ]
[ Question Progress ]                              [ Save State ]
```
**Compaction & Non-Reservation Rule:** When Subject/Room is unavailable (as in the current BU-082 data contract), the interface must **NOT** preserve blank space for it. The information block must compact and reflow responsively.

### Elimination of Redundant Displays
- **DO NOT show the same countdown timer twice.**
- **DO NOT show save status twice.**
- **DO NOT show both "Soal 1 dari 12" and "Soal Nomor 1"** when a single clear representation communicates the position.
- Maximize information density without visual clutter.

---

## 6. Media / Stimulus Presentation Guidance

For questions featuring supporting stimulus material (images, diagrams, tables, passages):
- **Mobile Content Ordering:**
  1. Compact upper context / progress / status
  2. Image / diagram / table stimulus (IF ACTUALLY PRESENT)
  3. Question prompt
  4. Answer options
- **Zero Empty Placeholders:** No empty image box or placeholder icon may be rendered when stimulus media does not exist.
- **Responsive Constraints:** Media must fit available width, preserve intrinsic aspect ratio, avoid horizontal overflow, and remain readable without displacing navigation irrecoverably.
- **Scope Rule:** This is layout composition guidance; it does not fabricate backend question schema capabilities beyond the actual data contract.

---

## 7. Selected Answer Treatment (Owner Lock)

Owner explicitly requires immediate, unambiguous feedback for student input:
- **Immediate Green Feedback:** When a student taps or clicks an option, that option becomes **GREEN IMMEDIATELY**.
- **Meaning of Green Selection:**
  ```text
  GREEN SELECTED OPTION  =  CURRENT STUDENT SELECTION
  ```
  It does **NOT** mean: *Server save completed*.
- **Restrained Semantic-Green Styling:**
  - Background: Pale green subtle tint (`#ECFDF5` / `--color-success-bg`).
  - Border: Refined green accent (`#10B981` / `--color-success-border`).
  - Indicator: Green radio checked circle.
  - Typography: High-contrast dark text (`#064E3B` or `#1F2937`).
  - Restraint: No saturated dark-green solid fill, no neon glow, no celebratory animations.
- **Single-Choice Rule:** Exactly one option in a single-choice question may appear selected at any time.
- **Dual Visual Encoding:** Communicated via radio checked state, distinct border, and surface tint (never color alone).

---

## 8. Honest Answer Save-State Principles (Owner Lock)

Student anxiety during digital examinations is minimized through clear, honest, and unambiguous feedback regarding their answers:
- **Separation from Selected Answer:** Save state is **STRICTLY SEPARATE** from selected-answer styling.
  - Do NOT place save status text ("Tersimpan", "Menyimpan...", "Gagal menyimpan") inside the answer option card.
  - Do NOT place the normal save-status block underneath the entire list of answer options.
  - Save state belongs exclusively in the **compact upper exam information area**.
- **Exact Semantic States:**
  - **"Belum dijawab":** Displayed when no option has been selected for the current question.
  - **"Menyimpan...":** Displayed immediately upon student input while the network mutation is in flight.
  - **"Tersimpan":** Displayed ONLY after the server returns an explicit 200/201 response with the matching `write_version`.
  - **"Gagal menyimpan":** Displayed with distinct high-contrast danger styling if the network mutation rejects or times out, accompanied by automatic retry capability.
- **Operational Sequence:**
  ```text
  Student selects Option B
  │
  ├─► Option B becomes GREEN immediately (Current Student Selection)
  │
  ├─► Upper Information Area shows "Menyimpan..."
  │
  ├─► Server returns 200 ACK with matching write_version
  │
  └─► Upper Information Area transitions to "Tersimpan"
  ```
  If save fails: Option B remains visibly green (the student's intended selection is preserved), while the upper information area displays high-contrast "Gagal menyimpan".
- **No Fake Sync:** Never display "Tersimpan" optimistically before HTTP acknowledgement is received.

---

## 9. Authoritative Timer Presentation

The countdown timer is a mission-critical component governed by server authority:
- **Server Authority:** The timer is initialized from and periodically reconciled with the server-authoritative remaining seconds (`expires_at` / `remaining_seconds`). The local client clock is never trusted as the source of truth.
- **Tabular Figures:** Rendered with `font-variant-numeric: tabular-nums` (using the monospace font token `--font-mono`) to prevent horizontal jitter as numbers tick down.
- **Visual Presentation:** Compact, prominent numeric value with optional minimal clock outline. Must NOT resemble an input box or clickable button.
- **Zero Duplicate Timers:** The authoritative countdown timer appears in exactly one place.
- **Urgency Transitions:**
  - Normal (> 5 minutes): Near-black / neutral tone.
  - Warning (<= 5 minutes): Subtle amber highlight (`--color-warning-text` / `#92400e`).
  - Critical (<= 1 minute): High-contrast red alert (`--color-danger-text` / `#991b1b`).
- **No Fake OS Time:** Displaying an ambient device clock or fake system time is strictly prohibited.

---

## 10. Device & Connectivity Information Restraint

- **Battery State:** Do NOT add persistent battery indicators merely for visual richness. Normal battery state displays nothing. Low-battery warnings may appear only when backed by reliable native APIs and explicitly authorized.
- **Connectivity State:** Normal connectivity displays nothing (suppress "Online", "Aman", "Sinkron"). Only exceptional disconnected or sync-recovery states appear, backed by verified runtime state. BU-082 must not fabricate connectivity confidence.

---

## 11. Progress Map Semantics and Accessibility

The Question Navigator (Progress Map) provides an overview of the examination:
- **States:**
  - `Current` (Sedang dikerjakan): Highlighted with black primary active border and indicator dot.
  - `Answered` (Sudah dijawab): Marked with subtle green background tint (`#ECFDF5`), green border, and checkmark (`✓`).
  - `Unanswered` (Belum dijawab): Clean light neutral outline (`#E5E5E5`), clearly distinguishable from answered items.
- **Dual Visual Encoding:** State must never be communicated through color alone. Every button must include accessible text (`aria-label`) and distinct shape/icon markers.
- **Direct Navigation:** Clicking or tapping any question button immediately focuses and loads that question.

---

## 12. Responsive Composition

The workspace adapts cleanly between desktop workstations and compact mobile viewports in the unified Warm Monochrome visual grammar.

### Desktop Composition (>= 1024px)
- **Split-Pane Layout:**
  - Left Pane (~280px to 320px): Question Navigator and progress summary.
  - Right Pane (Remaining flex width, capped at `max-w-assessment` / 1200px): Primary Question & Answer focus workspace.
- **Visual Character:** Clean white surfaces, black primary buttons, subtle `#E5E5E5` borders. Progress map feels refined and instrumental, not a heavy calculator grid.
- **Sticky Actions:** Navigation controls ("Sebelumnya", "Berikutnya", "Selesai") anchored clearly below the active question card.

### Mobile Composition (< 1024px)
- **Fullscreen Focus:** Suppresses the permanent navigator card to give 100% of vertical height to the active question stimulus and response options.
- **Compact Sticky Top Bar:** Houses primary assessment context (when available), question progress, authoritative timer, and compact save state.
- **Bottom Command Dock:** Viewport-bottom sticky bar containing a symmetric single row of primary actions:
  - `Sebelumnya` (Low emphasis, ghost / subtle border)
  - `Daftar Soal` (Navigation trigger, white surface, subtle border)
  - `Berikutnya` (Clear navigation, white surface, subtle border)
  - `Selesai` (High-emphasis action, black primary surface, white text)
- **Component Grammar:** Minimal outline icon + short text label. Previous and next controls must not be icon-only.
- **Symmetric Touch Targets:** All 4 action buttons share balanced proportions in a single row with >= 44px (recommended 48px) minimum touch target height. Buttons must not wrap into a second row at canonical 360px baseline.
- **Bottom Sheet Drawer:** The Question Navigator opens as an accessible bottom sheet dialog (`role="dialog"`, `aria-modal="true"`, Escape key dismiss, focus trapped, focus restored on close). Fixed header with summary numbers leading and minimal outline close icon (`✕`); scrollable number grid; fixed footer with primary black "Selesai" button.

### Tested Viewport Matrix
The workspace must be visually verified across the full representative device spectrum:
- 320 x 568 (iPhone SE / Smallest supported mobile stress)
- 360 x 640 (Canonical minimum mobile baseline)
- 375 x 667 (iPhone 8 / SE2)
- 390 x 844 (iPhone 12/13/14)
- 412 x 915 (Pixel / Modern Android standard)
- 480 x 800 (Wide mobile)
- 768 x 1024 (Tablet portrait / iPad)
- 820 x 1180 (iPad Air portrait)
- 1024 x 768 (Tablet landscape / Small laptop)
- 1280 x 720 (HD standard desktop)
- 1366 x 768 (Common institutional laptop)
- 1440 x 900 (Widescreen laptop)
- 1536 x 864 (Scaled desktop monitor)
- 1920 x 1080 (Full HD desktop monitor)

---

## 13. Data-Contract Truth & Successor Dependencies

The present client data contract must remain honest regarding its current backend capabilities.

### Current BU-082 Contract Limitations
The existing BU-082 browser-facing assessment contracts (`AssessmentQuestionState`, `AssessmentSessionResponse`, `types/assessment.ts`) do NOT yet expose:
1. Subject display label.
2. Exam Room display label.
3. Reliable network connectivity / offline recovery model.
4. Server-persisted "Ragu-ragu / Tandai" (Mark for review) flag.

### Strict Non-Fabrication Rule
Because BU-082 is strictly prohibited from mutating backend schemas, APIs, or contracts:
- BU-082 must NOT fabricate synthetic subject or room titles.
- BU-082 must NOT display synthetic "Online" / "Aman" connectivity badges without verified runtime event backing.
- BU-082 must NOT implement an ephemeral, non-persisted "Ragu-ragu" feature that gives students false confidence across reloads.

### Successor Capability Dependencies
1. **Bounded Assessment Context Projection:** A future product-facing Build Unit may enhance the session readback payload to include verified `subject_name` and `exam_room_name`.
2. **Persisted Ragu-ragu / Tandai:** Discovery D04 establishes mark-for-review as a baseline requirement. It requires an authoritative schema/API persistence seam in a future Build Unit.
3. **Reliable Connectivity Monitor:** Comprehensive navigator status and heartbeat telemetry will be introduced through a dedicated connectivity infrastructure unit.
4. **Registration Status:** The next Build Unit remains **NOT YET REGISTERED**.

---

## 14. Accessibility and Content Style Standards

- **WCAG 2.1 AA Compliance:** Minimum 4.5:1 text contrast for body copy; 3:1 for graphical UI elements and large text.
- **Keyboard Operability:** Full keyboard flow using `Tab`, `Shift+Tab`, `Arrow` keys for option selection, and `Escape` for sheet closure. Visible 2px focus ring (`--border-focus`) on all interactive targets.
- **Language & Typography:** UI copy uses Bahasa Indonesia exclusively.
- **Em Dash Prohibition:** The em dash character ("—") is strictly prohibited in all user-facing UI copy per platform governance.

---

## 15. Cross-References

- [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md): Platform-wide tokens, spacing scale, typography, and anti-AI-slop rules.
- [ELLIGBLE_WARM_MONOCHROME_VISUAL_FOUNDATION.md](ELLIGBLE_WARM_MONOCHROME_VISUAL_FOUNDATION.md): Canonical platform visual foundation and DEC-040 specifications.
- [UI_CONTENT_AND_COPY_STYLE.md](UI_CONTENT_AND_COPY_STYLE.md): Canonical Indonesian terminology and copy guidelines.
- [FRONTEND_AGENT_SKILL_STACK.md](FRONTEND_AGENT_SKILL_STACK.md): Canonical engineering and design agent skills.
- [DECISION_LOG.md](../decisions/DECISION_LOG.md): DEC-039 and DEC-040 authoritative decision records.
