const express = require('express');
const path = require('path');
const session = require('express-session');
const connectDB = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
connectDB();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all static assets (CSS, JS, images) from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'smart_store_secure_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Route 1: Customer UI (Home Page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route 2: Admin UI
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Fallback Route for direct admin page access
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Server Start (Render dynamic PORT & 0.0.0.0 binding)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Customer URL: http://localhost:${PORT}`);
    console.log(`Admin URL: http://localhost:${PORT}/admin`);
});