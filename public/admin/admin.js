let adminToken = localStorage.getItem('adminToken') || null;
let isRegisterMode = false;
let allProductsCache = [];
let allOrdersCache = [];
let selectedImageBase64 = "";
let liveOrdersPoller = null;

window.onload = () => {
  if (adminToken) showDashboard();
};

function toggleAdminAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').innerText = isRegisterMode ? "Admin Registration" : "Admin Login";
  document.getElementById('reg-secret-field').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('auth-submit-btn').innerText = isRegisterMode ? "Register Admin" : "Login";
}

async function loginAdmin() {
  const username = document.getElementById('admin-user').value.trim();
  const password = document.getElementById('admin-pass').value.trim();
  const secretKey = document.getElementById('admin-secret').value.trim();

  if (!username || !password) return alert("Credentials bharein!");

  const endpoint = isRegisterMode ? '/api/admin/register' : '/api/admin/login';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, secretKey })
  });

  const data = await res.json();
  if (data.success) {
    if (isRegisterMode) {
      alert("Registered! Ab login karein.");
      toggleAdminAuthMode();
    } else {
      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      showDashboard();
    }
  } else {
    alert(data.message);
  }
}

function showDashboard() {
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  loadAdminCategories();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminBanners();
  loadAdminMessages();

  if (!liveOrdersPoller) {
    liveOrdersPoller = setInterval(() => {
      loadAdminOrders(true);
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

  if (secId === 'calendar-sec') filterDeliveredByCalendar();
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

// ---------------- ORDERS: ONLY PENDING LIVE LIST ---------------- //
async function loadAdminOrders(isSilent = false) {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();

    if (JSON.stringify(allOrdersCache) === JSON.stringify(orders)) return;

    allOrdersCache = orders;
    renderPendingOrders(allOrdersCache);

    const pendingOrders = allOrdersCache.filter(o => !o.delivered);
    document.getElementById('pending-orders-badge').innerText = pendingOrders.length;

    if (document.getElementById('calendar-sec').classList.contains('active')) {
      filterDeliveredByCalendar();
    }
  } catch (err) {
    if (!isSilent) console.error(err);
  }
}

function renderPendingOrders(orders) {
  const box = document.getElementById('orders-list');
  // Sirf non-delivered (pending) orders yahan dikhenge
  const pendingOnly = orders.filter(o => !o.delivered);

  if (pendingOnly.length === 0) {
    box.innerHTML = "<p style='color: #64748b; padding: 12px 0;'>Koi naya pending order nahi hai.</p>";
    return;
  }

  box.innerHTML = pendingOnly.map(o => {
    const itemsText = (o.items || []).map(i => `${i.name} (x${i.quantity}) - ₹${i.price * i.quantity}`).join('<br>');
    return `
      <div class="order-item-box" id="order-card-${o.orderId}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>Order ID: ${o.orderId}</strong>
          <span style="background: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">⏳ Pending</span>
        </div>
        <div style="font-size: 13px; color: #475569; margin: 6px 0;">
          <strong>Customer:</strong> ${o.customer.name} (📞 ${o.customer.phone})<br>
          <strong>Address:</strong> ${o.customer.houseNo || ''}, ${o.customer.address}, ${o.customer.city || ''}<br>
          <strong>Time:</strong> ${o.date}
        </div>
        <div style="background: #f8fafc; padding: 8px; border-radius: 6px; font-size: 13px; margin-bottom: 8px;">
          ${itemsText}
        </div>
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 10px;">
          Total: ₹${o.total}
        </div>
        <div class="order-actions-row">
          <button class="primary-btn purple" onclick="printOrderBill('${o.orderId}')">🖨️ Print Bill</button>
          <button class="primary-btn amber" onclick="shareOrderBillWhatsApp('${o.orderId}')">📲 Share WhatsApp</button>
          <button class="primary-btn green" onclick="markDelivered('${o.orderId}')">✔ Mark Delivered</button>
        </div>
      </div>
    `;
  }).join('');
}

async function markDelivered(orderId) {
  const res = await fetch('/api/orders/toggle-delivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId })
  });
  const data = await res.json();
  if (data.success) {
    // Turant screen se hat jayega
    loadAdminOrders();
  }
}

// ---------------- BILL PRINT & WHATSAPP SHARE ---------------- //
function printOrderBill(orderId) {
  const order = allOrdersCache.find(o => o.orderId === orderId);
  if (!order) return;

  const printArea = document.getElementById('print-area');
  printArea.style.display = 'block';

  let itemsRows = (order.items || []).map(i => `
    <tr>
      <td style="padding: 4px;">${i.name}</td>
      <td style="text-align: center; padding: 4px;">${i.quantity}</td>
      <td style="text-align: right; padding: 4px;">₹${i.price * i.quantity}</td>
    </tr>
  `).join('');

  printArea.innerHTML = `
    <div style="max-width: 320px; margin: auto; border: 1px dashed #000; padding: 15px; font-family: monospace;">
      <h2 style="text-align: center; margin: 0;">SMART STORE</h2>
      <p style="text-align: center; margin: 4px 0;">Retail Invoice / Cash Memo</p>
      <hr style="border: 0.5px dashed #000;">
      <p style="margin: 2px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
      <p style="margin: 2px 0;"><strong>Date:</strong> ${order.date}</p>
      <p style="margin: 2px 0;"><strong>Customer:</strong> ${order.customer.name}</p>
      <p style="margin: 2px 0;"><strong>Phone:</strong> ${order.customer.phone}</p>
      <p style="margin: 2px 0;"><strong>Address:</strong> ${order.customer.houseNo || ''}, ${order.customer.address}, ${order.customer.city || ''}</p>
      <hr style="border: 0.5px dashed #000;">
      <table style="width: 100%; font-size: 13px;">
        <thead>
          <tr><th style="text-align: left;">Item</th><th>Qty</th><th style="text-align: right;">Amount</th></tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <hr style="border: 0.5px dashed #000;">
      <h3 style="text-align: right; margin: 6px 0;">TOTAL: ₹${order.total}</h3>
      <p style="text-align: center; margin-top: 15px;">Thank You for Shopping With Us!</p>
    </div>
  `;

  window.print();
  printArea.style.display = 'none';
}

function shareOrderBillWhatsApp(orderId) {
  const order = allOrdersCache.find(o => o.orderId === orderId);
  if (!order) return;

  const itemsText = (order.items || []).map((i, idx) => `${idx + 1}. ${i.name} (x${i.quantity}) - ₹${i.price * i.quantity}`).join('%0A');
  const message = `*🧾 SMART STORE - ORDER BILL*%0A---------------------------%0A*Order ID:* ${order.orderId}%0A*Customer:* ${order.customer.name}%0A*Address:* ${order.customer.houseNo || ''}, ${order.customer.address}, ${order.customer.city || ''}%0A*Date:* ${order.date}%0A---------------------------%0A*Items:*%0A${itemsText}%0A---------------------------%0A*TOTAL AMOUNT:* ₹${order.total}%0A%0A_Thank you for ordering with us!_`;

  const phoneClean = order.customer.phone.replace(/[^0-9]/g, '');
  window.open(`https://api.whatsapp.com/send?phone=91${phoneClean}&text=${message}`, '_blank');
}

// ---------------- DELIVERED CALENDAR ARCHIVE ---------------- //
function filterDeliveredByCalendar() {
  const picker = document.getElementById('delivery-calendar-picker');
  const selectedDate = picker ? picker.value : "";
  const container = document.getElementById('calendar-delivered-list');
  const summary = document.getElementById('calendar-delivered-summary');

  let deliveredOrders = allOrdersCache.filter(o => o.delivered);

  if (selectedDate) {
    deliveredOrders = deliveredOrders.filter(o => o.deliveredDate === selectedDate);
    summary.innerHTML = `📅 Date <u>${selectedDate}</u> ko deliver huye orders: <strong>${deliveredOrders.length}</strong>`;
  } else {
    summary.innerHTML = `Kul Delivered Orders: <strong>${deliveredOrders.length}</strong>`;
  }

  if (deliveredOrders.length === 0) {
    container.innerHTML = "<p style='color: #64748b;'>Is date ko koi delivered order nahi mila.</p>";
    return;
  }

  container.innerHTML = deliveredOrders.map(o => `
    <div class="order-item-box delivered-card">
      <div style="display: flex; justify-content: space-between;">
        <strong>${o.orderId}</strong>
        <span style="color: #047857; font-weight: bold; font-size: 12px;">Delivered on: ${o.deliveredTimestamp || o.deliveredDate}</span>
      </div>
      <p style="margin: 4px 0; font-size: 13px;">Customer: <strong>${o.customer.name}</strong> (${o.customer.phone})</p>
      <p style="font-size: 12px; color: #475569;">${o.customer.houseNo || ''}, ${o.customer.address}</p>
      <div style="font-weight: bold; margin-top: 6px;">Total: ₹${o.total}</div>
    </div>
  `).join('');
}

function resetCalendarFilter() {
  const picker = document.getElementById('delivery-calendar-picker');
  if (picker) picker.value = "";
  filterDeliveredByCalendar();
}

// ---------------- PRODUCTS & BEST DEALS ---------------- //
function handleImageSelection(event) {
  const file = event.target.files[0];
  if (!file) return;

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
  const isBestDeal = document.getElementById('prod-best-deal').checked;
  const image = selectedImageBase64;

  if (!name || !price || !category || !image) return alert("Saari details bharein!");

  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ name, price, category, image, isBestDeal })
  });

  const data = await res.json();
  if (data.success) {
    alert("Product added successfully!");
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-best-deal').checked = false;
    document.getElementById('image-preview-wrapper').style.display = 'none';
    selectedImageBase64 = "";
    toggleAccordion('add-prod-collapse');
    loadAdminProducts();
  }
}

async function loadAdminProducts() {
  const res = await fetch('/api/products');
  allProductsCache = await res.json();
  renderProductsList(allProductsCache);
}

function renderProductsList(list) {
  const box = document.getElementById('admin-products-list');
  box.innerHTML = list.map(p => `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="${p.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
        <div>
          <strong>${p.name}</strong> ${p.isBestDeal ? '<span class="best-deal-tag">🔥 Best Deal</span>' : ''}
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
  if (!confirm("Are you sure?")) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': adminToken } });
  loadAdminProducts();
}

// ---------------- MULTI-BANNER MANAGEMENT ---------------- //
async function loadAdminBanners() {
  const res = await fetch('/api/banners');
  const banners = await res.json();
  const box = document.getElementById('banners-list');
  box.innerHTML = banners.map(b => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${b.imageUrl}" style="width: 80px; height: 40px; object-fit: cover; border-radius: 4px;">
        <span>${b.title || 'Untitled Banner'}</span>
      </div>
      <button class="logout-btn" style="padding: 4px 10px;" onclick="deleteBanner('${b._id}')">Remove</button>
    </div>
  `).join('');
}

async function addBanner() {
  const imageUrl = document.getElementById('banner-img-url').value.trim();
  const title = document.getElementById('banner-title').value.trim();
  if (!imageUrl) return alert("Banner Image URL bharein!");

  await fetch('/api/banners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, title })
  });

  document.getElementById('banner-img-url').value = '';
  document.getElementById('banner-title').value = '';
  loadAdminBanners();
}

async function deleteBanner(id) {
  await fetch(`/api/banners/${id}`, { method: 'DELETE' });
  loadAdminBanners();
}

// ---------------- CATEGORIES & SUPPORT ---------------- //
async function loadAdminCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const select = document.getElementById('prod-category');
  const list = document.getElementById('category-list');
  if (select) select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (list) {
    list.innerHTML = cats.map(c => `
      <div style="display: inline-block; background: #e2e8f0; padding: 4px 10px; border-radius: 12px; margin: 4px; font-size: 13px;">
        ${c} <span style="cursor: pointer; color: red; font-weight: bold;" onclick="deleteCategory('${c}')">&times;</span>
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

async function loadAdminMessages(isSilent = false) {
  try {
    const res = await fetch('/api/support/messages');
    const msgs = await res.json();
    const box = document.getElementById('messages-list');
    if (box) {
      box.innerHTML = msgs.map(m => `
        <div style="border-bottom: 1px solid #f1f5f9; padding: 8px 0;">
          <strong>${m.customerName}:</strong> ${m.text} <span style="font-size: 11px; color:#64748b;">(${m.time})</span>
        </div>
      `).join('');
    }
  } catch (e) {
    if (!isSilent) console.error(e);
  }
}