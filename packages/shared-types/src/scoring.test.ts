import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTrueFalse, normalizeShortAnswer, compareShortAnswer, scoreMcq } from './scoring';

describe('scoreTrueFalse', () => {
  const correct = [true, false, true, false];

  it('scores 0.1 for 1 correct', () => {
    assert.equal(scoreTrueFalse([true, true, false, true], correct), 0.1);
  });

  it('scores 0.25 for 2 correct', () => {
    assert.equal(scoreTrueFalse([true, false, false, true], correct), 0.25);
  });

  it('scores 0.5 for 3 correct', () => {
    assert.equal(scoreTrueFalse([true, false, true, true], correct), 0.5);
  });

  it('scores 1.0 for 4 correct', () => {
    assert.equal(scoreTrueFalse([true, false, true, false], correct), 1.0);
  });

  it('scores 0 for 0 correct', () => {
    assert.equal(scoreTrueFalse([false, true, false, true], correct), 0);
  });
});

describe('normalizeShortAnswer', () => {
  it('converts comma to dot and trims', () => {
    assert.equal(normalizeShortAnswer('  3,14 '), '3.14');
  });
});

describe('compareShortAnswer', () => {
  it('matches normalized answers', () => {
    assert.equal(compareShortAnswer('3,14', '3.14'), true);
  });
});

describe('scoreMcq', () => {
  it('awards full score on match', () => {
    assert.equal(scoreMcq('A', 'A', 0.25), 0.25);
  });

  it('awards zero on mismatch', () => {
    assert.equal(scoreMcq('B', 'A', 0.25), 0);
  });
});
