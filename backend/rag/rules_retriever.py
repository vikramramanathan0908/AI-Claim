import os
from pathlib import Path

from openai import OpenAI
from supabase import create_client, Client

_RULES_DIR = Path(__file__).parent.parent / "data" / "rules"
_EMBED_MODEL = "text-embedding-3-small"
_TABLE = "rule_chunks"

_retriever_instance: "RulesRetriever | None" = None


def get_retriever() -> "RulesRetriever":
    """Return the singleton RulesRetriever, connecting to Supabase on first call."""
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = RulesRetriever()
    return _retriever_instance


class RulesRetriever:
    def __init__(self):
        self._openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self._supabase: Client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
        self._ensure_index()

    def _ensure_index(self):
        """Load rule files into Supabase only if the table is empty."""
        result = self._supabase.table(_TABLE).select("id", count="exact").limit(1).execute()
        if result.count and result.count > 0:
            return  # already populated, skip embedding

        for path in sorted(_RULES_DIR.glob("*.txt")):
            text = path.read_text(encoding="utf-8").strip()
            for chunk in self._split_chunks(text):
                embedding = self._embed(chunk)
                self._supabase.table(_TABLE).insert({
                    "file_name": path.name,
                    "content": chunk,
                    "embedding": self._vec_str(embedding),
                }).execute()

    def _split_chunks(self, text: str, chunk_size: int = 500) -> list[str]:
        """Split text into chunks by paragraph, respecting chunk_size."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks: list[str] = []
        current = ""
        for para in paragraphs:
            if len(current) + len(para) < chunk_size:
                current += ("\n\n" if current else "") + para
            else:
                if current:
                    chunks.append(current)
                current = para
        if current:
            chunks.append(current)
        return chunks or [text]

    def _embed(self, text: str) -> list[float]:
        response = self._openai.embeddings.create(model=_EMBED_MODEL, input=text)
        return response.data[0].embedding

    def _vec_str(self, embedding: list[float]) -> str:
        """Format embedding as pgvector string: '[0.1,0.2,...]'"""
        return "[" + ",".join(str(x) for x in embedding) + "]"

    def get_relevant_rules(self, claim_dict: dict) -> str:
        """
        Build a query from the claim's procedures and diagnoses,
        retrieve the 4 most relevant rule chunks from Supabase,
        and return them as a single concatenated string for agent prompts.
        """
        procedures = [p["code"] for p in claim_dict.get("procedures", [])]
        diagnoses = claim_dict.get("diagnoses", [])
        amount = claim_dict.get("claim", {}).get("total_amount", 0)
        auth = claim_dict.get("prior_auth")

        query_parts = []
        if procedures:
            query_parts.append(f"procedures {' '.join(procedures)}")
        if diagnoses:
            query_parts.append(f"diagnoses {' '.join(diagnoses)}")
        if amount > 25000:
            query_parts.append("high dollar amount human review threshold")
        if not auth:
            query_parts.append("prior authorization missing required")

        query = " ".join(query_parts) if query_parts else "adjudication rules benefit coverage"

        query_embedding = self._embed(query)

        result = self._supabase.rpc("match_rule_chunks", {
            "query_embedding": self._vec_str(query_embedding),
            "match_count": 4,
        }).execute()

        chunks: list[str] = []
        seen_files: set[str] = set()
        for row in result.data:
            file_name = row["file_name"]
            text = row["content"]
            if file_name not in seen_files:
                chunks.append(f"[{file_name}]\n{text}")
                seen_files.add(file_name)
            else:
                chunks.append(text)

        return "\n\n---\n\n".join(chunks)
