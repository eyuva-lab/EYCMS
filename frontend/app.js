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
  document.getElementById('profile').innerText = 'Not logged in';
  document.getElementById('loginCard').style.display = 'block';
}
function setLoggedIn(name, role) {
  document.getElementById('profile').innerText = `${name} (${role})`;
  document.getElementById('loginCard').style.display = 'none';
}

function setupNav() {
  const nav = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  nav.forEach((b) => b.addEventListener('click', () => {
    nav.forEach((x) => x.classList.remove('active'));
    views.forEach((v) => v.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.view).classList.add('active');
  }));
}

async function login() {
  const body = new URLSearchParams({ username: document.getElementById('email').value, password: document.getElementById('password').value });
  const { res, data } = await call('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) return show('userActionResult', data);
  token = data.access_token;
  localStorage.setItem('token', token);
  await loadProfile();
}

function logout() { token = ''; localStorage.removeItem('token'); setLoggedOut(); }

async function loadProfile() {
  if (!token) return setLoggedOut();
  const { res, data } = await call('/auth/me');
  if (!res.ok) return logout();
  setLoggedIn(data.name, data.role);
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

async function createUser() {
  const payload = { name: userName.value, email: userEmail.value, password: userPassword.value, role: userRole.value };
  const { data } = await call('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  show('userActionResult', data); loadUsers();
}
async function loadUsers() {
  const { res, data } = await call('/users');
  if (!res.ok) return show('userActionResult', data);
  const tbody = document.querySelector('#usersTable tbody'); tbody.innerHTML='';
  data.forEach((u)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td>`; tbody.appendChild(tr);});
}

async function createEvent() {
  const payload = { title: eventTitle.value, description: eventDesc.value, start_at: new Date().toISOString(), end_at: new Date(Date.now()+3600000).toISOString(), prior_approval_required: true };
  const { data } = await call('/events', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  show('eventResult', data);
}
async function listEvents() { const { data } = await call('/events'); show('eventResult', data); }

async function createTemplate() {
  const payload = { name: templateName.value, type:'UC', layout_json: JSON.parse(templateJson.value||'{}'), header_config:{org:'E-YUVA Centre'}, html_template: templateHtml.value };
  const { data } = await call('/reports/templates', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  show('templateResult', data);
}
async function listTemplates(){ const { data } = await call('/reports/templates'); show('templateResult', data); }

async function createAccount(){ const payload={code:accountCode.value,name:accountName.value,account_type:accountType.value}; const {data}=await call('/master/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); show('masterResult',data); }
async function listAccounts(){ const {data}=await call('/master/accounts'); show('masterResult',data); }
async function createProject(){ const payload={code:projectCode.value,name:projectName.value}; const {data}=await call('/master/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); show('masterResult',data); }
async function listProjects(){ const {data}=await call('/master/projects'); show('masterResult',data); }
async function createHead(){ const payload={code:headCode.value,name:headName.value,project_id:headProjectId.value?Number(headProjectId.value):null,sanctioned_amount:Number(headAmount.value||0)}; const {data}=await call('/master/budget-heads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); show('masterResult',data); }
async function listHeads(){ const {data}=await call('/master/budget-heads'); show('masterResult',data); }
async function createBank(){ const payload={bank_name:bankName.value,account_number_masked:bankNumber.value}; const {data}=await call('/bank/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); show('masterResult',data); }
async function listBank(){ const {data}=await call('/bank/accounts'); show('masterResult',data); }

async function createTxn(){ const payload={txn_date:new Date().toISOString(),narration:txnNarration.value,lines:JSON.parse(txnLines.value||'[]')}; const {data}=await call('/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); show('txnResult',data); }
async function listTxn(){ const {data}=await call('/transactions'); show('txnResult',data); }

loginBtn.onclick = login; logoutBtn.onclick = logout; refreshSummaryBtn.onclick = loadCentreSummary;
createUserBtn.onclick = createUser; loadUsersBtn.onclick = loadUsers;
createEventBtn.onclick = createEvent; loadEventsBtn.onclick = listEvents;
saveTemplateBtn.onclick = createTemplate; loadTemplatesBtn.onclick = listTemplates;
createAccountBtn.onclick=createAccount; loadAccountsBtn.onclick=listAccounts;
createProjectBtn.onclick=createProject; loadProjectsBtn.onclick=listProjects;
createHeadBtn.onclick=createHead; loadHeadsBtn.onclick=listHeads;
createBankBtn.onclick=createBank; listBankBtn.onclick=listBank;
createTxnBtn.onclick=createTxn; listTxnBtn.onclick=listTxn;

setupNav(); loadProfile();
