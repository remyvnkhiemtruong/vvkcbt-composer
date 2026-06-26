import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWordText, MAX_WORD_IMPORT } from './wordImport';
import { getPartLabelVi, getClusterSubtypeVi, getQuestionTypeVi } from './composer-labels';

describe('parseWordText', () => {
  it('parses MCQ blocks with answer key', () => {
    const text = `
Câu 1. Tính 2 + 2?
A. 3
B. 4
C. 5
D. 6
Đáp án: B

Câu 2. Thủ đô Việt Nam?
A. Hà Nội
B. TP.HCM
C. Đà Nẵng
D. Huế
Đáp án: A
`;
    const { questions, errors } = parseWordText(text);
    assert.equal(errors.length, 0);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].type, 'mcq');
    assert.equal(questions[0].correctKey, 'B');
    assert.equal(questions[0].options?.length, 4);
    assert.match(questions[0].stem, /2 \+ 2/);
  });

  it('parses short answer when no options', () => {
    const text = `Câu 1. Điền số π (làm tròn 2 chữ số)
Đáp án: 3.14`;
    const { questions } = parseWordText(text);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].type, 'short_answer');
    assert.equal(questions[0].correctKey, '3.14');
  });

  it('reports error for empty text', () => {
    const { questions, errors } = parseWordText('   ');
    assert.equal(questions.length, 0);
    assert.ok(errors.some((e) => e.includes('trống')));
  });

  it('reports error when no numbered questions', () => {
    const { questions, errors } = parseWordText('Đề thi không có số câu');
    assert.equal(questions.length, 0);
    assert.ok(errors.length > 0);
  });

  it('respects MAX_WORD_IMPORT cap', () => {
    assert.ok(MAX_WORD_IMPORT >= 200);
  });
});

describe('composer-labels', () => {
  it('returns Vietnamese question type labels', () => {
    assert.equal(getQuestionTypeVi('mcq'), 'Trắc nghiệm');
    assert.equal(getQuestionTypeVi('true_false'), 'Đúng/Sai');
  });

  it('returns Vietnamese cluster subtype labels', () => {
    assert.match(getClusterSubtypeVi('fill_notice', 5), /Thông báo/);
    assert.match(getClusterSubtypeVi('reading_10', 10), /10 câu/);
  });

  it('returns Vietnamese part labels for MATH', () => {
    const label = getPartLabelVi('MATH', 'part1_mcq');
    assert.match(label, /Phần 1/);
    assert.match(label, /Trắc nghiệm/);
  });
});
