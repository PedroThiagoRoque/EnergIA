# Guia da API - EnergIA Platform

## Visão Geral

A API do EnergIA é construída com Node.js/Express e oferece endpoints para autenticação, chat com IA e funcionalidades de dashboard. O projeto funciona na porta 3000 por padrão.

## Base URL
```
http://localhost:3000
```

## Autenticação

### 1. Registro de Usuário
```http
POST /register
Content-Type: application/x-www-form-urlencoded
```

**Parâmetros:**
- `name` (string): Nome do usuário
- `email` (string): Email do usuário  
- `password` (string): Senha (será hasheada com bcrypt)
- `group` (string): Grupo do usuário
- `ageRange` (string): Faixa etária
- `gender` (string): Gênero

**Resposta de Sucesso:**
- Redirect para `/login`

**Resposta de Erro:**
- Renderiza página de registro com mensagem de erro

### 2. Login de Usuário
```http
POST /login
Content-Type: application/x-www-form-urlencoded
```

**Parâmetros:**
- `email` (string): Email do usuário
- `password` (string): Senha

**Resposta:**
- Cria sessão e redireciona para `/dashboard`

### 3. Logout
```http
GET /logout
```

**Resposta:**
- Destroi a sessão e redireciona para página inicial

## Chat com IA

### 1. Enviar Mensagem ao Chat
```http
POST /chat/message
Content-Type: application/json
Authorization: Sessão ativa necessária
```

**Body:**
```json
{
  "message": "Sua pergunta sobre eficiência energética"
}
```

**Resposta:**
```json
{
  "response": "Resposta do assistente de IA",
  "assistantType": "Nome do assistente"
}
```

**Exemplo de uso:**
```javascript
const response = await fetch('/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: "Como posso reduzir o consumo de energia em casa?" 
  }),
  credentials: 'include'
});
const data = await response.json();
console.log(data.response); // Resposta do assistente
```

### 2. Chat com OpenAI (Editor)
```http
POST /editor/openai
Content-Type: application/json
Authorization: Sessão ativa necessária
```

**Body:**
```json
{
  "userInput": "Pergunta do usuário",
  "promptSistema": "Prompt de sistema personalizado"
}
```

**Resposta:**
```json
{
  "response": "Resposta do GPT-3.5-turbo"
}
```

### 3. Chat com Claude (Bedrock)
```http
POST /editor/bedrock
Content-Type: application/json
Authorization: Sessão ativa necessária
```

**Body:**
```json
{
  "userInput": "Pergunta do usuário",
  "promptSistema": "Prompt de sistema personalizado"
}
```

**Resposta:**
```json
{
  "claudeResponse": "Resposta do Claude via AWS Bedrock"
}
```

## Páginas Principais

### 1. Dashboard do Usuário
```http
GET /dashboard
Authorization: Sessão ativa necessária
```

**Resposta:** Renderiza página EJS com:
- Informações do usuário logado
- Temperatura atual de Pelotas
- Dados de consumo energético
- Botões de navegação para funcionalidades

### 2. Editor de Prompts
```http
GET /editor
Authorization: Sessão ativa necessária
```

**Resposta:** Renderiza interface para testar diferentes modelos de IA (OpenAI e Claude)

### 3. Chat Interface
```http
GET /chat
Authorization: Sessão ativa necessária
```

**Resposta:** Renderiza interface de chat com assistente especializado em eficiência energética

## Middleware de Autenticação

Todos os endpoints protegidos utilizam middleware que:
- Verifica se existe uma sessão ativa
- Se não autenticado, redireciona para `/login`
- Disponibiliza dados do usuário via `req.session.user`

## Configuração da API

### Variáveis de Ambiente Necessárias:
```env
# OpenAI
OPENAI_API_KEY=sua_chave_openai

# AWS Bedrock
AWS_ACCESS_KEY_ID=sua_chave_aws
AWS_SECRET_ACCESS_KEY=sua_chave_secreta_aws

# MongoDB
MONGO_URI=mongodb://localhost:27017/energia

# Sessão
SESSION_SECRET=seu_segredo_sessao_super_secreto

# Servidor
PORT=3000
```

### Modelos de IA Utilizados:
- **OpenAI**: GPT-3.5-turbo via API oficial
- **Claude**: Claude-3-haiku via AWS Bedrock (região us-east-1)
- **Assistente personalizado**: Focado em eficiência energética e sustentabilidade

## Banco de Dados

### Modelos MongoDB:

#### User
```javascript
{
  name: String,
  email: String (único),
  password: String (hasheado),
  group: String,
  ageRange: String,
  gender: String,
  createdAt: Date
}
```

#### Chat
```javascript
{
  userId: ObjectId,
  message: String,
  response: String,
  assistantType: String,
  timestamp: Date
}
```

## Exemplo de Integração Completa

### Cliente JavaScript/React Native
```javascript
class EnergiaAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  // Autenticação
  async register(userData) {
    const formData = new URLSearchParams();
    Object.keys(userData).forEach(key => {
      formData.append(key, userData[key]);
    });

    const response = await fetch(`${this.baseURL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      credentials: 'include'
    });
    return response.ok;
  }

  async login(email, password) {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);

    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      credentials: 'include'
    });
    return response.ok;
  }

  async logout() {
    const response = await fetch(`${this.baseURL}/logout`, {
      method: 'GET',
      credentials: 'include'
    });
    return response.ok;
  }

  // Chat
  async sendChatMessage(message) {
    const response = await fetch(`${this.baseURL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Erro ao enviar mensagem');
    }
    
    return response.json();
  }

  // Editor - OpenAI
  async chatWithOpenAI(userInput, promptSistema = '') {
    const response = await fetch(`${this.baseURL}/editor/openai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, promptSistema }),
      credentials: 'include'
    });
    return response.json();
  }

  // Editor - Claude
  async chatWithClaude(userInput, promptSistema = '') {
    const response = await fetch(`${this.baseURL}/editor/bedrock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, promptSistema }),
      credentials: 'include'
    });
    return response.json();
  }
}

// Exemplo de uso
const api = new EnergiaAPI();

// Login
await api.login('usuario@email.com', 'senha123');

// Enviar mensagem no chat
const chatResponse = await api.sendChatMessage('Como economizar energia?');
console.log(chatResponse.response);
```

## Fluxo de Chat Frontend

O arquivo `public/js/chat.js` demonstra como implementar:

1. **Interface de Loading**: Spinner durante processamento
2. **Formatação de Mensagens**: Suporte a markdown básico (`**texto**` → `<b>texto</b>`)
3. **Scroll Automático**: Mantém o chat sempre no final
4. **Tratamento de Erros**: Mostra mensagem amigável em caso de falha

### Exemplo do Frontend:
```javascript
// Adicionar mensagem do usuário
chatWindow.innerHTML += `
  <div class="message user-message">
    <div class="message-content">
      <div class="assistant-type">Você</div>
      ${message}
    </div>
  </div>
`;

// Adicionar spinner de loading
const spinnerId = 'spinner-' + Date.now();
chatWindow.innerHTML += `
  <div class="message assistant-message" id="${spinnerId}">
    <div class="message-content">
      <img src="/public/load.gif" alt="Carregando..." style="width:50px;height:50px;">
    </div>
  </div>
`;

// Substituir spinner pela resposta
document.getElementById(spinnerId).innerHTML = `
  <div class="message-content">
    <div class="assistant-type">${data.assistantType}</div>
    ${formatResponse(data.response)}
  </div>
`;
```

## Códigos de Resposta HTTP

- **200**: Sucesso
- **302**: Redirecionamento (usado após login/logout)
- **400**: Erro de validação
- **401**: Não autorizado (sessão inválida)
- **500**: Erro interno do servidor

## Recursos Avançados

### Sistema de Sessões
- Utiliza `express-session` com MongoDB store
- Sessões persistem por 24 horas
- Dados do usuário disponíveis em `req.session.user`

### Integração com APIs Externas
- **OpenWeather API**: Para dados meteorológicos
- **OpenAI API**: Para GPT-3.5-turbo
- **AWS Bedrock**: Para Claude-3-haiku

### Segurança
- Senhas hasheadas com bcrypt
- Validação de entrada de dados
- Middleware de autenticação em rotas protegidas
- CORS configurado para desenvolvimento

## Estrutura de Arquivos da API

```
src/
├── config/
│   └── db.js              # Configuração MongoDB
├── middleware/
│   └── auth.js            # Middleware de autenticação
├── models/
│   ├── Chat.js            # Modelo de chat
│   └── User.js            # Modelo de usuário
└── routes/
    ├── auth.js            # Rotas de autenticação
    ├── chat.js            # Rotas de chat
    ├── editor.js          # Rotas do editor
    └── openaiapi.js       # Integração OpenAI
```

## Notas Importantes

- ✅ Sistema de sessões Express com MongoDB
- ✅ Integração com múltiplos modelos de IA  
- ✅ Prompt system personalizável
- ✅ Interface responsiva com Bootstrap
- ✅ Histórico de conversas persistente no MongoDB
- ✅ API REST para integração externa
- ✅ Middleware de autenticação robusto
- ✅ Tratamento de erros adequado

## Troubleshooting

### Problemas Comuns:

1. **Erro de CORS**: Configurar adequadamente as origens permitidas
2. **Sessão não persiste**: Verificar configuração do MongoDB store
3. **API Keys inválidas**: Verificar variáveis de ambiente
4. **Conexão MongoDB**: Verificar string de conexão e disponibilidade do banco

### Logs Úteis:
```javascript
console.log('Usuário logado:', req.session.user);
console.log('Mensagem recebida:', req.body.message);
console.log('Resposta da IA:', response);
```

Este guia fornece todas as informações necessárias para integrar qualquer aplicação com a API EnergIA existente.