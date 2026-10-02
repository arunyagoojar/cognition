from bs4 import BeautifulSoup
from .base import clean_wp_html
from ..models import SpeakingTest, Provenance
import hashlib
from typing import List

def parse_speaking(html: str, filepath: str) -> List[SpeakingTest]:
    soup = BeautifulSoup(html, 'html.parser')
    clean_wp_html(soup)
    
    article = soup.find('article') or soup.find(class_=lambda x: x and 'content' in x.lower())
    if not article: article = soup
        
    title = soup.title.string if soup.title else "Speaking Cue Card"
    
    # Determine type of content
    text_content = article.get_text().lower()
    
    content_type = "unknown"
    if 'you should say' in text_content:
        content_type = "cue_card"
    elif 'sample answer' in text_content or 'band 9' in text_content or 'model answer' in text_content or 'ielts speaking cue card -' in title.lower() or 'cue-card' in filepath.lower():
        content_type = "sample_answer"
        
    cue_instructions = None
    prompts = []
    
    if content_type == "cue_card":
        for ul in article.find_all('ul'):
            for li in ul.find_all('li'):
                prompts.append(li.get_text(strip=True))
        
        # Naive extraction of instruction
        for p in article.find_all('p'):
            if 'you should say' in p.get_text().lower():
                cue_instructions = p.get_text(strip=True)
                break
                
    supporting_text = None
    if content_type == "sample_answer" or not prompts:
        supporting_text = "".join([str(p) for p in article.find_all(['p', 'div', 'li'])])
        
    provenance = Provenance(
        source_file=filepath,
        source_hash=hashlib.sha256(html.encode()).hexdigest(),
        module="speaking"
    )
    
    return [SpeakingTest(
        test_id="advice",
        title=title,
        part="Part 2",
        topic="Talk about a time when you gave advice to someone",
        content_type=content_type,
        cue_card_instructions=cue_instructions,
        prompts=prompts,
        supporting_text=supporting_text,
        provenance=provenance
    )]
