const express = require('express');
const path = require('path');

// Models aur DB connection import karein
const { Admin, Banner, Category, Product, Order, Message } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Public Static Files (Customer frontend CSS/JS/images)
app.use(express.static(path.join(__dirname, 'public')));

// Serve Admin Static Assets (admin.css, admin.js)
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// Customer Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin Route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Admin Nested Route Fallback
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
// Admin Login API Route
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username, password });

        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Start Server on 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Customer URL: http://localhost:${PORT}`);
    console.log(`Admin URL: http://localhost:${PORT}/admin`);
});