import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { MAX_IMPORT_QUESTIONS, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// The canonical question file (elligble-questions-v1, D04.3-61/62/64): every problem is
// reported with its line and a machine code the teacher's screen words in Indonesian; comma
// and semicolon files read alike; nothing half-valid is returned as a question.

const HEADER = 'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score';

test('a valid file gives the questions in order with their key and score', () => {
    const file = parseQuestionFile([
        HEADER,
        '1,Ibu kota Indonesia adalah,Bandung,Jakarta,Surabaya,Medan,Makassar,B,2',
        '2,"Hasil dari 7 × 8 adalah",54,56,58,64,72,b,1',
        '3,"Kata ""cepat"" termasuk",kata benda,kata kerja,kata sifat,kata keterangan,kata ganti,C,"1,5"',
    ].join('\r\n') + '\r\n');
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.line, q.no, q.correctIndex, q.maxScore]), [[2, 1, 1, 2], [3, 2, 1, 1], [4, 3, 2, 1.5]]);
    assert.equal(file.questions[2].prompt, 'Kata "cepat" termasuk');
    assert.deepEqual(file.questions[0].options, ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar']);
});

test('a semicolon file with a byte order mark reads like a comma file', () => {
    const file = parseQuestionFile('﻿' + HEADER.replaceAll(',', ';') + '\n1;Soal;a;b;c;d;e;E;2,5\n\n');
    assert.deepEqual(file.problems, []);
    assert.equal(file.questions[0].correctIndex, 4);
    assert.equal(file.questions[0].maxScore, 2.5);
});

test('every row problem is reported with its line and code', () => {
    const file = parseQuestionFile([
        HEADER.replaceAll(',', ';'),
        '1;Soal satu;a;b;c;d;e;A;1',
        '3;Soal dua;a;b;c;d;e;A;1',
        '3;;a;b;c;d;e;A;1',
        '4;Soal empat;a;;c;;e;A;1',
        '5;Soal lima;Ya;ya;c;d;e;A;1',
        '6;Soal enam;a;b;c;d;e;A dan C;1',
        '7;Soal tujuh;a;b;c;d;e;F;1',
        '8;Soal delapan;a;b;c;d;e;A;0',
        '9;Soal sembilan;a;b;c;d;e;A;1,555',
        '10;Soal sepuluh;a;b;c;d;e;A;1;;',
        '11;Soal sebelas;a;b;c;d;e;A',
        '12;Soal dua belas;a;b;c;d;e;A;1001',
    ].join('\n'));
    assert.deepEqual(file.problems, [
        { code: 'number_out_of_order', line: 3, expected: 2 },
        { code: 'prompt_empty', line: 4 },
        { code: 'option_empty', line: 5, letters: ['B', 'D'] },
        { code: 'options_duplicate', line: 6, letters: ['A', 'B'] },
        { code: 'correct_multiple', line: 7 },
        { code: 'correct_invalid', line: 8 },
        { code: 'score_invalid', line: 9 },
        { code: 'score_invalid', line: 10 },
        { code: 'column_count', line: 12, found: 8 },
        { code: 'score_invalid', line: 13 },
    ]);
    // Only the rows without a problem are questions (trailing empty columns carry nothing).
    assert.deepEqual(file.questions.map(q => q.line), [2, 11]);
});

test('files that are not the template are refused as a whole', () => {
    assert.deepEqual(parseQuestionFile('nomor,soal\n1,x\n').problems, [{ code: 'header_invalid', line: 1 }]);
    assert.deepEqual(parseQuestionFile('\n\n' + HEADER.toUpperCase() + '\n').problems, [{ code: 'file_empty', line: null }]);
    assert.deepEqual(parseQuestionFile('   \n').problems, [{ code: 'file_empty', line: null }]);
    assert.deepEqual(parseQuestionFile('PK\u0003\u0004binary').problems, [{ code: 'not_text', line: null }]);
    assert.deepEqual(parseQuestionFile(HEADER + '\n1,Soal �,a,b,c,d,e,A,1\n').problems, [{ code: 'encoding_invalid', line: 2 }]);
    assert.deepEqual(parseQuestionFile(HEADER + '\n1,"Soal,a,b,c,d,e,A,1\n').problems, [{ code: 'csv_syntax', line: 2 }]);
    const many = [HEADER, ...Array.from({ length: MAX_IMPORT_QUESTIONS + 1 }, (_, i) => `${i + 1},Soal ${i + 1},a,b,c,d,e,A,1`)].join('\n');
    assert.deepEqual(parseQuestionFile(many).problems, [{ code: 'too_many_questions', line: null, expected: MAX_IMPORT_QUESTIONS, found: MAX_IMPORT_QUESTIONS + 1 }]);
    assert.equal(parseQuestionFile(many.split('\n').slice(0, MAX_IMPORT_QUESTIONS + 1).join('\n')).questions.length, MAX_IMPORT_QUESTIONS);
});

test('scores are positive, with at most two decimals and at most 1000', () => {
    const score = (value: string) => parseQuestionFile(`${HEADER}\n1,Soal,a,b,c,d,e,A,"${value}"\n`);
    for (const ok of ['1', '0,25', '2.5', '1000', '999,99']) assert.deepEqual(score(ok).problems, [], ok);
    for (const bad of ['0', '0,00', '-1', '1,234', '1e3', '1000,01', 'satu', '']) assert.equal(score(bad).problems[0]?.code, 'score_invalid', bad);
});

test('the operator CLI words every problem in English with its line', () => {
    assert.equal(describeQuestionProblem({ code: 'number_out_of_order', line: 3, expected: 2 }), 'line 3: "no" must be 2 (questions are numbered 1, 2, 3 in order)');
    assert.match(describeQuestionProblem({ code: 'header_invalid', line: 1 }), /^line 1: header must be exactly: no,prompt,option_a/);
    assert.match(describeQuestionProblem({ code: 'option_empty', line: 5, letters: ['B', 'D'] }), /missing B, D$/);
});
