const mongoose = require('mongoose');
const User = require('../src/models/User'); // Adjust path as needed based on script location
require('dotenv').config({ path: '../.env' }); // Adjust path to .env

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/energia_db'; // Fallback to explicitly 27017

async function migrateForms() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        const users = await User.find({});
        console.log(`Found ${users.length} users.`);

        let updatedCount = 0;

        for (const user of users) {
            let changed = false;

            if (!user.respostasFormularioInicial || Object.keys(user.respostasFormularioInicial).length === 0) {
                user.respostasFormularioInicial = { _placeholder: true };
                user.markModified('respostasFormularioInicial');
                changed = true;
            }

            if (!user.respostasFormularioFinal || Object.keys(user.respostasFormularioFinal).length === 0) {
                user.respostasFormularioFinal = { _placeholder: true };
                user.markModified('respostasFormularioFinal');
                changed = true;
            }

            if (!user.vinculo) {
                user.vinculo = 'Outro';
                changed = true;
            }

            // Optional: Ensure other default fields are set if needed
            // if (user.forcePasswordChange === undefined) { user.forcePasswordChange = false; changed = true; }

            if (changed) {
                await user.save();
                updatedCount++;
                process.stdout.write('.'); // Progress indicator
            }
        }

        console.log(`\nMigration completed. Updated ${updatedCount} users.`);
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateForms();
