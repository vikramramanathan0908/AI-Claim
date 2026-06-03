import json
import re
import uuid
from typing import Any

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig


class _MemberIDRecognizer(PatternRecognizer):
    """Recognises insurance member IDs like PPO202400123 or MBR1234567."""

    def __init__(self):
        patterns = [
            Pattern("MEMBER_ID_PPO", r"\bPPO\d{6,12}\b", 0.85),
            Pattern("MEMBER_ID_MBR", r"\bMBR\d{7,10}\b", 0.85),
            Pattern("MEMBER_ID_GEN", r"\b[A-Z]{2,4}\d{7,10}\b", 0.6),
        ]
        super().__init__(supported_entity="MEMBER_ID", patterns=patterns)


class PHIMasker:
    def __init__(self):
        self._analyzer = AnalyzerEngine()
        self._analyzer.registry.add_recognizer(_MemberIDRecognizer())
        self._anonymizer = AnonymizerEngine()
        self._entity_types = ["PERSON", "LOCATION", "MEMBER_ID", "US_SSN", "PHONE_NUMBER"]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def mask(self, claim_dict: dict) -> tuple[dict, dict]:
        """
        Replace PHI in claim_dict with deterministic tokens.

        Returns (masked_dict, token_map) where token_map maps each
        generated token back to the original value.
        """
        token_map: dict[str, str] = {}
        masked = self._mask_value(claim_dict, token_map)
        return masked, token_map

    def restore_claim_id(self, text: str, token_map: dict) -> str:
        """Restore only the claim ID in text — names/addresses stay masked."""
        for token, original in token_map.items():
            if original.startswith("CLM-"):
                text = text.replace(token, original)
        return text

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _mask_value(self, value: Any, token_map: dict) -> Any:
        if isinstance(value, dict):
            return {k: self._mask_value(v, token_map) for k, v in value.items()}
        if isinstance(value, list):
            return [self._mask_value(item, token_map) for item in value]
        if isinstance(value, str) and value.strip():
            return self._mask_string(value, token_map)
        return value

    def _mask_string(self, text: str, token_map: dict) -> str:
        results = self._analyzer.analyze(text=text, language="en", entities=self._entity_types)
        if not results:
            return text

        results = sorted(results, key=lambda r: r.start, reverse=True)
        chars = list(text)

        for result in results:
            entity_type = result.entity_type
            original = text[result.start:result.end]

            existing_token = self._find_existing_token(original, token_map)
            if existing_token:
                token = existing_token
            else:
                token = self._make_token(entity_type, original)
                token_map[token] = original

            chars[result.start:result.end] = list(token)

        return "".join(chars)

    def _find_existing_token(self, original: str, token_map: dict) -> str | None:
        for tok, val in token_map.items():
            if val == original:
                return tok
        return None

    def _make_token(self, entity_type: str, original: str) -> str:
        uid = uuid.uuid4().hex[:8].upper()
        if entity_type == "PERSON":
            return f"FNAME-{uid}"
        if entity_type in ("LOCATION", "GPE"):
            return f"ADDR-{uid}"
        if entity_type == "MEMBER_ID":
            return f"MID-{uid}"
        return f"PHI-{uid}"
