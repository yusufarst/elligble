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
    | 'score_invalid';

export interface QuestionProblem {
    code: QuestionProblemCode;
    /** Line of the file (1-based) the problem belongs to, when it belongs to one. */
    line: number | null;
    /** number_out_of_order: the number this row must have. too_many_questions: the limit. */
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
    correctIndex: number;
    maxScore: number;
}

export interface QuestionFile {
    questions: ParsedQuestion[];
    problems: QuestionProblem[];
}

const SCORE_FORMAT = /^\d{1,4}([.,]\d{1,2})?$/;
const SEVERAL_LETTERS = /^[A-E](\s*(,|;|\/|&|dan|and)?\s*[A-E])+$/i;

function lineOf(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
}

function headerMatches(row: CsvRow | undefined): boolean {
    if (!row) return false;
    const cells = trimTrailingEmpty(row.cells.map(c => c.trim().toLowerCase()));
    return cells.length === QUESTIONS_HEADER.length && cells.every((c, i) => c === QUESTIONS_HEADER[i]);
}

/** Spreadsheets sometimes keep empty columns after the last one; they carry nothing. */
function trimTrailingEmpty(cells: string[]): string[] {
    let end = cells.length;
    while (end > QUESTIONS_HEADER.length && cells[end - 1].trim() === '') end--;
    return end === cells.length ? cells : cells.slice(0, end);
}

function readRows(text: string): { rows: CsvRow[] } | { problem: QuestionProblem } {
    // The header decides the separator: commas, or semicolons as spreadsheets set to
    // Indonesian save them.
    const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split('\n').map(l => l.replace(/\r$/, ''));
    const headerIndex = lines.findIndex(l => l.trim() !== '');
    if (headerIndex < 0) return { problem: { code: 'file_empty', line: null } };
    const delimiter = ([',', ';'] as const).find(candidate => {
        try {
            return headerMatches(parseCsv(lines[headerIndex], candidate)[0]);
        } catch {
            return false;
        }
    });
    if (!delimiter) return { problem: { code: 'header_invalid', line: headerIndex + 1 } };
    try {
        return { rows: parseCsv(text, delimiter) };
    } catch (err) {
        if (err instanceof CsvError) return { problem: { code: 'csv_syntax', line: err.line } };
        throw err;
    }
}

export function parseQuestionFile(text: string): QuestionFile {
    // A workbook or other binary file read as text: ZIP signature (xlsx, docx) or NUL bytes.
    if (text.startsWith('PK\u0003\u0004') || text.includes('\u0000')) {
        return { questions: [], problems: [{ code: 'not_text', line: null }] };
    }
    const replaced = text.indexOf('�');
    if (replaced >= 0) {
        return { questions: [], problems: [{ code: 'encoding_invalid', line: lineOf(text, replaced) }] };
    }
    const read = readRows(text);
    if ('problem' in read) return { questions: [], problems: [read.problem] };

    const rows = read.rows.slice(1);
    const problems: QuestionProblem[] = [];
    const questions: ParsedQuestion[] = [];
    if (rows.length === 0) return { questions, problems: [{ code: 'file_empty', line: null }] };
    if (rows.length > MAX_IMPORT_QUESTIONS) {
        return { questions, problems: [{ code: 'too_many_questions', line: null, expected: MAX_IMPORT_QUESTIONS, found: rows.length }] };
    }

    rows.forEach((row, index) => {
        const cells = trimTrailingEmpty(row.cells.map(c => c.trim()));
        const line = row.line;
        if (cells.length !== QUESTIONS_HEADER.length) {
            problems.push({ code: 'column_count', line, found: cells.length });
            return;
        }
        const [no, prompt, a, b, c, d, e, correct, score] = cells;
        const options = [a, b, c, d, e];
        if (no !== String(index + 1)) {
            problems.push({ code: 'number_out_of_order', line, expected: index + 1 });
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
        const key = correct.toUpperCase();
        const correctIndex = (OPTION_LETTERS as readonly string[]).indexOf(key);
        if (correctIndex < 0) {
            problems.push({ code: SEVERAL_LETTERS.test(correct) ? 'correct_multiple' : 'correct_invalid', line });
            return;
        }
        const maxScore = SCORE_FORMAT.test(score) ? Number(score.replace(',', '.')) : NaN;
        if (!(maxScore > 0 && maxScore <= MAX_QUESTION_SCORE)) {
            problems.push({ code: 'score_invalid', line });
            return;
        }
        questions.push({ line, no: index + 1, prompt, options, correctIndex, maxScore });
    });
    return { questions, problems };
}

/** The operator CLI's wording of a problem (English, operator-facing). */
export function describeQuestionProblem(problem: QuestionProblem): string {
    const at = problem.line === null ? '' : `line ${problem.line}: `;
    switch (problem.code) {
        case 'not_text': return 'the questions file is not a text CSV file (a spreadsheet workbook?); save it as "CSV UTF-8"';
        case 'encoding_invalid': return `${at}the file is not UTF-8 text; save it as "CSV UTF-8"`;
        case 'csv_syntax': return `${at}the file is not valid CSV (check the double quotes)`;
        case 'header_invalid': return `${at}header must be exactly: ${QUESTIONS_HEADER.join(',')} (${QUESTIONS_TEMPLATE})`;
        case 'file_empty': return 'the questions file has no questions';
        case 'too_many_questions': return `the file has ${problem.found} questions; at most ${problem.expected} per import`;
        case 'column_count': return `${at}expected ${QUESTIONS_HEADER.length} columns, found ${problem.found}`;
        case 'number_out_of_order': return `${at}"no" must be ${problem.expected} (questions are numbered 1, 2, 3 in order)`;
        case 'prompt_empty': return `${at}the question text is empty`;
        case 'option_empty': return `${at}all five options (A to E) are required; missing ${problem.letters?.join(', ')}`;
        case 'options_duplicate': return `${at}options must be different from each other (${problem.letters?.join(', ')})`;
        case 'correct_multiple': return `${at}"correct" must be exactly one of A, B, C, D, E (single-answer questions)`;
        case 'correct_invalid': return `${at}"correct" must be one of A, B, C, D, E`;
        case 'score_invalid': return `${at}"score" must be a positive number with at most two decimals, up to ${MAX_QUESTION_SCORE}`;
    }
}
