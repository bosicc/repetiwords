import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('phrase_parser', Path(__file__).with_name('parse-carla-phrases.py'))
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)
cleanup_spec = importlib.util.spec_from_file_location('cleanup', Path(__file__).with_name('prepare-word-cleanup.py'))
cleanup = importlib.util.module_from_spec(cleanup_spec)
cleanup_spec.loader.exec_module(cleanup)


class PhraseParserTests(unittest.TestCase):
    def test_cleanup_expands_gender_without_adding_fragments(self):
        self.assertEqual(cleanup.forms('professor/a'), ['professor', 'professora'])
        self.assertEqual(cleanup.forms('aluno/a'), ['aluno', 'aluna'])
        self.assertEqual(cleanup.forms('quantos/as'), ['quantos', 'quantas'])
        self.assertEqual(cleanup.forms('a/o'), ['a', 'o'])
        self.assertEqual(cleanup.forms('a que horas abre?'), ['a', 'que', 'horas', 'abre'])

    def test_unique_forms_keep_accents_compounds_and_inflections(self):
        self.assertEqual(parser.word_forms('EU tenho chá, chá e pequeno-almoço.'),
                         ['eu', 'tenho', 'chá', 'e', 'pequeno-almoço'])
        self.assertEqual(parser.word_forms('O nome é [name]. Wi-Fi!'), ['o', 'nome', 'é', 'wi-fi'])
        self.assertEqual(parser.word_forms('Cafe\u0301'), ['café'])

    def test_alternatives_and_attached_pronouns(self):
        self.assertEqual(parser.word_forms('Pode ajudar-me?'), ['pode', 'ajudar', 'me'])
        self.assertEqual(parser.word_forms('conhecê-lo/a'), ['conhecer', 'lo', 'la'])
        self.assertEqual(parser.variants('Pode repetir/dizer outra vez?'),
                         ['Pode repetir outra vez?', 'Pode dizer outra vez?'])
        self.assertEqual(parser.word_forms('Estou só a ver, obrigado /a.'),
                         ['estou', 'só', 'a', 'ver', 'obrigado', 'obrigada'])

    def test_lists_exclude_surrounding_content_and_handle_inline_markup(self):
        instance = parser.PhraseParser()
        instance.feed('''<li>Outside (Ignored)</li>
          <h3>Phrases for Greetings &amp; Introductions</h3>
          <ul><li><strong>Olá</strong> (Hello)</li><li>Até logo (See you later</li></ul>
          <h3>Portuguese Phrases for Emergencies and Health</h3>
          <ul><li>Pode ligar para o cento e doze (112)? (Can you call 911?)</li></ul>
          <h2>European Portuguese vs Brazilian Portuguese Phrases</h2>
          <li>Outside (Ignored)</li>''')
        self.assertEqual(len(instance.entries), 3)
        self.assertEqual(instance.entries[0]['portuguese'], 'Olá')
        self.assertEqual(instance.entries[1]['english'], 'See you later')
        self.assertEqual(instance.entries[2]['portuguese'], 'Pode ligar para o cento e doze (112)?')
        self.assertEqual(instance.entries[2]['english'], 'Can you call 911?')


if __name__ == '__main__':
    unittest.main()
