
// TourneyHub Admin Dashboard - Complete Implementation
// ================================

// Firebase configuration
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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

class AdminDashboard {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'dashboard';
    this.isLoading = false;
    
    // Cached data
    this.users = [];
    this.tournaments = [];
    this.deposits = [];
    this.withdrawals = [];
    
    // Statistics
    this.stats = {
      totalUsers: 0,
      totalTournaments: 0,
      activeTournaments: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalRevenue: 0,
      pendingDeposits: 0,
      pendingWithdrawals: 0
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
    try {
      await this.checkAdminStatus();
      this.setupEventListeners();
      this.loadUserProfile();
      await this.loadDashboard();
      this.setupRealTimeListeners();
      console.log('Admin dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize admin dashboard:', error);
      this.showNotification('Failed to initialize dashboard', 'error');
    }
  }

  // =================== AUTHENTICATION ===================
  checkAdminStatus() {
    return new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        try {
          if (!user) {
            console.log('No user authenticated');
            window.location.href = 'login.html';
            return;
          }

          const userDoc = await db.collection('users').doc(user.uid).get();
          
          if (!userDoc.exists) {
            console.log('User document does not exist');
            this.showNotification('User profile not found', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
          }

          const userData = userDoc.data();
          if (userData.role !== 'admin') {
            console.log('User is not admin:', userData.role);
            this.showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
          }

          this.currentUser = user;
          console.log('Admin authenticated:', user.email);
          unsubscribe(); // Stop listening once authenticated
          resolve(true);

        } catch (error) {
          console.error('Error checking admin status:', error);
          this.showNotification('Authentication error: ' + error.message, 'error');
          reject(error);
        }
      });
    });
  }

  // =================== EVENT LISTENERS ===================
  setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = e.currentTarget.dataset.tab;
        if (tab && tab !== this.currentTab) {
          this.switchTab(tab);
        }
      });
    });

    // Sidebar toggle
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // Mobile menu
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => this.toggleMobileMenu());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Global search
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleGlobalSearch(e.target.value.trim());
        }, 300);
      });
    }

    // Sign out
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this.signOut());
    }

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-btn')) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.querySelector('#toggleSidebar i');
    
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      if (toggleIcon) {
        toggleIcon.className = sidebar.classList.contains('collapsed') 
          ? 'fas fa-chevron-right' 
          : 'fas fa-chevron-left';
      }
    }
  }

  toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    }
  }

  switchTab(tabName) {
    if (this.isLoading) return;

    this.currentTab = tabName;
    
    // Update active states
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(item => {
      item.classList.add('active');
    });

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      users: 'User Management',
      tournaments: 'Tournament Management',
      deposits: 'Deposit Requests',
      withdrawals: 'Withdrawal Requests',
      settings: 'System Settings',
      logs: 'Admin Logs'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
      pageTitle.textContent = titles[tabName] || 'Admin Panel';
    }

    // Load tab content
    this.loadTabContent(tabName);
  }

  async loadTabContent(tabName) {
    this.setLoading(true);
    
    try {
      switch (tabName) {
        case 'dashboard':
          await this.loadDashboardContent();
          break;
        case 'users':
          await this.loadUsersContent();
          break;
        case 'tournaments':
          await this.loadTournamentsContent();
          break;
        case 'deposits':
          await this.loadDepositsContent();
          break;
        case 'withdrawals':
          await this.loadWithdrawalsContent();
          break;
        case 'settings':
          await this.loadSettingsContent();
          break;
        case 'logs':
          await this.loadLogsContent();
          break;
        default:
          this.renderPlaceholder('Coming Soon', 'This section is under development.');
      }
    } catch (error) {
      console.error(`Error loading ${tabName}:`, error);
      this.showNotification(`Failed to load ${tabName}`, 'error');
      this.renderError('Failed to load content', error.message);
    } finally {
      this.setLoading(false);
    }
  }

  // =================== DASHBOARD ===================
  async loadDashboard() {
    await this.loadStats();
    if (this.currentTab === 'dashboard') {
      await this.loadDashboardContent();
    }
  }

  async loadStats() {
    try {
      const [usersSnap, tournamentsSnap, activeTournamentsSnap, depositsSnap, withdrawalsSnap, pendingDepositsSnap, pendingWithdrawalsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('tournaments').get(),
        db.collection('tournaments').where('status', 'in', ['active', 'upcoming', 'registering']).get(),
        db.collection('deposits').where('status', '==', 'approved').get(),
        db.collection('withdrawals').where('status', '==', 'approved').get(),
        db.collection('deposits').where('status', '==', 'pending').get(),
        db.collection('withdrawals').where('status', '==', 'pending').get()
      ]);

      // Calculate totals
      let totalDeposits = 0;
      depositsSnap.forEach(doc => {
        totalDeposits += Number(doc.data().amount || 0);
      });

      let totalWithdrawals = 0;
      withdrawalsSnap.forEach(doc => {
        totalWithdrawals += Number(doc.data().amount || 0);
      });

      // Update stats
      this.stats = {
        totalUsers: usersSnap.size,
        totalTournaments: tournamentsSnap.size,
        activeTournaments: activeTournamentsSnap.size,
        totalDeposits,
        totalWithdrawals,
        totalRevenue: totalDeposits - totalWithdrawals,
        pendingDeposits: pendingDepositsSnap.size,
        pendingWithdrawals: pendingWithdrawalsSnap.size
      };

      // Update badges
      this.updateBadges();

    } catch (error) {
      console.error('Error loading stats:', error);
      this.showNotification('Failed to load statistics', 'error');
    }
  }

  updateBadges() {
    const usersBadge = document.getElementById('usersBadge');
    const tournamentsBadge = document.getElementById('tournamentsBadge');
    
    if (usersBadge) usersBadge.textContent = this.stats.totalUsers;
    if (tournamentsBadge) tournamentsBadge.textContent = this.stats.totalTournaments;
  }

  async loadDashboardContent() {
    const content = `
      <div class="dashboard-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-users"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-up"></i>
                <span>12%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.totalUsers}</div>
              <div class="stat-label">Total Users</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-trophy"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-up"></i>
                <span>8%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.totalTournaments}</div>
              <div class="stat-label">Total Tournaments</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-play-circle"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-up"></i>
                <span>15%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.activeTournaments}</div>
              <div class="stat-label">Active Tournaments</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-money-bill-wave"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-up"></i>
                <span>23%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">₹${this.formatCurrency(this.stats.totalRevenue)}</div>
              <div class="stat-label">Net Revenue</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-clock"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-down"></i>
                <span>5%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.pendingDeposits}</div>
              <div class="stat-label">Pending Deposits</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon">
                <i class="fas fa-hourglass-half"></i>
              </div>
              <div class="stat-trend">
                <i class="fas fa-arrow-down"></i>
                <span>3%</span>
              </div>
            </div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.pendingWithdrawals}</div>
              <div class="stat-label">Pending Withdrawals</div>
            </div>
          </div>
        </div>

        <div class="data-section">
          <div class="section-header">
            <h2 class="section-title">
              <i class="fas fa-fire"></i>
              Recent Tournaments
            </h2>
            <div class="section-actions">
              <button class="btn btn-primary" onclick="admin.switchTab('tournaments')">
                <i class="fas fa-eye"></i>
                View All
              </button>
              <button class="btn btn-success" onclick="admin.createTournament()">
                <i class="fas fa-plus"></i>
                Create New
              </button>
            </div>
          </div>
          <div class="table-container">
            <div id="recentTournamentsTable">
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading recent tournaments...</p>
              </div>
            </div>
          </div>
        </div>

        <div class="data-section mt-3">
          <div class="section-header">
            <h2 class="section-title">
              <i class="fas fa-user-plus"></i>
              Recent Users
            </h2>
            <div class="section-actions">
              <button class="btn btn-primary" onclick="admin.switchTab('users')">
                <i class="fas fa-eye"></i>
                View All
              </button>
            </div>
          </div>
          <div class="table-container">
            <div id="recentUsersTable">
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading recent users...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
    
    // Load recent data
    await Promise.all([
      this.loadRecentTournaments(),
      this.loadRecentUsers()
    ]);
  }

  async loadRecentTournaments() {
    try {
      const snapshot = await db.collection('tournaments')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const tournaments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('recentTournamentsTable');
      if (!container) return;

      if (tournaments.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-trophy"></i>
            <h3>No Tournaments Yet</h3>
            <p>Create your first tournament to get started</p>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Game</th>
              <th>Status</th>
              <th>Prize Pool</th>
              <th>Players</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tournaments.map(tournament => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(tournament.title || 'Untitled')}</strong>
                </td>
                <td>${this.escapeHtml(tournament.game || 'N/A')}</td>
                <td>
                  <span class="status-badge ${this.getStatusClass(tournament.status)}">
                    ${this.escapeHtml(tournament.status || 'draft')}
                  </span>
                </td>
                <td>₹${this.formatCurrency(tournament.prizePool || 0)}</td>
                <td>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</td>
                <td>${this.formatDate(tournament.createdAt)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="admin.viewTournamentDetails('${tournament.id}')" title="View">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="admin.editTournament('${tournament.id}')" title="Edit">
                      <i class="fas fa-edit"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading recent tournaments:', error);
      const container = document.getElementById('recentTournamentsTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Tournaments</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  async loadRecentUsers() {
    try {
      const snapshot = await db.collection('users')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('recentUsersTable');
      if (!container) return;

      if (users.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-users"></i>
            <h3>No Users Yet</h3>
            <p>Users will appear here once they register</p>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                      ${user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                    <span>${this.escapeHtml(user.email || 'N/A')}</span>
                  </div>
                </td>
                <td>${this.escapeHtml(user.email || 'N/A')}</td>
                <td>
                  <span class="role-badge ${user.role || 'user'}">
                    ${this.escapeHtml(user.role || 'user')}
                  </span>
                </td>
                <td>₹${this.formatCurrency(user.balance || 0)}</td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td>
                  <span class="status-badge success">
                    Active
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading recent users:', error);
      const container = document.getElementById('recentUsersTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Users</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  // =================== TOURNAMENTS ===================
  async loadTournamentsContent() {
    const content = `
      <div class="data-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-trophy"></i>
            Tournament Management
          </h2>
          <div class="section-actions">
            <button class="btn btn-success" onclick="admin.createTournament()">
              <i class="fas fa-plus"></i>
              Create Tournament
            </button>
            <button class="btn btn-primary" onclick="admin.exportTournaments()">
              <i class="fas fa-download"></i>
              Export
            </button>
          </div>
        </div>
        <div class="table-container">
          <div id="tournamentsTable">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading tournaments...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
    await this.loadAllTournaments();
  }

  async loadAllTournaments() {
    try {
      const snapshot = await db.collection('tournaments')
        .orderBy('createdAt', 'desc')
        .get();

      this.tournaments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('tournamentsTable');
      if (!container) return;

      if (this.tournaments.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-trophy"></i>
            <h3>No Tournaments Created</h3>
            <p>Create your first tournament to get started</p>
            <button class="btn btn-success mt-2" onclick="admin.createTournament()">
              <i class="fas fa-plus"></i>
              Create Tournament
            </button>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Game</th>
              <th>Status</th>
              <th>Entry Fee</th>
              <th>Prize Pool</th>
              <th>Players</th>
              <th>Start Date</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.tournaments.map(tournament => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(tournament.title || 'Untitled')}</strong>
                  ${tournament.description ? 
                    `<br><small class="text-muted">${this.escapeHtml(tournament.description.substring(0, 50))}...</small>` : 
                    ''
                  }
                </td>
                <td>${this.escapeHtml(tournament.game || 'N/A')}</td>
                <td>
                  <span class="status-badge ${this.getStatusClass(tournament.status)}">
                    ${this.escapeHtml(tournament.status || 'draft')}
                  </span>
                </td>
                <td>₹${this.formatCurrency(tournament.entryFee || 0)}</td>
                <td>₹${this.formatCurrency(tournament.prizePool || 0)}</td>
                <td>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</td>
                <td>${this.formatDate(tournament.startDate)}</td>
                <td>
                  ${tournament.featured ? 
                    '<i class="fas fa-star" style="color: var(--warning);"></i>' : 
                    '<i class="far fa-star" style="color: var(--text-muted);"></i>'
                  }
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="admin.viewTournamentDetails('${tournament.id}')" title="View">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="admin.editTournament('${tournament.id}')" title="Edit">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="admin.deleteTournament('${tournament.id}')" title="Delete">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading tournaments:', error);
      const container = document.getElementById('tournamentsTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Tournaments</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  createTournament() {
    this.showTournamentModal();
  }

  async editTournament(tournamentId) {
    try {
      const doc = await db.collection('tournaments').doc(tournamentId).get();
      if (doc.exists) {
        const tournament = { id: doc.id, ...doc.data() };
        this.showTournamentModal(tournament);
      } else {
        this.showNotification('Tournament not found', 'error');
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      this.showNotification('Error loading tournament data', 'error');
    }
  }

  showTournamentModal(tournament = null) {
    const isEdit = !!tournament;
    const modalHTML = `
      <div class="modal-overlay" id="tournamentModal">
        <div class="modal">
          <div class="modal-header">
            <h3>${isEdit ? 'Edit Tournament' : 'Create New Tournament'}</h3>
            <button class="modal-close" onclick="admin.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="tournamentForm" onsubmit="return false;">
              <div class="form-group">
                <label for="tournamentTitle">Tournament Title</label>
                <input type="text" id="tournamentTitle" value="${this.escapeHtml(tournament?.title || '')}" required>
              </div>

              <div class="form-group">
                <label for="tournamentGame">Game</label>
                <select id="tournamentGame" required>
                  <option value="">Select Game</option>
                  <option value="BGMI" ${tournament?.game === 'BGMI' ? 'selected' : ''}>BGMI</option>
                  <option value="Free Fire" ${tournament?.game === 'Free Fire' ? 'selected' : ''}>Free Fire</option>
                  <option value="Call of Duty" ${tournament?.game === 'Call of Duty' ? 'selected' : ''}>Call of Duty</option>
                  <option value="Clash Royale" ${tournament?.game === 'Clash Royale' ? 'selected' : ''}>Clash Royale</option>
                  <option value="8 Ball Pool" ${tournament?.game === '8 Ball Pool' ? 'selected' : ''}>8 Ball Pool</option>
                  <option value="Valorant" ${tournament?.game === 'Valorant' ? 'selected' : ''}>Valorant</option>
                </select>
              </div>

              <div class="form-group">
                <label for="tournamentDescription">Description</label>
                <textarea id="tournamentDescription" rows="3">${this.escapeHtml(tournament?.description || '')}</textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="tournamentEntryFee">Entry Fee (₹)</label>
                  <input type="number" id="tournamentEntryFee" value="${tournament?.entryFee || 0}" min="0" required>
                </div>
                <div class="form-group">
                  <label for="tournamentPrizePool">Prize Pool (₹)</label>
                  <input type="number" id="tournamentPrizePool" value="${tournament?.prizePool || 0}" min="1" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="tournamentMaxPlayers">Max Players</label>
                  <input type="number" id="tournamentMaxPlayers" value="${tournament?.maxPlayers || 100}" min="2" required>
                </div>
                <div class="form-group">
                  <label for="tournamentStatus">Status</label>
                  <select id="tournamentStatus" required>
                    <option value="draft" ${tournament?.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="registering" ${tournament?.status === 'registering' ? 'selected' : ''}>Registering</option>
                    <option value="upcoming" ${tournament?.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                    <option value="active" ${tournament?.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="completed" ${tournament?.status === 'completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="tournamentStartDate">Start Date</label>
                  <input type="datetime-local" id="tournamentStartDate" value="${this.formatDateForInput(tournament?.startDate)}" required>
                </div>
                <div class="form-group">
                  <label for="tournamentEndDate">End Date</label>
                  <input type="datetime-local" id="tournamentEndDate" value="${this.formatDateForInput(tournament?.endDate)}" required>
                </div>
              </div>

              <div class="form-group">
                <label for="tournamentRules">Rules & Guidelines</label>
                <textarea id="tournamentRules" rows="4" placeholder="Enter tournament rules...">${this.escapeHtml(tournament?.rules || '')}</textarea>
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" id="tournamentFeatured" ${tournament?.featured ? 'checked' : ''}>
                  Feature this tournament
                </label>
              </div>
            </form>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="admin.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="admin.${isEdit ? 'updateTournament' : 'saveTournament'}('${tournament?.id || ''}')">
              ${isEdit ? 'Update Tournament' : 'Create Tournament'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  closeModal() {
    const modal = document.getElementById('tournamentModal');
    if (modal) {
      modal.remove();
    }
  }

  validateTournamentData(data) {
    if (!data.title || data.title.trim().length < 3) {
      this.showNotification('Tournament title must be at least 3 characters', 'error');
      return false;
    }

    if (!data.game) {
      this.showNotification('Please select a game', 'error');
      return false;
    }

    if (data.entryFee < 0) {
      this.showNotification('Entry fee cannot be negative', 'error');
      return false;
    }

    if (data.prizePool <= 0) {
      this.showNotification('Prize pool must be greater than 0', 'error');
      return false;
    }

    if (data.maxPlayers < 2) {
      this.showNotification('Maximum players must be at least 2', 'error');
      return false;
    }

    if (data.startDate >= data.endDate) {
      this.showNotification('Start date must be before end date', 'error');
      return false;
    }

    return true;
  }

  async saveTournament() {
    try {
      const tournamentData = {
        title: document.getElementById('tournamentTitle').value.trim(),
        game: document.getElementById('tournamentGame').value,
        description: document.getElementById('tournamentDescription').value.trim(),
        entryFee: parseInt(document.getElementById('tournamentEntryFee').value) || 0,
        prizePool: parseInt(document.getElementById('tournamentPrizePool').value) || 0,
        maxPlayers: parseInt(document.getElementById('tournamentMaxPlayers').value) || 100,
        status: document.getElementById('tournamentStatus').value,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournamentStartDate').value)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournamentEndDate').value)),
        rules: document.getElementById('tournamentRules').value.trim(),
        featured: document.getElementById('tournamentFeatured').checked,
        currentPlayers: 0,
        progress: 0,
        createdBy: this.currentUser?.uid || 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!this.validateTournamentData(tournamentData)) return;

      await db.collection('tournaments').add(tournamentData);
      this.showNotification('Tournament created successfully!', 'success');
      this.closeModal();
      this.loadAllTournaments();
      this.loadStats();
    } catch (error) {
      console.error('Error creating tournament:', error);
      this.showNotification('Error creating tournament: ' + error.message, 'error');
    }
  }

  async updateTournament(tournamentId) {
    try {
      const formData = {
        title: document.getElementById('tournamentTitle').value.trim(),
        game: document.getElementById('tournamentGame').value,
        description: document.getElementById('tournamentDescription').value.trim(),
        entryFee: parseInt(document.getElementById('tournamentEntryFee').value) || 0,
        prizePool: parseInt(document.getElementById('tournamentPrizePool').value) || 0,
        maxPlayers: parseInt(document.getElementById('tournamentMaxPlayers').value) || 100,
        status: document.getElementById('tournamentStatus').value,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournamentStartDate').value)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('tournamentEndDate').value)),
        rules: document.getElementById('tournamentRules').value.trim(),
        featured: document.getElementById('tournamentFeatured').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!this.validateTournamentData(formData)) return;

      await db.collection('tournaments').doc(tournamentId).update(formData);
      this.showNotification('Tournament updated successfully!', 'success');
      this.closeModal();
      this.loadAllTournaments();
    } catch (error) {
      console.error('Error updating tournament:', error);
      this.showNotification('Error updating tournament: ' + error.message, 'error');
    }
  }

  async deleteTournament(tournamentId) {
    if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) {
      return;
    }

    try {
      await db.collection('tournaments').doc(tournamentId).delete();
      this.showNotification('Tournament deleted successfully', 'success');
      this.loadAllTournaments();
      this.loadStats();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      this.showNotification('Error deleting tournament: ' + error.message, 'error');
    }
  }

  viewTournamentDetails(tournamentId) {
    window.open(`tournament-details.html?id=${tournamentId}`, '_blank');
  }

  // =================== USERS ===================
  async loadUsersContent() {
    const content = `
      <div class="data-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-users"></i>
            User Management
          </h2>
          <div class="section-actions">
            <button class="btn btn-primary" onclick="admin.exportUsers()">
              <i class="fas fa-download"></i>
              Export Users
            </button>
          </div>
        </div>
        <div class="table-container">
          <div id="usersTable">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading users...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
    await this.loadAllUsers();
  }

  async loadAllUsers() {
    try {
      const snapshot = await db.collection('users')
        .orderBy('createdAt', 'desc')
        .get();

      this.users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('usersTable');
      if (!container) return;

      if (this.users.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-users"></i>
            <h3>No Users Found</h3>
            <p>No users have registered yet</p>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.users.map(user => `
              <tr>
                <td>${this.escapeHtml(user.email || 'N/A')}</td>
                <td>
                  <span class="role-badge ${user.role || 'user'}">
                    ${this.escapeHtml(user.role || 'user')}
                  </span>
                </td>
                <td>₹${this.formatCurrency(user.balance || 0)}</td>
                <td>${this.formatDate(user.createdAt)}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="admin.editUserRole('${user.id}', '${this.escapeHtml(user.role || 'user')}')" title="Edit Role">
                      <i class="fas fa-user-shield"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="admin.deleteUser('${user.id}')" title="Delete User">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading users:', error);
      const container = document.getElementById('usersTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Users</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  async editUserRole(uid, currentRole) {
    const newRole = prompt(`Current role: ${currentRole}\nEnter new role (user/admin):`, currentRole);
    
    if (!newRole || newRole === currentRole) return;
    
    if (!['user', 'admin'].includes(newRole)) {
      this.showNotification('Invalid role. Must be "user" or "admin"', 'error');
      return;
    }

    try {
      await db.collection('users').doc(uid).update({ role: newRole });
      this.showNotification('User role updated successfully', 'success');
      this.loadAllUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      this.showNotification('Error updating user role', 'error');
    }
  }

  async deleteUser(uid) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await db.collection('users').doc(uid).delete();
      this.showNotification('User deleted successfully', 'success');
      this.loadAllUsers();
      this.loadStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      this.showNotification('Error deleting user', 'error');
    }
  }

  // =================== DEPOSITS ===================
  async loadDepositsContent() {
    const content = `
      <div class="data-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-money-bill-wave"></i>
            Deposit Requests
          </h2>
        </div>
        <div class="table-container">
          <div id="depositsTable">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading deposit requests...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
    await this.loadAllDeposits();
  }

  async loadAllDeposits() {
    try {
      const snapshot = await db.collection('deposits')
        .orderBy('createdAt', 'desc')
        .get();

      this.deposits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('depositsTable');
      if (!container) return;

      if (this.deposits.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-money-bill-wave"></i>
            <h3>No Deposit Requests</h3>
            <p>No deposit requests have been made yet</p>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.deposits.map(deposit => `
              <tr>
                <td>${this.escapeHtml(deposit.userId || 'N/A')}</td>
                <td>₹${this.formatCurrency(deposit.amount || 0)}</td>
                <td>
                  <span class="status-badge ${this.getStatusClass(deposit.status)}">
                    ${this.escapeHtml(deposit.status || 'pending')}
                  </span>
                </td>
                <td>${this.formatDate(deposit.createdAt)}</td>
                <td>
                  ${deposit.status === 'pending' ? `
                    <div class="action-buttons">
                      <button class="btn btn-sm btn-success" onclick="admin.updateDepositStatus('${deposit.id}', 'approved')" title="Approve">
                        <i class="fas fa-check"></i>
                      </button>
                      <button class="btn btn-sm btn-danger" onclick="admin.updateDepositStatus('${deposit.id}', 'rejected')" title="Reject">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  ` : '<span class="text-muted">Processed</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading deposits:', error);
      const container = document.getElementById('depositsTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Deposits</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  async updateDepositStatus(id, status) {
    try {
      await db.collection('deposits').doc(id).update({ 
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        processedBy: this.currentUser?.uid
      });
      
      this.showNotification(`Deposit ${status}`, 'success');
      this.loadAllDeposits();
      this.loadStats();
    } catch (error) {
      console.error('Error updating deposit status:', error);
      this.showNotification('Error updating deposit status', 'error');
    }
  }

  // =================== WITHDRAWALS ===================
  async loadWithdrawalsContent() {
    const content = `
      <div class="data-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-wallet"></i>
            Withdrawal Requests
          </h2>
        </div>
        <div class="table-container">
          <div id="withdrawalsTable">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading withdrawal requests...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
    await this.loadAllWithdrawals();
  }

  async loadAllWithdrawals() {
    try {
      const snapshot = await db.collection('withdrawals')
        .orderBy('createdAt', 'desc')
        .get();

      this.withdrawals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const container = document.getElementById('withdrawalsTable');
      if (!container) return;

      if (this.withdrawals.length === 0) {
        container.innerHTML = `
          <div class="no-data">
            <i class="fas fa-wallet"></i>
            <h3>No Withdrawal Requests</h3>
            <p>No withdrawal requests have been made yet</p>
          </div>
        `;
        return;
      }

      const tableHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.withdrawals.map(withdrawal => `
              <tr>
                <td>${this.escapeHtml(withdrawal.userId || 'N/A')}</td>
                <td>₹${this.formatCurrency(withdrawal.amount || 0)}</td>
                <td>${this.escapeHtml(withdrawal.destination || 'N/A')}</td>
                <td>
                  <span class="status-badge ${this.getStatusClass(withdrawal.status)}">
                    ${this.escapeHtml(withdrawal.status || 'pending')}
                  </span>
                </td>
                <td>${this.formatDate(withdrawal.createdAt)}</td>
                <td>
                  ${withdrawal.status === 'pending' ? `
                    <div class="action-buttons">
                      <button class="btn btn-sm btn-success" onclick="admin.updateWithdrawalStatus('${withdrawal.id}', 'approved')" title="Approve">
                        <i class="fas fa-check"></i>
                      </button>
                      <button class="btn btn-sm btn-danger" onclick="admin.updateWithdrawalStatus('${withdrawal.id}', 'rejected')" title="Reject">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  ` : '<span class="text-muted">Processed</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHTML;
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      const container = document.getElementById('withdrawalsTable');
      if (container) {
        container.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Withdrawals</h3>
            <p>Please try refreshing the page</p>
          </div>
        `;
      }
    }
  }

  async updateWithdrawalStatus(id, status) {
    try {
      await db.collection('withdrawals').doc(id).update({ 
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        processedBy: this.currentUser?.uid
      });
      
      this.showNotification(`Withdrawal ${status}`, 'success');
      this.loadAllWithdrawals();
      this.loadStats();
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      this.showNotification('Error updating withdrawal status', 'error');
    }
  }

  // =================== SETTINGS & LOGS ===================
  async loadSettingsContent() {
    this.renderPlaceholder('System Settings', 'System settings management will be implemented here.');
  }

  async loadLogsContent() {
    this.renderPlaceholder('Admin Logs', 'Admin activity logs will be displayed here.');
  }

  // =================== REAL-TIME LISTENERS ===================
  setupRealTimeListeners() {
    // Tournament changes
    db.collection('tournaments').onSnapshot((snapshot) => {
      if (this.currentTab === 'dashboard') {
        this.loadRecentTournaments();
      } else if (this.currentTab === 'tournaments') {
        this.loadAllTournaments();
      }
      this.loadStats();
    }, (error) => {
      console.error('Tournament listener error:', error);
    });

    // User changes
    db.collection('users').onSnapshot((snapshot) => {
      if (this.currentTab === 'dashboard') {
        this.loadRecentUsers();
      } else if (this.currentTab === 'users') {
        this.loadAllUsers();
      }
      this.loadStats();
    }, (error) => {
      console.error('Users listener error:', error);
    });

    // Deposit changes
    db.collection('deposits').onSnapshot((snapshot) => {
      if (this.currentTab === 'deposits') {
        this.loadAllDeposits();
      }
      this.loadStats();
    }, (error) => {
      console.error('Deposits listener error:', error);
    });

    // Withdrawal changes
    db.collection('withdrawals').onSnapshot((snapshot) => {
      if (this.currentTab === 'withdrawals') {
        this.loadAllWithdrawals();
      }
      this.loadStats();
    }, (error) => {
      console.error('Withdrawals listener error:', error);
    });
  }

  // =================== UTILITY FUNCTIONS ===================
  loadUserProfile() {
    if (this.currentUser) {
      const userName = document.getElementById('userName');
      const userAvatar = document.getElementById('userAvatar');
      
      if (userName) {
        userName.textContent = this.currentUser.email || 'Admin';
      }
      
      if (userAvatar) {
        userAvatar.textContent = this.currentUser.email ? this.currentUser.email[0].toUpperCase() : 'A';
      }
    }
  }

  refreshData() {
    this.showNotification('Refreshing data...', 'info');
    this.loadStats().then(() => {
      this.loadTabContent(this.currentTab);
    });
  }

  handleGlobalSearch(query) {
    if (!query) {
      // Show all rows
      document.querySelectorAll('.data-table tbody tr').forEach(row => {
        row.style.display = '';
      });
      return;
    }

    // Filter rows based on text content
    document.querySelectorAll('.data-table tbody tr').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
  }

  async signOut() {
    try {
      await auth.signOut();
      this.showNotification('Signed out successfully', 'success');
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error signing out:', error);
      this.showNotification('Error signing out', 'error');
    }
  }

  exportUsers() {
    try {
      if (this.users.length === 0) {
        this.showNotification('No users to export', 'warning');
        return;
      }

      const csv = [
        ['Email', 'Role', 'Balance', 'Joined'].join(','),
        ...this.users.map(user => [
          user.email || 'N/A',
          user.role || 'user',
          user.balance || 0,
          this.formatDate(user.createdAt)
        ].join(','))
      ].join('\n');

      this.downloadCSV(csv, 'users.csv');
      this.showNotification('Users exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting users:', error);
      this.showNotification('Error exporting users', 'error');
    }
  }

  exportTournaments() {
    try {
      if (this.tournaments.length === 0) {
        this.showNotification('No tournaments to export', 'warning');
        return;
      }

      const csv = [
        ['Title', 'Game', 'Status', 'Entry Fee', 'Prize Pool', 'Max Players', 'Created'].join(','),
        ...this.tournaments.map(tournament => [
          tournament.title || 'Untitled',
          tournament.game || 'N/A',
          tournament.status || 'draft',
          tournament.entryFee || 0,
          tournament.prizePool || 0,
          tournament.maxPlayers || 0,
          this.formatDate(tournament.createdAt)
        ].join(','))
      ].join('\n');

      this.downloadCSV(csv, 'tournaments.csv');
      this.showNotification('Tournaments exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting tournaments:', error);
      this.showNotification('Error exporting tournaments', 'error');
    }
  }

  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  setLoading(loading) {
    this.isLoading = loading;
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      const icon = refreshBtn.querySelector('i');
      if (icon) {
        icon.className = loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt';
      }
    }
  }

  renderPlaceholder(title, message) {
    document.getElementById('content').innerHTML = `
      <div class="data-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-info-circle"></i>
            ${this.escapeHtml(title)}
          </h2>
        </div>
        <div class="no-data">
          <i class="fas fa-box-open"></i>
          <h3>${this.escapeHtml(title)}</h3>
          <p>${this.escapeHtml(message)}</p>
        </div>
      </div>
    `;
  }

  renderError(title, message) {
    document.getElementById('content').innerHTML = `
      <div class="data-section">
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>${this.escapeHtml(title)}</h3>
          <p>${this.escapeHtml(message)}</p>
          <button class="btn btn-primary mt-2" onclick="admin.refreshData()">
            <i class="fas fa-sync-alt"></i>
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  getStatusClass(status) {
    const statusClasses = {
      active: 'success',
      upcoming: 'warning',
      registering: 'info',
      completed: 'info',
      draft: 'error',
      cancelled: 'error',
      pending: 'warning',
      approved: 'success',
      rejected: 'error'
    };
    return statusClasses[status] || 'info';
  }

  formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return 'N/A';
      }

      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }

  formatDateForInput(timestamp) {
    if (!timestamp) return '';
    
    try {
      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return '';
      }

      return date.toISOString().slice(0, 16);
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  }

  formatCurrency(amount) {
    if (typeof amount !== 'number') {
      amount = parseFloat(amount) || 0;
    }
    return new Intl.NumberFormat('en-IN').format(amount);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                        type === 'error' ? 'exclamation-triangle' : 
                        type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${this.escapeHtml(message)}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
}

// Initialize the admin dashboard
window.admin = new AdminDashboard();