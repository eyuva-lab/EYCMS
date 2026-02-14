const api = '';
let token = localStorage.getItem('token') || '';

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function showJson(id, payload) {
  document.getElementById(id).innerText = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function apiCall(path, options = {}) {
  const res = await fetch(`${api}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { res, data };
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
  const body = new URLSearchParams({
    username: document.getElementById('email').value,
    password: document.getElementById('password').value,
  });
  const { res, data } = await apiCall('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    showJson('userActionResult', data);
    return;
  }
  token = data.access_token;
  localStorage.setItem('token', token);
  await loadProfile();
}

async function loadProfile() {
  if (!token) return setLoggedOutUI();
  const { res, data } = await apiCall('/auth/me');
  if (!res.ok) return logout();
  document.getElementById('profile').innerText = `${data.name} (${data.role})`;
  setLoggedInUI();
}

async function loadCentreSummary() {
  const { res, data } = await apiCall('/transactions/centre-summary');
  if (!res.ok || !Array.isArray(data)) return;
  const tbody = document.querySelector('#centreTable tbody');
  tbody.innerHTML = '';
  data.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.budget_head_name}</td><td>${r.sanctioned}</td><td>${r.spent}</td><td>${r.remaining}</td><td>${r.utilized_pct}%</td>`;
    tbody.appendChild(tr);
  });
}

async function createSampleEvent() {
  const payload = { title: 'Workshop Review Meeting', description: 'Quarterly review with fellows', start_at: new Date().toISOString(), end_at: new Date(Date.now() + 3600000).toISOString(), prior_approval_required: true };
  const { data } = await apiCall('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('eventResult', data);
}

async function createTemplate() {
  const payload = { name: 'UC Basic Template', type: 'UC', layout_json: JSON.parse(document.getElementById('templateJson').value || '{}'), header_config: { org: 'E-YUVA Centre' }, html_template: document.getElementById('templateHtml').value };
  const { data } = await apiCall('/reports/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('templateResult', data);
}

async function listTemplates() {
  const { data } = await apiCall('/reports/templates');
  showJson('templateResult', data);
}

async function loadUsers() {
  const { res, data } = await apiCall('/users');
  if (!res.ok) return showJson('userActionResult', data);
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  data.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td>`;
    tbody.appendChild(tr);
  });
}

async function createUser() {
  const payload = { name: document.getElementById('userName').value, email: document.getElementById('userEmail').value, password: document.getElementById('userPassword').value, role: document.getElementById('userRole').value };
  const { data } = await apiCall('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('userActionResult', data);
  await loadUsers();
}

async function createAccount() {
  const payload = { code: document.getElementById('accountCode').value, name: document.getElementById('accountName').value, account_type: document.getElementById('accountType').value };
  const { data } = await apiCall('/master/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('opsResult', data);
}

async function listAccounts() { const { data } = await apiCall('/master/accounts'); showJson('opsResult', data); }

async function createProject() {
  const payload = { code: document.getElementById('projectCode').value, name: document.getElementById('projectName').value };
  const { data } = await apiCall('/master/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('opsResult', data);
}

async function listProjects() { const { data } = await apiCall('/master/projects'); showJson('opsResult', data); }

async function createHead() {
  const pidRaw = document.getElementById('headProjectId').value;
  const payload = {
    code: document.getElementById('headCode').value,
    name: document.getElementById('headName').value,
    project_id: pidRaw ? Number(pidRaw) : null,
    sanctioned_amount: Number(document.getElementById('headAmount').value || 0),
  };
  const { data } = await apiCall('/master/budget-heads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('opsResult', data);
}

async function listHeads() { const { data } = await apiCall('/master/budget-heads'); showJson('opsResult', data); }

async function createTransaction() {
  const payload = {
    txn_date: new Date().toISOString(),
    narration: document.getElementById('txnNarration').value,
    lines: JSON.parse(document.getElementById('txnLines').value || '[]'),
  };
  const { data } = await apiCall('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('opsResult', data);
}

async function listTransactions() { const { data } = await apiCall('/transactions'); showJson('opsResult', data); }

async function createBankAccount() {
  const payload = { bank_name: document.getElementById('bankName').value, account_number_masked: document.getElementById('bankNumber').value };
  const { data } = await apiCall('/bank/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  showJson('opsResult', data);
}

async function listBankAccounts() { const { data } = await apiCall('/bank/accounts'); showJson('opsResult', data); }

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('refreshSummaryBtn').addEventListener('click', loadCentreSummary);
document.getElementById('sampleEventBtn').addEventListener('click', createSampleEvent);
document.getElementById('saveTemplateBtn').addEventListener('click', createTemplate);
document.getElementById('loadTemplatesBtn').addEventListener('click', listTemplates);
document.getElementById('loadUsersBtn').addEventListener('click', loadUsers);
document.getElementById('createUserBtn').addEventListener('click', createUser);
document.getElementById('createAccountBtn').addEventListener('click', createAccount);
document.getElementById('loadAccountsBtn').addEventListener('click', listAccounts);
document.getElementById('createProjectBtn').addEventListener('click', createProject);
document.getElementById('loadProjectsBtn').addEventListener('click', listProjects);
document.getElementById('createHeadBtn').addEventListener('click', createHead);
document.getElementById('loadHeadsBtn').addEventListener('click', listHeads);
document.getElementById('createTxnBtn').addEventListener('click', createTransaction);
document.getElementById('listTxnBtn').addEventListener('click', listTransactions);
document.getElementById('createBankBtn').addEventListener('click', createBankAccount);
document.getElementById('listBankBtn').addEventListener('click', listBankAccounts);

setupTabs();
loadProfile();
