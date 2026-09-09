const express = require('express');
const cors = require('cors');
const path = require('path');
const { Admin, Banner, Category, Product, Order, Message } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default Initial Data Setup (Pehli baar chalne par default data load karega)
async function initDefaultData() {
  const adminExists = await Admin.findOne({ username: "admin" });
  if (!adminExists) {
    await new Admin({ username: "admin", password: "password123" }).save();
  }

  const bannerExists = await Banner.findOne();
  if (!bannerExists) {
    await new Banner({
      imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200",
      title: "Special Festive Sale - Up to 50% OFF!"
    }).save();
  }

  const catCount = await Category.countDocuments();
  if (catCount === 0) {
    await Category.insertMany([
      { name: "Electronics" },
      { name: "Fashion" },
      { name: "Groceries" },
      { name: "Home & Kitchen" }
    ]);
  }
}
initDefaultData();

// Admin Verification Middleware
function verifyAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (token && token.startsWith('admin-token-')) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized Admin Access!" });
  }
}

// Admin App Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// --- ADMIN AUTH ---
app.post('/api/admin/register', async (req, res) => {
  try {
    const { username, password, secretKey } = req.body;
    if (secretKey !== "ADMINSECRET") {
      return res.status(400).json({ success: false, message: "Invalid Secret Admin Key!" });
    }
    const exists = await Admin.findOne({ username });
    if (exists) return res.status(400).json({ success: false, message: "Admin username pehle se maujood hai!" });

    await new Admin({ username, password }).save();
    res.json({ success: true, message: "Admin registered successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const match = await Admin.findOne({ username, password });
    if (match) {
      res.json({ success: true, token: `admin-token-${username}-${Date.now()}` });
    } else {
      res.status(401).json({ success: false, message: "Galat Username ya Password!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- BANNER ---
app.get('/api/banner', async (req, res) => {
  const banner = await Banner.findOne();
  res.json(banner || {});
});

app.post('/api/banner', verifyAdmin, async (req, res) => {
  const { imageUrl, title } = req.body;
  let banner = await Banner.findOne();
  if (banner) {
    banner.imageUrl = imageUrl;
    banner.title = title || "";
    await banner.save();
  } else {
    banner = await new Banner({ imageUrl, title }).save();
  }
  res.json({ success: true, banner });
});

// --- CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  const cats = await Category.find();
  res.json(cats.map(c => c.name));
});

app.post('/api/categories', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const exists = await Category.findOne({ name });
    if (exists) return res.status(400).json({ success: false, message: "Category pehle se maujood hai!" });

    await new Category({ name }).save();
    const cats = await Category.find();
    res.json({ success: true, categories: cats.map(c => c.name) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/categories/:name', verifyAdmin, async (req, res) => {
  try {
    await Category.findOneAndDelete({ name: req.params.name });
    const cats = await Category.find();
    res.json({ success: true, categories: cats.map(c => c.name) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
  try {
    const { q, category } = req.query;
    let query = {};

    if (category && category !== 'All') query.category = category;
    if (q) query.name = { $regex: q, $options: 'i' };

    const products = await Product.find(query);
    const formatted = products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      price: p.price,
      category: p.category,
      image: p.image
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/products', verifyAdmin, async (req, res) => {
  try {
    const { name, price, category, image } = req.body;
    const newProd = new Product({ name, price: Number(price), category, image });
    await newProd.save();
    res.json({ success: true, product: newProd });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, { price: Number(req.body.price) }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Product nahi mila!" });
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- ORDERS ---
app.post('/api/checkout', async (req, res) => {
  try {
    const { customer, cart } = req.body;
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder = new Order({
      orderId: "ORD" + Math.floor(100000 + Math.random() * 900000),
      customerId: customer.phone || customer.email || customer.name,
      customer,
      items: cart,
      total
    });

    await newOrder.save();
    res.json({ success: true, orderId: newOrder.orderId, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders/my-orders', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) return res.json([]);
    const myOrders = await Order.find({
      $or: [
        { customerId: customerId },
        { "customer.phone": customerId },
        { "customer.email": customerId }
      ]
    }).sort({ _id: -1 });
    res.json(myOrders);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders', verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/orders/toggle-delivery', verifyAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.body.orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order nahi mila!" });
    order.delivered = !order.delivered;
    await order.save();
    res.json({ success: true, delivered: order.delivered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- SUPPORT CHAT ---
app.get('/api/support/messages', async (req, res) => {
  try {
    const { customerId } = req.query;
    const query = customerId ? { customerId } : {};
    const msgs = await Message.find(query);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/support/send', async (req, res) => {
  try {
    const { customerId, customerName, text, sender } = req.body;
    const msg = new Message({ customerId, customerName, text, sender });
    await msg.save();
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Customer App: http://localhost:${PORT}`);
  console.log(`Admin App: http://localhost:${PORT}/admin`);
});