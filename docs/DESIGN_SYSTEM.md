# Design System & Especificação Técnica de UI/UX — preci.

Este documento detalha as decisões técnicas, fundamentos visuais, fórmulas matemáticas, paletas de cor, tipografia e regras de componentes que compõem a identidade visual da plataforma **preci.**

---

## 1. Filosofia de Design & Diretrizes de Marca

### 1.1 "Precisão que move o seu negócio"
A interface da **preci.** foi desenhada para transmitir sobriedade corporativa, clareza cognitiva e elegância funcional. Rejeitamos elementos puramente ornamentais ou distrações visuais; cada transição, sombra, borda e espaçamento possui um propósito operacional bem definido.

### 1.2 Grafia Oficial da Marca
- **Representação Textual**: `preci.`
- **Regras Estritas**:
  - Sempre grafada em **letras minúsculas**.
  - Sempre acompanhada do **ponto final imediato (`.`)**, simbolizando precisão, conclusão e assertividade.
  - Variação tipográfica: **Satoshi Semi-bold** (peso 600).

### 1.3 Conceito Autoral do Símbolo: A Rampa Ascendente (Illustrator & Photoshop)
- **Criação do Zero pelo Autor**: Identidade visual completa, nome e peças gráficas concebidos autoralmente no **Adobe Illustrator** e **Adobe Photoshop**.
- **Visão Frontal & Futuro**: Uma perspectiva tridimensional que direciona o olhar para a frente, antecipando cenários estratégicos.
- **Rampa que Leva para Cima (Escalabilidade)**: O plano ascendente simboliza o movimento de **escalonar o negócio**, acelerar a maturidade operacional e alavancar resultados continuamente com Inteligência Artificial.
- **Precisão nas Decisões**: Linhas geométricas puras e convergência angular que traduzem a segurança e a exatidão que a plataforma proporciona aos líderes em suas escolhas corporativas.

---

## 2. Escolha e Arquitetura de Logotipos

O sistema de identidade visual prevê dois formatos complementares de logotipo, gerenciados pelo componente dinâmico [PreciLogo.tsx](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/components/common/PreciLogo.tsx):

```
                       ┌─────────────────────────┐
                       │     useThemeStore()     │
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [ Dark Theme Mode ]                  [ Light Theme Mode ]
  ┌───────────────────────────────┐   ┌───────────────────────────────┐
  │ Icon: /assets/IconLight.png   │   │ Icon: /assets/IconDark.png    │
  │ Logo: PreciLogomarcaLight.png │   │ Logo: PreciLogomarcaBlack.png │
  └───────────────────────────────┘   └───────────────────────────────┘
```

### 2.1 Variantes de Exibição
1. **`variant="logomarca"`** (Logo Completa):
   - Combina o símbolo icônico com a tipografia estilizada da marca `preci.`.
   - Utilizada em pontos estratégicos de branding: cabeçalho translúcido da **Tela de Login** e cabeçalho expansível do **Menu Lateral**.
   - Dimensões padrão: `height={24}` ou `height={28}`, mantendo proporção de aspecto `width: auto`.
2. **`variant="icon"`** (Símbolo / Ícone Isolado):
   - Utilizado em espaços de alta densidade funcional:
     - Avatar do assistente IA nas bolhas de chat (`ChatMessageList.tsx`), encapsulado em uma pílula circular de `28x28px`.
     - Favicon e indicador minimalista da Sidebar quando em modo recolhido (`64px`).
   - Dimensões padrão: `height={16}` a `height={24}` com proporção 1:1 (`object-contain`).

---

## 3. Tipografia & Hierarquia Textual

A família tipográfica escolhida como padrão absoluto do ecossistema é a **Satoshi**, uma fonte neo-grotesca moderna que equilibra rigidez geométrica com alta legibilidade em telas de alta densidade de pixels (Retina/OLED).

```css
body {
  font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### 3.1 Escala Tipográfica de Aplicação
| Nível / Papel | Classes Tailwind | Peso / Leading | Uso na Plataforma |
|---|---|---|---|
| **Display Hero** | `text-3xl tracking-tight` | Semi-bold (600) / `leading-tight` | Saudação inicial da tela de chat (*"Olá, Murilo"*) |
| **H1 (Título de Página)** | `text-xl` | Medium (500) / `leading-snug` | Títulos principais de seções e modais |
| **H2 (Subtítulo)** | `text-base` | Medium (500) / `leading-normal` | Cabeçalhos de pastas e seções da sidebar |
| **Body (Corpo de Texto)** | `text-sm` | Regular (400) / `leading-relaxed` | Mensagens de chat, inputs e listagens |
| **UI Labels & Botões** | `text-xs font-medium` | Medium (500) / `leading-none` | Botões de ação, chips e cabeçalhos de tabela |
| **Metadados & Legendas** | `text-[11px]` ou `text-[10px]` | Regular (400) / `leading-tight` | Timestamps, avisos de atalho e tamanhos de arquivo |

---

## 4. Paleta de Cores & Tokens de Superfície

O ecossistema opera em **Modo Duplo Nativo (Dark & Light)**, priorizando pretos profundos com nuances de cinza neutro no Dark Mode e superfícies quentes e limpas no Light Mode, atingindo contraste estrito em conformidade com as diretrizes **WCAG AAA**.

### 4.1 Tabela de Tokens de Cor
```
Cor / Token           Dark Mode                  Light Mode
──────────────────────────────────────────────────────────────────
Canvas Principal      #131313                    #EFEFEF
Superfície / Cards    #171717 / #1E1E1E          #F5F5F5 / #FFFFFF
Texto Primário        #F5F5F5 / #FFFFFF          #171717 / #0A0A0A
Texto Secundário      #A3A3A3 / #737373          #525252 / #737373
Bordas Primárias      #2E2E2E (border-neutral-800) #E5E5E5 (border-neutral-300)
Superfície de Hover   #262626 (bg-neutral-800/60)  #E8E8E8 (bg-neutral-200/70)
Acento de Alerta      #F59E0B (amber-500)        #D97706 (amber-600)
```

### 4.2 Ausência de Cores Estridentes
Não são utilizados tons saturados aleatórios (azul puro, vermelho neon, verde elétrico). Os destaques são neutros invertidos:
- No **Light Mode**: O botão primário de envio/ação é preto sólido (`#171717`), oferecendo máxima ênfase visual.
- No **Dark Mode**: O botão primário de envio/ação é branco/cinza claro (`#FFFFFF`), destacando-se na escuridão.

---

## 5. Engenharia Visual: Canvas Halftone Animado

Implementado em [HalftoneCanvas.tsx](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/components/auth/HalftoneCanvas.tsx), o fundo da tela de login renderiza um padrão halftone vetorial interativo em tempo real via HTML5 `<canvas>` a 60 frames por segundo.

```
       Top-Right (width, 0)
            ▲      /
           /      /   Frente de onda diagonal
          /      /    senoidal contínua
         /      /
        /      ▼
  Bottom-Left (0, height) ───► Repulsão Física no Cursor do Mouse
```

### 5.1 Fórmulas Matemáticas do Halftone

1. **Projeção Diagonal**:
   Para cada ponto da malha $(x_i, y_j)$ com espaçamento constante ($S = 22\text{px}$):
   $$d_1 = x_i + (H - y_j)$$
   $$d_2 = 0.85 \cdot x_i + 1.15 \cdot (H - y_j)$$

2. **Ondas Senoidais Superpostas**:
   Dois harmônicos viajam da base inferior esquerda para o topo superior direito ao longo do tempo $t$:
   $$w_1 = \sin(d_1 \cdot 0.008 - 1.4 \cdot t)$$
   $$w_2 = \sin(d_2 \cdot 0.014 - 1.8 \cdot t + 0.8)$$
   $$W_{\text{combinada}} = 0.7 \cdot w_1 + 0.3 \cdot w_2 \quad \in [-1, 1]$$
   $$\text{Fator de Onda } F = \frac{W_{\text{combinada}} + 1}{2} \quad \in [0, 1]$$

3. **Respiração do Raio e Opacidade**:
   $$R = 0.9 + 1.8 \cdot F \quad (\text{raio varia entre } 0.9\text{px} \text{ e } 2.7\text{px})$$
   $$\alpha = \alpha_{\min} + F \cdot (\alpha_{\max} - \alpha_{\min})$$

4. **Repulsão Geométrica ao Mouse**:
   Quando o cursor do mouse está ativo nas coordenadas $(M_x, M_y)$:
   $$\Delta x = M_x - x_i, \quad \Delta y = M_y - y_j$$
   $$\text{dist} = \sqrt{\Delta x^2 + \Delta y^2}$$
   Se $\text{dist} < R_{\text{mouse}}$ ($140\text{px}$):
   $$\text{Força } K = 1 - \frac{\text{dist}}{R_{\text{mouse}}}$$
   $$\theta = \text{atan2}(\Delta y, \Delta x)$$
   $$x_{\text{final}} = x_i - \cos(\theta) \cdot (K \cdot 26\text{px})$$
   $$y_{\text{final}} = y_j - \sin(\theta) \cdot (K \cdot 26\text{px})$$
   O ponto sofre deslocamento elástico e tem seu raio e brilho aumentados temporariamente, restaurando-se suavemente à malha conforme o mouse se afasta.

---

## 6. Físicas de Movimento & Transições de Interface

### 6.1 Transição de Mola do Campo de Chat (Framer Motion)
No [ChatInput.tsx](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/components/chat/ChatInput.tsx), a transição entre o estado de boas-vindas (centro da tela) e a posição de conversa ativa (rodapé definitivo) não utiliza saltos abruptos. É governada pelo `layoutId="chat-input-bar"` com parâmetros de física de mola calibrados:
- **`stiffness: 260`**: Resposta firme sem oscilação excessiva.
- **`damping: 28`**: Amortecimento que elimina trepidação e produz desaceleração natural.

### 6.2 Glassmorphism & Desfoque de Fundo
Em superfícies flutuantes (header translúcido da tela de login, pop-up de preview de documentos e drawers):
```css
.header-glass {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(245, 245, 245, 0.85); /* Light */
}
.dark .header-glass {
  background: rgba(23, 23, 23, 0.80);    /* Dark */
}
```

### 6.3 Scrollbar Ultrafina Minimalista (6px)
Projetada para não poluir visualmente listagens extensas de conversas, arquivos ou agentes:
```css
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.25) transparent;
}
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.25);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 120, 120, 0.45);
}
```

---

## 7. Diretriz Estrita de Ícones (Zero Emojis)

- **Regra Fundamental**: A interface é **100% livre de emojis**.
- Toda sinalização de estado, pastas, arquivos, modelos de inteligência artificial e ações utiliza ícones vetoriais modernos da biblioteca **Lucide React**.
- **Padronização de Stroke**:
  - Ações e botões: `stroke-width: 2px` ou `stroke-width: 2.5px`.
  - Ícones de navegação e status: `stroke-width: 1.5px` a `1.75px`.

---

## 8. Componentes Específicos & Ergonomia Visual

### 8.1 Botão Duplo de Envio / Parar (Princípio da Permanência Espacial)
No input de digitação, quando a IA inicia o streaming de resposta, o botão de envio (`ArrowUp`) transforma-se instantaneamente no botão de interrupção (`Square`).
- **Por que a mesma posição?**: O usuário não precisa mover o cursor ou procurar um botão secundário para interromper a geração. O mesmo ponto de foco serve para disparar ou pausar a operação.

### 8.2 Card Visual de Interrupção no Lado da LLM
Quando o fluxo é interrompido:
- A bolha do assistente à esquerda preserva o texto parcial emitido com formatação Markdown intacta.
- Um divisor fino horizontal (`border-t border-neutral-200 dark:border-neutral-800`) separa o texto da notificação:
  - Mini-ícone `Square` com preenchimento sutil âmbar (`fill-amber-500/80`).
  - Tipografia em itálico de tom neutro: *"Envio de mensagem interrompida pelo Usuário"*.

### 8.3 Sidebar com Alturas Dinâmicas
- **Conversas**: Altura livre até 10 itens; a partir do 11º item, o container ganha rolagem vertical independente com teto fixo em `max-h-[302px]`.
- **Agentes**: Altura livre até 5 itens; a partir do 6º item, ativa rolagem vertical com teto fixo em `max-h-[152px]`.
- **Proteção dos Documentos**: O botão de Documentos no rodapé possui `shrink-0`, garantindo que nunca seja ocultado pela expansão das listas superiores.

### 8.4 Pop-up de Preview de Documentos
- O clique em qualquer linha de documento apenas destaca a linha para foco.
- O Pop-up translúcido de Preview Rápido só é disparado ao clicar deliberadamente no ícone de Olho (`Eye`), evitando aberturas acidentais que interrompam o fluxo de trabalho do usuário.

### 8.5 Pop-up de Configuração de Nós de Agentes (Manipulação Direta e Feedback Imediato)
- **Princípio da Manipulação Direta**: No ecossistema de automação visual, o usuário não precisa recorrer a painéis laterais distantes. Clicar diretamente sobre qualquer nó no Canvas (ou no ícone de engrenagem) abre o pop-up de configuração centralizado com efeito Glassmorphism (`backdrop-filter: blur(16px)`).
- **Discriminação Táctil e Arraste sem Atraso (Zero-Delay Dragging)**:
  - Nós de workflow exigem reposicionamento frequente no espaço bidimensional.
  - Para garantir um arraste 1:1 completamente natural, instantâneo e sem latência, a propriedade `transform: translate(...)` não possui transições CSS (`transition-all` foi removido do container de nó móvel), eliminando qualquer sensação de "atraso" ou inércia indesejada.
  - A persistência no `localStorage` durante o arraste é amortecida com debounce de 200ms, assegurando fluidez máxima a 60-120 FPS.
  - Para eliminar o atrito de aberturas indesejadas de modais durante o reposicionamento de blocos, o sistema calcula a distância euclidiana entre o ponto inicial de contato e a soltura do mouse: deslocamentos superiores a 5 pixels são interpretados exclusivamente como reposicionamento de canvas, enquanto toques estáticos disparam a seleção e a abertura da janela de configuração.
- **Sliders Minimalistas Oficiais Preci (`.preci-slider`)**:
  - Os controles deslizantes de Temperatura, Top K e Limiar de Similaridade seguem rigorosamente a paleta monocromática oficial da Preci:
    - **Light Mode**: Trilha preenchida em preto sólido (`#171717`), trilha restante em cinza suave (`#E5E5E5`) e thumb circular de 16px em preto com borda branca nítida.
    - **Dark Mode**: Trilha preenchida em branco puro (`#FFFFFF`), trilha restante em cinza escuro (`#2E2E2E`) e thumb circular de 16px em branco com borda preta nítida e sombra suave.
    - Total ausência de tons roxos, azuis ou acentos genéricos de navegador (`accent-indigo`), proporcionando coesão visual impecável com o resto da suíte corporativa.
- **Microinterações e Facilidade Cognitiva**:
  - **Tags Clicáveis de Interpolação**: No editor de prompt do Gemini, variáveis como `{{input}}`, `{{doc_context}}` e `{{user_name}}` surgem como pílulas interativas que, ao serem clicadas, inserem automaticamente a interpolação no cursor.
  - **Sliders de Controle Contínuo**: Ajustes de Temperatura (0.0 a 1.0) e Top K (1 a 10) contam com display numérico em tempo real, permitindo calibrar a criatividade e a precisão do modelo com alta granularidade.
  - **Feedback e Persistência**: O botão de salvar emite feedback de confirmação imediato (ícone de check verde) antes do fechamento suave do modal, garantindo segurança operacional.

### 8.6 Padronização de Entradas Numéricas & Steppers Integrados (`NumberInput.tsx`)
- **Erradicação de Spinners Nativos do Navegador**:
  - Entradas `<input type="number">` padrão de navegadores (WebKit/Chromium e Gecko) renderizam botões cinzas e caixas brancas descompassadas que colidem frontalmente com o Dark Mode corporativo.
  - O sistema aplica remoção global dessas caixas via [index.css](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/styles/index.css):
    ```css
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    input[type="number"] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
    ```
- **Componente Reutilizável [NumberInput.tsx](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/components/common/NumberInput.tsx)**:
  - **Variante `chevrons` (Formulários & Modais de Configuração)**:
    - Botões integrados de `ChevronUp` e `ChevronDown` posicionados à direita dentro do próprio container.
    - Zero caixa branca: os botões herdam perfeitamente a cor de fundo e borda do container (`bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700`).
    - **Aceleração Contínua (Press & Hold)**: Manter o botão pressionado inicia um incremento/decremento suave a cada 75ms após um atraso inicial de 300ms, proporcionando usabilidade ergonômica idêntica à de softwares nativos de desktop.
    - Suporte a digitação direta e teclas de seta (`↑` e `↓`).
  - **Variante `stepper` (Cards Compactos do Canvas)**:
    - Formato horizontal minimalista com botões circulares `Minus` e `Plus` nas extremidades e o valor centralizado. Utilizado no card de Busca Documental RAG para seleção de *Documentos (Top K)*.

### 8.7 Microinteração de Saída de Nós no Canvas (Framer Motion em 2 Camadas)
No componente [WorkflowCanvas.tsx](file:///c:/Users/muril/OneDrive/Área de Trabalho/preci.%20company/frontend/src/components/agents/WorkflowCanvas.tsx), a remoção de nós (via botão de lixeira, tecla `Delete`, `Backspace` ou modal) conta com transição suave governada por `<AnimatePresence>`:
- **Separação de Camadas (Prevenção de Saltos GPU)**:
  - **Camada 1: Container Externo (`motion.div`)**: Responsável estrito pelo posicionamento absoluto no canvas (`style={{ transform: translate3d(x, y, 0) }}`). Durante a saída, anima exclusivamente `opacity: 1 ➔ 0` em 200ms com curva `cubic-bezier(0.16, 1, 0.3, 1)`. Isso impede que o motor do Framer Motion sobrescreva o `translate3d` por um `scale`, eliminando qualquer salto visual de coordenadas para a origem (0, 0).
  - **Camada 2: Card Interno (`motion.div`)**: Executa a dissolução estética com:
    - Escala: `scale: 1.0 ➔ 0.88`
    - Elevação: `y: 0 ➔ -6px` (sensação sutil de evaporação)
    - Desfoque: `filter: blur(0px) ➔ blur(3px)`
    - Duração calibrada em 200ms.

### 8.8 Cards de Nós com Inputs Embutidos e Conexões Diretas
- **Formulários Embutidos**: Campos essenciais (como prompt do Gemini, termos de busca RAG, URLs de requisição e corpo de e-mails) são digitáveis diretamente no card de **320px**, sem necessidade de abrir modais secundários.
- **Portas Específicas por Propriedade**:
  - Cada propriedade receptora de dados possui seu próprio conector circular (`in:prompt`, `in:query`, `in:raw_data`, `in:body`, `in:value`, `in:to`).
  - Cabos conectam saídas diretamente aos campos receptores, dispensando fórmulas manuais.
  - Quando conectada, a propriedade exibe um indicador circular SVG verde esmeralda com o nome da origem e botão de desconexão em 1 clique.
- **Prevenção de Cortes em Contêineres de Rolagem**:
  - Em drawers laterais com `overflow-y-auto` (como `NodeDrawer` e `AiWorkflowDrawer`), efeitos de `whileHover={{ scale: 1.01 }}` foram substituídos por transições sutis de borda e sombra, garantindo que as extremidades dos cards nunca sejam cortadas pelas bordas do container.

