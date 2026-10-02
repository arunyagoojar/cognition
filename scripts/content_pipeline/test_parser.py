import re
from bs4 import BeautifulSoup, NavigableString, Tag

def extract_surrounding_text(node):
    """
    Given an input node, extract the text before and after it within its inline context
    (stopping at block elements or <br> tags).
    """
    before_text = []
    # Walk backward through siblings
    prev_node = node.previous_sibling
    while prev_node:
        if isinstance(prev_node, Tag) and prev_node.name in ['br', 'p', 'div', 'tr', 'td', 'table', 'ul', 'li']:
            break
        if isinstance(prev_node, NavigableString):
            before_text.insert(0, str(prev_node))
        elif isinstance(prev_node, Tag):
            before_text.insert(0, prev_node.get_text())
        prev_node = prev_node.previous_sibling
        
    after_text = []
    # Walk forward
    next_node = node.next_sibling
    while next_node:
        if isinstance(next_node, Tag) and next_node.name in ['br', 'p', 'div', 'tr', 'td', 'table', 'ul', 'li']:
            break
        if isinstance(next_node, NavigableString):
            after_text.append(str(next_node))
        elif isinstance(next_node, Tag):
            after_text.append(next_node.get_text())
        next_node = next_node.next_sibling
        
    return "".join(before_text).strip(), "".join(after_text).strip()

def extract_questions_from_article(article):
    questions = []
    
    # Process text inputs
    for inp in article.find_all('input', type=['text', '']):
        before, after = extract_surrounding_text(inp)
        text = f"{before} [BLANK] {after}".strip()
        
        # Try to find a number in the before text, e.g. "(1)", "1.", or "1 "
        m = re.search(r'\((\d+)\)|(\d+)\.', before)
        if m:
            q_num = int(m.group(1) or m.group(2))
            questions.append({"num": q_num, "text": text, "type": "fill_in_blank", "options": None})
            
    # Process checkboxes (multiple choice)
    # usually structured like:
    # 16. The speaker says...
    # <input type="checkbox"/> A option
    # <input type="checkbox"/> B option
    
    # Find numbers that look like question starts: "16. Text"
    # Actually, it's easier to find the text nodes matching "^\d+\." and grab their siblings.
    for p in article.find_all(['p', 'div', 'td']):
        p_text = p.get_text(separator=' ', strip=True)
        m = re.match(r'^(\d+)\.', p_text)
        if m and p.find('input', type='checkbox'):
            q_num = int(m.group(1))
            # Extract question text (the first part before options)
            # Find the first checkbox
            first_cb = p.find('input', type='checkbox')
            if first_cb:
                before, _ = extract_surrounding_text(first_cb)
                # the actual question text is at the beginning of the block
                # extract text up to the first checkbox
                q_text_parts = []
                for child in p.children:
                    if child == first_cb or (isinstance(child, Tag) and child.find('input', type='checkbox')):
                        break
                    if isinstance(child, NavigableString):
                        q_text_parts.append(str(child))
                    else:
                        q_text_parts.append(child.get_text())
                q_text = "".join(q_text_parts).strip()
                
                # Extract options
                options = []
                for cb in p.find_all('input', type='checkbox'):
                    _, opt_text = extract_surrounding_text(cb)
                    options.append(opt_text)
                
                questions.append({"num": q_num, "text": q_text, "type": "multiple_choice", "options": options})

    return sorted(questions, key=lambda x: x['num'])

if __name__ == "__main__":
    html = open('/Users/arunyagoojar/Downloads/ielts-website/ielts-listening-test-163/index.html').read()
    soup = BeautifulSoup(html, 'html.parser')
    article = soup.find('article')
    qs = extract_questions_from_article(article)
    for q in qs:
        print(q)
