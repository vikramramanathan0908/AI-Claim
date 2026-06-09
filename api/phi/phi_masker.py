import re
import uuid
from typing import Any

_PHI_FIELDS = {"name", "member_id", "address", "city", "zip", "dob"}

_PATTERNS = [
    ("MEMBER_ID", re.compile(r'\b(?:PPO|MBR|[A-Z]{2,4})\d{6,12}\b')),
    ("US_SSN",    re.compile(r'\b\d{3}-\d{2}-\d{4}\b')),
    ("PHONE",     re.compile(r'\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b')),
    ("PERSON",    re.compile(r'\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b')),
]


class PHIMasker:
    def __init__(self):
        pass

    def mask(self, claim_dict: dict) -> tuple[dict, dict]:
        token_map: dict[str, str] = {}
        masked = self._mask_value(claim_dict, token_map, field_name=None)
        return masked, token_map

    def restore_claim_id(self, text: str, token_map: dict) -> str:
        for token, original in token_map.items():
            if original.startswith("CLM-"):
                text = text.replace(token, original)
        return text

    def _mask_value(self, value: Any, token_map: dict, field_name: str | None) -> Any:
        if isinstance(value, dict):
            return {k: self._mask_value(v, token_map, field_name=k) for k, v in value.items()}
        if isinstance(value, list):
            return [self._mask_value(item, token_map, field_name=field_name) for item in value]
        if isinstance(value, str) and value.strip():
            if field_name in _PHI_FIELDS:
                return self._mask_whole(value, field_name, token_map)
            return self._mask_patterns(value, token_map)
        return value

    def _mask_whole(self, text: str, field_name: str, token_map: dict) -> str:
        existing = self._find_existing_token(text, token_map)
        if existing:
            return existing
        if field_name == "name":
            token = f"FNAME-{uuid.uuid4().hex[:8].upper()}"
        elif field_name == "member_id":
            token = f"MID-{uuid.uuid4().hex[:8].upper()}"
        elif field_name in ("address", "city", "zip"):
            token = f"ADDR-{uuid.uuid4().hex[:8].upper()}"
        elif field_name == "dob":
            token = f"DOB-{uuid.uuid4().hex[:8].upper()}"
        else:
            token = f"PHI-{uuid.uuid4().hex[:8].upper()}"
        token_map[token] = text
        return token

    def _mask_patterns(self, text: str, token_map: dict) -> str:
        for entity_type, pattern in _PATTERNS:
            for m in reversed(list(pattern.finditer(text))):
                original = m.group()
                existing = self._find_existing_token(original, token_map)
                token = existing or self._make_token(entity_type)
                if not existing:
                    token_map[token] = original
                text = text[:m.start()] + token + text[m.end():]
        return text

    def _find_existing_token(self, original: str, token_map: dict) -> str | None:
        for tok, val in token_map.items():
            if val == original:
                return tok
        return None

    def _make_token(self, entity_type: str) -> str:
        uid = uuid.uuid4().hex[:8].upper()
        if entity_type == "PERSON":
            return f"FNAME-{uid}"
        if entity_type == "MEMBER_ID":
            return f"MID-{uid}"
        return f"PHI-{uid}"
