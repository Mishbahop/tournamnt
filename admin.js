// admin.js - Complete Admin Dashboard Management

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
        this.tournaments = [];
        this.users = [];
        this.stats = {
            totalUsers: 0,
            totalTournaments: 0,
            activeTournaments: 0,
            totalDeposits: 0,
            pendingWithdrawals: 0,
            totalRevenue: 0
        };
        
        this.init();
    }

    async init() {
        await this.checkAdminStatus();
        this.setupEventListeners();
        this.loadUserProfile();
        this.loadDashboard();
        this.setupRealTimeListeners();
    }

    async checkAdminStatus() {
        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists && userDoc.data().role === 'admin') {
                            this.currentUser = user;
                            console.log('Admin user authenticated');
                            resolve(true);
                        } else {
                            this.showNotification('Access denied. Admin privileges required.', 'error');
                            setTimeout(() => window.location.href = 'index.html', 2000);
                        }
                    } catch (error) {
                        console.error('Error checking admin status:', error);
                        this.showNotification('Error verifying admin access', 'error');
                        setTimeout(() => window.location.href = 'index.html', 2000);
                    }
                } else {
                    console.log('No user signed in');
                    window.location.href = 'login.html';
                }
            });
        });
    }

    

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Sidebar toggle
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Global search
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            this.handleGlobalSearch(e.target.value);
        });

        // Sign out
        document.getElementById('signOutBtn').addEventListener('click', () => {
            this.signOut();
        });

        // User menu
        document.getElementById('userMenu').addEventListener('click', () => {
            this.toggleUserMenu();
        });

        // Close sidebar when clicking on mobile overlay
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && !e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-btn')) {
                document.getElementById('sidebar').classList.remove('mobile-open');
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleIcon = document.getElementById('toggleSidebar').querySelector('i');
        
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            toggleIcon.className = 'fas fa-chevron-right';
        } else {
            toggleIcon.className = 'fas fa-chevron-left';
        }
    }

    toggleMobileMenu() {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update active states
        document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(item => {
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
            settings: 'Settings',
            logs: 'Admin Logs'
        };
        
        document.getElementById('pageTitle').textContent = titles[tabName] || 'Admin';

        // Load tab content
        this.loadTabContent(tabName);
    }

    async loadTabContent(tabName) {
        const contentArea = document.getElementById('content');
        
        switch(tabName) {
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
        }
    }

    async loadDashboard() {
        await this.loadStats();
        await this.loadTabContent(this.currentTab);
    }

    async loadStats() {
        try {
            // Load users count
            const usersSnapshot = await db.collection('users').get();
            this.stats.totalUsers = usersSnapshot.size;

            // Load tournaments count
            const tournamentsSnapshot = await db.collection('tournaments').get();
            this.stats.totalTournaments = tournamentsSnapshot.size;

            // Load active tournaments
            const activeTournamentsSnapshot = await db.collection('tournaments')
                .where('status', 'in', ['active', 'upcoming', 'registering'])
                .get();
            this.stats.activeTournaments = activeTournamentsSnapshot.size;

            // Update badge counts
            document.getElementById('usersBadge').textContent = this.stats.totalUsers;
            document.getElementById('tournamentsBadge').textContent = this.stats.totalTournaments;

            this.updateStatsDisplay();

        } catch (error) {
            console.error('Error loading stats:', error);
            this.showNotification('Error loading dashboard statistics', 'error');
        }
    }

    updateStatsDisplay() {
        // This will be used by the dashboard content
        console.log('Stats updated:', this.stats);
    }

    async loadDashboardContent() {
        const content = `
            <div class="dashboard-overview">
                <div class="overview-grid">
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                12%
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
                                8%
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
                                15%
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
                                23%
                            </div>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">₹2.4L</div>
                            <div class="stat-label">Total Revenue</div>
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
                            <button class="btn btn-primary" onclick="admin.loadTabContent('tournaments')">
                                <i class="fas fa-eye btn-icon"></i>
                                View All
                            </button>
                            <button class="btn btn-success" onclick="admin.createTournament()">
                                <i class="fas fa-plus btn-icon"></i>
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
                            <button class="btn btn-primary" onclick="admin.loadTabContent('users')">
                                <i class="fas fa-eye btn-icon"></i>
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
        await this.loadRecentTournaments();
        await this.loadRecentUsers();
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

            if (tournaments.length === 0) {
                document.getElementById('recentTournamentsTable').innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
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
                                    <strong>${tournament.title || 'Untitled'}</strong>
                                </td>
                                <td>${tournament.game || 'N/A'}</td>
                                <td>
                                    <span class="status-badge ${this.getStatusClass(tournament.status)}">
                                        ${tournament.status || 'draft'}
                                    </span>
                                </td>
                                <td>₹${tournament.prizePool || 0}</td>
                                <td>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</td>
                                <td>${this.formatDate(tournament.createdAt)}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-secondary" onclick="admin.viewTournament('${tournament.id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="admin.editTournament('${tournament.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            document.getElementById('recentTournamentsTable').innerHTML = tableHTML;

        } catch (error) {
            console.error('Error loading recent tournaments:', error);
            document.getElementById('recentTournamentsTable').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: var(--error);"></i>
                    <h3>Error Loading Tournaments</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
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

            if (users.length === 0) {
                document.getElementById('recentUsersTable').innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
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
                                        <span>${user.email || 'N/A'}</span>
                                    </div>
                                </td>
                                <td>${user.email || 'N/A'}</td>
                                <td>
                                    <span class="role-badge ${user.role || 'user'}">
                                        ${user.role || 'user'}
                                    </span>
                                </td>
                                <td>₹${user.balance || 0}</td>
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

            document.getElementById('recentUsersTable').innerHTML = tableHTML;

        } catch (error) {
            console.error('Error loading recent users:', error);
            document.getElementById('recentUsersTable').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: var(--error);"></i>
                    <h3>Error Loading Users</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

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
                            <i class="fas fa-plus btn-icon"></i>
                            Create Tournament
                        </button>
                        <button class="btn btn-primary" onclick="admin.exportTournaments()">
                            <i class="fas fa-download btn-icon"></i>
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

            if (this.tournaments.length === 0) {
                document.getElementById('tournamentsTable').innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <h3>No Tournaments Created</h3>
                        <p>Create your first tournament to get started</p>
                        <button class="btn btn-success mt-2" onclick="admin.createTournament()">
                            <i class="fas fa-plus btn-icon"></i>
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
                                    <strong>${tournament.title || 'Untitled'}</strong>
                                    ${tournament.description ? `<br><small class="text-muted">${tournament.description.substring(0, 50)}...</small>` : ''}
                                </td>
                                <td>${tournament.game || 'N/A'}</td>
                                <td>
                                    <span class="status-badge ${this.getStatusClass(tournament.status)}">
                                        ${tournament.status || 'draft'}
                                    </span>
                                </td>
                                <td>₹${tournament.entryFee || 0}</td>
                                <td>₹${tournament.prizePool || 0}</td>
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
                                        <button class="btn btn-sm btn-secondary" onclick="admin.viewTournament('${tournament.id}')" title="View">
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

            document.getElementById('tournamentsTable').innerHTML = tableHTML;

        } catch (error) {
            console.error('Error loading tournaments:', error);
            document.getElementById('tournamentsTable').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: var(--error);"></i>
                    <h3>Error Loading Tournaments</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    async createTournament() {
        this.showTournamentModal();
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
                        <form id="tournamentForm">
                            <div class="form-group">
                                <label for="tournamentTitle">Tournament Title</label>
                                <input type="text" id="tournamentTitle" value="${tournament?.title || ''}" required>
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
                                <textarea id="tournamentDescription" rows="3">${tournament?.description || ''}</textarea>
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
                                <textarea id="tournamentRules" rows="4" placeholder="Enter tournament rules...">${tournament?.rules || ''}</textarea>
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

    async saveTournament() {
        const formData = {
            title: document.getElementById('tournamentTitle').value,
            game: document.getElementById('tournamentGame').value,
            description: document.getElementById('tournamentDescription').value,
            entryFee: parseInt(document.getElementById('tournamentEntryFee').value),
            prizePool: parseInt(document.getElementById('tournamentPrizePool').value),
            maxPlayers: parseInt(document.getElementById('tournamentMaxPlayers').value),
            status: document.getElementById('tournamentStatus').value,
            startDate: new Date(document.getElementById('tournamentStartDate').value),
            endDate: new Date(document.getElementById('tournamentEndDate').value),
            rules: document.getElementById('tournamentRules').value,
            featured: document.getElementById('tournamentFeatured').checked,
            currentPlayers: 0,
            createdBy: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Validate data
            if (!this.validateTournamentData(formData)) {
                return;
            }

            await db.collection('tournaments').add(formData);
            
            this.showNotification('Tournament created successfully!', 'success');
            this.closeModal();
            this.loadAllTournaments();
            this.loadStats();

        } catch (error) {
            console.error('Error creating tournament:', error);
            this.showNotification('Error creating tournament: ' + error.message, 'error');
        }
    }

    async editTournament(tournamentId) {
        try {
            const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
            if (tournamentDoc.exists) {
                const tournament = {
                    id: tournamentDoc.id,
                    ...tournamentDoc.data()
                };
                this.showTournamentModal(tournament);
            }
        } catch (error) {
            console.error('Error loading tournament:', error);
            this.showNotification('Error loading tournament data', 'error');
        }
    }

    async updateTournament(tournamentId) {
        const formData = {
            title: document.getElementById('tournamentTitle').value,
            game: document.getElementById('tournamentGame').value,
            description: document.getElementById('tournamentDescription').value,
            entryFee: parseInt(document.getElementById('tournamentEntryFee').value),
            prizePool: parseInt(document.getElementById('tournamentPrizePool').value),
            maxPlayers: parseInt(document.getElementById('tournamentMaxPlayers').value),
            status: document.getElementById('tournamentStatus').value,
            startDate: new Date(document.getElementById('tournamentStartDate').value),
            endDate: new Date(document.getElementById('tournamentEndDate').value),
            rules: document.getElementById('tournamentRules').value,
            featured: document.getElementById('tournamentFeatured').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
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

    validateTournamentData(data) {
        if (!data.title || data.title.trim().length < 5) {
            this.showNotification('Tournament title must be at least 5 characters', 'error');
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

        return true;
    }

    viewTournament(tournamentId) {
        window.open(`tournament-details.html?id=${tournamentId}`, '_blank');
    }

    // Placeholder methods for other tabs
    async loadUsersContent() {
        document.getElementById('content').innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-users"></i>
                        User Management
                    </h2>
                    <div class="section-actions">
                        <button class="btn btn-primary">
                            <i class="fas fa-download btn-icon"></i>
                            Export Users
                        </button>
                    </div>
                </div>
                <div class="no-data">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>User Management</h3>
                    <p>User management functionality will be implemented here</p>
                </div>
            </div>
        `;
    }

    async loadDepositsContent() {
        document.getElementById('content').innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-money-bill-wave"></i>
                        Deposit Requests
                    </h2>
                </div>
                <div class="no-data">
                    <i class="fas fa-money-bill-wave" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Deposit Management</h3>
                    <p>Deposit management functionality will be implemented here</p>
                </div>
            </div>
        `;
    }

    async loadWithdrawalsContent() {
        document.getElementById('content').innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-wallet"></i>
                        Withdrawal Requests
                    </h2>
                </div>
                <div class="no-data">
                    <i class="fas fa-wallet" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Withdrawal Management</h3>
                    <p>Withdrawal management functionality will be implemented here</p>
                </div>
            </div>
        `;
    }

    async loadSettingsContent() {
        document.getElementById('content').innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-cog"></i>
                        System Settings
                    </h2>
                </div>
                <div class="no-data">
                    <i class="fas fa-cog" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>System Settings</h3>
                    <p>System settings will be implemented here</p>
                </div>
            </div>
        `;
    }

    async loadLogsContent() {
        document.getElementById('content').innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-clipboard-list"></i>
                        Admin Logs
                    </h2>
                </div>
                <div class="no-data">
                    <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>Admin Logs</h3>
                    <p>Admin logs will be displayed here</p>
                </div>
            </div>
        `;
    }

    async loadUserProfile() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.email;
            document.getElementById('userAvatar').textContent = this.currentUser.email ? this.currentUser.email[0].toUpperCase() : 'A';
        }
    }

    setupRealTimeListeners() {
        // Real-time listeners for updates
        db.collection('tournaments').onSnapshot(() => {
            if (this.currentTab === 'dashboard' || this.currentTab === 'tournaments') {
                this.loadStats();
                if (this.currentTab === 'tournaments') {
                    this.loadAllTournaments();
                } else if (this.currentTab === 'dashboard') {
                    this.loadRecentTournaments();
                }
            }
        });

        db.collection('users').onSnapshot(() => {
            this.loadStats();
        });
    }

    refreshData() {
        this.showNotification('Refreshing data...', 'info');
        this.loadStats();
        this.loadTabContent(this.currentTab);
    }

    handleGlobalSearch(query) {
        // Implement global search functionality
        console.log('Search query:', query);
    }

    toggleUserMenu() {
        // Implement user menu dropdown
        console.log('Toggle user menu');
    }

    async signOut() {
        try {
            await auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            this.showNotification('Error signing out', 'error');
        }
    }

    exportTournaments() {
        // Implement export functionality
        this.showNotification('Export feature coming soon!', 'info');
    }

    // Utility methods
    getStatusClass(status) {
        const statusClasses = {
            active: 'success',
            upcoming: 'warning',
            registering: 'info',
            completed: 'info',
            draft: 'error',
            cancelled: 'error'
        };
        return statusClasses[status] || 'info';
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            let date;
            if (timestamp.toDate) {
                date = timestamp.toDate();
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else if (timestamp.seconds) {
                date = new Date(timestamp.seconds * 1000);
            } else {
                return 'N/A';
            }

            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
        } catch (e) {
            console.error('Error formatting date:', e);
            return 'N/A';
        }
    }

    formatDateForInput(timestamp) {
        if (!timestamp) return '';
        
        try {
            let date;
            if (timestamp.toDate) {
                date = timestamp.toDate();
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else if (timestamp.seconds) {
                date = new Date(timestamp.seconds * 1000);
            } else {
                return '';
            }

            return date.toISOString().slice(0, 16);
            
        } catch (e) {
            console.error('Error formatting date for input:', e);
            return '';
        }
    }
    

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation' : 'info'}-circle"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}


// Initialize the admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminDashboard();
});
