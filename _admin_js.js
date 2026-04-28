// ===================== ADMIN PANEL =====================
const ADMIN_EMAIL = "admin@readify.io";
let adminPassword = "admin2024";
let admLogs = [];
let adminSettings = { allowReg: true, maintenance: false, downloads: true, tracking: true };
let admCurrentFilter = 'all';

function loadAdminState() {
  try {
    const st = localStorage.getItem('readify_admin_settings');
    if (st) {
      const p = JSON.parse(st);
      if (p.pw) adminPassword = p.pw;
      if (p.toggles) adminSettings = p.toggles;
    }
    const lg = localStorage.getItem('readify_admin_logs');
    if (lg) admLogs = JSON.parse(lg);
  } catch(e) {}
}
function saveAdminState() {
  try {
    localStorage.setItem('readify_admin_settings', JSON.stringify({ pw: adminPassword, toggles: adminSettings }));
    localStorage.setItem('readify_admin_logs', JSON.stringify(admLogs));
  } catch(e) {}
}
loadAdminState();

let admClockInt = null;

function openAdminPanel(){
  admLog('ok','Admin session started by '+U.email);
  showPage('admin');
  admInitDashboard();
  admStartClock();

  // Initialize settings toggles
  const tgls = ['allowReg', 'maintenance', 'downloads', 'tracking'];
  tgls.forEach(k => {
    const el = document.getElementById('adm-tgl-' + k);
    if(el) el.classList.toggle('on', !!adminSettings[k]);
  });
}
function closeAdminPanel(){
  clearInterval(admClockInt);
  showPage('dashboard');
}

function admStartClock(){
  const el = document.getElementById('adm-clock');
  const tick = ()=>{ if(el) el.textContent = new Date().toLocaleTimeString(); };
  tick(); admClockInt = setInterval(tick,1000);
}

function admNav(sec){
  document.querySelectorAll('.adm-sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.adm-nav-item').forEach(n=>n.classList.remove('active'));
  const s = document.getElementById('adm-'+sec);
  const n = document.getElementById('adm-nav-'+sec);
  if(s) s.classList.add('active');
  if(n) n.classList.add('active');
  if(sec==='users') admRenderUsers();
  if(sec==='books') admRenderBooks();
  if(sec==='logs') admRenderLogs();
  if(sec==='reports') admRenderReports();
  if(sec==='analytics') admRenderAnalytics();
  if(sec==='settings') admRenderStorageInfo();
}

// ---- Aggregate all users' data from localStorage ----
function admGetAllUsers(){
  try{ return JSON.parse(localStorage.getItem('readify_users')||'{}'); }catch(e){ return {}; }
}

function admInitDashboard(){
  const users = admGetAllUsers();
  const keys = Object.keys(users);
  let totalReads=0, totalHours=0, totalPages=0, totalStreaks=0, totalBMs=0, totalDLs=0;
  keys.forEach(email=>{
    const u = users[email];
    totalReads += u.stats?.booksRead||0;
    totalHours += u.stats?.hoursRead||0;
    totalPages += u.stats?.pagesRead||0;
    totalStreaks += u.streak?.current||0;
    const acts = u.activities||[];
    acts.forEach(a=>{ if(a.title&&a.title.includes('Bookmark')) totalBMs++; if(a.title&&a.title.includes('Download')) totalDLs++; });
  });
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  animateValue(document.getElementById('adm-kpi-users'),0,keys.length,800);
  animateValue(document.getElementById('adm-kpi-reads'),0,totalReads,800);
  set('adm-kpi-hours', totalHours.toFixed(1)+'h');
  set('adm-kpi-pages', totalPages);
  set('adm-kpi-streaks', keys.length?Math.round(totalStreaks/keys.length):0);
  set('adm-kpi-downloads', totalDLs);
  set('adm-kpi-bookmarks', totalBMs);
  admRenderBarChart(users);
  admRenderGenreChart(users);
  admRenderRecentActivity(users);
}

function admRenderBarChart(users){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let vals = [0,0,0,0,0,0,0];
  Object.values(users).forEach(u => {
    if(u.weekly) u.weekly.forEach((val, i) => vals[i] += val);
  });
  if(vals.every(v=>v===0)) vals = [5, 8, 12, 6, 14, 20, 10]; // Fallback if no data
  const max=Math.max(...vals);
  const bc=document.getElementById('adm-bar-chart');
  const bl=document.getElementById('adm-bar-labels');
  if(!bc)return;
  bc.innerHTML=vals.map((v,i)=>`<div class="adm-bar" style="height:${Math.max(6,v/max*86)}px" title="${v.toFixed(1)} hours on ${days[i]}"></div>`).join('');
  if(bl)bl.innerHTML=days.map(d=>`<div style="flex:1;text-align:center;font-size:9px;color:#374151">${d}</div>`).join('');
}

function admRenderGenreChart(users){
  const el=document.getElementById('adm-genre-chart');if(!el)return;
  const genreCounts = {};
  let total = 0;
  Object.values(users).forEach(u => {
    if(u.progress) {
      Object.keys(u.progress).forEach(bookId => {
        const b = BOOKS.find(bk => bk.id == bookId);
        if(b) {
          genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
          total++;
        }
      });
    }
  });
  
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ec4899','#ef4444'];
  let genres = Object.keys(genreCounts).map((name, i) => ({
    name, pct: Math.round((genreCounts[name]/total)*100), color: colors[i % colors.length]
  })).sort((a,b)=>b.pct-a.pct);

  if(!genres.length) genres=[{name:'Fantasy',pct:38,color:'#7c3aed'},{name:'Sci-Fi',pct:29,color:'#06b6d4'},{name:'Thriller',pct:19,color:'#f59e0b'},{name:'Adventure',pct:9,color:'#10b981'},{name:'Romance',pct:5,color:'#ec4899'}];

  el.innerHTML=genres.map(g=>`<div class="adm-pie-row"><div class="adm-pie-dot" style="background:${g.color}"></div><div class="adm-pie-name">${g.name}</div><div class="adm-pie-bar"><div class="adm-pie-fill" style="width:${g.pct}%;background:${g.color}"></div></div><div class="adm-pie-pct">${g.pct}%</div></div>`).join('');
}

function admRenderRecentActivity(users){
  const el=document.getElementById('adm-recent-activity');if(!el)return;
  let allActs=[];
  Object.keys(users).forEach(email=>{
    (users[email].activities||[]).forEach(a=>allActs.push({...a,email}));
  });
  allActs.sort((a,b)=>new Date(b.time)-new Date(a.time));
  const top = allActs.slice(0,8);
  if(!top.length){el.innerHTML='<div style="color:#374151;font-size:13px;padding:16px 0">No activity recorded yet.</div>';return;}
  el.innerHTML=top.map(a=>`<div class="adm-log-item"><div class="adm-log-dot dot-ok"></div><div class="adm-log-msg"><strong style="color:#9ca3af">${a.email}</strong> — ${a.title}: ${a.desc}</div><div class="adm-log-time">${a.time||''}</div></div>`).join('');
}

// ---- Users ----
let admUserFilterMode='all';
function admRenderUsers(filter){
  const users=admGetAllUsers();
  const tbody=document.getElementById('adm-users-tbody');if(!tbody)return;
  const q=(document.getElementById('adm-user-search')?.value||'').toLowerCase();
  const avatarColors=['#7c3aed','#06b6d4','#10b981','#f59e0b','#ec4899','#4f46e5','#ef4444'];
  let rows=Object.keys(users).filter(email=>{
    const u=users[email];
    if(q&&!email.toLowerCase().includes(q)&&!(u.name||'').toLowerCase().includes(q))return false;
    if(admUserFilterMode==='admin'&&email!==ADMIN_EMAIL)return false;
    return true;
  }).map((email,i)=>{
    const u=users[email];
    const isAdmin=email===ADMIN_EMAIL;
    const color=avatarColors[i%avatarColors.length];
    const initial=(u.name||email)[0].toUpperCase();
    const role=isAdmin?'<span class="adm-tag purple">&#x1F6E1;&#xFE0F; Admin</span>':'<span class="adm-tag green">&#x25CF; User</span>';
    const joinDate=u.joinDate?new Date(u.joinDate).toLocaleDateString():'Unknown';
    return `<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="adm-av" style="background:${color}">${initial}</div><div><div style="font-size:13px;font-weight:600;color:#f0f4ff">${u.name||'Unknown'}</div></div></div></td>
    <td style="color:#4b5563">${email}</td><td>${role}</td>
    <td class="adm-stat-number">${u.stats?.booksRead||0}</td>
    <td class="adm-stat-number">${(u.stats?.hoursRead||0).toFixed(1)}h</td>
    <td>${joinDate}</td>
    <td><div style="display:flex;gap:5px">${isAdmin?'':'<button class="adm-act-btn r" onclick="admBanUser(\''+email+'\')">Ban</button>'}<button class="adm-act-btn b" onclick="admViewUser(\''+email+'\')">View</button></div></td></tr>`;
  });
  tbody.innerHTML=rows.length?rows.join(''):'<tr><td colspan="7" style="text-align:center;color:#374151;padding:24px">No users found.</td></tr>';
}
function admFilterUsers(){admRenderUsers();}
function admUserFilter(mode,el){
  admUserFilterMode=mode;
  document.querySelectorAll('#adm-users .adm-filter').forEach(f=>f.classList.remove('on'));
  el.classList.add('on');
  admRenderUsers();
}
function admBanUser(email){
  if(email===ADMIN_EMAIL){showToast('&#x26A0;&#xFE0F; Cannot ban admin!');return;}
  openModal('Ban User','Remove this user and all their data? This cannot be undone.',()=>{
    const users=admGetAllUsers();
    delete users[email];
    localStorage.setItem('readify_users',JSON.stringify(users));
    admLog('warn','User banned/removed: '+email);
    admRenderUsers();
    showToast('&#x1F6AB; User removed: '+email);
  });
}
function admViewUser(email){
  const users=admGetAllUsers();const u=users[email];if(!u)return;
  showToast('&#x1F464; '+email+' — '+u.stats?.booksRead+' books, '+(u.stats?.hoursRead||0).toFixed(1)+'h read');
}

// ---- Books ----
function admRenderBooks(filterVal){
  const el=document.getElementById('adm-books-grid');if(!el)return;
  const icons=['&#x1F31F;','&#x1F680;','&#x1F50F;','&#x1F5FA;&#xFE0F;','&#x26A1;','&#x1F3AD;'];
  const books=(filterVal&&filterVal.length>1)?BOOKS.filter(b=>b.title.toLowerCase().includes(filterVal.toLowerCase())||b.genre===filterVal):BOOKS;
  el.innerHTML=books.map((b,i)=>`<div class="adm-book-card">
    <div class="adm-book-img">${icons[i%icons.length]}</div>
    <div class="adm-book-body">
      <div class="adm-book-name">${b.title}</div>
      <div class="adm-book-auth">${b.author}</div>
      <div class="adm-book-row"><span class="adm-chip">${b.genre}</span><span class="adm-chip">&#x2B50; ${b.rating||0}</span><span class="adm-chip">${b.pages}p</span></div>
      <div class="adm-book-acts">
        <button class="adm-act-btn b" onclick="admEditBook(${b.id})">Edit</button>
        <button class="adm-act-btn g" onclick="admFeatureBook(${b.id})">${b.featured?'Unfeature':'Feature'}</button>
        <button class="adm-act-btn r" onclick="admDeleteBook(${b.id})">Del</button>
      </div>
    </div>
  </div>`).join('');
}
function admFilterBooks(val){admRenderBooks(val);}

function admShowAddBook() {
  document.getElementById('adm-book-modal-title').textContent = 'Add New Book';
  document.getElementById('adm-book-id').value = '';
  document.getElementById('adm-book-title').value = '';
  document.getElementById('adm-book-author').value = '';
  document.getElementById('adm-book-genre').value = 'Fantasy';
  document.getElementById('adm-book-pages').value = '';
  document.getElementById('adm-book-cover').value = '';
  document.getElementById('adm-book-modal').classList.add('open');
}

function admEditBook(id){
  const b=BOOKS.find(b=>b.id===id);
  if(!b) return;
  document.getElementById('adm-book-modal-title').textContent = 'Edit Book';
  document.getElementById('adm-book-id').value = b.id;
  document.getElementById('adm-book-title').value = b.title || '';
  document.getElementById('adm-book-author').value = b.author || '';
  document.getElementById('adm-book-genre').value = b.genre || 'Fantasy';
  document.getElementById('adm-book-pages').value = b.pages || '';
  document.getElementById('adm-book-cover').value = b.cover || '';
  document.getElementById('adm-book-modal').classList.add('open');
}

function admSaveBook() {
  const idVal = document.getElementById('adm-book-id').value;
  const title = document.getElementById('adm-book-title').value.trim();
  const author = document.getElementById('adm-book-author').value.trim();
  const genre = document.getElementById('adm-book-genre').value;
  const pages = parseInt(document.getElementById('adm-book-pages').value) || 0;
  const cover = document.getElementById('adm-book-cover').value.trim();

  if(!title || !author) { showToast('⚠️ Title and Author are required.'); return; }

  if(idVal === '') {
    // Add new
    const newId = BOOKS.length > 0 ? Math.max(...BOOKS.map(b=>b.id)) + 1 : 1;
    BOOKS.push({ id: newId, title, author, genre, pages, cover: cover||'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'260\'%3E%3Crect width=\'180\' height=\'260\' fill=\'%23333\'/%3E%3C/svg%3E', rating: 0, chapters: [] });
    admLog('ok', 'Added new book: ' + title);
    showToast('✅ Book added!');
  } else {
    // Edit existing
    const id = parseInt(idVal);
    const idx = BOOKS.findIndex(b=>b.id===id);
    if(idx > -1) {
      BOOKS[idx] = { ...BOOKS[idx], title, author, genre, pages };
      if(cover) BOOKS[idx].cover = cover;
      admLog('ok', 'Edited book: ' + title);
      showToast('✅ Book updated!');
    }
  }
  saveBooks();
  document.getElementById('adm-book-modal').classList.remove('open');
  admRenderBooks();
}

function admDeleteBook(id) {
  const idx = BOOKS.findIndex(b=>b.id===id);
  if(idx === -1) return;
  const title = BOOKS[idx].title;
  openModal('Delete Book', 'Are you sure you want to delete "' + title + '"? This will remove it from the library for all users.', () => {
    BOOKS.splice(idx, 1);
    saveBooks();
    admLog('warn', 'Deleted book: ' + title);
    admRenderBooks();
    showToast('🗑️ Book deleted: ' + title);
  });
}

function admFeatureBook(id){
  const b=BOOKS.find(b=>b.id===id);
  if(b){
    b.featured = !b.featured;
    saveBooks();
    showToast(b.featured ? '⭐ Featured: '+b.title : 'Unfeatured: '+b.title);
    admLog('ok', (b.featured ? 'Featured' : 'Unfeatured') + ' book: '+b.title);
    admRenderBooks();
  }
}

// ---- Reports ----
function admRenderReports(){
  const users=admGetAllUsers();
  const keys=Object.keys(users);
  let totalR=0,totalP=0,totalH=0,totalS=0;
  keys.forEach(e=>{const u=users[e];totalR+=u.stats?.booksRead||0;totalP+=u.stats?.pagesRead||0;totalH+=u.stats?.hoursRead||0;totalS+=u.streak?.best||0;});
  const el=document.getElementById('adm-report-stats');
  if(el)el.innerHTML=`Total Users: <strong style="color:#f0f4ff">${keys.length}</strong><br>Total Books Read: <strong style="color:#f0f4ff">${totalR}</strong><br>Total Pages: <strong style="color:#f0f4ff">${totalP}</strong><br>Total Hours: <strong style="color:#f0f4ff">${totalH.toFixed(1)}</strong><br>Best Streak (sum): <strong style="color:#f59e0b">${totalS} days</strong>`;
  const tbody=document.getElementById('adm-report-tbody');
  if(tbody)tbody.innerHTML=keys.map(email=>{
    const u=users[email];
    return `<tr><td style="color:#9ca3af">${u.name||email}</td><td class="adm-stat-number">${u.stats?.booksRead||0}</td><td class="adm-stat-number">${u.stats?.pagesRead||0}</td><td class="adm-stat-number">${(u.stats?.hoursRead||0).toFixed(1)}h</td><td class="adm-stat-number">${u.streak?.best||0} days</td></tr>`;
  }).join('');
}

function admExportReport(type){
  const users=admGetAllUsers();const keys=Object.keys(users);
  if(type==='csv'){
    let csv='Name,Email,BooksRead,PagesRead,HoursRead,BestStreak\n';
    keys.forEach(e=>{const u=users[e];csv+=`"${u.name||''}","${e}",${u.stats?.booksRead||0},${u.stats?.pagesRead||0},${(u.stats?.hoursRead||0).toFixed(1)},${u.streak?.best||0}\n`;});
    const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='readify_report.csv';a.click();
  } else {
    const blob=new Blob([JSON.stringify(users,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='readify_report.json';a.click();
  }
  admLog('ok','Report exported as '+type.toUpperCase());
  showToast('&#x2705; Report exported as '+type.toUpperCase());
}

// ---- Analytics ----
function admRenderAnalytics(){
  admInitDashboard();
  const el=document.getElementById('adm-top-books-chart');if(!el)return;
  const users=admGetAllUsers();
  const bookProgress={};
  BOOKS.forEach(b=>{ bookProgress[b.id]={title:b.title,total:0,count:0}; });
  Object.values(users).forEach(u=>{
    if(u.progress)Object.keys(u.progress).forEach(id=>{if(bookProgress[id]){bookProgress[id].total+=u.progress[id];bookProgress[id].count++;}});
  });
  const sorted=Object.values(bookProgress).sort((a,b)=>b.total-a.total);
  el.innerHTML=sorted.map(b=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#9ca3af">${b.title}</span><span style="color:#f0f4ff;font-weight:700">${b.count} readers</span></div><div class="adm-progress"><div class="adm-progress-fill" style="width:${b.count?Math.min(100,b.total/b.count||0):0}%"></div></div></div>`).join('');
}

// ---- Logs ----
function admLog(type,msg){
  admLogs.unshift({type,msg,time:new Date().toLocaleTimeString()});
  if(admLogs.length>100)admLogs.pop();
  saveAdminState();
}
function admRenderLogs(){
  const el=document.getElementById('adm-logs-list');if(!el)return;
  const filtered=admCurrentFilter==='all'?admLogs:admLogs.filter(l=>l.type===admCurrentFilter);
  if(!filtered.length){el.innerHTML='<div style="color:#374151;font-size:13px;padding:20px">No logs to display.</div>';return;}
  el.innerHTML=filtered.map(l=>`<div class="adm-log-item"><div class="adm-log-dot dot-${l.type}"></div><div class="adm-log-msg">${l.msg}</div><div class="adm-log-time">${l.time}</div></div>`).join('');
}
function admLogFilter(mode,el){
  admCurrentFilter=mode;
  document.querySelectorAll('#adm-logs .adm-filter').forEach(f=>f.classList.remove('on'));
  el.classList.add('on');
  admRenderLogs();
}
function admClearLogs(){admLogs=[];saveAdminState();admRenderLogs();showToast('&#x1F9F9; Logs cleared.');}

// ---- Settings ----
function admChangePassword(){
  const p1=document.getElementById('adm-pw-inp')?.value;
  const p2=document.getElementById('adm-pw2-inp')?.value;
  if(!p1||p1.length<6){showToast('&#x26A0;&#xFE0F; Password must be 6+ chars.');return;}
  if(p1!==p2){showToast('&#x26A0;&#xFE0F; Passwords do not match.');return;}
  adminPassword=p1;
  saveAdminState();
  admLog('ok','Admin password changed.');
  showToast('&#x2705; Admin password updated!');
}
function admBroadcast(){
  const msg=document.getElementById('adm-broadcast-msg')?.value?.trim();
  if(!msg){showToast('&#x26A0;&#xFE0F; Message is empty.');return;}
  adminSettings.broadcast = msg;
  saveAdminState();
  showToast('&#x1F4E3; '+msg);
  admLog('ok','Broadcast sent: '+msg);
}
function admToggleSetting(key, el) {
  adminSettings[key] = !adminSettings[key];
  saveAdminState();
  el.classList.toggle('active', adminSettings[key]);
  admLog('warn', key + ' changed to ' + adminSettings[key]);
}
function admRenderStorageInfo(){
  let total=0;try{Object.keys(localStorage).forEach(k=>{total+=localStorage.getItem(k)?.length||0;});}catch(e){}
  const el=document.getElementById('adm-storage-info');
  if(el)el.textContent='localStorage used: ~'+(total/1024).toFixed(1)+' KB';
}
function admExportAllData(){
  const data={users:admGetAllUsers(),exported:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='readify_backup.json';a.click();
  admLog('ok','Full data backup downloaded.');
  showToast('&#x2705; Backup downloaded!');
}
function admNukeAllData(){
  openModal('DANGER: Clear ALL Data','This will permanently delete all user accounts and reading data. This cannot be undone.',()=>{
    localStorage.removeItem('readify_users');
    admLog('err','ALL USER DATA CLEARED by admin.');
    showToast('&#x1F4A5; All data cleared. Reloading...');
    setTimeout(()=>location.reload(),1500);
  });
}
