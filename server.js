const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

require('dotenv').config();

// Importe os módulos de rota
const chatRouter = require('./src/routes/chat');
const editorRouter = require('./src/routes/editor');
const authRouter = require('./src/routes/auth');
const requireLogin = require('./src/middleware/auth'); // Importando middleware de autenticação

//BD
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado!"))
  .catch(err => console.error("Erro ao conectar ao MongoDB:", err));


app.use(bodyParser.urlencoded({ extended: true }));
const port = 80;

app.use(express.json());

//middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })); 

// Configurar EJS
app.set('view engine', 'ejs');

// Configurar diretório público
app.use(express.static('public'));
app.use('/public', express.static(path.join(__dirname, 'public')))

// Rota principal
app.get('/', (req, res) => res.render('home'));
app.use('/chat', requireLogin, chatRouter);
app.use('/editor', requireLogin, editorRouter);

// Rotas que requerem autenticação - Aplicando requireLogin
app.get('/editor', requireLogin, (req, res) => {
    res.render('editorprompt/editor', { response: '' });
  });

//Auth
app.use(authRouter);

///////////////////////////////////////////
// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////