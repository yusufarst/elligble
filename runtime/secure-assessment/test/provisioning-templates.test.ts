import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePeopleCsv } from '../src/ops/provisioning/people.ts';
import { validateAcademicSetup } from '../src/ops/provisioning/academic.ts';
import { parseQuestionsCsv, validateExamSetup } from '../src/ops/provisioning/exam.ts';
import { parseCsv } from '../src/ops/provisioning/csv.ts';

// The example templates in the operations runbook must stay importable.

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/production/provisioning-templates');
const read = (name: string) => readFileSync(path.join(TEMPLATES, name), 'utf8');

test('documented provisioning templates are valid', () => {
    assert.deepEqual(parsePeopleCsv(read('people.example.csv')).problems, []);
    assert.deepEqual(validateAcademicSetup(JSON.parse(read('academic.example.json'))).problems, []);
    assert.deepEqual(validateExamSetup(JSON.parse(read('exam.example.json'))).problems, []);
    const questions = parseQuestionsCsv(read('questions.example.csv'));
    assert.deepEqual(questions.problems, []);
    assert.equal(questions.questions.length, 3);
});

test('people rows are validated as a whole before anything is written', () => {
    const parsed = parsePeopleCsv('elligble_id,full_name,kind\nsiswa.a,A,student\nSiswa.A,B,student\na@b.c,C,student\nsiswa.d,,student\nsiswa.e,E,guru\n');
    assert.deepEqual(parsed.rows.map(r => r.elligbleId), ['siswa.a']);
    assert.deepEqual(parsed.problems.map(p => p.line), [3, 4, 5, 6]);
    assert.throws(() => parsePeopleCsv('id,name\nx,y\n'), /header must be exactly/);
});

test('questions must be numbered in order, five distinct options and a letter key', () => {
    const header = 'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score\n';
    assert.match(parseQuestionsCsv(header + '2,Soal,a,b,c,d,e,A,1\n').problems[0], /"no" must be 1/);
    assert.match(parseQuestionsCsv(header + '1,Soal,a,b,c,d,e,F,1\n').problems[0], /A, B, C, D, E/);
    assert.match(parseQuestionsCsv(header + '1,Soal,a,a,c,d,e,A,1\n').problems[0], /different/);
    assert.match(parseQuestionsCsv(header + '1,Soal,a,b,c,d,e,A,0\n').problems[0], /positive/);
    const ok = parseQuestionsCsv(header + '1,"Soal, dengan koma",a,b,c,d,e,e,"2,5"\n');
    assert.deepEqual(ok.problems, []);
    const content = ok.questions[0] as { prompt: string; options: Array<{ id: string }>; correctOptionId: string; maxScore: number };
    assert.equal(content.prompt, 'Soal, dengan koma');
    assert.equal(content.correctOptionId, content.options[4].id);
    assert.equal(content.maxScore, 2.5);
});

test('the CSV reader handles quotes, escaped quotes, CRLF and a byte order mark', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n"multi\nline",z\n');
    assert.deepEqual(rows.map(r => r.cells), [['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z']]);
    assert.deepEqual(rows.map(r => r.line), [1, 2, 4]);
    assert.throws(() => parseCsv('"open'), /unterminated/);
});
