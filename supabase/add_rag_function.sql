-- ================================================================
-- PRECI — Função RPC para Busca Vetorial RAG no Supabase (pgvector)
-- Instrução: Cole e execute este script no SQL Editor do Supabase.
-- ================================================================

create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.2,
  match_count int default 5,
  p_company_id uuid default null
) returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float as similarity
  from public.document_chunks dc
  where (p_company_id is null or dc.company_id = p_company_id)
    and (1 - (dc.embedding <=> query_embedding)) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
