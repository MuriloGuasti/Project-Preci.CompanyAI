from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.api.deps import get_current_user
from app.db.supabase_client import db
from app.models.schemas import (
    AgentExecutionResponse,
    ExecutionApprovalRequest,
    ExecutionRejectRequest,
)
from app.services.agents.executor import resume_workflow_execution

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("/{execution_id}", response_model=AgentExecutionResponse)
async def get_execution(execution_id: str, current_user: dict = Depends(get_current_user)):
    if execution_id not in db.agent_executions:
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    exec_data = db.agent_executions[execution_id]
    if exec_data.get("company_id") and exec_data.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado à execução de outra empresa")

    return AgentExecutionResponse(
        id=exec_data["id"],
        agent_id=exec_data["agent_id"],
        status=exec_data["status"],
        logs=exec_data.get("logs", []),
        node_results=exec_data.get("node_results", {}),
        final_output=exec_data.get("final_output"),
        started_at=exec_data["started_at"],
        finished_at=exec_data.get("finished_at"),
        total_duration_ms=exec_data.get("total_duration_ms"),
        parent_execution_id=exec_data.get("parent_execution_id"),
        approval_info=exec_data.get("approval_info"),
    )


@router.post("/{execution_id}/approve", response_model=AgentExecutionResponse)
async def approve_execution(
    execution_id: str,
    payload: Optional[ExecutionApprovalRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    # RBAC: Only admin or owner can approve/reject
    if current_user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Apenas administradores podem aprovar execuções de fluxo.")

    try:
        note = payload.note if payload else None
        resumed = await resume_workflow_execution(
            execution_id=execution_id,
            action="approve",
            reason_or_note=note,
            current_user=current_user,
        )
        return AgentExecutionResponse(
            id=resumed["id"],
            agent_id=resumed["agent_id"],
            status=resumed["status"],
            logs=resumed.get("logs", []),
            node_results=resumed.get("node_results", {}),
            final_output=resumed.get("final_output"),
            started_at=resumed["started_at"],
            finished_at=resumed.get("finished_at"),
            total_duration_ms=resumed.get("total_duration_ms"),
            parent_execution_id=resumed.get("parent_execution_id"),
            approval_info=resumed.get("approval_info"),
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao aprovar execução: {str(exc)}")


@router.post("/{execution_id}/reject", response_model=AgentExecutionResponse)
async def reject_execution(
    execution_id: str,
    payload: Optional[ExecutionRejectRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    # RBAC: Only admin or owner can approve/reject
    if current_user.get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Apenas administradores podem rejeitar execuções de fluxo.")

    try:
        reason = payload.reason if payload else "Rejeitado pelo operador"
        rejected = await resume_workflow_execution(
            execution_id=execution_id,
            action="reject",
            reason_or_note=reason,
            current_user=current_user,
        )
        return AgentExecutionResponse(
            id=rejected["id"],
            agent_id=rejected["agent_id"],
            status=rejected["status"],
            logs=rejected.get("logs", []),
            node_results=rejected.get("node_results", {}),
            final_output=rejected.get("final_output"),
            started_at=rejected["started_at"],
            finished_at=rejected.get("finished_at"),
            total_duration_ms=rejected.get("total_duration_ms"),
            parent_execution_id=rejected.get("parent_execution_id"),
            approval_info=rejected.get("approval_info"),
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao rejeitar execução: {str(exc)}")
