// ==================== FIREBASE CONFIGURATION ==================== //
const firebaseConfig = {
  apiKey: "AIzaSyBAyIUzIvEJ4Qef2TuG8NrZcpPKLyuR6F0",
  authDomain: "smartstore-auth.firebaseapp.com",
  projectId: "smartstore-auth",
  storageBucket: "smartstore-auth.firebasestorage.app",
  messagingSenderId: "10479269367",
  appId: "1:10479269367:web:76be3bc01aa43804e96af2"
};
// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
let confirmationResultGlobal = null;

function setupRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      }
    });
  }
}

// ==================== APP STATE ==================== //
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let activeCategory = 'All';
let banners = [];
let bannerIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  renderUserStatus();
  updateCartBadge();
  loadBanners();
  loadCategories();
  loadBestDeals();
  loadProducts();
});

// ==================== AUTH & SMS OTP HANDLING ==================== //
function openAuthModal() {
  if (currentUser) {
    if (confirm("Kya aap logout karna chahte hain?")) {
      auth.signOut();
      localStorage.removeItem('currentUser');
      currentUser = null;
      renderUserStatus();
      location.reload();
    }
  } else {
    resetOtpStep();
    document.getElementById('auth-modal').style.display = 'flex';
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function resetOtpStep() {
  document.getElementById('phone-step-1').style.display = 'block';
  document.getElementById('phone-step-2').style.display = 'none';
  document.getElementById('auth-phone').value = '';
  document.getElementById('auth-otp').value = '';
}

function openProfileModal() {
  if (!currentUser) return;
  document.getElementById('prof-phone').value = currentUser.phone || '';
  document.getElementById('prof-name').value = currentUser.name || '';
  document.getElementById('prof-house').value = currentUser.houseNo || '';
  document.getElementById('prof-city').value = currentUser.city || '';
  document.getElementById('prof-address').value = currentUser.address || '';
  document.getElementById('profile-modal').style.display = 'flex';
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
}

function renderUserStatus() {
  const container = document.getElementById('user-header-status');
  if (currentUser) {
    const displayName = currentUser.name ? currentUser.name : currentUser.phone;
    container.innerHTML = `<span style="font-size:13px; font-weight:700; cursor:pointer;" onclick="openProfileModal()">👋 ${displayName}</span>`;
  } else {
    container.innerHTML = `<button class="nav-btn" onclick="openAuthModal()">Login</button>`;
  }
}

// 1. Mobile Inbox par Free SMS OTP bhejna
async function sendOtp() {
  const phone = document.getElementById('auth-phone').value.trim();
  if (!/^[6-9]\d{9}$/.test(phone)) {
    alert("Kripya 10-digit valid Indian mobile number enter karein!");
    return;
  }

  const btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  btn.innerText = "SMS OTP bhej rahe hain...";

  try {
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;
    const formattedPhone = '+91' + phone;

    confirmationResultGlobal = await auth.signInWithPhoneNumber(formattedPhone, appVerifier);
    
    alert("✅ OTP aapke mobile number par SMS ke dwara bhej diya gaya hai!");
    document.getElementById('phone-step-1').style.display = 'none';
    document.getElementById('phone-step-2').style.display = 'block';
  } catch (err) {
    console.error("Firebase SMS Send Error:", err);
    alert("SMS OTP bhejne me samasya: " + err.message);
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  } finally {
    btn.disabled = false;
    btn.innerText = "Send OTP via SMS";
  }
}

// 2. OTP Verify karna aur MongoDB Database me sync karna
async function verifyOtp() {
  const otp = document.getElementById('auth-otp').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();

  if (!otp || otp.length !== 6) {
    alert("Kripya 6-digit OTP darj karein!");
    return;
  }

  const btn = document.getElementById('verify-otp-btn');
  btn.disabled = true;
  btn.innerText = "Verifying...";

  try {
    const confirmation = await confirmationResultGlobal.confirm(otp);
    const firebaseUser = confirmation.user;

    // Backend route se MongoDB sync
    const res = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, uid: firebaseUser.uid })
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      closeAuthModal();
      renderUserStatus();

      if (!currentUser.profileCompleted) {
        openProfileModal();
      } else {
        alert("🎉 Verification aur Login safal raha!");
      }
    } else {
      alert("Database sync issue: " + data.message);
    }
  } catch (err) {
    console.error("OTP Verification Error:", err);
    alert("Galat OTP ya code expire ho chuka hai!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Verify OTP";
  }
}

// Profile Save
async function saveProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const houseNo = document.getElementById('prof-house').value.trim();
  const city = document.getElementById('prof-city').value.trim();
  const address = document.getElementById('prof-address').value.trim();

  if (!name || !address) {
    alert("Full Name aur Address bharna zaroori hai!");
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
    alert("Profile safaltapoorvak update ho gaya!");
    closeProfileModal();
    renderUserStatus();
  }
}

// ==================== BOTTOM NAVIGATION ==================== //
function navigateTab(tab, element) {
  document.querySelectorAll('.b-tab').forEach(b => b.classList.remove('active'));
  if (element) element.classList.add('active');

  if (tab === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tab === 'cart') {
    openCartModal();
  } else if (tab === 'orders') {
    openOrdersModal();
  } else if (tab === 'profile') {
    if (!currentUser) openAuthModal();
    else openProfileModal();
  } else if (tab === 'chat') {
    openChatModal();
  }
}

// ==================== BANNERS SLIDER ==================== //
async function loadBanners() {
  try {
    const res = await fetch('/api/banners');
    banners = await res.json();
    const slider = document.getElementById('carousel-slider');
    const dots = document.getElementById('carousel-dots');
    if (!banners || !banners.length) return;

    slider.innerHTML = banners.map(b => `<img src="${b.imageUrl}" class="carousel-item" alt="Banner">`).join('');
    dots.innerHTML = banners.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="setSlide(${i})"></span>`).join('');

    setInterval(() => {
      bannerIndex = (bannerIndex + 1) % banners.length;
      updateSlidePosition();
    }, 3500);
  } catch (e) {
    console.error("Banner error:", e);
  }
}

function setSlide(i) {
  bannerIndex = i;
  updateSlidePosition();
}

function updateSlidePosition() {
  const slider = document.getElementById('carousel-slider');
  if (slider) {
    slider.style.transform = `translateX(-${bannerIndex * 100}%)`;
  }
  document.querySelectorAll('.carousel-dots .dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx === bannerIndex);
  });
}

// ==================== CATEGORIES & PRODUCTS ==================== //
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    const container = document.getElementById('category-chips');
    
    let html = `<button class="chip active" onclick="filterCategory('All', this)">All</button>`;
    categories.forEach(cat => {
      html += `<button class="chip" onclick="filterCategory('${cat}', this)">${cat}</button>`;
    });
    container.innerHTML = html;
  } catch (e) {
    console.error("Category error:", e);
  }
}

function filterCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.category-chips-bar .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  loadProducts();
}

async function loadBestDeals() {
  try {
    const res = await fetch('/api/products?bestDeal=true');
    const deals = await res.json();
    const wrapper = document.getElementById('best-deals-wrapper');
    const list = document.getElementById('best-deals-list');

    if (deals.length > 0) {
      wrapper.style.display = 'block';
      list.innerHTML = deals.map(p => `
        <div class="deal-card">
          <span class="deal-badge">🔥 Deal</span>
          <img src="${p.image || 'https://via.placeholder.com/150'}" alt="${p.name}">
          <h4>${p.name}</h4>
          <div class="price">₹${p.price}</div>
          <button class="primary-btn" onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image}')">Add to Cart</button>
        </div>
      `).join('');
    } else {
      wrapper.style.display = 'none';
    }
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
    const list = document.getElementById('product-list');

    if (products.length === 0) {
      list.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding: 20px 0;">Koi product uplabdh nahi hai.</p>';
      return;
    }

    list.innerHTML = products.map(p => `
      <div class="product-card">
        <img src="${p.image || 'https://via.placeholder.com/150'}" alt="${p.name}">
        <h4>${p.name}</h4>
        <div class="price">₹${p.price}</div>
        <button class="primary-btn" onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image}')">Add to Cart</button>
      </div>
    `).join('');
  } catch (e) {
    console.error("Product error:", e);
  }
}

function handleSearch() {
  const query = document.getElementById('search-input').value.trim();
  loadProducts(query);
}

// ==================== CART & CHECKOUT ==================== //
function addToCart(id, name, price, image) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += 1;
  } else {
    cart.push({ id, name, price, image, quantity: 1 });
  }
  syncCart();
}

function syncCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').innerText = totalQty;
}

function openCartModal() {
  renderCartView();
  document.getElementById('cart-modal').style.display = 'flex';
}

function renderCartView() {
  const container = document.getElementById('cart-items');
  const totalElem = document.getElementById('cart-total');
  
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; margin:20px 0;">Cart khali hai</p>';
    totalElem.innerText = '0';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(item => {
    total += item.price * item.quantity;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
        <div>
          <div style="font-weight:600; font-size:13px;">${item.name}</div>
          <div style="color:#64748b; font-size:12px;">₹${item.price} x ${item.quantity}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button onclick="changeQty('${item.id}', -1)" style="padding:2px 8px; cursor:pointer;">-</button>
          <span style="font-size:13px;">${item.quantity}</span>
          <button onclick="changeQty('${item.id}', 1)" style="padding:2px 8px; cursor:pointer;">+</button>
        </div>
      </div>
    `;
  }).join('');
  totalElem.innerText = total;
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
  }
  syncCart();
  renderCartView();
}

async function checkout() {
  if (!cart.length) {
    alert("Aapka cart khali hai!");
    return;
  }
  if (!currentUser) {
    alert("Order karne ke liye pehle Mobile OTP se Login karein!");
    openAuthModal();
    return;
  }
  if (!currentUser.profileCompleted) {
    alert("Pehle delivery address complete karein!");
    openProfileModal();
    return;
  }

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer: currentUser, cart })
  });

  const data = await res.json();
  if (data.success) {
    alert(`🎉 Order safal! Order ID: ${data.orderId}`);
    cart = [];
    syncCart();
    document.getElementById('cart-modal').style.display = 'none';
  }
}

// ==================== ORDERS & SUPPORT CHAT ==================== //
async function openOrdersModal() {
  if (!currentUser) {
    alert("Pehle mobile number se login karein!");
    openAuthModal();
    return;
  }
  const modal = document.getElementById('orders-modal');
  const list = document.getElementById('my-orders-list');
  list.innerHTML = 'Loading...';
  modal.style.display = 'flex';

  try {
    const res = await fetch(`/api/orders/my-orders?customerId=${currentUser.phone}`);
    const orders = await res.json();
    if (!orders.length) {
      list.innerHTML = '<p style="text-align:center; color:#64748b; padding: 20px 0;">Koi order record nahi mila.</p>';
      return;
    }
    list.innerHTML = orders.map(o => `
      <div style="background:#f8fafc; padding:10px; border-radius:6px; margin-bottom:10px; border-left: 4px solid #2563eb;">
        <div style="font-weight:bold; font-size:13px;">Order ID: ${o.orderId}</div>
        <div style="font-size:12px; color:#64748b; margin-top:2px;">Total: ₹${o.total} | Status: ${o.delivered ? '✅ Delivered' : '⏳ Processing'}</div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = 'Orders load nahi huye.';
  }
}

function openChatModal() {
  if (!currentUser) {
    alert("Support help ke liye pehle Login karein!");
    openAuthModal();
    return;
  }
  document.getElementById('chat-modal').style.display = 'flex';
  loadChatMessages();
}

async function loadChatMessages() {
  if (!currentUser) return;
  const box = document.getElementById('chat-messages');
  try {
    const res = await fetch(`/api/support/messages?customerId=${currentUser.phone}`);
    const messages = await res.json();
    box.innerHTML = messages.map(m => `
      <div style="margin-bottom:8px; text-align:${m.sender === 'customer' ? 'right' : 'left'};">
        <span style="display:inline-block; padding:6px 12px; border-radius:12px; font-size:13px; background:${m.sender === 'customer' ? '#2563eb' : '#e2e8f0'}; color:${m.sender === 'customer' ? '#fff' : '#000'};">
          ${m.text}
        </span>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentUser) return;

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

  input.value = '';
  loadChatMessages();
}