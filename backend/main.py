import json
import os
import sys

# Ensure backend dir is on path so intra-package imports resolve
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
_backend_dir = os.path.dirname(__file__)
for _env_name in (".env", ".ENV"):
    load_dotenv(os.path.join(_backend_dir, _env_name), override=False)
load_dotenv(os.path.join(_backend_dir, "..", ".env"), override=True)
api_key = os.getenv("OPENAI_API_KEY")
os.environ["OPENAI_API_KEY"] = api_key

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline.orchestrator import run_pipeline, resume_pipeline, make_thread_id

app = FastAPI(title="AI Claims Processing API")

_extra_origin = os.getenv("FRONTEND_ORIGIN", "")
_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
if _extra_origin:
    _origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    edi_text: str


class ResumeRequest(BaseModel):
    thread_id: str
    human_decision: str  # "APPROVE" or "DENY"


def _stream_events(generator):
    for event_type, data in generator:
        yield f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/api/process")
async def process_claim(req: ProcessRequest):
    thread_id = make_thread_id()

    def generate():
        # Send thread_id first so client can use it for resume
        yield f"data: {json.dumps({'type': 'thread_id', 'data': {'thread_id': thread_id}})}\n\n"
        for event_type, data in run_pipeline(req.edi_text, thread_id):
            yield f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/resume")
async def resume_claim(req: ResumeRequest):
    def generate():
        for event_type, data in resume_pipeline(req.thread_id, req.human_decision):
            yield f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
