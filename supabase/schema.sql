-- ================================================================
-- PRECI — Schema Multi-tenant (Supabase / Postgres)
-- Rodar no SQL Editor do projeto Supabase (uma única vez).
-- Pré-requisito: habilitar a extensão "vector" (Database > Extensions).
-- ================================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ================================
-- EMPRESAS (TENANTS)
-- ================================
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ================================
-- PERFIS (estende auth.users do Supabase)
-- ================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  theme_preference text default 'dark' check (theme_preference in ('dark','light')),
  created_at timestamptz default now()
);

create index idx_profiles_company on public.profiles(company_id);

-- ================================
-- CONVERSAS (privadas por usuário)
-- ================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text default 'Nova conversa',
  ai_model text not null default 'gemini-3.6-flash',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_conversations_company on public.conversations(company_id);
create index idx_conversations_user on public.conversations(user_id);

-- ================================
-- MENSAGENS
-- ================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  attachments jsonb default '[]'::jsonb,
  tokens_used int default 0,
  created_at timestamptz default now()
);

create index idx_messages_conversation on public.messages(conversation_id);

-- ================================
-- AGENTES (Workflows estilo N8N) — privados por criador
-- ================================
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_agents_company on public.agents(company_id);
create index idx_agents_creator on public.agents(created_by);

create table public.agent_nodes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  type text not null, -- 'trigger', 'ai_model', 'condition', 'action', 'http_request', etc.
  label text,
  position jsonb not null default '{"x":0,"y":0}'::jsonb,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table public.agent_edges (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  source_node_id uuid not null references public.agent_nodes(id) on delete cascade,
  target_node_id uuid not null references public.agent_nodes(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'running' check (status in ('running','success','error')),
  logs jsonb default '[]'::jsonb,
  started_at timestamptz default now(),
  finished_at timestamptz
);

-- ================================
-- DOCUMENTOS (RAG) — privados por criador
-- ================================
create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_folder_id uuid references public.document_folders(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  folder_id uuid references public.document_folders(id) on delete set null,
  name text not null,
  file_path text not null, -- caminho no Supabase Storage (prefixado por company_id)
  file_type text,
  file_size bigint,
  status text not null default 'processing' check (status in ('processing','ready','error')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_documents_creator on public.documents(created_by);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('portuguese', content)) stored,
  embedding vector(1536), -- dimensão do text-embedding-3-small
  chunk_index int not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_document_chunks_embedding on public.document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index idx_document_chunks_tsv on public.document_chunks
  using gin (content_tsv);

-- ================================
-- CATÁLOGO DE MODELOS DE IA (público / gerenciado pela plataforma)
-- ================================
create table public.ai_models (
  id text primary key, -- ex: 'claude-sonnet-4-6'
  provider text not null, -- 'anthropic', 'openai', 'google'
  display_name text not null,
  enabled boolean default true,
  max_tokens int default 4096,
  created_at timestamptz default now()
);

insert into public.ai_models (id, provider, display_name) values
  ('gemini-3.6-flash', 'google', 'Google Gemini');

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agents enable row level security;
alter table public.agent_nodes enable row level security;
alter table public.agent_edges enable row level security;
alter table public.agent_executions enable row level security;
alter table public.document_folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ai_models enable row level security;

-- Função utilitária: retorna o company_id do usuário logado
create or replace function public.current_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- PROFILES: usuário vê colegas da própria empresa, mas só edita o próprio perfil
create policy "profiles_select_same_company"
  on public.profiles for select
  using (company_id = public.current_company_id());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- CONVERSAS: privado por usuário, dentro da própria empresa
create policy "conversations_isolation"
  on public.conversations for all
  using (company_id = public.current_company_id() and user_id = auth.uid())
  with check (company_id = public.current_company_id() and user_id = auth.uid());

-- MENSAGENS: seguem a regra da conversa "pai"
create policy "messages_isolation"
  on public.messages for all
  using (
    company_id = public.current_company_id()
    and conversation_id in (select id from public.conversations where user_id = auth.uid())
  )
  with check (
    company_id = public.current_company_id()
    and conversation_id in (select id from public.conversations where user_id = auth.uid())
  );

-- AGENTES: privado por quem criou, dentro da própria empresa
create policy "agents_isolation"
  on public.agents for all
  using (company_id = public.current_company_id() and created_by = auth.uid())
  with check (company_id = public.current_company_id() and created_by = auth.uid());

-- NODES / EDGES / EXECUTIONS: seguem a regra do agente "pai"
create policy "agent_nodes_isolation"
  on public.agent_nodes for all
  using (agent_id in (select id from public.agents where created_by = auth.uid()));

create policy "agent_edges_isolation"
  on public.agent_edges for all
  using (agent_id in (select id from public.agents where created_by = auth.uid()));

create policy "agent_executions_isolation"
  on public.agent_executions for all
  using (agent_id in (select id from public.agents where created_by = auth.uid()));

-- DOCUMENTOS: privado por quem criou, dentro da própria empresa
create policy "documents_isolation"
  on public.documents for all
  using (company_id = public.current_company_id() and created_by = auth.uid())
  with check (company_id = public.current_company_id() and created_by = auth.uid());

create policy "document_folders_isolation"
  on public.document_folders for all
  using (company_id = public.current_company_id() and created_by = auth.uid())
  with check (company_id = public.current_company_id() and created_by = auth.uid());

-- DOCUMENT_CHUNKS: segue a regra do documento "pai"
create policy "document_chunks_isolation"
  on public.document_chunks for all
  using (document_id in (select id from public.documents where created_by = auth.uid()));

-- AI_MODELS: catálogo, leitura liberada para qualquer usuário autenticado
create policy "ai_models_select_all"
  on public.ai_models for select
  using (auth.role() = 'authenticated');
