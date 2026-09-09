const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://adminuser:Adminpass123@cluster0.lmultuc.mongodb.net/ecomarce_db?retryWrites=true&w=majority&appName=Cluster0";
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// 1. Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// 2. Banner Schema
const bannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, default: "" }
});

// 3. Category Schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

// 4. Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true }
});

// 5. Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, default: "" }
  },
  items: Array,
  total: { type: Number, required: true },
  delivered: { type: Boolean, default: false },
  date: { type: String, default: () => new Date().toLocaleString() }
});

// 6. Support Message Schema
const messageSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  customerName: { type: String, default: "Customer" },
  text: { type: String, required: true },
  sender: { type: String, default: "customer" },
  time: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
});

const Admin = mongoose.model('Admin', adminSchema);
const Banner = mongoose.model('Banner', bannerSchema);
const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { connectDB, Admin, Banner, Category, Product, Order, Message };