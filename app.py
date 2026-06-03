import json
import os
import time
from pathlib import Path

import streamlit as st
try:
    from dotenv import load_dotenv
    load_dotenv(".env", override=True)
except ImportError:
    pass
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    os.environ["OPENAI_API_KEY"] = api_key

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AI Claims Processing",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
.stApp { background-color: #0f1117; }
.metric-card {
    background: #1e2130;
    border: 1px solid #2d3148;
    border-radius: 8px;
    padding: 16px 20px;
    text-align: center;
}
.badge-approved {
    background: #1a472a;
    color: #4ade80;
    border: 1px solid #4ade80;
    border-radius: 6px;
    padding: 6px 18px;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 1px;
}
.badge-denied {
    background: #450a0a;
    color: #f87171;
    border: 1px solid #f87171;
    border-radius: 6px;
    padding: 6px 18px;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 1px;
}
.badge-pending {
    background: #1c1a00;
    color: #facc15;
    border: 1px solid #facc15;
    border-radius: 6px;
    padding: 6px 18px;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 1px;
}
.agent-header {
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
}
.phi-badge {
    background: #0f2744;
    color: #60a5fa;
    border: 1px solid #2563eb;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 0.78rem;
    font-weight: 600;
}
</style>
""", unsafe_allow_html=True)

# ── Constants ─────────────────────────────────────────────────────────────────
CLAIMS_DIR = Path(__file__).parent / "data" / "claims"
CLAIM_FILES = {
    "Clean Claim — Knee Replacement ($8,500)": "claim_clean.edi",
    "Flagged Claim — Spinal Fusion ($42,000)": "claim_flagged.edi",
    "Fraud Claim — Impossible Diagnosis ($35,000)": "claim_fraud.edi",
}

# ── Session state defaults ────────────────────────────────────────────────────
def _init_state():
    defaults = {
        "thread_id": None,
        "processing_state": "idle",  # idle | running | awaiting_human | done
        "parsed_claim": None,
        "masked_claim": None,
        "token_map": {},
        "retrieved_rules": "",
        "intake_output": "",
        "decision_output": "",
        "decision": "",
        "payment_output": "",
        "final_status": "PENDING",
        "processing_seconds": 0.0,
        "guardrail_warnings": [],
        "selected_file": list(CLAIM_FILES.keys())[0],
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_state()

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown("## 🏥 AI Claims Processing — Live Demo")
st.markdown(
    "Replacing a 30-day manual process with a 60-second AI-powered workflow. "
    "Select a claim below and click **Process Claim**."
)
st.divider()

# ── Claim selector + controls ─────────────────────────────────────────────────
col_sel, col_btn, col_status = st.columns([3, 1, 2])

with col_sel:
    selected_label = st.selectbox(
        "Select claim file",
        options=list(CLAIM_FILES.keys()),
        key="selected_file",
        label_visibility="collapsed",
    )

with col_btn:
    process_clicked = st.button(
        "▶ Process Claim",
        type="primary",
        disabled=st.session_state.processing_state == "running",
        use_container_width=True,
    )

with col_status:
    state = st.session_state.processing_state
    if state == "idle":
        st.markdown('<span class="badge-pending">IDLE</span>', unsafe_allow_html=True)
    elif state == "running":
        st.markdown('<span class="badge-pending">PROCESSING...</span>', unsafe_allow_html=True)
    elif state == "awaiting_human":
        st.markdown('<span class="badge-pending">AWAITING REVIEW</span>', unsafe_allow_html=True)
    elif state == "done":
        fs = st.session_state.final_status
        if fs == "APPROVED":
            st.markdown('<span class="badge-approved">APPROVED</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="badge-denied">DENIED</span>', unsafe_allow_html=True)

st.divider()

# ── Two-column layout ─────────────────────────────────────────────────────────
col_left, col_right = st.columns([1, 1], gap="large")

# ── LEFT: Claim data ──────────────────────────────────────────────────────────
with col_left:
    st.markdown("### Claim Data")

    edi_path = CLAIMS_DIR / CLAIM_FILES[selected_label]
    raw_edi = edi_path.read_text() if edi_path.exists() else ""

    tab_raw, tab_parsed, tab_masked = st.tabs(["Raw EDI", "Parsed JSON", "Masked JSON"])

    with tab_raw:
        st.code(raw_edi, language="text", line_numbers=True)

    with tab_parsed:
        if st.session_state.parsed_claim:
            st.json(st.session_state.parsed_claim)
        else:
            st.info("Run the pipeline to see parsed JSON.")

    with tab_masked:
        if st.session_state.masked_claim:
            st.markdown(
                '<span class="phi-badge">🔒 PHI PROTECTED — Names and addresses replaced with tokens</span>',
                unsafe_allow_html=True,
            )
            st.json(st.session_state.masked_claim)
            if st.session_state.token_map:
                with st.expander("Token map (server-side only — never sent to AI)"):
                    st.json(st.session_state.token_map)
        else:
            st.info("Run the pipeline to see masked JSON.")

# ── RIGHT: AI agent outputs ───────────────────────────────────────────────────
with col_right:
    st.markdown("### AI Processing")

    intake_placeholder = st.empty()
    decision_placeholder = st.empty()
    human_review_placeholder = st.empty()
    payment_placeholder = st.empty()

    def _render_agent_box(placeholder, label: str, content: str, color: str = "#1e2130"):
        with placeholder.container():
            st.markdown(f'<div class="agent-header">{label}</div>', unsafe_allow_html=True)
            if content:
                st.markdown(
                    f'<div style="background:{color};border:1px solid #2d3148;'
                    f'border-radius:8px;padding:14px;font-family:monospace;'
                    f'font-size:0.82rem;white-space:pre-wrap;max-height:320px;overflow-y:auto;">'
                    f'{content}</div>',
                    unsafe_allow_html=True,
                )

    if st.session_state.intake_output:
        _render_agent_box(intake_placeholder, "Agent 1 — Intake Review", st.session_state.intake_output)
    if st.session_state.decision_output:
        _render_agent_box(decision_placeholder, "Agent 2 — Decision", st.session_state.decision_output)
    if st.session_state.payment_output:
        _render_agent_box(payment_placeholder, "Agent 3 — Payment Calculation", st.session_state.payment_output)

    # Human review panel
    if st.session_state.processing_state == "awaiting_human":
        with human_review_placeholder.container():
            st.warning("**Human Review Required** — AI flagged this claim for manual decision.")
            st.markdown("**AI Summary:**")
            st.markdown(st.session_state.decision_output)
            st.divider()
            st.markdown("**Your decision:**")
            h_col1, h_col2 = st.columns(2)
            with h_col1:
                if st.button("✅ APPROVE", type="primary", use_container_width=True):
                    _do_resume("APPROVE")
            with h_col2:
                if st.button("❌ DENY", type="secondary", use_container_width=True):
                    _do_resume("DENY")

# ── Bottom outcome strip ───────────────────────────────────────────────────────
if st.session_state.processing_state in ("done", "awaiting_human"):
    st.divider()
    out_col1, out_col2, out_col3, out_col4 = st.columns(4)

    with out_col1:
        fs = st.session_state.final_status
        label = fs if fs != "PENDING" or st.session_state.processing_state != "awaiting_human" else "AWAITING REVIEW"
        st.metric("Decision", label)

    with out_col2:
        secs = st.session_state.processing_seconds
        st.metric("Processing Time", f"{secs}s" if secs else "—")

    with out_col3:
        phi_count = len(st.session_state.token_map)
        st.metric("PHI Tokens Masked", phi_count)

    with out_col4:
        warnings = st.session_state.guardrail_warnings
        if warnings:
            st.metric("Guardrail Alerts", len(warnings))
        else:
            st.metric("PHI in AI Output", "None detected")

    if st.session_state.guardrail_warnings:
        for w in st.session_state.guardrail_warnings:
            st.warning(w)


# ── Pipeline execution ────────────────────────────────────────────────────────

def _do_resume(human_decision: str):
    """Resume the paused pipeline after human clicks Approve or Deny."""
    from pipeline.orchestrator import resume_pipeline
    from guardrails.guardrails_check import check_output

    st.session_state.processing_state = "running"
    human_review_placeholder.empty()

    payment_box = st.empty()
    payment_text = ""

    for event_type, data in resume_pipeline(st.session_state.thread_id, human_decision):
        if event_type == "node":
            node = data.get("node", "")
            state = data.get("state", {})
            if node == "payment" and "payment_output" in state:
                payment_text = state["payment_output"]
                _render_agent_box(payment_placeholder, "Agent 3 — Payment Calculation", payment_text)
        elif event_type == "done":
            st.session_state.final_status = data.get("final_status", "PENDING")
            st.session_state.processing_seconds = data.get("processing_seconds", 0.0)
            full_state = data.get("state", {})
            if "payment_output" in full_state:
                st.session_state.payment_output = full_state["payment_output"]

    # Guardrail check on payment output
    if st.session_state.payment_output:
        safe, warning = check_output(st.session_state.payment_output, st.session_state.token_map)
        if not safe:
            st.session_state.guardrail_warnings.append(warning)

    st.session_state.processing_state = "done"
    st.rerun()


if process_clicked:
    from pipeline.orchestrator import run_pipeline, make_thread_id
    from guardrails.guardrails_check import check_output

    # Reset state for new run
    thread_id = make_thread_id()
    st.session_state.thread_id = thread_id
    st.session_state.processing_state = "running"
    st.session_state.parsed_claim = None
    st.session_state.masked_claim = None
    st.session_state.token_map = {}
    st.session_state.retrieved_rules = ""
    st.session_state.intake_output = ""
    st.session_state.decision_output = ""
    st.session_state.decision = ""
    st.session_state.payment_output = ""
    st.session_state.final_status = "PENDING"
    st.session_state.processing_seconds = 0.0
    st.session_state.guardrail_warnings = []

    intake_placeholder.empty()
    decision_placeholder.empty()
    human_review_placeholder.empty()
    payment_placeholder.empty()

    edi_text = raw_edi
    intake_text = ""
    decision_text = ""

    for event_type, data in run_pipeline(edi_text, thread_id):

        if event_type == "parsed":
            st.session_state.parsed_claim = data["parsed_claim"]
            st.session_state.masked_claim = data["masked_claim"]
            st.session_state.token_map = data["token_map"]

        elif event_type == "rules":
            st.session_state.retrieved_rules = data["retrieved_rules"]

        elif event_type == "node":
            node = data.get("node", "")
            node_state = data.get("state", {})

            if node == "intake" and "intake_output" in node_state:
                intake_text = node_state["intake_output"]
                st.session_state.intake_output = intake_text
                _render_agent_box(
                    intake_placeholder, "Agent 1 — Intake Review", intake_text
                )
                # Guardrail check
                safe, warning = check_output(intake_text, st.session_state.token_map)
                if not safe:
                    st.session_state.guardrail_warnings.append(warning)

            elif node == "decision" and "decision_output" in node_state:
                decision_text = node_state["decision_output"]
                st.session_state.decision_output = decision_text
                st.session_state.decision = node_state.get("decision", "")
                _render_agent_box(
                    decision_placeholder, "Agent 2 — Decision", decision_text
                )
                safe, warning = check_output(decision_text, st.session_state.token_map)
                if not safe:
                    st.session_state.guardrail_warnings.append(warning)

            elif node == "payment" and "payment_output" in node_state:
                pay_text = node_state["payment_output"]
                st.session_state.payment_output = pay_text
                _render_agent_box(
                    payment_placeholder, "Agent 3 — Payment Calculation", pay_text
                )
                safe, warning = check_output(pay_text, st.session_state.token_map)
                if not safe:
                    st.session_state.guardrail_warnings.append(warning)

        elif event_type == "interrupted":
            st.session_state.processing_state = "awaiting_human"
            st.session_state.decision_output = data.get("decision_output", decision_text)
            st.rerun()

        elif event_type == "done":
            st.session_state.final_status = data.get("final_status", "PENDING")
            st.session_state.processing_seconds = data.get("processing_seconds", 0.0)
            full_state = data.get("state", {})
            if "payment_output" in full_state and not st.session_state.payment_output:
                st.session_state.payment_output = full_state["payment_output"]

    if st.session_state.processing_state == "running":
        st.session_state.processing_state = "done"
    st.rerun()
