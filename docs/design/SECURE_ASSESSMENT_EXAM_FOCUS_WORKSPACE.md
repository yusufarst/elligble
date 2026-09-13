**Status:** LOCKED
**Version:** 1.0.0
**Canonical:** YES
**Depends On:** DEC-036, DEC-037, DEC-038, DEC-039, FRONTEND_DESIGN_SYSTEM.md, UI_CONTENT_AND_COPY_STYLE.md, FRONTEND_AGENT_SKILL_STACK.md, 04.01_SECURE_ASSESSMENT.md
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

Visual hierarchy within the active workspace directly governs student focus and operational confidence. Information elements are prioritized in descending order:

1. **Primary Assessment Context:** Authoritative Subject; otherwise authoritative assigned Exam Room; omitted if neither exists.
2. **Question Progress:** Current question ordinal relative to total questions (e.g. "Soal 3 dari 40").
3. **Authoritative Remaining Time:** Server-governed countdown timer rendered in tabular figures (`tabular-nums`) with clear semantic labeling ("Sisa waktu").
4. **Reliable Connection / Recovery State:** Surfaced only when the browser runtime possesses authoritative, verified connectivity or sync status.
5. **Question Focus:** Question number badge, stimulus passage / prompt content, and structured answer options.
6. **Honest Answer Confidence:** Real-time save feedback reflecting verified server state ("Belum dijawab", "Menyimpan...", "Tersimpan", "Gagal menyimpan").
7. **Question Progress Map:** Navigable matrix of question states (current, answered, unanswered).
8. **Command Dock:** Direct tactile action bar ("Sebelumnya", "Daftar Soal", "Berikutnya", "Selesai").

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

## 5. Active-Exam Distraction Control

To maximize cognitive focus during timed examinations, the workspace suppresses all non-essential user-interface elements:
- No global platform navigation, app bars, or side drawers.
- No student user avatar, profile badge, or personal photo.
- No marketing banners, announcements, or school logos that consume vertical space.
- No social widgets, messaging alerts, or notification centers.
- No floating help widgets, feedback buttons, or ambient animations.
- The question stimulus and response options must remain the visually dominant elements of the viewport.

---

## 6. Authoritative Timer Presentation

The countdown timer is a mission-critical component governed by server authority:
- **Server Authority:** The timer is initialized from and periodically reconciled with the server-authoritative remaining seconds (`expires_at` / `remaining_seconds`). The local client clock is never trusted as the source of truth.
- **Tabular Figures:** Rendered with `font-variant-numeric: tabular-nums` (using the monospace font token `--font-mono`) to prevent horizontal jitter as numbers tick down.
- **Visual Hierarchy:** Composed of a small semantic label ("Sisa waktu") paired with a prominent, readable time display (`HH:MM:SS` or `MM:SS`).
- **Urgency Transitions:** Follows canonical Design System thresholds:
  - Normal (> 5 minutes): Neutral / Navy institutional tone.
  - Warning (<= 5 minutes): Subtle amber highlight (`--color-warning-text`).
  - Critical (<= 1 minute): High-contrast red alert (`--color-danger-text`).
- **No Fake OS Time:** Displaying an ambient device clock or battery icon is prohibited unless authoritative native integration is explicitly authorized.

---

## 7. Honest Answer Save-State Principles

Student anxiety during digital examinations is minimized through clear, honest, and unambiguous feedback regarding their answers:
- **"Belum dijawab":** Displayed when no option has been selected for the current question.
- **"Menyimpan...":** Displayed immediately upon student input while the network mutation is in flight.
- **"Tersimpan":** Displayed ONLY after the server returns an explicit 200/201 response with the matching `write_version`.
- **"Gagal menyimpan":** Displayed with distinct high-contrast danger styling if the network mutation rejects or times out, accompanied by automatic retry capability.
- **No Fake Sync:** Never display "Tersimpan" optimistically before HTTP acknowledgement is received.

---

## 8. Progress Map Semantics and Accessibility

The Question Navigator (Progress Map) provides an overview of the examination:
- **States:**
  - `Current` (Sedang dikerjakan): Highlighted with primary active border and indicator dot.
  - `Answered` (Sudah dijawab): Marked with distinct background tint and checkmark (`✓`).
  - `Unanswered` (Belum dijawab): Neutral outline, clearly distinguishable from answered items.
- **Dual Visual Encoding:** State must never be communicated through color alone. Every button must include accessible text (`aria-label`) and distinct shape/icon markers.
- **Direct Navigation:** Clicking or tapping any question button immediately focuses and loads that question.

---

## 9. Responsive Composition

The workspace adapts cleanly between desktop workstations and compact mobile viewports without sacrificing capabilities.

### Desktop Composition (>= 1024px)
- **Split-Pane Layout:**
  - Left Pane (~280px to 320px): Question Navigator and progress summary.
  - Right Pane (Remaining flex width, capped at `max-w-assessment` / 1200px): Primary Question & Answer focus workspace.
- **Sticky Actions:** Navigation controls ("Sebelumnya", "Berikutnya", "Selesai") anchored clearly below the active question card.

### Mobile Composition (< 1024px)
- **Fullscreen Focus:** Suppresses the permanent navigator card to give 100% of vertical height to the active question stimulus and response options.
- **Sticky Top Bar:** Compact header containing primary assessment context, question progress, and countdown timer.
- **Bottom Command Dock:** Viewport-bottom sticky bar containing a symmetric single row of primary actions:
  - `Sebelumnya` (Previous question)
  - `Daftar Soal` (Triggers Question Navigator bottom sheet)
  - `Berikutnya` (Next question)
  - `Selesai` (Triggers high-stakes submission modal)
- **Symmetric Touch Targets:** All 4 action buttons share equal width in a single row with 48px minimum height. Buttons must not wrap into a second row under supported widths.
- **Bottom Sheet Drawer:** The Question Navigator opens as an accessible bottom sheet dialog (`role="dialog"`, `aria-modal="true"`, Escape key dismiss, focus trapped, focus restored on close).

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

## 10. Data-Contract Truth & Successor Dependencies

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

## 11. Accessibility and Content Style Standards

- **WCAG 2.1 AA Compliance:** Minimum 4.5:1 text contrast for body copy; 3:1 for graphical UI elements and large text.
- **Keyboard Operability:** Full keyboard flow using `Tab`, `Shift+Tab`, `Arrow` keys for option selection, and `Escape` for sheet closure. Visible 2px focus ring (`--border-focus`) on all interactive targets.
- **Language & Typography:** UI copy uses Bahasa Indonesia exclusively.
- **Em Dash Prohibition:** The em dash character ("—") is strictly prohibited in all user-facing UI copy per platform governance.

---

## 12. Cross-References

- [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md): Platform-wide tokens, spacing scale, typography, and anti-AI-slop rules.
- [UI_CONTENT_AND_COPY_STYLE.md](UI_CONTENT_AND_COPY_STYLE.md): Canonical Indonesian terminology and copy guidelines.
- [FRONTEND_AGENT_SKILL_STACK.md](FRONTEND_AGENT_SKILL_STACK.md): Canonical engineering and design agent skills.
- [DECISION_LOG.md](../decisions/DECISION_LOG.md): DEC-039 authoritative decision record.
