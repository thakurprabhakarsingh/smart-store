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

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "" },
  houseNo: { type: String, default: "" },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  profileCompleted: { type: Boolean, default: false }
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const bannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, default: "" }
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  isBestDeal: { type: Boolean, default: false }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    houseNo: { type: String, default: "" },
    city: { type: String, default: "" }
  },
  items: Array,
  total: { type: Number, required: true },
  delivered: { type: Boolean, default: false },
  deliveredDate: { type: String, default: "" },
  deliveredTimestamp: { type: String, default: "" },
  date: { type: String, default: () => new Date().toLocaleString() }
});

const messageSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  customerName: { type: String, default: "Customer" },
  text: { type: String, required: true },
  sender: { type: String, default: "customer" },
  time: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
});

const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Banner = mongoose.model('Banner', bannerSchema);
const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { connectDB, User, Admin, Banner, Category, Product, Order, Message };