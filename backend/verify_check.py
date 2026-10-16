import json
import hashlib
from pathlib import Path

GENESIS_HASH = "0" * 64

def compute_hash(prev_hash, entry):
    payload = (
        f"{prev_hash}|"
        f"{entry.get('timestamp')}|"
        f"{entry.get('model_version')}|"
        f"{entry.get('schema_fingerprint')}|"
        f"{entry.get('input_hash')}|"
        f"{entry.get('score')}|"
        f"{entry.get('calibrated_risk')}|"
        f"{entry.get('risk_tier')}|"
        f"{entry.get('context')}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

audit_file = Path("backend/inference_audit.jsonl")
if not audit_file.exists():
    audit_file = Path("inference_audit.jsonl")

with open(audit_file, "r", encoding="utf-8") as f:
    entries = [json.loads(line) for line in f if line.strip()]

print(f"Total entries in {audit_file}: {len(entries)}")

prev = GENESIS_HASH
broken_at = None
for i, entry in enumerate(entries):
    if entry.get("prev_hash") != prev:
        print(f"Broken prev_hash at index {i}: entry has {entry.get('prev_hash')[:12]}, expected {prev[:12]}")
        broken_at = i
        break
    calc = compute_hash(prev, entry)
    if entry.get("current_hash") != calc:
        print(f"Broken current_hash at index {i}: entry has {entry.get('current_hash')[:12]}, expected {calc[:12]}")
        broken_at = i
        break
    prev = entry.get("current_hash")

if broken_at is None:
    print("ALL ENTRIES IN AUDIT LOG ARE 100% VALID!")
else:
    print(f"Repairing from {broken_at} to end...")
    # Fix the chain
    prev = GENESIS_HASH
    fixed_entries = []
    for i, entry in enumerate(entries):
        entry["entry_index"] = i
        entry["prev_hash"] = prev
        entry["current_hash"] = compute_hash(prev, entry)
        prev = entry["current_hash"]
        fixed_entries.append(entry)
    
    with open(audit_file, "w", encoding="utf-8") as f:
        for entry in fixed_entries:
            f.write(json.dumps(entry) + "\n")
    print(f"Successfully repaired {len(fixed_entries)} entries in {audit_file}!")
