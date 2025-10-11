// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
  authDomain: "authapp-386ee.firebaseapp.com",
  projectId: "authapp-386ee",
  storageBucket: "authapp-386ee.appspot.com",
  messagingSenderId: "809698525310",
  appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
  measurementId: "G-EJZTSBSGQT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- DOM references ----------
const content = document.getElementById('content');
const adminBadge = document.getElementById('adminBadge');
const tabs = document.querySelectorAll('.tab');
const refreshBtn = document.getElementById('refreshBtn');
const signOutBtn = document.getElementById('signOut');
const globalSearchEl = document.getElementById('globalSearch');
const clearSearchBtn = document.getElementById('clearSearch');
const globalStatusEl = document.getElementById('globalStatus');

// ---------- State ----------
let currentUser = null;
let activeTab = 'tournaments';
let searchQuery = '';
let currentData = {
  users: [],
  tournaments: [],
  deposits: [],
  withdrawals: []
};

// ---------- Utility functions ----------
const escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const formatDate = timestamp => timestamp?.toDate ? timestamp.toDate().toLocaleDateString() : 'N/A';
const formatDateTime = timestamp => timestamp?.toDate ? timestamp.toDate().toLocaleString() : 'N/A';

const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const showNotification = (message, type = 'info') => {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4);
    ${type === 'error' ? 'background: #ef4444;' : 
      type === 'success' ? 'background: #10b981;' : 
      'background: #6366f1;'}
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
};

const validateInput = (input, maxLength = 100) => {
  if (input.length > maxLength) {
    throw new Error(`Input too long (max ${maxLength} characters)`);
  }
  return input.replace(/[<>]/g, '');
};

// ---------- Loading Screen Management ----------
const updateLoadingText = (text) => {
  const loadingText = document.getElementById('loadingText');
  if (loadingText) {
    loadingText.textContent = text;
  }
};

const hideLoadingScreen = () => {
  if (typeof window.hideLoadingScreen === 'function') {
    window.hideLoadingScreen();
  } else {
    // Fallback: hide loading screen manually
    const loadingScreen = document.querySelector('.loading-screen');
    const mainContent = document.getElementById('mainContent');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 500);
    }
    if (mainContent) {
      mainContent.classList.add('loaded');
    }
  }
};

// ---------- Authentication & Admin Gate ----------
auth.onAuthStateChanged(async user => {
  if (!user) {
    updateLoadingText('Redirecting to login...');
    setTimeout(() => {
      location.href = 'login.html';
    }, 1000);
    return;
  }
  
  currentUser = user;
  updateLoadingText('Checking admin privileges...');
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';
    
    if (!isAdmin) {
      updateLoadingText('Access denied - Redirecting...');
      showNotification('Access denied - Admin privileges required', 'error');
      await auth.signOut();
      setTimeout(() => {
        location.href = 'login.html';
      }, 2000);
      return;
    }
    
    // Update admin badge
    const badgeText = adminBadge.querySelector('.badge-text');
    if (badgeText) {
      badgeText.textContent = user.email;
    } else {
      adminBadge.textContent = `Admin: ${user.email}`;
    }
    adminBadge.style.color = '#10b981';
    
    // Log admin access
    await logAdminAction('login', user.uid, { email: user.email });
    
    updateLoadingText('Loading admin interface...');
    
    // Bind controls
    bindTopControls();
    
    // Load tab from URL hash or default
    const hash = location.hash.replace('#', '');
    if (hash && document.querySelector(`[data-tab="${hash}"]`)) {
      activeTab = hash;
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelector(`[data-tab="${hash}"]`).classList.add('active');
    }
    
    // Render current tab
    await renderActiveTab();
    
    // Hide loading screen
    setTimeout(hideLoadingScreen, 500);
    
  } catch (err) {
    console.error('Auth check error', err);
    updateLoadingText('Authentication error occurred');
    
    const badgeText = adminBadge.querySelector('.badge-text');
    if (badgeText) {
      badgeText.textContent = 'Authentication Error';
    } else {
      adminBadge.textContent = 'Authentication Error';
    }
    
    showNotification('Failed to verify admin privileges', 'error');
    
    // Still hide loading screen but show error
    setTimeout(hideLoadingScreen, 1000);
    
    content.innerHTML = `
      <div class="error-state">
        <h3>Authentication Error</h3>
        <p>Failed to verify admin privileges. Please try again.</p>
        <button onclick="location.reload()" class="small">Retry</button>
      </div>
    `;
  }
});

// ---------- Admin Action Logging ----------
async function logAdminAction(action, targetUid, details = {}) {
  try {
    await db.collection('adminLogs').add({
      adminUid: currentUser.uid,
      adminEmail: currentUser.email,
      action,
      targetUid,
      details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

// ---------- Bind Controls ----------
function bindTopControls() {
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      location.hash = activeTab;
      renderActiveTab();
    });
  });

  // Refresh button
  refreshBtn.onclick = () => {
    renderActiveTab();
    showNotification('Data refreshed', 'success');
  };

  // Sign out
  signOutBtn.onclick = async () => {
    try {
      await logAdminAction('logout', currentUser.uid);
      showNotification('Signing out...', 'info');
      setTimeout(async () => {
        await auth.signOut();
        location.href = 'login.html';
      }, 1000);
    } catch (error) {
      console.error('Sign out error:', error);
      showNotification('Sign out failed', 'error');
    }
  };

  // Clear search
  clearSearchBtn.onclick = () => {
    globalSearchEl.value = '';
    searchQuery = '';
    renderActiveTab();
  };

  // Search input
  globalSearchEl.oninput = debounce(e => {
    try {
      searchQuery = validateInput(e.target.value.trim().toLowerCase());
      renderActiveTab();
    } catch (error) {
      showNotification(error.message, 'error');
      globalSearchEl.value = '';
      searchQuery = '';
    }
  }, 300);

  // Event delegation for dynamic buttons
  document.addEventListener('click', async ev => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    
    const { prom, dem, verify, reject, approve, cancel } = btn.dataset;
    
    try {
      if (prom || dem) {
        await handleRoleUpdate(btn, prom || dem, prom ? 'admin' : 'user');
      } else if (verify || reject) {
        await handleVerification(btn, verify || reject, reject ? 'rejected' : 'verified');
      } else if (approve || cancel) {
        await handleTransaction(btn, approve || cancel, approve ? 'approved' : 'cancelled');
      }
    } catch (error) {
      console.error('Action failed:', error);
      showNotification('Action failed', 'error');
      btn.disabled = false;
    }
  });
}

// ---------- Role Update Handler ----------
async function handleRoleUpdate(btn, uid, newRole) {
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Updating...';
  
  try {
    await db.collection('users').doc(uid).update({
      role: newRole,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await logAdminAction('role_update', uid, { newRole });
    showNotification(`User role updated to ${newRole}`, 'success');
    await renderActiveTab();
    
  } catch (error) {
    console.error('Role update failed:', error);
    showNotification('Failed to update role', 'error');
    throw error;
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// ---------- Verification Handler ----------
async function handleVerification(btn, uid, status) {
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Processing...';
  
  try {
    await db.collection('users').doc(uid).update({
      verified: status === 'verified',
      verificationStatus: status,
      verifiedAt: status === 'verified' ? firebase.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await logAdminAction('verification_update', uid, { status });
    showNotification(`User verification ${status}`, 'success');
    await renderActiveTab();
    
  } catch (error) {
    console.error('Verification update failed:', error);
    showNotification('Failed to update verification', 'error');
    throw error;
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// ---------- Transaction Handler ----------
async function handleTransaction(btn, docId, status) {
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Processing...';
  
  try {
    const collection = activeTab; // 'deposits' or 'withdrawals'
    await db.collection(collection).doc(docId).update({
      status: status,
      processedAt: firebase.firestore.FieldValue.serverTimestamp(),
      processedBy: currentUser.uid
    });
    
    await logAdminAction('transaction_update', docId, { type: collection, status });
    showNotification(`Transaction ${status}`, 'success');
    await renderActiveTab();
    
  } catch (error) {
    console.error('Transaction update failed:', error);
    showNotification('Failed to update transaction', 'error');
    throw error;
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// ---------- Render Active Tab ----------
async function renderActiveTab() {
  globalStatusEl.textContent = `Loading ${activeTab}...`;
  content.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading ${activeTab} data...</p>
    </div>
  `;
  
  try {
    switch (activeTab) {
      case 'users':
        await renderUsersAdmin();
        break;
      case 'tournaments':
        await renderTournamentsAdmin();
        break;
      case 'deposits':
        await renderDepositsAdmin();
        break;
      case 'withdrawals':
        await renderWithdrawalsAdmin();
        break;
      case 'settings':
        await renderSettingsAdmin();
        break;
      default:
        content.innerHTML = `<div class="no-data">Tab "${activeTab}" not implemented</div>`;
    }
    globalStatusEl.textContent = '';
  } catch (error) {
    console.error(`renderActiveTab error (${activeTab})`, error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading ${activeTab}</h3>
        <p>${error.message}</p>
        <button onclick="renderActiveTab()" class="small">Retry</button>
      </div>
    `;
    globalStatusEl.textContent = 'Error loading data';
  }
}

// ---------- Render Users Tab ----------
async function renderUsersAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>👥 User Management</h2>
      <div class="row">
        <div class="search-container">
          <input id="u-search" class="search" placeholder="Search email, UID, or role..." />
          <span class="search-icon">🔍</span>
        </div>
        <button id="u-reload" class="small">
          <span class="btn-icon">🔄</span>
          Reload
        </button>
      </div>
      <div id="users-stats" class="stats-grid"></div>
      <div id="users-list" class="card-grid"></div>
      <div style="overflow:auto; margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Created</th>
              <th>UID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="users-table"></tbody>
        </table>
      </div>
    </div>
  `;

  // Bind controls
  document.getElementById('u-reload').onclick = renderUsersAdmin;
  document.getElementById('u-search').oninput = debounce(renderUsersAdmin, 300);

  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = [];
    snap.forEach(doc => {
      users.push({ uid: doc.id, ...doc.data() });
    });
    
    currentData.users = users;

    // Filter based on search
    const searchEl = document.getElementById('u-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredUsers = users.filter(u =>
      !q || 
      `${u.email || ''} ${u.uid || ''} ${u.role || ''} ${u.verificationStatus || ''}`
        .toLowerCase().includes(q)
    );

    // Render stats
    const statsEl = document.getElementById('users-stats');
    if (statsEl) {
      const total = users.length;
      const admins = users.filter(u => u.role === 'admin').length;
      const verified = users.filter(u => u.verified).length;
      const pending = users.filter(u => !u.verified).length;
      
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${admins}</div>
          <div class="stat-label">Admins</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${verified}</div>
          <div class="stat-label">Verified</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${pending}</div>
          <div class="stat-label">Pending</div>
        </div>
      `;
    }

    // Render card view
    const listEl = document.getElementById('users-list');
    if (listEl) {
      listEl.innerHTML = filteredUsers.length ? filteredUsers.map(u => `
        <div class="card-small">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <div style="flex:1">
              <strong style="display:block;margin-bottom:4px">${escapeHtml(u.email)}</strong>
              <span class="role-badge ${u.role || 'user'}">${escapeHtml(u.role || 'user')}</span>
            </div>
            <span class="status-badge ${u.verified ? 'verified' : 'unverified'}">
              ${u.verified ? '✓ Verified' : 'Unverified'}
            </span>
          </div>
          <div class="muted" style="font-size:12px;margin-bottom:12px">
            <div>UID: ${u.uid.substring(0, 8)}...</div>
            <div>Created: ${formatDate(u.createdAt)}</div>
          </div>
          <div class="action-row">
            ${u.role !== 'admin' ? `
              <button class="ghost small" data-prom="${u.uid}">
                <span class="btn-icon">⬆️</span>
                Promote
              </button>
            ` : ''}
            ${u.role === 'admin' && u.uid !== currentUser.uid ? `
              <button class="danger small" data-dem="${u.uid}">
                <span class="btn-icon">⬇️</span>
                Demote
              </button>
            ` : ''}
            ${!u.verified ? `
              <button class="success small" data-verify="${u.uid}">
                <span class="btn-icon">✓</span>
                Verify
              </button>
            ` : `
              <button class="warning small" data-reject="${u.uid}">
                <span class="btn-icon">✗</span>
                Revoke
              </button>
            `}
          </div>
        </div>
      `).join('') : '<div class="no-data">No users found</div>';
    }

    // Render table view
    const tableEl = document.getElementById('users-table');
    if (tableEl) {
      tableEl.innerHTML = filteredUsers.length ? filteredUsers.map(u => `
        <tr>
          <td><strong>${escapeHtml(u.email)}</strong></td>
          <td><span class="role-badge ${u.role || 'user'}">${escapeHtml(u.role || 'user')}</span></td>
          <td><span class="status-badge ${u.verified ? 'verified' : 'unverified'}">${u.verified ? 'Verified' : 'Unverified'}</span></td>
          <td>${formatDate(u.createdAt)}</td>
          <td><code style="font-size:11px">${u.uid.substring(0, 10)}...</code></td>
          <td class="action-row">
            ${u.role !== 'admin' ? `
              <button class="ghost small" data-prom="${u.uid}" title="Promote to Admin">
                <span class="btn-icon">⬆️</span>
              </button>
            ` : ''}
            ${u.role === 'admin' && u.uid !== currentUser.uid ? `
              <button class="danger small" data-dem="${u.uid}" title="Demote to User">
                <span class="btn-icon">⬇️</span>
              </button>
            ` : ''}
            ${!u.verified ? `
              <button class="success small" data-verify="${u.uid}" title="Verify User">
                <span class="btn-icon">✓</span>
              </button>
            ` : `
              <button class="warning small" data-reject="${u.uid}" title="Revoke Verification">
                <span class="btn-icon">✗</span>
              </button>
            `}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="no-data">No users found</td></tr>';
    }

  } catch (error) {
    console.error('renderUsersAdmin error', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading Users</h3>
        <p>${error.message}</p>
        <button onclick="renderUsersAdmin()" class="small">Retry</button>
      </div>
    `;
  }
}

// ---------- Render Tournaments Tab ----------
async function renderTournamentsAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>🏆 Tournament Management</h2>
      <div class="row">
        <div class="search-container">
          <input id="t-search" class="search" placeholder="Search tournament title, host, or status..." />
          <span class="search-icon">🔍</span>
        </div>
        <button id="t-reload" class="small">
          <span class="btn-icon">🔄</span>
          Reload
        </button>
      </div>
      <div style="overflow:auto; margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Host</th>
              <th>Status</th>
              <th>Players</th>
              <th>Prize Pool</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tournaments-table"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const snap = await db.collection('tournaments').orderBy('createdAt', 'desc').get();
    const tournaments = [];
    snap.forEach(doc => {
      tournaments.push({ id: doc.id, ...doc.data() });
    });
    
    currentData.tournaments = tournaments;

    const searchEl = document.getElementById('t-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredTournaments = tournaments.filter(t =>
      !q || 
      `${t.title || ''} ${t.host || ''} ${t.status || ''}`
        .toLowerCase().includes(q)
    );

    const tableEl = document.getElementById('tournaments-table');
    if (tableEl) {
      tableEl.innerHTML = filteredTournaments.length ? filteredTournaments.map(t => `
        <tr>
          <td><strong>${escapeHtml(t.title || 'Untitled Tournament')}</strong></td>
          <td>${escapeHtml(t.hostEmail || t.host || 'N/A')}</td>
          <td><span class="status-badge ${t.status || 'draft'}">${escapeHtml(t.status || 'draft')}</span></td>
          <td>${t.players ? t.players.length : 0}</td>
          <td>$${t.prizePool || '0'}</td>
          <td>${formatDate(t.createdAt)}</td>
          <td class="action-row">
            <button class="ghost small" onclick="viewTournament('${t.id}')" title="View Tournament">
              <span class="btn-icon">👁️</span>
            </button>
            <button class="warning small" onclick="editTournament('${t.id}')" title="Edit Tournament">
              <span class="btn-icon">✏️</span>
            </button>
            ${t.status !== 'cancelled' ? `
              <button class="danger small" onclick="cancelTournament('${t.id}')" title="Cancel Tournament">
                <span class="btn-icon">🗑️</span>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="no-data">No tournaments found</td></tr>';
    }

    // Bind controls
    document.getElementById('t-reload').onclick = renderTournamentsAdmin;
    document.getElementById('t-search').oninput = debounce(renderTournamentsAdmin, 300);

  } catch (error) {
    console.error('renderTournamentsAdmin error', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading Tournaments</h3>
        <p>${error.message}</p>
        <button onclick="renderTournamentsAdmin()" class="small">Retry</button>
      </div>
    `;
  }
}

// ---------- Render Deposits Tab ----------
async function renderDepositsAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>💰 Deposit Management</h2>
      <div class="row">
        <div class="search-container">
          <input id="d-search" class="search" placeholder="Search user email or transaction ID..." />
          <span class="search-icon">🔍</span>
        </div>
        <button id="d-reload" class="small">
          <span class="btn-icon">🔄</span>
          Reload
        </button>
      </div>
      <div id="deposits-stats" class="stats-grid"></div>
      <div style="overflow:auto; margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Created</th>
              <th>Transaction ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="deposits-table"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const snap = await db.collection('deposits').orderBy('createdAt', 'desc').get();
    const deposits = [];
    snap.forEach(doc => {
      deposits.push({ id: doc.id, ...doc.data() });
    });
    
    currentData.deposits = deposits;

    const searchEl = document.getElementById('d-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredDeposits = deposits.filter(d =>
      !q || 
      `${d.userEmail || ''} ${d.transactionId || ''} ${d.status || ''}`
        .toLowerCase().includes(q)
    );

    // Render stats
    const statsEl = document.getElementById('deposits-stats');
    if (statsEl) {
      const total = deposits.length;
      const pending = deposits.filter(d => d.status === 'pending').length;
      const approved = deposits.filter(d => d.status === 'approved').length;
      const totalAmount = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Total Deposits</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${approved}</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">$${totalAmount.toFixed(2)}</div>
          <div class="stat-label">Total Amount</div>
        </div>
      `;
    }

    const tableEl = document.getElementById('deposits-table');
    if (tableEl) {
      tableEl.innerHTML = filteredDeposits.length ? filteredDeposits.map(d => `
        <tr>
          <td>${escapeHtml(d.userEmail || 'N/A')}</td>
          <td><strong>$${parseFloat(d.amount || 0).toFixed(2)}</strong></td>
          <td>${escapeHtml(d.method || 'N/A')}</td>
          <td><span class="status-badge ${d.status || 'pending'}">${escapeHtml(d.status || 'pending')}</span></td>
          <td>${formatDateTime(d.createdAt)}</td>
          <td><code style="font-size:11px">${d.transactionId || 'N/A'}</code></td>
          <td class="action-row">
            ${d.status === 'pending' ? `
              <button class="success small" data-approve="${d.id}" title="Approve Deposit">
                <span class="btn-icon">✓</span>
                Approve
              </button>
              <button class="danger small" data-cancel="${d.id}" title="Reject Deposit">
                <span class="btn-icon">✗</span>
                Reject
              </button>
            ` : `
              <span class="muted">Processed</span>
            `}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="no-data">No deposits found</td></tr>';
    }

    document.getElementById('d-reload').onclick = renderDepositsAdmin;
    document.getElementById('d-search').oninput = debounce(renderDepositsAdmin, 300);

  } catch (error) {
    console.error('renderDepositsAdmin error', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading Deposits</h3>
        <p>${error.message}</p>
        <button onclick="renderDepositsAdmin()" class="small">Retry</button>
      </div>
    `;
  }
}

// ---------- Render Withdrawals Tab ----------
async function renderWithdrawalsAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>🏦 Withdrawal Management</h2>
      <div class="row">
        <div class="search-container">
          <input id="w-search" class="search" placeholder="Search user email or transaction ID..." />
          <span class="search-icon">🔍</span>
        </div>
        <button id="w-reload" class="small">
          <span class="btn-icon">🔄</span>
          Reload
        </button>
      </div>
      <div id="withdrawals-stats" class="stats-grid"></div>
      <div style="overflow:auto; margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Created</th>
              <th>Account Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="withdrawals-table"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const snap = await db.collection('withdrawals').orderBy('createdAt', 'desc').get();
    const withdrawals = [];
    snap.forEach(doc => {
      withdrawals.push({ id: doc.id, ...doc.data() });
    });
    
    currentData.withdrawals = withdrawals;

    const searchEl = document.getElementById('w-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredWithdrawals = withdrawals.filter(w =>
      !q || 
      `${w.userEmail || ''} ${w.transactionId || ''} ${w.status || ''}`
        .toLowerCase().includes(q)
    );

    // Render stats
    const statsEl = document.getElementById('withdrawals-stats');
    if (statsEl) {
      const total = withdrawals.length;
      const pending = withdrawals.filter(w => w.status === 'pending').length;
      const approved = withdrawals.filter(w => w.status === 'approved').length;
      const totalAmount = withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
      
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Total Withdrawals</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${approved}</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">$${totalAmount.toFixed(2)}</div>
          <div class="stat-label">Total Amount</div>
        </div>
      `;
    }

    const tableEl = document.getElementById('withdrawals-table');
    if (tableEl) {
      tableEl.innerHTML = filteredWithdrawals.length ? filteredWithdrawals.map(w => `
        <tr>
          <td>${escapeHtml(w.userEmail || 'N/A')}</td>
          <td><strong>$${parseFloat(w.amount || 0).toFixed(2)}</strong></td>
          <td>${escapeHtml(w.method || 'N/A')}</td>
          <td><span class="status-badge ${w.status || 'pending'}">${escapeHtml(w.status || 'pending')}</span></td>
          <td>${formatDateTime(w.createdAt)}</td>
          <td>
            ${w.accountNumber ? `<div style="font-size:11px">${escapeHtml(w.accountNumber)}</div>` : 'N/A'}
          </td>
          <td class="action-row">
            ${w.status === 'pending' ? `
              <button class="success small" data-approve="${w.id}" title="Approve Withdrawal">
                <span class="btn-icon">✓</span>
                Approve
              </button>
              <button class="danger small" data-cancel="${w.id}" title="Reject Withdrawal">
                <span class="btn-icon">✗</span>
                Reject
              </button>
            ` : `
              <span class="muted">Processed</span>
            `}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="no-data">No withdrawals found</td></tr>';
    }

    document.getElementById('w-reload').onclick = renderWithdrawalsAdmin;
    document.getElementById('w-search').oninput = debounce(renderWithdrawalsAdmin, 300);

  } catch (error) {
    console.error('renderWithdrawalsAdmin error', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading Withdrawals</h3>
        <p>${error.message}</p>
        <button onclick="renderWithdrawalsAdmin()" class="small">Retry</button>
      </div>
    `;
  }
}

// ---------- Render Settings Tab ----------
async function renderSettingsAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>⚙️ Admin Settings</h2>
      
      <div class="settings-section">
        <h3>👤 System Information</h3>
        <div class="setting-item">
          <label>Admin User</label>
          <div class="muted">${currentUser?.email} (UID: ${currentUser?.uid})</div>
        </div>
        <div class="setting-item">
          <label>Last Login</label>
          <div class="muted">${new Date().toLocaleString()}</div>
        </div>
        <div class="setting-item">
          <label>Admin Since</label>
          <div class="muted">Loading...</div>
        </div>
      </div>

      <div class="settings-section">
        <h3>📊 System Statistics</h3>
        <div id="system-stats" class="stats-grid"></div>
      </div>

      <div class="settings-section">
        <h3>⚠️ Danger Zone</h3>
        <div class="danger-zone">
          <div class="setting-item">
            <label>Clear All Cache</label>
            <button class="warning" onclick="clearAdminCache()">
              <span class="btn-icon">🗑️</span>
              Clear Cache
            </button>
          </div>
          <div class="setting-item">
            <label>Emergency Logout</label>
            <button class="danger" onclick="emergencyLogout()">
              <span class="btn-icon">🚨</span>
              Logout All Sessions
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>📝 Admin Logs</h3>
        <button class="small" onclick="viewAdminLogs()">
          <span class="btn-icon">📋</span>
          View Recent Logs
        </button>
      </div>
    </div>
  `;

  // Load system statistics
  try {
    const statsEl = document.getElementById('system-stats');
    if (statsEl) {
      const usersCount = currentData.users.length;
      const tournamentsCount = currentData.tournaments.length;
      const depositsCount = currentData.deposits.length;
      const withdrawalsCount = currentData.withdrawals.length;
      
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${usersCount}</div>
          <div class="stat-label">Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${tournamentsCount}</div>
          <div class="stat-label">Tournaments</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${depositsCount}</div>
          <div class="stat-label">Deposits</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${withdrawalsCount}</div>
          <div class="stat-label">Withdrawals</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading system stats:', error);
  }
}

// ---------- Additional Functions ----------
async function viewTournament(tournamentId) {
  showNotification(`Viewing tournament ${tournamentId}`, 'info');
  // Implement tournament detail view
}

async function editTournament(tournamentId) {
  showNotification(`Editing tournament ${tournamentId}`, 'info');
  // Implement tournament edit
}

async function cancelTournament(tournamentId) {
  if (!confirm('Are you sure you want to cancel this tournament? This action cannot be undone.')) return;
  
  try {
    await db.collection('tournaments').doc(tournamentId).update({
      status: 'cancelled',
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      cancelledBy: currentUser.uid
    });
    
    await logAdminAction('tournament_cancelled', tournamentId);
    showNotification('Tournament cancelled successfully', 'success');
    await renderActiveTab();
  } catch (error) {
    console.error('Cancel tournament failed:', error);
    showNotification('Failed to cancel tournament', 'error');
  }
}

async function clearAdminCache() {
  if (!confirm('Clear all cached data? This will force a fresh reload from the database.')) return;
  
  currentData = { users: [], tournaments: [], deposits: [], withdrawals: [] };
  showNotification('Cache cleared successfully', 'success');
  await renderActiveTab();
}

async function emergencyLogout() {
  if (!confirm('This will sign you out from all devices immediately. Continue?')) return;
  
  try {
    showNotification('Signing out from all sessions...', 'info');
    await auth.signOut();
    location.href = 'login.html';
  } catch (error) {
    console.error('Emergency logout failed:', error);
    showNotification('Logout failed', 'error');
  }
}

async function viewAdminLogs() {
  try {
    const snap = await db.collection('adminLogs')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const logs = [];
    snap.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    const logsHtml = logs.map(log => `
      <div class="card-small">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <strong style="text-transform: capitalize;">${escapeHtml(log.action.replace(/_/g, ' '))}</strong>
          <span class="muted" style="font-size:12px">${formatDateTime(log.timestamp)}</span>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:8px">
          Admin: ${escapeHtml(log.adminEmail)} | Target: ${log.targetUid.substring(0, 8)}...
        </div>
        ${log.details ? `
          <div style="font-size:11px;background:var(--surface-dark);padding:8px;border-radius:4px;margin-top:4px">
            ${escapeHtml(JSON.stringify(log.details, null, 2))}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    content.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2>📋 Recent Admin Logs</h2>
          <button class="small" onclick="renderSettingsAdmin()">
            <span class="btn-icon">←</span>
            Back to Settings
          </button>
        </div>
        <div style="max-height:600px;overflow-y:auto">
          ${logsHtml || '<div class="no-data">No logs found</div>'}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('View admin logs failed:', error);
    showNotification('Failed to load logs', 'error');
  }
}

// ---------- Error Boundary ----------
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showNotification('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showNotification('An unexpected error occurred', 'error');
});

// Add slideOut animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;

document.head.appendChild(style);

// ========== TOURNAMENT MANAGEMENT FUNCTIONS ==========

// Enhanced Tournaments Tab with Management Options
async function renderTournamentsAdmin() {
  content.innerHTML = `
    <div class="card">
      <h2>🏆 Tournament Management</h2>
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="search-container">
            <input id="t-search" class="search" placeholder="Search tournament title, host, or status..." />
            <span class="search-icon">🔍</span>
          </div>
          <button id="t-reload" class="small">
            <span class="btn-icon">🔄</span>
            Reload
          </button>
        </div>
        <button id="create-tournament" class="success">
          <span class="btn-icon">➕</span>
          Create Tournament
        </button>
      </div>
      
      <div id="tournaments-stats" class="stats-grid"></div>
      
      <div style="overflow:auto; margin-top:16px">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Game</th>
              <th>Status</th>
              <th>Players</th>
              <th>Prize Pool</th>
              <th>Start Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tournaments-table"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const snap = await db.collection('tournaments').orderBy('createdAt', 'desc').get();
    const tournaments = [];
    snap.forEach(doc => {
      tournaments.push({ id: doc.id, ...doc.data() });
    });
    
    currentData.tournaments = tournaments;

    // Render stats
    const statsEl = document.getElementById('tournaments-stats');
    if (statsEl) {
      const total = tournaments.length;
      const active = tournaments.filter(t => t.status === 'active').length;
      const upcoming = tournaments.filter(t => t.status === 'upcoming').length;
      const completed = tournaments.filter(t => t.status === 'completed').length;
      const totalPlayers = tournaments.reduce((sum, t) => sum + (t.currentPlayers || 0), 0);
      
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Total Tournaments</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${active}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${upcoming}</div>
          <div class="stat-label">Upcoming</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalPlayers}</div>
          <div class="stat-label">Total Players</div>
        </div>
      `;
    }

    const searchEl = document.getElementById('t-search');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredTournaments = tournaments.filter(t =>
      !q || 
      `${t.title || ''} ${t.game || ''} ${t.status || ''} ${t.hostEmail || ''}`
        .toLowerCase().includes(q)
    );

    const tableEl = document.getElementById('tournaments-table');
    if (tableEl) {
      tableEl.innerHTML = filteredTournaments.length ? filteredTournaments.map(t => `
        <tr>
          <td>
            <strong>${escapeHtml(t.title || 'Untitled Tournament')}</strong>
            ${t.description ? `<div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(t.description)}</div>` : ''}
          </td>
          <td>${escapeHtml(t.game || 'N/A')}</td>
          <td><span class="status-badge ${t.status || 'draft'}">${escapeHtml(t.status || 'draft')}</span></td>
          <td>${t.currentPlayers || 0}/${t.maxPlayers || '∞'}</td>
          <td>$${(t.prizePool || 0).toLocaleString()}</td>
          <td>${t.startDate ? formatDate(t.startDate) : 'N/A'}</td>
          <td class="action-row" style="white-space: nowrap;">
            <button class="ghost small" onclick="viewTournamentDetails('${t.id}')" title="View Details">
              <span class="btn-icon">👁️</span>
            </button>
            <button class="warning small" onclick="editTournamentModal('${t.id}')" title="Edit Tournament">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="info small" onclick="manageTournamentMatches('${t.id}')" title="Manage Matches">
              <span class="btn-icon">⚔️</span>
            </button>
            <button class="success small" onclick="updateTournamentStatus('${t.id}')" title="Update Status">
              <span class="btn-icon">🔄</span>
            </button>
            ${t.status !== 'cancelled' && t.status !== 'completed' ? `
              <button class="danger small" onclick="cancelTournament('${t.id}')" title="Cancel Tournament">
                <span class="btn-icon">🗑️</span>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="no-data">No tournaments found</td></tr>';
    }

    // Bind controls
    document.getElementById('t-reload').onclick = renderTournamentsAdmin;
    document.getElementById('t-search').oninput = debounce(renderTournamentsAdmin, 300);
    document.getElementById('create-tournament').onclick = createTournamentModal;

  } catch (error) {
    console.error('renderTournamentsAdmin error', error);
    content.innerHTML = `
      <div class="error-state">
        <h3>Error Loading Tournaments</h3>
        <p>${error.message}</p>
        <button onclick="renderTournamentsAdmin()" class="small">Retry</button>
      </div>
    `;
  }
}

// Create Tournament Modal
function createTournamentModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>➕ Create New Tournament</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        <form id="create-tournament-form">
          <div class="form-group">
            <label>Tournament Title *</label>
            <input type="text" id="tournament-title" required placeholder="Enter tournament title">
          </div>
          
          <div class="form-group">
            <label>Game *</label>
            <select id="tournament-game" required>
              <option value="">Select Game</option>
              <option value="Valorant">Valorant</option>
              <option value="Fortnite">Fortnite</option>
              <option value="CS2">Counter-Strike 2</option>
              <option value="Rocket League">Rocket League</option>
              <option value="League of Legends">League of Legends</option>
              <option value="Apex Legends">Apex Legends</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Description</label>
            <textarea id="tournament-description" placeholder="Enter tournament description" rows="3"></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Prize Pool ($) *</label>
              <input type="number" id="tournament-prize" required min="0" value="100">
            </div>
            <div class="form-group">
              <label>Entry Fee ($)</label>
              <input type="number" id="tournament-entryfee" min="0" value="0">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Max Players *</label>
              <input type="number" id="tournament-maxplayers" required min="2" value="16">
            </div>
            <div class="form-group">
              <label>Status *</label>
              <select id="tournament-status" required>
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Start Date *</label>
              <input type="datetime-local" id="tournament-startdate" required>
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input type="datetime-local" id="tournament-enddate">
            </div>
          </div>
          
          <div class="form-group">
            <label>Rules & Format</label>
            <textarea id="tournament-rules" placeholder="Enter tournament rules and format" rows="3"></textarea>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn success">Create Tournament</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Set default start date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0); // 7 PM tomorrow
  
  document.body.appendChild(modal);
  
  const form = modal.querySelector('#create-tournament-form');
  const startDateInput = modal.querySelector('#tournament-startdate');
  
  // Format date for datetime-local input
  startDateInput.value = tomorrow.toISOString().slice(0, 16);
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    await createTournament(form);
  };
}

// Create Tournament Function
async function createTournament(form) {
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';
  
  try {
    const tournamentData = {
      title: document.getElementById('tournament-title').value,
      game: document.getElementById('tournament-game').value,
      description: document.getElementById('tournament-description').value,
      prizePool: parseFloat(document.getElementById('tournament-prize').value),
      entryFee: parseFloat(document.getElementById('tournament-entryfee').value) || 0,
      maxPlayers: parseInt(document.getElementById('tournament-maxplayers').value),
      status: document.getElementById('tournament-status').value,
      startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournament-startdate').value)),
      endDate: document.getElementById('tournament-enddate').value ? 
        firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournament-enddate').value)) : null,
      rules: document.getElementById('tournament-rules').value,
      host: currentUser.uid,
      hostEmail: currentUser.email,
      currentPlayers: 0,
      players: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Validate required fields
    if (!tournamentData.title || !tournamentData.game || !tournamentData.prizePool) {
      throw new Error('Please fill in all required fields');
    }
    
    await db.collection('tournaments').add(tournamentData);
    
    await logAdminAction('tournament_created', 'new', {
      title: tournamentData.title,
      game: tournamentData.game,
      prizePool: tournamentData.prizePool
    });
    
    showNotification('Tournament created successfully!', 'success');
    form.closest('.modal-overlay').remove();
    await renderTournamentsAdmin();
    
  } catch (error) {
    console.error('Create tournament failed:', error);
    showNotification(`Failed to create tournament: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Edit Tournament Modal
async function editTournamentModal(tournamentId) {
  try {
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      showNotification('Tournament not found', 'error');
      return;
    }
    
    const tournament = tournamentDoc.data();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>✏️ Edit Tournament</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <form id="edit-tournament-form">
            <div class="form-group">
              <label>Tournament Title *</label>
              <input type="text" id="edit-tournament-title" value="${escapeHtml(tournament.title || '')}" required>
            </div>
            
            <div class="form-group">
              <label>Game *</label>
              <select id="edit-tournament-game" required>
                <option value="Valorant" ${tournament.game === 'Valorant' ? 'selected' : ''}>Valorant</option>
                <option value="Fortnite" ${tournament.game === 'Fortnite' ? 'selected' : ''}>Fortnite</option>
                <option value="CS2" ${tournament.game === 'CS2' ? 'selected' : ''}>Counter-Strike 2</option>
                <option value="Rocket League" ${tournament.game === 'Rocket League' ? 'selected' : ''}>Rocket League</option>
                <option value="League of Legends" ${tournament.game === 'League of Legends' ? 'selected' : ''}>League of Legends</option>
                <option value="Apex Legends" ${tournament.game === 'Apex Legends' ? 'selected' : ''}>Apex Legends</option>
                <option value="Other" ${!['Valorant','Fortnite','CS2','Rocket League','League of Legends','Apex Legends'].includes(tournament.game) ? 'selected' : ''}>Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Description</label>
              <textarea id="edit-tournament-description" rows="3">${escapeHtml(tournament.description || '')}</textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Prize Pool ($) *</label>
                <input type="number" id="edit-tournament-prize" value="${tournament.prizePool || 0}" required min="0">
              </div>
              <div class="form-group">
                <label>Entry Fee ($)</label>
                <input type="number" id="edit-tournament-entryfee" value="${tournament.entryFee || 0}" min="0">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Max Players *</label>
                <input type="number" id="edit-tournament-maxplayers" value="${tournament.maxPlayers || 16}" required min="2">
              </div>
              <div class="form-group">
                <label>Current Players</label>
                <input type="number" id="edit-tournament-currentplayers" value="${tournament.currentPlayers || 0}" min="0" readonly style="background: #f5f5f5;">
              </div>
            </div>
            
            <div class="form-group">
              <label>Status *</label>
              <select id="edit-tournament-status" required>
                <option value="draft" ${tournament.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="upcoming" ${tournament.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                <option value="active" ${tournament.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="completed" ${tournament.status === 'completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Rules & Format</label>
              <textarea id="edit-tournament-rules" rows="3">${escapeHtml(tournament.rules || '')}</textarea>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="btn success">Update Tournament</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const form = modal.querySelector('#edit-tournament-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await updateTournament(tournamentId, form);
    };
    
  } catch (error) {
    console.error('Edit tournament modal failed:', error);
    showNotification('Failed to load tournament data', 'error');
  }
}

// Update Tournament Function
async function updateTournament(tournamentId, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';
  
  try {
    const tournamentData = {
      title: document.getElementById('edit-tournament-title').value,
      game: document.getElementById('edit-tournament-game').value,
      description: document.getElementById('edit-tournament-description').value,
      prizePool: parseFloat(document.getElementById('edit-tournament-prize').value),
      entryFee: parseFloat(document.getElementById('edit-tournament-entryfee').value) || 0,
      maxPlayers: parseInt(document.getElementById('edit-tournament-maxplayers').value),
      status: document.getElementById('edit-tournament-status').value,
      rules: document.getElementById('edit-tournament-rules').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('tournaments').doc(tournamentId).update(tournamentData);
    
    await logAdminAction('tournament_updated', tournamentId, {
      title: tournamentData.title,
      status: tournamentData.status,
      prizePool: tournamentData.prizePool
    });
    
    showNotification('Tournament updated successfully!', 'success');
    form.closest('.modal-overlay').remove();
    await renderTournamentsAdmin();
    
  } catch (error) {
    console.error('Update tournament failed:', error);
    showNotification(`Failed to update tournament: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Manage Tournament Matches
async function manageTournamentMatches(tournamentId) {
  try {
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      showNotification('Tournament not found', 'error');
      return;
    }
    
    const tournament = tournamentDoc.data();
    const matchesSnap = await db.collection('matches')
      .where('tournamentId', '==', tournamentId)
      .orderBy('scheduledTime', 'asc')
      .get();
    
    const matches = [];
    matchesSnap.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>⚔️ Manage Matches - ${escapeHtml(tournament.title)}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
            <h4>Tournament Matches</h4>
            <button class="btn success small" onclick="createMatchModal('${tournamentId}')">
              <span class="btn-icon">➕</span>
              Add Match
            </button>
          </div>
          
          <div id="matches-list">
            ${matches.length > 0 ? matches.map(match => `
              <div class="card-small" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div style="flex: 1;">
                    <strong>${match.round || 'Match'} - ${match.team1 || 'Team 1'} vs ${match.team2 || 'Team 2'}</strong>
                    <div class="muted" style="font-size: 12px; margin-top: 4px;">
                      Scheduled: ${match.scheduledTime ? formatDateTime(match.scheduledTime) : 'Not set'}
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 8px;">
                      <span class="status-badge ${match.status || 'scheduled'}">${match.status || 'scheduled'}</span>
                      ${match.score1 !== undefined && match.score2 !== undefined ? 
                        `<span>Score: ${match.score1} - ${match.score2}</span>` : 
                        '<span>No score set</span>'
                      }
                    </div>
                  </div>
                  <div class="action-row">
                    <button class="ghost small" onclick="updateMatchScore('${match.id}')" title="Update Score">
                      <span class="btn-icon">🎯</span>
                    </button>
                    <button class="warning small" onclick="editMatch('${match.id}')" title="Edit Match">
                      <span class="btn-icon">✏️</span>
                    </button>
                    <button class="danger small" onclick="deleteMatch('${match.id}')" title="Delete Match">
                      <span class="btn-icon">🗑️</span>
                    </button>
                  </div>
                </div>
              </div>
            `).join('') : '<div class="no-data">No matches created yet</div>'}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Manage matches failed:', error);
    showNotification('Failed to load matches', 'error');
  }
}

// Update Match Score Modal
async function updateMatchScore(matchId) {
  try {
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      showNotification('Match not found', 'error');
      return;
    }
    
    const match = matchDoc.data();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
          <h3>🎯 Update Match Score</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <form id="update-score-form">
            <div style="text-align: center; margin-bottom: 20px;">
              <h4>${match.team1 || 'Team 1'} vs ${match.team2 || 'Team 2'}</h4>
              <div class="muted">${match.round || 'Match'}</div>
            </div>
            
            <div class="form-row">
              <div class="form-group" style="text-align: center;">
                <label>${match.team1 || 'Team 1'} Score</label>
                <input type="number" id="score-team1" value="${match.score1 || 0}" min="0" style="text-align: center; font-size: 18px;">
              </div>
              <div style="align-self: end; padding-bottom: 8px; font-size: 18px;">-</div>
              <div class="form-group" style="text-align: center;">
                <label>${match.team2 || 'Team 2'} Score</label>
                <input type="number" id="score-team2" value="${match.score2 || 0}" min="0" style="text-align: center; font-size: 18px;">
              </div>
            </div>
            
            <div class="form-group">
              <label>Match Status</label>
              <select id="match-status">
                <option value="scheduled" ${match.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="live" ${match.status === 'live' ? 'selected' : ''}>Live</option>
                <option value="completed" ${match.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${match.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="btn success">Update Score</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const form = modal.querySelector('#update-score-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await saveMatchScore(matchId, form);
    };
    
  } catch (error) {
    console.error('Update score modal failed:', error);
    showNotification('Failed to load match data', 'error');
  }
}

// Save Match Score
async function saveMatchScore(matchId, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';
  
  try {
    const updateData = {
      score1: parseInt(document.getElementById('score-team1').value) || 0,
      score2: parseInt(document.getElementById('score-team2').value) || 0,
      status: document.getElementById('match-status').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // If match is completed, set completed time
    if (updateData.status === 'completed' && updateData.score1 !== updateData.score2) {
      updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
      updateData.winner = updateData.score1 > updateData.score2 ? 'team1' : 'team2';
    }
    
    await db.collection('matches').doc(matchId).update(updateData);
    
    await logAdminAction('match_score_updated', matchId, {
      score1: updateData.score1,
      score2: updateData.score2,
      status: updateData.status
    });
    
    showNotification('Match score updated successfully!', 'success');
    form.closest('.modal-overlay').remove();
    
    // Refresh the matches list if we're in the manage matches modal
    const manageModal = document.querySelector('.modal-overlay');
    if (manageModal && manageModal.querySelector('h3').textContent.includes('Manage Matches')) {
      const tournamentId = manageModal.querySelector('button').onclick.toString().match(/'([^']+)'/)[1];
      manageModal.remove();
      manageTournamentMatches(tournamentId);
    }
    
  } catch (error) {
    console.error('Save match score failed:', error);
    showNotification(`Failed to update score: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Update Tournament Status
async function updateTournamentStatus(tournamentId) {
  try {
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      showNotification('Tournament not found', 'error');
      return;
    }
    
    const tournament = tournamentDoc.data();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    modal.innerHTML = `
      <div class="modal" style="max-width: 400px;">
        <div class="modal-header">
          <h3>🔄 Update Tournament Status</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <form id="update-status-form">
            <div style="margin-bottom: 16px;">
              <strong>${tournament.title}</strong>
              <div class="muted">Current status: <span class="status-badge ${tournament.status}">${tournament.status}</span></div>
            </div>
            
            <div class="form-group">
              <label>New Status *</label>
              <select id="new-tournament-status" required>
                <option value="draft" ${tournament.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="upcoming" ${tournament.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                <option value="active" ${tournament.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="completed" ${tournament.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${tournament.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
              <button type="submit" class="btn success">Update Status</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const form = modal.querySelector('#update-status-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await saveTournamentStatus(tournamentId, form);
    };
    
  } catch (error) {
    console.error('Update status modal failed:', error);
    showNotification('Failed to load tournament data', 'error');
  }
}

// Save Tournament Status
async function saveTournamentStatus(tournamentId, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';
  
  try {
    const newStatus = document.getElementById('new-tournament-status').value;
    const updateData = {
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Set completion time if marking as completed
    if (newStatus === 'completed') {
      updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    
    await db.collection('tournaments').doc(tournamentId).update(updateData);
    
    await logAdminAction('tournament_status_updated', tournamentId, {
      oldStatus: currentData.tournaments.find(t => t.id === tournamentId)?.status,
      newStatus: newStatus
    });
    
    showNotification(`Tournament status updated to ${newStatus}!`, 'success');
    form.closest('.modal-overlay').remove();
    await renderTournamentsAdmin();
    
  } catch (error) {
    console.error('Save tournament status failed:', error);
    showNotification(`Failed to update status: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// View Tournament Details
async function viewTournamentDetails(tournamentId) {
  try {
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      showNotification('Tournament not found', 'error');
      return;
    }
    
    const tournament = tournamentDoc.data();
    const playersSnap = await db.collection('users')
      .where('__name__', 'in', tournament.players || [])
      .get();
    
    const players = [];
    playersSnap.forEach(doc => {
      players.push({ uid: doc.id, ...doc.data() });
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>📋 Tournament Details</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="card" style="margin-bottom: 20px;">
            <h3>${escapeHtml(tournament.title)}</h3>
            <div class="muted" style="margin-bottom: 16px;">${escapeHtml(tournament.description || 'No description')}</div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">${tournament.game || 'N/A'}</div>
                <div class="stat-label">Game</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">$${(tournament.prizePool || 0).toLocaleString()}</div>
                <div class="stat-label">Prize Pool</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</div>
                <div class="stat-label">Players</div>
              </div>
              <div class="stat-card">
                <div class="stat-number"><span class="status-badge ${tournament.status}">${tournament.status}</span></div>
                <div class="stat-label">Status</div>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Start Date</label>
                <div>${tournament.startDate ? formatDateTime(tournament.startDate) : 'Not set'}</div>
              </div>
              <div class="form-group">
                <label>Entry Fee</label>
                <div>${tournament.entryFee ? `$${tournament.entryFee}` : 'Free'}</div>
              </div>
            </div>
            
            ${tournament.rules ? `
              <div class="form-group">
                <label>Rules & Format</label>
                <div style="background: var(--surface-dark); padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(tournament.rules)}</div>
              </div>
            ` : ''}
          </div>
          
          <div class="card">
            <h4>Registered Players (${players.length})</h4>
            ${players.length > 0 ? `
              <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%;">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${players.map(player => `
                      <tr>
                        <td>${escapeHtml(player.email)}</td>
                        <td>${player.joinedAt ? formatDate(player.joinedAt) : 'N/A'}</td>
                        <td><span class="status-badge ${player.verified ? 'verified' : 'unverified'}">${player.verified ? 'Verified' : 'Unverified'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="no-data">No players registered yet</div>'}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('View tournament details failed:', error);
    showNotification('Failed to load tournament details', 'error');
  }
}

// Add CSS for modals and forms
const tournamentStyles = document.createElement('style');
tournamentStyles.textContent = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    padding: 20px;
  }
  
  .modal {
    background: var(--surface);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    width: 100%;
    max-width: 500px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-close:hover {
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 20px;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-dark);
    color: var(--text-primary);
    font-size: 14px;
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  
  .status-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .status-badge.draft { background: #6b7280; color: white; }
  .status-badge.upcoming { background: #f59e0b; color: white; }
  .status-badge.active { background: #10b981; color: white; }
  .status-badge.completed { background: #6366f1; color: white; }
  .status-badge.cancelled { background: #ef4444; color: white; }
  .status-badge.live { background: #dc2626; color: white; }
  .status-badge.scheduled { background: #f59e0b; color: white; }
  
  .btn.info {
    background: #0ea5e9;
    color: white;
  }
  
  .btn.info:hover {
    background: #0284c7;
  }
`;

document.head.appendChild(tournamentStyles);