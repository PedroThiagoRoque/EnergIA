# Guia da API - EnergIA

Este documento detalha todas as rotas, endpoints e estruturas de dados do projeto EnergIA.

## Base URL
`http://localhost:3000`

---

## 1. Autenticação e Gestão de Conta

Rotas baseadas em `src/routes/auth.js` e montadas na raiz `/`.

### 1.1 Registro
- **URL**: `/register`
- **Métodos**:
  - `GET`: Renderiza a tela de registro.
  - `POST`: Cria um novo usuário.
    - **Body**:
      - `name`: Nome completo.
      - `email`: Email (único).
      - `password`: Senha.
      - `group`: Grupo (ex: Discente, Docente).
      - `ageRange`: Faixa etária.
      - `gender`: Gênero.
      - `vinculo`: Tipo de vínculo.

### 1.2 Login
- **URL**: `/login`
- **Métodos**:
  - `GET`: Renderiza a tela de login.
  - `POST`: Autentica o usuário.
    - **Body**:
      - `email`: Email cadastrado.
      - `password`: Senha.
    - **Sucesso**: Redireciona para `/dashboard`.
    - **Sessão**: Define `userId`, `userName`, `role`.

### 1.3 Logout
- **URL**: `/logout`
- **Método**: `GET`
- **Ação**: Destroi a sessão e redireciona para `/login`.

### 1.4 Gestão de Senha
- **Alteração de Senha**: `/change-password`
  - `GET`: Tela de alteração (Requer login).
  - `POST`: Atualiza a senha.
    - **Body**: `currentPassword`, `newPassword`, `confirmNewPassword`.
- **Recuperação de Senha**: `/forgot-password`
  - `GET`: Tela de "Esqueci minha senha".
  - `POST`: Registra solicitação de reset.
    - **Body**: `email`.

---

## 2. Navegação do Usuário

Rotas definidas em `server.js`.

- **Home**: `GET /` - Renderiza a página inicial pública.
- **Dashboard**: `GET /dashboard` (Requer Login)
  - Renderiza painel principal com:
    - Saudação ao usuário.
    - Dados meteorológicos (Temperatura/Ícone).
    - Links para Chat e Editor.

---

## 3. Chat Inteligente

Rotas baseadas em `src/routes/chat.js` e montadas em `/chat`. **Requer Login.**

### 3.1 Interface do Chat
- **URL**: `/chat`
- **Método**: `GET`
- **Ação**: Renderiza o histórico de mensagens e área de interação.

### 3.2 Enviar Mensagem (SSE)
- **URL**: `/chat/message`
- **Método**: `POST`
- **Body**:
  - `message`: Texto da mensagem do usuário.
- **Retorno**: *Server-Sent Events (SSE)*.
  - O servidor envia chunks de texto (token a token) conforme a geração da IA.
  - Evento final contém metadados (`done: true`, `perfilUsuario`, `weather`).
- **Funcionalidade**:
  - Persiste histórico.
  - Analisa intenção.
  - Consulta RAG ou Assistente de Perfil.

### 3.3 Icebreakers Diários
- **URL**: `/chat/daily/icebreakers`
- **Método**: `GET`
- **Retorno** (JSON):
  ```json
  {
    "temas": ["Tema 1", "Tema 2", "Tema 3"]
  }
  ```
- **Lógica**: Retorna sugestões de conversa geradas por IA (via CronJob) ou fallback local.

### 3.4 Healthcheck
- **URL**: `/chat/health`
- **Método**: `GET`
- **Retorno**: JSON `{ ok: true, service: 'chat', time: ... }`

---

## 4. Editor de Prompts (Playground)

Rotas baseadas em `src/routes/editor.js` e montadas em `/editor`. **Requer Login.**

### 4.1 Interface
- **URL**: `/editor`
- **Método**: `GET`
- **Ação**: Renderiza ferramenta para testar prompts manuais.

### 4.2 Teste OpenAI
- **URL**: `/editor/openai`
- **Método**: `POST`
- **Body**: `{ "userInput": "...", "promptSistema": "..." }`
- **Retorno**: JSON `{ "response": "..." }`

### 4.3 Teste AWS Bedrock (Claude)
- **URL**: `/editor/bedrock`
- **Método**: `POST`
- **Body**: `{ "userInput": "...", "promptSistema": "..." }`
- **Retorno**: JSON `{ "claudeResponse": "..." }`

---

## 5. Administração

Rotas baseadas em `src/routes/admin.js` e montadas em `/admin`. **Requer Login e Role 'godmode'.**

### 5.1 Dashboard Admin
- **URL**: `/admin`
- **Método**: `GET`
- **Ação**: Exibe lista de usuários, logs de erro e solicitações de reset de senha.

### 5.2 Reset de Senha de Usuário
- **URL**: `/admin/reset-password`
- **Método**: `POST`
- **Body**: `{ "userId": "..." }`
- **Ação**: Reseta a senha do usuário para `Mudar123!` e força troca no próximo login.

### 5.3 Gerenciamento de Cron Jobs
- **Listar Jobs**: `GET /admin/crons`
- **Executar Job**: `POST /admin/crons/:name/run`
- **Agendar Job**: `POST /admin/crons/:name/schedule`
  - **Body**: `{ "schedule": "*/5 * * * *" }`

### 5.4 Análise de Perfil Manual
- **URL**: `/admin/analyze-profile`
- **Método**: `POST`
- **Body**:
  - `userId`: ID do usuário.
  - `type`: 'inicial' ou 'final'.
  - `respostas` (opcional): Objeto com respostas do formulário.
- **Ação**: Executa a lógica de classificação de perfil (Scoring + LLM) e atualiza o usuário.

### 5.5 Migração de Dados
- **URL**: `/admin/migrate-forms`
- **Método**: `POST`
- **Ação**: Garante que campos de formulário e vínculo existam para todos os usuários legados.

---

## 6. API Pública (Mobile/Externa)

Rotas baseadas em `src/routes/api.js` e montadas em `/api`.

- **Teste**: `GET /api` - Retorna JSON `{ "message": "API is working" }`.

---

## 7. Middleware

### Autenticação (`src/middleware/auth.js`)
- `requireLogin`: Verifica se `req.session.userId` existe. Redireciona para `/login` se falhar.
- `requireAdmin`: Verifica se `req.session.role === 'godmode'`. Acesso negado se falhar.

### Dados Meteorológicos (`src/middleware/weatherMiddleware.js`)
- Injeta dados de clima (temperatura, ícone) em `res.locals` para renderização global.
- Atualiza a cada 30 minutos via cache simples na memória.

---

## 8. Modelos de Dados (MongoDB)

### User
- `name`, `email`, `password`, `role`.
- `respostasFormularioInicial`, `respostasFormularioFinal`: Dados dos formulários de perfil.
- `perfilUsuario`, `perfilInicial`, `perfilFinal`: Classificações (Ex: Proativo).
- `dadosUso`: Métricas de interação (total de mensagens, horário preferido, etc.).

### Chat
- `userId`: Referência ao User.
- `messages`: Array de objetos `{ sender, content, timestamp }`.
- `threadId`: ID da thread OpenAI (se aplicável).

### DailyData
- Armazena conteúdo diário gerado por IA (Icebreakers, Dicas) para consistência global.

---

## Notas de Desenvolvimento

- **SSE (Server-Sent Events)**: O chat utiliza SSE para streamar a resposta da IA, melhorando a UX.
- **Cron Jobs**: Tarefas como "Daily Content" e atualizações de perfil rodam em background.
- **RAG**: O chat utiliza Retrieval-Augmented Generation para embasar respostas em documentos técnicos.
