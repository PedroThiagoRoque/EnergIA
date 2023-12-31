const express = require('express');
const app = express();
const path = require('path');

const bodyParser = require('body-parser');
const routes = require('../routes/bedrock');
require('dotenv').config();

// Importe os módulos de rota
const bedrockRouter = require('../routes/bedrock');
const openaiRouter = require('../routes/openaiapi');

// Use os routers com os prefixos definidos
app.use(bedrockRouter);
app.use(openaiRouter);

const port = 3000;

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));

// Configurar diretório público
app.use(express.static(path.join(__dirname, '../../public')));

// Rota principal
app.get('/', (req, res) => res.render('index'));

// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////

app.use(bodyParser.urlencoded({ extended: true }));
