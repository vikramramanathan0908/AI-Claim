from typing import TypedDict, Optional


class ClaimState(TypedDict):
    raw_edi: str
    parsed_claim: dict
    masked_claim: dict
    token_map: dict
    retrieved_rules: str
    intake_output: str
    decision: str           # "APPROVED" | "DENIED" | "HUMAN_REVIEW"
    decision_output: str
    human_decision: str     # "APPROVE" | "DENY" | "" (empty until human acts)
    payment_output: str
    final_status: str       # "APPROVED" | "DENIED" | "PENDING"
    processing_seconds: float
    error: str
