// =====================================================
// VIBRANT MARKETING MANAGEMENT v2.0
// Multi-client (DU / Etisalat) + Admin User Management
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

let supabase;
let currentUser = null;
let allAgents = [];
let allUsers = [];

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  window._supabase = supabase;
  checkSession();
  updateDateBadge();
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
});

function updateDateBadge() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-AE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// =====================================================
// AUTH
// =====================================================
function checkSession() {
  const saved = sessionStorage.getItem('vmm_user');
  if (saved) { currentUser = JSON.parse(saved); showApp(); }
  else showLogin();
}

async function doLogin() {
  const id = document.getElementById('loginId').value.trim();
  const pw = document.getElementById('loginPassword').value.trim();
  const err = document.getElementById('loginError');
  err.style.display = 'none';
  if (!id || !pw) { err.textContent = 'Please enter User ID and Password.'; err.style.display = 'block'; return; }

  // Check admin first (hardcoded)
  if (id === CONFIG.ADMIN.id && pw === CONFIG.ADMIN.password) {
    currentUser = CONFIG.ADMIN;
    sessionStorage.setItem('vmm_user', JSON.stringify(currentUser));
    showApp(); return;
  }

  // Check database users
  showLoader();
  try {
    const { data, error } = await supabase.from('app_users')
      .select('*').eq('user_id', id).eq('password', pw).eq('is_active', true).single();
    if (error || !data) {
      err.textContent = 'Invalid User ID or Password.'; err.style.display = 'block';
    } else {
      currentUser = { id: data.user_id, name: data.name, password: data.password, role: data.role, client: data.client, dbId: data.id };
      sessionStorage.setItem('vmm_user', JSON.stringify(currentUser));
      showApp();
    }
  } catch(e) {
    err.textContent = 'Login failed. Check connection.'; err.style.display = 'block';
  }
  hideLoader();
}

function logout() {
  sessionStorage.removeItem('vmm_user');
  currentUser = null;
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'none';
  document.getElementById('loginId').value = '';
  document.getElementById('loginPassword').value = '';
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'none';
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appLayout').style.display = 'flex';
  document.getElementById('sidebarUserName').textContent = currentUser.name;
  document.getElementById('sidebarUserRole').textContent = currentUser.role.toUpperCase();
  document.getElementById('sidebarUserAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('sidebarUserClient').textContent = currentUser.client === 'ALL' ? '🌐 All Clients' : '🏢 ' + currentUser.client;

  // Show/hide nav items based on role
  applyRoleNavigation();
  navigateTo('dashboard');
}

function applyRoleNavigation() {
  const role = currentUser.role;
  // Admin only items
  document.querySelectorAll('.nav-admin-only').forEach(el => {
    el.style.display = (role === 'admin') ? 'flex' : 'none';
  });
  // Hide agents page for boss
  document.querySelectorAll('.nav-no-boss').forEach(el => {
    el.style.display = (role === 'boss') ? 'none' : 'flex';
  });
  // Client tabs - hide if single client
  if (currentUser.client !== 'ALL') {
    document.querySelectorAll('.client-tab-bar').forEach(el => el.style.display = 'none');
  }
}

// =====================================================
// NAVIGATION
// =====================================================
function navigateTo(page) {
  // Role-based access control
  const role = currentUser.role;
  if (page === 'users' && role !== 'admin') return;
  if (page === 'agents' && role === 'boss') return;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  const titles = { dashboard:'📊 Dashboard', agents:'👥 Agent Management', attendance:'📋 Upload Attendance', records:'🗂️ Attendance Records', export:'📥 Export Reports', users:'👤 User Management' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  else if (page === 'agents') loadAgents();
  else if (page === 'attendance') loadAttendancePage();
  else if (page === 'records') loadRecords();
  else if (page === 'export') loadExportPage();
  else if (page === 'users') loadUsers();
}

// Get client filter for current user
function getClientFilter() {
  return currentUser.client === 'ALL' ? null : currentUser.client;
}

// Active client tab selected (for ALL users)
let activeClient = 'DU';
function setActiveClient(client) {
  activeClient = client;
  document.querySelectorAll('.client-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.client === client);
  });
  // Reload current page data
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const pageId = activePage.id.replace('page-', '');
    if (pageId === 'dashboard') loadDashboard();
    else if (pageId === 'agents') loadAgents();
    else if (pageId === 'attendance') {} // don't reload upload
    else if (pageId === 'records') loadRecords();
  }
}

function getCurrentClient() {
  const cf = getClientFilter();
  return cf || activeClient;
}

// =====================================================
// DASHBOARD
// =====================================================
async function loadDashboard() {
  showLoader();
  const client = getCurrentClient();
  try {
    const [{ data: agents }, { data: attendance }] = await Promise.all([
      supabase.from('agents').select('*').eq('client', client),
      supabase.from('attendance').select('*').eq('attendance_date', today()).eq('client', client)
    ]);
    allAgents = agents || [];
    const todayAtt = attendance || [];
    const activeAgents = allAgents.filter(a => a.status === 'active');
    const present = todayAtt.filter(a => a.status === 'PRESENT').length;
    const absent  = todayAtt.filter(a => a.status === 'ABSENT').length;

    document.getElementById('statTotal').textContent   = activeAgents.length;
    document.getElementById('statPresent').textContent = present;
    document.getElementById('statAbsent').textContent  = absent;
    document.getElementById('statClient').textContent  = client;

    // Team breakdown
    const teams = [...new Set(activeAgents.map(a => a.team))].sort();
    const teamGrid = document.getElementById('teamGrid');
    teamGrid.innerHTML = !teams.length
      ? '<p style="color:var(--text-muted);font-size:13px;">No agents yet for ' + client + '.</p>'
      : teams.map(team => {
          const ta = activeAgents.filter(a => a.team === team);
          const tp = todayAtt.filter(a => a.team === team && a.status === 'PRESENT').length;
          const tab= todayAtt.filter(a => a.team === team && a.status === 'ABSENT').length;
          const pct = ta.length ? Math.round((tp / ta.length) * 100) : 0;
          return `<div class="team-card">
            <div class="team-name">🏢 ${team}</div>
            <div class="team-stats">
              <div class="team-stat ts-total"><div class="ts-val">${ta.length}</div><div class="ts-lbl">Total</div></div>
              <div class="team-stat ts-present"><div class="ts-val">${tp}</div><div class="ts-lbl">Present</div></div>
              <div class="team-stat ts-absent"><div class="ts-val">${tab}</div><div class="ts-lbl">Absent</div></div>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:right;">${pct}% Present</div>
          </div>`;
        }).join('');

    // Recent attendance table
    const recentBody = document.getElementById('recentAttBody');
    recentBody.innerHTML = !todayAtt.length
      ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📋</div><p>No attendance uploaded for ${client} today.</p></div></td></tr>`
      : todayAtt.slice(0, 20).map(r => `<tr>
          <td><strong>${r.crm_id}</strong></td>
          <td>${r.agent_name}</td>
          <td><span class="badge badge-team">${r.team}</span></td>
          <td>${formatDate(r.attendance_date)}</td>
          <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>`).join('');
  } catch(e) {
    showToast('Failed to load dashboard.', 'error');
  }
  hideLoader();
}

// =====================================================
// AGENTS
// =====================================================
async function loadAgents() {
  showLoader();
  const client = getCurrentClient();
  try {
    const { data } = await supabase.from('agents').select('*').eq('client', client).order('name');
    allAgents = data || [];
    renderAgentsTable(allAgents);
  } catch(e) { showToast('Failed to load agents.', 'error'); }
  hideLoader();
}

function renderAgentsTable(agents) {
  const body = document.getElementById('agentsTableBody');
  const canEdit = ['admin','manager','hr'].includes(currentUser.role);
  if (!agents.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><p>No agents found.</p></div></td></tr>`;
    return;
  }
  body.innerHTML = agents.map(a => `
    <tr>
      <td><strong>${a.crm_id}</strong></td>
      <td>${a.dialer_id||'—'}</td>
      <td>${a.name}</td>
      <td>${formatDate(a.date_of_joining)}</td>
      <td><span class="badge badge-team">${a.team}</span></td>
      <td><span class="badge badge-${a.status}">${a.status}${a.terminated_date?' ('+formatDate(a.terminated_date)+')':''}</span></td>
      <td>${canEdit ? `<div style="display:flex;gap:6px;">
        ${a.status==='active'
          ? `<button class="btn btn-danger btn-xs" onclick="confirmTerminate('${a.id}','${a.name}')">Terminate</button>`
          : `<button class="btn btn-success btn-xs" onclick="reactivateAgent('${a.id}')">Reactivate</button>`}
        <button class="btn btn-outline btn-xs" onclick="deleteAgent('${a.id}','${a.name}')">Delete</button>
      </div>` : '—'}</td>
    </tr>`).join('');
}

function filterAgents() {
  const q = (document.getElementById('agentSearch').value||'').toLowerCase();
  const st = document.getElementById('agentStatusFilter').value;
  const filtered = allAgents.filter(a => {
    const mq = !q || a.name.toLowerCase().includes(q) || a.crm_id.toLowerCase().includes(q);
    const ms = !st || a.status === st;
    return mq && ms;
  });
  renderAgentsTable(filtered);
}

function openAddAgentModal() {
  document.getElementById('addAgentModal').classList.add('open');
  document.getElementById('f_client').value = getCurrentClient();
  document.getElementById('addAgentForm').reset();
  document.getElementById('f_client').value = getCurrentClient();
  // team suggestions
  const dl = document.getElementById('teamSuggestions');
  const teams = [...new Set(allAgents.map(a=>a.team))].sort();
  dl.innerHTML = teams.map(t=>`<option value="${t}">`).join('');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

async function saveAgent() {
  const crm_id = document.getElementById('f_crm_id').value.trim();
  const dialer_id = document.getElementById('f_dialer_id').value.trim();
  const name = document.getElementById('f_name').value.trim();
  const date_of_joining = document.getElementById('f_doj').value;
  const team = document.getElementById('f_team').value.trim();
  const client = document.getElementById('f_client').value;
  if (!crm_id||!name||!date_of_joining||!team||!client) { showToast('Fill all required fields.','error'); return; }
  showLoader();
  try {
    const { error } = await supabase.from('agents').insert([{ crm_id, dialer_id, name, date_of_joining, team, client, status:'active' }]);
    if (error) throw error;
    showToast(`Agent "${name}" added! ✅`);
    closeModal('addAgentModal');
    loadAgents();
  } catch(e) { showToast(e.message||'Failed to add agent.','error'); }
  hideLoader();
}

async function confirmTerminate(id, name) {
  if (!confirm(`Terminate "${name}"? Will be recorded with today's date.`)) return;
  showLoader();
  try {
    const { error } = await supabase.from('agents').update({ status:'terminated', terminated_date:today() }).eq('id',id);
    if (error) throw error;
    showToast(`"${name}" terminated.`,'warning');
    loadAgents();
  } catch(e) { showToast('Failed.','error'); }
  hideLoader();
}

async function reactivateAgent(id) {
  showLoader();
  try {
    const { error } = await supabase.from('agents').update({ status:'active', terminated_date:null }).eq('id',id);
    if (error) throw error;
    showToast('Agent reactivated!');
    loadAgents();
  } catch(e) { showToast('Failed.','error'); }
  hideLoader();
}

async function deleteAgent(id, name) {
  if (!confirm(`Permanently delete "${name}"?`)) return;
  showLoader();
  try {
    const { error } = await supabase.from('agents').delete().eq('id',id);
    if (error) throw error;
    showToast(`"${name}" deleted.`);
    loadAgents();
  } catch(e) { showToast('Failed.','error'); }
  hideLoader();
}

// =====================================================
// ATTENDANCE UPLOAD
// =====================================================
let uploadedFile = null;

function loadAttendancePage() {
  document.getElementById('uploadStatus').innerHTML = '';
  uploadedFile = null;
  // Set client tabs for upload
  const client = getCurrentClient();
  document.querySelectorAll('.upload-client-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.client === client);
  });
}

function setupDropzone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if(input.files[0]) handleFile(input.files[0]); });
}

function handleFile(file) {
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { showToast('Excel or CSV only.','error'); return; }
  uploadedFile = file;
  document.getElementById('uploadStatus').innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:24px;">📄</span>
      <div><div style="font-weight:600;font-size:13px;color:var(--primary);">${file.name}</div>
      <div style="font-size:11px;color:var(--text-muted);">${(file.size/1024).toFixed(1)} KB — Ready to process</div></div>
      <button class="btn btn-accent btn-sm" style="margin-left:auto;" onclick="processAttendanceFile()">⚡ Process Now</button>
    </div>`;
}

async function processAttendanceFile() {
  if (!uploadedFile) { showToast('Select file first.','error'); return; }
  // Get selected client for upload
  const uploadClient = document.querySelector('.upload-client-tab.active')?.dataset.client || getCurrentClient();
  showLoader();
  try {
    const data = await readExcel(uploadedFile);
    if (!data.length) { showToast('File is empty.','error'); hideLoader(); return; }
    const headers = Object.keys(data[0]).map(h => h.trim().toUpperCase().replace(/\s+/g,'_'));
    const rows = data.map(row => {
      const n = {};
      Object.keys(row).forEach((k,i) => n[headers[i]] = row[k]);
      return n;
    });
    const crmCol = headers.find(h=>h.includes('CRM'));
    const attCol = headers.find(h=>h.includes('ATTENDANCE')||h.includes('STATUS')||h.includes('PRESENT'));
    if (!crmCol||!attCol) { showToast('Cannot find CRM ID or ATTENDANCE column.','error'); hideLoader(); return; }

    const { data: activeAgents } = await supabase.from('agents').select('*').eq('status','active').eq('client', uploadClient);
    const todayDate = today();
    let matched=0, skipped=0;
    const inserts = [];

    for (const row of rows) {
      const crmId = String(row[crmCol]||'').trim();
      let status = String(row[attCol]||'').trim().toUpperCase();
      if (!crmId) { skipped++; continue; }
      if (!['PRESENT','ABSENT','P','A'].includes(status)) { skipped++; continue; }
      if (status==='P') status='PRESENT';
      if (status==='A') status='ABSENT';
      const agent = activeAgents.find(a => a.crm_id.trim().toUpperCase()===crmId.toUpperCase());
      if (!agent) { skipped++; continue; }
      inserts.push({ crm_id:agent.crm_id, agent_name:agent.name, team:agent.team, client:uploadClient, attendance_date:todayDate, status });
      matched++;
    }

    if (inserts.length) {
      const { error } = await supabase.from('attendance').upsert(inserts, { onConflict:'crm_id,attendance_date' });
      if (error) throw error;
    }
    document.getElementById('uploadStatus').innerHTML = `
      <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:16px 20px;">
        <div style="font-weight:700;color:#065f46;font-size:14px;margin-bottom:8px;">✅ ${uploadClient} Attendance saved!</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px;">
          <div style="text-align:center;"><div style="font-size:24px;font-weight:800;color:#059669;">${matched}</div><div style="font-size:11px;color:#065f46;">Matched & Saved</div></div>
          <div style="text-align:center;"><div style="font-size:24px;font-weight:800;color:#b45309;">${skipped}</div><div style="font-size:11px;color:#92400e;">Skipped</div></div>
          <div style="text-align:center;"><div style="font-size:14px;font-weight:800;color:#1d4ed8;">${todayDate}</div><div style="font-size:11px;color:#1e40af;">Date</div></div>
        </div>
      </div>`;
    showToast(`${matched} records saved for ${uploadClient}! 🎉`);
  } catch(e) {
    showToast(e.message||'Failed to process.','error');
  }
  hideLoader();
}

function readExcel(file) {
  return new Promise((resolve,reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const wb = XLSX.read(e.target.result,{type:'array'});
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}));
      } catch(err) { reject(err); }
    };
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

// =====================================================
// RECORDS
// =====================================================
async function loadRecords() {
  showLoader();
  const client = getCurrentClient();
  const dateFilter = document.getElementById('recDateFilter').value || today();
  const statusFilter = document.getElementById('recStatusFilter').value;
  const teamFilter = document.getElementById('recTeamFilter').value;
  try {
    let q = supabase.from('attendance').select('*').eq('client',client).order('attendance_date',{ascending:false});
    if (dateFilter) q = q.eq('attendance_date',dateFilter);
    if (statusFilter) q = q.eq('status',statusFilter);
    if (teamFilter) q = q.eq('team',teamFilter);
    const { data } = await q;
    const rows = data||[];

    const body = document.getElementById('recordsTableBody');
    body.innerHTML = !rows.length
      ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🗂️</div><p>No records found.</p></div></td></tr>`
      : rows.map(r => `<tr>
          <td><strong>${r.crm_id}</strong></td>
          <td>${r.agent_name}</td>
          <td><span class="badge badge-team">${r.team}</span></td>
          <td>${formatDate(r.attendance_date)}</td>
          <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>`).join('');

    // Team filter options
    const { data: agents } = await supabase.from('agents').select('team').eq('client',client);
    const teams = [...new Set((agents||[]).map(a=>a.team))].sort();
    const sel = document.getElementById('recTeamFilter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Teams</option>' + teams.map(t=>`<option value="${t}">${t}</option>`).join('');
    sel.value = cur;
  } catch(e) { showToast('Failed to load records.','error'); }
  hideLoader();
}

// =====================================================
// EXPORT
// =====================================================
function loadExportPage() {
  document.getElementById('exportMonth').value = new Date().toISOString().slice(0,7);
}

async function exportMonthly() {
  const month = document.getElementById('exportMonth').value;
  const expClient = document.getElementById('exportClientSelect').value || getCurrentClient();
  if (!month) { showToast('Select a month.','error'); return; }
  const [year,mon] = month.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDate = new Date(year,mon,0).toISOString().split('T')[0];
  showLoader();
  try {
    const [{ data: attendance },{ data: agents }] = await Promise.all([
      supabase.from('attendance').select('*').eq('client',expClient).gte('attendance_date',startDate).lte('attendance_date',endDate).order('attendance_date'),
      supabase.from('agents').select('*').eq('client',expClient).order('team')
    ]);
    const att = attendance||[], agt = agents||[];
    const summaryRows = agt.map(a => {
      const ag = att.filter(x=>x.crm_id===a.crm_id);
      return {
        'CRM ID':a.crm_id, 'Dialer ID':a.dialer_id||'', 'Name':a.name,
        'Date of Joining':a.date_of_joining, 'Team':a.team, 'Client':a.client,
        'Status':a.status, 'Terminated Date':a.terminated_date||'',
        'Present Days':ag.filter(x=>x.status==='PRESENT').length,
        'Absent Days':ag.filter(x=>x.status==='ABSENT').length,
        'Total Uploaded':ag.length
      };
    });
    const detailRows = att.map(a => ({
      'CRM ID':a.crm_id, 'Name':a.agent_name, 'Team':a.team,
      'Client':a.client, 'Date':a.attendance_date, 'Attendance':a.status
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Daily Detail');
    XLSX.writeFile(wb, `VMM_${expClient}_Attendance_${month}.xlsx`);
    showToast(`Report exported for ${expClient} - ${month}! 📥`);
  } catch(e) { showToast('Export failed.','error'); }
  hideLoader();
}

async function downloadTemplate() {
  const client = getCurrentClient();
  const { data: agents } = await supabase.from('agents').select('*').eq('status','active').eq('client',client).order('team');
  const headers = ['CRM ID','DIALER ID','NAME','DATE OF JOINING','TEAM','CLIENT','ATTENDANCE (PRESENT/ABSENT)'];
  const dataRows = (agents||[]).map(a => [a.crm_id, a.dialer_id||'', a.name, a.date_of_joining, a.team, a.client, '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const headerStyle = {
    font:{bold:true,color:{rgb:'FFFFFF'},sz:12},
    fill:{fgColor:{rgb:'1A1F5E'}},
    alignment:{horizontal:'center',vertical:'center',wrapText:true}
  };
  ['A1','B1','C1','D1','E1','F1','G1'].forEach(cell => {
    if (!ws[cell]) ws[cell]={v:'',t:'s'};
    ws[cell].s = headerStyle;
  });
  ws['!cols'] = [{wch:14},{wch:14},{wch:28},{wch:18},{wch:22},{wch:12},{wch:28}];
  ws['!rows'] = [{hpt:28}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `VMM_${client}_Template_${today()}.xlsx`);
  showToast(`${client} template downloaded! ✅`);
}

// =====================================================
// USER MANAGEMENT (Admin only)
// =====================================================
async function loadUsers() {
  showLoader();
  try {
    const { data } = await supabase.from('app_users').select('*').order('created_at',{ascending:false});
    allUsers = data||[];
    renderUsersTable(allUsers);
  } catch(e) { showToast('Failed to load users.','error'); }
  hideLoader();
}

function renderUsersTable(users) {
  const body = document.getElementById('usersTableBody');
  if (!users.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👤</div><p>No users yet.</p></div></td></tr>`;
    return;
  }
  body.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.user_id}</strong></td>
      <td>${u.name}</td>
      <td><span class="badge badge-team">${u.role.toUpperCase()}</span></td>
      <td><span class="badge badge-${u.client==='ALL'?'active':'present'}">${u.client}</span></td>
      <td><span class="badge badge-${u.is_active?'present':'absent'}">${u.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-xs" onclick="openEditUserModal(${u.id})">✏️ Edit</button>
          <button class="btn btn-${u.is_active?'danger':'success'} btn-xs" onclick="toggleUserStatus(${u.id},${u.is_active},'${u.name}')">
            ${u.is_active?'Disable':'Enable'}
          </button>
          <button class="btn btn-danger btn-xs" onclick="deleteUser(${u.id},'${u.name}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function openAddUserModal() {
  document.getElementById('userModalTitle').textContent = '➕ Add New User';
  document.getElementById('u_id_field').style.display = 'block';
  document.getElementById('editUserId').value = '';
  document.getElementById('addUserForm').reset();
  document.getElementById('addUserModal').classList.add('open');
}

function openEditUserModal(id) {
  const u = allUsers.find(x=>x.id===id);
  if (!u) return;
  document.getElementById('userModalTitle').textContent = '✏️ Edit User — ' + u.name;
  document.getElementById('u_id_field').style.display = 'none';
  document.getElementById('editUserId').value = id;
  document.getElementById('u_userid').value = u.user_id;
  document.getElementById('u_name').value = u.name;
  document.getElementById('u_password').value = u.password;
  document.getElementById('u_role').value = u.role;
  document.getElementById('u_client').value = u.client;
  document.getElementById('addUserModal').classList.add('open');
}

async function saveUser() {
  const editId = document.getElementById('editUserId').value;
  const user_id = document.getElementById('u_userid').value.trim();
  const name = document.getElementById('u_name').value.trim();
  const password = document.getElementById('u_password').value.trim();
  const role = document.getElementById('u_role').value;
  const client = document.getElementById('u_client').value;

  if (!name||!password||!role||!client) { showToast('Fill all fields.','error'); return; }
  if (!editId && !user_id) { showToast('Enter User ID.','error'); return; }

  showLoader();
  try {
    if (editId) {
      const { error } = await supabase.from('app_users').update({ name, password, role, client }).eq('id', editId);
      if (error) throw error;
      showToast(`User "${name}" updated! ✅`);
    } else {
      const { error } = await supabase.from('app_users').insert([{ user_id, name, password, role, client, is_active:true }]);
      if (error) throw error;
      showToast(`User "${name}" created! ✅`);
    }
    closeModal('addUserModal');
    loadUsers();
  } catch(e) { showToast(e.message||'Failed.','error'); }
  hideLoader();
}

async function toggleUserStatus(id, isActive, name) {
  if (!confirm(`${isActive?'Disable':'Enable'} user "${name}"?`)) return;
  showLoader();
  try {
    const { error } = await supabase.from('app_users').update({ is_active: !isActive }).eq('id', id);
    if (error) throw error;
    showToast(`User "${name}" ${isActive?'disabled':'enabled'}.`);
    loadUsers();
  } catch(e) { showToast('Failed.','error'); }
  hideLoader();
}

async function deleteUser(id, name) {
  if (!confirm(`Permanently delete user "${name}"?`)) return;
  showLoader();
  try {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw error;
    showToast(`User "${name}" deleted.`);
    loadUsers();
  } catch(e) { showToast('Failed.','error'); }
  hideLoader();
}

function filterUsers() {
  const q = (document.getElementById('userSearch').value||'').toLowerCase();
  const filtered = allUsers.filter(u =>
    u.name.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
}

// =====================================================
// UTILS
// =====================================================
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'});
}
function showLoader() { document.getElementById('loadingOverlay').style.display='flex'; }
function hideLoader() { document.getElementById('loadingOverlay').style.display='none'; }
let _toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  const icons = {success:'✅',error:'❌',warning:'⚠️'};
  t.querySelector('.toast-icon').textContent = icons[type]||'✅';
  t.querySelector('.toast-msg').textContent = msg;
  t.className = 'toast'+(type!=='success'?' '+type:'');
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove('show'),3500);
}

// =====================================================
// EXPOSE GLOBALS
// =====================================================
window.navigateTo = navigateTo;
window.logout = logout;
window.setActiveClient = setActiveClient;
window.openAddAgentModal = openAddAgentModal;
window.closeModal = closeModal;
window.saveAgent = saveAgent;
window.confirmTerminate = confirmTerminate;
window.reactivateAgent = reactivateAgent;
window.deleteAgent = deleteAgent;
window.filterAgents = filterAgents;
window.processAttendanceFile = processAttendanceFile;
window.loadRecords = loadRecords;
window.exportMonthly = exportMonthly;
window.downloadTemplate = downloadTemplate;
window.loadUsers = loadUsers;
window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.saveUser = saveUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.filterUsers = filterUsers;

document.addEventListener('DOMContentLoaded', () => {
  setupDropzone();
  document.getElementById('exportMonth').value = new Date().toISOString().slice(0,7);
});
