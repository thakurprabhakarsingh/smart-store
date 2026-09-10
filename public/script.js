let currentCategory = 'All';
let currentUser = JSON.parse(localStorage.getItem('smartStoreUser')) || null;
let cart = [];
let pendingPhone = "";

window.onload = () => {
  loadBanner();
  loadCategories();
  loadProducts();
  updateUserUI();
  updateCartUI();
};

function navigateTab(tab, btn) {
  document.querySelectorAll('.b-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (tab === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tab === 'cart') {
    document.getElementById('cart-modal').style.display = 'block';
  } else if (tab === 'orders') {
    if (!currentUser) return openAuthModal();
    openMyOrders();
  } else if (tab === 'profile') {
    if (!currentUser) return openAuthModal();
    openProfileModal();
  } else if (tab === 'chat') {
    if (!currentUser) return openAuthModal();
    document.getElementById('chat-modal').style.display = 'block';
    loadChatMessages();
  }
}

function openAuthModal() { document.getElementById('auth-modal').style.display = 'block'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

async function sendOtp() {
  const phone = document.getElementById('auth-phone').value.trim();
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return alert("Kripya 10-digit valid mobile number dalein!");
  }

  pendingPhone = phone;
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });

  const data = await res.json();
  if (data.success) {
    alert(data.message);
    document.getElementById('phone-step-1').style.display = 'none';
    document.getElementById('phone-step-2').style.display = 'block';
  } else {
    alert(data.message);
  }
}

async function verifyOtp() {
  const otp = document.getElementById('auth-otp').value.trim();
  if (otp.length < 4) return alert("Valid OTP dalein!");

  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: pendingPhone, otp })
  });

  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem('smartStoreUser', JSON.stringify(currentUser));
    closeAuthModal();
    updateUserUI();

    if (!currentUser.profileCompleted) {
      openProfileModal();
    }
  } else {
    alert(data.message);
  }
}

function openProfileModal() {
  document.getElementById('profile-modal').style.display = 'block';
  if (currentUser) {
    document.getElementById('prof-phone').value = currentUser.phone || "";
    document.getElementById('prof-name').value = currentUser.name || "";
    document.getElementById('prof-house').value = currentUser.houseNo || "";
    document.getElementById('prof-city').value = currentUser.city || "";
    document.getElementById('prof-address').value = currentUser.address || "";
  }
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
}

async function saveProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const houseNo = document.getElementById('prof-house').value.trim();
  const city = document.getElementById('prof-city').value.trim();
  const address = document.getElementById('prof-address').value.trim();

  if (!name || !address) return alert("Naam aur complete address bharna zaroori hai!");

  const res = await fetch('/api/auth/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: currentUser.phone, name, houseNo, city, address })
  });

  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem('smartStoreUser', JSON.stringify(currentUser));
    alert("Profile successfully updated!");
    closeProfileModal();
    updateUserUI();
  } else {
    alert(data.message);
  }
}

function updateUserUI() {
  const statusDiv = document.getElementById('user-header-status');
  if (currentUser) {
    statusDiv.innerHTML = `<span style="font-size: 13px; color: #38bdf8; cursor: pointer;" onclick="openProfileModal()">👋 ${currentUser.name || currentUser.phone}</span>`;
  } else {
    statusDiv.innerHTML = `<button class="nav-btn" onclick="openAuthModal()">Login</button>`;
  }
}

async function loadCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const bar = document.getElementById('category-chips');
  bar.innerHTML = `<div class="chip ${currentCategory === 'All' ? 'active' : ''}" onclick="selectCategory('All')">All</div>` +
    cats.map(c => `<div class="chip ${currentCategory === c ? 'active' : ''}" onclick="selectCategory('${c}')">${c}</div>`).join('');
}

function selectCategory(cat) {
  currentCategory = cat;
  loadCategories();
  loadProducts();
}

async function loadProducts() {
  const q = document.getElementById('search-input').value;
  const res = await fetch(`/api/products?category=${encodeURIComponent(currentCategory)}&q=${encodeURIComponent(q)}`);
  const products = await res.json();
  const list = document.getElementById('product-list');

  if (products.length === 0) return list.innerHTML = "<p>No products found.</p>";

  list.innerHTML = products.map(p => `
    <div class="card">
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p style="font-weight: bold; margin: 4px 0 10px 0;">₹${p.price}</p>
      <button onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price})">Add to Cart</button>
    </div>
  `).join('');
}

function handleSearch() { loadProducts(); }

function addToCart(id, name, price) {
  const item = cart.find(i => i.id === id);
  if (item) item.quantity += 1;
  else cart.push({ id, name, price, quantity: 1 });
  updateCartUI();
  alert(`${name} cart me add ho gaya!`);
}

function updateCartUI() {
  document.getElementById('cart-count').innerText = cart.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cart-total').innerText = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const div = document.getElementById('cart-items');
  if (cart.length === 0) div.innerHTML = "<p>Cart khali hai.</p>";
  else div.innerHTML = cart.map(i => `<p>${i.name} x ${i.quantity} = ₹${i.price * i.quantity}</p>`).join('');
}

async function checkout() {
  if (!currentUser) return openAuthModal();
  if (!currentUser.profileCompleted) {
    alert("Kripya checkout se pehle profile me address save karein!");
    return openProfileModal();
  }
  if (cart.length === 0) return alert("Cart khali hai!");

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer: currentUser, cart })
  });

  const data = await res.json();
  if (data.success) {
    alert(`Order Placed! Order ID: ${data.orderId}`);
    cart = [];
    updateCartUI();
    document.getElementById('cart-modal').style.display = 'none';
  }
}

async function openMyOrders() {
  document.getElementById('orders-modal').style.display = 'block';
  const res = await fetch(`/api/orders/my-orders?customerId=${encodeURIComponent(currentUser.phone)}`);
  const orders = await res.json();
  const box = document.getElementById('my-orders-list');
  if (orders.length === 0) return box.innerHTML = "<p>Koi order nahi mila.</p>";
  box.innerHTML = orders.map(o => `
    <div style="background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:8px;">
      <strong>Order ID: ${o.orderId}</strong>
      <p style="margin:4px 0;">Total: ₹${o.total} | Status: ${o.delivered ? '✅ Delivered' : '⏳ Pending'}</p>
    </div>
  `).join('');
}

async function loadBanner() {
  const res = await fetch('/api/banner');
  const b = await res.json();
  if (b.imageUrl) {
    document.getElementById('offer-banner-img').src = b.imageUrl;
    document.getElementById('offer-banner-title').innerText = b.title || "";
  }
}

async function loadChatMessages() {
  const res = await fetch(`/api/support/messages?customerId=${encodeURIComponent(currentUser.phone)}`);
  const msgs = await res.json();
  document.getElementById('chat-messages').innerHTML = msgs.map(m => `
    <div style="text-align:${m.sender === 'customer' ? 'right' : 'left'}; margin: 4px 0;">
      <span style="background:${m.sender === 'customer' ? '#2563eb' : '#e2e8f0'}; color:${m.sender === 'customer' ? 'white' : 'black'}; padding:6px 10px; border-radius:12px; display:inline-block; font-size:13px;">
        ${m.text}
      </span>
    </div>
  `).join('');
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  await fetch('/api/support/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: currentUser.phone, customerName: currentUser.name, text, sender: 'customer' })
  });
  input.value = '';
  loadChatMessages();
}