import os
from bs4 import BeautifulSoup
import json

filepath = "/Users/arunyagoojar/Downloads/ielts-website/ielts-listening-test-163/index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    html = f.read()
    
soup = BeautifulSoup(html, 'html.parser')
article = soup.find('article') or soup.find(class_=lambda x: x and 'content' in x.lower())

# Extract all text in the article
texts = list(article.stripped_strings)
print("FIRST 50 STRINGS IN ARTICLE:")
for t in texts[:50]:
    print(repr(t))

# Look for answers (e.g. an element with ID or class 'answer', or text 'Answer Key')
answer_blocks = soup.find_all(string=lambda text: text and 'Answer' in text)
answer_parents = [str(a.parent) for a in answer_blocks[:5]]
print("\nANSWER BLOCKS:")
for a in answer_parents:
    print(a)
