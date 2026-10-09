const dateKey = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export function calculateProgress(wordIds, answers, now = new Date()) {
  const streaks = new Map(wordIds.map((id) => [id, 0]));
  const seen = new Set();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    return dateKey(date);
  });
  const history = [];
  let cursor = 0;
  const ordered = [...answers].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  for (const day of days) {
    while (cursor < ordered.length) {
      const answer = ordered[cursor];
      if (dateKey(new Date(answer.created_at.replace(' ', 'T') + 'Z')) > day) break;
      cursor++;
      if (!streaks.has(answer.word_id)) continue;
      seen.add(answer.word_id);
      streaks.set(answer.word_id, answer.known && !answer.revealed ? streaks.get(answer.word_id) + 1 : 0);
    }
    history.push({ date: day, mastered: [...streaks.values()].filter((streak) => streak >= 3).length });
  }
  const mastered = history.at(-1).mastered;
  return { total: wordIds.length, new: wordIds.length - seen.size, learning: seen.size - mastered, mastered, history };
}
