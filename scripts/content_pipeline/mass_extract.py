import os
import glob
import json
import traceback
import hashlib
from collections import defaultdict
from bs4 import BeautifulSoup
import sys

from scripts.content_pipeline.parsers.listening import parse_listening
from scripts.content_pipeline.parsers.reading import parse_reading
from scripts.content_pipeline.parsers.writing import parse_writing
from scripts.content_pipeline.parsers.speaking import parse_speaking
from scripts.content_pipeline.validators import (
    validate_listening, validate_reading, validate_writing, validate_speaking
)

SOURCE_DIR = "/Users/arunyagoojar/Downloads/ielts-website"
OUT_DIR = "tmp/content-extraction-full-v2"
CONTENT_DIR = os.path.join(OUT_DIR, "content")
REPORTS_DIR = os.path.join(OUT_DIR, "reports")
ASSETS_DIR = os.path.join(OUT_DIR, "assets")

for d in [OUT_DIR, CONTENT_DIR, REPORTS_DIR, ASSETS_DIR,
          os.path.join(CONTENT_DIR, "listening"),
          os.path.join(CONTENT_DIR, "reading"),
          os.path.join(CONTENT_DIR, "writing"),
          os.path.join(CONTENT_DIR, "speaking")]:
    os.makedirs(d, exist_ok=True)

stats = {
    "total_html_files": 0,
    "modules": defaultdict(int),
    "statuses": defaultdict(int),
    "test_types": defaultdict(int),
    "items": defaultdict(int),
    "assets_valid": {"audio": 0, "image": 0},
    "missing_assets": 0,
    "duplicates": 0
}

all_pages = []
failures = []
needs_review = []
duplicates_log = []
asset_manifest = []

seen_hashes = set()

def classify_page(html, filepath):
    title = ""
    soup = BeautifulSoup(html, 'html.parser')
    if soup.title:
        title = soup.title.get_text(strip=True).lower()
        
    path_lower = filepath.lower()
    text_preview = html[:10000].lower() # Just for fast keyword checks
    
    module = "UNKNOWN"
    if 'listening' in path_lower or 'listening' in title:
        module = "LISTENING"
    elif 'reading' in path_lower or 'reading' in title:
        module = "READING"
    elif 'writing' in path_lower or 'writing' in title:
        module = "WRITING"
    elif 'speaking' in path_lower or 'speaking' in title or 'cue-card' in path_lower:
        module = "SPEAKING"
    else:
        # Check if irrelevant (tag, category, author pages)
        if '/tag/' in path_lower or '/category/' in path_lower or '/author/' in path_lower or '/page/' in path_lower:
            module = "IRRELEVANT"
            
    test_type = "UNKNOWN"
    if module in ["READING", "WRITING"]:
        if "general training" in text_preview or "-gt-" in path_lower or " general " in title:
            test_type = "GENERAL_TRAINING"
        elif "academic" in text_preview or " academic " in title:
            test_type = "ACADEMIC"
            
    return module, test_type, title

def run_extraction():
    html_files = glob.glob(os.path.join(SOURCE_DIR, "**/*.html"), recursive=True)
    stats["total_html_files"] = len(html_files)
    
    for filepath in html_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                html = f.read()
        except:
            continue
            
        module, test_type, title = classify_page(html, filepath)
        stats["modules"][module] += 1
        stats["test_types"][test_type] += 1
        
        file_hash = hashlib.sha256(html.encode('utf-8')).hexdigest()
        
        page_record = {
            "source_path": filepath,
            "title": title,
            "module": module,
            "test_type": test_type,
            "hash": file_hash,
            "status": "UNPROCESSED",
            "error": None
        }
        
        if file_hash in seen_hashes:
            stats["duplicates"] += 1
            duplicates_log.append(page_record)
            continue
            
        if module in ["LISTENING", "READING", "WRITING", "SPEAKING"]:
            seen_hashes.add(file_hash)
            
            try:
                if module == "LISTENING":
                    extracted_list = parse_listening(html, filepath)
                elif module == "READING":
                    extracted_list = parse_reading(html, filepath)
                elif module == "WRITING":
                    extracted_list = parse_writing(html, filepath)
                elif module == "SPEAKING":
                    extracted_list = parse_speaking(html, filepath)
                    
                for idx, extracted in enumerate(extracted_list):
                    if module == "LISTENING":
                        validated = validate_listening(extracted)
                    elif module == "READING":
                        validated = validate_reading(extracted)
                    elif module == "WRITING":
                        validated = validate_writing(extracted)
                    elif module == "SPEAKING":
                        validated = validate_speaking(extracted)
                        
                    status = validated.validation_state
                    # If multiple tests on page, and any fails, mark page as failing
                    if page_record["status"] != "FAILED":
                        if status == "FAILED" or page_record["status"] == "UNPROCESSED":
                            page_record["status"] = status
                        elif status == "NEEDS_REVIEW" and page_record["status"] == "VERIFIED":
                            page_record["status"] = "NEEDS_REVIEW"
                    
                    # Save JSON
                    test_id = getattr(extracted, 'test_id', f'{file_hash}_{idx}')
                    out_path = os.path.join(CONTENT_DIR, module.lower(), f"{file_hash}_{idx}.json")
                    with open(out_path, 'w', encoding='utf-8') as f:
                        data = validated.model_dump()
                        data["test_type"] = test_type
                        json.dump(data, f, indent=2)
                        
                    stats["statuses"][status] += 1
                    
                    if status == "NEEDS_REVIEW":
                        if page_record["error"] is None: page_record["error"] = []
                        page_record["error"].extend(validated.validation_errors)
                        if page_record not in needs_review: needs_review.append(page_record)
                    elif status == "FAILED":
                        if page_record["error"] is None: page_record["error"] = []
                        page_record["error"].extend(validated.validation_errors)
                        if page_record not in failures: failures.append(page_record)
                        
                    # Collect stats
                    if module == "LISTENING":
                        stats["items"]["listening_tests"] += 1
                        for sec in validated.sections:
                            if sec.audio:
                                asset_manifest.append(sec.audio.model_dump())
                                if sec.audio.exists: stats["assets_valid"]["audio"] += 1
                                else: stats["missing_assets"] += 1
                    elif module == "READING":
                        stats["items"]["reading_tests"] += 1
                        stats["items"]["reading_passages"] += len(validated.passages)
                        for p in validated.passages:
                            for img in p.images:
                                asset_manifest.append(img.model_dump())
                                if img.exists: stats["assets_valid"]["image"] += 1
                                else: stats["missing_assets"] += 1
                    elif module == "WRITING":
                        stats["items"]["writing_tests"] += 1
                        stats["items"]["writing_tasks"] += len(validated.tasks)
                        for t in validated.tasks:
                            for img in t.images:
                                asset_manifest.append(img.model_dump())
                                if img.exists: stats["assets_valid"]["image"] += 1
                                else: stats["missing_assets"] += 1
                    elif module == "SPEAKING":
                        stats["items"]["speaking_packages"] += 1
                        
            except Exception as e:
                page_record["status"] = "FAILED"
                page_record["error"] = str(e)
                failures.append(page_record)
                stats["statuses"]["FAILED"] += 1
                
        all_pages.append(page_record)
        
    # Save reports
    with open(os.path.join(REPORTS_DIR, "extraction_summary.json"), 'w') as f:
        json.dump(stats, f, indent=2)
    with open(os.path.join(REPORTS_DIR, "failures.json"), 'w') as f:
        json.dump(failures, f, indent=2)
    with open(os.path.join(REPORTS_DIR, "needs_review.json"), 'w') as f:
        json.dump(needs_review, f, indent=2)
    with open(os.path.join(REPORTS_DIR, "duplicates.json"), 'w') as f:
        json.dump(duplicates_log, f, indent=2)
    with open(os.path.join(ASSETS_DIR, "manifest.json"), 'w') as f:
        json.dump(asset_manifest, f, indent=2)
        
    generate_md_report()

def generate_md_report():
    md = f"""# Mass Extraction Final Report

## Discovery
1. How many pages were discovered? **{stats['total_html_files']}**
2. How many were relevant? **{stats['modules']['LISTENING'] + stats['modules']['READING'] + stats['modules']['WRITING'] + stats['modules']['SPEAKING']}**
3. How many were successfully extracted? **{stats['statuses']['VERIFIED'] + stats['statuses']['NEEDS_REVIEW']}**
4. How many are VERIFIED? **{stats['statuses']['VERIFIED']}**
5. How many NEEDS_REVIEW? **{stats['statuses']['NEEDS_REVIEW']}**
6. How many FAILED? **{stats['statuses']['FAILED']}**
7. How many Academic? **{stats['test_types']['ACADEMIC']}**
8. How many General Training? **{stats['test_types']['GENERAL_TRAINING']}**
9. How many unknown? **{stats['test_types']['UNKNOWN']}**

## Extracted Items
10. How many Listening tests? **{stats['items']['listening_tests']}**
11. How many Reading tests? **{stats['items']['reading_tests']}**
12. How many Writing Task 1/Task 2? **{stats['items']['writing_tasks']}**
13. How many Speaking packages? **{stats['items']['speaking_packages']}**

## Assets & Duplicates
14. How many valid audio assets? **{stats['assets_valid']['audio']}**
15. How many valid image assets? **{stats['assets_valid']['image']}**
16. How many missing assets? **{stats['missing_assets']}**
17. How many duplicates? **{stats['duplicates']}**

## Analysis
18. What are the ten most common failure reasons?
(Check `failures.json` and `needs_review.json` for details)

19. Which source-page structures were not handled by the proof parser?
(To be determined from the failure logs)

20. Are there any parser assumptions that failed during the full run?
(To be determined from the failure logs)

**NOTE**: EXTRACTED does NOT mean VERIFIED. Only {stats['statuses']['VERIFIED']} packages met the strict structural and semantic validation requirements.
"""
    with open(os.path.join(REPORTS_DIR, "final_report.md"), 'w') as f:
        f.write(md)
        
if __name__ == "__main__":
    run_extraction()
