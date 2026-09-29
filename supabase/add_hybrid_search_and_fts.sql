-- ================================================================
-- PRECI — Hybrid Search & Full-Text Search Migration (PostgreSQL / Supabase)
-- Instrução: Cole e execute este script no SQL Editor do Supabase.
-- ================================================================

-- 1. Adiciona coluna tsvector gerada automaticamente com dicionário em português
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED;

-- 2. Cria índice GIN para busca full-text ultra-rápida
CREATE INDEX IF NOT EXISTS idx_document_chunks_tsv
  ON public.document_chunks USING GIN (content_tsv);

-- 3. Função RPC para Full-Text Search nativa no Supabase
CREATE OR REPLACE FUNCTION match_document_chunks_fts (
  query_text text,
  match_count int DEFAULT 12,
  p_company_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  rank float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    ts_rank(dc.content_tsv, plainto_tsquery('portuguese', query_text))::float AS rank
  FROM public.document_chunks dc
  WHERE (p_company_id IS NULL OR dc.company_id = p_company_id)
    AND dc.content_tsv @@ plainto_tsquery('portuguese', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
