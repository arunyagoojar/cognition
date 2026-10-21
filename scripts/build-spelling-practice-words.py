#!/usr/bin/env python3
"""Build a fresh-word pool from the already bundled, licensed WordNet corpus.
Rank dictionary words by their frequency in WordNet's own definitions so new
sessions can avoid recently learned words without reusing them as filler.
This is a local corpus ranking, not a claim about general English frequency.
"""
import collections,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
entries={}
for file in (root/'public-static/spelling').glob('[a-z].json'):entries.update(json.loads(file.read_text()))
counts=collections.Counter(token for row in entries.values() for token in re.findall(r'[a-z]{4,12}',row[0].lower()))
words=[word for word,count in counts.most_common() if word in entries and count>=8]
output=root/'src/data/spelling/practiceWords.json'
output.write_text(json.dumps(words,separators=(',',':'))+'\n')
print(len(words),'dictionary words;',', '.join(words[:35]))
