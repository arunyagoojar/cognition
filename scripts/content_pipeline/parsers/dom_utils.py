import re
from bs4 import BeautifulSoup, Tag, NavigableString

def extract_surrounding_text(node):
    before_text = []
    prev_node = node.previous_sibling
    while prev_node:
        if isinstance(prev_node, Tag) and prev_node.name in ['br', 'p', 'div', 'tr', 'td', 'table', 'ul', 'li', 'h1', 'h2', 'h3']:
            break
        if isinstance(prev_node, NavigableString):
            before_text.insert(0, str(prev_node))
        elif isinstance(prev_node, Tag):
            before_text.insert(0, prev_node.get_text())
        prev_node = prev_node.previous_sibling
        
    after_text = []
    next_node = node.next_sibling
    while next_node:
        if isinstance(next_node, Tag) and next_node.name in ['br', 'p', 'div', 'tr', 'td', 'table', 'ul', 'li', 'h1', 'h2', 'h3']:
            break
        if isinstance(next_node, NavigableString):
            after_text.append(str(next_node))
        elif isinstance(next_node, Tag):
            after_text.append(next_node.get_text())
        next_node = next_node.next_sibling
        
    return "".join(before_text).strip(), "".join(after_text).strip()

def group_nodes_by_instruction(article):
    # This splits the article children into semantic chunks bounded by instruction headers
    chunks = []
    current_chunk = {"instruction": "", "nodes": [], "start": -1, "end": -1}
    
    q_regex = re.compile(r'Questions?\s+(\d+)(?:\s*(?:-|to|–|and)\s*(\d+))?', re.IGNORECASE)
    
    for child in article.children:
        if isinstance(child, NavigableString) and not str(child).strip():
            continue
            
        text = child.get_text(strip=True) if hasattr(child, 'get_text') else str(child)
        m = q_regex.search(text)
        
        is_header = isinstance(child, Tag) and child.name in ['h1', 'h2', 'h3']
        is_q_boundary = isinstance(child, Tag) and m and len(text) < 300
        
        if is_q_boundary: 
            # Start new chunk
            if current_chunk["nodes"]:
                chunks.append(current_chunk)
            current_chunk = {
                "instruction": text,
                "nodes": [],
                "start": int(m.group(1)),
                "end": int(m.group(2)) if m.group(2) else int(m.group(1))
            }
        elif is_header:
            # Start a new passage/text chunk
            if current_chunk["nodes"]:
                chunks.append(current_chunk)
            current_chunk = {
                "instruction": "",
                "nodes": [child],
                "start": -1,
                "end": -1
            }
        else:
            current_chunk["nodes"].append(child)
            
    if current_chunk["nodes"]:
        chunks.append(current_chunk)
        
    return chunks

def extract_questions_from_chunk(nodes, start_q, end_q):
    questions = []
    # Process text inputs
    for node in nodes:
        if not isinstance(node, Tag):
            continue
            
        # Fill in the blanks
        for inp in node.find_all('input', type=['text', '']):
            before, after = extract_surrounding_text(inp)
            text = f"{before} [BLANK] {after}".strip()
            
            # Find number
            m = re.search(r'\((\d+)\)|(\d+)\.', before)
            q_num = -1
            if m:
                q_num = int(m.group(1) or m.group(2))
            else:
                # heuristic: if we couldn't find it in the inline context, 
                # maybe it's just the next question in the range. 
                # For POC we'll try to find any number in the block
                m2 = re.search(r'\((\d+)\)|(\d+)\.', node.get_text())
                if m2: q_num = int(m2.group(1) or m2.group(2))
                
            if q_num != -1:
                questions.append({"num": q_num, "text": text, "type": "fill_in_blank", "options": None})

        # Process multiple choice (checkboxes)
        # Checkboxes are grouped under a block that starts with the question number e.g. "16. Text"
        for p in node.find_all(['p', 'div', 'td']):
            p_text = p.get_text(separator=' ', strip=True)
            m = re.match(r'^(\d+)\.', p_text)
            if m and p.find('input', type='checkbox'):
                q_num = int(m.group(1))
                first_cb = p.find('input', type='checkbox')
                
                q_text_parts = []
                for child in p.children:
                    if child == first_cb or (isinstance(child, Tag) and child.find('input', type='checkbox')):
                        break
                    if isinstance(child, NavigableString):
                        q_text_parts.append(str(child))
                    else:
                        q_text_parts.append(child.get_text())
                q_text = "".join(q_text_parts).strip()
                
                options = []
                for cb in p.find_all('input', type='checkbox'):
                    _, opt_text = extract_surrounding_text(cb)
                    options.append(opt_text.strip())
                
                questions.append({"num": q_num, "text": q_text, "type": "multiple_choice", "options": options})

    return questions
