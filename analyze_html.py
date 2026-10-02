import os
from bs4 import BeautifulSoup
import json

files = {
    "listening": "/Users/arunyagoojar/Downloads/ielts-website/ielts-listening-test-163/index.html",
    "reading": "/Users/arunyagoojar/Downloads/ielts-website/ielts-reading-test-24/index.html",
    "writing": "/Users/arunyagoojar/Downloads/ielts-website/ielts-writing-test-18/index.html",
    "speaking": "/Users/arunyagoojar/Downloads/ielts-website/ielts-speaking-cue-card-talk-about-a-time-when-you-gave-advice-to-someone/index.html"
}

def analyze_file(filepath):
    if not os.path.exists(filepath):
        return {"error": "File not found"}
        
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Is it WordPress?
    wp_evidence = {
        "wp-content": "wp-content" in html,
        "wp-includes": "wp-includes" in html,
        "wp-json": "wp-json" in html,
        "yoast": "yoast" in html.lower(),
        "elementor": "elementor" in html.lower() or len(soup.find_all(class_=lambda x: x and 'elementor' in x)) > 0
    }
    
    # JSON-LD?
    json_ld = soup.find_all('script', type='application/ld+json')
    has_json_ld = len(json_ld) > 0
    
    # Find REST API links
    rest_api_links = [link.get('href') for link in soup.find_all('link', rel='https://api.w.org/')]
    
    # Main content area
    article = soup.find('article') or soup.find(class_=lambda x: x and 'content' in x.lower())
    
    if not article:
        content_classes = "No article or content class found"
    else:
        # Just grab the top-level classes of the article and its immediate children
        content_classes = article.get('class', [])
        
    # Find audios
    audios = [a.get('src') for a in soup.find_all('audio')]
    audio_sources = [s.get('src') for s in soup.find_all('source')]
    all_audio = audios + audio_sources
    
    # Find images in the content
    images = []
    if article:
        imgs = article.find_all('img')
        for img in imgs:
            src = img.get('src')
            data_src = img.get('data-src')
            srcset = img.get('srcset')
            data_srcset = img.get('data-srcset')
            images.append({
                "src": src,
                "data-src": data_src,
                "srcset": srcset is not None,
                "data-srcset": data_srcset is not None
            })
            
    # Answer keys / sections
    # Look for common IELTS structures
    questions = len(soup.find_all(string=lambda text: text and 'Question' in text and len(text) < 20))
    if article:
        tables = len(article.find_all('table'))
        inputs = len(article.find_all('input'))
        selects = len(article.find_all('select'))
        forms = len(article.find_all('form'))
    else:
        tables, inputs, selects, forms = 0, 0, 0, 0
        
    # check for specific classes that might represent questions
    q_classes = set()
    for el in soup.find_all(class_=True):
        for c in el.get('class'):
            if 'question' in c.lower() or 'answer' in c.lower() or 'quiz' in c.lower():
                q_classes.add(c)
                
    return {
        "wp_evidence": wp_evidence,
        "has_json_ld": has_json_ld,
        "rest_api_links": rest_api_links,
        "audio_count": len(all_audio),
        "audio_examples": all_audio[:2],
        "image_count": len(images),
        "image_examples": images[:2],
        "tables_in_content": tables,
        "inputs_in_content": inputs,
        "selects_in_content": selects,
        "forms_in_content": forms,
        "question_text_matches": questions,
        "question_related_classes": list(q_classes)
    }

results = {}
for name, path in files.items():
    results[name] = analyze_file(path)

print(json.dumps(results, indent=2))
