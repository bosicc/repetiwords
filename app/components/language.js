'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ukrainian = {
  'Practice sessions': 'Сесії практики', 'Last 20 sessions': 'Останні 20 сесій', 'Session': 'Сесія',
  'Words completed': 'Слів опрацьовано', 'In progress': 'Триває',
  'Complete your first practice to see your sessions here.': 'Пройдіть першу практику, щоб побачити тут свої сесії.',
  'One segment = one word. Select a session or hover over a word for details.': 'Один сегмент = одне слово. Оберіть сесію або наведіть на слово, щоб побачити деталі.',
  'Changes are saved automatically.': 'Зміни зберігаються автоматично.',
  'Could not save settings. Please try again.': 'Не вдалося зберегти налаштування. Спробуйте ще раз.',
  'Language': 'Мова', 'Interface and translation language': 'Мова інтерфейсу та перекладів',
  'Language is saved automatically.': 'Мова зберігається автоматично.',
  'Session words': 'Слова сесії', 'Your answer': 'Ваша відповідь', 'NO': 'НІ', 'YES': 'ТАК',
  'YES · With hints': 'ТАК · З підказкою', 'YES · Without hints': 'ТАК · Без підказки',
  'Word': 'Слово', 'Session progress': 'Прогрес сесії',
  'A little progress, every day.': 'Щодня — крок уперед.', 'Without hints': 'Без підказки', 'With hints': 'З підказкою',
  'To review': 'Для повторення', 'Skipped': 'Пропущено', 'Words answered': 'Слів опрацьовано',
  'Word progress': 'Прогрес слів', 'Distribution': 'Розподіл', 'New': 'Нові', 'Learning': 'Вивчаються', 'Mastered': 'Засвоєні', 'Mastered words': 'Засвоєні слова',
  'Mastered = 3 consecutive YES answers without revealing the translation. Last 14 days.': 'Засвоєно = 3 відповіді ТАК поспіль без підказки. Останні 14 днів.',
  'Settings': 'Налаштування', 'Save settings': 'Зберегти налаштування', 'Settings saved.': 'Налаштування збережено.',
  'This choice applies to new practice sessions.': 'Цей вибір застосовується до нових сесій практики.',
  'Home': 'Головна', 'Words per session': 'Слів у сесії', 'Starting…': 'Починаємо…',
  'Random words. Answers saved automatically.': 'Випадкові слова. Відповіді зберігаються автоматично.',
  'European Portuguese · Words are shuffled for every session.': 'Європейська португальська · Слова перемішуються для кожної сесії.',
  'Practice': 'Практика', 'Vocabulary': 'Словник', 'Main navigation': 'Головна навігація',
  'A little Portuguese,': 'Трохи португальської,', 'every day.': 'щодня.',
  'Build your vocabulary. Revisit mistakes. Find your words.': 'Поповнюйте словник. Повторюйте помилки. Знаходьте свої слова.',
  'Learning statistics': 'Статистика навчання', 'Words reviewed': 'Слів повторено', 'Success rate': 'Успішність',
  'Practice points remaining': 'Балів для повторення',
  'European Portuguese · Words with the most mistakes come first.': 'Європейська португальська · Спочатку слова з найбільшою кількістю помилок.',
  'VOCPT · YOUR WORDS': 'VOCPT · ВАШІ СЛОВА', 'Total vocabulary': 'Увесь словник',
  'Explore all your Portuguese words by level and category.': 'Переглядайте португальські слова за рівнем і категорією.',
  'Vocabulary list': 'Список слів', 'Word level': 'Рівень слова', 'All levels': 'Усі рівні', 'Unassigned': 'Не визначено',
  'Category': 'Категорія', 'All categories': 'Усі категорії', 'Uncategorized': 'Без категорії', 'Reset filters': 'Скинути фільтри',
  'Portuguese': 'Португальська', 'English': 'Англійська', 'Ukrainian': 'Українська', 'Level': 'Рівень',
  'No words match these filters.': 'За цими фільтрами слів не знайдено.',
  'Vocabulary practice': 'Практика словника', 'DAILY PRACTICE': 'ЩОДЕННА ПРАКТИКА',
  'Do you know what this word means?': 'Ви знаєте значення цього слова?', 'Hide meaning': 'Приховати значення', 'Reveal meaning': 'Показати значення',
  'Meaning revealed · YES counts as 50% success.': 'Значення показано · ТАК зараховується як 50% успіху.',
  'NO · Practice again': 'НІ · Повторити', 'Skip': 'Пропустити', 'YES · I know it': 'ТАК · Знаю', 'Space': 'Пробіл',
  'SESSION COMPLETE': 'СЕСІЮ ЗАВЕРШЕНО', 'Session success': 'Успішність сесії',
  'known without help': 'відомо без підказки', 'known after reveal': 'відомо після підказки', 'to practice again': 'для повторення',
  'words skipped.': 'слів пропущено.', 'No answers to save.': 'Немає відповідей для збереження.',
  'Practice again': 'Практикувати знову', 'Saving…': 'Збереження…', 'Save session': 'Зберегти сесію',
  'Your answers are saved.': 'Ваші відповіді збережено.',
  'Could not save your session. Please try again.': 'Не вдалося зберегти сесію. Спробуйте знову.',
  'Translation unavailable': 'Переклад відсутній', 'Showing': 'Показано', 'of': 'із', 'words': 'слів',
};
const Context = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  useEffect(() => {
    try { if (localStorage.getItem('vocpt-language') === 'uk') setLanguage('uk'); } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function selectLanguage(value) {
    setLanguage(value);
    try { localStorage.setItem('vocpt-language', value); } catch {}
  }
  const t = (text) => language === 'uk' ? ukrainian[text] || text : text;
  return <Context.Provider value={{ language, t, selectLanguage }}>
    {children}
  </Context.Provider>;
}

export function useLanguage() { return useContext(Context); }
export function LanguageSettings() {
  const { language, t, selectLanguage } = useLanguage();
  return <section className="card settings-section" aria-labelledby="language-heading">
    <h2 id="language-heading">{t('Language')}</h2>
    <p>{t('Interface and translation language')}</p>
    <div className="language-bar" role="group" aria-label={t('Language')}>
      <button type="button" aria-pressed={language === 'en'} onClick={() => selectLanguage('en')}><span aria-hidden="true">🇬🇧</span> English</button>
      <button type="button" aria-pressed={language === 'uk'} onClick={() => selectLanguage('uk')}><span aria-hidden="true">🇺🇦</span> Українська</button>
    </div>
    <p className="settings-note">{t('Language is saved automatically.')}</p>
  </section>;
}
export function Text({ children }) { const { t } = useLanguage(); return t(children); }
