import { CsvError, parseCsv, type CsvRow } from './ops/provisioning/csv.ts';
import { isNumberText } from './question-types/numeric-answer.ts';
import { isShortText, normalizeShortText } from './question-types/short-answer.ts';

// Structured question import (D04.3-61/62 LOCKED): the canonical elligble-questions-v1 file,
// one baseline single-answer multiple-choice question per row with five options A to E
// (D04.3 baseline simplification). The whole file is checked before anything is written and
// every problem is reported with its line (D04.3-64 LOCKED: empty prompt, missing or
// duplicate options, a key that is not exactly one existing option, an invalid score).
// Shared by the teacher's import and the operator CLI; each renders the problems in its own
// language. Comma or semicolon separated (spreadsheets set to Indonesian save semicolons),
// UTF-8 with or without a byte order mark.

export const QUESTIONS_TEMPLATE = 'elligble-questions-v1';
export const QUESTIONS_HEADER = ['no', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'score'] as const;
/**
 * ASSESS-QUESTION-002 (O02-12): the v2 template adds a question type column. v2 grows only by
 * appending type-specific columns after "score" (record §4A.5); this 10-column header stays a
 * valid v2 file. Types: PG (pilihan ganda, stored as v1 single choice) and PGK (pilihan ganda
 * kompleks, multiple response).
 */
export const QUESTIONS_TEMPLATE_V2 = 'elligble-questions-v2';
export const QUESTIONS_HEADER_V2 = ['no', 'type', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'score'] as const;
/** Right-item letters of a matching (MJ) row: A to L (ASSESS-QUESTION-004 §4A.6). */
export const MATCHING_RIGHT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export const MATCHING_LEFT_COLUMNS = 10;
/**
 * ASSESS-QUESTION-004 (§4.2): the extended v2 header appends the matching item columns
 * left_1..left_10 and right_a..right_l after "score" (32 columns). The ten-column v2 header
 * stays valid; only MJ rows need the extended one.
 */
export const QUESTIONS_HEADER_V2_EXTENDED = [
    ...QUESTIONS_HEADER_V2,
    ...Array.from({ length: MATCHING_LEFT_COLUMNS }, (_, i) => `left_${i + 1}`),
    ...MATCHING_RIGHT_LETTERS.map(l => `right_${l.toLowerCase()}`),
] as readonly string[];
/**
 * ASSESS-QUESTION-007 (§4.2): the 32 extended columns plus "tolerance" (33 columns), for the IA
 * (isian angka) tolerance. The 32-column header stays valid and unchanged.
 */
export const QUESTIONS_HEADER_V2_TOLERANCE = [...QUESTIONS_HEADER_V2_EXTENDED, 'tolerance'] as readonly string[];
/**
 * ASSESS-QUESTION-008 (§4.5): the 33 tolerance columns plus "rubric" (34 columns), for the ES
 * (esai) rubric. The 33-, 32- and 10-column headers stay valid and unchanged.
 */
export const QUESTIONS_HEADER_V2_RUBRIC = [...QUESTIONS_HEADER_V2_TOLERANCE, 'rubric'] as readonly string[];
export type QuestionTemplate = typeof QUESTIONS_TEMPLATE | typeof QUESTIONS_TEMPLATE_V2;
export type ImportQuestionType = 'PG' | 'PGK' | 'BS' | 'MJ' | 'UR' | 'IA' | 'ES' | 'IS';
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
/** Implementation limits (plan §7): questions per file and the largest score of one question. */
export const MAX_IMPORT_QUESTIONS = 200;
export const MAX_QUESTION_SCORE = 1000;

export type QuestionProblemCode =
    | 'not_text'
    | 'encoding_invalid'
    | 'csv_syntax'
    | 'header_invalid'
    | 'file_empty'
    | 'too_many_questions'
    | 'column_count'
    | 'number_out_of_order'
    | 'prompt_empty'
    | 'option_empty'
    | 'options_duplicate'
    | 'correct_multiple'
    | 'correct_invalid'
    | 'score_invalid'
    | 'type_invalid'
    | 'correct_duplicate'
    | 'options_not_allowed'
    | 'columns_missing'
    | 'matching_items_invalid'
    | 'items_duplicate'
    | 'items_not_allowed'
    | 'ordering_items_invalid'
    | 'tolerance_invalid'
    | 'tolerance_not_allowed'
    | 'correct_not_allowed'
    | 'rubric_not_allowed'
    | 'short_answer_forms_invalid';

export interface QuestionProblem {
    code: QuestionProblemCode;
    /** Line of the file (1-based) the problem belongs to, when it belongs to one. */
    line: number | null;
    /** number_out_of_order: the number this row must have. too_many_questions: the limit. column_count (v2 only): the columns of the template. */
    expected?: number;
    /** column_count: the columns found. too_many_questions: the questions found. */
    found?: number;
    /** option_empty and options_duplicate: the letters concerned. */
    letters?: string[];
    /**
     * correct_invalid on a BS row (ASSESS-QUESTION-003 §4A.2); correct_invalid, correct_duplicate
     * and options_not_allowed on an MJ row (ASSESS-QUESTION-004 §4.2). Absent otherwise.
     */
    type?: 'BS' | 'MJ' | 'UR' | 'IA' | 'ES' | 'IS';
    /** matching_items_invalid and items_duplicate: the side of the matching items concerned. */
    side?: 'left' | 'right';
}

export interface ParsedQuestion {
    line: number;
    no: number;
    prompt: string;
    /** Five option texts in the authored order, shown as A to E; empty for BS. */
    options: string[];
    /** PG: the correct option (0-4). PGK and BS: -1. */
    correctIndex: number;
    maxScore: number;
    /** PG for every v1 row. */
    type: ImportQuestionType;
    /** The correct options in A-E order: one for PG, one to five for PGK, none for BS. */
    correctIndexes: number[];
    /** BS only: the key (true = Benar). */
    correctValue?: boolean;
    /** MJ only: the left items (2-10) and right items (as many plus at most 2), in authored order. */
    leftItems?: string[];
    rightItems?: string[];
    /** MJ only: the right item index of each left item, in left order. */
    correctPairIndexes?: number[];
    /** UR only (ASSESS-QUESTION-005 §4A.4): the item indexes in the correct order; the items are leftItems. */
    correctSequence?: number[];
    /** IA only (ASSESS-QUESTION-007 §4.2): the key as typed (trimmed) and the tolerance as typed, or "0". */
    numericKey?: string;
    numericTolerance?: string;
    /** ES only (ASSESS-QUESTION-008 §4.5): the rubric as typed (trimmed), possibly empty. */
    essayRubric?: string;
    /** IS only (ASSESS-QUESTION-006 §4.3): the accepted forms as typed (trimmed), in order; [] means manual mode (D1). */
    acceptedForms?: string[];
}

export interface QuestionFile {
    questions: ParsedQuestion[];
    problems: QuestionProblem[];
    /** The template whose header the file carries; v1 when the header was not recognised. */
    template: QuestionTemplate;
}

const SCORE_FORMAT = /^\d{1,4}([.,]\d{1,2})?$/;
const SEVERAL_LETTERS = /^[A-E](\s*(,|;|\/|&|dan|and)?\s*[A-E])+$/i;

function lineOf(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
}

interface Header { template: QuestionTemplate; columns: number }

function headerOf(row: CsvRow | undefined): Header | null {
    if (!row) return null;
    const headers: Array<[QuestionTemplate, readonly string[]]> = [[QUESTIONS_TEMPLATE, QUESTIONS_HEADER], [QUESTIONS_TEMPLATE_V2, QUESTIONS_HEADER_V2], [QUESTIONS_TEMPLATE_V2, QUESTIONS_HEADER_V2_EXTENDED], [QUESTIONS_TEMPLATE_V2, QUESTIONS_HEADER_V2_TOLERANCE], [QUESTIONS_TEMPLATE_V2, QUESTIONS_HEADER_V2_RUBRIC]];
    for (const [template, header] of headers) {
        const cells = trimTrailingEmpty(row.cells.map(c => c.trim().toLowerCase()), header.length);
        if (cells.length === header.length && cells.every((c, i) => c === header[i])) return { template, columns: header.length };
    }
    return null;
}

/** Spreadsheets sometimes keep empty columns after the last one; they carry nothing. */
function trimTrailingEmpty(cells: string[], columns: number = QUESTIONS_HEADER.length): string[] {
    let end = cells.length;
    while (end > columns && cells[end - 1].trim() === '') end--;
    return end === cells.length ? cells : cells.slice(0, end);
}

function readRows(text: string): { rows: CsvRow[]; header: Header } | { problem: QuestionProblem } {
    // The header decides the separator: commas, or semicolons as spreadsheets set to
    // Indonesian save them.
    const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split('\n').map(l => l.replace(/\r$/, ''));
    const headerIndex = lines.findIndex(l => l.trim() !== '');
    if (headerIndex < 0) return { problem: { code: 'file_empty', line: null } };
    let header: Header | null = null;
    const delimiter = ([',', ';'] as const).find(candidate => {
        try {
            header = headerOf(parseCsv(lines[headerIndex], candidate)[0]);
            return header !== null;
        } catch {
            return false;
        }
    });
    if (!delimiter || !header) return { problem: { code: 'header_invalid', line: headerIndex + 1 } };
    try {
        return { rows: parseCsv(text, delimiter), header };
    } catch (err) {
        if (err instanceof CsvError) return { problem: { code: 'csv_syntax', line: err.line } };
        throw err;
    }
}

export function parseQuestionFile(text: string): QuestionFile {
    // A workbook or other binary file read as text: ZIP signature (xlsx, docx) or NUL bytes.
    if (text.startsWith('PK\u0003\u0004') || text.includes('\u0000')) {
        return { questions: [], problems: [{ code: 'not_text', line: null }], template: QUESTIONS_TEMPLATE };
    }
    const replaced = text.indexOf('�');
    if (replaced >= 0) {
        return { questions: [], problems: [{ code: 'encoding_invalid', line: lineOf(text, replaced) }], template: QUESTIONS_TEMPLATE };
    }
    const read = readRows(text);
    if ('problem' in read) return { questions: [], problems: [read.problem], template: QUESTIONS_TEMPLATE };
    const template = read.header.template;
    const v2 = template === QUESTIONS_TEMPLATE_V2;
    const columns = read.header.columns;
    const extended = columns >= QUESTIONS_HEADER_V2_EXTENDED.length;
    const withTolerance = columns >= QUESTIONS_HEADER_V2_TOLERANCE.length;
    const withRubric = columns === QUESTIONS_HEADER_V2_RUBRIC.length;

    const rows = read.rows.slice(1);
    const problems: QuestionProblem[] = [];
    const questions: ParsedQuestion[] = [];
    if (rows.length === 0) return { questions, problems: [{ code: 'file_empty', line: null }], template };
    if (rows.length > MAX_IMPORT_QUESTIONS) {
        return { questions, problems: [{ code: 'too_many_questions', line: null, expected: MAX_IMPORT_QUESTIONS, found: rows.length }], template };
    }

    rows.forEach((row, index) => {
        const cells = trimTrailingEmpty(row.cells.map(c => c.trim()), columns);
        const line = row.line;
        if (cells.length !== columns) {
            // v1 keeps exactly {code, line, found}; v2 also names its column count (§4A.6).
            problems.push(v2 ? { code: 'column_count', line, found: cells.length, expected: columns } : { code: 'column_count', line, found: cells.length });
            return;
        }
        const typeCell = v2 ? cells[1].toUpperCase() : 'PG';
        const [no, prompt, a, b, c, d, e, correct, score] = v2 ? [cells[0], ...cells.slice(2, 10)] : cells;
        const type: ImportQuestionType | null = typeCell === 'PG' || typeCell === 'PGK' || typeCell === 'BS' || typeCell === 'MJ' || typeCell === 'UR' || typeCell === 'IA' || typeCell === 'ES' || typeCell === 'IS' ? typeCell : null;
        // Left cells 10-19, right cells 20-31; the tolerance is cell 32 of the 33- and 34-column
        // files (ASSESS-QUESTION-007 §4.2) and the rubric cell 33 of the 34-column file (ASSESS-QUESTION-008 §4.5).
        const leftCells = extended ? cells.slice(10, 10 + MATCHING_LEFT_COLUMNS) : [];
        const rightCells = extended ? cells.slice(10 + MATCHING_LEFT_COLUMNS, 10 + MATCHING_LEFT_COLUMNS + MATCHING_RIGHT_LETTERS.length) : [];
        const toleranceCell = withTolerance ? cells[QUESTIONS_HEADER_V2_EXTENDED.length] : '';
        const rubricCell = withRubric ? cells[QUESTIONS_HEADER_V2_TOLERANCE.length] : '';
        const options = [a, b, c, d, e];
        if (no !== String(index + 1)) {
            problems.push({ code: 'number_out_of_order', line, expected: index + 1 });
            return;
        }
        if (!type) {
            problems.push({ code: 'type_invalid', line });
            return;
        }
        if (!prompt) {
            problems.push({ code: 'prompt_empty', line });
            return;
        }
        // The rubric column belongs to ES rows and teacher-graded IS rows (ASSESS-QUESTION-008 §4.5,
        // 006 §4.3); IS checks it in its own branch.
        if (type !== 'ES' && type !== 'IS' && rubricCell.length > 0) {
            problems.push({ code: 'rubric_not_allowed', line });
            return;
        }
        if (type === 'IS') {
            const question = parseShortAnswerRow(line, index + 1, prompt, options, correct, score, leftCells, rightCells, toleranceCell, rubricCell);
            if ('code' in question) problems.push(question);
            else questions.push(question);
            return;
        }
        if (type === 'ES') {
            const question = parseEssayRow(line, index + 1, prompt, options, correct, score, [...leftCells, ...rightCells], toleranceCell, rubricCell);
            if ('code' in question) problems.push(question);
            else questions.push(question);
            return;
        }
        if (type === 'IA') {
            const question = parseNumericRow(line, index + 1, prompt, options, correct, score, [...leftCells, ...rightCells], toleranceCell);
            if ('code' in question) problems.push(question);
            else questions.push(question);
            return;
        }
        // The tolerance column belongs to IA rows only (§4.2: immediately after the prompt).
        if (toleranceCell.length > 0) {
            problems.push({ code: 'tolerance_not_allowed', line });
            return;
        }
        if (type === 'MJ') {
            const question = parseMatchingRow(line, index + 1, prompt, options, correct, score, extended, leftCells, rightCells);
            if ('code' in question) problems.push(question);
            else questions.push(question);
            return;
        }
        if (type === 'UR') {
            const question = parseOrderingRow(line, index + 1, prompt, options, correct, score, extended, leftCells, rightCells);
            if ('code' in question) problems.push(question);
            else questions.push(question);
            return;
        }
        // The matching item columns belong to MJ rows only (§4A.6: after the prompt).
        if ([...leftCells, ...rightCells].some(cell => cell.length > 0)) {
            problems.push({ code: 'items_not_allowed', line });
            return;
        }
        if (type === 'BS') {
            // Benar/Salah: no option cells; the key is B, S, Benar or Salah (§4.2, §4A.5 order).
            if (options.some(option => option.length > 0)) {
                problems.push({ code: 'options_not_allowed', line });
                return;
            }
            const key = correct.trim().toUpperCase();
            const correctValue = key === 'B' || key === 'BENAR' ? true : key === 'S' || key === 'SALAH' ? false : null;
            if (correctValue === null) {
                problems.push({ code: 'correct_invalid', line, type: 'BS' });
                return;
            }
            const bsScore = SCORE_FORMAT.test(score) ? Number(score.replace(',', '.')) : NaN;
            if (!(bsScore > 0 && bsScore <= MAX_QUESTION_SCORE)) {
                problems.push({ code: 'score_invalid', line });
                return;
            }
            questions.push({ line, no: index + 1, prompt, options: [], correctIndex: -1, maxScore: bsScore, type, correctIndexes: [], correctValue });
            return;
        }
        const missing = OPTION_LETTERS.filter((_, i) => !options[i]);
        if (missing.length > 0) {
            problems.push({ code: 'option_empty', line, letters: [...missing] });
            return;
        }
        const seen = new Map<string, number>();
        const duplicated = new Set<number>();
        options.forEach((option, i) => {
            const key = option.toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
            const earlier = seen.get(key);
            if (earlier === undefined) seen.set(key, i);
            else duplicated.add(earlier).add(i);
        });
        if (duplicated.size > 0) {
            problems.push({ code: 'options_duplicate', line, letters: [...duplicated].sort().map(i => OPTION_LETTERS[i]) });
            return;
        }
        let correctIndexes: number[];
        if (type === 'PGK') {
            // One to five letters A-E separated by commas and/or spaces, each at most once.
            const letters = correct.toUpperCase().split(/[\s,]+/).filter(part => part.length > 0);
            if (!/^[A-Za-z\s,]+$/.test(correct) || letters.length === 0 || letters.some(l => !(OPTION_LETTERS as readonly string[]).includes(l))) {
                problems.push({ code: 'correct_invalid', line });
                return;
            }
            if (new Set(letters).size !== letters.length) {
                problems.push({ code: 'correct_duplicate', line });
                return;
            }
            correctIndexes = letters.map(l => (OPTION_LETTERS as readonly string[]).indexOf(l)).sort((x, y) => x - y);
        } else {
            const key = correct.toUpperCase();
            const index = (OPTION_LETTERS as readonly string[]).indexOf(key);
            if (index < 0) {
                problems.push({ code: SEVERAL_LETTERS.test(correct) ? 'correct_multiple' : 'correct_invalid', line });
                return;
            }
            correctIndexes = [index];
        }
        const correctIndex = type === 'PG' ? correctIndexes[0] : -1;
        const maxScore = scoreOf(score);
        if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) {
            problems.push({ code: 'score_invalid', line });
            return;
        }
        questions.push({ line, no: index + 1, prompt, options, correctIndex, maxScore, type, correctIndexes });
    });
    return { questions, problems, template };
}

function scoreOf(score: string): number {
    return SCORE_FORMAT.test(score) ? Number(score.replace(',', '.')) : NaN;
}

/** The number of leading filled cells, or -1 when a filled cell follows an empty one. */
function filledInOrder(cells: string[]): number {
    const count = cells.findIndex(cell => cell.length === 0);
    const filled = count < 0 ? cells.length : count;
    return cells.slice(filled).some(cell => cell.length > 0) ? -1 : filled;
}

function hasDuplicate(items: string[]): boolean {
    const seen = new Set(items.map(item => item.toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')));
    return seen.size !== items.length;
}

/**
 * One IA (isian angka) row, checked in the frozen order (ASSESS-QUESTION-007 §4.2): options empty,
 * item cells empty, key, tolerance, score. The key and the tolerance are kept as typed; the builder
 * normalizes them.
 */
function parseNumericRow(line: number, no: number, prompt: string, options: string[], correct: string, score: string,
    itemCells: string[], toleranceCell: string): ParsedQuestion | QuestionProblem {
    if (options.some(option => option.length > 0)) return { code: 'options_not_allowed', line, type: 'IA' };
    if (itemCells.some(cell => cell.length > 0)) return { code: 'items_not_allowed', line, type: 'IA' };
    const key = correct.trim();
    if (!isNumberText(key)) return { code: 'correct_invalid', line, type: 'IA' };
    const tolerance = toleranceCell.trim();
    if (tolerance !== '' && !(isNumberText(tolerance) && !tolerance.startsWith('-'))) return { code: 'tolerance_invalid', line };
    const maxScore = scoreOf(score);
    if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) return { code: 'score_invalid', line };
    return {
        line, no, prompt, options: [], correctIndex: -1, maxScore, type: 'IA', correctIndexes: [],
        numericKey: key, numericTolerance: tolerance === '' ? '0' : tolerance,
    };
}

/**
 * One IS (isian singkat) row, checked in the frozen order (ASSESS-QUESTION-006 §4.3): options empty,
 * right cells empty, accepted forms filled in order from left_1 and valid (E1/E2), distinct after
 * normalization (E3), tolerance empty, key empty, rubric only without forms (manual mode, D1), score.
 */
function parseShortAnswerRow(line: number, no: number, prompt: string, options: string[], correct: string, score: string,
    leftCells: string[], rightCells: string[], toleranceCell: string, rubricCell: string): ParsedQuestion | QuestionProblem {
    if (options.some(option => option.length > 0)) return { code: 'options_not_allowed', line, type: 'IS' };
    if (rightCells.some(cell => cell.length > 0)) return { code: 'items_not_allowed', line, type: 'IS' };
    const count = filledInOrder(leftCells);
    if (count < 0) return { code: 'short_answer_forms_invalid', line };
    const forms = leftCells.slice(0, count);
    if (forms.some(form => !isShortText(form))) return { code: 'short_answer_forms_invalid', line };
    if (new Set(forms.map(normalizeShortText)).size !== forms.length) return { code: 'items_duplicate', line, type: 'IS' };
    if (toleranceCell.length > 0) return { code: 'tolerance_not_allowed', line };
    if (correct.trim().length > 0) return { code: 'correct_not_allowed', line, type: 'IS' };
    if (forms.length > 0 && rubricCell.length > 0) return { code: 'rubric_not_allowed', line };
    const maxScore = scoreOf(score);
    if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) return { code: 'score_invalid', line };
    return { line, no, prompt, options: [], correctIndex: -1, maxScore, type: 'IS', correctIndexes: [], acceptedForms: forms, essayRubric: rubricCell.trim() };
}

/**
 * One ES (esai) row, checked in the frozen order (ASSESS-QUESTION-008 §4.5): options empty, item
 * cells empty, tolerance empty, key empty (the teacher grades it), score. The rubric is kept as
 * typed (trimmed), with no limit of its own (Owner D3).
 */
function parseEssayRow(line: number, no: number, prompt: string, options: string[], correct: string, score: string,
    itemCells: string[], toleranceCell: string, rubricCell: string): ParsedQuestion | QuestionProblem {
    if (options.some(option => option.length > 0)) return { code: 'options_not_allowed', line, type: 'ES' };
    if (itemCells.some(cell => cell.length > 0)) return { code: 'items_not_allowed', line, type: 'ES' };
    if (toleranceCell.length > 0) return { code: 'tolerance_not_allowed', line };
    if (correct.trim().length > 0) return { code: 'correct_not_allowed', line };
    const maxScore = scoreOf(score);
    if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) return { code: 'score_invalid', line };
    return { line, no, prompt, options: [], correctIndex: -1, maxScore, type: 'ES', correctIndexes: [], essayRubric: rubricCell.trim() };
}

/**
 * One UR (mengurutkan) row, checked in the frozen order (ASSESS-QUESTION-005 §4.2/§4A.4): options
 * empty, item columns present, items, right cells empty, duplicates, key, score.
 */
function parseOrderingRow(line: number, no: number, prompt: string, options: string[], correct: string, score: string,
    extended: boolean, leftCells: string[], rightCells: string[]): ParsedQuestion | QuestionProblem {
    if (options.some(option => option.length > 0)) return { code: 'options_not_allowed', line, type: 'UR' };
    if (!extended) return { code: 'columns_missing', line, type: 'UR' };
    const count = filledInOrder(leftCells);
    if (count < 2) return { code: 'ordering_items_invalid', line };
    if (rightCells.some(cell => cell.length > 0)) return { code: 'items_not_allowed', line, type: 'UR' };
    const items = leftCells.slice(0, count);
    if (hasDuplicate(items)) return { code: 'items_duplicate', line, type: 'UR' };
    // Every item number 1..N exactly once, in the correct order, separated by commas and/or spaces.
    const parts = correct.split(/[\s,]+/).filter(part => part.length > 0);
    if (!/^[0-9\s,]+$/.test(correct) || parts.length !== count || parts.some(part => !/^[1-9][0-9]?$/.test(part) || Number(part) > count)) {
        return { code: 'correct_invalid', line, type: 'UR' };
    }
    if (new Set(parts).size !== parts.length) return { code: 'correct_duplicate', line, type: 'UR' };
    const maxScore = scoreOf(score);
    if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) return { code: 'score_invalid', line };
    return {
        line, no, prompt, options: [], correctIndex: -1, maxScore, type: 'UR', correctIndexes: [],
        leftItems: items, correctSequence: parts.map(part => Number(part) - 1),
    };
}

/**
 * One MJ (menjodohkan) row, checked in the frozen order (ASSESS-QUESTION-004 §4.2): options
 * empty, item columns present, left items, right items, duplicates (left first), key, score.
 */
function parseMatchingRow(line: number, no: number, prompt: string, options: string[], correct: string, score: string,
    extended: boolean, leftCells: string[], rightCells: string[]): ParsedQuestion | QuestionProblem {
    if (options.some(option => option.length > 0)) return { code: 'options_not_allowed', line, type: 'MJ' };
    if (!extended) return { code: 'columns_missing', line };
    const left = filledInOrder(leftCells);
    if (left < 2) return { code: 'matching_items_invalid', line, side: 'left' };
    const right = filledInOrder(rightCells);
    if (right < left || right > left + 2) return { code: 'matching_items_invalid', line, side: 'right' };
    const leftItems = leftCells.slice(0, left);
    const rightItems = rightCells.slice(0, right);
    if (hasDuplicate(leftItems)) return { code: 'items_duplicate', line, side: 'left' };
    if (hasDuplicate(rightItems)) return { code: 'items_duplicate', line, side: 'right' };
    // One right letter per left item, in left order, separated by commas and/or spaces.
    const letters = correct.toUpperCase().split(/[\s,]+/).filter(part => part.length > 0);
    const known = MATCHING_RIGHT_LETTERS.slice(0, right) as readonly string[];
    if (!/^[A-Za-z\s,]+$/.test(correct) || letters.length !== left || letters.some(l => !known.includes(l))) {
        return { code: 'correct_invalid', line, type: 'MJ' };
    }
    if (new Set(letters).size !== letters.length) return { code: 'correct_duplicate', line, type: 'MJ' };
    const maxScore = scoreOf(score);
    if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) return { code: 'score_invalid', line };
    return {
        line, no, prompt, options: [], correctIndex: -1, maxScore, type: 'MJ', correctIndexes: [],
        leftItems, rightItems, correctPairIndexes: letters.map(l => known.indexOf(l)),
    };
}

/** The operator CLI's wording of a problem (English, operator-facing). */
export function describeQuestionProblem(problem: QuestionProblem): string {
    const at = problem.line === null ? '' : `line ${problem.line}: `;
    switch (problem.code) {
        case 'not_text': return 'the questions file is not a text CSV file (a spreadsheet workbook?); save it as "CSV UTF-8"';
        case 'encoding_invalid': return `${at}the file is not UTF-8 text; save it as "CSV UTF-8"`;
        case 'csv_syntax': return `${at}the file is not valid CSV (check the double quotes)`;
        case 'header_invalid': return `${at}header must be exactly: ${QUESTIONS_HEADER.join(',')} (${QUESTIONS_TEMPLATE}) or ${QUESTIONS_HEADER_V2.join(',')} (${QUESTIONS_TEMPLATE_V2}) or ${QUESTIONS_HEADER_V2_EXTENDED.join(',')} (${QUESTIONS_TEMPLATE_V2}) or ${QUESTIONS_HEADER_V2_TOLERANCE.join(',')} (${QUESTIONS_TEMPLATE_V2}) or ${QUESTIONS_HEADER_V2_RUBRIC.join(',')} (${QUESTIONS_TEMPLATE_V2})`;
        case 'file_empty': return 'the questions file has no questions';
        case 'too_many_questions': return `the file has ${problem.found} questions; at most ${problem.expected} per import`;
        case 'column_count': return `${at}expected ${problem.expected ?? QUESTIONS_HEADER.length} columns, found ${problem.found}`;
        case 'number_out_of_order': return `${at}"no" must be ${problem.expected} (questions are numbered 1, 2, 3 in order)`;
        case 'prompt_empty': return `${at}the question text is empty`;
        case 'option_empty': return `${at}all five options (A to E) are required; missing ${problem.letters?.join(', ')}`;
        case 'options_duplicate': return `${at}options must be different from each other (${problem.letters?.join(', ')})`;
        case 'correct_multiple': return `${at}"correct" must be exactly one of A, B, C, D, E (single-answer questions)`;
        case 'correct_invalid': return problem.type === 'BS' ? `${at}"correct" must be B (true) or S (false) for BS`
            : problem.type === 'MJ' ? `${at}"correct" for MJ must list one right letter per left item, in order (for example B,C,A)`
            : problem.type === 'UR' ? `${at}"correct" for UR must list every item number once, in the correct order (for example 3,1,2)`
            : problem.type === 'IA' ? `${at}"correct" for IA must be a number with a comma or dot decimal (for example 3,5)`
            : `${at}"correct" must be one of A, B, C, D, E`;
        case 'score_invalid': return `${at}"score" must be a positive number with at most two decimals, up to ${MAX_QUESTION_SCORE}`;
        case 'type_invalid': return `${at}"type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), IS (short answer), ES (essay) or PGK (multiple answers)`;
        case 'correct_duplicate': return problem.type === 'MJ' ? `${at}"correct" for MJ uses a right letter more than once`
            : problem.type === 'UR' ? `${at}"correct" for UR uses an item number more than once`
            : `${at}"correct" lists a letter more than once`;
        case 'options_not_allowed': return `${at}options must be empty for ${problem.type === 'MJ' || problem.type === 'UR' || problem.type === 'IA' || problem.type === 'ES' || problem.type === 'IS' ? problem.type : 'BS'}`;
        case 'columns_missing': return problem.type === 'UR' ? `${at}UR needs the v2 header with left_1..left_10` : `${at}MJ needs the v2 header with left_1..left_10 and right_a..right_l`;
        case 'ordering_items_invalid': return `${at}UR needs 2 to 10 items, filled in order from left_1`;
        case 'matching_items_invalid': return problem.side === 'right'
            ? `${at}MJ needs as many right items as left items, plus at most 2, filled in order from right_a`
            : `${at}MJ needs 2 to 10 left items, filled in order from left_1`;
        case 'items_duplicate': return problem.type === 'IS' ? `${at}IS accepted forms must differ after normalization`
            : problem.type === 'UR' ? `${at}items must differ from each other` : `${at}${problem.side === 'right' ? 'right' : 'left'} items must differ from each other`;
        case 'items_not_allowed': return problem.type === 'UR' ? `${at}right item columns are not used for UR`
            : problem.type === 'IS' ? `${at}right item columns are not used for IS`
            : problem.type === 'IA' ? `${at}item columns are not used for IA`
            : problem.type === 'ES' ? `${at}item columns are not used for ES`
            : `${at}left and right item columns are only for MJ and UR`;
        case 'tolerance_invalid': return `${at}"tolerance" must be empty or a non-negative number`;
        case 'tolerance_not_allowed': return `${at}"tolerance" is only for IA`;
        case 'correct_not_allowed': return problem.type === 'IS' ? `${at}"correct" must be empty for IS (accepted forms go in left_1..left_10)`
            : `${at}"correct" must be empty for ES (graded by the teacher)`;
        case 'rubric_not_allowed': return `${at}"rubric" is only for ES and teacher-graded IS`;
        case 'short_answer_forms_invalid': return `${at}IS accepted forms must be filled in order from left_1, at most 10, each one line of at most 200 characters without unsupported characters`;
    }
}
