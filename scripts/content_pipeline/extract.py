import os
import json
from .parsers import parse_listening, parse_reading, parse_writing, parse_speaking
from .validators import validate_listening, validate_reading, validate_writing, validate_speaking

OUT_DIR = "tmp/content-extraction-proof"

# Source files
BASE_DIR = "/Users/arunyagoojar/Downloads/ielts-website"
FILES = {
    "listening_163": os.path.join(BASE_DIR, "ielts-listening-test-163", "index.html"),
    "reading_24": os.path.join(BASE_DIR, "ielts-reading-test-24", "index.html"),
    "writing_18": os.path.join(BASE_DIR, "ielts-writing-test-18", "index.html"),
    "speaking_advice": os.path.join(BASE_DIR, "ielts-speaking-cue-card-talk-about-a-time-when-you-gave-advice-to-someone", "index.html")
}

def load_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    results = {}
    summary = {
        "total": 0,
        "VERIFIED": 0,
        "NEEDS_REVIEW": 0,
        "FAILED": 0
    }
    
    # 1. Listening
    html = load_file(FILES["listening_163"])
    extracted_l = parse_listening(html, FILES["listening_163"])
    validated_l = validate_listening(extracted_l)
    results["listening_163"] = json.loads(validated_l.model_dump_json())
    
    # 2. Reading
    html = load_file(FILES["reading_24"])
    extracted_r = parse_reading(html, FILES["reading_24"])
    validated_r = validate_reading(extracted_r)
    results["reading_24"] = json.loads(validated_r.model_dump_json())
    
    # 3. Writing
    html = load_file(FILES["writing_18"])
    extracted_w = parse_writing(html, FILES["writing_18"])
    validated_w = validate_writing(extracted_w)
    results["writing_18"] = json.loads(validated_w.model_dump_json())
    
    # 4. Speaking
    html = load_file(FILES["speaking_advice"])
    extracted_s = parse_speaking(html, FILES["speaking_advice"])
    validated_s = validate_speaking(extracted_s)
    results["speaking_advice"] = json.loads(validated_s.model_dump_json())
    
    # Save outputs and update summary
    for k, v in results.items():
        summary["total"] += 1
        state = v.get("validation_state", "UNVERIFIED")
        if state in summary:
            summary[state] += 1
            
        out_path = os.path.join(OUT_DIR, f"{k}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(v, f, indent=2)
            
    # Write summary
    report = {
        "summary": summary,
        "details": {
            k: {
                "state": v.get("validation_state"),
                "errors": v.get("validation_errors", [])
            } for k, v in results.items()
        }
    }
    with open(os.path.join(OUT_DIR, "extraction_report.json"), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        
    print(f"Extraction complete. Results saved to {OUT_DIR}")
    print(f"Summary: {summary}")

if __name__ == "__main__":
    main()
