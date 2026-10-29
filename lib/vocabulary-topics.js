export const WORD_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function parseWordLevels(level) {
  if (level === null || level === '') return [];
  if (typeof level !== 'string' || level.length > 50) throw new Error('Invalid level');
  const levels = level.split(',');
  if (levels.some(value => ![...WORD_LEVELS, 'unassigned'].includes(value))) throw new Error('Invalid level');
  return [...new Set(levels)];
}

export function formatWordCount(count, language = 'en') {
  const plural = new Intl.PluralRules(language).select(count);
  const word = language === 'uk' ? ({ one: 'слово', few: 'слова', many: 'слів', other: 'слова' })[plural] : count === 1 ? 'word' : 'words';
  return `${new Intl.NumberFormat(language).format(count)} ${word}`;
}

export function validatePracticeScope({ topic = null, level = null } = {}) {
  if (topic !== null && (typeof topic !== 'string' || !topic.trim() || topic.length > 200)) throw new Error('Invalid topic');
  if (level === '') throw new Error('Invalid level');
  parseWordLevels(level);
  return { topic, level };
}

export function filterVocabulary(words, { topic = null, level = null } = {}) {
  const levels = parseWordLevels(level);
  return words.filter((word) =>
    (!levels.length || levels.includes(word.level || 'unassigned')) &&
    (!topic || (topic === 'uncategorized' ? !word.categories.length : word.categories.includes(topic))));
}

const featuredTopics = ['Food and Drink', 'Animals', 'Colors', 'The Human Body', 'Shopping and Payments', 'Restaurants and Cafés'];

export function getVocabularyTopics(words) {
  const topics = new Map();
  for (const word of words) {
    for (const name of new Set(word.categories.length ? word.categories : ['uncategorized'])) {
      if (!topics.has(name)) topics.set(name, { name, count: 0, examples: [] });
      const topic = topics.get(name);
      topic.count++;
      if (topic.examples.length < 3) topic.examples.push(word.portuguese);
    }
  }
  const rank = (name) => featuredTopics.includes(name) ? featuredTopics.indexOf(name) : featuredTopics.length;
  return [...topics.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'en'));
}
