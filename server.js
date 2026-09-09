const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB, Admin, Banner, Category, Product, Order, Message } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Admin Register
app.post('/api/admin/register', async (req, res) => {
  try {
    const { username, password, secretKey } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username aur password zaroori hain!' });
    }

    if (secretKey && secretKey !== 'ADMINSECRET') {
      return res.status(403).json({ success: false, message: 'Invalid Admin Secret Key! (Use ADMINSECRET)' });
    }

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Yeh username pehle se maujood hai!' });
    }

    const newAdmin = new Admin({ username, password });
    await newAdmin.save();

    res.status(201).json({ success: true, message: 'Admin registered successfully!' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check count: Agar pehla user hai toh default create karein
    const count = await Admin.countDocuments();
    if (count === 0 && username === 'admin' && password === 'password123') {
      await Admin.create({ username: 'admin', password: 'password123' });
    }

    const admin = await Admin.findOne({ username, password });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Galat username ya password!' });
    }

    // Return mock token for admin session
    res.json({ success: true, token: 'admin-auth-token-xyz', message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Banner APIs
app.get('/api/banner', async (req, res) => {
  try {
    const banner = await Banner.findOne();
    res.json(banner || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/banner', async (req, res) => {
  try {
    const { imageUrl, title } = req.body;
    let banner = await Banner.findOne();
    if (banner) {
      banner.imageUrl = imageUrl;
      banner.title = title;
      await banner.save();
    } else {
      banner = await Banner.create({ imageUrl, title });
    }
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Categories APIs
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories.map(c => c.name));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    await Category.create({ name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/categories/:name', async (req, res) => {
  try {
    await Category.deleteOne({ name: req.params.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Products APIs
app.get('/api/products', async (req, res) => {
  try {
    const { category, q } = req.query;
    let filter = {};
    if (category && category !== 'All') filter.category = category;
    if (q) filter.name = { $regex: q, $options: 'i' };

    const products = await Product.find(filter);
    res.json(products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      price: p.price,
      category: p.category,
      image: p.image
    })));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, image } = req.body;
    await Product.create({ name, price, category, image });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { price: req.body.price });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Orders & Checkout APIs
app.post('/api/checkout', async (req, res) => {
  try {
    const { customer, cart } = req.body;
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const order = await Order.create({
      orderId,
      customerId: customer.phone || customer.email || 'guest',
      customer,
      items: cart,
      total
    });
    res.json({ success: true, orderId: order.orderId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/orders/toggle-delivery', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.body.orderId });
    if (order) {
      order.delivered = !order.delivered;
      await order.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders/my-orders', async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.query.customerId }).sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json([]);
  }
});

// Support Chat APIs
app.get('/api/support/messages', async (req, res) => {
  try {
    const filter = req.query.customerId ? { customerId: req.query.customerId } : {};
    const messages = await Message.find(filter).sort({ _id: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/support/send', async (req, res) => {
  try {
    const { customerId, customerName, text, sender } = req.body;
    await Message.create({ customerId, customerName, text, sender });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback for Admin SPA
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Start Server strictly after DB is connected
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});