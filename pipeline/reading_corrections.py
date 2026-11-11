"""Reviewed errata for https://practicepteonline.com/ielts-reading-test-235/.
Keep upstream raw keys and record corrections separately; never apply these
context-specific answer variants to unrelated questions.
"""
def apply_reading_corrections(record):
    if record.get("slug") != "ielts-reading-test-235":
        return record
    page = record.get("provenance", {}).get("page", {})
    if not page.get("sha256", "").startswith("7d76723aa92adb54"):
        raise ValueError("Reading 235 source changed; reviewed corrections require revalidation")
    groups = {g["groupId"]: g for p in record["passages"] for g in p["questionGroups"]}
    questions = {q["number"]: q for g in groups.values() for q in g["questions"]}
    questions[11]["answer"].update(value="FALSE", accepted=["FALSE"])
    # Paragraphs B and E explain why objective advantages and companies'
    # expectations do not guarantee adoption: the question's guarantee is false.
    questions[19]["answer"].update(value="FALSE", accepted=["FALSE"])
    questions[1]["answer"]["accepted"] = ["Need", "needs"]
    questions[36]["answer"]["accepted"] = ["Education", "classical education"]
    groups["p1.q01-04"]["stimulus"]["blocks"] = [
        {"type": "text", "segments": ["In Luapula land allocation is in accordance with ", {"blank": 1}, "."]},
        {"type": "text", "segments": ["The citemene system provides the land with ", {"blank": 2}, " where crops are planted."]},
        {"type": "text", "segments": ["During the second season, the last planted crop is ", {"blank": 3}, "."]},
        {"type": "text", "segments": ["Under suitable conditions, fruit trees are planted near ", {"blank": 4}, "."]},
    ]
    groups["p3.q32-36"]["stimulus"]["blocks"] = [
        {"type": "text", "segments": ["Using visual imagery and spatial navigation to remember numbers are investigated and explained. A man called Ed Cooke in a pub, spoke a string of odd words when he held 7 of the spades (the first one of any cards group) was remembered as he encoded it to a ", {"blank": 32}, " and the card deck to memory are set to be one time of an order of ", {"blank": 33}, ";"]},
        {"type": "text", "segments": ["When it comes time to recall, Cooke took a ", {"blank": 34}, " along his way and interpreted the imaginary scene into cards."]},
        {"type": "text", "segments": ["This superior memory skill can be traced back to Ancient Greece, the strategy was called ", {"blank": 35}, " which had been a major subject was in ancient ", {"blank": 36}, "."]},
    ]
    record["provenance"]["reviewedCorrections"] = [
        {"question": 11, "sourceKey": "TRUE", "correctedKey": "FALSE", "evidence": "Paragraph I says these animals are not a regular part of most peoples' diet."},
        {"question": 19, "sourceKey": "TRUE", "correctedKey": "FALSE", "evidence": "Paragraphs B and E reject the claim that product advantages and companies' expectations guarantee successful adoption."},
        {"question": 1, "acceptedVariant": "needs", "reason": "Context-specific grammatical equivalent of 'according to need', within the word limit."},
        {"question": 36, "acceptedVariant": "classical education", "reason": "Verbatim passage extract and grammatical fit, within the THREE-word limit."},
        {"groups": ["p1.q01-04", "p3.q32-36"], "reason": "Restore sentence boundaries and block spacing while preserving numbered blanks and source wording."},
    ]
    return record
