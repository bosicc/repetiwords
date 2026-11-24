// The client must already be in the transaction that applies the course migrations.
export async function importSpanishVocabulary(client, words) {
  await client.query('LOCK TABLE vocpt.words, vocpt.word_groups IN SHARE ROW EXCLUSIVE MODE');
  await client.query(`CREATE TEMP TABLE spanish_batch (
    portuguese text PRIMARY KEY, source_english text NOT NULL, source_ukrainian text,
    term text NOT NULL CHECK (btrim(term) <> ''), english text NOT NULL, ukrainian text
  ) ON COMMIT DROP`);
  await client.query(`INSERT INTO spanish_batch
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS batch(
      portuguese text, source_english text, source_ukrainian text, term text, english text, ukrainian text
    )`, [JSON.stringify(words)]);
  const { rows: mismatches } = await client.query(`SELECT coalesce(w.portuguese,b.portuguese) AS word
    FROM (SELECT * FROM vocpt.words WHERE study_language='pt-PT') w FULL JOIN spanish_batch b USING (portuguese)
    WHERE w.id IS NULL OR b.portuguese IS NULL OR w.english IS DISTINCT FROM b.source_english
      OR w.ukrainian IS DISTINCT FROM b.source_ukrainian ORDER BY word`);
  if (!words.length || mismatches.length) {
    throw new Error(`Source vocabulary differs from the translation batch (${mismatches.length} entries): ${mismatches.slice(0, 20).map(row => row.word).join(', ')}`);
  }
  const added = await client.query(`INSERT INTO vocpt.words
    (study_language, source_word_id, translated_term, english, ukrainian, level)
    SELECT 'es-ES', w.id, b.term, b.english, b.ukrainian, w.level
    FROM spanish_batch b JOIN vocpt.words w USING (portuguese)
    ON CONFLICT (study_language, source_word_id) DO NOTHING`);
  const conflicts = await client.query(`SELECT b.portuguese FROM spanish_batch b
    JOIN vocpt.words w USING (portuguese)
    JOIN vocpt.words es ON es.source_word_id=w.id AND es.study_language='es-ES'
    WHERE es.translated_term IS DISTINCT FROM b.term OR es.english IS DISTINCT FROM b.english
       OR es.ukrainian IS DISTINCT FROM b.ukrainian`);
  if (conflicts.rows.length) throw new Error(`Existing Spanish entries differ: ${conflicts.rows.map(row => row.portuguese).slice(0,20).join(', ')}`);
  const memberships = await client.query(`INSERT INTO vocpt.word_groups (word_id,group_id)
    SELECT es.id, wg.group_id FROM vocpt.words es JOIN vocpt.word_groups wg ON wg.word_id=es.source_word_id
    WHERE es.study_language='es-ES' ON CONFLICT DO NOTHING`);
  return { sourceWords: words.length, added: added.rowCount, membershipsAdded: memberships.rowCount };
}
