let adminToken = localStorage.getItem('adminToken') || null;
let isRegisterMode = false;
let allProductsCache = [];
let allOrdersCache = [];
let selectedImageBase64 = "";
let liveOrdersPoller = null;

window.onload = () => {
  if (adminToken) {
    showDashboard();
  }
};

function toggleAdminAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').innerText = isRegisterMode ? "Admin Registration" : "Admin Login";
  document.getElementById('reg-secret-field').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('auth-submit-btn').innerText = isRegisterMode ? "Register Admin" : "Login";
  document.getElementById('auth-toggle-link').innerText = isRegisterMode ? "Pehle se account hai? Login karein" : "Naya Admin Register Karein";
}

async function loginAdmin() {
  const username = document.getElementById('admin-user').value.trim();
  const password = document.getElementById('admin-pass').value.trim();
  const secretKey = document.getElementById('admin-secret').value.trim();

  if (!username || !password) return alert("Username aur Password bharein!");

  if (isRegisterMode) {
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, secretKey })
    });
    const data = await res.json();
    if (data.success) {
      alert("Registration successful! Ab login karein.");
      toggleAdminAuthMode();
    } else {
      alert("Error: " + data.message);
    }
  } else {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      showDashboard();
    } else {
      alert("Login failed: " + data.message);
    }
  }
}

function showDashboard() {
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // Initial loads
  loadAdminCategories();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminMessages();

  // Set default calendar picker to today (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const picker = document.getElementById('delivery-calendar-picker');
  if (picker) picker.value = todayStr;

  // Auto-polling interval: 4 seconds (Auto refresh bina page reload kiye)
  if (!liveOrdersPoller) {
    liveOrdersPoller = setInterval(() => {
      loadAdminOrders(true); // background silent update
      loadAdminMessages(true);
    }, 4000);
  }
}

function logoutAdmin() {
  if (liveOrdersPoller) clearInterval(liveOrdersPoller);
  localStorage.removeItem('adminToken');
  location.reload();
}

function switchSection(secId, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(secId).classList.add('active');
  btn.classList.add('active');

  if (secId === 'calendar-sec') {
    filterDeliveredByCalendar();
  }
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

// ---------------- LIVE ORDERS & CALENDAR LOGIC ---------------- //

async function loadAdminOrders(isSilent = false) {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    
    // Check if new orders arrived to prevent unnecessary re-renders
    if (JSON.stringify(allOrdersCache) === JSON.stringify(orders)) {
      return;
    }

    allOrdersCache = orders;
    renderActiveOrders(allOrdersCache);
    updatePendingBadge(allOrdersCache);

    // Agar calendar tab active hai toh use bhi sync karein
    if (document.getElementById('calendar-sec').classList.contains('active')) {
      filterDeliveredByCalendar();
    }
  } catch (err) {
    if (!isSilent) console.error("Orders sync error:", err);
  }
}

function updatePendingBadge(orders) {
  const pendingCount = orders.filter(o => !o.delivered).length;
  const badge = document.getElementById('pending-orders-badge');
  if (badge) badge.innerText = pendingCount;
}

function renderActiveOrders(orders) {
  const box = document.getElementById('orders-list');
  if (!box) return;

  if (orders.length === 0) {
    box.innerHTML = "<p style='color: #64748b;'>Abhi tak koi order nahi aaya hai.</p>";
    return;
  }

  box.innerHTML = orders.map(o => {
    const itemsText = (o.items || []).map(i => `${i.name} (x${i.quantity}) - ₹${i.price * i.quantity}`).join('<br>');
    return `
      <div class="order-item-box ${o.delivered ? 'delivered-card' : ''}">
        <div class="order-header-line">
          <strong>Order ID: ${o.orderId}</strong>
          <span class="status-tag ${o.delivered ? 'delivered' : 'pending'}">
            ${o.delivered ? '✅ Delivered' : '⏳ Pending'}
          </span>
        </div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">
          <strong>Customer:</strong> ${o.customer ? o.customer.name : 'N/A'} (📞 ${o.customer ? o.customer.phone : 'N/A'})<br>
          <strong>Address:</strong> ${o.customer ? `${o.customer.houseNo || ''}, ${o.customer.address}, ${o.customer.city || ''}` : 'N/A'}<br>
          <strong>Order Time:</strong> ${o.date || 'N/A'}
          ${o.delivered && o.deliveredTimestamp ? `<br><strong style="color: #047857;">Delivered On:</strong> ${o.deliveredTimestamp}` : ''}
        </div>
        <div style="background: #f8fafc; padding: 8px; border-radius: 6px; font-size: 13px; margin-bottom: 8px;">
          <strong>Items:</strong><br>${itemsText}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 15px;">Total: ₹${o.total}</strong>
          <button class="primary-btn ${o.delivered ? 'green' : 'blue'}" style="width: auto; padding: 6px 14px; font-size: 13px;" onclick="toggleDelivery('${o.orderId}')">
            ${o.delivered ? 'Undo to Pending ↺' : 'Mark as Delivered ✔'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleDelivery(orderId) {
  try {
    const res = await fetch('/api/orders/toggle-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminOrders();
    }
  } catch (err) {
    alert("Delivery status update failed!");
  }
}

// Calendar Archive Filter
function filterDeliveredByCalendar() {
  const picker = document.getElementById('delivery-calendar-picker');
  const selectedDate = picker ? picker.value : "";
  const container = document.getElementById('calendar-delivered-list');
  const summary = document.getElementById('calendar-delivered-summary');

  if (!container) return;

  // Filter only delivered orders
  let deliveredOrders = allOrdersCache.filter(o => o.delivered);

  if (selectedDate) {
    deliveredOrders = deliveredOrders.filter(o => o.deliveredDate === selectedDate);
    summary.innerHTML = `📅 Date: <u>${selectedDate}</u> ko kul <strong>${deliveredOrders.length}</strong> items deliver huye:`;
  } else {
    summary.innerHTML = `All Time Delivered Orders: <strong>${deliveredOrders.length}</strong>`;
  }

  if (deliveredOrders.length === 0) {
    container.innerHTML = `<p style="color: #64748b; padding: 12px 0;">Is date ko koi delivered order record nahi mila.</p>`;
    return;
  }

  container.innerHTML = deliveredOrders.map(o => {
    const itemsList = (o.items || []).map(i => `<li>${i.name} — Qty: ${i.quantity} (₹${i.price * i.quantity})</li>`).join('');
    return `
      <div class="order-item-box delivered-card">
        <div class="order-header-line">
          <strong>${o.orderId}</strong>
          <span style="font-size: 12px; font-weight: bold; color: #047857;">Delivered Time: ${o.deliveredTimestamp || o.deliveredDate}</span>
        </div>
        <p style="font-size: 13px; margin: 4px 0;">Customer: <strong>${o.customer.name}</strong> (${o.customer.phone})</p>
        <p style="font-size: 12px; color: #475569;">Delivery Address: ${o.customer.houseNo || ''}, ${o.customer.address}, ${o.customer.city || ''}</p>
        <ul style="margin: 8px 0 8px 20px; font-size: 13px;">
          ${itemsList}
        </ul>
        <div style="font-weight: bold; text-align: right;">Total Amount: ₹${o.total}</div>
      </div>
    `;
  }).join('');
}

function resetCalendarFilter() {
  const picker = document.getElementById('delivery-calendar-picker');
  if (picker) picker.value = "";
  filterDeliveredByCalendar();
}

// ---------------- PRODUCT & CATEGORY MANAGEMENT ---------------- //

function handleImageSelection(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Photo 5MB se chhoti honi chahiye!");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    selectedImageBase64 = e.target.result;
    document.getElementById('prod-img-preview').src = selectedImageBase64;
    document.getElementById('image-preview-wrapper').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function addProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const price = document.getElementById('prod-price').value.trim();
  const category = document.getElementById('prod-category').value;
  const image = selectedImageBase64;

  if (!name || !price || !category || !image) {
    return alert("Saari details bharein aur photo select karein!");
  }

  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ name, price, category, image })
  });
  const data = await res.json();
  if (data.success) {
    alert("Product added successfully!");
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('image-preview-wrapper').style.display = 'none';
    selectedImageBase64 = "";
    toggleAccordion('add-prod-collapse');
    loadAdminProducts();
  } else {
    alert(data.message);
  }
}

async function loadAdminProducts() {
  const res = await fetch('/api/products');
  allProductsCache = await res.json();
  renderProductsList(allProductsCache);
}

function renderProductsList(list) {
  const box = document.getElementById('admin-products-list');
  if (list.length === 0) return box.innerHTML = "<p>No products added yet.</p>";

  box.innerHTML = list.map(p => `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="${p.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
        <div>
          <strong>${p.name}</strong>
          <div style="font-size: 12px; color: #64748b;">${p.category} | ₹${p.price}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="deleteProduct('${p.id}')">Delete</button>
    </div>
  `).join('');
}

function filterAdminProducts() {
  const q = document.getElementById('admin-search-input').value.toLowerCase();
  renderProductsList(allProductsCache.filter(p => p.name.toLowerCase().includes(q)));
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': adminToken } });
  loadAdminProducts();
}

async function loadAdminCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const select = document.getElementById('prod-category');
  const list = document.getElementById('category-list');
  if (select) select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (list) {
    list.innerHTML = cats.map(c => `
      <div style="display: inline-block; background: #e2e8f0; padding: 4px 10px; border-radius: 12px; margin: 4px; font-size: 13px;">
        ${c} <span style="cursor: pointer; color: red; font-weight: bold; margin-left: 4px;" onclick="deleteCategory('${c}')">&times;</span>
      </div>
    `).join('');
  }
}

async function addCategory() {
  const name = document.getElementById('new-category-input').value.trim();
  if (!name) return;
  await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-category-input').value = '';
  loadAdminCategories();
}

async function deleteCategory(name) {
  await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
  loadAdminCategories();
}

async function updateBanner() {
  const imageUrl = document.getElementById('banner-img-url').value.trim();
  const title = document.getElementById('banner-title').value.trim();
  await fetch('/api/banner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, title }) });
  alert("Banner Updated!");
}

async function loadAdminMessages(isSilent = false) {
  try {
    const res = await fetch('/api/support/messages');
    const msgs = await res.json();
    const box = document.getElementById('messages-list');
    if (box) {
      if (msgs.length === 0) return box.innerHTML = "<p>No support messages yet.</p>";
      box.innerHTML = msgs.map(m => `
        <div style="border-bottom: 1px solid #f1f5f9; padding: 8px 0;">
          <strong>${m.customerName}:</strong> ${m.text} <span style="font-size: 11px; color:#64748b;">(${m.time})</span>
        </div>
      `).join('');
    }
  } catch (e) {
    if (!isSilent) console.error("Chat sync error:", e);
  }
}