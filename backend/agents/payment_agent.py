import json
from typing import Generator

import os
from openai import OpenAI

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

_SYSTEM_PROMPT = """You are an insurance payment calculation agent. The claim has been approved. Calculate exactly how much the insurance plan pays and how much the patient owes.

Use the fee schedule and benefit rules provided to perform this calculation:

CALCULATION STEPS:
1. Find the contracted rate for each billed procedure from the fee schedule (not the billed amount)
2. Apply the annual deductible: $2,000 per member per year. Assume the deductible has NOT been met yet for this claim unless stated otherwise.
3. Apply coinsurance: Plan pays 80%, Member pays 20% on the amount after deductible
4. Check the out-of-pocket maximum: $5,000 per member per year. Member never pays more than this total.

Output format — write a plain English Explanation of Benefits:

EXPLANATION OF BENEFITS

Claim: [claim ID]
Date of Service: [date]
Provider: [provider name or masked token]
Plan: PPO-2024

CHARGES BREAKDOWN:
[For each procedure]:
  Procedure [CODE]: Billed $X,XXX.XX | Contracted Rate: $X,XXX.XX

TOTAL BILLED: $X,XXX.XX
CONTRACTED RATE (ALLOWED AMOUNT): $X,XXX.XX

PAYMENT CALCULATION:
  Deductible applied: $X,XXX.XX
  Amount after deductible: $X,XXX.XX
  Plan pays (80%): $X,XXX.XX
  Member pays (20%): $X,XXX.XX

SUMMARY:
  Insurance Company Pays: $X,XXX.XX
  Patient Responsibility: $X,XXX.XX

Plain English: [Write 2-3 sentences explaining what the patient owes and why, in language a patient can understand. Do not use codes or insurance jargon.]

Do not include any original patient names or addresses in your output."""


def run_payment_agent(masked_claim: dict, rules: str) -> Generator[str, None, None]:
    """Stream payment agent output token by token."""
    claim_json = json.dumps(masked_claim, indent=2)

    user_message = f"""APPROVED CLAIM DATA (PHI masked):
```json
{claim_json}
```

FEE SCHEDULE AND BENEFIT RULES:
{rules}

Calculate the payment breakdown for this approved claim."""

    stream = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        stream=True,
        temperature=0.1,
        max_tokens=800,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def collect_payment_output(masked_claim: dict, rules: str) -> str:
    """Run payment agent and return the full output as a string."""
    return "".join(run_payment_agent(masked_claim, rules))
