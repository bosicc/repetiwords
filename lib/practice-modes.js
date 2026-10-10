export const PRACTICE_MODES = [
  {
    id: 'self-assessment',
    title: 'YES / NO',
    description: 'Recall the meaning and rate your answer.',
  },
  {
    id: 'multiple-choice',
    title: 'Choose a translation',
    description: 'Pick the correct meaning from four options.',
  },
  {
    id: 'matching',
    title: 'Match pairs',
    description: 'Connect Portuguese words with their translations.',
  },
];

export function isPracticeMode(value) {
  return typeof value === 'string' && PRACTICE_MODES.some((mode) => mode.id === value);
}
