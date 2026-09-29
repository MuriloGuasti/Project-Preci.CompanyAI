-- ================================================================
-- PRECI — Agendamento de Agentes (agent_schedules) & Execuções Pausadas
-- ================================================================

-- 1. Tabela de agendamentos recorrentes (cron) por agente
CREATE TABLE IF NOT EXISTS public.agent_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta de alta performance
CREATE INDEX IF NOT EXISTS idx_agent_schedules_next_run
    ON public.agent_schedules (next_run_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_agent_schedules_company
    ON public.agent_schedules (company_id);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_agent
    ON public.agent_schedules (agent_id);

-- RLS para agent_schedules
ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem agendamentos da própria empresa"
    ON public.agent_schedules FOR SELECT
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários criam agendamentos para sua empresa"
    ON public.agent_schedules FOR INSERT
    WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários alteram agendamentos da própria empresa"
    ON public.agent_schedules FOR UPDATE
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários deletam agendamentos da própria empresa"
    ON public.agent_schedules FOR DELETE
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Atualizar restrição de status em agent_executions para permitir waiting_approval e rejected
ALTER TABLE public.agent_executions
    DROP CONSTRAINT IF EXISTS agent_executions_status_check;

ALTER TABLE public.agent_executions
    ADD CONSTRAINT agent_executions_status_check
    CHECK (status IN ('running', 'success', 'error', 'waiting_approval', 'rejected'));

-- Colunas para suporte a aprovação humana e hierarquia de sub-agentes
ALTER TABLE public.agent_executions
    ADD COLUMN IF NOT EXISTS state JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS parent_execution_id UUID REFERENCES public.agent_executions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_agent_executions_parent
    ON public.agent_executions (parent_execution_id);
