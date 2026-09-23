import json

def validate_bank(path, is_quant=False):
    with open(path) as f:
        data = json.load(f)
    print(f"Testing {path} (total: {len(data)})")
    prompts = set()
    dup_options_count = 0
    for idx, q in enumerate(data):
        p = q.get('prompt') or q.get('context', '')
        if p in prompts:
            print(f"Duplicate prompt at index {idx}: {p[:40]}")
        prompts.add(p)
        opts = q.get('options')
        if opts:
            if len(opts) != len(set(opts)):
                print(f"Duplicate option in question {q.get('id')}: {opts}")
                dup_options_count += 1
    print(f"Unique prompts: {len(prompts)} / {len(data)}")
    print(f"Questions with duplicate options: {dup_options_count}")

print("Validator ready")
