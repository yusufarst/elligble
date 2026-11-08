# ASSESS-QUESTION-004 — Matching

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 all eight formats; HIGH risk; R13, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation and rendered review (§11); DEC-048** |
| Objective | Deliver matching ("Menjodohkan") end to end on the versioned foundation: author it through the v2 import, preview it as a teacher, answer it as a Student with local recovery, then submit and score all-or-nothing |
| Owner decisions | O02-1, O02-2, O02-5 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); A01; **D1 (partial matching answers), decided by the Owner on 2026-11-08 (§4A.1)**. Reviewer: the standing Owner-designated read-only subagent reviewer |
| Execution authority | DEC-048 (00.13). The internal dependency ASSESS-QUESTION-001 is DONE / MERGED. ASSESS-QUESTION-003 is DONE / MERGED: PR #28 landed as main b7d02ee. Its post-merge CI #187 failed in firefox-1280 on a direct reload in the 99b spec, and the Owner-authorized test-only fix landed as PR #29, main e5d0b3f6aaa47ef4a36704f1526d26a02a28b216, post-merge CI #191 attempt 1 eight SUCCESS ([record §13](ASSESS-QUESTION-003.md)). Its v2 import, client value pattern and E2E harness are reused, including the Firefox-safe `reloadPage()`/`open()` helpers. O09 rests on the approved P5 content |
| Base and branch | main e5d0b3f; branch task/assess-question-004-matching, worktree `C:\Projects\ELLIGBLE-question-004` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN ASSESS-QUESTION-004/§4/§8](../TASK_PLAN.md), [P2 row R13](../CBT_DOMAIN_RULES_SPECIFICATION.md), [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md), [ASSESS-QUESTION-002 §4A](ASSESS-QUESTION-002.md), [ASSESS-QUESTION-003 §4/§4A/§12](ASSESS-QUESTION-003.md), D04.3-61/62 (LOCKED). No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused unchanged:**
- the registry and its refusal contract;
- the v2 template, which grows by appending columns only (ASSESS-QUESTION-002 §4A.5);
- the client canonical value string and the unsupported-content state;
- the save route, delivery, resume, readiness, finalization and composite rule;
- the exam screen's field and status patterns;
- the `99`/`99b` E2E harness pattern.

**Gaps closed (matching only):**
- there is no descriptor;
- the v2 import cannot carry left and right items;
- preview, monitoring and client do not handle it.

**Excluded:**
- the other types (005–008), the bank, media and convergence (009, 010, ASSESS-MEDIA-001);
- partial or negative credit;
- per-Student shuffling;
- report detail (RESULT-004);
- any change to v1, multiple-response or true/false behaviour.

## 3. Settled inputs and engineering readings

**Settled:**
- **O02-5:** 2–10 left items. The right list has as many items as the left list plus up to 2 distractors. Strictly one-to-one: each right item is used at most once. An answer is complete only when every left item is paired. All-or-nothing scoring.
- **O02-1:** an exact match earns maxScore, anything else 0. Unanswered scores 0. maxScore is > 0 and ≤ 1000, with 2 decimals.
- **O02-2:** for new types an empty value is an accepted, versioned write that counts as UNANSWERED and is shown as "Belum dijawab".
- **O02-12:** v2 adds type-specific columns.
- **P2 R13:** stable left/right IDs; no duplicate left mapping; a reusable-target policy; reordered stored pairs; recovery.

Engineering readings below are recorded for review, not decided as policy:
- **E1, a partial answer.** **Superseded:** the review found this an Owner decision (F1). The Owner decided it as D1, and §4A.1 governs.
- **E2, the reusable-target policy.** No right item may be reused: this is O02-5's strict one-to-one rule. The control disables, in every other left item's list, a right item that is already used.
- **E3, right-item order.** The Student sees the right items in authored order (A, B, C…). This is the same as PG, where the teacher's letter choice decides where the key sits. There is no shuffle.
- **E4, the type code.** The type code is `MJ` (menjodohkan), next to PG, PGK and BS.

## 4. Contract

### 4.1 Content, answer and score (`question-types/matching.ts`, new)

- **Key and rule:** key `2:MATCHING`, rule `MATCHING_EXACT_PAIRS_V1`, registered in the production registry.
- **Content:** `{schemaVersion: 2, questionType: 'MATCHING', prompt (meaningful), leftItems, rightItems, correctPairs, maxScore > 0 finite}`. Extra keys are allowed, as in v1.
  - `leftItems`: 2–10 entries of `{id, content}`. Ids are unique non-blank strings; content is meaningful.
  - `rightItems`: between `leftItems.length` and `leftItems.length + 2` entries, with the same item rules. Ids are unique across both lists.
  - `correctPairs`: exactly one `{leftId, rightId}` per left item, with known ids and no repeated `rightId`.
- **Student view:** `{schemaVersion: 2, questionType: 'MATCHING', prompt, leftItems, rightItems}`, each item as `{id, content}`, in stored order. No key and no score.
- **Answer:** an object whose only key is `pairs`. `pairs` is an array of 0 to `leftItems.length` objects, each with exactly the keys `leftId` and `rightId` as strings.
  - Every id must be known on its side.
  - No `leftId` and no `rightId` may repeat.
  - Anything else gets 400 `invalid_answer_payload`.
  - `allowsEmpty: true`: `{pairs: []}` is empty.
  - The order of stored pairs carries no meaning.
- **Score:**
  - No answer, `pairs: []`, or a stored value that is not a valid answer gives UNANSWERED and 0.
  - Every left item paired, with each pair in `correctPairs`, gives CORRECT and maxScore.
  - Otherwise, including an incomplete answer (E1), it gives INCORRECT and 0.
- **Monitoring:** `pairs: []` is not counted as answered, as for `selectedOptionIds: []`.

### 4.2 Import (v2, type `MJ`)

**Extended v2 header.** It is the existing ten columns followed by `left_1`…`left_10` and `right_a`…`right_l`, 32 columns in all.
- The ten-column v2 header stays valid; so does v1.
- Template name `elligble-questions-v2`.
- A row has exactly as many cells as its header, after the existing trailing-empty trim.
- No migration: the 0060 CHECK allows v2.

**`MJ` rows.**
- The option cells `option_a` to `option_e` must be empty; otherwise `options_not_allowed` with `type: 'MJ'`.
- In a ten-column file there are no item columns, so an MJ row gets `columns_missing`.
- **Left items** are filled in order from `left_1`, with 2–10 of them and no gap; otherwise `matching_items_invalid` with `side: 'left'`.
- **Right items** are filled in order from `right_a`, numbering between the left count and the left count + 2, with no gap; otherwise `matching_items_invalid` with `side: 'right'`.
- **Duplicates.** Left texts must differ from each other, and right texts from each other. The comparison is case-insensitive with spaces collapsed, as for options; otherwise `items_duplicate` with `side`.
- **`correct`** lists one right letter per left item, in left order. Letters are separated by commas and/or spaces and are case-insensitive, for example `B,C,A`.
  - A wrong count, a letter that is not a filled right item, or another character gives `correct_invalid` with `type: 'MJ'`.
  - A repeated letter gives `correct_duplicate` with `type: 'MJ'`.
- **Score** is checked as in v2.
- **Check order:** number → type → prompt → `options_not_allowed` → `columns_missing` → left items → right items → `items_duplicate` → correct → score.

**PG, PGK and BS rows** in an extended file keep their rules. Their 22 item cells must be empty; otherwise `items_not_allowed`. Their problem shapes are otherwise unchanged, and every existing BS/PG/PGK shape keeps no `type` field except where ASSESS-QUESTION-003 already added one.

**Builder.** `buildMatchingFrozenContent` gives each left and right item a new option-style id and builds `correctPairs` from the letters. `buildImportedFrozenContent` dispatches MJ to it, so the operator CLI follows through the same builder.

**Wording (frozen).** Teacher in Bahasa Indonesia; operator in English.

| Code | Teacher | Operator |
|---|---|---|
| `type_invalid` | "tipe soal harus PG, PGK, BS atau MJ." | `"type" must be PG (single answer), BS (true/false), PGK (multiple answers) or MJ (matching)` |
| `options_not_allowed`, MJ | "soal Menjodohkan (MJ) tidak memakai kolom pilihan; kosongkan option_a sampai option_e." | `options must be empty for MJ` |
| `columns_missing` | "soal Menjodohkan (MJ) memerlukan kolom left_1 sampai left_10 dan right_a sampai right_l. Unduh templat terbaru lalu salin soal Anda ke dalamnya." | `MJ needs the v2 header with left_1..left_10 and right_a..right_l` |
| `matching_items_invalid`, left | "soal MJ memerlukan 2 sampai 10 pernyataan kiri, diisi berurutan mulai left_1." | `MJ needs 2 to 10 left items, filled in order from left_1` |
| `matching_items_invalid`, right | "soal MJ memerlukan pasangan kanan sebanyak pernyataan kiri, ditambah paling banyak 2 pengecoh, diisi berurutan mulai right_a." | `MJ needs as many right items as left items, plus at most 2, filled in order from right_a` |
| `items_duplicate`, left/right | "pernyataan kiri tidak boleh sama satu sama lain." / "pasangan kanan tidak boleh sama satu sama lain." | `left items must differ from each other` / `right items must differ from each other` |
| `correct_invalid`, MJ | "kunci jawaban MJ adalah huruf pasangan kanan untuk setiap pernyataan kiri secara berurutan, misalnya B,C,A." | `"correct" for MJ must list one right letter per left item, in order (for example B,C,A)` |
| `correct_duplicate`, MJ | "setiap pasangan kanan hanya boleh dipakai sekali dalam kunci jawaban MJ." | `"correct" for MJ uses a right letter more than once` |
| `items_not_allowed` | "kolom left_1 sampai right_l hanya untuk soal MJ; kosongkan untuk soal PG, PGK atau BS." | `left and right item columns are only for MJ` |
| `header_invalid` | Names the extended header as well: "…, atau no;type;prompt;option_a sampai option_e;correct;score;left_1 sampai left_10;right_a sampai right_l)…" | Lists the third header |

BS keeps its existing `options_not_allowed` shape `{code, line}` and wording; `type: 'MJ'` is added only for MJ.

**Template.** "Unduh Templat CSV" now uses the extended header. It has the PG, PGK and BS rows with empty item cells, plus one MJ example of 3 left items, 4 right items and the key `B,C,A`.

**Page copy (the lesson of ASSESS-QUESTION-003 B1).**
- Intro: "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK), benar/salah (BS) atau menjodohkan (MJ) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan."
- Card instruction: "Satu baris per soal: nomor, tipe (PG, PGK, BS atau MJ), teks soal, pilihan A sampai E (kosong untuk BS dan MJ), kunci jawaban (satu huruf untuk PG; satu sampai lima huruf untuk PGK, misalnya A,C; B atau S untuk BS; untuk MJ huruf pasangan kanan setiap pernyataan kiri secara berurutan, misalnya B,C,A) dan skor, lalu khusus MJ pernyataan kiri (left_1 sampai left_10) dan pasangan kanan (right_a sampai right_l)."

**Import preview item for MJ:** `{type: 'MJ', options: [], leftItems: string[], rightItems: string[], correctLetters: string[] (one per left item, in order), correct: 'B, C, A'}`.
- Label: "Menjodohkan".
- Each left item is shown with its key right item ("B. …") and "Kunci jawaban", in the existing success tint.
- The right items, A, B, C…, are listed under "Pasangan kanan".

### 4.3 Teacher preview

A valid MJ item is `{questionType: 'MATCHING', leftItems: [{id, content}], rightItems: [{id, content}], correctPairs: [{leftId, rightId}], correctOptionId: null, correctOptionIds: null, options: [], maxScore, valid: true}`.
- v1, MR and TF items never carry the matching fields.
- Invalid MJ content falls through to the existing invalid shape.

The view shows the prompt and a local try-out of the Student control. On request it shows the key: each left item with its right item and "Kunci jawaban".

### 4.4 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:MATCHING`, so the header declares four keys.
- **Canonical value:** the JSON array of `[leftId, rightId]` pairs, sorted by `leftId` in UTF-16 code-unit order. `"[]"` means no pair.
  - `answerValueOf` maps `{pairs}` to that string.
  - `pairsOf(value)` reads it back and returns null unless the value is canonical with unique left and right ids.
  - The adapter builds `{pairs: [{leftId, rightId}…]}` only from a canonical value; anything else is refused locally as `rejected` / `invalid_answer_payload`.
  - `isAnsweredValue` is true unless the value is `"[]"`.
- **Control (`MatchingAnswer`):**
  - a lettered list "Pasangan kanan" (A. …) keeps long right items readable;
  - each left item is numbered with its text and has a native select, labelled "Pasangan untuk pernyataan N";
  - the first choice of each select is "Pilih pasangan", which unpairs, followed by "A. …" and so on;
  - a right item used by another left item is disabled there, with "(sudah dipakai)";
  - a polite status follows §4A.1: "Belum lengkap: N dari M pernyataan dipasangkan." or "Semua pernyataan sudah dipasangkan.", and nothing when no pair is chosen (the save-state area then reads "Belum dijawab");
  - each select is at least 48 px high and shows the shared focus ring;
  - read-only during pause and lock; nothing preselected.
- **Exam screen:** renders by `questionType`. v1, multiple response and true/false are unchanged.
- **`StudentSafeQuestion`:** gains optional `leftItems` and `rightItems`. `options` stays required (ASSESS-QUESTION-003 §4A.6); the MJ view has none at runtime.

### 4.5 Invariants

- No new route, lock order, migration or authority.
- v1, multiple-response and true/false content, answers, views, scoring and results are unchanged.
- The Student view and client records never carry `correctPairs`.
- Bahasa Indonesia, with no em dash in UI copy.
- Tests use `2:UNREGISTERED_EXAMPLE`, never a planned type key, as their unsupported example (ASSESS-QUESTION-003 §4A.1).

### 4.6 Existing assertions that change (only these)

- `runtime/secure-assessment/test/question-contract.test.ts:63`, `multiple-response.test.ts:23` and `true-false.test.ts:17`: the registry keys gain `2:MATCHING`.
- `true-false.test.ts:72`: the `type_invalid` operator wording names MJ.
- `frontend/web/src/__tests__/answerTypes.test.tsx:59, 76–77`: the supported list and header gain `2:MATCHING`.
- `answerTypes.test.tsx:161–165`: the never-sent example key `2:MATCHING` becomes `2:UNREGISTERED_OTHER`.

Every other existing test is unchanged, including both `header_invalid` regexes, which still match.

## 4A. Binding review-correction contract — 2026-11-08

This section corrects the contract after the independent contract review (§9). Where §3–§7 differ, §4A governs.

### 4A.1 Owner decision D1: partial answers (F1)

**Question put to the Owner** (2026-11-08, in chat): how is a partial matching answer treated, for example a Student who has paired 2 of 3 statements? The options were:
- "Belum dijawab (Recommended)";
- "Dijawab, salah";
- "Tolak jawaban sebagian".

**Owner answer:** "Belum dijawab (Recommended)". The option as presented reads verbatim:

> Jawaban sebagian tetap disimpan dan pulih setelah muat ulang. Di navigator, di dialog Selesaikan Ujian (siswa diperingatkan) dan di pemantauan pengawas, soal itu dihitung BELUM dijawab. Hasilnya UNANSWERED, nilai 0. Di soal tampil: 'Belum lengkap: 2 dari 3 pernyataan dipasangkan.'

**Binding consequences:**
- **Answer.** A partial set of pairs is accepted, saved and recovered as before (§4.1 validation unchanged).
- **Score.** UNANSWERED and 0 for no answer, `pairs: []`, any incomplete set, or a stored value that is not a valid answer. CORRECT and maxScore when every left item is paired and every pair is in `correctPairs`. INCORRECT and 0 when every left item is paired and at least one pair is wrong.
- **Monitoring** (`exam-monitoring.ts`).
  - A matching answer counts as answered only when its number of pairs equals the number of left items of its snapshot. The answer count joins `secure_assessment_exam_question_snapshots` on id and tenant to read `jsonb_array_length(frozen_content->'leftItems')`.
  - Payloads are validated, so equal counts mean every left item is paired.
  - Both `jsonb_array_length` calls are guarded by `jsonb_typeof(...) = 'array'` inside a `CASE`, because PostgreSQL does not guarantee evaluation order. Any other type, including one with a scalar extra `leftItems` key, never raises an error and is counted as before.
  - `selectedOptionIds: []` keeps its existing rule.
- **Client: one key-aware rule.**
  - `isAnsweredValue(contentKey, value, leftCount?)` is true for matching only when `pairsOf(value)` has exactly `leftCount` pairs.
  - The workstation passes `q.leftItems?.length`. The navigator, the "Belum Dijawab" count of the submit dialog and the question-number states then count a partial answer as unanswered, with no change to those components.
- **Save-state area.**
  - After an acknowledged save, the area shows "Belum dijawab" whenever `isAnsweredValue` is false for the current question. That covers a cleared multiple-response answer and an empty or partial matching answer, and replaces the multiple-response-only branch.
  - The pristine branch already follows `answeredOptions`.
  - "Menyimpan...", the failure states and the other types are unchanged.
- **Control status** (polite, inside `MatchingAnswer`):
  - nothing when no pair is chosen; the save-state area shows "Belum dijawab";
  - "Belum lengkap: N dari M pernyataan dipasangkan." when 0 < N < M;
  - "Semua pernyataan sudah dipasangkan." when N = M.
- **Vectors and gates.**
  - M4 becomes: accepted; UNANSWERED, 0; not counted as answered.
  - C03: monitoring counts M1 and M3, and counts neither M4 nor M5. Provisional and final results show M4 as UNANSWERED.
  - C05/C06: a partial answer shows "Belum lengkap", the navigator shows it unanswered, and the submit dialog counts it.

### 4A.2 `type_invalid` wording (F2)

The operator wording is frozen as `"type" must be PG (single answer), BS (true/false), MJ (matching) or PGK (multiple answers)`.
- It keeps `multiple-response.test.ts:96` (`/PG .* or PGK/`) passing unchanged.
- §4.6's `true-false.test.ts:72` assertion changes to this exact text.
- The teacher text stays "tipe soal harus PG, PGK, BS atau MJ."

### 4A.3 Empty values on every client path (F3)

- **Helper.** `isEmptyValue(contentKey, value)` in `types/assessment.ts` is true for `"[]"` under multiple response or matching.
- **`countUnreceivedLocalAnswers`** (`answer-sync-api.ts`) uses it. A local empty matching value is received when the server holds `[]` or nothing, as for multiple response.
- **Save-state area** follows §4A.1. "Belum dijawab" appears only there; the control shows no duplicate.
- **Gates.** C05 and C06 add "unpair every item, then the save state reads Belum dijawab and the server holds `{pairs: []}`", as `99-question-types.spec.ts:289-291` does for multiple response.

### 4A.4 Shared native select and the matching row (F4)

- **New primitive** `frontend/web/src/components/ui/native-select.tsx` (`NativeSelect`), themed with the ELLIGBLE tokens.
  - Size `default` has exactly the classes of today's page-local `selectClass` (`TeacherExamImportView.tsx:34-36`): `h-11`, the shared border, focus outline and 16 px text.
  - Size `exam` is 48 px high (`h-12`).
  - Both sizes have a disabled style.
  - `TeacherExamImportView` uses `NativeSelect` instead of `selectClass`, with an identical rendered result. `MatchingAnswer` uses size `exam`.
  - This is the documented variant, as in ASSESS-QUESTION-002 §4A.8: one select pattern, no second page-local copy.
- **Matching row** (`styles/workstation.css`): `.matching-row` and `.matching-row.paired`.
  - An unpaired row is neutral, with the option card's border and surface.
  - A paired row uses the FDS §21 selected state (`--color-success-base`, `--color-success-bg`, `--color-success-border` and `--color-success-text`). Its cue that is not colour alone is the chosen right letter, shown in the row's marker (the `.option-marker` pattern).
  - The new rules use only existing token variables and add no hard-coded colour; the `designSystemGuard` ceiling of 80 for this file is unchanged.
- **Select options.** A right item used by another left item reads "(sudah dipakai)" and is disabled there.
- **Accessibility.** Each select is named "Pasangan untuk pernyataan N", and `aria-describedby` points to that row's left text (N5).

### 4A.5 Import vectors (F5)

- "11 left items" is removed from the import vectors and kept in the M8 content vectors.
- Added: a 33-cell row in an extended file gives `column_count` with `expected: 32`.
- A 10-cell PG row in an extended file also gives `column_count` (expected 32). This is accepted, as the trailing-empty trim applies only beyond the header width (N6).

### 4A.6 Precisions (N1–N10)

1. **Task-flow paths.** §6 rows 1–4 are Task-flow paths, not allowlist entries (N1).
2. **PG/PGK/BS rows in an extended file.** The check order is number → type → prompt → `items_not_allowed` → their existing checks. For `items_duplicate`, the left side is checked first and is reported when both sides have duplicates (N2).
3. **`ParsedQuestion` for MJ** (N3): `{type: 'MJ', options: [], correctIndex: -1, correctIndexes: [], leftItems: string[], rightItems: string[], correctPairIndexes: number[]}`. `correctPairIndexes` holds one right index per left item, in left order and not sorted.
   - `MATCHING_RIGHT_LETTERS` (A–L) is a separate constant; `OPTION_LETTERS` stays A–E.
   - The import preview maps MJ letters through `MATCHING_RIGHT_LETTERS`.
4. **Teacher preview label:** " · Menjodohkan", in the existing header pattern (N4).
5. **Rendered comparison with #191 (N7).** The `99`/`99b` import-preview captures may differ only in:
   - the intro and card instruction text;
   - the schedule times and random fixture IDs.
   The assessment-type select renders identically through `NativeSelect`. Every other `99`/`99b` surface stays identical.
6. **E2E navigation (N8).** Only `open()`, `reloadPage()` and `navigatePage()` are used for navigation. `99c` uses its own schedule window per browser project, as `99`/`99b` do.
7. **Swapping two pairs (N9).** Because used right items are disabled, the Student unpairs one item first. C05 and C06 exercise this. In E2E, "pointer" input on a native select means Playwright `selectOption`; "keyboard" means focus plus arrow keys.
8. **M8 adds** a left id equal to a right id (a cross-list duplicate), which is what makes the M7 "left id used as a right id" refusal hold (N10).

### 4A.7 Allowlist additions

| # | Path | Purpose |
|---|---|---|
| 28 | frontend/web/src/components/ui/native-select.tsx | Shared native select primitive (§4A.4) |
| 29 | frontend/web/src/styles/workstation.css | `.matching-row` variant, tokens only (§4A.4) |

## 5. Expected vectors (O02 READY condition; P2 R13, O02-5)

Content: left L1, L2, L3; right R1, R2, R3, R4; correct L1→R2, L2→R3, L3→R1; maxScore 3.

| # | Answer | Expected |
|---|---|---|
| M1 | `{pairs: [L1→R2, L2→R3, L3→R1]}` | accepted; CORRECT, 3 |
| M2 | the same pairs in another order | accepted; CORRECT, 3 |
| M3 | complete, with L1→R3 and L2→R2 | accepted; INCORRECT, 0 |
| M4 | `{pairs: [L1→R2, L2→R3]}` (incomplete, D1) | accepted; UNANSWERED, 0; not counted as answered (§4A.1) |
| M5 | `{pairs: []}` | accepted; UNANSWERED, 0; not counted as answered |
| M6 | no answer | UNANSWERED, 0 |
| M7 | refusals | 400 with zero mutation, for each of: a repeated leftId; two left items to one right item; a foreign left or right id; a left id used as a right id; a pair with an extra key; an extra top-level key; `pairs` not an array; a non-string id; four pairs; `{selectedOptionIds: []}`; `[]`; `{}` |
| M8 | invalid content | readiness `question_content_invalid`; delivery 500. Cases: 1 or 11 left items; right count below the left count or above it + 2; duplicate or blank ids; empty item content; `correctPairs` missing a left item, repeating a right item or naming a foreign id; maxScore ≤ 0, NaN or Infinity; empty prompt |

- **Mixed exam:** v1 (max 1, correct), multiple response (max 2, exact), true/false (max 2, incorrect) and M1 give `COMPOSITE_PER_ITEM_V1`, raw 6/8, 75.
- **Import vectors:**
  - MJ with 3 left, 4 right and `B,C,A` gives L1→B, L2→C, L3→A;
  - `b c a` is accepted, and type `mj` is accepted;
  - `B,C` or `B,C,E` gives `correct_invalid`; `B,B,A` gives `correct_duplicate`;
  - `left_1` and `left_3` filled with `left_2` empty gives the left `matching_items_invalid`, and so does 1 left item (11 is a content vector only, §4A.5);
  - right items 2 (below 3) or 6 (above 5) give the right `matching_items_invalid`;
  - duplicate left texts give `items_duplicate`;
  - an MJ option cell filled gives `options_not_allowed`;
  - MJ in a ten-column file gives `columns_missing`;
  - a PG row with `left_1` filled gives `items_not_allowed`;
  - the ten-column v2 vectors of ASSESS-QUESTION-002/003 are unchanged.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-004.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-003 landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | runtime/secure-assessment/src/question-types/matching.ts | Descriptor |
| 7 | runtime/secure-assessment/src/question-contract.ts | Register |
| 8 | runtime/secure-assessment/src/question-import.ts | Extended header, MJ type, problems, wording |
| 9 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview items and key |
| 11 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 12 | runtime/secure-assessment/src/exam-monitoring.ts | A matching answer counts only when complete (§4A.1) |
| 13 | frontend/web/src/types/assessment.ts | Supported key, value helpers, view and preview types |
| 14 | frontend/web/src/lib/question-import.ts | Template, wording |
| 15 | frontend/web/src/exam/answer-sync-api.ts | Payload by key |
| 16 | frontend/web/src/components/answers/MatchingAnswer.tsx | Student control |
| 17 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type |
| 18 | frontend/web/src/components/TeacherExamPreviewView.tsx | Matching preview |
| 19 | frontend/web/src/components/TeacherExamImportView.tsx | Intro, instruction, MJ import preview |
| 20 | runtime/secure-assessment/test/matching.test.ts | Units |
| 21 | runtime/secure-assessment/test/integration/matching.test.ts | Real PostgreSQL journey |
| 22 | frontend/web/src/__tests__/matching.test.tsx | Control, sync, previews |
| 23 | e2e/tests/99c-matching.spec.ts | Five-browser journey and rendered captures (sorts after `99b`) |
| 24 | runtime/secure-assessment/test/question-contract.test.ts | §4.6 only |
| 25 | runtime/secure-assessment/test/multiple-response.test.ts | §4.6 only |
| 26 | runtime/secure-assessment/test/true-false.test.ts | §4.6 only |
| 27 | frontend/web/src/__tests__/answerTypes.test.tsx | §4.6 only |

Forbidden:
- every other file, including all other existing tests;
- completed Task records;
- migrations;
- lockfiles and dependencies;
- workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Vectors M1–M8 and the mixed-exam vector as units; the production registry holds the four keys |
| C02 | Import vectors; the v1 and ten-column v2 parser results are unchanged |
| C03 | Real PostgreSQL: a teacher imports an extended v2 file with MJ and PG; the preview shows the key; readiness passes; delivery is without the key; M1/M2/M4/M5 saves and M7 refusals with zero mutation; a client whose header lacks `2:MATCHING` gets 409 on delivery and save with zero mutation; monitoring counts M1 and M3 and neither M4 nor M5 (§4A.1); M4 is UNANSWERED in the results; resume; submit; composite finalization; provisional and final results agree |
| C04 | Regression: every existing test passes, with only the §4.6 assertions changed |
| C05 | Client: canonical values both ways; malformed values refused locally; control with keyboard and pointer, with used right items disabled elsewhere; unpairing; local recovery after a reload; adoption; no key in any record; the teacher preview |
| C06 | Five-browser E2E (`99c`, one participant `siswa.e2e.06`):<br>• teacher import of the extended template and the preview;<br>• the Student pairs with keyboard and pointer, changes a pair offline (only the final value is saved), recovers after a reload, unpairs one item and sees the count, and sees no question content while paused;<br>• submit is disabled while a save is held, then completes (V06);<br>• the teacher ends and finalizes and sees the score |
| C07 | Rendered evidence (`workspace-question-mj-*`).<br>• **Baseline:** the exact-main CI #191 artifacts (`99` and `99b` at e5d0b3f), retrieved and fingerprinted in step 1, with a capture-only baseline commit as the fallback.<br>• **After:** the exam screen (empty, partial, complete, keyboard focus), the teacher preview with the key and the import preview. Widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, plus 200 % text for the surfaces, with a reduced set for journey states. Long left and right items at 360 px and 200 % text.<br>• No overflow; targets ≥ 44 px; visible focus; independent rendered review PASS; the `99`/`99b` captures compared with #191 |
| C08 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**Frozen CI-first order:**
1. Registration: the record and trackers, carrying the ASSESS-QUESTION-003 landing. The #191 baseline artifacts are retrieved and their manifest recorded.
2. Implementation; its exact-SHA CI passes before review.
3. Independent implementation and rendered review, by the same reviewer as the contract.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs.

**Frontend skill checkpoint:** as ASSESS-QUESTION-002 §4A.8. The three verified skills are reused. DesainPakeAI is not consulted, and no authority is claimed. The control reuses the shared native select field and the exam screen's status pattern.

**E2E notes:**
- The proposed TASK_PLAN path `10-question-types.spec.ts` becomes `99c-matching.spec.ts`, which sorts last (ASSESS-QUESTION-002 lesson).
- It uses its own file name `menjodohkan-e2e.csv`.
- The WebKit and Firefox lessons apply: reduced journey variants, a device-pixel cap, and every reload or new-page navigation through `reloadPage()`/`open()` (ASSESS-QUESTION-003 §13). There are no direct `page.reload()` or `page.goto()` calls.
- V06 asserts the disabled submit while the save is held.

## 8. History

- 2026-11-08: contract prepared under DEC-048 on main e5d0b3f after ASSESS-QUESTION-003 landed (with its post-merge fix).
- 2026-11-08: contract review STOP (F1–F5). Owner decision D1 on partial answers; correction 1 (§4A).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent, the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP**, with five material findings.
  - **F1:** E1 is an Owner decision. It was put to the Owner and decided as D1.
  - **F2:** the new `type_invalid` wording would break `multiple-response.test.ts:96`.
  - **F3:** the O02-2 empty-value handling was not carried over to matching.
  - **F4:** there is no shared native select, and the paired-row state was unspecified.
  - **F5:** an import vector with 11 left items cannot be built from the header.
  - Non-material notes N1–N10. All are addressed in §4A.
  - The reviewer confirmed E2–E4 as legitimate executor readings, the O02-5 cardinality, the security and privacy shape, and the otherwise sufficient allowlist.

### 9.1 Re-review: PASS

The same reviewer re-reviewed correction 1 (record SHA-256 996b63d93b473403b07f1ed89946db073a2235531490052b1b9148723ef46b34) and found **PASS**, with no new material finding. The reviewer confirmed that:
- §4A.1 follows the Owner's chosen option without new policy;
- the monitoring join is feasible: the composite key in 0004 allows a primary-key lookup inside the existing `ans` lateral;
- every client path that counts or shows "answered" runs through `answeredOptions`, the save-state check or `isEmptyValue`;
- the allowlist is sufficient.

Non-material notes, applied at READY:
- stale earlier text that contradicted §4A is updated inline: §3 E1, §4.4 control status, M4, the 11-left import vector, C03 and row 12;
- the monitoring SQL guards `jsonb_array_length` with `jsonb_typeof` (§4A.1);
- the rendered review confirms that "Belum lengkap" in the control makes a saved but incomplete answer clear.

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE and landed.
  - ASSESS-QUESTION-003 is DONE and landed: PR #28, main b7d02ee; post-merge fix PR #29, main e5d0b3f6aaa47ef4a36704f1526d26a02a28b216; post-merge CI #191 attempt 1 eight SUCCESS ([record §12–§13](ASSESS-QUESTION-003.md)).
  - O02-1/-2/-5/-12 are approved, D1 is decided by the Owner, and O09 rests on P5.
- **Review chain:** STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–27 plus §4A.7 rows 28–29. Rows 1–4 are Task-flow paths. No migration, route, dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #191 (run 42419166139, e5d0b3f).
  - 650 `workspace-question-*` pairs: 450 tagged ASSESS-QUESTION-002 and 200 tagged ASSESS-QUESTION-003.
  - All at commit e5d0b3f with frontend tree 2042eeb3f48c6f6e40944307083fc74975727a74; every screenshot hash matches its JSON.
  - Zero overflow and zero targets under 44 px.
  - Manifest: one line per pair, "project scenario viewport text sha256", sorted. SHA-256 304af80bd6a1990a52e32690fecbe3884570ea1aed2b17241175b0116d88394b.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 9, IN_PROGRESS 1, VERIFYING 0, BLOCKED 23.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration e2ecf76 (CI #192, attempt 1, eight SUCCESS), carrying the #191 baseline manifest (§10).
- **Implementation candidate,** inside rows 5–29 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/matching.ts`, registered:
    - item ids are unique across both lists;
    - the answer `{pairs}` is order-free and strictly one-to-one;
    - scoring: incomplete is UNANSWERED (D1); complete and exact is CORRECT; complete and wrong is INCORRECT.
  - **Parser:**
    - the extended v2 header (`QUESTIONS_HEADER_V2_EXTENDED`, 32 columns) beside the unchanged v1 and ten-column v2 headers;
    - `MJ` rows in the frozen check order;
    - `items_not_allowed` for PG/PGK/BS rows;
    - `MATCHING_RIGHT_LETTERS` A–L;
    - the frozen operator wording (§4.2, §4A.2).
  - **Builder:** `buildMatchingFrozenContent`, dispatched by `buildImportedFrozenContent`.
  - **Import preview item:** `leftItems`, `rightItems`, and `correctLetters` in left order.
  - **Teacher preview item:** the §4.3 shape.
  - **Monitoring:** the guarded count of §4A.1.
  - **Client:**
    - `MATCHING_KEY` is supported;
    - helpers `canonicalPairs`, `pairsOf`, `isEmptyValue`, and `isAnsweredValue(key, value, leftCount)`;
    - the adapter sends `{pairs}` only from a canonical value;
    - `countUnreceivedLocalAnswers` uses `isEmptyValue`;
    - `MatchingAnswer`: the right list, one `NativeSelect` (size `exam`) per left item, used items disabled with "(sudah dipakai)", the status text of §4A.1, and the `.matching-row`/`.paired` tokens-only variant;
    - the exam screen renders by type and uses one key-aware save-state check;
    - the teacher preview shows the try-out control and the key list;
    - the import page has the intro, the card instruction, the MJ preview, and `NativeSelect` for the assessment type;
    - the extended template has PG, PGK, BS and MJ rows, and the teacher wording is as frozen.
  - **Document:** the P4 pointer.
- **Tests:**
  - `test/matching.test.ts` (C01/C02);
  - `test/integration/matching.test.ts` (C03: four Students covering M1/M2, M3, M4 and M5; refusals with zero mutation; the 409 pair; monitoring counts; results);
  - `frontend/web/src/__tests__/matching.test.tsx` (C05);
  - `e2e/tests/99c-matching.spec.ts` (C06/C07, using only the shared navigation helpers);
  - the §4.6 assertions in rows 24–27.
- **Local:**
  - typechecks PASS (runtime, web, e2e);
  - Secure Assessment units 944/944;
  - the new and affected web files PASS;
  - the client template parses with the server parser without problems.
  - The full local web run had eight timing-sensitive failures under machine load. Each failing file then passed when run alone, and `onDemandScreens` behaves the same on the main tree.
  - Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 9, VERIFYING 1, BLOCKED 23.
