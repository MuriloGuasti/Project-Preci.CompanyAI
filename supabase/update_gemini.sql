-- ================================================================
-- PRECI — Atualização para Google Gemini e Embeddings 2
-- Instrução: Cole e execute este script no SQL Editor do Supabase.
-- ================================================================

-- 1. Atualizar o modelo padrão na tabela de conversas para 'gemini-3.6-flash'
ALTER TABLE public.conversations 
  ALTER COLUMN ai_model SET DEFAULT 'gemini-3.6-flash';

-- 2. Atualizar conversas existentes que usavam modelos legados (Claude ou GPT)
UPDATE public.conversations 
  SET ai_model = 'gemini-3.6-flash' 
  WHERE ai_model IS NULL OR ai_model != 'gemini-3.6-flash';

-- 3. Limpar modelos legados do catálogo de IA
DELETE FROM public.ai_models 
  WHERE id IN ('claude-sonnet-4-6', 'gpt-4o');

-- 4. Inserir ou atualizar o Google Gemini como modelo ativo oficial
INSERT INTO public.ai_models (id, provider, display_name, enabled, max_tokens)
VALUES ('gemini-3.6-flash', 'google', 'Google Gemini', true, 8192)
ON CONFLICT (id) DO UPDATE 
SET 
  provider = EXCLUDED.provider,
  display_name = EXCLUDED.display_name,
  enabled = true,
  max_tokens = 8192;

-- 5. Consulta para conferir se o catálogo foi atualizado com sucesso
SELECT * FROM public.ai_models;
