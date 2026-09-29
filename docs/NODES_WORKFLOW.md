# 🧠 Documentação Técnica: Sistema de Nós & Workflow Engine (Preci Company)

Esta documentação detalha a arquitetura, o funcionamento técnico, o ciclo de vida dos nós e a experiência de usuário do sistema de workflows da **Preci Company**, projetado com a identidade visual minimalista monocromática corporativa, inputs embutidos nos cards e conexão direta entre portas e campos.

---

## 📑 Sumário

1. [Visão Geral & Filosofia de Design](#1-visão-geral--filosofia-de-design)
2. [Backend: Arquitetura & Motor de Execução (Python / FastAPI)](#2-backend-arquitetura--motor-de-execução)
   - [2.1 Ciclo de Vida do BaseNode](#21-ciclo-de-vida-do-basenode)
   - [2.2 Tipos de Nós Disponíveis](#22-tipos-de-nós-disponíveis)
   - [2.3 Conexão Direta entre Portas e Injeção de Valores](#23-conexão-direta-entre-portas-e-injeção-de-valores)
   - [2.4 WorkflowEngine: DAG, Detecção de Ciclos & Branching](#24-workflowengine-dag-detecção-de-ciclos--branching)
   - [2.5 Execução Assíncrona Desacoplada (ARQ / Redis)](#25-execução-assíncrona-desacoplada-arq--redis)
3. [Frontend: Canvas Interativo & Experiência Desktop OS (React / TypeScript)](#3-frontend-canvas-interativo--experiência-desktop-os)
   - [3.1 Cards Interativos com Inputs Embutidos (Largura 320px)](#31-cards-interativos-com-inputs-embutidos-largura-320px)
   - [3.2 Conexão Direta entre Portas e Cabos Bézier Dinâmicos](#32-conexão-direta-entre-portas-e-cabos-bézier-dinâmicos)
   - [3.3 Sistema de Seleção Múltipla com CTRL e Marquee Box](#33-sistema-de-seleção-múltipla-com-ctrl-e-marquee-box)
   - [3.4 Arraste em Grupo em Tempo Real (60 FPS com Aceleração GPU)](#34-arraste-em-grupo-em-tempo-real-60-fps)
   - [3.5 Sistema de Desfazer e Refazer (Undo / Redo Stack)](#35-sistema-de-desfazer-e-refazer-undo--redo-stack)
   - [3.6 Status de Execução & Animações Framer Motion (Ciclo de Vida e Exclusão)](#36-status-de-execução--animações-framer-motion)
   - [3.7 Edição Avançada: Modal de Configurações](#37-edição-avançada-modal-de-configurações)
   - [3.8 Assistente "Ajuda IA" (Gerador de Workflows com IA)](#38-assistente-ajuda-ia-gerador-de-workflows-com-ia)
   - [3.9 Padronização de Entradas Numéricas & Steppers (NumberInput)](#39-padronização-de-entradas-numéricas--steppers-numberinput)
4. [Tabela de Atalhos de Teclado do Canvas](#4-tabela-de-atalhos-de-teclado-do-canvas)
5. [Armazenamento & Sincronização de Estado (Zustand & Supabase)](#5-armazenamento--sincronização-de-estado)

---

## 1. Visão Geral & Filosofia de Design

O sistema de workflows da Preci Company transforma automações complexas com Inteligência Artificial em um grafo visual interativo (DAG). 

### Pilares Fundamentais:
- **Inputs Embutidos nos Cards**: Eliminação do atrito de abrir modais constantes. Textareas, selects e campos essenciais são manipulados diretamente na superfície do canvas.
- **Conexão Direta entre Portas (Handles)**: Cada campo conectável possui sua própria porta receptora. O nó de destino consome diretamente o que o cabo entregar, dispensando a necessidade de escrever expressões manuais.
- **Zero Dependências Pesadas de Canvas**: Construído com TypeScript nativo, React e SVG, garantindo máxima performance, leveza e total controle sobre cada elemento do DOM.
- **Sensação Desktop OS Fluida**: Interações de clique, caixa de seleção em bloco (`Marquee Selector`), arrasto com aceleração via hardware e atalhos universais idênticos aos de softwares profissionais de produtividade.
- **Segurança Rigorosa**: O parser de substituição e injeção de valores opera com tokenização determinística, **sem uso de `eval()`**, prevenindo qualquer risco de execução arbitrária.
- **Execução Híbrida**: Capacidade de rodar fluxos síncronos imediatos para resposta em tempo real, bem como delegar tarefas em background via Redis/ARQ.

---

## 2. Backend: Arquitetura & Motor de Execução

Arquivo principal: [`backend/app/services/agents/executor.py`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/backend/app/services/agents/executor.py)

### 2.1 Ciclo de Vida do `BaseNode`

Todos os nós do sistema herdam da classe abstrata `BaseNode`, implementando um ciclo de vida de duas etapas:

```python
class BaseNode(ABC):
    def __init__(self, node_id: str, label: str, config: Optional[Dict[str, Any]] = None):
        self.node_id = node_id
        self.label = label
        self.config = config or {}

    @abstractmethod
    def validate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Valida pré-requisitos, chaves obrigatórias e tipos antes da execução."""
        pass

    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Executa a lógica assíncrona do nó e retorna o dicionário com 'output' padronizado."""
        pass
```

### 2.2 Tipos de Nós Disponíveis

| Tipo | Classe | Função Técnica | Portas de Entrada (Campos) | Portas de Saída | Output Padronizado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `trigger` | `TriggerNode` | Ponto de partida do fluxo. Suporta acionamento **manual**, **webhook HTTP** ou **agendamento recorrente (cron)** com seletor visual em português. | *(Nenhum - nó inicial)* | `output` | `{"output": "...", "pergunta": "...", "mode": "manual"\|"webhook"\|"schedule"}` |
| `ai_model` | `AiModelNode` | Nó cognitivo inteligente executando modelos de IA (Gemini 3.6 Flash, Pro, etc.). | `prompt` | `output` | `{"output": "...", "model": "gemini-3.6-flash", "tokens": {...}}` |
| `rag` | `RagNode` | Busca Híbrida (pgvector + tsvector via RRF) e Reranking heurístico na base documental corporativa. | `query` | `output` | `{"output": "...", "query": "...", "found_count": 3, "search_mode": "hybrid"}` |
| `condition` | `ConditionNode` | Nó lógico de bifurcação (`if/else`) com operadores relacionais (`==`, `!=`, `>`, `<`, `contains`, `not_empty`). | `value` | `true`, `false` | `{"output": "true"/"false", "result": True/False}` |
| `loop` | `LoopNode` | Iterador controlado sobre coleções/arrays. Injeta `{{loop.item}}` e `{{loop.index}}` em cada ciclo. | `items` | `loop_body`, `loop_complete` | `{"output": [...], "collected": [...], "iterations_run": 5}` |
| `human_approval` | `HumanApprovalNode` | Pausa a execução do fluxo aguardando decisão humana via interface web ou API. | `input_data` | `approved`, `rejected` | `{"output": "...", "status": "approved"\|"rejected", "decision": {...}}` |
| `sub_agent` | `SubAgentNode` | Composição hierárquica: dispara outro agente salvo como etapa modular do fluxo atual. | `input_data` | `output` | `{"output": "...", "sub_agent_id": "...", "duration_ms": 320}` |
| `report_generator` | `ReportGeneratorNode` | Converte dados em relatórios HTML corporativos monocromáticos elegantes (`executive` e `minimal`). | `raw_data` | `output` | `{"output": "<html>...", "html": "...", "title": "..."}` |
| `email_sender` | `EmailSenderNode` | Disparo corporativo de e-mails via SMTP com suporte a HTML e sandbox seguro de simulação. | `to`, `body` | `output` | `{"output": "E-mail enviado...", "sent": True, "to": "..."}` |
| `http_request` | `HttpRequestNode` | Requisições REST externas (GET, POST, PUT, DELETE) com payload dinâmico. | `body` | `output` | `{"output": "...", "status_code": 200, "response": {...}}` |
| `action` | `ActionNotificationNode` | Notificações corporativas em canais como Slack, Discord ou Webhooks. | `message` | `output` | `{"output": "...", "dispatched": True, "channel": "#..."}` |

#### 2.2.1 Especificação do Nó RAG: Hybrid Search & Reranking
O `RagNode` emprega arquitetura de recuperação híbrida para máxima precisão:
- **Busca Híbrida (pgvector + tsvector)**: Executa simultaneamente a busca por similaridade vetorial de cosseno e a busca full-text nativa do PostgreSQL via `tsvector` com dicionário em português.
- **Fusão Reciprocal Rank Fusion (RRF, k=60)**: Combina as duas classificações sem distorções de escala ($RRF = \sum 1 / (60 + rank)$).
- **Reranking Heurístico Pós-Busca**:
  - Boost de +0.15 para matches exatos de identificadores, códigos (ex: `CLI-98234-XP`) ou nomes de clientes.
  - Boost de recência de até +0.10 com decaimento exponencial (meia-vida de 90 dias).
- **Telemetria**: Retorna `"search_mode": "hybrid"`, `"found_count"`, `"chunks"`, `"context_text"` e `"output"` mantendo total compatibilidade com nós a jusante.

#### 2.2.2 Especificação do Nó Loop (`LoopNode`)
- **Funcionamento**: Recebe uma lista de dados (JSON array) e itera sobre cada elemento, executando o subgrafo conectado à porta `loop_body`.
- **Portas de Saída**:
  - `loop_body`: Acionada a cada ciclo, alimentando o primeiro nó do processamento iterativo.
  - `loop_complete`: Disparada após a conclusão de todas as iterações, dando continuidade ao restante do DAG.
- **Conexão de Retorno (`loop_back`)**: A aresta que fecha o ciclo de repetição para o `LoopNode` recebe `edge_type="loop_back"` e é renderizada com linha tracejada âmbar (`#F59E0B`). O algoritmo de detecção de ciclos DAG (`detect_cycles`) ignora arestas com esse tipo, permitindo a iteração sem falsos positivos de ciclo infinito.
- **Variáveis de Contexto Injetadas**: A cada ciclo, disponibiliza `{{loop.item}}` (item atual) e `{{loop.index}}` (índice 0-based).
- **Estratégias de Coleta (`collect_strategy`)**:
  - `append`: Acumula a saída de todos os ciclos em uma lista JSON.
  - `last`: Retorna exclusivamente a saída do último ciclo executado.
- **Limite de Segurança**: Limite configurável no modal via componente `NumberInput` de até 50 iterações por execução.

#### 2.2.3 Especificação do Nó de Aprovação Humana (`HumanApprovalNode`)
- **Pausa de Execução**: Ao ser alcançado, o motor suspende o fluxo, serializa o estado atual (`workflow_state`) na tabela de execuções e altera o status para `waiting_approval`.
- **Portas de Saída**:
  - `approved`: Ramo acionado quando um administrador/proprietário autoriza a continuidade.
  - `rejected`: Ramo acionado caso a solicitação seja reprovada.
- **Endpoints de Retomada**:
  - `POST /api/v1/executions/{id}/approve`
  - `POST /api/v1/executions/{id}/reject`
- **Controle de Timeout**: Tempo limite configurável em horas (padrão 24h, máx. 72h). Ao expirar, aplica automaticamente a ação de contingência configurada (`auto_reject` ou `auto_approve`).

#### 2.2.4 Especificação do Nó Sub-Agent (`SubAgentNode`)
- **Composição Modular**: Permite reaproveitar agentes existentes como etapas encapsuladas de um fluxo maior.
- **Proteção contra Recursão**: Rastreia a árvore de chamadas e impede referências circulares ou auto-invocação com limite estrito de profundidade máxima de 3 níveis (`depth > 3`).
- **Passagem de Parâmetros**: Recebe o payload do nó antecessor e o mapeia para a pergunta/entrada inicial do sub-agente.

#### 2.2.5 Disparo Agendado (Schedule Trigger) & Seletor Visual Amigável
- **Interface Amigável para Leigos ([ScheduleTimePicker.tsx](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/components/agents/ScheduleTimePicker.tsx))**:
  - Remove a complexidade de expressões Unix Cron brutas (`0 * * * *`).
  - Tradução em tempo real para português claro: *"Todos os dias às 09:00"*, *"A cada 15 minutos, continuamente"*, *"De segunda a sexta-feira às 08:00"*.
  - Abas visuais de configuração:
    1. **Intervalo Frequente**: Opções rápidas de 15min, 30min, 1h, 2h, 4h, 6h, 12h, 24h.
    2. **Diariamente**: Seletores de horário e botões de atalho comercial (08:00, 09:00, 12:00, 18:00, 23:00).
    3. **Dias da Semana**: Botões interativos de dias (Seg a Dom) + atalho "Seg a Sex".
    4. **Mensalmente**: Dia do mês (1º ao 31º) com horário programado.
  - Painel retrátil avançado para desenvolvedores inspecionarem e editarem o formato unix de 5 campos.
- **Motor de Execução do Agendador**:
  - **In-Memory Tick**: Executado diretamente no ciclo de vida (`lifespan`) do FastAPI via `start_in_memory_scheduler(interval_seconds=60)`.
  - **Worker Tick (ARQ/Redis)**: Em produção distribuída, executa periodicamente via worker assíncrono.
  - **Trava de Segurança**: Intervalo mínimo obrigatório de 5 minutos entre disparos (`croniter`) para proteção de cota e recursos.

---

### 2.3 Conexão Direta entre Portas e Injeção de Valores

O fluxo de dados entre nós ocorre primordialmente por **passagem direta de valores via cabos**:

1. **Schema com Handles ([`schemas.py`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/backend/app/models/schemas.py))**:
   As conexões (`AgentEdge`) armazenam `source_handle` (padrão: `"output"`, ou `"true"`/`"false"` em condicionais) e `target_handle` (o campo exato de destino no nó receptor, ex: `"prompt"`, `"query"`, `"raw_data"`, `"body"`, `"to"`, `"message"`).
2. **Injeção Pré-Execução no `WorkflowEngine.run()`**:
   Antes de executar cada nó, o motor localiza todas as arestas conectadas que chegam a ele (`target_node_id == node_id`).
   - Obtém a saída do nó emissor (`self.node_results[src_id]["output"]`).
   - Injeta o valor diretamente na configuração do nó receptor:
     ```python
     node_instance.config[edge.target_handle] = val_to_inject
     ```
   - Dessa forma, o nó receptor consome automaticamente o conteúdo entregue pelo cabo, sem intervenção manual.
3. **Motor de Interpolação Seguro como Fallback**:
   Para campos com texto fixo contendo marcações de fallback (`interpolate_text`), o sistema mantém total retrocompatibilidade com sintaxes como `{{ trigger.pergunta }}` e `{{ ai_model.output }}` de forma determinística e com zero `eval()`.

---

### 2.4 `WorkflowEngine`: DAG, Detecção de Ciclos & Branching

A orquestração do fluxo segue rigorosamente o modelo de grafo acíclico dirigido (DAG):

1. **Validação de Ciclos (`detect_cycles`)**:
   - Utiliza busca em profundidade (DFS) com coloração tricolor. Se detectar um loop infinito no grafo, a execução é interrompida preventivamente antes de consumir recursos, reportando os nós conflitantes.
2. **Fila Topológica e Dependências**:
   - Mapeia nós com grau de entrada zero (ou tipo `trigger`) e programa os nós sucessores conforme suas dependências forem resolvidas com sucesso.
3. **Ramificação Condicional (`active_branches`)**:
   - Ao executar um `ConditionNode`, o motor avalia a expressão e seleciona o ramo ativo (`"true"` ou `"false"`).
   - Apenas os nós conectados à porta correspondente são enfileirados para execução, enquanto o caminho alternativo é podado com precisão.
4. **Telemetria Estruturada**:
   - Cada nó registra seu tempo de execução em milissegundos (`duration_ms`), status (`success` ou `error`), snapshot de entradas e histórico de logs cronológicos.

---

### 2.5 Execução Assíncrona Desacoplada (ARQ / Redis & Fallback Local)

Para automações corporativas de maior porte, fluxos agendados ou lotes de processamento:
- **Estratégia de Duas Camadas**:
  1. **Fila Corporativa Distribuída (ARQ + Redis)**: Em ambientes com Redis configurado, o método `dispatch_async_workflow_execution` enfileira a execução usando ARQ (`enqueue_job`). Isso confere alta escalabilidade, tolerância a falhas e desacoplamento total da API HTTP.
  2. **Fallback Local Instantâneo (`asyncio.create_task`)**: Se o Redis estiver inativo (cenário comum em desenvolvimento local no Windows sem Docker), a verificação rápida (`conn_timeout=1`, `conn_retries=0`) detecta a indisponibilidade em menos de 1 segundo e despacha o fluxo diretamente na memória assíncrona do Python, garantindo que o desenvolvedor execute e teste tudo normalmente.
- **Agendador em Tempo Real (In-Memory Scheduler)**:
  - Inicializado automaticamente no `lifespan` do FastAPI (`start_in_memory_scheduler(interval_seconds=60)`), realiza a checagem contínua de agendamentos pendentes da tabela `agent_schedules` a cada minuto, disparando as execuções devidas.

---

## 3. Frontend: Canvas Interativo & Experiência Desktop OS

Arquivos principais:
- [`frontend/src/components/agents/WorkflowCanvas.tsx`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/components/agents/WorkflowCanvas.tsx)
- [`frontend/src/stores/agentStore.ts`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/stores/agentStore.ts)
- [`frontend/src/components/agents/NodeConfigModal.tsx`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/components/agents/NodeConfigModal.tsx)

### 3.1 Cards Interativos com Inputs Embutidos (Largura 320px)

Os cards dos nós possuem largura confortável de **320px** e integram seus formulários essenciais diretamente na superfície do canvas:

- **Edição em Tempo Real**: Textareas, campos de texto e selects podem ser digitados ou selecionados diretamente. As alterações são sincronizadas imediatamente com o store e com o backend via debounce.
- **Isolamento de Eventos**: Todos os campos do card implementam `stopPropagation()` nos eventos de mouse e teclado. O usuário pode clicar, selecionar texto, pressionar espaço, `Backspace` e `Delete` normalmente, sem mover o canvas ou excluir nós acidentalmente.
- **Título Editável no Card**: Clicar no título do nó permite renomeá-lo diretamente no próprio card.

---

### 3.2 Conexão Direta entre Portas e Cabos Bézier Dinâmicos

- **Portas Específicas por Campo**:
  - Cada campo receptor (como o prompt da IA, a query do RAG, os dados do relatório ou o corpo do e-mail) possui uma bolinha (porta) à esquerda.
  - A porta de saída de cada nó fica localizada à direita do cabeçalho.
  - No caso de nós condicionais, há duas portas de saída à direita: **Verdadeiro** (verde) e **Falso** (neutro).
- **Cabo Dinâmico Interativo**:
  - Ao clicar em uma porta de saída, um cabo Bézier suave acompanha a movimentação do cursor em tempo real, enquanto as portas de entrada receptoras pulsam suavemente.
  - Clicar na porta de destino completa a ligação instantaneamente.
- **Badge Visual de Campo Conectado**:
  - Quando um campo recebe um cabo, o input tradicional é substituído por um badge estilizado:
    `⚡ Origem: [Nome do Nó]`
  - O badge inclui um botão `✕` para desconectar a entrada em 1 clique, restaurando imediatamente o campo editável.
- **Curvas Bézier Precisas**:
  - Os cabos SVG calculam com precisão matemática a coordenada vertical (Y) de cada porta específica dentro do card receptor.

---

### 3.3 Sistema de Seleção Múltipla com CTRL e Marquee Box

O canvas reproduz fielmente as interações de sistemas operacionais de desktop:

1. **Clique Simples**:
   - Seleciona apenas o nó clicado, desselecionando os demais.
2. **`Ctrl + Clique` (ou Cmd / Shift)**:
   - Alterna a seleção individual do nó sem desmarcar os outros.
3. **Seleção em Bloco (`Marquee Box`)**:
   - Clicar e arrastar no fundo do canvas desenha a caixa de seleção retangular translúcida.
   - Segurar `Ctrl` ao arrastar soma novos nós à seleção existente.
4. **Floating Selection Badge**:
   - Distintivo flutuante que exibe a contagem de nós selecionados e botão para exclusão em lote.

---

### 3.4 Arraste em Grupo em Tempo Real (60 FPS)

- **Aceleração por Hardware**:
  Nós renderizados com `transform: translate3d(...)` e `willChange: 'transform'`, eliminando reflows do navegador.
- **Movimentação Sincronizada**:
  Ao arrastar qualquer um dos nós selecionados, todo o grupo se desloca simultaneamente com física fluida via `requestAnimationFrame`.

---

### 3.5 Sistema de Desfazer e Refazer (Undo / Redo Stack)

- **Snapshot de Estado**:
  Antes de qualquer ação (criação, movimentação, exclusão ou conexão de nós), o estado de `{ nodes, edges }` é registrado no histórico.
- **Atalhos Globais**:
  - `Ctrl + Z`: Desfaz a última ação.
  - `Ctrl + Y` ou `Ctrl + Shift + Z`: Refaz a ação desfeita.
- **Controles no Canvas**:
  Pílula no canto inferior esquerdo com botões dedicados ao lado do zoom.

---

### 3.6 Status de Execução & Animações Framer Motion (Ciclo de Vida e Exclusão)

Durante o teste do fluxo no modal ou via execução direta, cada nó reflete seu progresso em tempo real:

| Status | Feedback Visual no Card | Significado |
| :--- | :--- | :--- |
| `idle` | Borda neutra sutil | Nó aguardando processamento. |
| `running` | Anel verde esmeralda pulsante + spinner giratório | Nó em execução ativa. |
| `success` | Borda verde destacada + check + tempo em ms | Executado com sucesso. |
| `error` | Anel vermelho de alerta + ícone de falha | Erro na validação ou execução. |

#### Animação Suave de Exclusão de Nós (`<AnimatePresence>`):
Ao remover um nó (tecla `Delete`, lixeira do card, exclusão em massa ou pelo modal de configurações):
- O loop de nós é protegido por `<AnimatePresence>`.
- **Camada Externa (`motion.div`)**: Gerencia o posicionamento em tela (`translate3d(x, y, 0)`) e anima apenas a opacidade (`opacity: 1 ➔ 0`) em 200ms (`ease: [0.16, 1, 0.3, 1]`). Isso isola as coordenadas GPU e impede que a animação desloque o elemento para a origem do canvas.
- **Camada Interna (`motion.div`)**: Aplica a dissolução tátil do card com contração (`scale: 1.0 ➔ 0.88`), leve subida (`y: -6px`) e desfoque suave (`blur: 3px`).

---

### 3.7 Edição Avançada: Modal de Configurações

Embora os campos essenciais estejam embutidos no próprio card, o modal completo permanece disponível para parâmetros detalhados:
- **Atalhos de Abertura**: Pressionar **`F`** com o nó selecionado, **clique duplo** sobre o card ou clicar no ícone de engrenagem.
- Permite configurar cabeçalhos HTTP avançados, timeouts, credenciais SMTP customizadas e inspeção profunda de payloads.
- **Painel de Conexões de Entrada e Saída**: Lista todos os cabos ligados ao nó, identificando nós de origem/destino e permitindo desconexões imediatas.

---

### 3.8 Assistente "Ajuda IA" (Gerador de Workflows com IA)

Localizado no cabeçalho superior direito do canvas:
- **Drawer Lateral Direito ([`AiWorkflowDrawer.tsx`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/components/agents/AiWorkflowDrawer.tsx))**:
  - Criação de workflows completos a partir de instruções em linguagem natural (`Ctrl + Enter`).
  - Modos **Substituir Fluxo** ou **Adicionar ao Fluxo** (com cálculo automático de offset horizontal para evitar sobreposição).
- **Motor Híbrido com Zero Cota ([`generator.py`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/backend/app/services/agents/generator.py))**:
  - Geração inteligente via Gemini Flash com fallback local determinístico de cota zero.
  - As arestas geradas já nascem com conexões explícitas entre portas (`source_handle` e `target_handle`).

---

### 3.9 Padronização de Entradas Numéricas & Steppers (NumberInput)

Para manter a consistência estética do design system monocromático da Preci Company:
- Todos os campos numéricos utilizam o componente [`NumberInput.tsx`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/components/common/NumberInput.tsx), eliminando os controles nativos do browser com caixas brancas.
- **Variante `chevrons`**:
  - Utilizada no campo **Timeout (segundos)** do nó de Requisição HTTP e na **Porta** do nó de Envio de E-mail.
  - Inclui setas verticais minimalistas com suporte a aceleração gradual ao manter pressionado (*press & hold*).
- **Variante `stepper`**:
  - Utilizada diretamente na superfície do card de Busca Documental RAG para seleção de **Documentos (Top K)**, dispondo botões circulares `-` e `+` ao redor do valor central.

---

## 4. Tabela de Atalhos de Teclado do Canvas

| Atalho | Ação |
| :--- | :--- |
| **`Ctrl + Clique`** (ou `Cmd / Shift`) | Adiciona / remove nó da seleção múltipla. |
| **`Arrastar no Canvas`** | Seleciona nós em bloco com a caixa de seleção (`Marquee Box`). |
| **`Ctrl + Arrastar no Canvas`** | Soma nós em bloco à seleção existente. |
| **`Ctrl + A`** | Seleciona **todos** os nós do workflow ativo. |
| **`Delete`** ou **`Backspace`** | Exclui todos os nós selecionados simultaneamente. |
| **`Ctrl + Z`** | **Desfazer (Undo)**: Desfaz a última alteração no fluxo. |
| **`Ctrl + Y`** ou **`Ctrl + Shift + Z`** | **Refazer (Redo)**: Reaplica a última alteração desfeita. |
| **`F`** ou **`Clique Duplo`** | Abre o modal de configurações avançadas do nó selecionado. |
| **`Esc`** | Cancela conexões ativas de cabos ou desmarca a seleção atual. |
| **`Ctrl + Wheel`** | Zoom In / Zoom Out suave centralizado no cursor. |
| **`Ctrl + +`** / **`Ctrl + -`** | Aumenta / diminui o nível de zoom. |
| **`Ctrl + 0`** | Redefine o zoom para 100%. |

---

## 5. Armazenamento & Sincronização de Estado

A persistência do estado dos workflows é orquestrada pela store Zustand [`agentStore.ts`](file:///c:/Users/muril/OneDrive/Área%20de%20Trabalho/preci.%20company/frontend/src/stores/agentStore.ts):

1. **Isolamento por Usuário**:
   - Chave única de usuário autenticado no `localStorage` (`preci_agents_${userId}`), garantindo privacidade total.
2. **Sincronização em Nuvem (Supabase + FastAPI)**:
   - Mudanças estruturais (nós, arestas e configurações) sincronizam via `PUT /api/v1/agents/{agent_id}`.
   - Posicionamento com debounce para economizar requisições e garantir taxa de quadros estável.
3. **Histórico em Memória**:
   - Pilhas de até 50 passos por agente ativo, suportando desfazer e refazer contínuos com retenção total de integridade.

---

> **Status da Plataforma**: Sistema 100% funcional, verificado com tipagem TypeScript estrita (`tsc --noEmit` sem erros), sintaxe Python validada e alinhado aos padrões visuais corporativos da Preci Company.
