import re

_NAME_PATTERN = re.compile(r"\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b")
_MEDICAL_TERMS = re.compile(
    r"\b(knee|surgery|arthroplasty|procedure|diagnosis|ICD|CPT|claim|hospital|"
    r"physician|patient|treatment|lumbar|spine|fusion|pneumonia|osteoarthritis)\b",
    re.IGNORECASE,
)


def check_output(text: str, token_map: dict) -> tuple[bool, str]:
    """
    Return (is_safe, warning_message).

    Checks that:
    1. No original PHI values (from token_map) appear verbatim in the AI output.
    2. No unmasked proper-name patterns appear near medical terms.
    """
    original_phi_values = set(token_map.values())

    for phi_val in original_phi_values:
        if phi_val and len(phi_val) > 3 and phi_val.lower() in text.lower():
            return False, (
                f"Guardrail triggered: AI output may contain original PHI value. "
                f"Review agent output before displaying."
            )

    # Check for name-like patterns near medical terms within a 200-char window
    medical_matches = [m.start() for m in _MEDICAL_TERMS.finditer(text)]
    name_matches = [(m.start(), m.group()) for m in _NAME_PATTERN.finditer(text)]

    for name_start, name_text in name_matches:
        for med_start in medical_matches:
            if abs(name_start - med_start) < 200:
                # It's possible this is a provider name — acceptable in context
                # Only flag if token map has a name token suggesting masking occurred
                has_name_token = any(
                    k.startswith("FNAME-") for k in token_map.keys()
                )
                if has_name_token:
                    return False, (
                        f"Guardrail warning: Possible unmasked name '{name_text}' "
                        f"detected near medical content. Verify PHI masking is complete."
                    )
                break

    return True, ""
