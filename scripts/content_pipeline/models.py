import hashlib
from typing import List, Optional, Union, Literal, Dict, Any
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Enums & Base
# -----------------------------------------------------------------------------

ValidationState = Literal["UNVERIFIED", "VALIDATING", "VERIFIED", "NEEDS_REVIEW", "FAILED"]

class Provenance(BaseModel):
    source_file: str
    source_url: Optional[str] = None
    source_hash: str
    module: str
    extraction_method: str = "deterministic_html_parse"
    html_fragment: Optional[str] = None
    section_or_task: Optional[str] = None

class Asset(BaseModel):
    original_src: str
    resolved_path: str
    asset_type: Literal["audio", "image", "other"]
    exists: bool = False
    
class BaseExtracted(BaseModel):
    validation_state: ValidationState = "UNVERIFIED"
    validation_errors: List[str] = Field(default_factory=list)
    provenance: Provenance

class QuestionBase(BaseModel):
    question_number: int
    question_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Union[str, List[str]]
    type: str

# -----------------------------------------------------------------------------
# Listening Schema
# -----------------------------------------------------------------------------
class ListeningQuestionGroup(BaseModel):
    group_type: str = "unknown"
    start_q: int
    end_q: int
    instructions: str
    shared_content_html: str
    questions: List[QuestionBase]

class ListeningSection(BaseModel):
    section_number: int
    audio: Optional[Asset] = None
    question_groups: List[ListeningQuestionGroup]

class ListeningTest(BaseExtracted):
    test_id: str
    title: str
    sections: List[ListeningSection]
    
# -----------------------------------------------------------------------------
# Reading Schema
# -----------------------------------------------------------------------------
class ReadingQuestionGroup(BaseModel):
    group_type: str = "unknown"
    start_q: int
    end_q: int
    instructions: str
    shared_content_html: str
    questions: List[QuestionBase]

class ReadingPassage(BaseModel):
    passage_number: int
    title: str
    content_html: str
    images: List[Asset] = Field(default_factory=list)
    question_groups: List[ReadingQuestionGroup]

class ReadingTest(BaseExtracted):
    test_id: str
    title: str
    passages: List[ReadingPassage]

# -----------------------------------------------------------------------------
# Writing Schema
# -----------------------------------------------------------------------------
class WritingTask(BaseModel):
    task_number: Literal[1, 2]
    prompt_html: str
    word_requirement: Optional[int] = None
    images: List[Asset] = Field(default_factory=list)

class WritingTest(BaseExtracted):
    test_id: str
    title: str
    tasks: List[WritingTask]

# -----------------------------------------------------------------------------
# Speaking Schema
# -----------------------------------------------------------------------------
class SpeakingTest(BaseExtracted):
    test_id: str
    title: str
    part: Optional[str] = None
    topic: Optional[str] = None
    content_type: str = "unknown" # e.g. "cue_card", "sample_answer", "part1_questions"
    cue_card_instructions: Optional[str] = None
    prompts: List[str] = Field(default_factory=list)
    supporting_text: Optional[str] = None
