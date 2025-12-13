![Logo](https://raw.githubusercontent.com/PedroThiagoRoque/EnergIA/main/Recursos/BannerEnergIA.png)

<h4 align="center"> 
	🚧 4º PAR Procel - LABCEE - UFPel 💻 Em construção...  🚧
</h4>

# 💡 EnergIA

Plataforma desenvolvida para testes de chatbots focados em eficiência energética e gamificação da economia em prédios públicos. O projeto utiliza modelos de Inteligência Artificial (como GPT-4o-mini e Claude) para responder dúvidas, fornecer sugestões e realizar o acompanhamento de progresso de forma inteligente e contextualizada.

---

## 📸 Screenshots

<div align="center">
  <!-- Adicione aqui as imagens do projeto -->
  <img src="https://via.placeholder.com/800x400?text=Dashboard+Screenshoot" alt="Dashboard" width="800">
  <br><br>
  <img src="https://via.placeholder.com/800x400?text=Chat+Interface+Screenshoot" alt="Chat Interface" width="800">
</div>

---

## 📂 Estrutura do Projeto

Abaixo está a estrutura de diretórios principal do projeto:

```bash
EnergIA/
├── public/           # Arquivos estáticos (CSS, JS do cliente, imagens)
├── src/              # Código fonte principal
│   ├── config/       # Configurações de banco de dados e serviços
│   ├── controllers/  # Lógica de controle das rotas
│   ├── models/       # Modelos do Mongoose (Schemas)
│   ├── routes/       # Definição das rotas da API
│   ├── services/     # Lógica de negócios e integrações externas
│   └── utils/        # Funções utilitárias
├── views/            # Templates EJS para renderização do front-end
├── .env              # Variáveis de ambiente
├── server.js         # Ponto de entrada da aplicação
└── package.json      # Dependências e scripts
```

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/) (Rodando localmente ou string de conexão remota)

### Configuração

1. Clone o repositório:
```bash
git clone https://github.com/PedroThiagoRoque/EnergIA.git
cd EnergIA
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env` na raiz do projeto e adicione suas chaves (ex: OpenAI API Key, MongoDB URI, etc).

### Execução

Para rodar o projeto em ambiente de desenvolvimento (com hot-reload):
```bash
npm run dev
```

Para rodar em produção:
```bash
npm start
```

O servidor iniciará geralmente em `http://localhost:3000` (ou na porta definida no seu `.env`).

---

## 🛣️ Documentação das Rotas

### 🏠 Principal e Autenticação

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/` | Exibe a página inicial (landing page). |
| `GET` | `/dashboard` | Painel principal do usuário logado (infos meteorológicas, etc). |
| `GET` | `/register` | Formulário de cadastro de usuários. |
| `POST` | `/register` | Processa o novo cadastro. |
| `GET` | `/login` | Tela de login. |
| `POST` | `/login` | Autentica e inicia sessão. |
| `GET` | `/logout` | Encerra a sessão. |
| `GET` | `/change-password` | Formulário para alterar senha. |
| `POST` | `/change-password` | Processa a alteração de senha. |
| `GET` | `/forgot-password` | Formulário de recuperação de senha. |
| `POST` | `/forgot-password` | Solicita redefinição de senha (admin). |

### 💬 Chat (`/chat`)

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/chat` | Interface do chat com histórico. |
| `GET` | `/chat/health` | Healthcheck do serviço de chat. |
| `POST` | `/chat/message` | Envia mensagem para a IA e recebe resposta (SSE). |
| `GET` | `/chat/daily/icebreakers` | Sugestões de tópicos diários para conversa. |

### 📝 Editor (`/editor`)

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/editor` | Interface do editor de prompts. |
| `POST` | `/editor/openai` | Processa prompt via OpenAI (GPT-3.5). |
| `POST` | `/editor/bedrock` | Processa prompt via Amazon Bedrock (Claude). |

### 🛡️ Admin (`/admin`)

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/admin` | Painel administrativo (stats e logs). |
| `POST` | `/admin/reset-password` | Reseta senha de usuário. |

### 📱 API Pública (`/api`)

| Método | Rota | Descrição |
|:---|:---|:---|
| `GET` | `/api/notifications/toast` | Conteúdo motivacional para notificações mobile. |

---

## 🛠️ Tecnologias Utilizadas

- **Front-end**: EJS, Bootstrap, HTML5, CSS3
- **Back-end**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **AI Integration**: OpenAI API, Amazon Bedrock

## 📄 Licença

Este projeto está sob a licença ISC. Desenvolvido pelo LABCEE / Faurb - UFPel.
