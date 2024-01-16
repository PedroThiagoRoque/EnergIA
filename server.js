const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

// Importe os módulos de rota
const chatRouter = require('./src/routes/chat');
const editorRouter = require('./src/routes/editor');

app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

app.use(express.json());


// Configurar EJS
app.set('view engine', 'ejs');

// Configurar diretório público
app.use(express.static('public'));
app.use('/public', express.static(path.join(__dirname, 'public')))

// Rota principal
app.get('/', (req, res) => res.render('home'));

app.use('/chat', chatRouter);
app.use('/editor', editorRouter);

//chat com editor de prompt
app.get('/editor', (req,res) => { 
    res.render('editorprompt/editor', {response: ''});
});

///////////////////////////////////////////
// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////

