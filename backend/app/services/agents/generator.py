import json
import logging
import re
import uuid
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger("preci.workflow_generator")

VALID_NODE_TYPES = {
    "trigger",
    "ai_model",
    "rag",
    "condition",
    "http_request",
    "action",
    "report_generator",
    "email_sender",
}

FALLBACK_TYPE_MAP = {
    "webhook": "trigger",
    "gatilho": "trigger",
    "start": "trigger",
    "manual": "trigger",
    "input": "trigger",
    "llm": "ai_model",
    "gemini": "ai_model",
    "gpt": "ai_model",
    "ia": "ai_model",
    "ai": "ai_model",
    "model": "ai_model",
    "prompt": "ai_model",
    "search": "rag",
    "docs": "rag",
    "document": "rag",
    "knowledge": "rag",
    "vector": "rag",
    "if": "condition",
    "branch": "condition",
    "filter": "condition",
    "decision": "condition",
    "decisao": "condition",
    "report": "report_generator",
    "html": "report_generator",
    "relatorio": "report_generator",
    "doc_generator": "report_generator",
    "email": "email_sender",
    "mail": "email_sender",
    "smtp": "email_sender",
    "send_email": "email_sender",
    "api": "http_request",
    "http": "http_request",
    "fetch": "http_request",
    "webhook_out": "http_request",
    "database": "http_request",
    "db": "http_request",
    "slack": "action",
    "notify": "action",
    "notification": "action",
    "alert": "action",
    "log": "action",
}


def sanitize_node_type(raw_type: str) -> str:
    """Normalizes and maps any arbitrary node type to one of the 8 valid Preci AgentNodeTypes."""
    cleaned = (raw_type or "").strip().lower()
    if cleaned in VALID_NODE_TYPES:
        return cleaned
    # Check fallback map
    for prefix, mapped in FALLBACK_TYPE_MAP.items():
        if prefix in cleaned:
            return mapped
    return "action"  # Default safe fallback


def inject_connected_variables(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyzes sequence of nodes and injects proper n8n interpolation syntax:
    - ReportGeneratorNode: raw_data: "{{ ai_model.output }}" or "{{ rag.context }}"
    - EmailSenderNode: body: "{{ report_generator.output.html }}" or "{{ ai_model.output }}"
                       subject: "Relatório: {{ trigger.pergunta }}"
    - AiModelNode: user_prompt: "{{ trigger.pergunta }}" (and context from RAG if present)
    """
    has_trigger = any(n["type"] == "trigger" for n in nodes)
    has_rag = any(n["type"] == "rag" for n in nodes)
    has_ai = any(n["type"] == "ai_model" for n in nodes)
    has_report = any(n["type"] == "report_generator" for n in nodes)

    for node in nodes:
        ntype = node["type"]
        config = node.setdefault("config", {})

        if ntype == "report_generator":
            if not config.get("raw_data") or config.get("raw_data") == "":
                if has_ai:
                    config["raw_data"] = "{{ ai_model.output }}"
                elif has_rag:
                    config["raw_data"] = "{{ rag.context }}"
                elif has_trigger:
                    config["raw_data"] = "{{ trigger.pergunta }}"
                else:
                    config["raw_data"] = "Dados corporativos processados pelo fluxo."
            if not config.get("style"):
                config["style"] = "executive"
            if not config.get("title"):
                config["title"] = "Relatório Executivo Automatizado"

        elif ntype == "email_sender":
            if not config.get("to") or config.get("to") == "":
                config["to"] = "diretoria@preci.company"
            if not config.get("subject") or config.get("subject") == "":
                config["subject"] = "Relatório: {{ trigger.pergunta }}" if has_trigger else "Notificação de Workflow Preci"
            if not config.get("body") or config.get("body") == "":
                if has_report:
                    config["body"] = "{{ report_generator.output.html }}"
                    config["is_html"] = True
                elif has_ai:
                    config["body"] = "{{ ai_model.output }}"
                    config["is_html"] = False
                else:
                    config["body"] = "Fluxo executado com sucesso."
                    config["is_html"] = False

        elif ntype == "ai_model":
            if not config.get("model"):
                config["model"] = "gemini-3.6-flash"
            if not config.get("system_prompt"):
                if has_rag:
                    config["system_prompt"] = (
                        "Você é o especialista de IA da Preci Company. "
                        "Analise os documentos recuperados: {{ rag.context }} e responda de forma executiva."
                    )
                else:
                    config["system_prompt"] = (
                        "Você é um agente cognitivo de alta performance da Preci Company. "
                        "Processe a solicitação recebida com precisão e clareza corporativa."
                    )
            if not config.get("user_prompt"):
                config["user_prompt"] = "{{ trigger.pergunta }}" if has_trigger else "Analise os dados recebidos no fluxo."

        elif ntype == "condition":
            if not config.get("field"):
                config["field"] = "ai_model.output" if has_ai else "trigger.pergunta"
            if not config.get("operator"):
                config["operator"] = "contains"
            if not config.get("value"):
                config["value"] = "urgente"

        elif ntype == "http_request":
            if not config.get("method"):
                config["method"] = "POST"
            if not config.get("url"):
                config["url"] = "https://api.preci.company/v1/webhook"
            if not config.get("body"):
                config["body"] = json.dumps({"payload": "{{ ai_model.output }}" if has_ai else "{{ trigger.pergunta }}"})

        elif ntype == "action":
            if not config.get("action_type"):
                config["action_type"] = "slack_notification"
            if not config.get("channel"):
                config["channel"] = "#alertas-operacoes"
            if not config.get("message"):
                config["message"] = "Workflow executado. Resultado: {{ ai_model.output }}" if has_ai else "Alerta de automação Preci."

    return nodes


def synthesize_workflow_from_prompt(prompt: str) -> Dict[str, Any]:
    """
    Intelligent deterministic local NLP planner (Zero Token Cost).
    Parses intent from the user's natural language prompt and constructs a fully functional,
    properly connected, horizontally aligned workflow.
    """
    p_lower = prompt.lower()

    # Step 1: Detect Intent & Components
    wants_webhook = any(w in p_lower for w in ["webhook", "externo", "endpoint", "api entrada", "integrar"])
    wants_rag = any(w in p_lower for w in ["rag", "documento", "documentos", "pdf", "base", "conhecimento", "buscar", "pesquisa", "consulta"])
    wants_ai = any(w in p_lower for w in ["ia", "ai", "gemini", "inteligencia", "resposta", "analise", "analisar", "sintese", "resumo", "triagem", "classificar"])
    wants_condition = any(w in p_lower for w in ["condicao", "condicional", "se ", "caso", "decisao", "bifurca", "filtro", "urgente", "regra"])
    wants_report = any(w in p_lower for w in ["relatorio", "report", "html", "executivo", "formatado", "gerar relatorio"])
    wants_email = any(w in p_lower for w in ["email", "e-mail", "disparo", "smtp", "enviar para", "notificar email", "destinatario"])
    wants_http = any(w in p_lower for w in ["http", "requisicao", "rest", "post", "get", "sistema terceiro", "crm", "erp"])
    wants_slack = any(w in p_lower for w in ["slack", "notificacao", "notificar", "alerta", "aviso", "canal"])

    # If prompt is very short or generic, provide a robust corporate default
    if not (wants_rag or wants_ai or wants_condition or wants_report or wants_email or wants_http or wants_slack):
        wants_ai = True
        wants_report = True
        wants_email = True

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # Sequence builder
    # 1. Trigger
    trigger_type = "webhook" if wants_webhook else "manual"
    trigger_label = "Webhook de Entrada" if wants_webhook else "Início Manual"
    trigger_id = f"node-trigger-{uuid.uuid4().hex[:6]}"
    nodes.append({
        "id": trigger_id,
        "type": "trigger",
        "label": trigger_label,
        "position": {"x": 80, "y": 180},
        "config": {
            "trigger_type": trigger_type,
            "webhook_path": f"/webhook/{uuid.uuid4().hex[:8]}" if wants_webhook else "",
            "variables": {"pergunta": "Qual o status do contrato corporativo?"},
        },
    })

    # 2. RAG (if needed)
    if wants_rag:
        rag_id = f"node-rag-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": rag_id,
            "type": "rag",
            "label": "Busca Documental (RAG)",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "query": "{{ trigger.pergunta }}",
                "top_k": 3,
                "similarity_threshold": 0.65,
            },
        })

    # 3. AI Model (if needed or standard)
    if wants_ai or wants_report:
        ai_id = f"node-ai-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": ai_id,
            "type": "ai_model",
            "label": "Google Gemini Flash",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "model": "gemini-3.6-flash",
                "system_prompt": (
                    "Você é o assistente inteligente corporativo da Preci Company. "
                    + ("Consulte o contexto documental: {{ rag.context }} para responder." if wants_rag else "Responda à solicitação com objetividade e alto nível técnico.")
                ),
                "user_prompt": "{{ trigger.pergunta }}",
                "temperature": 0.7,
                "output_format": "text",
            },
        })

    # 4. Condition (if needed)
    condition_id = None
    if wants_condition:
        condition_id = f"node-cond-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": condition_id,
            "type": "condition",
            "label": "Avaliação de Risco / Urgência",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "field": "ai_model.output" if wants_ai else "trigger.pergunta",
                "operator": "contains",
                "value": "urgente",
            },
        })

    # 5. Report Generator (if needed)
    if wants_report:
        report_id = f"node-report-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": report_id,
            "type": "report_generator",
            "label": "Gerador de Relatórios",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "title": "Relatório Executivo Automatizado",
                "style": "executive",
                "raw_data": "{{ ai_model.output }}",
            },
        })

    # 6. Email Sender (if needed)
    if wants_email:
        email_id = f"node-email-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": email_id,
            "type": "email_sender",
            "label": "Disparador de E-mail (SMTP)",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "to": "gestao@preci.company",
                "subject": "Relatório: {{ trigger.pergunta }}",
                "body": "{{ report_generator.output.html }}" if wants_report else "{{ ai_model.output }}",
                "is_html": True if wants_report else False,
            },
        })

    # 7. HTTP Request (if needed)
    if wants_http:
        http_id = f"node-http-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": http_id,
            "type": "http_request",
            "label": "Integração API Externa",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "method": "POST",
                "url": "https://api.preci.company/v1/integracao",
                "body": '{"resultado": "{{ ai_model.output }}"}',
            },
        })

    # 8. Slack / Action (if needed)
    if wants_slack:
        action_id = f"node-action-{uuid.uuid4().hex[:6]}"
        nodes.append({
            "id": action_id,
            "type": "action",
            "label": "Notificação Corporativa",
            "position": {"x": 80 + len(nodes) * 280, "y": 180},
            "config": {
                "action_type": "slack_notification",
                "channel": "#automacoes-preci",
                "message": "Fluxo concluído: {{ trigger.pergunta }} - {{ ai_model.output }}",
            },
        })

    # Helper to resolve default target handle
    def get_target_handle(tgt_type: str) -> str:
        if tgt_type == "ai_model":
            return "prompt"
        elif tgt_type == "rag":
            return "query"
        elif tgt_type == "condition":
            return "value"
        elif tgt_type == "report_generator":
            return "raw_data"
        elif tgt_type == "email_sender":
            return "body"
        elif tgt_type == "action":
            return "message"
        elif tgt_type == "http_request":
            return "body"
        return "input"

    # Generate sequential edges with explicit handle connections
    for i in range(len(nodes) - 1):
        src_n = nodes[i]
        tgt_n = nodes[i + 1]
        edges.append({
            "id": f"edge-{uuid.uuid4().hex[:6]}",
            "source_node_id": src_n["id"],
            "target_node_id": tgt_n["id"],
            "source_handle": "output",
            "target_handle": get_target_handle(tgt_n.get("type", "")),
        })

    # In case of branching with condition, align positions vertically
    if condition_id and len(nodes) >= 3:
        cond_idx = next(i for i, n in enumerate(nodes) if n["id"] == condition_id)
        if cond_idx + 1 < len(nodes):
            nodes[cond_idx + 1]["position"]["y"] = 120
        if cond_idx + 2 < len(nodes):
            nodes[cond_idx + 2]["position"]["y"] = 260

    # Inject variables
    nodes = inject_connected_variables(nodes, edges)

    # Derive workflow name & summary
    name_snippet = prompt.strip()[:40]
    if len(prompt.strip()) > 40:
        name_snippet = name_snippet.rstrip() + "..."
    suggested_name = f"Automação: {name_snippet}"

    explanation = (
        f"Workflow estruturado com {len(nodes)} nós funcionais interconectados: "
        + " ➔ ".join(n["label"] for n in nodes)
        + ". Todas as variáveis entre os nós estão encadeadas no padrão Preci."
    )

    return {
        "name": suggested_name,
        "description": f"Workflow gerado automaticamente com base na solicitação: '{prompt}'",
        "explanation": explanation,
        "nodes": nodes,
        "edges": edges,
    }


async def generate_workflow_with_llm(prompt: str) -> Optional[Dict[str, Any]]:
    """Tries to generate workflow using Gemini Flash if API key is available."""
    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        system_instruction = (
            "Você é o Engenheiro de Automação de Workflows da Preci Company. "
            "Sua tarefa é desenhar grafos de workflows (DAG) funcionais, elegantes e interconectados em JSON estrito.\n"
            "Os únicos tipos de nós permitidos são estritamente:\n"
            "- 'trigger': Ponto de partida (manual ou webhook)\n"
            "- 'ai_model': Modelo Gemini Flash com system_prompt e user_prompt\n"
            "- 'rag': Busca semântica vetorial em documentos corporativos\n"
            "- 'condition': Decisão lógica condicional\n"
            "- 'report_generator': Gerador de relatório HTML limpo/executivo\n"
            "- 'email_sender': Envio de e-mails corporativos via SMTP\n"
            "- 'http_request': Requisições REST para APIs externas\n"
            "- 'action': Notificação interna em canais corporativos (Slack)\n\n"
            "Regras fundamentais:\n"
            "1. Os nós devem ser encadeados logicamente via edges com 'source_node_id', 'target_node_id', 'source_handle' ('output') e 'target_handle' ('prompt', 'query', 'raw_data', 'body', 'value').\n"
            "2. Cada nó consome diretamente a saída conectada pelo cabo em seu respectivo campo.\n"
            "3. Posições X devem fluir da esquerda para a direita (ex: 80, 400, 720, 1040, 1360) e Y por padrão 180.\n"
            "4. Retorne APENAS um objeto JSON válido no formato:\n"
            "{\n"
            '  "name": "Nome do Fluxo",\n'
            '  "description": "Descrição curta",\n'
            '  "explanation": "Explicação das etapas",\n'
            '  "nodes": [{"id": "node-1", "type": "...", "label": "...", "position": {"x": 80, "y": 180}, "config": {...}}],\n'
            '  "edges": [{"id": "edge-1", "source_node_id": "node-1", "target_node_id": "node-2", "source_handle": "output", "target_handle": "prompt"}]\n'
            "}"
        )

        response = await client.aio.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4,
                response_mime_type="application/json",
            ),
        )

        text = response.text or ""
        # Clean markdown code blocks if wrapped
        cleaned_json = re.sub(r"^```json\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned_json = re.sub(r"```$", "", cleaned_json.strip(), flags=re.MULTILINE)
        data = json.loads(cleaned_json)

        if "nodes" in data and isinstance(data["nodes"], list) and len(data["nodes"]) > 0:
            # Normalize and sanitize each node
            sanitized_nodes = []
            for idx, n in enumerate(data["nodes"]):
                n_id = n.get("id") or f"node-{uuid.uuid4().hex[:6]}"
                raw_t = n.get("type", "action")
                san_type = sanitize_node_type(raw_t)
                pos = n.get("position") or {"x": 80 + idx * 320, "y": 180}
                sanitized_nodes.append({
                    "id": n_id,
                    "type": san_type,
                    "label": n.get("label") or san_type.capitalize(),
                    "position": pos,
                    "config": n.get("config") or {},
                })

            edges = data.get("edges") or []
            sanitized_edges = []
            valid_ids = {n["id"] for n in sanitized_nodes}
            for e in edges:
                src = e.get("source_node_id")
                tgt = e.get("target_node_id")
                if src in valid_ids and tgt in valid_ids:
                    tgt_node_obj = next((n for n in sanitized_nodes if n["id"] == tgt), None)
                    tgt_t = tgt_node_obj.get("type", "") if tgt_node_obj else ""
                    sanitized_edges.append({
                        "id": e.get("id") or f"edge-{uuid.uuid4().hex[:6]}",
                        "source_node_id": src,
                        "target_node_id": tgt,
                        "source_handle": e.get("source_handle") or "output",
                        "target_handle": e.get("target_handle") or get_target_handle(tgt_t),
                    })

            # If edges missing, create sequential edges
            if not sanitized_edges and len(sanitized_nodes) > 1:
                for i in range(len(sanitized_nodes) - 1):
                    tgt_t = sanitized_nodes[i + 1].get("type", "")
                    sanitized_edges.append({
                        "id": f"edge-{uuid.uuid4().hex[:6]}",
                        "source_node_id": sanitized_nodes[i]["id"],
                        "target_node_id": sanitized_nodes[i + 1]["id"],
                        "source_handle": "output",
                        "target_handle": get_target_handle(tgt_t),
                    })

            sanitized_nodes = inject_connected_variables(sanitized_nodes, sanitized_edges)

            return {
                "name": data.get("name") or "Workflow Automatizado",
                "description": data.get("description") or prompt[:80],
                "explanation": data.get("explanation") or "Workflow gerado com sucesso pelo Gemini Flash.",
                "nodes": sanitized_nodes,
                "edges": sanitized_edges,
            }
    except Exception as ex:
        logger.warning(f"LLM workflow generation failed or hit quota: {ex}. Falling back to deterministic planner.")
        return None


async def generate_workflow(prompt: str, mode: str = "replace", current_agent: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main entry point for AI workflow generation.
    Attempts LLM generation and gracefully falls back to deterministic NLP synthesizer.
    """
    result = None
    try:
        result = await generate_workflow_with_llm(prompt)
    except Exception:
        result = None

    if not result:
        result = synthesize_workflow_from_prompt(prompt)

    return result
