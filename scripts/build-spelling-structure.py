#!/usr/bin/env python3
"""Extract spelling divisions and etymology from Webster, never guess boundaries.
Usage: python3 scripts/build-spelling-structure.py /path/to/pg29765.txt
Optional --wiktionary seeds enriches the 60 fixed starter entries from English
Wiktionary HTML (build time only; no learner text is sent).
"""
import concurrent.futures, hashlib, json, pathlib, re, sys, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public-static/spelling/structure'
text=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig')
# The printed headwords use *, ` and " to mark syllable/stress boundaries.
# Accept a division only when its letters reconstruct the exact headword.
sections=list(re.finditer(r'^(-?[A-Z][A-Z;-]*(?: [A-Z;-]+)*)\n([^\n]+)',text,re.M))
all_entries={}
for i,match in enumerate(sections):
    heading,first=match.groups(); body=text[match.end(1)+1:sections[i+1].start() if i+1<len(sections) else len(text)]
    for lemma in heading.split('; '):
        key=lemma.lower()
        if not re.fullmatch(r'-?[a-z]{2,30}-?',key): continue
        printed=re.match(r'(-?[A-Za-z][A-Za-z*`"-]*)',first)
        syllables=[]
        if printed:
            parts=[p.lower() for p in re.split(r'[*`"]+',printed[1].strip('-')) if p]
            if ''.join(parts)==key.strip('-'): syllables=parts
        etymology=''
        header=body.split('\n\n',1)[0]
        etym=re.search(r'Etym:\s*\[',header)
        if etym:
            start=etym.end(); depth=1; end=start
            while end<len(header) and depth:
                if header[end]=='[': depth+=1
                elif header[end]==']': depth-=1
                end+=1
            if depth==0: etymology=' '.join(header[start:end-1].split())
        # Some entries use a short language bracket without an Etym label.
        if not etymology:
            short=re.search(r'\[((?:L\.|F\.|AS\.|Gr\.|OE\.|OF\.|Fr\.|D\.|From )[^\]]*)\]',body.split('\n\n')[0])
            if short: etymology=' '.join(short[1].split())
        row={'syllables':syllables,'etymology':etymology,'source':"Webster’s Unabridged Dictionary (1913)",'sourceUrl':'https://www.gutenberg.org/ebooks/29765'}
        definition=re.search(r'Defn:\s*(.*?)(?:\n\n|$)',body,re.S)
        if definition: row['rootDefinition']=' '.join(definition[1].split())
        if key not in all_entries or not all_entries[key]['etymology'] and etymology: all_entries[key]=row
# Follow only explicit combining forms in the dictionary's own + expression.
for key,row in all_entries.items():
    roots=[]
    for term in re.findall(r'(?<![A-Za-z])(?:[A-Za-z]+-|-[A-Za-z]+)(?![A-Za-z])',row['etymology'].split(':')[0]):
        root=all_entries.get(term.lower())
        if root and root.get('rootDefinition'): roots.append({'term':term,'meaning':root['rootDefinition']})
    if roots: row['roots']=roots[:3]
# Limit the shipped structure corpus to spellable words in the existing bank,
# plus all starter words (some function words are absent from WordNet).
seeds=[row[1] for row in json.loads("["+(ROOT/"src/data/spelling/words.js").read_text().split("const rows = [",1)[1].split("\n];",1)[0].rstrip().rstrip(",")+"]")]
targets=set(seeds)
for file in (ROOT/'public-static/spelling').glob('[a-z].json'): targets.update(json.loads(file.read_text()))
entries={word:{k:v for k,v in all_entries[word].items() if k!='rootDefinition'} for word in targets if word in all_entries}
if '--wiktionary' not in sys.argv:
    for file in OUT.glob('[a-z].json'):
        for word,row in json.loads(file.read_text()).items():
            if word in seeds and ('Wiktionary' in row.get('source','') or 'Wiktionary' in row.get('etymologySource','')): entries[word]=row
if '--wiktionary' in sys.argv:
    from bs4 import BeautifulSoup
    def get_word(word):
        url='https://en.wiktionary.org/wiki/'+word
        req=urllib.request.Request(url,headers={'User-Agent':'CognitionDictionaryBuild/1.0 (offline educational word notes)'})
        with urllib.request.urlopen(req,timeout=35) as response: soup=BeautifulSoup(response.read(),'html.parser')
        english=soup.find(id='English')
        if not english: return word,None
        # Gather siblings of the English heading container up to the next language.
        node=english.parent if english.parent.name=='div' else english
        elements=[]
        for sibling in node.next_siblings:
            if getattr(sibling,'name',None) is None: continue
            if sibling.name=='h2' or sibling.find('h2'): break
            elements.append(sibling)
        content=BeautifulSoup(''.join(str(el) for el in elements),'html.parser')
        for item in content.select('.mw-editsection, sup.reference'): item.decompose()
        syllables=[]
        for li in content.find_all('li'):
            value=li.get_text(' ',strip=True)
            if value.startswith('Hyphenation:'):
                for candidate in re.findall(r'[a-z]+(?:[‧·][a-z]+)+',value):
                    parts=re.split('[‧·]',candidate)
                    if ''.join(parts)==word: syllables=parts;break
                if syllables: break
        etymology='';root_notes=[]
        heading=content.find(id=re.compile(r'^Etymology(?:_1)?$'))
        if heading:
            section=heading.parent if heading.parent.name=='div' else heading
            for sibling in section.next_siblings:
                if getattr(sibling,'name',None) is None: continue
                if sibling.name in ['h2','h3','h4'] or sibling.find(['h2','h3','h4']): break
                if sibling.name=='p' and sibling.get_text(strip=True):
                    etymology=sibling.get_text(' ',strip=True);break
        if not etymology and not syllables: return word,None
        permalink=soup.select_one('#t-permalink a')
        source_url='https://en.wiktionary.org'+permalink['href'] if permalink and permalink['href'].startswith('/') else url
        previous=entries.get(word,{})
        row={**previous}
        if syllables: row.update(syllables=syllables,divisionSource='English Wiktionary',divisionSourceUrl=source_url)
        if etymology: row.update(etymology=etymology,etymologySource='English Wiktionary',etymologySourceUrl=source_url);row.pop('roots',None)
        if syllables and etymology: row.update(source='English Wiktionary',sourceUrl=source_url)
        return word,row
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for word,row in pool.map(get_word,seeds):
            if row: entries[word]=row
            print(word, 'Wiktionary' if row else 'Webster fallback',flush=True)
OUT.mkdir(parents=True,exist_ok=True)
for letter in 'abcdefghijklmnopqrstuvwxyz':
    (OUT/(letter+'.json')).write_text(json.dumps({w:entries[w] for w in sorted(entries) if w.startswith(letter)},ensure_ascii=False,separators=(',',':'))+'\n')
manifest={'websterSource':'https://www.gutenberg.org/ebooks/29765','websterSha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'entries':len(entries),'seedCoverage':{word:bool(entries.get(word,{}).get('syllables')) for word in seeds},'wiktionarySeeds':any('Wiktionary' in row.get('etymologySource',row.get('source','')) for row in entries.values())}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built',len(entries),'sourced structure entries. Starter division coverage:',sum(manifest['seedCoverage'].values()),'/',len(seeds))
