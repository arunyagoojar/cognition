import os
import json
import glob

CANONICAL_V2 = "src/data/canonical/v2"

def validate_import():
    modules = ["listening", "reading", "writing", "speaking"]
    ids = set()
    errors = 0
    
    for module in modules:
        for f in glob.glob(os.path.join(CANONICAL_V2, module, "*.json")):
            with open(f, 'r') as fp:
                pkg = json.load(fp)
                
            if pkg.get("validation_state") != "VERIFIED":
                print(f"ERROR: Non-verified package imported: {f}")
                errors += 1
                
            cid = pkg.get("canonical_id")
            if not cid:
                print(f"ERROR: Missing canonical_id in: {f}")
                errors += 1
            if cid in ids:
                print(f"ERROR: Duplicate canonical_id: {cid}")
                errors += 1
            ids.add(cid)
            
            # Asset checking
            def check_asset(asset):
                nonlocal errors
                if not asset or not asset.get("exists"): return
                cp = asset.get("canonical_path")
                if not cp or not os.path.exists(os.path.join(CANONICAL_V2, cp)):
                    print(f"ERROR: Missing asset file {cp} in {cid}")
                    errors += 1
                    
            if module == "listening":
                for sec in pkg.get("sections", []):
                    check_asset(sec.get("audio"))
            elif module == "reading":
                for p in pkg.get("passages", []):
                    for img in p.get("images", []):
                        check_asset(img)
            elif module == "writing":
                for t in pkg.get("tasks", []):
                    for img in t.get("images", []):
                        check_asset(img)
                        
    if errors == 0:
        print("Validation PASSED")
    else:
        print(f"Validation FAILED with {errors} errors")

if __name__ == "__main__":
    validate_import()
