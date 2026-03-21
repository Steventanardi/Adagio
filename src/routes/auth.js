const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDatabase, writeDatabase } = require('../utils/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/signup', async (req, res) => {
    const { full_name, email, password } = req.body;
    const db = await readDatabase();
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    db.users.push({ id, full_name, email, password: hashedPassword });
    await writeDatabase();
    res.json({ message: 'User registered successfully.' });
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    const db = await readDatabase();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
});

module.exports = router;
