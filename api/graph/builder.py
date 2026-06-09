from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from graph.state import ClaimState
from graph.nodes import intake_node, decision_node, human_review_node, payment_node, denial_node
from graph.edges import route_after_decision, route_after_human

_graph_instance = None


def get_graph():
    """Return the compiled LangGraph graph (singleton)."""
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = _build_graph()
    return _graph_instance


def _build_graph():
    builder = StateGraph(ClaimState)

    builder.add_node("intake", intake_node)
    builder.add_node("decision", decision_node)
    builder.add_node("human_review", human_review_node)
    builder.add_node("payment", payment_node)
    builder.add_node("denial", denial_node)

    builder.set_entry_point("intake")
    builder.add_edge("intake", "decision")

    builder.add_conditional_edges(
        "decision",
        route_after_decision,
        {
            "payment": "payment",
            "denial": "denial",
            "human_review": "human_review",
        },
    )

    builder.add_conditional_edges(
        "human_review",
        route_after_human,
        {
            "payment": "payment",
            "denial": "denial",
        },
    )

    builder.add_edge("payment", END)
    builder.add_edge("denial", END)

    checkpointer = MemorySaver()
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],
    )
