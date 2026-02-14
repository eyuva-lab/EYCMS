const api = '';
let token = localStorage.getItem('token') || '';

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setLoggedOutUI() {
  document.getElementById('profile').innerText = 'Not logged in';
  document.getElementById('loginCard').style.display = 'block';
}

function setLoggedInUI() {
  document.getElementById('loginCard').style.display = 'none';
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });
}

function logout() {
  token = '';
  localStorage.removeItem('token');
  setLoggedOutUI();
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('profile').textContent = data.detail || 'Login failed';
    return;
  }
  token = data.access_token;
  localStorage.setItem('token', token);
  await loadProfile();
}

async function loadProfile() {
  if (!token) {
    setLoggedOutUI();
    return;
  }
  const res = await fetch(`${api}/auth/me`, { headers: authHeaders() });
  if (!res.ok) {
    logout();
    return;
  }
  const me = await res.json();
  document.getElementById('profile').innerText = `${me.name} (${me.role})`;
  setLoggedInUI();
}

async function loadCentreSummary() {
  const res = await fetch(`${api}/transactions/centre-summary`, { headers: authHeaders() });
  const rows = await res.json();
  if (!res.ok || !Array.isArray(rows)) return;
  const tbody = document.querySelector('#centreTable tbody');
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.budget_head_name}</td><td>${r.sanctioned}</td><td>${r.spent}</td><td>${r.remaining}</td><td>${r.utilized_pct}%</td>`;
    tbody.appendChild(tr);
  });
}

async function createSampleEvent() {
  const payload = {
    title: 'Workshop Review Meeting',
    description: 'Quarterly review with fellows',
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    prior_approval_required: true,
  };
  const res = await fetch(`${api}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  document.getElementById('eventResult').innerText = JSON.stringify(await res.json(), null, 2);
}

async function createTemplate() {
  const layout = JSON.parse(document.getElementById('templateJson').value || '{}');
  const html = document.getElementById('templateHtml').value;
  const payload = {
    name: 'UC Basic Template',
    type: 'UC',
    layout_json: layout,
    header_config: { org: 'E-YUVA Centre' },
    html_template: html,
  };
  const res = await fetch(`${api}/reports/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  document.getElementById('templateResult').innerText = JSON.stringify(await res.json(), null, 2);
}

async function loadUsers() {
  const res = await fetch(`${api}/users`, { headers: authHeaders() });
  const data = await res.json();
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';

  if (!res.ok) {
    document.getElementById('userActionResult').innerText = data.detail || 'Could not load users';
    return;
  }

  data.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td>`;
    tbody.appendChild(tr);
  });
}

async function createUser() {
  const payload = {
    name: document.getElementById('userName').value,
    email: document.getElementById('userEmail').value,
    password: document.getElementById('userPassword').value,
    role: document.getElementById('userRole').value,
  };
  const res = await fetch(`${api}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  document.getElementById('userActionResult').innerText = JSON.stringify(data, null, 2);
  if (res.ok) {
    document.getElementById('userPassword').value = '';
    await loadUsers();
  }
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('refreshSummaryBtn').addEventListener('click', loadCentreSummary);
document.getElementById('sampleEventBtn').addEventListener('click', createSampleEvent);
document.getElementById('saveTemplateBtn').addEventListener('click', createTemplate);
document.getElementById('loadUsersBtn').addEventListener('click', loadUsers);
document.getElementById('createUserBtn').addEventListener('click', createUser);

setupTabs();
loadProfile();
