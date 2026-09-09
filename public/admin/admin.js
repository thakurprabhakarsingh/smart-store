let adminToken = localStorage.getItem('adminToken');
let allProducts = [];

window.onload = () => {
  if (adminToken) showDashboard();
};

function switchSection(secId, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(secId).classList.add('active');
  btn.classList.add('active');
}

function toggleAccordion(id) {
  const elem = document.getElementById(id);
  const isOpen = elem.style.display === 'block';
  elem.style.display = isOpen ? 'none' : 'block';
  const icon = document.getElementById('add-prod-icon');
  if (icon) icon.innerText = isOpen ? '▼' : '▲';
}

function toggleItemCollapse(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function switchAuthTab(tab) {
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('reg-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login-btn').className = tab === 'login' ? 'active' : '';
  document.getElementById('tab-reg-btn').className = tab === 'register' ? 'active' : '';
}

async function adminLogin() {
  const username = document.getElementById('admin-user').value.trim();
  const password = document.getElementById('admin-pass').value.trim();

  if (!username || !password) return alert("Username aur password enter karein!");

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token || 'admin-logged-in';
      localStorage.setItem('adminToken', adminToken);
      showDashboard();
    } else {
      alert("Login Failed: " + data.message);
    }
  } catch (err) {
    alert("Connection Error: " + err.message);
  }
}

async function adminRegister() {
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value.trim();
  const secretKey = document.getElementById('reg-secret').value.trim();

  if (!username || !password) return alert("Username aur Password dono zaroori hain!");

  try {
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, secretKey })
    });
    const data = await res.json();
    if (data.success) {
      alert("Admin Registered Successfully! Please Login.");
      switchAuthTab('login');
    } else {
      alert("Error: " + data.message);
    }
  } catch (err) {
    alert("Connection Error: " + err.message);
  }
}

function showDashboard() {
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.body.style.background = '#f8fafc';
  loadBannerData();
  loadAdminCategories();
  loadAdminProducts();
  loadOrders();
  loadSupportThreads();
}

function adminLogout() {
  localStorage.removeItem('adminToken');
  location.reload();
}

async function loadAdminProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProductsList(allProducts);
  } catch (err) {
    console.error(err);
  }
}

function filterAdminProducts() {
  const term = document.getElementById('admin-search-input').value.toLowerCase();
  const filtered = allProducts.filter(p => 
    p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term))
  );
  renderProductsList(filtered);
}

function renderProductsList(list) {
  const container = document.getElementById('admin-products-list');
  if (list.length === 0) {
    container.innerHTML = "<p style='color: #64748b;'>No matching products found.</p>";
    return;
  }

  container.innerHTML = list.map(p => `
    <div class="prod-manage-box">
      <div class="prod-manage-left">
        <img src="${p.image}" alt="${p.name}">
        <div>
          <strong>${p.name}</strong> <span style="font-size: 12px; color: #64748b;">(${p.category})</span>
          <p style="margin: 2px 0 0 0; color: #64748b; font-size: 13px;">Price: ₹${p.price}</p>
        </div>
      </div>
      <div class="prod-manage-actions">
        <span>₹</span>
        <input type="number" id="price-${p.id}" value="${p.price}">
        <button class="btn-update" onclick="updatePrice('${p.id}')">Update</button>
        <button class="btn-delete" onclick="deleteProduct('${p.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const price = document.getElementById('prod-price').value.trim();
  const category = document.getElementById('prod-category').value;
  const image = document.getElementById('prod-image').value.trim();

  if (!name || !price || !category || !image) return alert("Fill all details!");

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
    document.getElementById('prod-image').value = '';
    toggleAccordion('add-prod-collapse');
    loadAdminProducts();
  } else alert(data.message);
}

async function updatePrice(id) {
  const price = document.getElementById(`price-${id}`).value;
  const res = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ price })
  });
  const data = await res.json();
  if (data.success) {
    alert("Price updated!");
    loadAdminProducts();
  } else alert(data.message);
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': adminToken }
  });
  const data = await res.json();
  if (data.success) loadAdminProducts();
  else alert(data.message);
}

async function loadOrders() {
  const res = await fetch('/api/orders', {
    headers: { 'Authorization': adminToken }
  });
  if (!res.ok) return;
  const orders = await res.json();
  const list = document.getElementById('orders-list');

  if (orders.length === 0) return list.innerHTML = "<p>No orders yet.</p>";

  list.innerHTML = orders.map((o, idx) => `
    <div class="order-accordion-item">
      <div class="order-header-bar" onclick="toggleItemCollapse('order-body-${idx}')">
        <div>
          <strong>${o.orderId}</strong> — ${o.customer ? o.customer.name : 'Customer'} (₹${o.total})
        </div>
        <div>
          <span style="font-size: 13px; font-weight: bold; color: ${o.delivered ? '#16a34a' : '#d97706'};">
            ${o.delivered ? '✅ Delivered' : '⏳ Pending'}
          </span>
          <span style="margin-left: 8px;">▼</span>
        </div>
      </div>
      <div id="order-body-${idx}" class="order-body-content">
        <p><b>Phone:</b> ${o.customer ? o.customer.phone : 'N/A'}</p>
        <p><b>Delivery Address:</b> ${o.customer ? o.customer.address : 'N/A'}</p>
        <p><b>Items:</b> ${(o.items || []).map(i => `${i.name} (${i.quantity})`).join(', ')}</p>
        <p><b>Order Date:</b> ${o.date}</p>
        <hr>
        <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: bold; cursor: pointer;">
          <input type="checkbox" onchange="toggleDelivery('${o.orderId}')" ${o.delivered ? 'checked' : ''}>
          Mark Delivered
        </label>
      </div>
    </div>
  `).join('');
}

async function toggleDelivery(orderId) {
  await fetch('/api/orders/toggle-delivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ orderId })
  });
  loadOrders();
}

async function loadSupportThreads() {
  const res = await fetch('/api/support/messages');
  const allMessages = await res.json();
  const list = document.getElementById('admin-support-list');

  if (allMessages.length === 0) return list.innerHTML = "<p>No customer messages.</p>";

  const threads = {};
  allMessages.forEach(m => {
    if (!threads[m.customerId]) threads[m.customerId] = { name: m.customerName, messages: [] };
    threads[m.customerId].messages.push(m);
  });

  list.innerHTML = Object.keys(threads).map((cid, idx) => {
    const thread = threads[cid];
    return `
      <div class="chat-thread-box">
        <div class="chat-thread-header" onclick="toggleItemCollapse('chat-thread-${idx}')">
          <strong>👤 ${thread.name} (${cid})</strong>
          <span>${thread.messages.length} messages ▼</span>
        </div>
        <div id="chat-thread-${idx}" class="chat-thread-body">
          <div class="chat-bubble-stream">
            ${thread.messages.map(m => `
              <div style="font-size: 13px; color: ${m.sender === 'admin' ? '#2563eb' : '#1e293b'};">
                <b>${m.sender === 'admin' ? 'Admin' : thread.name}:</b> ${m.text}
                <span style="font-size: 10px; color: #94a3b8;">(${m.time})</span>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="reply-${cid}" placeholder="Type reply...">
            <button class="primary-btn" style="width: auto;" onclick="replyToCustomer('${cid}', '${thread.name}')">Send</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function replyToCustomer(cid, cname) {
  const input = document.getElementById(`reply-${cid}`);
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/support/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: cid, customerName: cname, text, sender: 'admin' })
  });

  input.value = '';
  loadSupportThreads();
}

async function loadBannerData() {
  const res = await fetch('/api/banner');
  const banner = await res.json();
  if (banner) {
    document.getElementById('banner-img').value = banner.imageUrl || "";
    document.getElementById('banner-text').value = banner.title || "";
  }
}

async function saveBanner() {
  const imageUrl = document.getElementById('banner-img').value;
  const title = document.getElementById('banner-text').value;

  const res = await fetch('/api/banner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ imageUrl, title })
  });
  const data = await res.json();
  if (data.success) alert("Banner updated!");
  else alert(data.message);
}

async function loadAdminCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();

  document.getElementById('admin-category-chips').innerHTML = cats.map(c => `
    <div class="cat-chip-item">${c} <span onclick="deleteCategory('${c}')">&times;</span></div>
  `).join('');

  document.getElementById('prod-category').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

async function addCategory() {
  const name = document.getElementById('new-category').value.trim();
  if (!name) return;

  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('new-category').value = '';
    loadAdminCategories();
  } else alert(data.message);
}

async function deleteCategory(name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  await fetch(`/api/categories/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { 'Authorization': adminToken }
  });
  loadAdminCategories();
}