import re
from bs4 import BeautifulSoup, Tag
from .base import clean_wp_html, resolve_asset
from ..models import WritingTest, WritingTask, Provenance
import hashlib
from typing import List

def parse_writing(html: str, filepath: str) -> List[WritingTest]:
    soup = BeautifulSoup(html, 'html.parser')
    clean_wp_html(soup)
    
    article = soup.find(class_='entry-content') or soup.find('article') or soup
        
    tasks = []
    
    # We will split the article children into Task 1 and Task 2 blocks based on headers/strong tags saying "Task 1" / "Task 2"
    t1_nodes = []
    t2_nodes = []
    current_task = 0
    
    # IELTS Writing usually has a bold "WRITING TASK 1" or "Task 1"
    for child in article.children:
        if not child.name: continue
        text = child.get_text(strip=True).lower() if hasattr(child, 'get_text') else str(child).lower()
        if 'task 1' in text and not 'task 2' in text:
            current_task = 1
            t1_nodes.append(child)
        elif 'task 2' in text:
            current_task = 2
            t2_nodes.append(child)
        else:
            if current_task == 1:
                t1_nodes.append(child)
            elif current_task == 2:
                t2_nodes.append(child)
            else:
                # Content before Task 1 (e.g. general instructions) will be attached to Task 1
                t1_nodes.append(child)
                
    def build_task(num, nodes):
        if not nodes: return None
        html_content = "".join([str(n) for n in nodes])
        
        # Word requirement
        word_req = None
        if num == 1:
            if '150' in html_content: word_req = 150
        elif num == 2:
            if '250' in html_content: word_req = 250
            
        # Assets
        images = []
        psoup = BeautifulSoup(html_content, 'html.parser')
        for img in psoup.find_all('img'):
            src = img.get('src')
            if src: images.append(resolve_asset(src))
            
        return WritingTask(
            task_number=num,
            prompt_html=html_content,
            word_requirement=word_req,
            images=images
        )
        
    t1 = build_task(1, t1_nodes)
    if t1: tasks.append(t1)
    
    t2 = build_task(2, t2_nodes)
    if t2: tasks.append(t2)

    provenance = Provenance(
        source_file=filepath,
        source_hash=hashlib.sha256(html.encode()).hexdigest(),
        module="writing"
    )
    
    return [WritingTest(
        test_id="18",
        title="IELTS Writing Test 18",
        tasks=tasks,
        provenance=provenance
    )]
