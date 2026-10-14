export function createWordLists(pool, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId || '')) throw new Error('Account required');
  const validId = (id) => { if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid ID'); };
  async function getList(id) {
    validId(id);
    const { rows } = await pool.query('SELECT id, name FROM vocpt.word_lists WHERE id=$1 AND user_id=$2', [id, userId]);
    if (!rows[0]) return null;
    const words = await pool.query(`SELECT w.id, w.portuguese, w.english, w.ukrainian, w.level FROM vocpt.words w
      JOIN vocpt.word_list_words lw ON lw.word_id=w.id JOIN vocpt.word_lists l ON l.id=lw.list_id
      WHERE l.id=$1 AND l.user_id=$2 ORDER BY w.portuguese, w.id`, [id, userId]);
    return { ...rows[0], words: words.rows };
  }
  return {
    getList,
    async getLists() {
      return (await pool.query(`SELECT l.id, l.name, COUNT(lw.word_id)::integer AS total FROM vocpt.word_lists l
        LEFT JOIN vocpt.word_list_words lw ON lw.list_id=l.id WHERE l.user_id=$1
        GROUP BY l.id ORDER BY l.created_at DESC, l.id DESC`, [userId])).rows;
    },
    async createList(name) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Enter a list name (1–80 characters).');
      return (await pool.query('INSERT INTO vocpt.word_lists (user_id,name) VALUES ($1,$2) RETURNING id', [userId, name.trim()])).rows[0].id;
    },
    async addWord(id, wordId) {
      validId(id); validId(wordId);
      if (!await getList(id)) throw new Error('List not found');
      await pool.query(`INSERT INTO vocpt.word_list_words (list_id,word_id)
        SELECT l.id,w.id FROM vocpt.word_lists l CROSS JOIN vocpt.words w
        WHERE l.id=$1 AND l.user_id=$2 AND w.id=$3 ON CONFLICT DO NOTHING`, [id,userId,wordId]);
    },
    async renameList(id, name) {
      validId(id);
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Invalid list name');
      const { rows } = await pool.query('UPDATE vocpt.word_lists SET name=$3 WHERE id=$1 AND user_id=$2 RETURNING id', [id,userId,name.trim()]);
      if (!rows.length) throw new Error('List not found');
    },
    async removeWord(id, wordId) {
      validId(id); validId(wordId);
      if (!await getList(id)) throw new Error('List not found');
      await pool.query(`DELETE FROM vocpt.word_list_words lw USING vocpt.word_lists l
        WHERE lw.list_id=l.id AND l.id=$1 AND l.user_id=$2 AND lw.word_id=$3`, [id,userId,wordId]);
    },
    async searchWords(id, query) {
      if (!await getList(id)) throw new Error('List not found');
      if (typeof query !== 'string' || !query.trim()) return [];
      const term = query.trim().slice(0,80).toLocaleLowerCase();
      return (await pool.query(`SELECT w.id,w.portuguese,w.english,w.ukrainian FROM vocpt.words w
        WHERE (strpos(lower(w.portuguese),$1)>0 OR strpos(lower(w.english),$1)>0 OR strpos(lower(COALESCE(w.ukrainian,'')),$1)>0)
        AND NOT EXISTS (SELECT 1 FROM vocpt.word_list_words lw WHERE lw.list_id=$2 AND lw.word_id=w.id)
        ORDER BY CASE WHEN lower(w.portuguese)=$1 THEN 0 ELSE 1 END,w.portuguese,w.id LIMIT 12`, [term,id])).rows;
    },
  };
}
