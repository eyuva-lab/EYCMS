const api = '';
let token = localStorage.getItem('token') || '';

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  loadProfile();
}

async function loadProfile() {
  if (!token) return;
  const res = await fetch(`${api}/auth/me`, { headers: authHeaders() });
  if (!res.ok) return;
  const me = await res.json();
  document.getElementById('profile').innerText = `${me.name} (${me.role})`;
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

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('refreshSummaryBtn').addEventListener('click', loadCentreSummary);
document.getElementById('sampleEventBtn').addEventListener('click', createSampleEvent);
document.getElementById('saveTemplateBtn').addEventListener('click', createTemplate);
setupTabs();
loadProfile();
