"""Extract the article's phrase lists and unique Portuguese word forms."""
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser

SOURCE = 'https://portuguesewithcarla.com/99-essential-european-portuguese-phrases/'


def variants(phrase):
    if ' or ' in phrase:
        return phrase.split(' or ')
    if phrase == 'Obrigado /Obrigada':
        return ['Obrigado', 'Obrigada']
    if phrase == 'Muito obrigado /Muito obrigada':
        return ['Muito obrigado', 'Muito obrigada']
    if 'obrigado /a.' in phrase:
        return [phrase.replace('obrigado /a.', ending + '.') for ending in ('obrigado', 'obrigada')]
    if 'repetir/dizer' in phrase:
        return [phrase.replace('repetir/dizer', verb) for verb in ('repetir', 'dizer')]
    if 'conhecê-lo/a' in phrase:
        return [phrase.replace('conhecê-lo/a', form) for form in ('conhecê-lo', 'conhecê-la')]
    return [phrase]


def word_forms(phrase):
    phrase = re.sub(r'\[[^]]*\]', '', phrase)
    forms = []
    for variant in variants(phrase):
        for token in re.findall(r'[^\W\d_]+(?:-[^\W\d_]+)*', unicodedata.normalize('NFC', variant).lower()):
            if token in ('conhecê-lo', 'conhecê-la'):
                forms.extend(['conhecer', token.rsplit('-', 1)[1]])
            elif re.search(r'-(me|te|se|nos|vos)$', token):
                forms.extend(token.rsplit('-', 1))
            else:
                forms.append(token)
    return list(dict.fromkeys(forms))


class PhraseParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.heading = None
        self.li_depth = 0
        self.group = None
        self.entries = []

    def handle_starttag(self, tag, attrs):
        if tag in ('h2', 'h3', 'h4'):
            self.heading, self.heading_parts = tag, []
        if tag == 'li':
            self.li_depth += 1
            if self.li_depth == 1:
                self.parts = []

    def handle_data(self, data):
        if self.heading:
            self.heading_parts.append(data)
        if self.li_depth:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == self.heading:
            title = ' '.join(''.join(self.heading_parts).split())
            self.heading = None
            if title == 'Phrases for Greetings & Introductions':
                self.active = True
            elif title == 'European Portuguese vs Brazilian Portuguese Phrases':
                self.active = False
            if self.active and tag in ('h3', 'h4'):
                self.group = title
        if tag != 'li' or not self.li_depth:
            return
        self.li_depth -= 1
        if not self.active or self.li_depth:
            return
        raw = ' '.join(''.join(self.parts).split())
        separator = ' (Can you call' if ' (112)? (Can you call' in raw else ' ('
        portuguese, found, english = raw.partition(separator)
        if not found:
            raise ValueError(f'Cannot separate phrase and meaning: {raw}')
        if separator != ' (':
            english = 'Can you call' + english
        english = english.removesuffix(')')
        self.entries.append({'portuguese': portuguese, 'english': english, 'groups': [self.group], 'source_text': raw})


if __name__ == '__main__':
    parser = PhraseParser()
    with open(sys.argv[1], encoding='utf-8') as source:
        parser.feed(source.read())
    if not parser.entries:
        raise ValueError('No phrase entries found; check page structure')
    unique = {}
    for index, entry in enumerate(parser.entries):
        for form in word_forms(entry['portuguese']):
            record = unique.setdefault(form, {'portuguese': form, 'phrase_indices': [], 'groups': []})
            record['phrase_indices'].append(index)
            record['groups'] = list(dict.fromkeys(record['groups'] + entry['groups']))
    batch = {'source': SOURCE, 'prepared_at': sys.argv[3], 'stage': 'extracted', 'phrases': parser.entries,
             'unique_words': list(unique.values()), 'tokenization': 'Lowercase NFC, punctuation and placeholders removed; compounds retained; clitics separated; conhecer restored from conhecê-lo/la; other inflected forms kept, not lemmatized.'}
    with open(sys.argv[2], 'x', encoding='utf-8') as output:
        json.dump(batch, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(f'{len(parser.entries)} source entries, {len(unique)} unique word forms')
