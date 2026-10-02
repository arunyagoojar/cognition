import re
from bs4 import BeautifulSoup
from .base import clean_wp_html, extract_answer_key, resolve_audio_tag
from .dom_utils import group_nodes_by_instruction, extract_questions_from_chunk
from ..models import ListeningTest, ListeningSection, ListeningQuestionGroup, QuestionBase, Provenance
import hashlib
from typing import List

def parse_listening(html: str, filepath: str) -> List[ListeningTest]:
    soup = BeautifulSoup(html, 'html.parser')
    answers = extract_answer_key(soup)
    clean_wp_html(soup)
    
    # We will find all audio tags and attach them to tests
    audio_assets = []
    for audio_tag in soup.find_all('audio'):
        asset = resolve_audio_tag(audio_tag)
        if asset:
            audio_assets.append(asset)
            
    article = soup.find(class_='entry-content') or soup.find('article') or soup
        
    chunks = group_nodes_by_instruction(article)
    
    tests = []
    current_test_sections = [
        ListeningSection(section_number=1, audio=None, question_groups=[]),
        ListeningSection(section_number=2, audio=None, question_groups=[]),
        ListeningSection(section_number=3, audio=None, question_groups=[]),
        ListeningSection(section_number=4, audio=None, question_groups=[])
    ]
    prev_q = 0
    
    for chunk in chunks:
        if chunk["start"] == -1: continue
        
        start_q = chunk["start"]
        if start_q <= prev_q and start_q < 5:
            # new test!
            if any(s.question_groups for s in current_test_sections):
                tests.append(current_test_sections)
            current_test_sections = [
                ListeningSection(section_number=1, audio=None, question_groups=[]),
                ListeningSection(section_number=2, audio=None, question_groups=[]),
                ListeningSection(section_number=3, audio=None, question_groups=[]),
                ListeningSection(section_number=4, audio=None, question_groups=[])
            ]
            prev_q = 0
            
        extracted_qs = extract_questions_from_chunk(chunk["nodes"], chunk["start"], chunk["end"])
        
        q_objs = []
        if not extracted_qs:
             options = []
             for node in chunk["nodes"]:
                 text = node.get_text(separator=' ', strip=True) if hasattr(node, 'get_text') else str(node)
                 opts = re.findall(r'\b([A-G])\s+([^\n]+)', text)
                 if opts:
                     for letter, desc in opts:
                         options.append(f"{letter} {desc.strip()}")
             
             shared_text = " ".join([n.get_text(strip=True) if hasattr(n, 'get_text') else str(n) for n in chunk["nodes"]])
             for q_num in range(chunk["start"], chunk["end"] + 1):
                 q_objs.append(QuestionBase(
                     question_number=q_num,
                     question_text=shared_text,
                     options=options if options else None,
                     correct_answer=answers.get(q_num, "UNKNOWN"),
                     type="multiple_choice"
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
                 
        shared_html = "".join([str(n) for n in chunk["nodes"]])
        lqg = ListeningQuestionGroup(
            start_q=chunk["start"],
            end_q=chunk["end"],
            instructions=chunk["instruction"],
            shared_content_html=shared_html,
            questions=q_objs
        )
        
        sec_idx = (chunk["start"] - 1) // 10
        if sec_idx < 0: sec_idx = 0
        if sec_idx > 3: sec_idx = 3
        current_test_sections[sec_idx].question_groups.append(lqg)
        prev_q = chunk["end"] if chunk["end"] else chunk["start"]
        
    if any(s.question_groups for s in current_test_sections):
        tests.append(current_test_sections)
        
    final_tests = []
    for t_idx, sections in enumerate(tests):
        valid_secs = [s for s in sections if s.question_groups]
        # Assign audio asset if we found one
        if audio_assets:
            a_idx = t_idx if t_idx < len(audio_assets) else 0
            for s in valid_secs:
                s.audio = audio_assets[a_idx]
                
        test_id = f"test_{t_idx}" if t_idx > 0 else "test_0"
        provenance = Provenance(
            source_file=filepath,
            source_hash=hashlib.sha256(html.encode()).hexdigest(),
            module="listening"
        )
        
        final_tests.append(ListeningTest(
            test_id=test_id,
            title="IELTS Listening Test",
            sections=valid_secs,
            provenance=provenance
        ))
        
    return final_tests
