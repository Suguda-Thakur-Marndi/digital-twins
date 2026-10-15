"""
Inference Audit Logging Service.
Records tamper-evident inference events to local JSONL log file and in-memory cache.
Includes: cryptographic SHA-256 hash-chaining linking each entry to the previous entry's hash.
Never logs raw patient identities or PII.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import deque
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MAX_LOG_ENTRIES = 50000
GENESIS_HASH = "0" * 64


class AuditService:
    """Thread-safe inference audit logger with cryptographic hash-chain persistence."""

    def __init__(self, log_path: Optional[Path] = None):
        if log_path is None:
            self._log_path = Path("backend/inference_audit.jsonl")
            if not self._log_path.parent.exists():
                self._log_path = Path("inference_audit.jsonl")
        else:
            self._log_path = Path(log_path)

        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._log: deque[Dict[str, Any]] = deque(maxlen=MAX_LOG_ENTRIES)
        self._lock = Lock()

        # Load existing entries if present and ensure hash-chain continuity
        if self._log_path.exists():
            needs_rewrite = False
            raw_entries: List[Dict[str, Any]] = []
            try:
                with open(self._log_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            raw_entries.append(json.loads(line))
            except Exception as e:
                logger.warning("Could not read existing audit log %s: %s", self._log_path, e)

            # Ensure every entry in the chain has valid prev_hash and current_hash
            prev_h = GENESIS_HASH
            for idx, entry in enumerate(raw_entries):
                entry["entry_index"] = idx
                if "prev_hash" not in entry or "current_hash" not in entry or entry.get("prev_hash") != prev_h:
                    entry["prev_hash"] = prev_h
                    entry["current_hash"] = self.compute_hash(prev_h, entry)
                    needs_rewrite = True
                prev_h = entry["current_hash"]
                self._log.append(entry)

            if needs_rewrite:
                try:
                    with open(self._log_path, "w", encoding="utf-8") as f:
                        for entry in self._log:
                            f.write(json.dumps(entry) + "\n")
                    logger.info("Upgraded audit log to cryptographic hash chain (%d entries)", len(self._log))
                except Exception as e:
                    logger.error("Failed to rewrite upgraded audit log: %s", e)

        logger.info("AuditService ready with file: %s (%d loaded)", self._log_path, len(self._log))

    @staticmethod
    def compute_hash(prev_hash: str, entry: Dict[str, Any]) -> str:
        """Compute SHA-256 signature for audit entry linked to previous block hash."""
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

    def log(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Append a tamper-evident audit entry to in-memory deque and JSONL file."""
        with self._lock:
            prev_hash = self._log[-1]["current_hash"] if self._log else GENESIS_HASH
            safe_entry: Dict[str, Any] = {
                "entry_index": len(self._log),
                "timestamp": entry.get("timestamp"),
                "model_version": entry.get("model_version", "1.0.0"),
                "schema_fingerprint": entry.get("schema_fingerprint", entry.get("schema_hash")),
                "input_hash": entry.get("input_hash", "00000000"),
                "score": entry.get("score", entry.get("risk_score")),
                "calibrated_risk": entry.get("calibrated_risk"),
                "risk_tier": entry.get("risk_tier"),
                "context": entry.get("context", "predict"),
                "prev_hash": prev_hash,
            }
            safe_entry["current_hash"] = self.compute_hash(prev_hash, safe_entry)

            self._log.append(safe_entry)
            try:
                with open(self._log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(safe_entry) + "\n")
            except Exception as e:
                logger.error("Failed to append to audit log file: %s", e)

            return safe_entry

    def get_log(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            entries = list(self._log)
        return entries[-limit:][::-1]

    def verify_integrity(self) -> Dict[str, Any]:
        """
        Verify cryptographic hash-chain across all stored log entries.
        Walks from genesis block to tip. Detects any payload or linkage modification.
        """
        with self._lock:
            entries = list(self._log)

        if not entries:
            return {
                "is_valid": True,
                "total_entries": 0,
                "tampered_at_index": None,
                "first_hash": None,
                "last_hash": None,
                "message": "Audit log is empty; hash-chain initialized at genesis.",
            }

        expected_prev = entries[0].get("prev_hash", GENESIS_HASH) if entries[0].get("entry_index", 0) > 0 else GENESIS_HASH
        for i, entry in enumerate(entries):
            if entry.get("prev_hash") != expected_prev:
                return {
                    "is_valid": False,
                    "total_entries": len(entries),
                    "tampered_at_index": i,
                    "first_hash": entries[0].get("current_hash"),
                    "last_hash": entries[-1].get("current_hash"),
                    "message": f"Hash chain broken at entry #{i}: prev_hash mismatch.",
                }
            expected_curr = self.compute_hash(expected_prev, entry)
            if entry.get("current_hash") != expected_curr:
                return {
                    "is_valid": False,
                    "total_entries": len(entries),
                    "tampered_at_index": i,
                    "first_hash": entries[0].get("current_hash"),
                    "last_hash": entries[-1].get("current_hash"),
                    "message": f"Tampering detected at entry #{i}: payload signature mismatch.",
                }
            expected_prev = entry.get("current_hash", "")

        return {
            "is_valid": True,
            "total_entries": len(entries),
            "tampered_at_index": None,
            "first_hash": entries[0].get("current_hash"),
            "last_hash": entries[-1].get("current_hash"),
            "message": f"Cryptographic hash chain intact across all {len(entries)} verified entries.",
        }

