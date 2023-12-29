const express = require('express');
const app = express();
const path = require('path');

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
