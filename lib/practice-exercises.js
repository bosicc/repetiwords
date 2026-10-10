export function getTranslation(word, language) {
  const preferred = language === 'uk' ? word.ukrainian : word.english;
  return (typeof preferred === 'string' && preferred.trim() ? preferred : word.english || '').trim();
}

export function getTranslationLanguage(word, language) {
  return language === 'uk' && word.ukrainian?.trim() ? 'uk' : 'en';
}

export function normalizeTranslation(value) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function translationsEquivalent(left, right, language) {
  const meaning = normalizeTranslation(getTranslation(left, language));
  if (!meaning) return false;
  if (meaning === normalizeTranslation(getTranslation(right, language))) return true;
  if (getTranslationLanguage(left, language) !== language || getTranslationLanguage(right, language) !== language) {
    const leftMeanings = meaningVariants(left.english || '');
    return [...meaningVariants(right.english || '')].some((variant) => leftMeanings.has(variant));
  }
  return false;
}

export function shuffleWithSeed(items, seed) {
  let state = 2166136261;
  for (const character of String(seed)) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function meaningVariants(label) {
  return new Set(label.split(/[\/;]/).map(normalizeTranslation).filter(Boolean));
}

// Stable options survive refresh; overlapping listed meanings cannot be distractors.
export function createChoiceQuestion(word, vocabulary, language) {
  const label = getTranslation(word, language);
  if (!label) return null;
  const seen = meaningVariants(label);
  seen.add(normalizeTranslation(label));
  const englishMeanings = meaningVariants(word.english || '');
  const ukrainianMeanings = meaningVariants(word.ukrainian || '');
  const options = [{ id: word.id, label, language: getTranslationLanguage(word, language) }];
  for (const candidate of shuffleWithSeed(vocabulary, `${word.id}:${language}:distractors`)) {
    if (candidate.id === word.id) continue;
    const candidateLabel = getTranslation(candidate, language);
    if (!candidateLabel) continue;
    const variants = meaningVariants(candidateLabel);
    variants.add(normalizeTranslation(candidateLabel));
    const englishVariants = meaningVariants(candidate.english || '');
    const ukrainianVariants = meaningVariants(candidate.ukrainian || '');
    if ([...variants].some((meaning) => seen.has(meaning)) ||
        [...englishVariants].some((meaning) => englishMeanings.has(meaning)) ||
        [...ukrainianVariants].some((meaning) => ukrainianMeanings.has(meaning))) continue;
    options.push({ id: candidate.id, label: candidateLabel, language: getTranslationLanguage(candidate, language) });
    for (const meaning of variants) seen.add(meaning);
    for (const meaning of englishVariants) englishMeanings.add(meaning);
    for (const meaning of ukrainianVariants) ukrainianMeanings.add(meaning);
    if (options.length === 4) break;
  }
  return options.length === 4 ? shuffleWithSeed(options, `${word.id}:${language}:options`) : null;
}

export function createChoiceQuestions(words, vocabulary) {
  return Object.fromEntries(['en', 'uk'].map((language) => [language,
    Object.fromEntries(words.map((word) => [word.id, createChoiceQuestion(word, vocabulary, language)])),
  ]));
}

export function gradeChoiceAnswer(word, vocabulary, optionId, language) {
  if (!['en', 'uk'].includes(language) || !Number.isSafeInteger(optionId)) throw new Error('Invalid choice');
  const question = createChoiceQuestion(word, vocabulary, language);
  if (!question?.some((option) => option.id === optionId)) throw new Error('Invalid choice');
  return { wordId: word.id, known: word.id === optionId, revealed: false };
}

// Replay taps on the server so a round cannot be saved with client-supplied scores.
export function gradeMatchingRound(words, attempts, language) {
  if (!['en', 'uk'].includes(language) || !Array.isArray(words) || words.length < 1 || words.length > 6 ||
      !Array.isArray(attempts) || attempts.length < 1 || attempts.length > 500) throw new Error('Invalid matching round');
  const byId = new Map(words.map((word) => [word.id, word]));
  if (byId.size !== words.length || words.some((word) => !getTranslation(word, language))) throw new Error('Invalid matching round');
  const left = new Set(byId.keys());
  const right = new Set(byId.keys());
  const mistakes = new Set();
  for (const attempt of attempts) {
    const { wordId, translationId } = attempt || {};
    if (!Number.isSafeInteger(wordId) || !Number.isSafeInteger(translationId) ||
        !left.has(wordId) || !right.has(translationId)) throw new Error('Invalid matching attempt');
    if (translationsEquivalent(byId.get(wordId), byId.get(translationId), language)) {
      left.delete(wordId);
      right.delete(translationId);
    } else {
      mistakes.add(wordId);
      mistakes.add(translationId);
    }
  }
  if (left.size || right.size) throw new Error('Matching round is incomplete');
  return words.map((word) => ({ wordId: word.id, known: !mistakes.has(word.id), revealed: false }));
}
