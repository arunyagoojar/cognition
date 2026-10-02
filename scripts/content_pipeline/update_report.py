import json
from collections import Counter

with open('tmp/content-extraction-full-v2/reports/needs_review.json') as f:
    data = json.load(f)
c = Counter()
for d in data:
    if 'error' in d and d['error']:
        for err in d['error']:
            c[err] += 1

with open('tmp/content-extraction-full-v2/reports/final_report.md', 'r') as f:
    lines = f.readlines()

new_lines = []
in_analysis = False
for line in lines:
    if line.startswith('18. What are the ten most common failure reasons?'):
        new_lines.append(line)
        new_lines.append('\n')
        for k, v in c.most_common(10):
            new_lines.append(f'- **{v} occurrences**: {k}\n')
        new_lines.append('\n')
        in_analysis = True
    elif line.startswith('19. Which source-page structures were not handled'):
        in_analysis = False
        new_lines.append(line)
        new_lines.append('\n')
        new_lines.append('- **Merged Tests**: Pages with 60-80 questions imply multiple tests are stitched together on a single HTML page. The Region-First parser correctly parsed the groups, but the validator failed the strict 40-question limit.\n')
        new_lines.append('- **Base64 Lazy Images**: WordPress lazy-loading puts `data:image/gif;base64...` in the `src` attribute. The parser tried to resolve this as a local file, causing "Asset missing" errors.\n')
        new_lines.append('- **Short Passage 1s**: Some Reading tests have a very brief introductory text before the first question, failing the `> 1500 chars` heuristic for initializing Passage 1.\n')
        new_lines.append('\n')
    elif line.startswith('20. Are there any parser assumptions that failed'):
        new_lines.append(line)
        new_lines.append('\n')
        new_lines.append('- **Answer Leakage Strictness**: The validator assumes that if the correct answer string (e.g. "FALSE") appears in the question text, it is an answer leak. However, for True/False/Not Given questions, the instruction "Write TRUE, FALSE or NOT GIVEN" is naturally in the shared question text, causing false positives.\n')
        new_lines.append('\n')
    elif not in_analysis:
        new_lines.append(line)

with open('tmp/content-extraction-full-v2/reports/final_report.md', 'w') as f:
    f.writelines(new_lines)
