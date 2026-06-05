from graph.state import ClaimState


def route_after_decision(state: ClaimState) -> str:
    decision = state.get("decision", "")
    if decision == "APPROVED":
        return "payment"
    if decision == "DENIED":
        return "denial"
    return "human_review"


def route_after_human(state: ClaimState) -> str:
    human_decision = state.get("human_decision", "")
    if human_decision == "APPROVE":
        return "payment"
    return "denial"
