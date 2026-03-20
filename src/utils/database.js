const fs = require('fs');
const path = require('path');

// Adjusted path to point to data/ in the root directory
const DB_PATH = path.join(__dirname, '../../data', 'users.json');

function readDatabase() {
    try {
        // Ensure data directory exists
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        if (!fs.existsSync(DB_PATH)) {
            const initialDB = { users: [], library: {} };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
            return initialDB;
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading database:', e);
        return { users: [], library: {} };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing database:', e);
    }
}

module.exports = {
    readDatabase,
    writeDatabase
};
