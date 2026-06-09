import time

from langgraph.types import interrupt

from agents.intake_agent import collect_intake_output
from agents.decision_agent import collect_decision_output
from agents.payment_agent import collect_payment_output
from graph.state import ClaimState


def intake_node(state: ClaimState) -> dict:
    intake_output = collect_intake_output(
        state["masked_claim"],
        state["retrieved_rules"],
    )
    return {"intake_output": intake_output}


def decision_node(state: ClaimState) -> dict:
    full_output, decision_code = collect_decision_output(
        state["masked_claim"],
        state["intake_output"],
        state["retrieved_rules"],
    )
    return {
        "decision_output": full_output,
        "decision": decision_code,
    }


def human_review_node(state: ClaimState) -> dict:
    # Pause the graph and wait for a human to provide a decision.
    # LangGraph checkpointer saves state here; the graph resumes when
    # the caller invokes graph.invoke/stream again with human_decision set.
    human_input = interrupt(
        {
            "message": "Human review required. Approve or deny this claim.",
            "decision_summary": state.get("decision_output", ""),
            "claim_id": state.get("parsed_claim", {}).get("claim", {}).get("id", ""),
        }
    )
    return {"human_decision": human_input}


def payment_node(state: ClaimState) -> dict:
    payment_output = collect_payment_output(
        state["masked_claim"],
        state["retrieved_rules"],
    )
    return {
        "payment_output": payment_output,
        "final_status": "APPROVED",
    }


def denial_node(state: ClaimState) -> dict:
    return {"final_status": "DENIED"}
