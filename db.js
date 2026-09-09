const mongoose = require('mongoose');

// MongoDB Connection URL (Localhost MongoDB)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://prabhakarsingh8586_db_user:8FPAeJE1W8fmL9aC@cluster0.lmultuc.mongodb.net/ecomarce_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Database Successfully Connected!"))
  .catch((err) => console.error("❌ Database Connection Error:", err));

// 1. Admin Account Schema
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

module.exports = { Admin, Banner, Category, Product, Order, Message };