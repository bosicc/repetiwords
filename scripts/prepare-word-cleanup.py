"""Build a reviewable replacement plan; does not write to SQLite."""
import importlib.util
import json
from pathlib import Path
import re
import sqlite3
import sys

spec = importlib.util.spec_from_file_location('phrases', Path(__file__).with_name('parse-carla-phrases.py'))
phrases = importlib.util.module_from_spec(spec)
spec.loader.exec_module(phrases)


def forms(value):
    # Expand single-word gender shorthand before tokenizing complete phrases.
    def gender(match):
        stem, suffix = match.groups()
        if suffix in ('a', 'as'):
            ending = 'os' if suffix == 'as' else 'o'
            feminine = stem[:-len(ending)] + suffix if stem.endswith(ending) else stem + suffix
            return stem + ' ' + feminine
        return stem + ' ' + suffix
    value = re.sub(r'([^\W\d_]+)/(as|a|o)\b', gender, value)
    return phrases.word_forms(value)


if __name__ == '__main__':
    database = sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True)
    database.row_factory = sqlite3.Row
    all_words = [dict(row) for row in database.execute('SELECT * FROM words')]
    memberships = database.execute('SELECT wg.word_id, g.name FROM word_groups wg JOIN groups g ON g.id=wg.group_id').fetchall()
    groups = {}
    for row in memberships:
        groups.setdefault(row['word_id'], []).append(row['name'])
    valid = {row['portuguese'] for row in all_words if re.fullmatch(r'[^\W\d_]+(?:-[^\W\d_]+)*', row['portuguese'])}
    invalid = [row for row in all_words if row['portuguese'] not in valid]
    components = {}
    replacements = []
    for row in invalid:
        tokens = forms(row['portuguese'])
        if not tokens:
            raise ValueError(f'No words extracted from {row["portuguese"]}')
        replacements.append({'id': row['id'], 'portuguese': row['portuguese'], 'components': tokens})
        for token in tokens:
            candidate = components.setdefault(token, {'portuguese': token, 'groups': [], 'source_word_ids': []})
            candidate['groups'] = list(dict.fromkeys(candidate['groups'] + groups.get(row['id'], [])))
            candidate['source_word_ids'].append(row['id'])
    plan = {'source': 'local SQLite vocabulary cleanup', 'prepared_at': sys.argv[3],
            'replacements': replacements, 'components': list(components.values())}
    with open(sys.argv[2], 'x', encoding='utf8') as output:
        json.dump(plan, output, ensure_ascii=False, indent=2)
        output.write('\n')
    missing = sorted(set(components) - valid)
    print(f'{len(invalid)} non-word records; {len(components)} unique components; {len(missing)} new words')
    print(' | '.join(missing))
