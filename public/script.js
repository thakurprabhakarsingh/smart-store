let currentCategory = 'All';
let currentUser = JSON.parse(localStorage.getItem('smartStoreUser')) || null;
let cart = [];
let chatPollInterval = null;

window.onload = () => {
  loadBanner();
  loadCategories();
  loadProducts();
  updateUserUI();
};

// 1. Banner
async function loadBanner() {
  const res = await fetch('/api/banner');
  const banner = await res.json();
  if (banner && banner.imageUrl) {
    document.getElementById('offer-banner-img').src = banner.imageUrl;
    document.getElementById('offer-banner-title').innerText = banner.title || "";
  }
}

// 2. Categories
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

// 3. Products & Search
function handleSearch() {
  loadProducts();
}

async function loadProducts() {
  const q = document.getElementById('search-input').value;
  const url = `/api/products?category=${encodeURIComponent(currentCategory)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  const products = await res.json();
  const list = document.getElementById('product-list');

  if (products.length === 0) {
    list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b;">No products found matching your search.</p>`;
    return;
  }

  list.innerHTML = products.map(p => `
    <div class="card">
      <img src="${p.image}" alt="${p.name}">
      <span class="category-tag">${p.category}</span>
      <h3>${p.name}</h3>
      <p style="font-weight: bold; margin: 4px 0 10px 0;">₹${p.price}</p>
      <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
    </div>
  `).join('');
}

// 4. Cart Logic
function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.quantity += 1;
  else cart.push({ id, name, price, quantity: 1 });
  updateCartUI();
}

function updateCartUI() {
  document.getElementById('cart-count').innerText = cart.reduce((s, i) => s + i.quantity, 0);
  const div = document.getElementById('cart-items');
  if (cart.length === 0) {
    div.innerHTML = "<p>Cart khali hai.</p>";
  } else {
    div.innerHTML = cart.map(i => `<p>${i.name} x ${i.quantity} = ₹${i.price * i.quantity}</p>`).join('');
  }
  document.getElementById('cart-total').innerText = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
}

function toggleCart() {
  const m = document.getElementById('cart-modal');
  m.style.display = m.style.display === 'block' ? 'none' : 'block';
  if (currentUser) {
    document.getElementById('cust-name').value = currentUser.name || "";
    document.getElementById('cust-phone').value = currentUser.phone || "";
  }
}

async function checkout() {
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const address = document.getElementById('cust-address').value;

  if (!name || !phone || !address || cart.length === 0) {
    alert("Saari details bharein!");
    return;
  }

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { name, phone, address, email: currentUser ? currentUser.email : "" },
      cart
    })
  });

  const data = await res.json();
  if (data.success) {
    alert(`Order Placed! Order ID: ${data.orderId}`);
    cart = [];
    updateCartUI();
    toggleCart();
  }
}

// 5. Customer Authentication
function openAuthModal() { document.getElementById('auth-modal').style.display = 'block'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

function loginWithGoogle() {
  const dummyName = prompt("Google Sign-In Simulation: Enter your Name", "Rahul Sharma");
  if (dummyName) {
    currentUser = { name: dummyName, email: `${dummyName.toLowerCase().replace(/\s+/g, '')}@gmail.com`, phone: "9876543210" };
    localStorage.setItem('smartStoreUser', JSON.stringify(currentUser));
    updateUserUI();
    closeAuthModal();
  }
}

function sendOtp() {
  const ph = document.getElementById('auth-phone').value;
  if (!ph || ph.length < 10) return alert("Valid 10 digit phone number dalein!");
  document.getElementById('phone-step-1').style.display = 'none';
  document.getElementById('phone-step-2').style.display = 'block';
}

function verifyOtp() {
  const otp = document.getElementById('auth-otp').value;
  const name = document.getElementById('auth-user-name').value || "Valued Customer";
  const ph = document.getElementById('auth-phone').value;

  if (otp === "1234") {
    currentUser = { name, phone: ph, email: "" };
    localStorage.setItem('smartStoreUser', JSON.stringify(currentUser));
    updateUserUI();
    closeAuthModal();
  } else {
    alert("Galat OTP! Test OTP: 1234");
  }
}

function logoutCustomer() {
  currentUser = null;
  localStorage.removeItem('smartStoreUser');
  updateUserUI();
}

function updateUserUI() {
  if (currentUser) {
    document.getElementById('auth-btn').style.display = 'none';
    document.getElementById('user-pill').style.display = 'flex';
    document.getElementById('user-display-name').innerText = `👋 ${currentUser.name}`;
  } else {
    document.getElementById('auth-btn').style.display = 'block';
    document.getElementById('user-pill').style.display = 'none';
  }
}

// 6. My Orders Section (Live Delivered Status)
async function openMyOrders() {
  if (!currentUser) return alert("Pehle login karein!");
  document.getElementById('orders-modal').style.display = 'block';

  const cid = currentUser.phone || currentUser.email;
  const res = await fetch(`/api/orders/my-orders?customerId=${encodeURIComponent(cid)}`);
  const orders = await res.json();
  const box = document.getElementById('my-orders-list');

  if (orders.length === 0) {
    box.innerHTML = "<p>Aapne abhi tak koi order nahi kiya hai.</p>";
    return;
  }

  box.innerHTML = orders.map(o => `
    <div class="my-order-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>Order: ${o.orderId}</strong>
        <span class="status-badge ${o.delivered ? 'delivered' : 'pending'}">
          ${o.delivered ? '✅ Delivered' : '⏳ Out for Delivery'}
        </span>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 4px 0;">Date: ${o.date}</p>
      <p style="margin: 6px 0;">Items: ${o.items.map(i => `${i.name} (${i.quantity})`).join(', ')}</p>
      <p style="font-weight: bold; margin: 0;">Total Paid: ₹${o.total}</p>
    </div>
  `).join('');
}

function closeMyOrders() {
  document.getElementById('orders-modal').style.display = 'none';
}

// 7. Support Chat
function toggleChat() {
  const widget = document.getElementById('chat-widget');
  const isShown = widget.style.display === 'flex';
  widget.style.display = isShown ? 'none' : 'flex';
  if (!isShown) {
    loadChatMessages();
    if (!chatPollInterval) chatPollInterval = setInterval(loadChatMessages, 3000);
  } else {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

async function loadChatMessages() {
  const cid = currentUser ? (currentUser.phone || currentUser.email) : "guest-user";
  const res = await fetch(`/api/support/messages?customerId=${encodeURIComponent(cid)}`);
  const messages = await res.json();
  const box = document.getElementById('chat-messages');

  box.innerHTML = messages.map(m => `
    <div class="chat-msg ${m.sender}">
      <div>${m.text}</div>
      <div style="font-size: 10px; opacity: 0.8; text-align: right;">${m.time}</div>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const cid = currentUser ? (currentUser.phone || currentUser.email) : "guest-user";
  const cname = currentUser ? currentUser.name : "Guest";

  await fetch('/api/support/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: cid, customerName: cname, text, sender: 'customer' })
  });

  input.value = '';
  loadChatMessages();
}