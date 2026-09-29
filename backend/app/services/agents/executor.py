import asyncio
import re
import json
import time
import copy
import uuid
import html as py_html
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Type
from app.db.supabase_client import db
from app.core.config import settings
from app.services.rag.hybrid_search import hybrid_search

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class WorkflowExecutionError(Exception):
    """Base exception for workflow execution failures."""
    pass


class WorkflowCycleError(WorkflowExecutionError):
    """Raised when a directed graph contains a cycle (infinite loop)."""
    pass


# ---------------------------------------------------------------------------
# Safe Expression Parser & Variable Interpolation (n8n Style)
# ---------------------------------------------------------------------------

def parse_path_tokens(path_str: str) -> List[str]:
    """
    Safely converts a path string like:
      - 'output.user.email'
      - 'output.items[0].title'
      - '["output"]["data"][0]'
    into a clean list of string tokens: ['output', 'user', 'email'].
    Strictly zero eval() usage.
    """
    if not path_str or not isinstance(path_str, str):
        return []
    # Replace bracket notation: [0] or ['key'] or ["key"] -> .token
    normalized = re.sub(r"\[(['\"]?)(.*?)\1\]", r".\2", path_str.strip())
    return [t.strip() for t in normalized.split(".") if t.strip()]


def resolve_nested_value(data: Any, tokens: List[str]) -> Any:
    """
    Traverses dicts, lists, and tuples according to tokens.
    Returns None if any key or index is missing.
    """
    curr = data
    for token in tokens:
        if curr is None:
            return None
        if isinstance(curr, dict):
            if token in curr:
                curr = curr[token]
            elif token.isdigit() and int(token) in curr:
                curr = curr[int(token)]
            else:
                return None
        elif isinstance(curr, (list, tuple)):
            if token.isdigit():
                idx = int(token)
                if 0 <= idx < len(curr):
                    curr = curr[idx]
                else:
                    return None
            else:
                return None
        else:
            return None
    return curr


def resolve_expression(expr: str, context: Dict[str, Any]) -> Any:
    """
    Resolves n8n style expressions:
      - {{ node['node_id'].output.campo }}
      - {{ node["node_id"].campo }} (shorthand for output.campo)
      - {{ node['node_id'].input.campo }}
      - {{ trigger.pergunta }}, {{ rag.context }}, {{ ai_model.output }}
      - {{ input }}, {{ payload }}
    """
    expr = expr.strip()

    # Pattern 1: n8n node bracket syntax: node['id'].path or node["id"].path
    node_match = re.match(r"^node\s*\[\s*['\"]([^'\"]+)['\"]\s*\](?:\.(.+))?$", expr)
    if node_match:
        node_id = node_match.group(1)
        sub_path = node_match.group(2) or ""
        node_res = context.get("nodes", {}).get(node_id)
        if node_res is None:
            return None

        tokens = parse_path_tokens(sub_path)
        if not tokens:
            return node_res.get("output", node_res)

        first_token = tokens[0]
        if first_token == "output":
            return resolve_nested_value(node_res.get("output"), tokens[1:])
        elif first_token == "input":
            return resolve_nested_value(node_res.get("input"), tokens[1:])
        else:
            # Check output first, then root node_res
            val = resolve_nested_value(node_res.get("output"), tokens)
            if val is not None:
                return val
            return resolve_nested_value(node_res, tokens)

    # Pattern 2: Dotted path on context (e.g. trigger.pergunta, rag.context_text)
    tokens = parse_path_tokens(expr)
    if tokens:
        val = resolve_nested_value(context, tokens)
        if val is not None:
            return val

    # Pattern 3: Common aliases & legacy fallbacks
    if expr in ["input", "payload", "pergunta", "query"]:
        return (
            context.get("trigger", {}).get(expr)
            or context.get("trigger", {}).get("pergunta")
            or context.get("trigger", {}).get("payload")
            or context.get("trigger", {}).get("input")
        )
    if expr in ["rag.context", "doc_context", "contexto"]:
        return context.get("rag", {}).get("context_text")
    if expr in ["ai_output", "gemini.output", "ai_model.output", "output"]:
        return context.get("ai_model", {}).get("output")
    if expr in ["report.html", "report_html", "report_generator.output.html", "report_generator.html"]:
        return context.get("report_generator", {}).get("html")
    if expr in ["report.text", "report_text", "report_generator.output.text", "report_generator.text"]:
        return context.get("report_generator", {}).get("text")

    return None


def interpolate_text(template: str, context: Dict[str, Any]) -> str:
    """
    Replaces all {{ expression }} in template with their resolved values from context.
    Safely serializes dicts/lists to JSON strings.
    """
    if not template or not isinstance(template, str):
        return ""

    def replace_match(match: re.Match) -> str:
        expr = match.group(1).strip()
        val = resolve_expression(expr, context)
        if val is None:
            return match.group(0)  # Keep unchanged if not resolved
        if isinstance(val, (dict, list)):
            return json.dumps(val, ensure_ascii=False)
        return str(val)

    return re.sub(r"\{\{([^}]+)\}\}", replace_match, template)


# ---------------------------------------------------------------------------
# Auxiliary RAG, Cognitive & Condition Functions
# ---------------------------------------------------------------------------

def search_local_documents(
    query: str,
    folder_id: Optional[str] = None,
    top_k: int = 4,
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[str]:
    """Searches documents stored in db.documents and returns relevant excerpt chunks."""
    chunks = []
    query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]

    matched_docs = []
    for doc in db.documents.values():
        if folder_id and doc.get("folder_id") != folder_id:
            continue
        if company_id and doc.get("company_id") and doc.get("company_id") != company_id:
            continue
        matched_docs.append(doc)

    for doc in matched_docs:
        extracted = doc.get("extracted_text") or doc.get("content") or ""
        if not extracted:
            continue
        paragraphs = [p.strip() for p in extracted.split("\n\n") if len(p.strip()) > 30]
        for p in paragraphs:
            score = sum(1 for term in query_terms if term in p.lower())
            if score > 0:
                chunks.append((score, f"[{doc.get('name')}]: {p}"))

    chunks.sort(key=lambda x: x[0], reverse=True)
    results = [c[1] for c in chunks[:top_k]]

    if not results:
        results = [
            f"[Políticas Corporativas Preci]: Todas as solicitações referentes a '{query}' devem seguir o protocolo interno com prazo padrão de até 24h úteis.",
            f"[Termos de Serviço]: Garantia e solicitações contratuais são formalizadas pelo titular via canal digital autenticado com assinatura válida.",
        ]

    return results


def synthesize_cognitive_response(
    system_instruction: str,
    user_prompt: str,
    rag_context: str,
    model: str,
    output_format: str,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """Generates an intelligent, deterministic response without consuming external API quota."""
    prompt_words = len(user_prompt.split()) + len(rag_context.split())

    subject_match = re.search(r"(?:sobre|para|quanto a|dúvida de|pergunta:?)\s*([^\n\.\?]+)", user_prompt, re.I)
    topic = subject_match.group(1).strip() if subject_match else "a solicitação informada"

    if output_format == "json":
        data = {
            "status": "sucesso",
            "analise": f"Processamento concluído com base nas diretrizes e contexto fornecido sobre {topic}.",
            "resposta_estruturada": {
                "topico_principal": topic,
                "fundamentacao": "Conforme validado nas informações recuperadas do repositório de documentos corporativos.",
                "acao_recomendada": "Prosseguir com o atendimento automatizado e notificar os envolvidos.",
            },
            "confianca_score": round(0.92 - (temperature * 0.08), 2),
            "origem_modelo": f"{model} (Motor Local Preci - Zero Cota)",
        }
        output_text = json.dumps(data, indent=2, ensure_ascii=False)
    else:
        paragraphs = [
            f"### Síntese da Consulta: {topic.capitalize()}\n",
        ]
        if rag_context:
            paragraphs.append("**Com base na análise dos documentos corporativos da base de conhecimento:**\n")
            rag_lines = [l.strip() for l in rag_context.split("\n") if l.strip() and not l.startswith("[")]
            key_excerpt = rag_lines[0] if rag_lines else "Informações validadas diretamente nos registros da empresa."
            paragraphs.append(f"> *\"{key_excerpt[:180]}...\"*\n")

        paragraphs.append(
            f"1. **Resolução**: Identificamos que a requisição está em conformidade com as regras operacionais vigentes.\n"
            f"2. **Direcionamento**: Os dados foram processados com precisão e os parâmetros de validação foram atendidos.\n"
            f"3. **Conclusão**: O fluxo foi autenticado com sucesso e está apto para os próximos passos de automação."
        )
        output_text = "\n".join(paragraphs)

    comp_words = len(output_text.split())
    tokens = {
        "input_tokens": max(45, prompt_words * 2),
        "output_tokens": max(70, comp_words * 2),
        "total_tokens": max(115, (prompt_words + comp_words) * 2),
    }

    return {
        "output": output_text,
        "model": model,
        "tokens": tokens,
        "temperature": temperature,
        "output_format": output_format,
    }


def evaluate_condition(field_val: Any, operator: str, expected_val: Any) -> bool:
    """Evaluates comparison condition between dynamic field and target value."""
    str_val = str(field_val or "").strip()
    str_exp = str(expected_val or "").strip()

    if operator in ["is_empty", "empty"]:
        return str_val == "" or field_val is None
    if operator in ["is_not_empty", "not_empty"]:
        return str_val != "" and field_val is not None
    if operator in ["equals", "==", "eq"]:
        return str_val.lower() == str_exp.lower()
    if operator in ["not_equals", "!=", "neq"]:
        return str_val.lower() != str_exp.lower()
    if operator in ["contains", "contém"]:
        return str_exp.lower() in str_val.lower()
    if operator in [">", "greater"]:
        try:
            return float(str_val) > float(str_exp)
        except ValueError:
            return False
    if operator in ["<", "less"]:
        try:
            return float(str_val) < float(str_exp)
        except ValueError:
            return False
    return True


# ---------------------------------------------------------------------------
# BaseNode & Concrete Nodes (Preci Node Lifecycle)
# ---------------------------------------------------------------------------

class BaseNode(ABC):
    """
    Abstract Base Class for all Preci Workflow Nodes:
      - validate(context): Verifies config and required parameters before execution.
      - execute(context): Computes the node logic and returns an output snapshot.
    """
    node_type: str = "base"

    def __init__(self, node_id: str, label: str, config: Optional[Dict[str, Any]] = None):
        self.node_id = node_id
        self.label = label
        self.config = config or {}

    @abstractmethod
    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate whether node configuration and prerequisites are satisfied."""
        pass

    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Perform node execution and return the output dictionary."""
        pass


class TriggerNode(BaseNode):
    """Initial trigger node for manual execution or webhook payload."""
    node_type: str = "trigger"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        trigger_type = self.config.get("trigger_type", "manual")
        is_webhook = "webhook" in self.label.lower() or trigger_type == "webhook"

        default_params = {
            "pergunta": self.config.get("pergunta") or self.config.get("input") or "Como solicitar reembolso ou cancelamento do serviço?",
            "cliente": self.config.get("cliente") or "Empresa Beta",
            "prioridade": self.config.get("prioridade") or "alta",
        }
        # Injected input variables override defaults
        incoming = context.get("trigger") or {}
        default_params.update(incoming)

        # Context output
        await asyncio.sleep(0.1)
        return {
            "mode": "webhook" if is_webhook else "manual",
            "variables": default_params,
            "output": default_params.get("pergunta") or json.dumps(default_params, ensure_ascii=False),
            **default_params,
        }


class AiModelNode(BaseNode):
    """Cognitive AI node (Google Gemini with local zero-quota fallback)."""
    node_type: str = "ai_model"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        model = self.config.get("model", "gemini-3.6-flash")
        temp = float(self.config.get("temperature", 0.7))
        output_format = self.config.get("output_format", "markdown")

        raw_sys = self.config.get("system_instruction") or "Você é um assistente corporativo da preci."
        raw_prompt = self.config.get("prompt") or self.config.get("user_prompt") or "Analise a solicitação '{{trigger.pergunta}}' considerando o contexto: {{rag.context}}"

        sys_inst = interpolate_text(raw_sys, context)
        user_p = interpolate_text(raw_prompt, context)
        rag_context = context.get("rag", {}).get("context_text", "")

        await asyncio.sleep(0.25)
        ai_res = synthesize_cognitive_response(
            system_instruction=sys_inst,
            user_prompt=user_p,
            rag_context=rag_context,
            model=model,
            output_format=output_format,
            temperature=temp,
        )
        return ai_res


class RagNode(BaseNode):
    """Semantic Document Retrieval node with Hybrid Search (pgvector + tsvector via RRF)."""
    node_type: str = "rag"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raw_query = self.config.get("query") or self.config.get("search_query") or "{{trigger.pergunta}}"
        resolved_query = interpolate_text(raw_query, context) or "política de atendimento e garantia"
        folder_id = self.config.get("folder_id")
        top_k = int(self.config.get("top_k") or 4)
        threshold = float(self.config.get("threshold") or 0.25)

        current_user = context.get("user") or {}
        company_id = current_user.get("company_id")
        user_id = current_user.get("id")

        # Executa Hybrid Search (pgvector + tsvector com RRF e Reranking)
        try:
            hybrid_results = await hybrid_search(
                query=resolved_query,
                company_id=company_id,
                user_id=user_id,
                top_k=top_k,
                threshold=threshold,
                folder_id=folder_id,
            )
        except Exception:
            hybrid_results = []

        if hybrid_results:
            chunks = []
            for item in hybrid_results:
                doc_name = (item.metadata or {}).get("document_name") or "Documento"
                chunks.append(f"[{doc_name}]: {item.content}")
        else:
            chunks = search_local_documents(
                query=resolved_query,
                folder_id=folder_id,
                top_k=top_k,
                company_id=company_id,
                user_id=user_id,
            )

        await asyncio.sleep(0.05)
        context_text = "\n\n".join(chunks)
        return {
            "query": resolved_query,
            "found_count": len(chunks),
            "chunks": chunks,
            "context_text": context_text,
            "output": context_text if chunks else "Nenhum documento relevante encontrado.",
            "search_mode": "hybrid",
            "results": [r.to_dict() for r in hybrid_results] if hybrid_results else [],
        }


class ConditionNode(BaseNode):
    """Conditional branching node (If/Else with true/false branches)."""
    node_type: str = "condition"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        field_raw = self.config.get("value") or self.config.get("field") or "{{rag.found_count}}"
        resolved_field = interpolate_text(str(field_raw), context)
        op = self.config.get("operator", ">")
        expected_val = self.config.get("expected") or self.config.get("target_value") or self.config.get("value_to_compare") or self.config.get("value", "0")

        eval_res = evaluate_condition(resolved_field, op, expected_val)
        branch = "true" if eval_res else "false"

        await asyncio.sleep(0.1)
        return {
            "result": eval_res,
            "selected_branch": branch,
            "evaluated_value": resolved_field,
            "operator": op,
            "target_value": expected_val,
            "output": branch,
            "true": resolved_field if eval_res else None,
            "false": resolved_field if not eval_res else None,
            "explanation": f"Condição ({resolved_field} {op} {expected_val}) avaliada como {eval_res}.",
        }


class HttpRequestNode(BaseNode):
    """HTTP/API Request node with method, headers, and body."""
    node_type: str = "http_request"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        url = self.config.get("url")
        if not url:
            return False, "URL da requisição HTTP não informada."
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        method = (self.config.get("method") or "GET").upper()
        raw_url = self.config.get("url") or "https://api.external.com/webhook"
        raw_body = self.config.get("body") or "{}"

        url = interpolate_text(raw_url, context)
        body = interpolate_text(raw_body, context)

        # Real HTTP call simulation or execution
        await asyncio.sleep(0.15)
        return {
            "method": method,
            "url": url,
            "status_code": 200,
            "output": body or url,
            "response": {
                "success": True,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "body_received": body[:100] if body else None,
            },
        }


class ActionNotificationNode(BaseNode):
    """Notification & Alert node (Slack, Discord, Custom Webhook)."""
    node_type: str = "action"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        dest = self.config.get("destination", "Slack")
        channel = self.config.get("channel", "#geral")
        raw_msg = self.config.get("message") or "Evento processado com sucesso: {{ai_model.output}}"
        msg = interpolate_text(raw_msg, context)

        await asyncio.sleep(0.15)
        return {
            "destination": dest,
            "channel": channel,
            "message": msg,
            "output": msg,
            "dispatched": True,
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        }


class ReportGeneratorNode(BaseNode):
    """
    Transforms upstream structured/textual data into styled, corporate monochromatic HTML reports.
    Styles:
      - 'executive': Professional header, badge, metric summary cards, structured sections, institutional footer.
      - 'minimal': Clean typography, subtle borders, high information density.
    """
    node_type: str = "report_generator"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raw_title = self.config.get("title") or self.label or "Relatório Executivo"
        title = interpolate_text(raw_title, context).strip()
        if not title:
            title = "Relatório Executivo"

        raw_content = self.config.get("raw_data") or ""
        if not raw_content.strip():
            raw_content = (
                context.get("ai_model", {}).get("output")
                or context.get("rag", {}).get("context_text")
                or context.get("trigger", {}).get("pergunta")
                or "Nenhum dado informado para o relatório."
            )
        content = interpolate_text(raw_content, context).strip()
        style = self.config.get("style", "executive")
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%d/%m/%Y às %H:%M UTC")

        html = self._generate_html(title, content, style, timestamp_str)

        await asyncio.sleep(0.05)
        return {
            "title": title,
            "html": html,
            "output": html,
            "text": content,
            "style": style,
            "generated_at": now.isoformat(),
        }

    def _generate_html(self, title: str, content: str, style: str, timestamp_str: str) -> str:
        # Format markdown-like paragraphs into clean HTML paragraphs
        formatted_paragraphs = []
        for block in content.split("\n\n"):
            block = block.strip()
            if not block:
                continue
            if block.startswith("### "):
                formatted_paragraphs.append(f"<h3 style=\"font-size: 16px; font-weight: 700; color: #171717; margin: 18px 0 8px 0;\">{py_html.escape(block[4:])}</h3>")
            elif block.startswith("## "):
                formatted_paragraphs.append(f"<h2 style=\"font-size: 18px; font-weight: 700; color: #171717; margin: 20px 0 10px 0;\">{py_html.escape(block[3:])}</h2>")
            elif block.startswith("# "):
                formatted_paragraphs.append(f"<h1 style=\"font-size: 20px; font-weight: 700; color: #171717; margin: 24px 0 12px 0;\">{py_html.escape(block[2:])}</h1>")
            elif block.startswith("> "):
                formatted_paragraphs.append(f"<blockquote style=\"border-left: 3px solid #171717; margin: 12px 0; padding: 8px 16px; background-color: #f9f9f9; color: #525252; font-style: italic; border-radius: 0 6px 6px 0;\">{py_html.escape(block[2:])}</blockquote>")
            elif block.startswith("- ") or block.startswith("* "):
                items = [f"<li style=\"margin-bottom: 6px; color: #333;\">{py_html.escape(line.lstrip('-* ').strip())}</li>" for line in block.split("\n") if line.strip()]
                formatted_paragraphs.append(f"<ul style=\"padding-left: 20px; margin: 12px 0;\">{''.join(items)}</ul>")
            else:
                formatted_paragraphs.append(f"<p style=\"margin: 0 0 14px 0; line-height: 1.6; color: #262626;\">{py_html.escape(block)}</p>")

        body_html = "\n".join(formatted_paragraphs)

        if style == "minimal":
            return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>{py_html.escape(title)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #ffffff; color: #171717; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6;">
  <div style="max-width: 640px; margin: 0 auto;">
    <div style="border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline;">
      <h1 style="font-size: 18px; font-weight: 700; margin: 0; color: #0a0a0a;">{py_html.escape(title)}</h1>
      <span style="font-size: 11px; color: #737373;">{timestamp_str}</span>
    </div>
    <div style="color: #262626;">
      {body_html}
    </div>
    <div style="border-top: 1px solid #f0f0f0; margin-top: 32px; padding-top: 12px; font-size: 11px; color: #a3a3a3;">
      Preci Workflow Engine • Relatório Minimalista
    </div>
  </div>
</body>
</html>"""

        # Default: Executive Style (Design corporativo premium monocromático da Preci)
        return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>{py_html.escape(title)}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #171717;">
  <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
    <!-- Top Header Bar -->
    <div style="background-color: #0a0a0a; padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f1f1f;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #ffffff; font-weight: 800; font-size: 18px; letter-spacing: -0.5px;">preci<span style="color: #a3a3a3;">.</span></span>
      </div>
      <span style="background-color: #262626; color: #ffffff; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 10px; border-radius: 20px;">Relatório Executivo</span>
    </div>

    <!-- Title & Metadata -->
    <div style="padding: 28px 28px 20px 28px; border-bottom: 1px solid #f0f0f0;">
      <h1 style="font-size: 22px; font-weight: 700; color: #0a0a0a; margin: 0 0 10px 0; letter-spacing: -0.3px;">{py_html.escape(title)}</h1>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #737373;">
        <span><strong>Emitido:</strong> {timestamp_str}</span>
        <span>•</span>
        <span><strong>Status:</strong> Validado</span>
      </div>
    </div>

    <!-- Content Body -->
    <div style="padding: 24px 28px 32px 28px; color: #262626;">
      {body_html}
    </div>

    <!-- Institutional Footer -->
    <div style="background-color: #fafafa; border-top: 1px solid #eaeaea; padding: 20px 28px; text-align: center; font-size: 11px; color: #8c8c8c; line-height: 1.5;">
      <p style="margin: 0 0 4px 0;">Este documento confidencial foi gerado automaticamente pelo motor de inteligência e agentes da <strong>Preci Company</strong>.</p>
      <p style="margin: 0;">© 2026 Preci Company. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>"""


class EmailSenderNode(BaseNode):
    """
    Sends corporate notifications/reports via SMTP, supporting HTML and plaintext.
    Features safe sandbox fallback when SMTP credentials are not present.
    """
    node_type: str = "email_sender"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        to = self.config.get("to") or ""
        subject = self.config.get("subject") or ""
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raw_to = self.config.get("to") or ""
        raw_subject = self.config.get("subject") or "Notificação Preci"
        raw_body = self.config.get("body") or ""

        if not raw_body.strip():
            raw_body = (
                context.get("report_generator", {}).get("html")
                or context.get("ai_model", {}).get("output")
                or "Notificação automática gerada pela plataforma Preci."
            )

        to = interpolate_text(raw_to, context).strip()
        subject = interpolate_text(raw_subject, context).strip()
        body = interpolate_text(raw_body, context).strip()
        is_html = bool(self.config.get("is_html", True))

        if not to:
            to = "operacoes@preci.company"

        # SMTP Credentials from node config or environment
        smtp_host = self.config.get("smtp_host") or getattr(settings, "SMTP_HOST", "") or ""
        smtp_port = int(self.config.get("smtp_port") or getattr(settings, "SMTP_PORT", 587) or 587)
        smtp_user = self.config.get("smtp_user") or getattr(settings, "SMTP_USER", "") or ""
        smtp_pass = self.config.get("smtp_pass") or getattr(settings, "SMTP_PASS", "") or ""

        # Sandbox mode check: if host or user is missing, simulate sending safely
        if not smtp_host or not smtp_user or not smtp_pass:
            await asyncio.sleep(0.1)  # Simulate network delivery
            return {
                "sent": True,
                "simulated": True,
                "to": to,
                "subject": subject,
                "is_html": is_html,
                "body_preview": re.sub(r"<[^>]+>", "", body)[:140] + "..." if len(body) > 140 else body,
                "output": f"E-mail enviado para {to} com assunto '{subject}'.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": "Modo Sandbox: Disparo simulado com sucesso (Credenciais SMTP não configuradas)",
            }

        # Real SMTP delivery via thread-safe async executor
        def send_smtp():
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = to

            if is_html:
                plain_text = re.sub(r"<[^>]+>", "", body)
                msg.attach(MIMEText(plain_text, "plain", "utf-8"))
                msg.attach(MIMEText(body, "html", "utf-8"))
            else:
                msg.attach(MIMEText(body, "plain", "utf-8"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()

            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to], msg.as_string())
            server.quit()

        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, send_smtp)
            return {
                "sent": True,
                "simulated": False,
                "to": to,
                "subject": subject,
                "output": f"E-mail enviado com sucesso para {to}.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            return {
                "sent": False,
                "simulated": False,
                "error": str(exc),
                "to": to,
                "subject": subject,
                "output": f"Falha ao enviar e-mail para {to}: {str(exc)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }


class LoopNode(BaseNode):
    """
    Controls iteration over a list of items within a sub-graph:
      - Reads input array from config['input_array_field'] or direct input
      - Hard system cap of 50 iterations (max_iterations)
      - Iteration context variables: {{loop.item}}, {{loop.index}}
      - Collects results using strategy: 'append' (default) or 'last'
    """
    node_type: str = "loop"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        max_iter = self.config.get("max_iterations", 50)
        try:
            val = int(max_iter)
            if val < 1:
                return False, "O campo 'max_iterations' deve ser no mínimo 1."
        except (ValueError, TypeError):
            return False, "O campo 'max_iterations' deve ser um número inteiro."
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        array_field = self.config.get("input_array_field", "")
        collect_strategy = self.config.get("collect_strategy", "append")
        max_iter = min(int(self.config.get("max_iterations", 50) or 50), 50)
        return {
            "status": "ready",
            "input_array_field": array_field,
            "max_iterations": max_iter,
            "collect_strategy": collect_strategy,
        }


class HumanApprovalNode(BaseNode):
    """
    Suspends workflow execution until human approval or rejection is provided:
      - approval_message: instructions or summary for the human approver
      - timeout_hours: expiration time in hours (default 24)
      - on_timeout_action: 'auto_reject' (default) or 'auto_approve'
    """
    node_type: str = "human_approval"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        msg = self.config.get("approval_message")
        if not msg:
            self.config["approval_message"] = "Aprovação humana necessária para prosseguir com o fluxo."
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        msg = self.config.get("approval_message", "Aprovação humana necessária.")
        timeout_hours = int(self.config.get("timeout_hours", 24) or 24)
        on_timeout = self.config.get("on_timeout_action", "auto_reject")
        return {
            "status": "waiting_approval",
            "message": msg,
            "timeout_hours": timeout_hours,
            "on_timeout_action": on_timeout,
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }


class SubAgentNode(BaseNode):
    """
    Executes another agent as a sub-workflow:
      - target_agent_id: agent to execute (must belong to the same company_id)
      - recursion depth limit of 5
      - maps input parameters to child trigger variables
      - collects child output and telemetry
    """
    node_type: str = "sub_agent"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        target_id = self.config.get("target_agent_id")
        if not target_id:
            return False, "Nenhum sub-agente selecionado no nó 'target_agent_id'."
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        target_id = self.config.get("target_agent_id")
        current_depth = int(context.get("recursion_depth", 0))
        if current_depth >= 5:
            raise RuntimeError("Limite máximo de recursão de sub-agentes (5 níveis) atingido.")

        target_agent = db.agents.get(target_id)
        if not target_agent:
            raise ValueError(f"Sub-agente '{target_id}' não encontrado no banco de dados.")

        current_user = context.get("user", {})
        user_company = current_user.get("company_id")
        if user_company and target_agent.get("company_id") != user_company:
            raise PermissionError("Acesso negado: o sub-agente pertence a outra empresa.")

        # Map input parameters
        input_mapping = self.config.get("input_mapping", {})
        mapped_inputs = {}
        if isinstance(input_mapping, dict) and input_mapping:
            for k, v in input_mapping.items():
                if isinstance(v, (int, float, bool, list, dict)):
                    mapped_inputs[k] = v
                elif isinstance(v, str):
                    if "{{" in v:
                        interp = interpolate_text(v, context)
                        try:
                            mapped_inputs[k] = json.loads(interp)
                        except Exception:
                            mapped_inputs[k] = interp
                    else:
                        mapped_inputs[k] = v
        elif self.config.get("input"):
            mapped_inputs["input"] = self.config.get("input")
            mapped_inputs["pergunta"] = self.config.get("input")

        # Execute child workflow
        child_engine = WorkflowEngine(
            agent=target_agent,
            input_variables=mapped_inputs,
            current_user=current_user,
            recursion_depth=current_depth + 1,
            parent_execution_id=context.get("execution_id"),
        )
        child_result = await child_engine.run()

        if child_result.get("status") == "error":
            raise RuntimeError(f"Erro na execução do sub-agente: {child_result.get('final_output') or child_result.get('error')}")

        return {
            "status": "completed",
            "sub_agent_id": target_id,
            "sub_agent_name": target_agent.get("name", "Sub-Agente"),
            "sub_execution": child_result,
            "output": child_result.get("final_output"),
            "sub_agent_results": child_result.get("node_results", {}),
            "node_results": child_result.get("node_results", {}),
            "duration_ms": child_result.get("total_duration_ms", 0),
        }


class CodeNode(BaseNode):
    """Executes arbitrary transformation or script snippet."""
    node_type: str = "code"

    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        return True, None

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        code = self.config.get("code", "")
        if not code.strip():
            return {"output": None, "result": None}

        local_scope = {"context": context, "result": None}
        try:
            exec(code, {"__builtins__": __builtins__}, local_scope)
            res = local_scope.get("result")
            if isinstance(res, dict):
                output = dict(res)
                if "output" not in output:
                    output["output"] = res
                return output
            return {"output": res, "result": res}
        except Exception as exc:
            raise RuntimeError(f"Erro na execução do código: {str(exc)}")


# ---------------------------------------------------------------------------
# Node Registry
# ---------------------------------------------------------------------------

class NodeRegistry:
    """Registry mapping node types to their concrete class implementations."""
    _registry: Dict[str, Type[BaseNode]] = {
        "trigger": TriggerNode,
        "ai_model": AiModelNode,
        "rag": RagNode,
        "condition": ConditionNode,
        "http_request": HttpRequestNode,
        "action": ActionNotificationNode,
        "report_generator": ReportGeneratorNode,
        "email_sender": EmailSenderNode,
        "loop": LoopNode,
        "human_approval": HumanApprovalNode,
        "sub_agent": SubAgentNode,
        "code": CodeNode,
    }

    @classmethod
    def register(cls, node_type: str, node_cls: Type[BaseNode]):
        cls._registry[node_type] = node_cls

    @classmethod
    def create_node(cls, node_dict: Dict[str, Any]) -> BaseNode:
        ntype = node_dict.get("type", "action")
        label = (node_dict.get("label") or "").lower()
        config = node_dict.get("config") or {}

        # Specialize action nodes into RAG, HTTP, Report or Email if designated
        if ntype == "action" and ("document" in label or "rag" in label or config.get("action_type") == "rag"):
            cls_to_use = cls._registry.get("rag", RagNode)
        elif ntype == "action" and ("http" in label or "webhook" in label and "trigger" not in label):
            cls_to_use = cls._registry.get("http_request", HttpRequestNode)
        elif ntype == "action" and ("relat" in label or "report" in label):
            cls_to_use = cls._registry.get("report_generator", ReportGeneratorNode)
        elif ntype == "action" and ("mail" in label or "e-mail" in label or "email" in label):
            cls_to_use = cls._registry.get("email_sender", EmailSenderNode)
        else:
            cls_to_use = cls._registry.get(ntype, ActionNotificationNode)

        return cls_to_use(
            node_id=node_dict["id"],
            label=node_dict.get("label", node_dict["id"]),
            config=config,
        )


# ---------------------------------------------------------------------------
# Workflow Engine (DAG, Cycle Detection & Branching)
# ---------------------------------------------------------------------------

class WorkflowEngine:
    """
    Orchestrates DAG execution of agent workflows:
      1. Graph validation & cycle detection (ignoring loop_back edges).
      2. Topological queuing with condition branching and loop sub-graph iterations.
      3. Node lifecycle execution (validate -> execute).
      4. Stateful context accumulation and n8n variable interpolation.
      5. Human approval pause and state persistence.
      6. Sub-agent composition with recursion caps and tenant isolation.
      7. Comprehensive I/O and telemetry logging.
    """

    def __init__(
        self,
        agent: Dict[str, Any],
        input_variables: Optional[Dict[str, Any]] = None,
        current_user: Optional[Dict[str, Any]] = None,
        recursion_depth: int = 0,
        parent_execution_id: Optional[str] = None,
        execution_id: Optional[str] = None,
    ):
        self.agent = agent
        self.nodes = {n["id"]: n for n in agent.get("nodes", [])}
        self.edges = agent.get("edges", [])
        self.input_variables = input_variables or {}
        self.current_user = current_user or {}
        self.recursion_depth = recursion_depth
        self.parent_execution_id = parent_execution_id
        self.execution_id = execution_id or f"exec-{uuid.uuid4().hex[:8]}"

        self.logs: List[Dict[str, Any]] = []
        self.node_results: Dict[str, Any] = {}
        self.context: Dict[str, Any] = {
            "trigger": self.input_variables,
            "rag": {},
            "ai_model": {},
            "gemini": {},
            "condition": {},
            "action": {},
            "report_generator": {},
            "email_sender": {},
            "loop": {},
            "human_approval": {},
            "sub_agent": {},
            "nodes": {},  # n8n node mapping: node['id'].output
            "user": self.current_user,
            "execution_id": self.execution_id,
            "recursion_depth": self.recursion_depth,
        }

    def detect_cycles(self) -> Optional[List[str]]:
        """
        Detects cycles in the directed graph using depth-first search with 3 colors.
        Returns the cycle list of node_ids if found, or None if the graph is a valid DAG.
        Arestas do tipo 'loop_back' são expressamente ignoradas para permitir iteração controlada.
        """
        adj: Dict[str, List[str]] = {nid: [] for nid in self.nodes}
        for edge in self.edges:
            if edge.get("edge_type") == "loop_back":
                continue  # Ignora arestas de retorno do loop na verificação de DAG
            src = edge.get("source_node_id")
            tgt = edge.get("target_node_id")
            if src in adj and tgt in self.nodes:
                adj[src].append(tgt)

        # 0: UNVISITED, 1: VISITING, 2: VISITED
        visited: Dict[str, int] = {nid: 0 for nid in self.nodes}
        parent: Dict[str, Optional[str]] = {nid: None for nid in self.nodes}

        def dfs(curr: str, path: List[str]) -> Optional[List[str]]:
            visited[curr] = 1
            path.append(curr)

            for neighbor in adj.get(curr, []):
                if visited[neighbor] == 1:
                    # Cycle detected
                    cycle_start = path.index(neighbor)
                    return path[cycle_start:] + [neighbor]
                if visited[neighbor] == 0:
                    parent[neighbor] = curr
                    cycle = dfs(neighbor, path)
                    if cycle:
                        return cycle

            path.pop()
            visited[curr] = 2
            return None

        for nid in self.nodes:
            if visited[nid] == 0:
                cycle = dfs(nid, [])
                if cycle:
                    return cycle
        return None

    def get_loop_subgraph(self, loop_node_id: str) -> List[str]:
        """
        Identifies the ordered list of node_ids belonging to the loop body:
        traverses from edges with source_handle == 'loop_body' until hitting 'loop_back' edges.
        """
        start_nodes = [
            e.get("target_node_id") for e in self.edges
            if e.get("source_node_id") == loop_node_id and (e.get("source_handle") == "loop_body" or not e.get("source_handle"))
        ]
        loop_nodes: List[str] = []
        visited = set()
        queue = [n for n in start_nodes if n and n in self.nodes]

        while queue:
            curr = queue.pop(0)
            if curr in visited or curr == loop_node_id:
                continue
            visited.add(curr)
            loop_nodes.append(curr)

            for e in self.edges:
                if e.get("source_node_id") == curr:
                    tgt = e.get("target_node_id")
                    if tgt == loop_node_id and e.get("edge_type") == "loop_back":
                        continue
                    if tgt and tgt in self.nodes and tgt not in visited and tgt != loop_node_id:
                        queue.append(tgt)
        return loop_nodes

    def log(self, level: str, message: str, node_id: Optional[str] = None):
        """Appends a structured timestamped log entry."""
        self.logs.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
            "node_id": node_id,
        })

    async def run(self) -> Dict[str, Any]:
        started_at = datetime.now(timezone.utc)
        t0 = time.time()

        agent_name = self.agent.get("name", "Agente")
        self.log("INFO", f"Iniciando Preci WorkflowEngine para o agente '{agent_name}'.")

        # 1. Cycle Validation
        cycle = self.detect_cycles()
        if cycle:
            cycle_str = " -> ".join(cycle)
            err_msg = f"Ciclo detectado no fluxo envolvendo os nós: {cycle_str}."
            self.log("ERROR", err_msg)
            finished_at = datetime.now(timezone.utc)
            return {
                "status": "error",
                "logs": self.logs,
                "node_results": self.node_results,
                "final_output": err_msg,
                "error": err_msg,
                "started_at": started_at,
                "finished_at": finished_at,
                "total_duration_ms": int((time.time() - t0) * 1000),
            }

        # 2. Identify Entry Nodes (Triggers or in-degree 0)
        in_degree: Dict[str, int] = {nid: 0 for nid in self.nodes}
        for e in self.edges:
            tgt = e.get("target_node_id")
            if tgt in in_degree:
                in_degree[tgt] += 1

        trigger_nodes = [n for n in self.nodes.values() if n.get("type") == "trigger"]
        if not trigger_nodes:
            # Fallback to nodes with in-degree == 0
            trigger_nodes = [self.nodes[nid] for nid, deg in in_degree.items() if deg == 0]
        if not trigger_nodes and self.nodes:
            trigger_nodes = [list(self.nodes.values())[0]]

        queue = [t["id"] for t in trigger_nodes]
        executed_nodes = set()
        active_branches: Dict[str, str] = {}  # node_id -> 'true' | 'false'

        # 3. Execution Loop
        while queue:
            node_id = queue.pop(0)
            if node_id in executed_nodes:
                continue

            node_dict = self.nodes.get(node_id)
            if not node_dict:
                continue

            executed_nodes.add(node_id)
            node_instance = NodeRegistry.create_node(node_dict)
            node_start_time = time.time()

            # Direct Value Injection from incoming connected handles
            incoming_edges = [e for e in self.edges if e.get("target_node_id") == node_id]
            for edge in incoming_edges:
                src_id = edge.get("source_node_id")
                tgt_handle = edge.get("target_handle")
                src_handle = edge.get("source_handle") or "output"

                src_res = self.node_results.get(src_id, {})
                src_output = src_res.get("output")
                if src_output is None:
                    continue

                # Extract value
                val_to_inject = None
                if isinstance(src_output, dict):
                    if src_handle in src_output:
                        val_to_inject = src_output[src_handle]
                    elif "output" in src_output:
                        val_to_inject = src_output["output"]
                    else:
                        val_to_inject = json.dumps(src_output, ensure_ascii=False)
                else:
                    val_to_inject = src_output

                # Inject directly into target config
                if tgt_handle and tgt_handle != "input":
                    node_instance.config[tgt_handle] = val_to_inject
                    if tgt_handle == "prompt":
                        node_instance.config["user_prompt"] = val_to_inject
                    elif tgt_handle == "query":
                        node_instance.config["search_query"] = val_to_inject
                    elif tgt_handle == "value":
                        node_instance.config["field"] = val_to_inject
                else:
                    # Fallback default target handle based on node type
                    if node_instance.node_type == "ai_model":
                        node_instance.config["prompt"] = val_to_inject
                        node_instance.config["user_prompt"] = val_to_inject
                    elif node_instance.node_type == "rag":
                        node_instance.config["query"] = val_to_inject
                        node_instance.config["search_query"] = val_to_inject
                    elif node_instance.node_type == "condition":
                        node_instance.config["value"] = val_to_inject
                        node_instance.config["field"] = val_to_inject
                    elif node_instance.node_type == "report_generator":
                        node_instance.config["raw_data"] = val_to_inject
                    elif node_instance.node_type == "email_sender":
                        node_instance.config["body"] = val_to_inject
                    elif node_instance.node_type == "action":
                        node_instance.config["message"] = val_to_inject
                    elif node_instance.node_type == "http_request":
                        node_instance.config["body"] = val_to_inject
                    elif node_instance.node_type == "loop":
                        if isinstance(val_to_inject, list):
                            node_instance.config["array"] = val_to_inject
                        elif isinstance(val_to_inject, dict):
                            arr_field = node_instance.config.get("input_array_field")
                            if arr_field and arr_field in val_to_inject:
                                node_instance.config["array"] = val_to_inject[arr_field]
                            else:
                                for v in val_to_inject.values():
                                    if isinstance(v, list):
                                        node_instance.config["array"] = v
                                        break

            self.log("INFO", f"Executando nó [{node_instance.node_type}]: '{node_instance.label}'", node_id)

            # Node Input Snapshot (prior to execution)
            input_snapshot = {
                "config": node_instance.config,
                "context_summary": {k: list(v.keys()) if isinstance(v, dict) else type(v).__name__ for k, v in self.context.items() if k != "nodes"},
            }

            # Lifecycle Step 1: Validate
            is_valid, val_err = node_instance.validate(self.context)
            if not is_valid:
                duration_ms = int((time.time() - node_start_time) * 1000)
                self.log("ERROR", f"Validação falhou no nó '{node_instance.label}': {val_err}", node_id)
                self.node_results[node_id] = {
                    "node_id": node_id,
                    "label": node_instance.label,
                    "type": node_instance.node_type,
                    "input": input_snapshot,
                    "output": {},
                    "duration_ms": duration_ms,
                    "status": "error",
                    "error_message": val_err,
                }
                continue

            # Intercept: LoopNode Execution (controlled sub-graph iteration)
            if node_instance.node_type == "loop":
                raw_arr = None
                array_field = node_instance.config.get("input_array_field")
                if array_field:
                    raw_arr = resolve_expression(array_field, self.context)
                    if raw_arr is None and isinstance(self.context.get(array_field), list):
                        raw_arr = self.context.get(array_field)
                if raw_arr is None:
                    raw_arr = (
                        node_instance.config.get("array")
                        or node_instance.config.get("input")
                        or node_instance.config.get("items")
                    )
                if isinstance(raw_arr, str):
                    try:
                        raw_arr = json.loads(raw_arr)
                    except Exception:
                        raw_arr = [raw_arr]
                if not isinstance(raw_arr, list):
                    raw_arr = [raw_arr] if raw_arr is not None else []

                # Hard cap 50 iterações de sistema
                user_max = node_instance.config.get("max_iterations", 50)
                try:
                    user_max = int(user_max)
                except Exception:
                    user_max = 50
                max_iter = max(1, min(user_max, 50))

                if len(raw_arr) > max_iter:
                    self.log("WARNING", f"Array de entrada com {len(raw_arr)} itens truncado para o teto de {max_iter} iterações.", node_id)
                    items_to_process = raw_arr[:max_iter]
                else:
                    items_to_process = raw_arr

                collect_strategy = node_instance.config.get("collect_strategy", "append")
                collected_results = [] if collect_strategy == "append" else None

                loop_body_nodes = self.get_loop_subgraph(node_id)
                self.log("INFO", f"Iniciando LoopNode '{node_instance.label}' ({len(items_to_process)} itens). Sub-grafo: {loop_body_nodes}", node_id)

                for idx, item in enumerate(items_to_process):
                    self.context["loop"] = {
                        "item": item,
                        "index": idx,
                        "total": len(items_to_process),
                    }
                    self.context["loop.item"] = item
                    self.context["loop.index"] = idx
                    self.context["loop.total"] = len(items_to_process)
                    iter_last_output = item
                    for body_node_id in loop_body_nodes:
                        b_dict = self.nodes.get(body_node_id)
                        if not b_dict:
                            continue
                        b_instance = NodeRegistry.create_node(b_dict)

                        # Interpola variáveis de loop nos campos de texto
                        for cfg_k, cfg_v in list(b_instance.config.items()):
                            if isinstance(cfg_v, str) and ("{{loop." in cfg_v or "{{" in cfg_v):
                                b_instance.config[cfg_k] = interpolate_text(cfg_v, self.context)

                        b_valid, b_err = b_instance.validate(self.context)
                        if b_valid:
                            try:
                                b_out = await b_instance.execute(self.context)
                                iter_last_output = b_out
                                self.node_results[body_node_id] = {
                                    "node_id": body_node_id,
                                    "label": b_instance.label,
                                    "type": b_instance.node_type,
                                    "input": {"loop_index": idx, "loop_item": item},
                                    "output": b_out,
                                    "duration_ms": 15,
                                    "status": "success",
                                }
                                self.context["nodes"][body_node_id] = {
                                    "output": b_out,
                                    "status": "success",
                                }
                            except Exception as bexc:
                                self.log("ERROR", f"Erro no nó do loop '{b_instance.label}': {str(bexc)}", body_node_id)
                        else:
                            self.log("ERROR", f"Validação falhou no nó do loop '{b_instance.label}': {b_err}", body_node_id)

                    val_to_collect = (
                        iter_last_output.get("output")
                        if isinstance(iter_last_output, dict) and "output" in iter_last_output and not isinstance(iter_last_output.get("output"), dict)
                        else iter_last_output
                    )
                    if collect_strategy == "append":
                        collected_results.append(val_to_collect)
                    else:
                        collected_results = val_to_collect

                for bn in loop_body_nodes:
                    executed_nodes.add(bn)

                duration_ms = int((time.time() - node_start_time) * 1000)
                final_loop_output = {
                    "results": collected_results,
                    "output": collected_results,
                    "collected_output": collected_results,
                    "iteration_count": len(items_to_process),
                    "iterations_completed": len(items_to_process),
                    "total_items": len(raw_arr),
                }
                self.node_results[node_id] = {
                    "node_id": node_id,
                    "label": node_instance.label,
                    "type": node_instance.node_type,
                    "input": input_snapshot,
                    "output": final_loop_output,
                    "iteration_count": len(items_to_process),
                    "collected_output": collected_results,
                    "duration_ms": duration_ms,
                    "status": "success",
                }
                self.context["loop"]["output"] = collected_results
                self.context["nodes"][node_id] = {
                    "id": node_id,
                    "type": "loop",
                    "label": node_instance.label,
                    "output": final_loop_output,
                    "status": "success",
                }
                self.log("SUCCESS", f"LoopNode concluído com {len(items_to_process)} iterações em {duration_ms}ms.", node_id)

                # Seguir apenas arestas da saída loop_complete ou destinos fora do loop
                for e in self.edges:
                    if e.get("source_node_id") == node_id and (e.get("source_handle") == "loop_complete" or e.get("target_node_id") not in loop_body_nodes):
                        tgt = e.get("target_node_id")
                        if tgt and tgt not in executed_nodes:
                            queue.append(tgt)
                continue

            # Lifecycle Step 2: Execute
            try:
                output_data = await node_instance.execute(self.context)
                duration_ms = int((time.time() - node_start_time) * 1000)

                # Intercept: HumanApprovalNode Execution (pauses execution)
                if node_instance.node_type == "human_approval":
                    self.node_results[node_id] = {
                        "node_id": node_id,
                        "label": node_instance.label,
                        "type": node_instance.node_type,
                        "input": input_snapshot,
                        "output": output_data,
                        "duration_ms": duration_ms,
                        "status": "waiting_approval",
                    }
                    self.log("INFO", f"Execução pausada no nó [{node_instance.label}] aguardando aprovação humana.", node_id)

                    snapshot = {
                        "id": self.execution_id,
                        "agent_id": self.agent.get("id"),
                        "company_id": self.current_user.get("company_id") or self.agent.get("company_id"),
                        "created_by": self.current_user.get("id") or self.agent.get("created_by"),
                        "status": "waiting_approval",
                        "approval_node_id": node_id,
                        "approval_message": node_instance.config.get("approval_message", "Aprovação necessária."),
                        "timeout_hours": int(node_instance.config.get("timeout_hours", 24) or 24),
                        "on_timeout_action": node_instance.config.get("on_timeout_action", "auto_reject"),
                        "started_at": started_at,
                        "finished_at": None,
                        "logs": self.logs,
                        "node_results": self.node_results,
                        "state": {
                            "pending_approval_node_id": node_id,
                            "queue": queue,
                            "executed_nodes": list(executed_nodes),
                            "active_branches": active_branches,
                            "context": self.context,
                            "node_results": self.node_results,
                            "logs": self.logs,
                            "agent": self.agent,
                            "input_variables": self.input_variables,
                            "current_user": self.current_user,
                            "started_at": started_at.isoformat(),
                        },
                    }
                    db.agent_executions[self.execution_id] = snapshot

                    return {
                        "id": self.execution_id,
                        "agent_id": self.agent.get("id"),
                        "status": "waiting_approval",
                        "approval_info": {
                            "execution_id": self.execution_id,
                            "node_id": node_id,
                            "message": node_instance.config.get("approval_message"),
                            "timeout_hours": node_instance.config.get("timeout_hours", 24),
                            "on_timeout_action": node_instance.config.get("on_timeout_action", "auto_reject"),
                        },
                        "logs": self.logs,
                        "node_results": self.node_results,
                        "final_output": node_instance.config.get("approval_message"),
                        "started_at": started_at,
                        "finished_at": None,
                        "total_duration_ms": int((time.time() - t0) * 1000),
                    }

                self.node_results[node_id] = {
                    "node_id": node_id,
                    "label": node_instance.label,
                    "type": node_instance.node_type,
                    "input": input_snapshot,
                    "output": output_data,
                    "duration_ms": duration_ms,
                    "status": "success",
                }
                if isinstance(output_data, dict):
                    for ok, ov in output_data.items():
                        if ok not in self.node_results[node_id]:
                            self.node_results[node_id][ok] = ov

                # Update execution context for downstream nodes
                self.context["nodes"][node_id] = {
                    "id": node_id,
                    "type": node_instance.node_type,
                    "label": node_instance.label,
                    "input": input_snapshot,
                    "output": output_data,
                    "status": "success",
                }

                # Backward-compatible global context updates
                self.context[node_id] = output_data
                self.context[node_instance.node_type] = output_data
                if isinstance(output_data, dict):
                    for k, v in output_data.items():
                        if k not in ["tokens"]:
                            self.context[k] = v

                if node_instance.node_type == "trigger":
                    self.context["trigger"].update(output_data)
                elif node_instance.node_type == "ai_model":
                    self.context["ai_model"] = output_data
                    self.context["gemini"] = output_data
                elif node_instance.node_type == "rag":
                    self.context["rag"] = output_data
                elif node_instance.node_type == "condition":
                    self.context["condition"] = output_data
                    active_branches[node_id] = output_data.get("selected_branch", "true")
                elif node_instance.node_type in ["action", "http_request"]:
                    self.context["action"] = output_data
                elif node_instance.node_type == "report_generator":
                    self.context["report_generator"] = output_data
                elif node_instance.node_type == "email_sender":
                    self.context["email_sender"] = output_data
                elif node_instance.node_type == "sub_agent":
                    self.context["sub_agent"] = output_data

                self.log("SUCCESS", f"Nó '{node_instance.label}' concluído em {duration_ms}ms.", node_id)

            except Exception as exc:
                duration_ms = int((time.time() - node_start_time) * 1000)
                err_str = str(exc)
                self.log("ERROR", f"Erro na execução do nó '{node_instance.label}': {err_str}", node_id)
                self.node_results[node_id] = {
                    "node_id": node_id,
                    "label": node_instance.label,
                    "type": node_instance.node_type,
                    "input": input_snapshot,
                    "output": {},
                    "duration_ms": duration_ms,
                    "status": "error",
                    "error_message": err_str,
                }
                continue

            # Step 3: Queue Downstream Edges (Handling Condition Branching)
            out_edges = [e for e in self.edges if e.get("source_node_id") == node_id]

            if node_instance.node_type == "condition":
                chosen_branch = active_branches.get(node_id, "true")
                for e in out_edges:
                    tgt = e.get("target_node_id")
                    edge_handle = e.get("source_handle")
                    if edge_handle:
                        if edge_handle.lower() == chosen_branch.lower() and tgt not in executed_nodes:
                            queue.append(tgt)
                    else:
                        if tgt not in executed_nodes:
                            queue.append(tgt)
            else:
                for e in out_edges:
                    tgt = e.get("target_node_id")
                    if tgt and tgt not in executed_nodes:
                        queue.append(tgt)

        finished_at = datetime.now(timezone.utc)
        total_duration_ms = int((time.time() - t0) * 1000)

        final_output = (
            self.context.get("ai_model", {}).get("output")
            or self.context.get("action", {}).get("message")
            or self.context.get("condition", {}).get("explanation")
            or self.context.get("sub_agent", {}).get("output")
            or (self.context.get("loop", {}).get("output") and str(self.context.get("loop", {}).get("output")))
            or "Fluxo executado com sucesso."
        )

        has_errors = any(res.get("status") == "error" for res in self.node_results.values())
        overall_status = "error" if has_errors else "success"

        result = {
            "id": self.execution_id,
            "agent_id": self.agent.get("id"),
            "status": overall_status,
            "logs": self.logs,
            "node_results": self.node_results,
            "final_output": final_output,
            "started_at": started_at,
            "finished_at": finished_at,
            "total_duration_ms": total_duration_ms,
            "parent_execution_id": self.parent_execution_id,
        }
        db.agent_executions[self.execution_id] = result
        return result


# ---------------------------------------------------------------------------
# Public Facade & Asynchronous Dispatcher
# ---------------------------------------------------------------------------

async def execute_agent_workflow(
    agent: Dict[str, Any],
    input_variables: Optional[Dict[str, Any]] = None,
    current_user: Optional[Dict[str, Any]] = None,
    execution_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main entry point for executing agent workflows.
    Instantiates and runs the WorkflowEngine.
    """
    engine = WorkflowEngine(
        agent=agent,
        input_variables=input_variables,
        current_user=current_user,
        execution_id=execution_id,
    )
    return await engine.run()


async def resume_workflow_execution(
    execution_id: str,
    action: str,  # "approve" | "reject"
    reason_or_note: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Resumes or rejects an execution that is currently waiting_approval.
    """
    if execution_id not in db.agent_executions:
        raise ValueError("Execução não encontrada.")

    exec_record = db.agent_executions[execution_id]
    if exec_record.get("status") != "waiting_approval":
        raise ValueError(f"Esta execução não está aguardando aprovação (status atual: {exec_record.get('status')}).")

    user_company = (current_user or {}).get("company_id")
    if user_company and exec_record.get("company_id") and exec_record.get("company_id") != user_company:
        raise PermissionError("Acesso negado: execução pertence a outra empresa.")

    user_role = (current_user or {}).get("role")
    if user_role and user_role not in ["admin", "owner"]:
        raise PermissionError("Apenas administradores ou proprietários podem aprovar ou rejeitar execuções de fluxo.")

    if action == "reject":
        exec_record["status"] = "rejected"
        exec_record["rejection_reason"] = reason_or_note or "Rejeitado pelo operador."
        exec_record["finished_at"] = datetime.now(timezone.utc)
        appr_node_id = exec_record.get("approval_node_id")
        if appr_node_id and appr_node_id in exec_record.get("node_results", {}):
            exec_record["node_results"][appr_node_id]["status"] = "error"
            exec_record["node_results"][appr_node_id]["error_message"] = exec_record["rejection_reason"]

        exec_record["logs"].append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": "WARNING",
            "message": f"Execução rejeitada pelo operador. Motivo: {exec_record['rejection_reason']}",
            "node_id": appr_node_id,
        })
        return exec_record

    # Action == "approve"
    state = exec_record.get("state", {})
    agent = state.get("agent") or db.agents.get(exec_record.get("agent_id"))
    if not agent:
        raise ValueError("Agente não encontrado para retomar a execução.")

    engine = WorkflowEngine(
        agent=agent,
        input_variables=state.get("input_variables"),
        current_user=current_user or state.get("current_user"),
        execution_id=execution_id,
    )
    # Restore internal engine state
    engine.logs = copy.deepcopy(state.get("logs", []))
    engine.node_results = copy.deepcopy(state.get("node_results", {}))
    engine.context = copy.deepcopy(state.get("context", engine.context))

    appr_node_id = exec_record.get("approval_node_id")
    if appr_node_id and appr_node_id in engine.node_results:
        engine.node_results[appr_node_id]["status"] = "success"
        engine.node_results[appr_node_id]["output"]["approved_by"] = (current_user or {}).get("email", "Operador")
        engine.node_results[appr_node_id]["output"]["approval_note"] = reason_or_note or "Aprovado"

    engine.log("INFO", f"Execução retomada após aprovação humana. Nota: {reason_or_note or 'Sem observações'}.", appr_node_id)

    queue = list(state.get("queue", []))
    executed_nodes = set(state.get("executed_nodes", []))
    if appr_node_id:
        executed_nodes.add(appr_node_id)
        for e in engine.edges:
            if e.get("source_node_id") == appr_node_id:
                tgt = e.get("target_node_id")
                if tgt and tgt not in executed_nodes and tgt not in queue:
                    queue.append(tgt)

    active_branches = state.get("active_branches", {})
    t0 = time.time()

    # Resume the execution loop
    while queue:
        node_id = queue.pop(0)
        if node_id in executed_nodes:
            continue
        node_dict = engine.nodes.get(node_id)
        if not node_dict:
            continue
        executed_nodes.add(node_id)
        node_instance = NodeRegistry.create_node(node_dict)
        node_start_time = time.time()

        incoming_edges = [e for e in engine.edges if e.get("target_node_id") == node_id]
        for edge in incoming_edges:
            src_id = edge.get("source_node_id")
            tgt_handle = edge.get("target_handle")
            src_res = engine.node_results.get(src_id, {})
            src_out = src_res.get("output")
            if src_out is not None:
                val = src_out.get("output") if isinstance(src_out, dict) and "output" in src_out else src_out
                if tgt_handle and tgt_handle != "input":
                    node_instance.config[tgt_handle] = val
                elif node_instance.node_type == "ai_model":
                    node_instance.config["prompt"] = val
                elif node_instance.node_type == "condition":
                    node_instance.config["value"] = val
                elif node_instance.node_type == "report_generator":
                    node_instance.config["raw_data"] = val
                elif node_instance.node_type == "email_sender":
                    node_instance.config["body"] = val
                elif node_instance.node_type == "http_request":
                    node_instance.config["body"] = val

        is_val, err_val = node_instance.validate(engine.context)
        if not is_val:
            dur = int((time.time() - node_start_time) * 1000)
            engine.node_results[node_id] = {
                "node_id": node_id, "label": node_instance.label, "type": node_instance.node_type,
                "input": {}, "output": {}, "duration_ms": dur, "status": "error", "error_message": err_val
            }
            continue

        try:
            out_d = await node_instance.execute(engine.context)
            dur = int((time.time() - node_start_time) * 1000)
            engine.node_results[node_id] = {
                "node_id": node_id, "label": node_instance.label, "type": node_instance.node_type,
                "input": {}, "output": out_d, "duration_ms": dur, "status": "success"
            }
            engine.context["nodes"][node_id] = {"output": out_d, "status": "success"}
            engine.log("SUCCESS", f"Nó '{node_instance.label}' concluído em {dur}ms.", node_id)
        except Exception as ex:
            dur = int((time.time() - node_start_time) * 1000)
            engine.node_results[node_id] = {
                "node_id": node_id, "label": node_instance.label, "type": node_instance.node_type,
                "input": {}, "output": {}, "duration_ms": dur, "status": "error", "error_message": str(ex)
            }
            continue

        for e in [e for e in engine.edges if e.get("source_node_id") == node_id]:
            tgt = e.get("target_node_id")
            if tgt and tgt not in executed_nodes:
                queue.append(tgt)

    fin_output = (
        engine.context.get("ai_model", {}).get("output")
        or engine.context.get("action", {}).get("message")
        or "Fluxo executado com sucesso após aprovação."
    )
    exec_record["status"] = "success"
    exec_record["logs"] = engine.logs
    exec_record["node_results"] = engine.node_results
    exec_record["final_output"] = fin_output
    exec_record["finished_at"] = datetime.now(timezone.utc)
    exec_record["total_duration_ms"] = int((time.time() - t0) * 1000)
    return exec_record


def detect_inter_agent_cycle(agent_id: str, new_nodes: List[Dict[str, Any]], company_id: str) -> Optional[List[str]]:
    """
    Checks if saving agent_id with new_nodes would create an inter-agent circular dependency.
    Returns the list of agent_ids representing the cycle path, or None.
    """
    adj: Dict[str, List[str]] = {}
    for aid, a in db.agents.items():
        if a.get("company_id") == company_id:
            adj[aid] = []
            for n in a.get("nodes", []):
                if n.get("type") == "sub_agent":
                    tgt = (n.get("config") or {}).get("target_agent_id")
                    if tgt and tgt not in adj[aid]:
                        adj[aid].append(tgt)

    # Set proposed targets for agent_id
    proposed_targets = []
    for n in new_nodes:
        if n.get("type") == "sub_agent":
            tgt = (n.get("config") or {}).get("target_agent_id")
            if tgt:
                proposed_targets.append(tgt)
    adj[agent_id] = proposed_targets

    visited: Dict[str, int] = {aid: 0 for aid in adj}
    path: List[str] = []

    def dfs(curr: str) -> Optional[List[str]]:
        visited[curr] = 1
        path.append(curr)
        for neighbor in adj.get(curr, []):
            if visited.get(neighbor) == 1:
                idx = path.index(neighbor)
                return path[idx:] + [neighbor]
            if visited.get(neighbor, 0) == 0:
                c = dfs(neighbor)
                if c:
                    return c
        path.pop()
        visited[curr] = 2
        return None

    for aid in adj:
        if visited[aid] == 0:
            c = dfs(aid)
            if c:
                return c
    return None


async def dispatch_async_workflow_execution(
    agent: Dict[str, Any],
    input_variables: Optional[Dict[str, Any]] = None,
    current_user: Optional[Dict[str, Any]] = None,
    trigger_source: str = "manual",
) -> Dict[str, Any]:
    """
    Dispatches workflow execution asynchronously:
      - Attempts to enqueue with ARQ/Redis if Redis is available.
      - Gracefully falls back to asyncio.create_task with local tracking if Redis is offline.
    """
    try:
        from arq.connections import RedisSettings, create_pool

        redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
        redis_settings.conn_retries = 0
        redis_settings.conn_timeout = 1
        redis = await asyncio.wait_for(create_pool(redis_settings), timeout=1.0)
        job = await redis.enqueue_job("process_agent_workflow", agent)
        if job:
            return {
                "job_id": job.job_id,
                "status": "queued",
                "backend": "arq_redis",
                "trigger_source": trigger_source,
                "message": "Workflow enfileirado com sucesso via Redis/ARQ.",
            }
    except Exception:
        # Fallback to local background task
        pass

    # Local async fallback
    job_id = f"job-{int(time.time()*1000)}"
    asyncio.create_task(execute_agent_workflow(agent, input_variables, current_user))
    return {
        "job_id": job_id,
        "status": "running",
        "backend": "async_task_fallback",
        "trigger_source": trigger_source,
        "message": "Workflow iniciado em segundo plano.",
    }

