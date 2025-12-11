const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
    .then(async () => {
        console.log('Conectado ao MongoDB para correção de índices...');

        try {
            const collection = mongoose.connection.collection('users');
            const indexes = await collection.indexes();

            const usernameIndex = indexes.find(idx => idx.name === 'username_1');

            if (usernameIndex) {
                console.log('Índice legada "username_1" encontrada. Removendo...');
                await collection.dropIndex('username_1');
                console.log('Índice removida com sucesso!');
            } else {
                console.log('Índice "username_1" não encontrada. Nenhuma ação necessária.');
            }

        } catch (error) {
            console.error('Erro ao manipular índices:', error);
        } finally {
            await mongoose.connection.close();
            console.log('Conexão fechada.');
            process.exit(0);
        }
    })
    .catch(err => {
        console.error('Erro de conexão:', err);
        process.exit(1);
    });
