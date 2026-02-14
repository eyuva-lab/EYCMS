const api = '';
let token = localStorage.getItem('token') || '';
let generatedHtml = '';
let currentRole = '';

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
  currentRole = role;
  [navUsers, navMaster, navEvents, navTransactions, navReports].forEach((x) => (x.style.display = ''));
  const disableEdits = role === 'AUDITOR';

  if (role === 'FELLOW') {
    navUsers.style.display = 'none';
    navMaster.style.display = 'none';
  }
  if (role === 'AUDITOR') {
    navUsers.style.display = 'none';
    navMaster.style.display = 'none';
  }

  document.querySelectorAll('button').forEach((btn) => {
    if (btn.classList.contains('nav-btn') || btn.id === 'loginBtn' || btn.id === 'logoutBtn' || btn.id.startsWith('refresh') || btn.id.startsWith('load') || btn.id === 'listTxnBtn' || btn.id === 'downloadReportBtn') {
      return;
    }
    if (disableEdits) btn.disabled = true;
  });
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
  document.querySelectorAll('button').forEach((btn) => (btn.disabled = false));
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
  if (!res.ok || !Array.isArray(data)) return show('txnWarningResult', data);
  const tbody = document.querySelector('#centreTable tbody');
  tbody.innerHTML = '';
  data.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.budget_head_name}</td><td>${r.sanctioned}</td><td>${r.spent}</td><td>${r.remaining}</td><td>${r.utilized_pct}%</td>`;
    tbody.appendChild(tr);
  });
}

// MASTER CRUD
async function createAccount() { const payload = { code: accountCode.value, name: accountName.value, account_type: accountType.value }; const { data } = await call('/master/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listAccounts(); }
async function listAccounts() { const { res, data } = await call('/master/accounts'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#accountsTable tbody'); tbody.innerHTML = ''; data.forEach((a) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${a.account_type}</td><td><button data-edit-account="${a.id}">Edit</button> <button data-del-account="${a.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editAccount(id) { const code = prompt('New account code:'); const name = prompt('New account name:'); if (!code || !name) return; const { data } = await call(`/master/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) }); show('masterResult', data); await listAccounts(); }
async function deleteAccount(id) { if (!confirm('Delete this account?')) return; const { data } = await call(`/master/accounts/${id}`, { method: 'DELETE' }); show('masterResult', data); await listAccounts(); }

async function createProject() { const payload = { code: projectCode.value, name: projectName.value }; const { data } = await call('/master/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listProjects(); }
async function listProjects() { const { res, data } = await call('/master/projects'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#projectsTable tbody'); tbody.innerHTML = ''; data.forEach((p) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.id}</td><td>${p.code}</td><td>${p.name}</td><td><button data-edit-project="${p.id}">Edit</button> <button data-del-project="${p.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editProject(id) { const code = prompt('New project code:'); const name = prompt('New project name:'); if (!code || !name) return; const { data } = await call(`/master/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) }); show('masterResult', data); await listProjects(); }
async function deleteProject(id) { if (!confirm('Delete this project?')) return; const { data } = await call(`/master/projects/${id}`, { method: 'DELETE' }); show('masterResult', data); await listProjects(); }

async function createHead() { const payload = { code: headCode.value, name: headName.value, project_id: headProjectId.value ? Number(headProjectId.value) : null, sanctioned_amount: Number(headAmount.value || 0) }; const { data } = await call('/master/budget-heads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listHeads(); }
async function listHeads() { const { res, data } = await call('/master/budget-heads'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#headsTable tbody'); tbody.innerHTML = ''; data.forEach((h) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${h.id}</td><td>${h.code}</td><td>${h.name}</td><td>${h.project_id ?? '-'}</td><td>${h.sanctioned_amount}</td><td><button data-edit-head="${h.id}">Edit</button> <button data-del-head="${h.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editHead(id) { const name = prompt('New budget head name:'); if (!name) return; const { data } = await call(`/master/budget-heads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); show('masterResult', data); await listHeads(); }
async function deleteHead(id) { if (!confirm('Delete this budget head?')) return; const { data } = await call(`/master/budget-heads/${id}`, { method: 'DELETE' }); show('masterResult', data); await listHeads(); }

// USERS
async function createUser() { const payload = { name: userName.value, email: userEmail.value, password: userPassword.value, role: userRole.value }; const { data } = await call('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('userActionResult', data); await loadUsers(); }
async function loadUsers() { const { res, data } = await call('/users'); if (!res.ok) return show('userActionResult', data); const tbody = document.querySelector('#usersTable tbody'); tbody.innerHTML = ''; data.forEach((u) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.is_active}</td><td><button data-edit-user="${u.id}">Edit</button> <button data-del-user="${u.id}">Deactivate</button></td>`; tbody.appendChild(tr); }); }
async function editUser(id) { const role = prompt('New role (COORDINATOR/FINANCE/FELLOW/AUDITOR):'); if (!role) return; const { data } = await call(`/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }); show('userActionResult', data); await loadUsers(); }
async function deleteUser(id) { if (!confirm('Deactivate this user?')) return; const { data } = await call(`/users/${id}`, { method: 'DELETE' }); show('userActionResult', data); await loadUsers(); }

// EVENTS + PRIOR APPROVAL
async function createEvent() { const payload = { title: eventTitle.value, description: eventDesc.value, project_id: eventProjectId.value ? Number(eventProjectId.value) : null, budget_head_id: eventHeadId.value ? Number(eventHeadId.value) : null, start_at: new Date().toISOString(), end_at: new Date(Date.now() + 3600000).toISOString(), prior_approval_required: true }; const { data } = await call('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('eventResult', data); }
async function listEvents() { const { data } = await call('/events'); show('eventResult', data); }
async function generatePrior() { const { data } = await call(`/events/${priorEventId.value}/prior-approval?template_id=${priorTemplateId.value}`, { method: 'POST' }); show('eventResult', data); }

// TRANSACTIONS
function addTxnLineRow(defaults = {}) {
  const tbody = document.querySelector('#txnLinesTable tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input class="txn-account" type="number" value="${defaults.account_id || ''}"/></td>
    <td><input class="txn-project" type="number" value="${defaults.project_id || ''}"/></td>
    <td><input class="txn-head" type="number" value="${defaults.budget_head_id || ''}"/></td>
    <td><select class="txn-entry"><option ${defaults.entry_type === 'DEBIT' ? 'selected' : ''}>DEBIT</option><option ${defaults.entry_type === 'CREDIT' ? 'selected' : ''}>CREDIT</option></select></td>
    <td><input class="txn-amount" type="number" step="0.01" value="${defaults.amount || ''}"/></td>
    <td><button class="remove-line">Remove</button></td>`;
  tbody.appendChild(tr);
}
function collectTxnLines() {
  return Array.from(document.querySelectorAll('#txnLinesTable tbody tr')).map((tr) => ({
    account_id: Number(tr.querySelector('.txn-account').value),
    project_id: tr.querySelector('.txn-project').value ? Number(tr.querySelector('.txn-project').value) : null,
    budget_head_id: tr.querySelector('.txn-head').value ? Number(tr.querySelector('.txn-head').value) : null,
    entry_type: tr.querySelector('.txn-entry').value,
    amount: Number(tr.querySelector('.txn-amount').value),
  }));
}
async function checkBudgetWarning() { const { data } = await call('/transactions/budget-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectTxnLines()) }); show('txnWarningResult', data); }
async function createTxn() { const payload = { txn_date: new Date().toISOString(), narration: txnNarration.value, lines: collectTxnLines() }; const { data } = await call('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('txnResult', data); }
async function listTxn() {
  const qs = new URLSearchParams();
  if (txnFromDate.value) qs.set('from_date', `${txnFromDate.value}T00:00:00`);
  if (txnToDate.value) qs.set('to_date', `${txnToDate.value}T23:59:59`);
  const { data } = await call(`/transactions${qs.toString() ? '?' + qs.toString() : ''}`);
  show('txnResult', data);
}
async function deleteLastTxn() { const { data } = await call('/transactions/last', { method: 'DELETE' }); show('txnResult', data); }

// BANK RECONCILIATION
async function createBank() { const payload = { bank_name: bankName.value, account_number_masked: bankNumber.value }; const { data } = await call('/bank/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('txnWarningResult', data); await listBank(); }
async function listBank() {
  const { res, data } = await call('/bank/accounts');
  if (!res.ok) return show('txnWarningResult', data);
  bankAccountSelect.innerHTML = '';
  data.forEach((b) => {
    const op = document.createElement('option');
    op.value = b.id;
    op.textContent = `${b.id} - ${b.bank_name} (${b.account_number_masked})`;
    bankAccountSelect.appendChild(op);
  });
}
async function importStatement() {
  const rows = JSON.parse(statementRowsJson.value || '[]');
  const bankId = Number(bankAccountSelect.value);
  const { data } = await call(`/bank/statements/${bankId}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
  show('txnWarningResult', data);
  await loadStatements();
}
async function loadStatements() {
  const bankId = Number(bankAccountSelect.value);
  const { res, data } = await call(`/bank/statements/${bankId}`);
  if (!res.ok) return show('txnWarningResult', data);
  const tbody = document.querySelector('#statementTable tbody');
  tbody.innerHTML = '';
  data.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.id}</td><td>${s.statement_date}</td><td>${s.description}</td><td>${s.debit}</td><td>${s.credit}</td><td>${s.is_reconciled ? '✅' : '❌'}</td><td><input type="number" class="match-txn" /></td><td><button data-reconcile-line="${s.id}">Reconcile</button></td>`;
    tbody.appendChild(tr);
  });
}
async function reconcileLine(lineId, txnId) { const { data } = await call(`/bank/reconcile/${lineId}/${txnId}`, { method: 'POST' }); show('txnWarningResult', data); await loadStatements(); }

// REPORTS
async function createTemplate() {
  const payload = { name: templateName.value, type: templateType.value, layout_json: JSON.parse(templateJson.value || '{}'), header_config: { org: 'E-YUVA Centre' }, html_template: templateHtml.value };
  const { data } = await call('/reports/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('templateResult', data);
}
async function listTemplates() { const { data } = await call('/reports/templates'); show('templateResult', data); }
async function generateReport() {
  const payload = {
    template_id: Number(generateTemplateId.value),
    project_id: generateProjectId.value ? Number(generateProjectId.value) : null,
    from_date: generateFromDate.value || null,
    to_date: generateToDate.value || null,
    parameters: {},
  };
  const { data } = await call('/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('templateResult', data);
  generatedHtml = data.html_output || '';
  reportPreview.srcdoc = generatedHtml;
}
function downloadReport() {
  if (!generatedHtml) return;
  const blob = new Blob([generatedHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'generated-report.html';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.classList.contains('remove-line')) t.closest('tr')?.remove();
  if (t.dataset.editAccount) editAccount(t.dataset.editAccount);
  if (t.dataset.delAccount) deleteAccount(t.dataset.delAccount);
  if (t.dataset.editProject) editProject(t.dataset.editProject);
  if (t.dataset.delProject) deleteProject(t.dataset.delProject);
  if (t.dataset.editHead) editHead(t.dataset.editHead);
  if (t.dataset.delHead) deleteHead(t.dataset.delHead);
  if (t.dataset.editUser) editUser(t.dataset.editUser);
  if (t.dataset.delUser) deleteUser(t.dataset.delUser);
  if (t.dataset.reconcileLine) {
    const txnId = t.closest('tr')?.querySelector('.match-txn')?.value;
    if (txnId) reconcileLine(t.dataset.reconcileLine, txnId);
  }
});

loginBtn.onclick = login;
logoutBtn.onclick = logout;
refreshSummaryBtn.onclick = loadCentreSummary;
refreshSetupBtn.onclick = refreshSetupStatus;
goUsersBtn.onclick = () => activateView('users');
goMasterBtn.onclick = () => activateView('master');

createAccountBtn.onclick = createAccount; loadAccountsBtn.onclick = listAccounts;
createProjectBtn.onclick = createProject; loadProjectsBtn.onclick = listProjects;
createHeadBtn.onclick = createHead; loadHeadsBtn.onclick = listHeads;

createUserBtn.onclick = createUser; loadUsersBtn.onclick = loadUsers;

createEventBtn.onclick = createEvent; loadEventsBtn.onclick = listEvents; generatePriorBtn.onclick = generatePrior;

addTxnLineBtn.onclick = () => addTxnLineRow();
checkBudgetBtn.onclick = checkBudgetWarning;
createTxnBtn.onclick = createTxn; listTxnBtn.onclick = listTxn; deleteLastTxnBtn.onclick = deleteLastTxn;

createBankBtn.onclick = createBank; listBankBtn.onclick = listBank; loadStatementsBtn.onclick = loadStatements; importStatementBtn.onclick = importStatement;

saveTemplateBtn.onclick = createTemplate; loadTemplatesBtn.onclick = listTemplates;
generateReportBtn.onclick = generateReport; downloadReportBtn.onclick = downloadReport;

setupNav();
addTxnLineRow({ account_id: 1, project_id: 1, budget_head_id: 1, entry_type: 'DEBIT', amount: 1000 });
addTxnLineRow({ account_id: 2, project_id: 1, budget_head_id: 1, entry_type: 'CREDIT', amount: 1000 });
loadProfile();
refreshSetupStatus();
listBank();
