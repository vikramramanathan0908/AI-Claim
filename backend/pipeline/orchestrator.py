import time
import uuid
from typing import Generator

from parser.edi_parser import parse_edi
from phi.phi_masker import PHIMasker
from rag.rules_retriever import get_retriever
from graph.builder import get_graph

_masker = PHIMasker()


def run_pipeline(edi_text: str, thread_id: str) -> Generator[tuple[str, dict], None, None]:
    """
    Execute the full claims processing pipeline for a new claim.

    Yields (event_type, data) tuples:
      ("parsed",   {"parsed_claim": dict, "masked_claim": dict, "token_map": dict})
      ("rules",    {"retrieved_rules": str})
      ("node",     {"node": str, "state": dict})
      ("interrupted", {"decision_output": str, "claim_id": str})
      ("done",     {"final_status": str, "state": dict})
    """
    start = time.time()
    graph = get_graph()
    retriever = get_retriever()

    parsed_claim = parse_edi(edi_text)
    masked_claim, token_map = _masker.mask(parsed_claim)

    yield ("parsed", {
        "parsed_claim": parsed_claim,
        "masked_claim": masked_claim,
        "token_map": token_map,
    })

    retrieved_rules = retriever.get_relevant_rules(masked_claim)
    yield ("rules", {"retrieved_rules": retrieved_rules})

    initial_state: dict = {
        "raw_edi": edi_text,
        "parsed_claim": parsed_claim,
        "masked_claim": masked_claim,
        "token_map": token_map,
        "retrieved_rules": retrieved_rules,
        "intake_output": "",
        "decision": "",
        "decision_output": "",
        "human_decision": "",
        "payment_output": "",
        "final_status": "PENDING",
        "processing_seconds": 0.0,
        "error": "",
    }

    config = {"configurable": {"thread_id": thread_id}}

    for event in graph.stream(initial_state, config=config, stream_mode="updates"):
        for node_name, node_state in event.items():
            if node_name == "__interrupt__":
                interrupt_data = node_state[0].value if node_state else {}
                yield ("interrupted", {
                    "decision_output": interrupt_data.get("decision_summary", ""),
                    "claim_id": interrupt_data.get("claim_id", ""),
                })
                return
            yield ("node", {"node": node_name, "state": node_state})

    final_state = graph.get_state(config).values
    elapsed = time.time() - start
    yield ("done", {
        "final_status": final_state.get("final_status", "PENDING"),
        "processing_seconds": round(elapsed, 1),
        "state": dict(final_state),
    })


def resume_pipeline(thread_id: str, human_decision: str) -> Generator[tuple[str, dict], None, None]:
    """
    Resume a paused pipeline after human makes APPROVE or DENY decision.

    Yields the same (event_type, data) tuples as run_pipeline.
    """
    start = time.time()
    graph = get_graph()
    config = {"configurable": {"thread_id": thread_id}}

    from langgraph.types import Command
    resume_command = Command(resume=human_decision)

    for event in graph.stream(resume_command, config=config, stream_mode="updates"):
        for node_name, node_state in event.items():
            yield ("node", {"node": node_name, "state": node_state})

    final_state = graph.get_state(config).values
    elapsed = time.time() - start
    yield ("done", {
        "final_status": final_state.get("final_status", "PENDING"),
        "processing_seconds": round(elapsed, 1),
        "state": dict(final_state),
    })


def make_thread_id() -> str:
    return str(uuid.uuid4())
