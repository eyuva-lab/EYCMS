const api = '';
let token = localStorage.getItem('token') || '';

const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});
const show = (id, payload) => (document.getElementById(id).innerText = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));

async function call(path, options = {}) {
  const res = await fetch(`${api}${path}`, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { res, data };
}

function setLoggedOut() {
  profile.innerText = 'Not logged in';
  loginCard.style.display = 'block';
}
function setLoggedIn(name, role) {
  profile.innerText = `${name} (${role})`;
  loginCard.style.display = 'none';
}

function activateView(viewId) {
  document.querySelectorAll('.nav-btn').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (navBtn) navBtn.classList.add('active');
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateView(btn.dataset.view));
  });
}

function applyRoleUI(role) {
  [navUsers, navMaster, navEvents, navTransactions, navReports].forEach((x) => (x.style.display = ''));
  if (role === 'FELLOW') {
    navUsers.style.display = 'none';
  }
  if (role === 'AUDITOR') {
    navUsers.style.display = 'none';
    navMaster.style.display = 'none';
    navTransactions.style.display = 'none';
  }
}

async function refreshSetupStatus() {
  const { res, data } = await call('/master/setup-status');
  if (!res.ok) return;
  stepUsers.innerText = `Users: ${data.users.done ? 'done' : 'pending'} (${data.users.count})`;
  stepProjects.innerText = `Projects/Fellows: ${data.projects.done ? 'done' : 'pending'} (${data.projects.count})`;
  stepHeads.innerText = `Budget Heads: ${data.budget_heads.done ? 'done' : 'pending'} (${data.budget_heads.count})`;
  stepAccounts.innerText = `Accounts & Bank: ${data.accounts.done ? 'done' : 'pending'} (${data.accounts.count})`;
}

async function login() {
  const body = new URLSearchParams({ username: email.value, password: password.value });
  const { res, data } = await call('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) return show('userActionResult', data);
  token = data.access_token;
  localStorage.setItem('token', token);
  await loadProfile();
}
function logout() {
  token = '';
  localStorage.removeItem('token');
  setLoggedOut();
  [navUsers, navMaster, navEvents, navTransactions, navReports].forEach((x) => (x.style.display = ''));
}
async function loadProfile() {
  if (!token) return setLoggedOut();
  const { res, data } = await call('/auth/me');
  if (!res.ok) return logout();
  setLoggedIn(data.name, data.role);
  applyRoleUI(data.role);
}

async function loadCentreSummary() {
  const { res, data } = await call('/transactions/centre-summary');
  if (!res.ok || !Array.isArray(data)) return;
  const tbody = document.querySelector('#centreTable tbody');
  tbody.innerHTML = '';
  data.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.budget_head_name}</td><td>${r.sanctioned}</td><td>${r.spent}</td><td>${r.remaining}</td><td>${r.utilized_pct}%</td>`;
    tbody.appendChild(tr);
  });
}

async function createAccount() {
  const payload = { code: accountCode.value, name: accountName.value, account_type: accountType.value };
  const { data } = await call('/master/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('masterResult', data); await listAccounts();
}
async function listAccounts() {
  const { res, data } = await call('/master/accounts');
  if (!res.ok) return show('masterResult', data);
  const tbody = document.querySelector('#accountsTable tbody');
  tbody.innerHTML = '';
  data.forEach((a) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${a.account_type}</td><td><button data-edit-account="${a.id}">Edit</button> <button data-del-account="${a.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}
async function editAccount(id) {
  const code = prompt('New account code:');
  const name = prompt('New account name:');
  if (!code || !name) return;
  const { data } = await call(`/master/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) });
  show('masterResult', data); await listAccounts();
}
async function deleteAccount(id) {
  if (!confirm('Delete this account?')) return;
  const { data } = await call(`/master/accounts/${id}`, { method: 'DELETE' });
  show('masterResult', data); await listAccounts();
}

async function createProject() {
  const payload = { code: projectCode.value, name: projectName.value };
  const { data } = await call('/master/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('masterResult', data); await listProjects();
}
async function listProjects() {
  const { res, data } = await call('/master/projects');
  if (!res.ok) return show('masterResult', data);
  const tbody = document.querySelector('#projectsTable tbody');
  tbody.innerHTML = '';
  data.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.id}</td><td>${p.code}</td><td>${p.name}</td><td><button data-edit-project="${p.id}">Edit</button> <button data-del-project="${p.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}
async function editProject(id) {
  const code = prompt('New project code:');
  const name = prompt('New project name:');
  if (!code || !name) return;
  const { data } = await call(`/master/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) });
  show('masterResult', data); await listProjects();
}
async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  const { data } = await call(`/master/projects/${id}`, { method: 'DELETE' });
  show('masterResult', data); await listProjects();
}

async function createHead() {
  const payload = { code: headCode.value, name: headName.value, project_id: headProjectId.value ? Number(headProjectId.value) : null, sanctioned_amount: Number(headAmount.value || 0) };
  const { data } = await call('/master/budget-heads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('masterResult', data); await listHeads();
}
async function listHeads() {
  const { res, data } = await call('/master/budget-heads');
  if (!res.ok) return show('masterResult', data);
  const tbody = document.querySelector('#headsTable tbody');
  tbody.innerHTML = '';
  data.forEach((h) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${h.id}</td><td>${h.code}</td><td>${h.name}</td><td>${h.project_id ?? '-'}</td><td>${h.sanctioned_amount}</td><td><button data-edit-head="${h.id}">Edit</button> <button data-del-head="${h.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}
async function editHead(id) {
  const name = prompt('New budget head name:');
  if (!name) return;
  const { data } = await call(`/master/budget-heads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  show('masterResult', data); await listHeads();
}
async function deleteHead(id) {
  if (!confirm('Delete this budget head?')) return;
  const { data } = await call(`/master/budget-heads/${id}`, { method: 'DELETE' });
  show('masterResult', data); await listHeads();
}

async function createBank() { const payload = { bank_name: bankName.value, account_number_masked: bankNumber.value }; const { data } = await call('/bank/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); }
async function listBank() { const { data } = await call('/bank/accounts'); show('masterResult', data); }

async function createUser() {
  const payload = { name: userName.value, email: userEmail.value, password: userPassword.value, role: userRole.value };
  const { data } = await call('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('userActionResult', data); await loadUsers();
}
async function loadUsers() {
  const { res, data } = await call('/users');
  if (!res.ok) return show('userActionResult', data);
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  data.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.is_active}</td><td><button data-edit-user="${u.id}">Edit</button> <button data-del-user="${u.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}
async function editUser(id) {
  const role = prompt('New role (COORDINATOR/FINANCE/FELLOW/AUDITOR):');
  if (!role) return;
  const { data } = await call(`/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  show('userActionResult', data); await loadUsers();
}
async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  const { data } = await call(`/users/${id}`, { method: 'DELETE' });
  show('userActionResult', data); await loadUsers();
}

async function createEvent() {
  const payload = { title: eventTitle.value, description: eventDesc.value, start_at: new Date().toISOString(), end_at: new Date(Date.now() + 3600000).toISOString(), prior_approval_required: true };
  const { data } = await call('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('eventResult', data);
}
async function listEvents() { const { data } = await call('/events'); show('eventResult', data); }

async function createTemplate() {
  const payload = { name: templateName.value, type: 'UC', layout_json: JSON.parse(templateJson.value || '{}'), header_config: { org: 'E-YUVA Centre' }, html_template: templateHtml.value };
  const { data } = await call('/reports/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('templateResult', data);
}
async function listTemplates() { const { data } = await call('/reports/templates'); show('templateResult', data); }

async function createTxn() { const payload = { txn_date: new Date().toISOString(), narration: txnNarration.value, lines: JSON.parse(txnLines.value || '[]') }; const { data } = await call('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('txnResult', data); }
async function listTxn() { const { data } = await call('/transactions'); show('txnResult', data); }

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.editAccount) editAccount(t.dataset.editAccount);
  if (t.dataset.delAccount) deleteAccount(t.dataset.delAccount);
  if (t.dataset.editProject) editProject(t.dataset.editProject);
  if (t.dataset.delProject) deleteProject(t.dataset.delProject);
  if (t.dataset.editHead) editHead(t.dataset.editHead);
  if (t.dataset.delHead) deleteHead(t.dataset.delHead);
  if (t.dataset.editUser) editUser(t.dataset.editUser);
  if (t.dataset.delUser) deleteUser(t.dataset.delUser);
});

loginBtn.onclick = login; logoutBtn.onclick = logout; refreshSummaryBtn.onclick = loadCentreSummary;
refreshSetupBtn.onclick = refreshSetupStatus; goUsersBtn.onclick = () => activateView('users'); goMasterBtn.onclick = () => activateView('master');
createAccountBtn.onclick = createAccount; loadAccountsBtn.onclick = listAccounts;
createProjectBtn.onclick = createProject; loadProjectsBtn.onclick = listProjects;
createHeadBtn.onclick = createHead; loadHeadsBtn.onclick = listHeads;
createBankBtn.onclick = createBank; listBankBtn.onclick = listBank;
createUserBtn.onclick = createUser; loadUsersBtn.onclick = loadUsers;
createEventBtn.onclick = createEvent; loadEventsBtn.onclick = listEvents;
saveTemplateBtn.onclick = createTemplate; loadTemplatesBtn.onclick = listTemplates;
createTxnBtn.onclick = createTxn; listTxnBtn.onclick = listTxn;

setupNav();
loadProfile();
refreshSetupStatus();
