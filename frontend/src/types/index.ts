export interface User {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: string;
  theme_preference: 'dark' | 'light';
}

export interface AIModel {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  max_tokens: number;
}

export interface MessageAttachment {
  name: string;
  size: number;
  type: string;
  url?: string;
  data?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: MessageAttachment[];
  created_at: string;
  is_interrupted?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  ai_model: string;
  created_at: string;
  updated_at: string;
}

export type NodeExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting_approval';

export type AgentNodeType =
  | 'trigger'
  | 'ai_model'
  | 'rag'
  | 'condition'
  | 'http_request'
  | 'action'
  | 'report_generator'
  | 'email_sender'
  | 'loop'
  | 'human_approval'
  | 'sub_agent';

export interface ReportGeneratorConfig {
  title: string;
  raw_data: string;
  style: 'executive' | 'minimal';
}

export interface EmailSenderConfig {
  to: string;
  subject: string;
  body: string;
  is_html: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
}

export interface AgentNode {
  id: string;
  type: AgentNodeType;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

export interface AgentEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string;
  target_handle?: string;
  edge_type?: 'default' | 'loop_back' | string;
}

export interface AgentSchedule {
  id: string;
  agent_id: string;
  company_id: string;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at: string;
  created_by: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'inactive';
  nodes: AgentNode[];
  edges: AgentEdge[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionLog {
  timestamp: string;
  level: string;
  message: string;
  node_id?: string | null;
}

export interface NodeExecutionResult {
  node_id: string;
  label: string;
  type: string;
  input: Record<string, any>;
  output: Record<string, any>;
  duration_ms: number;
  status: NodeExecutionStatus;
  error_message?: string;
}

export interface AgentExecutionResult {
  id: string;
  agent_id: string;
  status: string;
  logs: ExecutionLog[];
  node_results?: Record<string, NodeExecutionResult>;
  node_statuses?: Record<string, NodeExecutionStatus>;
  final_output?: string | null;
  started_at: string;
  finished_at?: string | null;
  total_duration_ms?: number;
  parent_execution_id?: string | null;
  approval_info?: {
    execution_id: string;
    node_id: string;
    message?: string;
    assigned_roles?: string[];
    timeout_hours?: number;
    on_timeout_action?: string;
  } | null;
}

export interface DocumentFolder {
  id: string;
  name: string;
  parent_folder_id?: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  folder_id?: string | null;
  file_path: string;
  file_type?: string;
  file_size?: number;
  status: 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export type ActiveTab = 'chats' | 'agents' | 'documents';
