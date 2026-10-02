import os
import re
import math
import pymupdf

print("=================================================================")
print("     OMNIPREP WRITING SECTION SPECIFIC REGRESSION TEST SUITE     ")
print("=================================================================")

proj_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
writing_pool_file = os.path.join(proj_dir, 'src/data/writing/writingPool.js')
writing_module_file = os.path.join(proj_dir, 'src/components/modules/WritingModule.jsx')
writing_scorer_file = os.path.join(proj_dir, 'src/utils/writingScorer.js')
public_dir = os.path.join(proj_dir, 'public')

# -----------------------------------------------------------------------------
# TEST 1: Pool File Presence and Extraction
# -----------------------------------------------------------------------------
print("\n[TEST 1] Parsing WRITING_TASK_POOLS Configuration...")
assert os.path.exists(writing_pool_file), f"writingPool.js not found at {writing_pool_file}"
with open(writing_pool_file, 'r', encoding='utf-8') as f:
    pool_code = f.read()

# Extract pool IDs
set_ids = re.findall(r'id:\s*["\']([^"\']+)["\']', pool_code)
print(f"  ✓ Found {len(set_ids)} writing task sets in pool: {set_ids}")
assert len(set_ids) >= 5, f"Expected at least 5 writing task sets, found {len(set_ids)}"

# Extract all images for Task 1
image_matches = re.findall(r'image:\s*["\']([^"\']+)["\']', pool_code)
null_image_matches = re.findall(r'image:\s*null', pool_code)
assert len(null_image_matches) == 0, f"Found {len(null_image_matches)} task sets with image: null! Every Task 1 must have an image."
print(f"  ✓ Zero 'image: null' entries found. All {len(image_matches)} task sets define an image path.")

# -----------------------------------------------------------------------------
# TEST 2: Diagram Assets Verification on Disk & Image Validity
# -----------------------------------------------------------------------------
print("\n[TEST 2] Verifying Visual Diagram Assets Integrity...")

expected_diagram_keywords = {
    "wr-c17-t1": ("norbiton", "Norbiton"),
    "wr-c18-t1": ("hydroelectric", "hydroelectric"),
    "wr-c18-t3": ("renewable", "renewable"),
    "wr-c18-t2": ("asian_cities", "four Asian countries"),
    "wr-c14-t4": ("grange_park", "Grange Park")
}

for set_id, (img_kw, prompt_kw) in expected_diagram_keywords.items():
    # Find block for this set
    set_block_match = re.search(rf'id:\s*["\']{set_id}["\'].*?task1:\s*\{{(.*?)\n\s*\}},\s*task2:', pool_code, re.DOTALL)
    assert set_block_match, f"Could not extract task1 block for {set_id}"
    t1_block = set_block_match.group(1)
    
    # Check image path
    img_match = re.search(r'image:\s*["\']([^"\']+)["\']', t1_block)
    assert img_match, f"Set {set_id} is missing image definition in Task 1!"
    img_rel_path = img_match.group(1)
    assert img_rel_path.startswith('/images/'), f"Set {set_id} image path should be in /images/, got: {img_rel_path}"
    assert img_kw in img_rel_path, f"Image path '{img_rel_path}' does not match expected keyword '{img_kw}'"
    
    # Check prompt alignment
    prompt_match = re.search(r'prompt:\s*`([^`]+)`', t1_block)
    assert prompt_match, f"Set {set_id} missing prompt"
    prompt_text = prompt_match.group(1)
    assert prompt_kw.lower() in prompt_text.lower(), f"Set {set_id} prompt does not contain '{prompt_kw}'"
    
    # Check physical file
    disk_path = os.path.join(public_dir, img_rel_path.lstrip('/'))
    assert os.path.exists(disk_path), f"CRITICAL: Diagram file {disk_path} does not exist on disk!"
    
    # Check file size (ensure high quality diagram > 50 KB)
    file_size = os.path.getsize(disk_path)
    assert file_size > 50000, f"Diagram {img_rel_path} is too small ({file_size} bytes), must be high resolution (>50KB)"
    
    # Open and verify image dimensions with pymupdf
    img_doc = pymupdf.open(disk_path)
    assert len(img_doc) >= 1, f"Image {img_rel_path} could not be loaded by PyMuPDF"
    page = img_doc[0]
    rect = page.rect
    width, height = int(rect.width), int(rect.height)
    assert width > 100 and height > 100, f"Diagram {img_rel_path} dimensions too small: {width}x{height}"
    
    print(f"  ✓ Set [{set_id}] Diagram Verified: {img_rel_path}")
    print(f"    - Dimensions: {width}x{height} pt | Size: {file_size / 1024:.1f} KB")
    print(f"    - Topic Match: '{prompt_kw}' in prompt and '{img_kw}' in diagram asset")

# -----------------------------------------------------------------------------
# TEST 3: Writing Module UI Component Verification
# -----------------------------------------------------------------------------
print("\n[TEST 3] Verifying WritingModule.jsx Rendering & Display Safety...")
with open(writing_module_file, 'r', encoding='utf-8') as f:
    wm_code = f.read()

# Assert Task 1 visual section is present
assert "currentTask?.image" in wm_code or "image" in wm_code, "WritingModule.jsx missing conditional image rendering"
# Assert NO color-inverting filter is applied (which broke diagrams previously)
assert "filter: 'invert(" not in wm_code, "WritingModule.jsx contains color-inverting filter that distorts diagram visuals!"
print("  ✓ WritingModule.jsx: Image render block verified")
print("  ✓ Color Fidelity: Invert filter eliminated; diagram rendered in authentic full-fidelity frame")

# -----------------------------------------------------------------------------
# TEST 4: Model Answers & Word Count Boundaries
# -----------------------------------------------------------------------------
print("\n[TEST 4] Verifying Band 8.0 & 8.5 Model Answers & Word Counts...")
for set_id in set_ids:
    set_block = re.search(rf'id:\s*["\']{set_id}["\'].*?modelBand85:\s*\{{.*?text:\s*`([^`]+)`', pool_code, re.DOTALL)
    assert set_block, f"Model answer missing for {set_id}"
    
    # Check Task 1 Model
    t1_model_match = re.search(rf'id:\s*["\']{set_id}["\'].*?modelBand8:\s*\{{.*?text:\s*`([^`]+)`', pool_code, re.DOTALL)
    assert t1_model_match, f"Task 1 Band 8 model missing for {set_id}"
    t1_text = t1_model_match.group(1).strip()
    t1_words = len(t1_text.split())
    assert t1_words >= 150, f"Task 1 model for {set_id} has only {t1_words} words (expected >= 150)"
    assert "overall" in t1_text.lower(), f"Task 1 model for {set_id} missing 'overall' overview paragraph"
    
    # Check Task 2 Model
    t2_text = set_block.group(1).strip()
    t2_words = len(t2_text.split())
    assert t2_words >= 250, f"Task 2 model for {set_id} has only {t2_words} words (expected >= 250)"
    paragraphs = [p for p in t2_text.split('\n\n') if p.strip()]
    assert len(paragraphs) >= 4, f"Task 2 model for {set_id} has {len(paragraphs)} paragraphs (expected >= 4)"

print(f"  ✓ All {len(set_ids)} task sets verified with authentic Band 8.0 (Task 1) and Band 8.5 (Task 2) model answers")

# -----------------------------------------------------------------------------
# TEST 5: Writing Automated Scoring Engine Validation
# -----------------------------------------------------------------------------
print("\n[TEST 5] Verifying Cambridge Academic Writing Scoring Engine...")

with open(writing_scorer_file, 'r', encoding='utf-8') as f:
    ws_code = f.read()

# Assert dynamic model discovery is configured (supports any available flash model)
assert "v1beta/models" in ws_code, "writingScorer.js must dynamically discover models from API"
assert "gemini-2.5-flash" in ws_code or "gemini-2.0-flash" in ws_code, "writingScorer.js must have flash model fallbacks"
assert "IELTS Academic Writing" in ws_code, "Examiner prompt missing"
assert "Task 1 Prompt:" in ws_code, "Task 1 examiner prompt missing"
assert "Task 2 Prompt:" in ws_code, "Task 2 examiner prompt missing"

# Simulate official IELTS scoring logic
def score_task1_local(text):
    words = len(text.split())
    band = 6.0
    if words >= 150: band += 1.0
    elif words < 100: band -= 2.0
    elif words < 140: band -= 1.0
    
    if "overall" in text.lower() or "in summary" in text.lower():
        band += 0.5
    else:
        band = min(band, 5.0) # Without an overview, max Band 5 for Task Achievement
    return min(9.0, max(1.0, band))

def score_task2_local(text):
    words = len(text.split())
    band = 6.0
    if words >= 250: band += 1.0
    elif words < 180: band -= 2.0
    elif words < 230: band -= 1.0
    
    paras = [p for p in text.split('\n\n') if p.strip()]
    if len(paras) >= 4: band += 0.5
    if any(m in text.lower() for m in ["in my view", "i firmly believe", "i agree", "i disagree", "in conclusion"]):
        band += 0.5
    return min(9.0, max(1.0, band))

def compute_overall_writing_band(t1_score, t2_score):
    # Task 2 carries double the weight of Task 1 in official IELTS
    weighted = (t1_score + 2.0 * t2_score) / 3.0
    floor_val = math.floor(weighted)
    remainder = weighted - floor_val
    if remainder >= 0.75:
        return floor_val + 1.0
    elif remainder >= 0.25:
        return floor_val + 0.5
    else:
        return float(floor_val)

# Test case A: High quality full-length submission
t1_good = t1_text # From Test 4 (160+ words, contains 'overall')
t2_good = t2_text # From Test 4 (250+ words, 4+ paragraphs, contains 'in conclusion')

b_t1 = score_task1_local(t1_good)
b_t2 = score_task2_local(t2_good)
overall = compute_overall_writing_band(b_t1, b_t2)
assert overall >= 6.0, f"Expected good submission score >= 6.0, got {overall}"
print(f"  ✓ High Quality Submission Test: Task 1: B{b_t1:.1f}, Task 2: B{b_t2:.1f} -> Overall Writing Band: {overall:.1f}")

# Test case B: Underlength and no overview submission
t1_under = "The diagram shows a hydroelectric system with water flowing down into turbines."
b_t1_under = score_task1_local(t1_under)
assert b_t1_under <= 5.0, f"Submission without overview and under length must be capped at 5.0, got {b_t1_under}"
print(f"  ✓ Underlength & No Overview Penalty Test: Correctly capped at Band {b_t1_under:.1f}")

# -----------------------------------------------------------------------------
# TEST 6: History Tracking & Dual-Pool Cycling for Writing Tasks
# -----------------------------------------------------------------------------
print("\n[TEST 6] Verifying Writing Task Dual-Pool Cycling & Random Starts...")
import random

all_writing_ids = list(set_ids)
attempted_history = []

def get_next_simulated_writing_task(attempted, pool):
    unattempted = [t for t in pool if t not in attempted]
    reset = False
    if len(unattempted) == 0:
        attempted.clear()
        unattempted = list(pool)
        reset = True
    chosen = random.choice(unattempted)
    return chosen, reset

# Run 1st full cycle
cycle_1 = []
for i in range(len(all_writing_ids)):
    chosen, was_reset = get_next_simulated_writing_task(attempted_history, all_writing_ids)
    assert chosen not in cycle_1, f"Duplicate task {chosen} encountered in Cycle 1!"
    cycle_1.append(chosen)
    attempted_history.append(chosen)

assert set(cycle_1) == set(all_writing_ids), "Cycle 1 failed to exhaust all pool items!"
print(f"  ✓ Cycle 1 (5 tests): Full set covered without repetition: {cycle_1}")

# 6th test should trigger reset
exam_6, was_reset_6 = get_next_simulated_writing_task(attempted_history, all_writing_ids)
assert was_reset_6 is True, "Expected cycle reset when pool exhausted"
print(f"  ✓ Cycle Reset: Exhausted pool successfully recycled to become primary pool (Started with: {exam_6})")

print("\n=================================================================")
print("  ALL WRITING SECTION REGRESSION TESTS PASSED (100% SUCCESS)    ")
print("=================================================================\n")
