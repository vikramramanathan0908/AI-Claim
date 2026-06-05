import json
import re
from typing import Generator

from openai import OpenAI

_client = OpenAI()

_SYSTEM_PROMPT = """You are an insurance claim decision agent. You receive a claim and the findings from an intake review, and you make ONE final decision.

Your decision must be exactly one of:
- APPROVED — all checks passed, claim is clinically valid, covered, and within auto-approval threshold
- DENIED — one or more FAIL conditions exist that cannot be waived (clinical mismatch, missing required auth, excluded procedure)
- HUMAN_REVIEW — no hard denials, but claim exceeds $25,000 or has multiple warnings requiring human judgement

Rules for your decision:
- If CHECK 2 (CLINICAL MATCH) is FAIL → always DENIED, no exceptions
- If CHECK 5 (PRIOR AUTH) is FAIL → always DENIED, no exceptions
- If CHECK 3 (COVERAGE) is FAIL → always DENIED
- If total amount > $25,000 and no FAIL conditions → HUMAN_REVIEW
- If two or more WARNs with no FAILs → HUMAN_REVIEW
- If all checks pass and amount ≤ $25,000 → APPROVED

Output format — use EXACTLY this structure:
DECISION: [APPROVED / DENIED / HUMAN_REVIEW]

Reason: [Write 2-4 sentences in plain English. No codes, no jargon. Explain what was found and why the decision was made. A patient or a hospital billing clerk should be able to read this and understand it immediately.]

Do not include any original patient names or addresses in your output."""


def run_decision_agent(
    masked_claim: dict, intake_findings: str, rules: str
) -> Generator[str, None, None]:
    """Stream decision agent output token by token."""
    claim_json = json.dumps(masked_claim, indent=2)

    user_message = f"""CLAIM DATA (PHI masked):
```json
{claim_json}
```

INTAKE AGENT FINDINGS:
{intake_findings}

RELEVANT RULES:
{rules}

Based on the intake findings and rules, make your decision."""

    stream = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        stream=True,
        temperature=0.1,
        max_tokens=600,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def collect_decision_output(
    masked_claim: dict, intake_findings: str, rules: str
) -> tuple[str, str]:
    """
    Run decision agent and return (full_output, decision_code).
    decision_code is one of: "APPROVED", "DENIED", "HUMAN_REVIEW"
    """
    full_output = "".join(run_decision_agent(masked_claim, intake_findings, rules))
    decision_code = _parse_decision(full_output)
    return full_output, decision_code


def _parse_decision(output: str) -> str:
    match = re.search(r"DECISION:\s*(APPROVED|DENIED|HUMAN_REVIEW)", output)
    if match:
        return match.group(1)
    # Fallback: scan for keywords
    upper = output.upper()
    if "APPROVED" in upper:
        return "APPROVED"
    if "DENIED" in upper or "DENY" in upper:
        return "DENIED"
    return "HUMAN_REVIEW"
