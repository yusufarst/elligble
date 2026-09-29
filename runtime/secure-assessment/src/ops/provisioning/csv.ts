// Minimal RFC 4180 CSV reader for operator templates: comma separated, optional double
// quotes with "" escapes, LF or CRLF line ends, optional UTF-8 byte order mark. Blank lines
// are skipped. Returns rows of raw strings; templates validate their own columns.

export class CsvError extends Error {
    readonly line: number;
    constructor(line: number, message: string) {
        super(`Line ${line}: ${message}`);
        this.name = 'CsvError';
        this.line = line;
    }
}

export interface CsvRow {
    /** 1-based line number where the row starts, for operator messages. */
    line: number;
    cells: string[];
}

export function parseCsv(text: string): CsvRow[] {
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: CsvRow[] = [];
    let cells: string[] = [];
    let cell = '';
    let quoted = false;
    let line = 1;
    let rowStart = 1;
    let sawAny = false;

    const endRow = () => {
        cells.push(cell);
        if (sawAny || cells.length > 1 || cells[0] !== '') rows.push({ line: rowStart, cells });
        cells = [];
        cell = '';
        sawAny = false;
    };

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quoted) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                if (ch === '\n') line++;
                cell += ch;
            }
            continue;
        }
        if (ch === '"') {
            if (cell.length > 0) throw new CsvError(line, 'a quote must start the cell');
            quoted = true;
            sawAny = true;
        } else if (ch === ',') {
            cells.push(cell);
            cell = '';
            sawAny = true;
        } else if (ch === '\r' && input[i + 1] === '\n') {
            continue;
        } else if (ch === '\n') {
            endRow();
            line++;
            rowStart = line;
        } else {
            cell += ch;
            sawAny = true;
        }
    }
    if (quoted) throw new CsvError(line, 'unterminated quoted cell');
    endRow();
    return rows;
}

/** Checks the header row exactly (the template version is the column set). */
export function requireHeader(rows: CsvRow[], expected: readonly string[], template: string): CsvRow[] {
    if (rows.length === 0) throw new CsvError(1, `empty file; expected the ${template} header`);
    const header = rows[0].cells.map(c => c.trim().toLowerCase());
    if (header.length !== expected.length || header.some((c, i) => c !== expected[i])) {
        throw new CsvError(rows[0].line, `header must be exactly: ${expected.join(',')} (${template})`);
    }
    return rows.slice(1);
}
