import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.db.supabase_client import db
from app.models.schemas import (
    AgentCreate,
    AgentResponse,
    AgentNode,
    AgentEdge,
    AgentExecutionRequest,
    AgentExecutionResponse,
    AgentScheduleCreate,
    AgentScheduleResponse,
    ExecutionApprovalRequest,
    ExecutionRejectRequest,
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
)
from app.services.agents.executor import (
    execute_agent_workflow,
    dispatch_async_workflow_execution,
    resume_workflow_execution,
    detect_inter_agent_cycle,
)
from app.services.agents.generator import generate_workflow
from app.workers.scheduler_tick import validate_cron_expression

router = APIRouter(prefix="/agents", tags=["agents"])


def validate_agent_topology(agent_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], company_id: str):
    """
    Validates agent topology guardrails:
      1. Rejects nested LoopNodes.
      2. Rejects inter-agent dependency cycles via SubAgentNodes.
    """
    # Guardrail 1: Nested Loops
    loop_nodes = [n["id"] for n in nodes if n.get("type") == "loop"]
    if len(loop_nodes) > 1:
        for l_id in loop_nodes:
            start_nodes = [
                e.get("target_node_id") for e in edges
                if e.get("source_node_id") == l_id and (e.get("source_handle") == "loop_body" or not e.get("source_handle"))
            ]
            visited = set()
            queue = [n for n in start_nodes if n]
            while queue:
                curr = queue.pop(0)
                if curr in visited or curr == l_id:
                    continue
                visited.add(curr)
                if curr in loop_nodes and curr != l_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Loops aninhados não são permitidos nesta versão (nó '{curr}' dentro do corpo do loop '{l_id}').",
                    )
                for e in edges:
                    if e.get("source_node_id") == curr:
                        tgt = e.get("target_node_id")
                        if tgt == l_id and e.get("edge_type") == "loop_back":
                            continue
                        if tgt and tgt not in visited:
                            queue.append(tgt)

    # Guardrail 2: Inter-agent Cycles
    cycle = detect_inter_agent_cycle(agent_id, nodes, company_id)
    if cycle:
        cycle_str = " -> ".join(cycle)
        raise HTTPException(
            status_code=400,
            detail=f"Ciclo de dependência circular detectado entre agentes: {cycle_str}. Ação bloqueada.",
        )


@router.get("", response_model=List[AgentResponse])
async def list_agents(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    company_id = current_user["company_id"]
    agents = [
        AgentResponse(
            id=a["id"],
            name=a["name"],
            description=a.get("description"),
            status=a.get("status", "draft"),
            nodes=[AgentNode(**n) for n in a.get("nodes", [])],
            edges=[AgentEdge(**e) for e in a.get("edges", [])],
            created_at=a["created_at"],
            updated_at=a["updated_at"],
        )
        for a in db.agents.values()
        if a.get("created_by") == user_id and a.get("company_id") == company_id
    ]
    agents.sort(key=lambda x: x.updated_at, reverse=True)
    return agents


@router.post("", response_model=AgentResponse)
async def create_agent(
    payload: AgentCreate,
    current_user: dict = Depends(get_current_user),
):
    agent_id = f"agent-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    # Default initial nodes if empty
    initial_nodes = payload.nodes or [
        AgentNode(
            id="node-trigger-1",
            type="trigger",
            label="Início do Fluxo",
            position={"x": 100, "y": 150},
            config={"trigger_type": "manual"},
        ),
        AgentNode(
            id="node-ai-1",
            type="ai_model",
            label="Google Gemini",
            position={"x": 380, "y": 150},
            config={"model": "gemini-3.6-flash"},
        ),
    ]
    initial_edges = payload.edges or [
        AgentEdge(
            id="edge-init-1",
            source_node_id="node-trigger-1",
            target_node_id="node-ai-1",
        )
    ]

    serialized_nodes = [n.model_dump() for n in initial_nodes]
    serialized_edges = [e.model_dump() for e in initial_edges]
    validate_agent_topology(agent_id, serialized_nodes, serialized_edges, current_user["company_id"])

    new_agent = {
        "id": agent_id,
        "company_id": current_user["company_id"],
        "created_by": current_user["id"],
        "name": payload.name,
        "description": payload.description or "",
        "status": "draft",
        "nodes": serialized_nodes,
        "edges": serialized_edges,
        "created_at": now,
        "updated_at": now,
    }
    db.agents[agent_id] = new_agent

    return AgentResponse(
        id=agent_id,
        name=new_agent["name"],
        description=new_agent["description"],
        status=new_agent["status"],
        nodes=initial_nodes,
        edges=initial_edges,
        created_at=now,
        updated_at=now,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    a = db.agents[agent_id]
    if a.get("created_by") != current_user["id"] or a.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")
    return AgentResponse(
        id=a["id"],
        name=a["name"],
        description=a.get("description"),
        status=a.get("status", "draft"),
        nodes=[AgentNode(**n) for n in a.get("nodes", [])],
        edges=[AgentEdge(**e) for e in a.get("edges", [])],
        created_at=a["created_at"],
        updated_at=a["updated_at"],
    )


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    payload: AgentCreate,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    a = db.agents[agent_id]
    if a.get("created_by") != current_user["id"] or a.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")

    next_nodes = [n.model_dump() for n in payload.nodes] if payload.nodes is not None else a.get("nodes", [])
    next_edges = [e.model_dump() for e in payload.edges] if payload.edges is not None else a.get("edges", [])
    validate_agent_topology(agent_id, next_nodes, next_edges, current_user["company_id"])

    a["name"] = payload.name
    a["description"] = payload.description or ""
    a["nodes"] = next_nodes
    a["edges"] = next_edges
    a["updated_at"] = datetime.now(timezone.utc)

    return AgentResponse(
        id=a["id"],
        name=a["name"],
        description=a.get("description"),
        status=a.get("status", "draft"),
        nodes=[AgentNode(**n) for n in a.get("nodes", [])],
        edges=[AgentEdge(**e) for e in a.get("edges", [])],
        created_at=a["created_at"],
        updated_at=a["updated_at"],
    )


@router.patch("/{agent_id}", response_model=AgentResponse)
async def patch_agent(
    agent_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    a = db.agents[agent_id]
    if a.get("created_by") != current_user["id"] or a.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")
    if "name" in payload:
        a["name"] = payload["name"]
    if "description" in payload:
        a["description"] = payload["description"]
    if "nodes" in payload or "edges" in payload:
        next_nodes = payload.get("nodes", a.get("nodes", []))
        next_edges = payload.get("edges", a.get("edges", []))
        validate_agent_topology(agent_id, next_nodes, next_edges, current_user["company_id"])
        a["nodes"] = next_nodes
        a["edges"] = next_edges
    a["updated_at"] = datetime.now(timezone.utc)
    return AgentResponse(
        id=a["id"],
        name=a["name"],
        description=a.get("description"),
        status=a.get("status", "draft"),
        nodes=[AgentNode(**n) for n in a.get("nodes", [])],
        edges=[AgentEdge(**e) for e in a.get("edges", [])],
        created_at=a["created_at"],
        updated_at=a["updated_at"],
    )


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    if agent_id in db.agents:
        a = db.agents[agent_id]
        if a.get("created_by") != current_user["id"] or a.get("company_id") != current_user["company_id"]:
            raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")
        del db.agents[agent_id]
    return {"ok": True}


@router.post("/{agent_id}/execute", response_model=AgentExecutionResponse)
async def run_agent(
    agent_id: str,
    payload: Optional[AgentExecutionRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent = db.agents[agent_id]
    if agent.get("created_by") != current_user["id"] or agent.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")

    input_vars = payload.input_variables if payload else None
    exec_result = await execute_agent_workflow(agent, input_variables=input_vars, current_user=current_user)

    return AgentExecutionResponse(
        id=f"exec-{uuid.uuid4().hex[:8]}",
        agent_id=agent_id,
        status=exec_result["status"],
        logs=exec_result["logs"],
        node_results=exec_result.get("node_results", {}),
        final_output=exec_result.get("final_output"),
        started_at=exec_result["started_at"],
        finished_at=exec_result["finished_at"],
    )


@router.post("/{agent_id}/execute-async")
async def run_agent_async(
    agent_id: str,
    payload: Optional[AgentExecutionRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent = db.agents[agent_id]
    if agent.get("created_by") != current_user["id"] or agent.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")

    input_vars = payload.input_variables if payload else None
    return await dispatch_async_workflow_execution(agent, input_variables=input_vars, current_user=current_user)


@router.post("/{agent_id}/generate-workflow", response_model=GenerateWorkflowResponse)
async def generate_workflow_for_agent(
    agent_id: str,
    payload: GenerateWorkflowRequest,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent = db.agents[agent_id]
    if agent.get("created_by") != current_user["id"] or agent.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou sem permissão")

    result = await generate_workflow(
        prompt=payload.prompt,
        mode=payload.mode or "replace",
        current_agent=agent,
    )

    return GenerateWorkflowResponse(
        name=result.get("name", "Workflow Gerado"),
        description=result.get("description", ""),
        explanation=result.get("explanation", ""),
        nodes=[AgentNode(**n) for n in result.get("nodes", [])],
        edges=[AgentEdge(**e) for e in result.get("edges", [])],
    )


@router.post("/generate-workflow", response_model=GenerateWorkflowResponse)
async def generate_general_workflow(
    payload: GenerateWorkflowRequest,
    current_user: dict = Depends(get_current_user),
):
    result = await generate_workflow(
        prompt=payload.prompt,
        mode=payload.mode or "replace",
    )

    return GenerateWorkflowResponse(
        name=result.get("name", "Workflow Gerado"),
        description=result.get("description", ""),
        explanation=result.get("explanation", ""),
        nodes=[AgentNode(**n) for n in result.get("nodes", [])],
        edges=[AgentEdge(**e) for e in result.get("edges", [])],
    )


# --- Schedules ---
@router.post("/{agent_id}/schedules", response_model=AgentScheduleResponse)
async def create_agent_schedule(
    agent_id: str,
    payload: AgentScheduleCreate,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent = db.agents[agent_id]
    if agent.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado para este agente")

    is_valid, err_msg, next_run = validate_cron_expression(
        payload.cron_expression,
        payload.timezone or "America/Sao_Paulo",
    )
    if not is_valid or not next_run:
        raise HTTPException(status_code=400, detail=err_msg or "Expressão cron inválida")

    sched_id = f"sched-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    sched_record = {
        "id": sched_id,
        "agent_id": agent_id,
        "company_id": current_user["company_id"],
        "cron_expression": payload.cron_expression.strip(),
        "timezone": payload.timezone or "America/Sao_Paulo",
        "is_active": payload.is_active if payload.is_active is not None else True,
        "last_run_at": None,
        "next_run_at": next_run,
        "created_by": current_user["id"],
        "created_at": now,
    }
    db.agent_schedules[sched_id] = sched_record
    return AgentScheduleResponse(**sched_record)


@router.get("/{agent_id}/schedules", response_model=List[AgentScheduleResponse])
async def list_agent_schedules(
    agent_id: str,
    current_user: dict = Depends(get_current_user),
):
    if agent_id not in db.agents:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent = db.agents[agent_id]
    if agent.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado para este agente")

    schedules = [
        AgentScheduleResponse(**s)
        for s in db.agent_schedules.values()
        if s.get("agent_id") == agent_id and s.get("company_id") == current_user["company_id"]
    ]
    schedules.sort(key=lambda x: x.created_at, reverse=True)
    return schedules


@router.delete("/{agent_id}/schedules/{schedule_id}")
async def delete_agent_schedule(
    agent_id: str,
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
):
    if schedule_id not in db.agent_schedules:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    sched = db.agent_schedules[schedule_id]
    if sched.get("agent_id") != agent_id or sched.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=403, detail="Sem permissão para remover este agendamento")

    del db.agent_schedules[schedule_id]
    return {"ok": True}


@router.patch("/{agent_id}/schedules/{schedule_id}", response_model=AgentScheduleResponse)
async def update_agent_schedule(
    agent_id: str,
    schedule_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    if schedule_id not in db.agent_schedules:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    sched = db.agent_schedules[schedule_id]
    if sched.get("agent_id") != agent_id or sched.get("company_id") != current_user["company_id"]:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar este agendamento")

    if "cron_expression" in payload:
        is_valid, err_msg, next_run = validate_cron_expression(
            payload["cron_expression"],
            sched.get("timezone", "America/Sao_Paulo"),
        )
        if not is_valid or not next_run:
            raise HTTPException(status_code=400, detail=err_msg or "Expressão cron inválida")
        sched["cron_expression"] = payload["cron_expression"].strip()
        sched["next_run_at"] = next_run

    if "is_active" in payload:
        sched["is_active"] = bool(payload["is_active"])

    return AgentScheduleResponse(**sched)



