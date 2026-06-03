import json
from typing import Generator

from openai import OpenAI

_client = OpenAI()

_SYSTEM_PROMPT = """You are an insurance claim intake agent. Your job is to thoroughly check a submitted insurance claim and report every finding.

You will receive:
1. A masked insurance claim in JSON format (patient PHI has been replaced with tokens)
2. Relevant insurance rules and clinical guidelines

Perform ALL of the following checks and report each one:

CHECK 1 — DIAGNOSIS VALIDITY
Are the ICD-10 diagnosis codes present and properly formatted? Do they exist in standard ICD-10?

CHECK 2 — CLINICAL MATCH
Does the primary diagnosis clinically support the billed procedure? Use the clinical guidelines provided. A diagnosis of pneumonia (J18.x) with a knee replacement (27447) is clinically impossible and must be flagged FAIL.

CHECK 3 — CHARGE ARITHMETIC
Do the individual procedure charges add up to the total claim amount?

CHECK 4 — COVERAGE CHECK
Are the billed procedure codes covered under the patient's benefit plan based on the benefit rules?

CHECK 5 — PRIOR AUTHORIZATION
Does the claim include a valid prior authorization number for procedures that require it? If prior_auth is null or missing, and the procedure requires auth, this is FAIL.

CHECK 6 — PROVIDER NETWORK STATUS
Is the billing provider a contracted network provider based on the benefit rules?

CHECK 7 — CLAIM COMPLETENESS
Are all required fields present: claim ID, patient member ID, dates of service, provider NPI, at least one diagnosis, at least one procedure?

CHECK 8 — DOLLAR THRESHOLD
Does the total claim amount exceed the auto-approval threshold ($25,000)? If so, flag for human review.

Output format — use EXACTLY this structure for each check:
CHECK [N] — [NAME]: [PASS / FAIL / WARN]
Reason: [one sentence explaining the finding]

After all checks, write a summary line:
SUMMARY: [X] checks passed, [Y] failed, [Z] warnings

Be precise. Do not fabricate information not present in the claim. Do not include any original patient names or addresses — the claim you receive has already been masked."""


def run_intake_agent(masked_claim: dict, rules: str) -> Generator[str, None, None]:
    """Stream intake agent output token by token."""
    claim_json = json.dumps(masked_claim, indent=2)

    user_message = f"""CLAIM DATA (PHI masked):
```json
{claim_json}
```

RELEVANT RULES:
{rules}

Please perform all 8 checks and report your findings."""

    stream = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        stream=True,
        temperature=0.1,
        max_tokens=1200,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def collect_intake_output(masked_claim: dict, rules: str) -> str:
    """Run intake agent and return the full output as a string."""
    return "".join(run_intake_agent(masked_claim, rules))
