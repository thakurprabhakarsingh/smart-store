let adminToken = localStorage.getItem('adminToken') || null;
let isRegisterMode = false;
let allProductsCache = [];
let selectedImageBase64 = "";

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
  loadAdminCategories();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminMessages();
}

function logoutAdmin() {
  localStorage.removeItem('adminToken');
  location.reload();
}

function switchSection(secId, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(secId).classList.add('active');
  btn.classList.add('active');
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

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
  if (!confirm("Are you sure?")) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': adminToken } });
  loadAdminProducts();
}

async function loadAdminCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const select = document.getElementById('prod-category');
  const list = document.getElementById('category-list');
  select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  list.innerHTML = cats.map(c => `
    <div style="display: inline-block; background: #e2e8f0; padding: 4px 10px; border-radius: 12px; margin: 4px; font-size: 13px;">
      ${c} <span style="cursor: pointer; color: red; font-weight: bold; margin-left: 4px;" onclick="deleteCategory('${c}')">&times;</span>
    </div>
  `).join('');
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

async function loadAdminOrders() {
  const res = await fetch('/api/orders');
  const orders = await res.json();
  const box = document.getElementById('orders-list');
  if (orders.length === 0) return box.innerHTML = "<p>No orders placed yet.</p>";

  box.innerHTML = orders.map(o => `
    <div style="border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
      <strong>Order: ${o.orderId}</strong> - Total: ₹${o.total}
      <div>Customer: ${o.customer.name} (${o.customer.phone})</div>
      <div>Address: ${o.customer.houseNo || ''}, ${o.customer.address}, ${o.customer.city || ''}</div>
      <button class="primary-btn blue" style="width: auto; margin-top: 8px; padding: 6px 12px;" onclick="toggleDelivery('${o.orderId}')">
        ${o.delivered ? 'Status: Delivered ✅' : 'Status: Mark Delivered ⏳'}
      </button>
    </div>
  `).join('');
}

async function toggleDelivery(orderId) {
  await fetch('/api/orders/toggle-delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
  loadAdminOrders();
}

async function loadAdminMessages() {
  const res = await fetch('/api/support/messages');
  const msgs = await res.json();
  const box = document.getElementById('messages-list');
  if (msgs.length === 0) return box.innerHTML = "<p>No support messages yet.</p>";

  box.innerHTML = msgs.map(m => `
    <div style="border-bottom: 1px solid #f1f5f9; padding: 8px 0;">
      <strong>${m.customerName}:</strong> ${m.text} <span style="font-size: 11px; color:#64748b;">(${m.time})</span>
    </div>
  `).join('');
}