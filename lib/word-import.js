const levels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export function isSingleWord(value) {
  return typeof value === 'string' && /^\p{L}+(?:-\p{L}+)*$/u.test(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be non-empty text`);
  return value.trim().normalize('NFC');
}

export function validateBatch(batch) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new Error('Expected a batch object');
  const source = text(batch.source, 'source');
  const preparedAt = text(batch.prepared_at, 'prepared_at');
  if (!Array.isArray(batch.words) || batch.words.length === 0) throw new Error('words must be a non-empty array');
  const seen = new Set();
  const words = batch.words.map((word, index) => {
    const label = `words[${index}]`;
    if (!word || typeof word !== 'object' || Array.isArray(word)) throw new Error(`${label} must be an object`);
    const portuguese = text(word.portuguese, `${label}.portuguese`);
    if (!isSingleWord(portuguese)) throw new Error(`${label}: expected one word; split phrases and gender alternatives before importing`);
    if (seen.has(portuguese)) throw new Error(`${label}: duplicate word ${portuguese}; merge meanings and groups first`);
    seen.add(portuguese);
    if (!levels.has(word.level)) throw new Error(`${label}: invalid CEFR level`);
    if (!Array.isArray(word.groups)) throw new Error(`${label}.groups must be an array`);
    if ('mastery_level' in word) throw new Error(`${label}: imported words cannot set mastery_level`);
    return {
      portuguese, english: text(word.english, `${label}.english`),
      ukrainian: text(word.ukrainian, `${label}.ukrainian`), level: word.level,
      groups: [...new Set(word.groups.map((group) => text(group, `${label}.groups`)))],
    };
  });
  return { source, prepared_at: preparedAt, words };
}
