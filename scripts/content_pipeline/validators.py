from .models import (
    ListeningTest, ReadingTest, WritingTest, SpeakingTest,
    ValidationState, BaseExtracted
)
import os
import re

UPLOAD_DIR = "/Users/arunyagoojar/Downloads/ielts-website/wp-content/uploads"

INVALID_PLACEHOLDERS = [
    re.compile(r'^Question \d+$', re.IGNORECASE),
    re.compile(r'^Pending\.\.\.', re.IGNORECASE),
    re.compile(r'^Raw extracted text pending\.\.\.', re.IGNORECASE),
    re.compile(r'^Details regarding\.\.\.', re.IGNORECASE),
    re.compile(r'^Questions? -\d+', re.IGNORECASE),
    re.compile(r'^Test$', re.IGNORECASE),
    re.compile(r'^answer\d+$', re.IGNORECASE),
    re.compile(r'^Extracted passage content', re.IGNORECASE)
]

def is_placeholder(text: str) -> bool:
    if not text or not text.strip():
        return True
    text_clean = text.strip()
    for regex in INVALID_PLACEHOLDERS:
        if regex.match(text_clean):
            return True
    return False

def validate_assets(assets, errors):
    for asset in assets:
        if not asset.exists:
            errors.append(f"Asset missing: {asset.original_src} -> {asset.resolved_path}")
        else:
            if not os.path.exists(asset.resolved_path):
                 errors.append(f"Asset file not found on disk: {asset.resolved_path}")
                 asset.exists = False

def check_answer_leakage(q_text, answer, errors, q_num):
    if not q_text:
        return
    if not answer:
        errors.append(f"Q{q_num}: Missing answer.")
        return
        
    ans_list = [answer] if isinstance(answer, str) else answer
    q_lower = q_text.lower()
    for a in ans_list:
        a_clean = a.lower().strip()
        # Ignore common instructions
        if a_clean in ['true', 'false', 'not given', 'yes', 'no', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']:
            continue
            
        # Strictly checking for exact match that isn't just a short word
        if len(a_clean) > 4 and a_clean in q_lower:
            errors.append(f"Q{q_num}: Answer '{a_clean}' leaked into question text.")
            
def validate_listening(test: ListeningTest) -> ListeningTest:
    errors = []
    
    if len(test.sections) == 0:
        errors.append("No sections found.")
    
    total_q = 0
    for sec in test.sections:
        if sec.audio:
            validate_assets([sec.audio], errors)
        else:
            errors.append(f"Section {sec.section_number} missing audio.")
            
        for g in sec.question_groups:
            if not g.questions:
                errors.append(f"Section {sec.section_number} group {g.start_q}-{g.end_q} has no questions.")
            
            if is_placeholder(g.shared_content_html):
                errors.append(f"Section {sec.section_number} group {g.start_q}-{g.end_q} shared content is placeholder.")

            for q in g.questions:
                total_q += 1
                if is_placeholder(q.question_text):
                     errors.append(f"Q{q.question_number}: Question text is a placeholder.")
                check_answer_leakage(q.question_text, q.correct_answer, errors, q.question_number)
                
    if total_q == 0:
         errors.append("No questions extracted.")
    elif total_q != 40:
         errors.append(f"Unexpected total question count: {total_q}")

    return finalize_validation(test, errors)

def validate_reading(test: ReadingTest) -> ReadingTest:
    errors = []
    if len(test.passages) == 0:
        errors.append("No passages found.")
        
    total_q = 0
    for p in test.passages:
        validate_assets(p.images, errors)
        if is_placeholder(p.content_html) or not p.content_html.strip():
             errors.append(f"Passage {p.passage_number} content empty or placeholder.")
        for g in p.question_groups:
             if is_placeholder(g.shared_content_html):
                errors.append(f"Passage {p.passage_number} group {g.start_q}-{g.end_q} shared content is placeholder.")
             for q in g.questions:
                 total_q += 1
                 if is_placeholder(q.question_text):
                     errors.append(f"Q{q.question_number}: Question text is a placeholder.")
                 check_answer_leakage(q.question_text, q.correct_answer, errors, q.question_number)

    if total_q == 0:
         errors.append("No questions extracted.")
    elif total_q != 40:
         errors.append(f"Unexpected total question count: {total_q}")
         
    return finalize_validation(test, errors)

def validate_writing(test: WritingTest) -> WritingTest:
    errors = []
    if not test.tasks:
        errors.append("No tasks found.")
    
    # We should have task 1 and task 2
    task_nums = [t.task_number for t in test.tasks]
    if 1 not in task_nums or 2 not in task_nums:
        if "18" in test.test_id: # Because Test 18 should definitely have both
            errors.append("Writing test must have both Task 1 and Task 2.")
            
    for t in test.tasks:
        validate_assets(t.images, errors)
        if is_placeholder(t.prompt_html) or len(t.prompt_html) < 20:
             errors.append(f"Task {t.task_number} prompt suspiciously short or placeholder.")
             
        # Check if Task 2 leaked into Task 1
        if t.task_number == 1 and ("Task 2" in t.prompt_html or "250 words" in t.prompt_html):
             errors.append("Task 1 prompt appears to contain Task 2 content.")

    return finalize_validation(test, errors)

def validate_speaking(test: SpeakingTest) -> SpeakingTest:
    errors = []
    if not test.prompts and not test.cue_card_instructions and not test.supporting_text:
        errors.append("No prompts, instructions, or supporting text extracted.")
        
    if test.content_type == "unknown":
        errors.append("Content type not determined.")
        
    return finalize_validation(test, errors)

def finalize_validation(test: BaseExtracted, errors: list) -> BaseExtracted:
    test.validation_errors = errors
    if errors:
        test.validation_state = "NEEDS_REVIEW"
    else:
        test.validation_state = "VERIFIED"
    return test
