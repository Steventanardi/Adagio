const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data', 'users.json');

let dbCache = null;
let savePromise = Promise.resolve();

async function readDatabase() {
    if (dbCache) return dbCache;
    try {
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) {
            await fsp.mkdir(dataDir, { recursive: true });
        }

        const data = await fsp.readFile(DB_PATH, 'utf8');
        dbCache = JSON.parse(data);
    } catch (e) {
        console.error('Info: Database file parsing failed or missing, initializing new.', e.message);
        dbCache = { users: [], library: {} };
        savePromise = savePromise.then(() => fsp.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2)));
        await savePromise;
    }
    return dbCache;
}

async function writeDatabase() {
    if (!dbCache) return;
    const currentData = JSON.stringify(dbCache, null, 2);
    savePromise = savePromise.then(() => fsp.writeFile(DB_PATH, currentData));
    await savePromise;
}

module.exports = {
    readDatabase,
    writeDatabase
};
