-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store rule chunks and their embeddings
CREATE TABLE IF NOT EXISTS rule_chunks (
  id        SERIAL PRIMARY KEY,
  file_name TEXT    NOT NULL,
  content   TEXT    NOT NULL,
  embedding VECTOR(1536)
);

-- Function for similarity search (used by rules_retriever.py)
CREATE OR REPLACE FUNCTION match_rule_chunks(
  query_embedding VECTOR(1536),
  match_count     INT DEFAULT 4
)
RETURNS TABLE (
  id        INT,
  file_name TEXT,
  content   TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    file_name,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM rule_chunks
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
