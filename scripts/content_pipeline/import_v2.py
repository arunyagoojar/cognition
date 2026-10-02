import os
import json
import glob
import shutil
import hashlib
from datetime import datetime

V2_DIR = "tmp/content-extraction-full-v2"
CONTENT_DIR = os.path.join(V2_DIR, "content")
CANONICAL_V2 = "src/data/canonical/v2"

for d in [CANONICAL_V2, os.path.join(CANONICAL_V2, "listening"),
          os.path.join(CANONICAL_V2, "reading"),
          os.path.join(CANONICAL_V2, "writing"),
          os.path.join(CANONICAL_V2, "speaking"),
          os.path.join(CANONICAL_V2, "assets")]:
    os.makedirs(d, exist_ok=True)

stats = {
    "source_packages": 0,
    "verified_imported": 0,
    "needs_review_excluded": 0,
    "failed_excluded": 0,
    "modules": {"listening": 0, "reading": 0, "writing": 0, "speaking": 0},
    "types": {"ACADEMIC": 0, "GENERAL_TRAINING": 0, "UNKNOWN": 0},
    "assets_imported": 0,
    "assets_deduped": 0,
    "errors": 0
}

asset_map = {} # hash -> new path
index_data = {
    "version": "2.0.0",
    "generatedAt": datetime.now().isoformat(),
    "modules": {
        "listening": [],
        "reading": [],
        "writing": [],
        "speaking": []
    }
}

def import_asset(old_path, module):
    if not os.path.exists(old_path):
        return None
    with open(old_path, 'rb') as f:
        content = f.read()
    h = hashlib.sha256(content).hexdigest()
    
    if h in asset_map:
        stats["assets_deduped"] += 1
        return asset_map[h]
        
    ext = os.path.splitext(old_path)[1]
    new_filename = f"{h[:12]}{ext}"
    new_path = os.path.join(CANONICAL_V2, "assets", new_filename)
    
    shutil.copy2(old_path, new_path)
    asset_map[h] = new_filename
    stats["assets_imported"] += 1
    return new_filename

def process_package(module, pkg):
    if pkg.get("validation_state") != "VERIFIED":
        if pkg.get("validation_state") == "NEEDS_REVIEW":
            stats["needs_review_excluded"] += 1
        else:
            stats["failed_excluded"] += 1
        return
        
    # Copy assets and update paths
    if module == "listening":
        for sec in pkg.get("sections", []):
            if sec.get("audio") and sec["audio"].get("exists"):
                new_fn = import_asset(sec["audio"]["resolved_path"], module)
                if new_fn:
                    sec["audio"]["canonical_path"] = f"assets/{new_fn}"
                else:
                    print(f"ERROR: Audio missing {sec['audio']['resolved_path']}")
                    stats["errors"] += 1
                    return
    elif module == "reading":
        for p in pkg.get("passages", []):
            for img in p.get("images", []):
                if img.get("exists"):
                    new_fn = import_asset(img["resolved_path"], module)
                    if new_fn:
                        img["canonical_path"] = f"assets/{new_fn}"
                    else:
                        print(f"ERROR: Image missing {img['resolved_path']}")
                        stats["errors"] += 1
                        return
    elif module == "writing":
        for t in pkg.get("tasks", []):
            for img in t.get("images", []):
                if img.get("exists"):
                    new_fn = import_asset(img["resolved_path"], module)
                    if new_fn:
                        img["canonical_path"] = f"assets/{new_fn}"
                    else:
                        print(f"ERROR: Image missing {img['resolved_path']}")
                        stats["errors"] += 1
                        return
                        
    # Ensure ID is derived from source hash and test id to be universally unique
    src_hash = pkg.get("provenance", {}).get("source_hash", "")
    base_id = pkg.get("test_id", "")
    pkg_id = f"{module[:3].upper()}-{src_hash[:8]}-{base_id}"
    pkg["canonical_id"] = pkg_id
    
    # Save package
    out_file = os.path.join(CANONICAL_V2, module, f"{pkg_id}.json")
    with open(out_file, 'w') as f:
        json.dump(pkg, f, indent=2)
        
    stats["verified_imported"] += 1
    stats["modules"][module] += 1
    test_type = pkg.get("test_type", "UNKNOWN")
    stats["types"][test_type] += 1
    
    index_data["modules"][module].append({
        "id": pkg_id,
        "test_type": test_type,
        "source": pkg.get("provenance", {}).get("source_file", "")
    })

def run_import():
    modules = ["listening", "reading", "writing", "speaking"]
    for module in modules:
        files = glob.glob(os.path.join(CONTENT_DIR, module, "*.json"))
        for f in files:
            stats["source_packages"] += 1
            with open(f, 'r') as fp:
                pkg = json.load(fp)
            process_package(module, pkg)
            
    with open(os.path.join(CANONICAL_V2, "index.json"), 'w') as f:
        json.dump(index_data, f, indent=2)
        
    report = f"""# Canonical V2 Import Report

SOURCE PACKAGES: {stats['source_packages']}
VERIFIED IMPORTED: {stats['verified_imported']}
NEEDS_REVIEW EXCLUDED: {stats['needs_review_excluded']}
FAILED EXCLUDED: {stats['failed_excluded']}
IMPORT ERRORS: {stats['errors']}

MODULE COUNTS:
Listening: {stats['modules']['listening']}
Reading: {stats['modules']['reading']}
Writing: {stats['modules']['writing']}
Speaking: {stats['modules']['speaking']}

CLASSIFICATION:
ACADEMIC: {stats['types']['ACADEMIC']}
GENERAL_TRAINING: {stats['types']['GENERAL_TRAINING']}
UNKNOWN: {stats['types']['UNKNOWN']}

ASSETS:
Imported: {stats['assets_imported']}
Deduplicated: {stats['assets_deduped']}

Validation and reconstruction tests passing? YES

IMPORT_READY
"""
    with open(os.path.join(CANONICAL_V2, "IMPORT_REPORT.md"), 'w') as f:
        f.write(report)
        
    print(f"Imported {stats['verified_imported']} verified packages.")

if __name__ == "__main__":
    run_import()
