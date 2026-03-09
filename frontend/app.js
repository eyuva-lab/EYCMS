const api = '';
let token = localStorage.getItem('token') || '';
let generatedHtml = '';
let parsedStatementRows = [];
let selectedBuilderIndex = -1;

const txnTypeStorageKey = 'txnTypes.v1';
const defaultTxnTypes = [
  { id: 'office-expense', name: 'Office Expense', debit_account_id: 5, credit_account_id: 2 },
  { id: 'travel-advance', name: 'Travel Advance', debit_account_id: 6, credit_account_id: 2 },
  { id: 'vendor-payment', name: 'Vendor Payment', debit_account_id: 7, credit_account_id: 2 },
];

const builderBlocks = [];

const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});
const show = (id, payload) => (document.getElementById(id).innerText = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));

async function call(path, options = {}) {
  const res = await fetch(`${api}${path}`, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { res, data };
}

function setLoggedOut() { profile.innerText = 'Not logged in'; loginCard.style.display = 'block'; }
function setLoggedIn(name, role) { profile.innerText = `${name} (${role})`; loginCard.style.display = 'none'; }

function clearProtectedPanels() {
  ['masterResult', 'userActionResult', 'txnWarningResult', 'txnResult', 'reconcileResult', 'eventResult', 'templateResult', 'importPreviewResult'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerText = '';
  });

  ['#centreTable tbody', '#txnTable tbody', '#statementTable tbody', '#eventsTable tbody', '#accountsTable tbody', '#projectsTable tbody', '#headsTable tbody', '#usersTable tbody'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = '';
  });
  reportPreview.srcdoc = '';
  generatedHtml = '';
}

function activateView(viewId) {
  document.querySelectorAll('.nav-btn').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById(viewId)?.classList.add('active');
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => activateView(btn.dataset.view)));
  document.querySelectorAll('.subtab').forEach((btn) => {
    if (!btn.dataset.subview) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab[data-subview]').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.subview').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.subview)?.classList.add('active');
    });
  });
}

function applyRoleUI(role) {
  [navUsers, navMaster, navTransactions, navReconcile, navEventsReports].forEach((x) => (x.style.display = ''));
  document.querySelectorAll('button').forEach((btn) => (btn.disabled = false));

  if (role === 'FELLOW') {
    navUsers.style.display = 'none';
    navMaster.style.display = 'none';
  }
  if (role === 'AUDITOR') {
    navUsers.style.display = 'none';
    navMaster.style.display = 'none';
    document.querySelectorAll('button').forEach((btn) => {
      if (btn.classList.contains('nav-btn') || btn.classList.contains('subtab') || btn.id.startsWith('load') || btn.id.startsWith('refresh') || btn.id === 'listTxnBtn' || btn.id === 'downloadReportBtn' || btn.id === 'logoutBtn' || btn.id === 'previewImportBtn') return;
      btn.disabled = true;
    });
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
  await bootstrapData();
}
function logout() {
  token = '';
  localStorage.removeItem('token');
  clearProtectedPanels();
  activateView('dashboard');
  setLoggedOut();
}
async function loadProfile() {
  if (!token) return setLoggedOut();
  const { res, data } = await call('/auth/me');
  if (!res.ok) return logout();
  setLoggedIn(data.name, data.role);
  applyRoleUI(data.role);
  await Promise.all([loadProjectOptions(), loadHeadOptions(), loadTemplateOptions(), loadTxnTypeOptions()]);
}

async function bootstrapData() {
  if (!token) return;
  await Promise.all([refreshSetupStatus(), listBank(), listTxn(), listEvents(), loadCentreSummary()]);
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

async function loadProjectOptions() {
  const { res, data } = await call('/master/projects');
  if (!res.ok) return;
  txnFilterProject.innerHTML = '<option value="">All Projects</option>';
  generateProjectSelect.innerHTML = '<option value="">Project (optional)</option>';
  data.forEach((p) => {
    const op1 = document.createElement('option'); op1.value = p.id; op1.textContent = `${p.id} - ${p.name}`; txnFilterProject.appendChild(op1);
    const op2 = document.createElement('option'); op2.value = p.id; op2.textContent = `${p.id} - ${p.name}`; generateProjectSelect.appendChild(op2);
  });
}
async function loadHeadOptions() {
  const { res, data } = await call('/master/budget-heads');
  if (!res.ok) return;
  txnFilterHead.innerHTML = '<option value="">All Heads</option>';
  data.forEach((h) => { const op = document.createElement('option'); op.value = h.id; op.textContent = `${h.id} - ${h.name}`; txnFilterHead.appendChild(op); });
}
async function loadTemplateOptions() {
  const { res, data } = await call('/reports/templates');
  if (!res.ok) return;
  priorTemplateIdSelect.innerHTML = '<option value="">Prior approval template</option>';
  generateTemplateSelect.innerHTML = '<option value="">Template</option>';
  data.forEach((t) => {
    const op = document.createElement('option'); op.value = t.id; op.textContent = `${t.id} - ${t.name} (${t.type})`; generateTemplateSelect.appendChild(op);
    if (t.type === 'PriorApproval') {
      const op2 = document.createElement('option'); op2.value = t.id; op2.textContent = `${t.id} - ${t.name}`; priorTemplateIdSelect.appendChild(op2);
    }
  });
}

// Master Data CRUD
async function createAccount() { const payload = { code: accountCode.value, name: accountName.value, account_type: accountType.value }; const { data } = await call('/master/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listAccounts(); }
async function listAccounts() { const { res, data } = await call('/master/accounts'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#accountsTable tbody'); tbody.innerHTML = ''; data.forEach((a) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${a.account_type}</td><td><button data-edit-account="${a.id}">Edit</button> <button data-del-account="${a.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editAccount(id) { const code = prompt('New account code:'); const name = prompt('New account name:'); if (!code || !name) return; const { data } = await call(`/master/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) }); show('masterResult', data); await listAccounts(); }
async function deleteAccount(id) { if (!confirm('Delete this account?')) return; const { data } = await call(`/master/accounts/${id}`, { method: 'DELETE' }); show('masterResult', data); await listAccounts(); }

async function createProject() { const payload = { code: projectCode.value, name: projectName.value }; const { data } = await call('/master/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listProjects(); await loadProjectOptions(); }
async function listProjects() { const { res, data } = await call('/master/projects'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#projectsTable tbody'); tbody.innerHTML = ''; data.forEach((p) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.id}</td><td>${p.code}</td><td>${p.name}</td><td><button data-edit-project="${p.id}">Edit</button> <button data-del-project="${p.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editProject(id) { const code = prompt('New project code:'); const name = prompt('New project name:'); if (!code || !name) return; const { data } = await call(`/master/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) }); show('masterResult', data); await listProjects(); await loadProjectOptions(); }
async function deleteProject(id) { if (!confirm('Delete this project?')) return; const { data } = await call(`/master/projects/${id}`, { method: 'DELETE' }); show('masterResult', data); await listProjects(); await loadProjectOptions(); }

async function createHead() { const payload = { code: headCode.value, name: headName.value, project_id: headProjectId.value ? Number(headProjectId.value) : null, sanctioned_amount: Number(headAmount.value || 0) }; const { data } = await call('/master/budget-heads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('masterResult', data); await listHeads(); await loadHeadOptions(); }
async function listHeads() { const { res, data } = await call('/master/budget-heads'); if (!res.ok) return show('masterResult', data); const tbody = document.querySelector('#headsTable tbody'); tbody.innerHTML = ''; data.forEach((h) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${h.id}</td><td>${h.code}</td><td>${h.name}</td><td>${h.project_id ?? '-'}</td><td>${h.sanctioned_amount}</td><td><button data-edit-head="${h.id}">Edit</button> <button data-del-head="${h.id}">Delete</button></td>`; tbody.appendChild(tr); }); }
async function editHead(id) { const name = prompt('New budget head name:'); if (!name) return; const { data } = await call(`/master/budget-heads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); show('masterResult', data); await listHeads(); }
async function deleteHead(id) { if (!confirm('Delete this budget head?')) return; const { data } = await call(`/master/budget-heads/${id}`, { method: 'DELETE' }); show('masterResult', data); await listHeads(); }

// Users
async function createUser() { const payload = { name: userName.value, email: userEmail.value, password: userPassword.value, role: userRole.value }; const { data } = await call('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('userActionResult', data); await loadUsers(); }
async function loadUsers() { const { res, data } = await call('/users'); if (!res.ok) return show('userActionResult', data); const tbody = document.querySelector('#usersTable tbody'); tbody.innerHTML = ''; data.forEach((u) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.is_active}</td><td><button data-edit-user="${u.id}">Edit</button> <button data-del-user="${u.id}">Deactivate</button></td>`; tbody.appendChild(tr); }); }
async function editUser(id) { const role = prompt('New role (COORDINATOR/FINANCE/FELLOW/AUDITOR):'); if (!role) return; const { data } = await call(`/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }); show('userActionResult', data); await loadUsers(); }
async function deleteUser(id) { if (!confirm('Deactivate this user?')) return; const { data } = await call(`/users/${id}`, { method: 'DELETE' }); show('userActionResult', data); await loadUsers(); }

// Transactions
function loadTxnTypes() {
  try {
    const stored = JSON.parse(localStorage.getItem(txnTypeStorageKey) || '[]');
    return Array.isArray(stored) && stored.length ? stored : defaultTxnTypes;
  } catch {
    return defaultTxnTypes;
  }
}
function saveTxnTypes(types) { localStorage.setItem(txnTypeStorageKey, JSON.stringify(types)); }
async function loadTxnTypeOptions() {
  const list = loadTxnTypes();
  txnTypeSelect.innerHTML = '<option value="">Select transaction type</option>';
  list.forEach((t) => {
    const op = document.createElement('option');
    op.value = t.id;
    op.textContent = `${t.name} (Dr:${t.debit_account_id} Cr:${t.credit_account_id})`;
    txnTypeSelect.appendChild(op);
  });
}
function switchTxnMode(mode) {
  txnModeGuided.classList.toggle('active', mode === 'guided');
  txnModeManual.classList.toggle('active', mode === 'manual');
  txnGuidedPane.classList.toggle('active', mode === 'guided');
  txnManualPane.classList.toggle('active', mode === 'manual');
}
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
function clearTxnLines() { document.querySelector('#txnLinesTable tbody').innerHTML = ''; }
function collectTxnLines() {
  return Array.from(document.querySelectorAll('#txnLinesTable tbody tr')).map((tr) => ({
    account_id: Number(tr.querySelector('.txn-account').value),
    project_id: tr.querySelector('.txn-project').value ? Number(tr.querySelector('.txn-project').value) : null,
    budget_head_id: tr.querySelector('.txn-head').value ? Number(tr.querySelector('.txn-head').value) : null,
    entry_type: tr.querySelector('.txn-entry').value,
    amount: Number(tr.querySelector('.txn-amount').value),
  }));
}
function applySelectedTxnType() {
  const selected = loadTxnTypes().find((x) => x.id === txnTypeSelect.value);
  if (!selected) return show('txnResult', 'Please select a transaction type.');
  const amount = Number(txnTypeAmount.value || 0);
  if (!amount) return show('txnResult', 'Enter amount for guided transaction.');
  const projectId = txnTypeProjectId.value ? Number(txnTypeProjectId.value) : null;
  const headId = txnTypeHeadId.value ? Number(txnTypeHeadId.value) : null;
  clearTxnLines();
  addTxnLineRow({ account_id: selected.debit_account_id, project_id: projectId, budget_head_id: headId, entry_type: 'DEBIT', amount });
  addTxnLineRow({ account_id: selected.credit_account_id, project_id: projectId, budget_head_id: headId, entry_type: 'CREDIT', amount });
  switchTxnMode('manual');
  show('txnResult', `Applied guided type: ${selected.name}`);
}
function saveCurrentLinesAsType() {
  const name = prompt('Transaction type name:');
  if (!name) return;
  const lines = collectTxnLines();
  const debit = lines.find((l) => l.entry_type === 'DEBIT');
  const credit = lines.find((l) => l.entry_type === 'CREDIT');
  if (!debit || !credit) return show('txnResult', 'Need at least one debit and one credit line.');
  const types = loadTxnTypes();
  const id = name.toLowerCase().replace(/\s+/g, '-');
  types.push({ id, name, debit_account_id: debit.account_id, credit_account_id: credit.account_id });
  saveTxnTypes(types);
  loadTxnTypeOptions();
  txnTypeSelect.value = id;
  show('txnResult', `Saved frequent type: ${name}`);
}
async function checkBudgetWarning() { const { data } = await call('/transactions/budget-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectTxnLines()) }); show('txnWarningResult', data); }
async function createTxn() { const payload = { txn_date: new Date().toISOString(), narration: txnNarration.value, lines: collectTxnLines() }; const { data } = await call('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('txnResult', data); await listTxn(); }
async function listTxn() {
  const qs = new URLSearchParams();
  if (txnFilterProject.value) qs.set('project_id', txnFilterProject.value);
  if (txnFilterHead.value) qs.set('budget_head_id', txnFilterHead.value);
  if (txnFromDate.value) qs.set('from_date', `${txnFromDate.value}T00:00:00`);
  if (txnToDate.value) qs.set('to_date', `${txnToDate.value}T23:59:59`);
  const { res, data } = await call(`/transactions${qs.toString() ? '?' + qs.toString() : ''}`);
  if (!res.ok) return show('txnResult', data);
  const tbody = document.querySelector('#txnTable tbody');
  tbody.innerHTML = '';
  data.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.id}</td><td>${t.txn_date}</td><td>${t.narration}</td><td>${t.reference_no || ''}</td>`;
    tbody.appendChild(tr);
  });
  show('txnResult', data);
}
async function deleteLastTxn() { const { data } = await call('/transactions/last', { method: 'DELETE' }); show('txnResult', data); await listTxn(); }

// Bank reconciliation
async function createBank() { const payload = { bank_name: bankName.value, account_number_masked: bankNumber.value }; const { data } = await call('/bank/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('reconcileResult', data); await listBank(); }
async function listBank() {
  const { res, data } = await call('/bank/accounts');
  if (!res.ok) return show('reconcileResult', data);
  bankAccountSelect.innerHTML = '';
  data.forEach((b) => { const op = document.createElement('option'); op.value = b.id; op.textContent = `${b.id} - ${b.bank_name}`; bankAccountSelect.appendChild(op); });
}
async function importStatement() {
  const rows = JSON.parse(statementRowsJson.value || '[]');
  const bankId = Number(bankAccountSelect.value);
  const { data } = await call(`/bank/statements/${bankId}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
  show('reconcileResult', data);
  await loadStatements();
}
async function previewImportFile() {
  if (!statementFile.files?.length) return show('importPreviewResult', 'Choose a file first.');
  const fd = new FormData();
  fd.append('file', statementFile.files[0]);
  fd.append('file_format', statementFormatSelect.value);
  fd.append('field_mapping', statementFieldMap.value || '{}');
  const { res, data } = await call('/bank/import/preview', { method: 'POST', body: fd });
  if (!res.ok) return show('importPreviewResult', data);
  parsedStatementRows = data.rows || [];
  show('importPreviewResult', { parsed: parsedStatementRows.length, sample: parsedStatementRows.slice(0, 10) });
}
async function importParsedRows() {
  const bankId = Number(bankAccountSelect.value);
  if (!bankId) return show('reconcileResult', 'Select bank account first.');
  if (!parsedStatementRows.length) return show('reconcileResult', 'Preview and parse file first.');
  const { data } = await call(`/bank/statements/${bankId}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedStatementRows) });
  show('reconcileResult', data);
  await loadStatements();
}
async function loadStatements() {
  const bankId = Number(bankAccountSelect.value);
  const { res, data } = await call(`/bank/statements/${bankId}`);
  if (!res.ok) return show('reconcileResult', data);
  const tbody = document.querySelector('#statementTable tbody');
  tbody.innerHTML = '';
  data.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.id}</td><td>${s.statement_date}</td><td>${s.description}</td><td>${s.debit}</td><td>${s.credit}</td><td>${s.is_reconciled ? '✅' : '❌'}</td><td><input type="number" class="match-txn" /></td><td><button data-reconcile-line="${s.id}">Reconcile</button></td>`;
    tbody.appendChild(tr);
  });
}
async function reconcileLine(lineId, txnId) { const { data } = await call(`/bank/reconcile/${lineId}/${txnId}`, { method: 'POST' }); show('reconcileResult', data); await loadStatements(); }

// Events approvals
async function createEvent() { const payload = { title: eventTitle.value, description: eventDesc.value, project_id: eventProjectId.value ? Number(eventProjectId.value) : null, budget_head_id: eventHeadId.value ? Number(eventHeadId.value) : null, start_at: new Date().toISOString(), end_at: new Date(Date.now() + 3600000).toISOString(), prior_approval_required: true }; const { data } = await call('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('eventResult', data); await listEvents(); }
async function listEvents() {
  const { res, data } = await call('/events');
  if (!res.ok) return show('eventResult', data);
  const tbody = document.querySelector('#eventsTable tbody');
  tbody.innerHTML = '';
  data.forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.id}</td><td>${e.title}</td><td>${e.project_id ?? ''}</td><td>${e.budget_head_id ?? ''}</td><td>${e.start_at}</td><td><button data-prior-event="${e.id}">Generate Prior Approval</button></td>`;
    tbody.appendChild(tr);
  });
}
async function generatePriorForEvent(eventId) {
  if (!priorTemplateIdSelect.value) return show('eventResult', 'Select prior-approval template first.');
  const { data } = await call(`/events/${eventId}/prior-approval?template_id=${priorTemplateIdSelect.value}`, { method: 'POST' });
  show('eventResult', data);
}

// Reports
function renderBuilderCanvas() {
  builderCanvas.innerHTML = '';
  builderBlocks.forEach((block, idx) => {
    const div = document.createElement('div');
    div.className = `builder-block ${selectedBuilderIndex === idx ? 'selected' : ''}`;
    div.dataset.builderIndex = idx;
    div.innerHTML = `<strong>${block.type}</strong><textarea data-builder-edit="${idx}" rows="2">${block.content}</textarea>`;
    builderCanvas.appendChild(div);
  });
}
function addBuilderBlock(type) {
  const defaultContent = type === 'heading' ? 'Report Heading' : type === 'paragraph' ? 'Describe details here.' : '{{ total_spent }}';
  builderBlocks.push({ type, content: defaultContent });
  selectedBuilderIndex = builderBlocks.length - 1;
  renderBuilderCanvas();
}
function moveBuilder(delta) {
  if (selectedBuilderIndex < 0) return;
  const target = selectedBuilderIndex + delta;
  if (target < 0 || target >= builderBlocks.length) return;
  const [item] = builderBlocks.splice(selectedBuilderIndex, 1);
  builderBlocks.splice(target, 0, item);
  selectedBuilderIndex = target;
  renderBuilderCanvas();
}
function deleteBuilderBlock() {
  if (selectedBuilderIndex < 0) return;
  builderBlocks.splice(selectedBuilderIndex, 1);
  selectedBuilderIndex = Math.min(selectedBuilderIndex, builderBlocks.length - 1);
  renderBuilderCanvas();
}
function insertTagInSelectedBlock() {
  if (selectedBuilderIndex < 0) return;
  builderBlocks[selectedBuilderIndex].content += ` ${builderTagSelect.value}`;
  renderBuilderCanvas();
}
function buildTemplateFromCanvas() {
  const html = builderBlocks.map((b) => {
    if (b.type === 'heading') return `<h2>${b.content}</h2>`;
    if (b.type === 'paragraph') return `<p>${b.content}</p>`;
    return `<div>${b.content}</div>`;
  }).join('\n');
  templateHtml.value = html;
  templateJson.value = JSON.stringify({ blocks: builderBlocks }, null, 2);
  show('templateResult', 'Template HTML/JSON generated from visual builder.');
}
async function createTemplate() { const payload = { name: templateName.value, type: templateType.value, layout_json: JSON.parse(templateJson.value || '{}'), header_config: { org: 'E-YUVA Centre' }, html_template: templateHtml.value }; const { data } = await call('/reports/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); show('templateResult', data); await loadTemplateOptions(); }
async function listTemplates() { const { data } = await call('/reports/templates'); show('templateResult', data); await loadTemplateOptions(); }
async function generateReport() {
  const payload = {
    template_id: Number(generateTemplateSelect.value),
    project_id: generateProjectSelect.value ? Number(generateProjectSelect.value) : null,
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
  if (t.dataset.priorEvent) generatePriorForEvent(t.dataset.priorEvent);
  if (t.dataset.builderIndex) { selectedBuilderIndex = Number(t.dataset.builderIndex); renderBuilderCanvas(); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.builderEdit) {
    const idx = Number(t.dataset.builderEdit);
    if (!Number.isNaN(idx) && builderBlocks[idx]) builderBlocks[idx].content = t.value;
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

txnModeGuided.onclick = () => switchTxnMode('guided');
txnModeManual.onclick = () => switchTxnMode('manual');
applyTxnTypeBtn.onclick = applySelectedTxnType;
saveTxnTypeBtn.onclick = saveCurrentLinesAsType;
addTxnLineBtn.onclick = () => addTxnLineRow();
checkBudgetBtn.onclick = checkBudgetWarning;
createTxnBtn.onclick = createTxn; listTxnBtn.onclick = listTxn; deleteLastTxnBtn.onclick = deleteLastTxn;

createBankBtn.onclick = createBank; listBankBtn.onclick = listBank; loadStatementsBtn.onclick = loadStatements; importStatementBtn.onclick = importStatement;
previewImportBtn.onclick = previewImportFile; importParsedBtn.onclick = importParsedRows;

createEventBtn.onclick = createEvent; loadEventsBtn.onclick = listEvents;

addHeadingBlockBtn.onclick = () => addBuilderBlock('heading');
addParagraphBlockBtn.onclick = () => addBuilderBlock('paragraph');
addDataTagBlockBtn.onclick = () => addBuilderBlock('tag');
insertTagBtn.onclick = insertTagInSelectedBlock;
moveBlockUpBtn.onclick = () => moveBuilder(-1);
moveBlockDownBtn.onclick = () => moveBuilder(1);
deleteBlockBtn.onclick = deleteBuilderBlock;
buildTemplateBtn.onclick = buildTemplateFromCanvas;

saveTemplateBtn.onclick = createTemplate; loadTemplatesBtn.onclick = listTemplates;
generateReportBtn.onclick = generateReport; downloadReportBtn.onclick = downloadReport;

setupNav();
switchTxnMode('guided');
addTxnLineRow({ account_id: 1, project_id: 1, budget_head_id: 1, entry_type: 'DEBIT', amount: 1000 });
addTxnLineRow({ account_id: 2, project_id: 1, budget_head_id: 1, entry_type: 'CREDIT', amount: 1000 });
loadTxnTypeOptions();
loadProfile().then(bootstrapData);
