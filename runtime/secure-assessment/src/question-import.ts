import { CsvError, parseCsv, type CsvRow } from './ops/provisioning/csv.ts';

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
export type QuestionTemplate = typeof QUESTIONS_TEMPLATE | typeof QUESTIONS_TEMPLATE_V2;
export type ImportQuestionType = 'PG' | 'PGK';
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
    | 'correct_duplicate';

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
}

export interface ParsedQuestion {
    line: number;
    no: number;
    prompt: string;
    /** Five option texts in the authored order, shown as A to E. */
    options: string[];
    /** PG: the correct option (0-4). PGK: -1; use correctIndexes. */
    correctIndex: number;
    maxScore: number;
    /** PG for every v1 row. */
    type: ImportQuestionType;
    /** The correct options in A-E order: one for PG, one to five for PGK. */
    correctIndexes: number[];
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

function headerOf(row: CsvRow | undefined): QuestionTemplate | null {
    if (!row) return null;
    for (const [template, header] of [[QUESTIONS_TEMPLATE, QUESTIONS_HEADER], [QUESTIONS_TEMPLATE_V2, QUESTIONS_HEADER_V2]] as const) {
        const cells = trimTrailingEmpty(row.cells.map(c => c.trim().toLowerCase()), header.length);
        if (cells.length === header.length && cells.every((c, i) => c === header[i])) return template;
    }
    return null;
}

/** Spreadsheets sometimes keep empty columns after the last one; they carry nothing. */
function trimTrailingEmpty(cells: string[], columns: number = QUESTIONS_HEADER.length): string[] {
    let end = cells.length;
    while (end > columns && cells[end - 1].trim() === '') end--;
    return end === cells.length ? cells : cells.slice(0, end);
}

function readRows(text: string): { rows: CsvRow[]; template: QuestionTemplate } | { problem: QuestionProblem } {
    // The header decides the separator: commas, or semicolons as spreadsheets set to
    // Indonesian save them.
    const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split('\n').map(l => l.replace(/\r$/, ''));
    const headerIndex = lines.findIndex(l => l.trim() !== '');
    if (headerIndex < 0) return { problem: { code: 'file_empty', line: null } };
    let template: QuestionTemplate | null = null;
    const delimiter = ([',', ';'] as const).find(candidate => {
        try {
            template = headerOf(parseCsv(lines[headerIndex], candidate)[0]);
            return template !== null;
        } catch {
            return false;
        }
    });
    if (!delimiter || !template) return { problem: { code: 'header_invalid', line: headerIndex + 1 } };
    try {
        return { rows: parseCsv(text, delimiter), template };
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
    const template = read.template;
    const v2 = template === QUESTIONS_TEMPLATE_V2;
    const columns = v2 ? QUESTIONS_HEADER_V2.length : QUESTIONS_HEADER.length;

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
        const [no, prompt, a, b, c, d, e, correct, score] = v2 ? [cells[0], ...cells.slice(2)] : cells;
        const type: ImportQuestionType | null = typeCell === 'PG' || typeCell === 'PGK' ? typeCell : null;
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
        const maxScore = SCORE_FORMAT.test(score) ? Number(score.replace(',', '.')) : NaN;
        if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) {
            problems.push({ code: 'score_invalid', line });
            return;
        }
        questions.push({ line, no: index + 1, prompt, options, correctIndex, maxScore, type, correctIndexes });
    });
    return { questions, problems, template };
}

/** The operator CLI's wording of a problem (English, operator-facing). */
export function describeQuestionProblem(problem: QuestionProblem): string {
    const at = problem.line === null ? '' : `line ${problem.line}: `;
    switch (problem.code) {
        case 'not_text': return 'the questions file is not a text CSV file (a spreadsheet workbook?); save it as "CSV UTF-8"';
        case 'encoding_invalid': return `${at}the file is not UTF-8 text; save it as "CSV UTF-8"`;
        case 'csv_syntax': return `${at}the file is not valid CSV (check the double quotes)`;
        case 'header_invalid': return `${at}header must be exactly: ${QUESTIONS_HEADER.join(',')} (${QUESTIONS_TEMPLATE}) or ${QUESTIONS_HEADER_V2.join(',')} (${QUESTIONS_TEMPLATE_V2})`;
        case 'file_empty': return 'the questions file has no questions';
        case 'too_many_questions': return `the file has ${problem.found} questions; at most ${problem.expected} per import`;
        case 'column_count': return `${at}expected ${problem.expected ?? QUESTIONS_HEADER.length} columns, found ${problem.found}`;
        case 'number_out_of_order': return `${at}"no" must be ${problem.expected} (questions are numbered 1, 2, 3 in order)`;
        case 'prompt_empty': return `${at}the question text is empty`;
        case 'option_empty': return `${at}all five options (A to E) are required; missing ${problem.letters?.join(', ')}`;
        case 'options_duplicate': return `${at}options must be different from each other (${problem.letters?.join(', ')})`;
        case 'correct_multiple': return `${at}"correct" must be exactly one of A, B, C, D, E (single-answer questions)`;
        case 'correct_invalid': return `${at}"correct" must be one of A, B, C, D, E`;
        case 'score_invalid': return `${at}"score" must be a positive number with at most two decimals, up to ${MAX_QUESTION_SCORE}`;
        case 'type_invalid': return `${at}"type" must be PG (single answer) or PGK (multiple answers)`;
        case 'correct_duplicate': return `${at}"correct" lists a letter more than once`;
    }
}
