import test from 'node:test';
import assert from 'node:assert/strict';
import { createChoiceQuestion, getTranslation, getTranslationLanguage, gradeChoiceAnswer, gradeMatchingRound } from '../lib/practice-exercises.js';

const words = [
  { id: 1, portuguese: 'janela', english: 'window', ukrainian: 'вікно' },
  { id: 2, portuguese: 'porta', english: 'door', ukrainian: 'двері' },
  { id: 3, portuguese: 'parede', english: 'wall', ukrainian: 'стіна' },
  { id: 4, portuguese: 'telhado', english: 'roof', ukrainian: 'дах' },
];

test('choice questions have four distinct meanings and survive refresh', () => {
  const vocabulary = [...words, { id: 5, portuguese: 'vidraça', english: 'window / pane', ukrainian: 'вікно / шибка' }];
  for (const language of ['en', 'uk']) {
    const options = createChoiceQuestion(words[0], vocabulary, language);
    assert.equal(options.length, 4);
    assert.equal(options.filter((option) => option.id === 1).length, 1);
    assert.ok(!options.some((option) => option.id === 5));
    assert.deepEqual(options, createChoiceQuestion(words[0], vocabulary, language));
    assert.deepEqual(gradeChoiceAnswer(words[0], vocabulary, 1, language), { wordId: 1, known: true, revealed: false });
    assert.equal(gradeChoiceAnswer(words[0], vocabulary, 2, language).known, false);
    assert.throws(() => gradeChoiceAnswer(words[0], vocabulary, 5, language), /Invalid choice/);
    assert.throws(() => gradeChoiceAnswer(words[0], vocabulary, 9999, language), /Invalid choice/);
  }
});

test('missing Ukrainian translations fall back explicitly and insufficient choice pools are unavailable', () => {
  const word = { id: 8, portuguese: 'café', english: 'coffee', ukrainian: null };
  assert.equal(getTranslation(word, 'uk'), 'coffee');
  assert.equal(getTranslationLanguage(word, 'uk'), 'en');
  assert.equal(createChoiceQuestion(word, [word, words[0]], 'uk'), null);
  assert.throws(() => gradeChoiceAnswer(word, [word], 8, 'uk'), /Invalid choice/);
});

test('choice distractors cannot repeat the correct meaning in another language', () => {
  const vocabulary = [...words, { id: 5, portuguese: 'vidraça', english: 'window', ukrainian: null }];
  const options = createChoiceQuestion(words[0], vocabulary, 'uk');
  assert.equal(options.length, 4);
  assert.ok(!options.some((option) => option.id === 5));
  assert.throws(() => gradeChoiceAnswer(words[0], vocabulary, 5, 'uk'), /Invalid choice/);
});

test('matching replay grades wrong taps and returns answers in session order', () => {
  const results = gradeMatchingRound(words, [
    { wordId: 1, translationId: 2 },
    { wordId: 3, translationId: 3 },
    { wordId: 1, translationId: 1 },
    { wordId: 4, translationId: 4 },
    { wordId: 2, translationId: 2 },
  ], 'uk');
  assert.deepEqual(results, words.map((word) => ({ wordId: word.id, known: word.id > 2, revealed: false })));
});

test('matching accepts interchangeable duplicate meanings and one-word final rounds', () => {
  const identical = [words[0], { ...words[0], id: 5, portuguese: 'vidraça', ukrainian: '  ВІКНО  ' }];
  assert.ok(gradeMatchingRound(identical, [{ wordId: 1, translationId: 5 }, { wordId: 5, translationId: 1 }], 'uk').every((answer) => answer.known));
  assert.deepEqual(gradeMatchingRound([words[0]], [{ wordId: 1, translationId: 1 }], 'en'), [{ wordId: 1, known: true, revealed: false }]);
});

test('matching accepts the same meaning displayed as an English fallback', () => {
  const mixed = [words[0], { id: 5, portuguese: 'vidraça', english: 'window / pane', ukrainian: null }];
  assert.ok(gradeMatchingRound(mixed, [{ wordId: 1, translationId: 5 }, { wordId: 5, translationId: 1 }], 'uk').every((answer) => answer.known));
});

test('matching cannot grade incomplete, replayed, foreign, or malformed card attempts', () => {
  assert.throws(() => gradeMatchingRound(words, [{ wordId: 1, translationId: 1 }], 'en'), /incomplete/);
  assert.throws(() => gradeMatchingRound(words, [{ wordId: 1, translationId: 1 }, { wordId: 1, translationId: 1 }], 'en'), /Invalid matching attempt/);
  assert.throws(() => gradeMatchingRound(words, [{ wordId: 999, translationId: 1 }], 'en'), /Invalid matching attempt/);
  assert.throws(() => gradeMatchingRound(words, [null], 'en'), /Invalid matching attempt/);
  assert.throws(() => gradeMatchingRound(words, [{ wordId: 1, translationId: 1 }], 'pt'), /Invalid matching round/);
});
