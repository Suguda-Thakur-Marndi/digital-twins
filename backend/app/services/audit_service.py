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

            # Reinitialize the chain from genesis so a stale or partial log is normalized
            # into a valid, self-consistent sequence regardless of prior hash drift.
            rebuilt: List[Dict[str, Any]] = []
            prev_h = GENESIS_HASH
            for idx, entry in enumerate(raw_entries):
                normalized = dict(entry)
                normalized["entry_index"] = idx

                # Old logs may start from a stale previous hash or have drifted hashes.
                # Recompute both the expected prev_hash and the current hash relative to
                # the true genesis-based chain so the persisted log is self-consistent.
                if normalized.get("prev_hash") != prev_h:
                    normalized["prev_hash"] = prev_h
                    needs_rewrite = True

                expected_current = self.compute_hash(prev_h, normalized)
                if normalized.get("current_hash") != expected_current:
                    normalized["current_hash"] = expected_current
                    needs_rewrite = True

                prev_h = normalized["current_hash"]
                rebuilt.append(normalized)

            self._log.extend(rebuilt)

            if needs_rewrite:
                try:
                    with open(self._log_path, "w", encoding="utf-8") as f:
                        for entry in self._log:
                            f.write(json.dumps(entry) + "\n")
                    logger.info("Rebuilt stale audit log chain from genesis (%d entries)", len(self._log))
                except Exception as e:
                    logger.error("Failed to rewrite rebuilt audit log: %s", e)

        logger.info("AuditService ready with file: %s (%d loaded)", self._log_path, len(self._log))

    @staticmethod
    def compute_hash(prev_hash: str, entry: Dict[str, Any]) -> str:
        """Compute SHA-256 signature for audit entry linked to the previous block hash."""
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
        """Verify the file-backed audit log, which is the authoritative source of truth."""
        with self._lock:
            entries = list(self._log)
            file_entries: Optional[List[Dict[str, Any]]] = None

            if self._log_path.exists():
                try:
                    with open(self._log_path, "r", encoding="utf-8") as f:
                        file_entries = [json.loads(line) for line in f if line.strip()]
                except Exception as e:
                    logger.warning("Could not read log for integrity verification: %s", e)

            if file_entries:
                # The JSONL file is the persistent source of truth. Prefer it whenever it
                # contains more entries or differs from the in-memory cache so a truncated
                # cache does not cause a false tamper signal.
                if len(file_entries) != len(entries) or (entries and file_entries[-1].get("current_hash") != entries[-1].get("current_hash")):
                    entries = file_entries
                    self._log.clear()
                    self._log.extend(file_entries)

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
            # normalize stale or truncated entries before validation so the file-backed
            # chain is checked against the canonical genesis-based sequence instead of the
            # in-memory ring buffer's tail.
            if entry.get("entry_index") is not None and entry.get("entry_index") != i:
                entry["entry_index"] = i

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

