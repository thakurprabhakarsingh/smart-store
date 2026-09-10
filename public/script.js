// ==================== FIREBASE CONFIGURATION ==================== //
const firebaseConfig = {
  apiKey: "AIzaSyBAYIUZIvEJ4Qef2TuG8NrZcpPKLyuR6F0",
  authDomain: "smartstore-auth.firebaseapp.com",
  projectId: "smartstore-auth",
  storageBucket: "smartstore-auth.firebasestorage.app",
  messagingSenderId: "10479269367",
  appId: "1:10479269367:web:76be3bc01aa43804e96af2"
};

// Firebase Initialization
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let confirmationResultGlobal = null;

function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: (response) => {},
      'expired-callback': () => {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      }
    });
  }
}

// ==================== APP STATE & VARIABLES ==================== //
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let activeCategory = 'All';
let bannersList = [];
let bannerIndex = 0;

// DOM Elements
const authBtn = document.getElementById('auth-btn');
const authBtnText = document.getElementById('auth-btn-text');
const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const authPhoneStep = document.getElementById('auth-phone-step');
const authOtpStep = document.getElementById('auth-otp-step');
const authProfileStep = document.getElementById('auth-profile-step');
const authPhoneInput = document.getElementById('auth-phone');
const authOtpInput = document.getElementById('auth-otp');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const backToPhoneBtn = document.getElementById('back-to-phone-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');

const cartBtn = document.getElementById('cart-btn');
const cartDrawer = document.getElementById('cart-drawer');
const closeCartDrawer = document.getElementById('close-cart-drawer');
const cartItemsContainer = document.getElementById('cart-items');
const cartCountElem = document.getElementById('cart-count');
const cartTotalPriceElem = document.getElementById('cart-total-price');
const checkoutBtn = document.getElementById('checkout-btn');

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// ==================== INITIAL LOAD ==================== //
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartUI();
  loadBanners();
  loadCategories();
  loadProducts();
  loadBestDeals();
  initSupportChat();
});

// ==================== FIREBASE PHONE AUTHENTICATION ==================== //
authBtn.addEventListener('click', () => {
  if (currentUser) {
    if (confirm("Kya aap logout karna chahte hain?")) {
      auth.signOut();
      localStorage.removeItem('currentUser');
      currentUser = null;
      updateAuthUI();
      location.reload();
    }
  } else {
    showAuthStep('phone');
    authModal.style.display = 'flex';
  }
});

closeAuthModal.addEventListener('click', () => authModal.style.display = 'none');

function showAuthStep(step) {
  authPhoneStep.style.display = step === 'phone' ? 'block' : 'none';
  authOtpStep.style.display = step === 'otp' ? 'block' : 'none';
  authProfileStep.style.display = step === 'profile' ? 'block' : 'none';
}

backToPhoneBtn.addEventListener('click', () => showAuthStep('phone'));

// 1. Send OTP through Firebase SMS
sendOtpBtn.addEventListener('click', async () => {
  const phone = authPhoneInput.value.trim();
  if (!/^[6-9]\d{9}$/.test(phone)) {
    alert("Kripya 10-digit valid Indian mobile number enter karein!");
    return;
  }

  sendOtpBtn.disabled = true;
  sendOtpBtn.innerText = "SMS bhej rahe hain...";

  try {
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;
    const formattedPhone = '+91' + phone;

    confirmationResultGlobal = await auth.signInWithPhoneNumber(formattedPhone, appVerifier);
    alert("OTP aapke mobile inbox par bhej diya gaya hai!");
    showAuthStep('otp');
  } catch (err) {
    console.error("Firebase SMS Delivery Error:", err);
    alert("OTP send fail hua: " + err.message);
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  } finally {
    sendOtpBtn.disabled = false;
    sendOtpBtn.innerText = "Send OTP";
  }
});

// 2. Verify OTP with Firebase & Sync with MongoDB
verifyOtpBtn.addEventListener('click', async () => {
  const otp = authOtpInput.value.trim();
  const phone = authPhoneInput.value.trim();

  if (!otp || otp.length !== 6) {
    alert("Kripya 6-digit OTP enter karein!");
    return;
  }

  verifyOtpBtn.disabled = true;
  verifyOtpBtn.innerText = "Verifying...";

  try {
    const confirmation = await confirmationResultGlobal.confirm(otp);
    const firebaseUser = confirmation.user;

    const res = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, uid: firebaseUser.uid })
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      if (!currentUser.profileCompleted) {
        showAuthStep('profile');
      } else {
        alert("Login safal raha!");
        authModal.style.display = 'none';
        updateAuthUI();
      }
    }
  } catch (err) {
    console.error("OTP Verification Error:", err);
    alert("Galat OTP ya expire ho gaya hai!");
  } finally {
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.innerText = "Verify OTP";
  }
});

// 3. Save User Profile to Database
saveProfileBtn.addEventListener('click', async () => {
  const name = document.getElementById('profile-name').value.trim();
  const houseNo = document.getElementById('profile-house').value.trim();
  const city = document.getElementById('profile-city').value.trim();
  const address = document.getElementById('profile-address').value.trim();

  if (!name || !address) {
    alert("Naam aur Address bharna zaroori hai!");
    return;
  }

  const res = await fetch('/api/auth/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: currentUser.phone, name, houseNo, city, address })
  });

  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    alert("Profile setup complete ho gaya!");
    authModal.style.display = 'none';
    updateAuthUI();
  }
});

function updateAuthUI() {
  if (currentUser) {
    authBtnText.innerText = currentUser.name ? currentUser.name.split(' ')[0] : currentUser.phone;
  } else {
    authBtnText.innerText = 'Login';
  }
}

// ==================== BANNERS SLIDER ==================== //
async function loadBanners() {
  try {
    const res = await fetch('/api/banners');
    bannersList = await res.json();
    const wrapper = document.getElementById('slider-wrapper');
    if (bannersList.length === 0) return;

    wrapper.innerHTML = bannersList.map(b => `
      <div class="slide">
        <img src="${b.imageUrl}" alt="${b.title}">
      </div>
    `).join('');

    setInterval(() => {
      bannerIndex = (bannerIndex + 1) % bannersList.length;
      wrapper.style.transform = `translateX(-${bannerIndex * 100}%)`;
    }, 4000);
  } catch (e) {
    console.error("Banner error:", e);
  }
}

// ==================== CATEGORIES & PRODUCTS ==================== //
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    const container = document.getElementById('category-chips');

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.category = cat;
      btn.innerText = cat;
      btn.onclick = () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = cat;
        loadProducts();
      };
      container.appendChild(btn);
    });
  } catch (e) {
    console.error("Categories fetch error:", e);
  }
}

async function loadBestDeals() {
  try {
    const res = await fetch('/api/products?bestDeal=true');
    const deals = await res.json();
    renderProductsList(deals, 'best-deals-grid');
  } catch (e) {
    console.error("Deals error:", e);
  }
}

async function loadProducts(query = '') {
  try {
    let url = `/api/products?category=${activeCategory}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const products = await res.json();
    renderProductsList(products, 'products-grid');
  } catch (e) {
    console.error("Products error:", e);
  }
}

function renderProductsList(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<p class="empty-msg">Koi product nahi mila.</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card">
      <img src="${p.image || 'https://via.placeholder.com/200'}" alt="${p.name}">
      <h4>${p.name}</h4>
      <p class="price">₹${p.price}</p>
      <button class="btn btn-sm btn-primary" onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image}')">
        <i class="fa-solid fa-plus"></i> Add to Cart
      </button>
    </div>
  `).join('');
}

// Search
searchBtn.addEventListener('click', () => loadProducts(searchInput.value.trim()));
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loadProducts(searchInput.value.trim());
});

// ==================== CART & CHECKOUT ==================== //
cartBtn.addEventListener('click', () => cartDrawer.classList.add('open'));
closeCartDrawer.addEventListener('click', () => cartDrawer.classList.remove('open'));

function addToCart(id, name, price, image) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price, image, quantity: 1 });
  }
  saveAndUpdateCart();
}

function updateQuantity(id, change) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
  }
  saveAndUpdateCart();
}

function saveAndUpdateCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  cartCountElem.innerText = totalCount;
  cartTotalPriceElem.innerText = '₹' + totalPrice;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-msg">Aapka cart khali hai.</p>';
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image || 'https://via.placeholder.com/60'}" width="50" height="50">
      <div class="cart-details">
        <h5>${item.name}</h5>
        <span>₹${item.price} x ${item.quantity}</span>
      </div>
      <div class="cart-qty-controls">
        <button onclick="updateQuantity('${item.id}', -1)">-</button>
        <span>${item.quantity}</span>
        <button onclick="updateQuantity('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

// Checkout
checkoutBtn.addEventListener('click', async () => {
  if (cart.length === 0) {
    alert("Cart khali hai!");
    return;
  }

  if (!currentUser) {
    alert("Kripya pehle Login karein!");
    showAuthStep('phone');
    authModal.style.display = 'flex';
    return;
  }

  if (!currentUser.profileCompleted) {
    alert("Kripya delivery address complete karein!");
    showAuthStep('profile');
    authModal.style.display = 'flex';
    return;
  }

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: currentUser, cart })
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 Order safaltapoorvak place ho chuka hai! Order ID: ${data.orderId}`);
      cart = [];
      saveAndUpdateCart();
      cartDrawer.classList.remove('open');
    }
  } catch (err) {
    alert("Checkout me issue aaya, kripya dubara try karein!");
  }
});

// ==================== LIVE CHAT / SUPPORT ==================== //
function initSupportChat() {
  const toggleBtn = document.getElementById('toggle-support');
  const supportBody = document.getElementById('support-body');
  const sendBtn = document.getElementById('support-send-btn');
  const msgInput = document.getElementById('support-input');

  toggleBtn.addEventListener('click', () => {
    const isOpen = supportBody.style.display === 'block';
    supportBody.style.display = isOpen ? 'none' : 'block';
    if (!isOpen && currentUser) loadMessages();
  });

  sendBtn.addEventListener('click', async () => {
    const text = msgInput.value.trim();
    if (!text) return;
    if (!currentUser) {
      alert("Support se chat karne ke liye pehle Login karein!");
      return;
    }

    await fetch('/api/support/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: currentUser.phone,
        sender: 'customer',
        text: text,
        timestamp: new Date().toLocaleTimeString()
      })
    });

    msgInput.value = '';
    loadMessages();
  });
}

async function loadMessages() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/support/messages?customerId=${currentUser.phone}`);
    const msgs = await res.json();
    const box = document.getElementById('support-messages');
    box.innerHTML = msgs.map(m => `
      <div class="msg ${m.sender === 'customer' ? 'sent' : 'received'}">
        <p>${m.text}</p>
        <span class="time">${m.timestamp || ''}</span>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}