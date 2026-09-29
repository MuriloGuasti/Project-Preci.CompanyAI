from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    company_id: str
    full_name: str
    email: str
    role: str
    theme_preference: str = "dark"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Chat & Conversations ---
class MessageCreate(BaseModel):
    content: str
    attachments: Optional[List[Dict[str, Any]]] = []


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    attachments: Optional[List[Dict[str, Any]]] = []
    created_at: datetime
    is_interrupted: Optional[bool] = False


class ConversationCreate(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = "Nova conversa"
    ai_model: Optional[str] = "gemini-3.6-flash"


class ConversationResponse(BaseModel):
    id: str
    title: str
    ai_model: str
    created_at: datetime
    updated_at: datetime


class AIModelInfo(BaseModel):
    id: str
    provider: str
    display_name: str
    enabled: bool = True
    max_tokens: int = 4096


# --- Agents ---
class AgentNode(BaseModel):
    id: str
    type: str  # trigger, ai_model, condition, action, http_request
    label: str
    position: Dict[str, float]
    config: Optional[Dict[str, Any]] = {}


class AgentEdge(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    source_handle: Optional[str] = "output"
    target_handle: Optional[str] = None
    edge_type: Optional[str] = "default"  # "default" | "loop_back"


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: Optional[List[AgentNode]] = []
    edges: Optional[List[AgentEdge]] = []


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str = "draft"
    nodes: List[AgentNode] = []
    edges: List[AgentEdge] = []
    created_at: datetime
    updated_at: datetime


class AgentExecutionRequest(BaseModel):
    input_variables: Optional[Dict[str, Any]] = None


class AgentExecutionResponse(BaseModel):
    id: str
    agent_id: str
    status: str  # "running" | "success" | "error" | "waiting_approval" | "rejected"
    logs: List[Dict[str, Any]]
    node_results: Optional[Dict[str, Any]] = {}
    final_output: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
    total_duration_ms: Optional[int] = None
    parent_execution_id: Optional[str] = None
    approval_info: Optional[Dict[str, Any]] = None


class AgentScheduleCreate(BaseModel):
    cron_expression: str
    timezone: Optional[str] = "America/Sao_Paulo"
    is_active: Optional[bool] = True


class AgentScheduleResponse(BaseModel):
    id: str
    agent_id: str
    company_id: str
    cron_expression: str
    timezone: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: datetime
    created_by: str
    created_at: datetime


class ExecutionApprovalRequest(BaseModel):
    note: Optional[str] = None


class ExecutionRejectRequest(BaseModel):
    reason: Optional[str] = "Rejeitado pelo operador"


class GenerateWorkflowRequest(BaseModel):
    prompt: str
    mode: Optional[str] = "replace"  # "replace" or "append"


class GenerateWorkflowResponse(BaseModel):
    name: str
    description: str
    nodes: List[AgentNode]
    edges: List[AgentEdge]
    explanation: Optional[str] = None


# --- Documents ---
class DocumentFolderCreate(BaseModel):
    name: str
    parent_folder_id: Optional[str] = None


class DocumentFolderResponse(BaseModel):
    id: str
    name: str
    parent_folder_id: Optional[str] = None
    created_at: datetime


class DocumentUploadRequest(BaseModel):
    name: str
    file_type: Optional[str] = "application/pdf"
    file_size: Optional[int] = 0
    folder_id: Optional[str] = None
    content: Optional[str] = ""


class DocumentResponse(BaseModel):
    id: str
    name: str
    folder_id: Optional[str] = None
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = 0
    status: str = "ready"
    created_at: datetime
    updated_at: datetime
