import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from croniter import croniter
from app.db.supabase_client import db
from app.services.agents.executor import dispatch_async_workflow_execution

logger = logging.getLogger("preci.scheduler")


def validate_cron_expression(cron_expr: str, tz_name: str = "America/Sao_Paulo") -> Tuple[bool, Optional[str], Optional[datetime]]:
    """
    Validates a cron expression using croniter.
    Enforces a minimum interval guardrail (at least 5 minutes) to prevent quota exhaustion.
    Returns (is_valid, error_message, next_run_datetime).
    """
    cleaned = cron_expr.strip()
    if not cleaned:
        return False, "A expressão cron não pode estar vazia.", None

    try:
        now = datetime.now(timezone.utc)
        itr = croniter(cleaned, now)
        first_run = itr.get_next(datetime)
        second_run = itr.get_next(datetime)

        # Minimum frequency guardrail: at least 300 seconds (5 minutes) between iterations
        diff_seconds = (second_run - first_run).total_seconds()
        if diff_seconds < 290:  # Allow small margin around 5 min
            return False, "Frequência muito alta: o intervalo mínimo permitido entre execuções é de 5 minutos.", None

        return True, None, first_run
    except Exception as exc:
        return False, f"Expressão cron inválida: {str(exc)}", None


async def get_due_schedules(now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """Retrieves all active schedules whose next_run_at is due."""
    current_time = now or datetime.now(timezone.utc)
    due: List[Dict[str, Any]] = []

    for schedule_id, sched in list(db.agent_schedules.items()):
        if not sched.get("is_active", True):
            continue
        next_run = sched.get("next_run_at")
        if isinstance(next_run, str):
            try:
                next_run = datetime.fromisoformat(next_run)
            except Exception:
                continue
        if next_run and next_run <= current_time:
            due.append(sched)

    return due


async def scheduler_tick(ctx: Optional[Dict[str, Any]] = None) -> int:
    """
    Single cron job tick registered statically in ARQ WorkerSettings (or in-memory fallback).
    Runs every 60 seconds, scans agent_schedules for due entries, and dispatches execution.
    """
    now = datetime.now(timezone.utc)
    due_schedules = await get_due_schedules(now)
    dispatched_count = 0

    for sched in due_schedules:
        agent_id = sched.get("agent_id")
        agent = db.agents.get(agent_id)
        if not agent:
            logger.warning(f"Agendamento {sched.get('id')} aponta para agente inexistente {agent_id}.")
            continue

        try:
            logger.info(f"Disparando execução agendada para o agente '{agent.get('name')}' (ID: {agent_id}).")
            await dispatch_async_workflow_execution(
                agent=agent,
                input_variables={"trigger_source": "schedule", "schedule_id": sched.get("id")},
                current_user={"id": sched.get("created_by"), "company_id": sched.get("company_id")},
                trigger_source="schedule",
            )
            dispatched_count += 1

            # Advance next_run_at
            cron_expr = sched.get("cron_expression")
            itr = croniter(cron_expr, now)
            next_run = itr.get_next(datetime)

            sched["last_run_at"] = now
            sched["next_run_at"] = next_run
            logger.info(f"Agendamento {sched.get('id')} atualizado. Próxima execução: {next_run.isoformat()}.")
        except Exception as exc:
            logger.error(f"Erro ao executar agendamento {sched.get('id')}: {exc}")

    return dispatched_count


# In-memory background scheduler fallback for local dev when Redis is offline
_scheduler_task: Optional[asyncio.Task] = None

async def _scheduler_loop(interval_seconds: int = 60):
    logger.info(f"Iniciando Preci in-memory scheduler tick loop (a cada {interval_seconds}s).")
    while True:
        try:
            await scheduler_tick()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Erro no scheduler tick loop: {e}")
        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            break


def start_in_memory_scheduler(interval_seconds: int = 60) -> Optional[asyncio.Task]:
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop(interval_seconds=interval_seconds))
    return _scheduler_task


def stop_in_memory_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        _scheduler_task = None
