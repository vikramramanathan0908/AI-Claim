import os
from pathlib import Path

from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, Settings
from llama_index.embeddings.openai import OpenAIEmbedding

_RULES_DIR = Path(__file__).parent.parent / "data" / "rules"

_retriever_instance: "RulesRetriever | None" = None


def get_retriever() -> "RulesRetriever":
    """Return the singleton RulesRetriever, building the index on first call."""
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = RulesRetriever()
    return _retriever_instance


class RulesRetriever:
    def __init__(self):
        Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
        Settings.llm = None  # We handle LLM calls ourselves

        documents = SimpleDirectoryReader(str(_RULES_DIR)).load_data()
        index = VectorStoreIndex.from_documents(documents)
        self._query_engine = index.as_query_engine(
            similarity_top_k=4,
            response_mode="no_text",  # return nodes only, not LLM-generated answer
        )
        self._retriever = index.as_retriever(similarity_top_k=4)

    def get_relevant_rules(self, claim_dict: dict) -> str:
        """
        Build a query from the claim's procedures and diagnoses,
        retrieve the most relevant rule passages, and return them as a
        single concatenated string for inclusion in agent prompts.
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

        nodes = self._retriever.retrieve(query)

        chunks = []
        seen_files = set()
        for node in nodes:
            file_name = node.metadata.get("file_name", "rules")
            text = node.get_content().strip()
            if file_name not in seen_files:
                chunks.append(f"[{file_name}]\n{text}")
                seen_files.add(file_name)
            else:
                chunks.append(text)

        return "\n\n---\n\n".join(chunks)
