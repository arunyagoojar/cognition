import os
from bs4 import BeautifulSoup
import json

filepath = "/Users/arunyagoojar/Downloads/ielts-website/ielts-listening-test-163/index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    html = f.read()
    
soup = BeautifulSoup(html, 'html.parser')
article = soup.find('article') or soup.find(class_=lambda x: x and 'content' in x.lower())

# Look for answers (usually in inputs, data attributes, or a script tag)
inputs = article.find_all('input')
input_examples = []
for i in inputs[:5]:
    input_examples.append(str(i))
    
# Check for any inline scripts containing answers
scripts = soup.find_all('script')
answer_scripts = [s.text[:200] for s in scripts if s.string and 'answer' in s.string.lower()]

# Print a snippet of where the text 'Question 1' appears
q_texts = soup.find_all(string=lambda text: text and 'Question 1' in text)
q_parents = [str(q.parent) for q in q_texts[:2]]

print("INPUTS:")
print(json.dumps(input_examples, indent=2))
print("ANSWER SCRIPTS:")
print(json.dumps(answer_scripts, indent=2))
print("QUESTION TEXT PARENTS:")
print(json.dumps(q_parents, indent=2))

