import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createQueryAdapter } from './postgres.js';
import { isPracticeMode } from './practice-modes.js';
import { createChoiceQuestions, gradeMatchingRound, shuffleWithSeed } from './practice-exercises.js';

export const validShareToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const hash = value => validShareToken(value) ? createHash('sha256').update(value).digest('hex') : null;

export function createSharedLists(pool) {
  const db = createQueryAdapter(pool);
  function requireAccount(userId) { if (!validUuid(userId)) throw new Error('Account required'); }
  async function ownedList(id, userId) {
    requireAccount(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid list');
    const list = await db.get('SELECT id,name FROM vocpt.word_lists WHERE id=? AND user_id=? FOR UPDATE', id, userId);
    if (!list) throw new Error('List not found');
    return list;
  }
  async function getPublicList(token, userId = null) {
    if (!validShareToken(token)) return null;
    const list = await db.get(`SELECT l.id,l.name,l.user_id FROM vocpt.list_shares s
      JOIN vocpt.word_lists l ON l.id=s.list_id WHERE s.token=?`, token);
    if (!list) return null;
    const words = await db.all(`SELECT w.id,w.portuguese,w.english,w.ukrainian,w.level FROM vocpt.words w
      JOIN vocpt.word_list_words lw ON lw.word_id=w.id WHERE lw.list_id=? ORDER BY w.portuguese,w.id`, list.id);
    return { id: list.id, name: list.name, isOwner: list.user_id === userId, words };
  }
  function accessible(row, userId, guestSecret) {
    return row && (row.user_id ? row.user_id === userId :
      row.guest_hash === hash(guestSecret) && Date.parse(`${row.expires_at.replace(' ', 'T')}Z`) > Date.now());
  }
  function sessionView(row) {
    return { id: row.id, name: row.list_name, token: row.share_token, signedIn: Boolean(row.user_id), ...row.state };
  }
  async function accountSession(userId, state) {
    const { lastInsertRowid: id } = await db.run('INSERT INTO vocpt.sessions (user_id,practice_mode) VALUES (?,?) RETURNING id', userId, state.mode);
    for (let position = 0; position < state.words.length; position++) {
      await db.run('INSERT INTO vocpt.session_words (session_id,word_id,position,completed) VALUES (?,?,?,?)', id, state.words[position].id, position, position < state.index ? 1 : 0);
    }
    for (const answer of state.answers) {
      await db.run('INSERT INTO vocpt.answers (session_id,word_id,known,revealed) VALUES (?,?,?,?)', id, answer.wordId, Number(answer.known), Number(answer.revealed));
    }
    return id;
  }
  return {
    getPublicList,
    async findAccountPractice(accountSessionId, userId) {
      requireAccount(userId);
      return (await db.get('SELECT id FROM vocpt.shared_practices WHERE account_session_id=? AND user_id=?', accountSessionId, userId))?.id || null;
    },
    async getShare(id, userId) {
      requireAccount(userId);
      return (await db.get(`SELECT s.token FROM vocpt.list_shares s JOIN vocpt.word_lists l ON l.id=s.list_id
        WHERE l.id=? AND l.user_id=?`, id, userId))?.token || null;
    },
    async enableShare(id, userId) {
      return db.transaction(async () => {
        await ownedList(id, userId);
        const existing = await db.get('SELECT token FROM vocpt.list_shares WHERE list_id=?', id);
        if (existing) return existing.token;
        const token = randomBytes(32).toString('hex');
        await db.run('INSERT INTO vocpt.list_shares (list_id,token) VALUES (?,?)', id, token);
        return token;
      })();
    },
    async disableShare(id, userId) {
      return db.transaction(async () => {
        await ownedList(id, userId);
        await db.run('DELETE FROM vocpt.list_shares WHERE list_id=?', id);
      })();
    },
    async saveList(token, userId) {
      requireAccount(userId);
      if (!validShareToken(token)) throw new Error('List not found');
      return db.transaction(async () => {
        const source = await db.get(`SELECT l.id,l.name,l.user_id FROM vocpt.list_shares s
          JOIN vocpt.word_lists l ON l.id=s.list_id WHERE s.token=? FOR UPDATE OF l,s`, token);
        if (!source) throw new Error('List not found');
        if (source.user_id === userId) return source.id;
        const existing = await db.get('SELECT id FROM vocpt.word_lists WHERE user_id=? AND copied_from_list_id=?', userId, source.id);
        if (existing) return existing.id;
        const { lastInsertRowid: id } = await db.run('INSERT INTO vocpt.word_lists (user_id,name,copied_from_list_id) VALUES (?,?,?) RETURNING id', userId, source.name, source.id);
        await db.run('INSERT INTO vocpt.word_list_words (list_id,word_id) SELECT ?,word_id FROM vocpt.word_list_words WHERE list_id=?', id, source.id);
        return id;
      })();
    },
    async start(token, { userId = null, guestSecret = null, count = 30, mode = 'self-assessment' } = {}) {
      if (userId) requireAccount(userId);
      if (!userId && !hash(guestSecret)) throw new Error('Guest browser required');
      if (![10,30,100].includes(count) || !isPracticeMode(mode)) throw new Error('Invalid practice settings');
      return db.transaction(async () => {
        // Expired guest data is removed whenever another shared practice starts.
        await db.run("DELETE FROM vocpt.shared_practices WHERE user_id IS NULL AND expires_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')");
        if (!validShareToken(token) || !await db.get('SELECT list_id FROM vocpt.list_shares WHERE token=? FOR SHARE', token)) throw new Error('List not found');
        const list = await getPublicList(token, userId);
        if (!list?.words.length) throw new Error('No vocabulary available');
        const id = randomUUID();
        const words = shuffleWithSeed(list.words, id).slice(0, count);
        const vocabulary = mode === 'multiple-choice' ? await db.all('SELECT id,english,ukrainian FROM vocpt.words') : [];
        const state = { mode, words, questions: mode === 'multiple-choice' ? createChoiceQuestions(words, vocabulary) : null, answers: [], index: 0 };
        const accountId = userId ? await accountSession(userId, state) : null;
        await db.run(`INSERT INTO vocpt.shared_practices (id,user_id,guest_hash,expires_at,account_session_id,share_token,list_name,state)
          VALUES (?,?,?,CASE WHEN ?::boolean THEN NULL ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '24 hours' END,?,?,?,?::jsonb)`,
        id, userId, userId ? null : hash(guestSecret), Boolean(userId), accountId, token, list.name, JSON.stringify(state));
        return id;
      })();
    },
    async getPractice(id, userId, guestSecret) {
      if (!validUuid(id)) return null;
      const row = await db.get('SELECT * FROM vocpt.shared_practices WHERE id=?', id);
      return accessible(row, userId, guestSecret) ? sessionView(row) : null;
    },
    async submit(id, userId, guestSecret, input) {
      if (!validUuid(id)) throw new Error('Practice not found');
      return db.transaction(async () => {
        const row = await db.get('SELECT * FROM vocpt.shared_practices WHERE id=? FOR UPDATE', id);
        if (!accessible(row, userId, guestSecret)) throw new Error('Practice not found');
        const state = row.state;
        let results, start;
        if (state.mode === 'matching') {
          const { attempts, language, roundSize } = input;
          if (!Number.isInteger(roundSize) || roundSize < 1 || roundSize > 6 || !Array.isArray(attempts)) throw new Error('Invalid round');
          // A round may begin with any word, so find its first position.
          const ids = new Set(attempts.map(attempt => attempt?.wordId));
          start = state.words.findIndex(word => ids.has(word.id));
          const words = state.words.slice(start, start + roundSize);
          if (start < 0 || ids.size !== roundSize || words.length !== roundSize || words.some(word => !ids.has(word.id))) throw new Error('Invalid round');
          results = gradeMatchingRound(words, attempts, language);
        } else {
          start = state.words.findIndex(word => word.id === input.wordId);
          if (start < 0) throw new Error('Invalid word');
          let known = input.known, revealed = false;
          if (input.skip === true) known = null;
          else if (state.mode === 'multiple-choice') {
            if (!['en','uk'].includes(input.language) || !Number.isSafeInteger(input.optionId) ||
              !state.questions[input.language][input.wordId]?.some(option => option.id === input.optionId)) throw new Error('Invalid choice');
            known = input.optionId === input.wordId;
          } else {
            if (typeof known !== 'boolean' && known !== null || typeof input.revealed !== 'boolean') throw new Error('Invalid answer');
            revealed = input.revealed;
          }
          results = [{ wordId: input.wordId, known, revealed }];
        }
        if (start < state.index) {
          if (start + results.length > state.index || results.some(result => {
            const saved = state.answers.find(answer => answer.wordId === result.wordId);
            return result.known === null ? Boolean(saved) : !saved || saved.known !== result.known || saved.revealed !== result.revealed;
          })) throw new Error('Already answered');
          return results;
        }
        if (start !== state.index) throw new Error('Answer out of order');
        for (const result of results) {
          if (result.known !== null) state.answers.push(result);
          if (row.account_session_id) {
            if (result.known !== null) await db.run('INSERT INTO vocpt.answers (session_id,word_id,known,revealed) VALUES (?,?,?,?)', row.account_session_id, result.wordId, Number(result.known), Number(result.revealed));
            await db.run('UPDATE vocpt.session_words SET completed=1 WHERE session_id=? AND word_id=?', row.account_session_id, result.wordId);
          }
        }
        state.index += results.length;
        await db.run('UPDATE vocpt.shared_practices SET state=?::jsonb WHERE id=?', JSON.stringify(state), id);
        return results;
      })();
    },
    async claim(id, userId, guestSecret) {
      requireAccount(userId);
      if (!validUuid(id)) throw new Error('Practice not found');
      return db.transaction(async () => {
        const row = await db.get('SELECT * FROM vocpt.shared_practices WHERE id=? FOR UPDATE', id);
        if (!accessible(row, userId, guestSecret)) throw new Error('Practice not found');
        if (row.user_id) return;
        if (row.state.index !== row.state.words.length) throw new Error('Finish practice first');
        const accountId = await accountSession(userId, row.state);
        await db.run('UPDATE vocpt.shared_practices SET user_id=?,guest_hash=NULL,expires_at=NULL,account_session_id=? WHERE id=?', userId, accountId, id);
      })();
    },
  };
}
