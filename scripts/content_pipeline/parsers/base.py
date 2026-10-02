import os
import re
from bs4 import BeautifulSoup
from urllib.parse import unquote
from ..models import Asset, Provenance

UPLOAD_DIR = "/Users/arunyagoojar/Downloads/ielts-website/wp-content/uploads"

def clean_wp_html(soup: BeautifulSoup):
    """Strip out WordPress boilerplate."""
    # Remove hidden answer blocks first so they don't leak, we'll extract them separately
    # Actually wait, we should extract answers BEFORE cleaning them out, but we can do that in the specific parsers.
    
    # Remove common junk
    for selector in ['.addtoany_share_save_container', '.elementor', 'style', 'script', 'nav', 'footer', 'header']:
        for el in soup.select(selector):
            el.decompose()
            
    # Also look for things like social sharing, comments
    for el in soup.find_all(class_=lambda c: c and ('share' in c or 'comment' in c)):
         el.decompose()

import glob

def find_file_recursive(filename, search_dir):
    # Walk the directory to find the file
    for root, _, files in os.walk(search_dir):
        if filename in files:
            return os.path.join(root, filename)
    return None

def resolve_asset(src: str) -> Asset:
    """Resolve asset paths to absolute disk paths."""
    if src.startswith("data:"):
        return Asset(original_src=src, resolved_path="base64-placeholder", asset_type="other", exists=False)
        
    clean_src = unquote(src).split('?')[0] # remove query params
    
    # Try to extract the part after wp-content/uploads/
    match = re.search(r'wp-content/uploads/(.+)$', clean_src)
    if match:
        rel_path = match.group(1)
        abs_path = os.path.join(UPLOAD_DIR, rel_path)
    else:
        abs_path = os.path.join(UPLOAD_DIR, os.path.basename(clean_src))
        
    ext = os.path.splitext(abs_path)[1].lower()
    if ext in ['.mp3', '.wav', '.ogg', '.m4a']:
        atype = "audio"
    elif ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']:
        atype = "image"
    else:
        atype = "other"
        
    if not os.path.exists(abs_path):
        # Recursive search by filename
        found = find_file_recursive(os.path.basename(clean_src), UPLOAD_DIR)
        if found:
            abs_path = found
            
    exists = os.path.exists(abs_path)
    return Asset(original_src=src, resolved_path=abs_path, asset_type=atype, exists=exists)

def resolve_img_tag(img_tag) -> Asset:
    src = img_tag.get('data-src') or img_tag.get('data-lazy-src') or img_tag.get('src')
    if src:
        return resolve_asset(src)
    return None

def resolve_audio_tag(audio_tag) -> Asset:
    src = audio_tag.get('data-src') or audio_tag.get('src')
    if not src and audio_tag.find('source'):
        src = audio_tag.find('source').get('src') or audio_tag.find('source').get('data-src')
    if src:
        return resolve_asset(src)
    return None

def extract_answer_key(soup: BeautifulSoup) -> dict:
    """Finds the hidden answer key div and parses it into a dictionary {q_num: answer_text}."""
    answers = {}
    
    # Find the button that reveals answers
    btn = soup.find('button', id=lambda x: x and x.startswith('bg-showmore-action-'))
    if btn:
        div_id = btn.get('id').replace('action', 'hidden')
        ans_div = soup.find('div', id=div_id)
        if ans_div:
            # The answers are usually formatted as "1. answer <br/> 2. answer"
            # Or inside paragraphs
            text = ans_div.get_text(separator='\n')
            
            # Use regex to find lines like "1. answer" or "1 answer"
            # e.g., "1. 1.4 litres\n2. automatic"
            matches = re.finditer(r'(\d+)\.\s*(.+?)(?=\n\d+\.|$)', text, re.DOTALL)
            for m in matches:
                q_num = int(m.group(1))
                ans_text = m.group(2).strip()
                answers[q_num] = ans_text
            
            # Remove the answer block so it doesn't leak into the student content
            btn.decompose()
            ans_div.decompose()
            
    return answers
