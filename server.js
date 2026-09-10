const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB, User, Admin, Banner, Category, Product, Order, Message } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// ---------------- USER FIREBASE SMS SYNC & AUTH ROUTES ---------------- //
app.post('/api/auth/firebase-login', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number zaroori hai!' });

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, profileCompleted: false });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("Firebase Login Sync Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/update-profile', async (req, res) => {
  const { phone, name, houseNo, city, address } = req.body;
  if (!phone || !name || !address) {
    return res.status(400).json({ success: false, message: 'Naam aur Address bharna zaroori hai!' });
  }

  const user = await User.findOneAndUpdate(
    { phone },
    { name, houseNo, city, address, profileCompleted: true },
    { new: true }
  );
  res.json({ success: true, user });
});

// ---------------- ADMIN AUTH ROUTES ---------------- //
app.post('/api/admin/register', async (req, res) => {
  try {
    const { username, password, secretKey } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username aur password zaroori hain!' });
    if (secretKey && secretKey !== 'ADMINSECRET') return res.status(403).json({ success: false, message: 'Invalid Admin Secret Key!' });

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) return res.status(400).json({ success: false, message: 'Yeh username pehle se maujood hai!' });

    const newAdmin = new Admin({ username, password });
    await newAdmin.save();
    res.status(201).json({ success: true, message: 'Admin registered successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const count = await Admin.countDocuments();
    if (count === 0 && username === 'admin' && password === 'password123') {
      await Admin.create({ username: 'admin', password: 'password123' });
    }

    const admin = await Admin.findOne({ username, password });
    if (!admin) return res.status(401).json({ success: false, message: 'Galat username ya password!' });

    res.json({ success: true, token: 'admin-auth-token-xyz', message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ---------------- CAROUSEL BANNER ROUTES ---------------- //
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await Banner.find();
    if (banners.length === 0) {
      return res.json([
        { imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200", title: "Mega Sale - Flat 40% OFF" },
        { imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200", title: "Fresh Grocery & Daily Needs" },
        { imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200", title: "Best Electronics & Deals" }
      ]);
    }
    res.json(banners);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/banners', async (req, res) => {
  try {
    const { imageUrl, title } = req.body;
    await Banner.create({ imageUrl, title });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- CATEGORY ROUTES ---------------- //
app.get('/api/categories', async (req, res) => {
  const categories = await Category.find();
  res.json(categories.map(c => c.name));
});

app.post('/api/categories', async (req, res) => {
  await Category.create({ name: req.body.name });
  res.json({ success: true });
});

app.delete('/api/categories/:name', async (req, res) => {
  await Category.deleteOne({ name: req.params.name });
  res.json({ success: true });
});

// ---------------- PRODUCT ROUTES ---------------- //
app.get('/api/products', async (req, res) => {
  const { category, q, bestDeal } = req.query;
  let filter = {};
  if (category && category !== 'All') filter.category = category;
  if (q) filter.name = { $regex: q, $options: 'i' };
  if (bestDeal === 'true') filter.isBestDeal = true;

  const products = await Product.find(filter);
  res.json(products.map(p => ({
    id: p._id.toString(),
    name: p.name,
    price: p.price,
    category: p.category,
    image: p.image,
    isBestDeal: p.isBestDeal || false
  })));
});

app.post('/api/products', async (req, res) => {
  await Product.create(req.body);
  res.json({ success: true });
});

app.put('/api/products/:id', async (req, res) => {
  await Product.findByIdAndUpdate(req.params.id, req.body);
  res.json({ success: true });
});

app.delete('/api/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ---------------- ORDERS ROUTES ---------------- //
app.post('/api/checkout', async (req, res) => {
  const { customer, cart } = req.body;
  const orderId = 'ORD-' + Date.now().toString().slice(-6);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const order = await Order.create({
    orderId,
    customerId: customer.phone || 'guest',
    customer,
    items: cart,
    total
  });
  res.json({ success: true, orderId: order.orderId });
});

app.get('/api/orders', async (req, res) => res.json(await Order.find().sort({ _id: -1 })));

app.post('/api/orders/toggle-delivery', async (req, res) => {
  const order = await Order.findOne({ orderId: req.body.orderId });
  if (order) {
    order.delivered = !order.delivered;
    if (order.delivered) {
      const now = new Date();
      order.deliveredDate = now.toISOString().split('T')[0];
      order.deliveredTimestamp = now.toLocaleString();
    } else {
      order.deliveredDate = "";
      order.deliveredTimestamp = "";
    }
    await order.save();
  }
  res.json({ success: true, delivered: order ? order.delivered : false });
});

app.get('/api/orders/my-orders', async (req, res) => {
  res.json(await Order.find({ customerId: req.query.customerId }).sort({ _id: -1 }));
});

// ---------------- SUPPORT CHAT ---------------- //
app.get('/api/support/messages', async (req, res) => {
  const filter = req.query.customerId ? { customerId: req.query.customerId } : {};
  res.json(await Message.find(filter).sort({ _id: 1 }));
});

app.post('/api/support/send', async (req, res) => {
  await Message.create(req.body);
  res.json({ success: true });
});

// ---------------- SERVE STATIC ENTRY ---------------- //
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});