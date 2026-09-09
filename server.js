const express = require('express');
const path = require('path');
const session = require('express-session');
const connectDB = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect Database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Render HTTP proxy ke piche false theek rehta hai
}));

// Set View Engine (agar EJS use kar rahe hain)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import Routes
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');

// Mount Routes
app.use('/', customerRoutes);
app.use('/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).send('Page Not Found');
});

// Start Server on 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Live application ready`);
});