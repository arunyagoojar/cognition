import os
from bs4 import BeautifulSoup
import json

filepath = "/Users/arunyagoojar/Downloads/ielts-website/ielts-listening-test-163/index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    html = f.read()
    
soup = BeautifulSoup(html, 'html.parser')
button = soup.find('button', id=lambda x: x and x.startswith('bg-showmore-action-'))
if button:
    # The answer block might be a sibling or a specific div controlled by this button
    print("BUTTON ID:", button.get('id'))
    # Let's just find the next sibling div or the div with a related id
    parent = button.parent
    print("PARENT OR SIBLINGS OF BUTTON:")
    for sibling in button.find_next_siblings():
        print(str(sibling)[:500])
    # or it might be another element altogether
    
# Let's also look for ordered lists or anything that looks like an answer key (e.g. 1.4 L, 2. Automatic, etc.)
# Let's search for "1.4" which is a likely answer for Engine size, or look for typical Answer key tables
tables = soup.find_all('table')
for i, table in enumerate(tables):
    print(f"\nTABLE {i}:")
    print(table.text[:200])

