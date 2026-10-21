#!/usr/bin/env python3
"""Build static, letter-sharded WordNet 3.0 notes. Usage: python3 scripts/build-spelling-dictionary.py archive.tar.gz
Source: https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz
No dictionary service is contacted at runtime.
"""
import sys, tarfile, json, re, pathlib
out = pathlib.Path(__file__).resolve().parents[1] / 'public-static' / 'spelling'
out.mkdir(parents=True, exist_ok=True)
with tarfile.open(sys.argv[1]) as archive:
    members = {pathlib.PurePosixPath(m.name).name:m for m in archive.getmembers()}
    words = {}
    for pos in ['noun','verb','adj','adv']:
        senses = {}
        for line in archive.extractfile(members['data.'+pos]).read().decode().splitlines():
            if not re.match(r'^\d',line): continue
            meta, gloss = line.split(' | ',1)
            fields = meta.split()
            example = re.findall(r'"([^\"]+)"',gloss)
            meaning = re.split(r';?\s*"',gloss)[0].rstrip('; ')
            senses[fields[0]] = [meaning, example[0] if example else '']
        for line in archive.extractfile(members['index.'+pos]).read().decode().splitlines():
            if not line or line.startswith(' '): continue
            fields=line.split(); word=fields[0]
            if not re.fullmatch('[a-z]{3,30}',word) or word in words: continue
            # Index offset list starts at 6 + number of pointer symbols.
            offset=fields[6+int(fields[3])]
            if offset in senses: words[word]=senses[offset]
    for letter in 'abcdefghijklmnopqrstuvwxyz':
        shard={w:v for w,v in words.items() if w.startswith(letter)}
        (out/(letter+'.json')).write_text(json.dumps(shard,separators=(',',':'))+'\n')
    license_member=members.get('LICENSE')
    if license_member: (out/'LICENSE-WordNet.txt').write_bytes(archive.extractfile(license_member).read())
print(f'Built {len(words)} entries in {out}')
