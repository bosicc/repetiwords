import { getWords } from '../lib/database.js';
console.log(`SQLite database ready: ${getWords().length} words in data/vocabulary.sqlite`);
