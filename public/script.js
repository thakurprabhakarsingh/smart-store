let currentCategory = 'All';
let currentUser = JSON.parse(localStorage.getItem('smartStoreUser')) || null;
let cart = [];
let chatPollInterval = null;

window.onload = () => {
  loadBanner();
  loadCategories();
  loadProducts();
  updateUserUI();
  updateCartUI();
};

// 1. Banner
async function loadBanner() {
  try {
    const res = await fetch('/api/banner');
    const banner = await res.json();
    if (banner && banner.imageUrl) {
      const img = document.getElementById('offer-banner-img');
      const title = document.getElementById('offer-banner-title');
      if (img) img.src = banner.imageUrl;
      if (title) title.innerText = banner.title || "";
    }
  } catch (err) {
    console.error("Banner load error:", err);
  }
}

// 2. Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const bar = document.getElementById('category-chips');
    if (!bar) return;

    bar.innerHTML = `<div class="chip ${currentCategory === 'All' ? 'active' : ''}" onclick="selectCategory('All')">All</div>` +
      cats.map(c => `<div class="chip ${currentCategory === c ? 'active' : ''}" onclick="selectCategory('${c}')">${c}</div>`).join('');
  } catch (err) {
    console.error("Categories load error:", err);
  }
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
  try {
    const searchInput = document.getElementById('search-input');
    const q = searchInput ? searchInput.value : '';
    const url = `/api/products?category=${encodeURIComponent(currentCategory)}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const products = await res.json();
    const list = document.getElementById('product-list');

    if (!list) return;

    if (!products || products.length === 0) {
      list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b;">No products found.</p>`;
      return;
    }

    list.innerHTML = products.map(p => {
      const safeName = (p.name || '').replace(/'/g, "\\'");
      return `
        <div class="card">
          <img src="${p.image}" alt="${safeName}">
          <span class="category-tag">${p.category}</span>
          <h3>${p.name}</h3>
          <p style="font-weight: bold; margin: 4px 0 10px 0;">₹${p.price}</p>
          <button type="button" onclick="addToCart('${p.id}', '${safeName}', ${p.price})">Add to Cart</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Product load error:", err);
  }
}

// 4. Cart Logic
function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price: Number(price), quantity: 1 });
  }
  updateCartUI();
  alert(`${name} ko cart me add kar diya gaya!`);
}

function updateCartUI() {
  const countBadge = document.getElementById('cart-count');
  if (countBadge) {
    countBadge.innerText = cart.reduce((s, i) => s + i.quantity, 0);
  }

  const div = document.getElementById('cart-items');
  if (div) {
    if (cart.length === 0) {
      div.innerHTML = "<p>Cart khali hai.</p>";
    } else {
      div.innerHTML = cart.map(i => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span>${i.name} (x${i.quantity})</span>
          <strong>₹${i.price * i.quantity}</strong>
        </div>
      `).join('');
    }
  }

  const totalElem = document.getElementById('cart-total');
  if (totalElem) {
    totalElem.innerText = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  }
}

function toggleCart() {
  const m = document.getElementById('cart-modal');
  if (!m) return;
  m.style.display = m.style.display === 'block' ? 'none' : 'block';
  if (currentUser) {
    const custName = document.getElementById('cust-name');
    const custPhone = document.getElementById('cust-phone');
    if (custName) custName.value = currentUser.name || "";
    if (custPhone) custPhone.value = currentUser.phone || "";
  }
}

async function checkout() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name || !phone || !address || cart.length === 0) {
    alert("Saari details bharein aur cart check karein!");
    return;
  }

  try {
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
    } else {
      alert("Checkout error: " + data.message);
    }
  } catch (err) {
    alert("Server error during checkout");
  }
}

// 5. Customer Authentication
function openAuthModal() { 
  const el = document.getElementById('auth-modal');
  if (el) el.style.display = 'block'; 
}

function closeAuthModal() { 
  const el = document.getElementById('auth-modal');
  if (el) el.style.display = 'none'; 
}

function loginWithGoogle() {
  const dummyName = prompt("Google Sign-In: Enter your Name", "Customer");
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
  const authBtn = document.getElementById('auth-btn');
  const userPill = document.getElementById('user-pill');
  const displayName = document.getElementById('user-display-name');

  if (currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'flex';
    if (displayName) displayName.innerText = `👋 ${currentUser.name}`;
  } else {
    if (authBtn) authBtn.style.display = 'block';
    if (userPill) userPill.style.display = 'none';
  }
}

// 6. Orders History
async function openMyOrders() {
  if (!currentUser) return alert("Pehle login karein!");
  const modal = document.getElementById('orders-modal');
  if (modal) modal.style.display = 'block';

  const cid = currentUser.phone || currentUser.email;
  try {
    const res = await fetch(`/api/orders/my-orders?customerId=${encodeURIComponent(cid)}`);
    const orders = await res.json();
    const box = document.getElementById('my-orders-list');
    if (!box) return;

    if (!orders || orders.length === 0) {
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
        <p style="margin: 6px 0;">Items: ${(o.items || []).map(i => `${i.name} (${i.quantity})`).join(', ')}</p>
        <p style="font-weight: bold; margin: 0;">Total Paid: ₹${o.total}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error("Order fetch error:", err);
  }
}

function closeMyOrders() {
  const modal = document.getElementById('orders-modal');
  if (modal) modal.style.display = 'none';
}

// 7. Support Chat
function toggleChat() {
  const widget = document.getElementById('chat-widget');
  if (!widget) return;
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
  try {
    const res = await fetch(`/api/support/messages?customerId=${encodeURIComponent(cid)}`);
    const messages = await res.json();
    const box = document.getElementById('chat-messages');
    if (!box) return;

    box.innerHTML = (messages || []).map(m => `
      <div class="chat-msg ${m.sender}">
        <div>${m.text}</div>
        <div style="font-size: 10px; opacity: 0.8; text-align: right;">${m.time}</div>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    console.error("Chat load error:", err);
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const cid = currentUser ? (currentUser.phone || currentUser.email) : "guest-user";
  const cname = currentUser ? currentUser.name : "Guest";

  try {
    await fetch('/api/support/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: cid, customerName: cname, text, sender: 'customer' })
    });
    input.value = '';
    loadChatMessages();
  } catch (err) {
    console.error("Chat send error:", err);
  }
}