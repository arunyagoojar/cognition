import re
from bs4 import BeautifulSoup, Tag, NavigableString
from .base import clean_wp_html, extract_answer_key, resolve_asset
from .dom_utils import extract_questions_from_chunk
from ..models import ReadingTest, ReadingPassage, ReadingQuestionGroup, QuestionBase, Provenance
import hashlib

from typing import List

def parse_reading(html: str, filepath: str) -> List[ReadingTest]:
    soup = BeautifulSoup(html, 'html.parser')
    answers = extract_answer_key(soup)
    clean_wp_html(soup)
    article = soup.find(class_='entry-content') or soup.find('article') or soup
        
    q_regex = re.compile(r'Questions?\s+(\d+)(?:\s*(?:-|to|–|and)\s*(\d+))?', re.IGNORECASE)
    
    # 1. Group into chunks
    chunks = []
    current_type = None
    current_nodes = []
    
    for child in article.children:
        if isinstance(child, NavigableString) and not str(child).strip():
            continue
        text = child.get_text(strip=True) if hasattr(child, 'get_text') else str(child)
        has_input = isinstance(child, Tag) and child.find('input')
        m = q_regex.search(text)
        is_instruction = isinstance(child, Tag) and m and len(text) < 300
        
        is_q = has_input or is_instruction
        if is_q:
            if current_type == 'text' and current_nodes:
                chunks.append({'type': 'text', 'nodes': current_nodes})
                current_nodes = []
            current_type = 'question'
            current_nodes.append(child)
        else:
            if current_type == 'question' and current_nodes:
                chunks.append({'type': 'question', 'nodes': current_nodes})
                current_nodes = []
            current_type = 'text'
            current_nodes.append(child)
            
    if current_nodes:
        chunks.append({'type': current_type, 'nodes': current_nodes})
        
    # 2. Assign to tests and passages
    tests = []
    current_test_passages = {1: {"nodes": [], "groups": []}, 2: {"nodes": [], "groups": []}, 3: {"nodes": [], "groups": []}}
    current_passage_num = 1
    prev_q = 0
    
    for chunk in chunks:
        if chunk['type'] == 'text':
            # Append text to the current passage
            current_test_passages[current_passage_num]["nodes"].extend(chunk['nodes'])
        else:
            # It's a question chunk, find its start_q
            # We look for the first instruction in the chunk
            start_q = None
            end_q = None
            instruction = ""
            for node in chunk['nodes']:
                text = node.get_text(strip=True) if hasattr(node, 'get_text') else str(node)
                m = q_regex.search(text)
                if m and len(text) < 300:
                    start_q = int(m.group(1))
                    end_q = int(m.group(2)) if m.group(2) else start_q
                    instruction = text
                    break
                    
            if start_q is not None:
                # Did we reset to a new test?
                if start_q <= prev_q and start_q < 5:
                    # New test!
                    tests.append(current_test_passages)
                    current_test_passages = {1: {"nodes": [], "groups": []}, 2: {"nodes": [], "groups": []}, 3: {"nodes": [], "groups": []}}
                    current_passage_num = 1
                    prev_q = 0
                    
                # Which passage?
                if start_q >= 27: current_passage_num = 3
                elif start_q >= 14: current_passage_num = 2
                else: current_passage_num = 1
                
                prev_q = end_q if end_q else start_q
                
                current_test_passages[current_passage_num]["groups"].append({
                    "start": start_q,
                    "end": end_q,
                    "instruction": instruction,
                    "nodes": chunk['nodes']
                })
            else:
                # Missing instruction? Just append to current passage text I guess
                current_test_passages[current_passage_num]["nodes"].extend(chunk['nodes'])
                
    if any(p["groups"] for p in current_test_passages.values()):
        tests.append(current_test_passages)
        
    # 3. Build ReadingTest objects
    from .base import resolve_img_tag
    final_tests = []
    
    for t_idx, test_passages in enumerate(tests):
        final_passages = []
        for p_num in [1, 2, 3]:
            p = test_passages[p_num]
            if not p["nodes"] and not p["groups"]:
                continue
                
            html_content = "".join([str(n) for n in p["nodes"]])
            images = []
            psoup = BeautifulSoup(html_content, 'html.parser')
            for img in psoup.find_all('img'):
                asset = resolve_img_tag(img)
                if asset: images.append(asset)
                
            groups = []
            for g in p["groups"]:
                extracted_qs = extract_questions_from_chunk(g["nodes"], g["start"], g["end"])
                q_objs = []
                
                if not extracted_qs:
                    shared_text = " ".join([n.get_text(strip=True) if hasattr(n, 'get_text') else str(n) for n in g["nodes"]])
                    for q_num in range(g["start"], g["end"] + 1):
                        q_objs.append(QuestionBase(
                            question_number=q_num,
                            question_text=shared_text,
                            options=None,
                            correct_answer=answers.get(q_num, "UNKNOWN"),
                            type="unknown"
                        ))
                else:
                     for eq in extracted_qs:
                         q_objs.append(QuestionBase(
                             question_number=eq["num"],
                             question_text=eq["text"],
                             options=eq["options"],
                             correct_answer=answers.get(eq["num"], "UNKNOWN"),
                             type=eq["type"]
                         ))
                         
                shared_html = "".join([str(n) for n in g["nodes"]])
                groups.append(ReadingQuestionGroup(
                    start_q=g["start"],
                    end_q=g["end"],
                    instructions=g["instruction"],
                    shared_content_html=shared_html,
                    questions=q_objs
                ))
                
            final_passages.append(ReadingPassage(
                passage_number=p_num,
                title=f"Reading Passage {p_num}",
                content_html=html_content,
                images=images,
                question_groups=groups
            ))
            
        test_id = f"test_{t_idx}" if t_idx > 0 else "test_0"
        provenance = Provenance(
            source_file=filepath,
            source_hash=hashlib.sha256(html.encode()).hexdigest(),
            module="reading"
        )
        final_tests.append(ReadingTest(
            test_id=test_id,
            title="IELTS Reading Test",
            passages=final_passages,
            provenance=provenance
        ))
        
    return final_tests
