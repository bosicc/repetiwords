"""Extract vocabulary lists from a downloaded Portuguese with Carla article."""
import json
import re
import sys
from html.parser import HTMLParser


class VocabularyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.tag = None
        self.parent = None
        self.group = None
        self.words = []

    def handle_starttag(self, tag, attrs):
        if tag in ('h2', 'h3', 'h4', 'p', 'li'):
            self.tag, self.parts = tag, []

    def handle_data(self, data):
        if self.tag:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag != self.tag:
            return
        text = ' '.join(''.join(self.parts).split())
        self.tag = None
        if tag == 'h2' and text == 'The 1000 Most Common Portuguese Words (Part 1)':
            self.active = True
            return
        if tag == 'h3' and text == 'How Many Portuguese Words Do You Need to Be Fluent?':
            self.active = False
        if not self.active:
            return
        title = re.sub(r'\s*\([^)]*\)$', '', text)
        title = {'Anatomia': 'Anatomy', 'Clothing and Acessories': 'Clothing and Accessories'}.get(title, title)
        if tag == 'h3':
            self.parent = self.group = title
        elif tag == 'h4' or (tag == 'p' and (re.fullmatch(r'[^()]+\([^()]+\)', text) or text == 'Miscellaneous')):
            self.group = title
        elif tag == 'li':
            match = re.fullmatch(r'(.+?)\s*\((.+)\)', text)
            if not match or not self.group:
                raise ValueError(f'Unexpected vocabulary item: {text}')
            self.words.append({
                'portuguese': match[1].strip(), 'english': match[2].strip(),
                'groups': list(dict.fromkeys([self.parent, self.group])),
            })


if __name__ == '__main__':
    parser = VocabularyParser()
    with open(sys.argv[1], encoding='utf-8') as source:
        parser.feed(source.read())
    if not parser.words:
        raise ValueError('No vocabulary found; source structure may have changed')
    batch = {
        'source': 'https://portuguesewithcarla.com/1000-most-common-portuguese-words/',
        'prepared_at': sys.argv[3],
        'stage': 'extracted',
        'words': parser.words,
    }
    with open(sys.argv[2], 'x', encoding='utf-8') as output:
        json.dump(batch, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(f'Extracted {len(parser.words)} entries')
