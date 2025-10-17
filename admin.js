// Enhanced Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.activeTab = 'dashboard';
        this.searchQuery = '';
        this.sidebarCollapsed = false;
        this.currentData = {
            users: [],
            tournaments: [],
            deposits: [],
            withdrawals: [],
            matches: [],
            adminLogs: []
        };

        this.init();
    }

    async init() {
        console.log('🚀 AdminDashboard initializing...');
        await this.setupAuth();
        this.setupEventListeners();
        this.setupUI();
        await this.loadDashboardData();
    }

    async setupAuth() {
        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user) => {
                console.log('🔐 Auth state changed:', user);
                
                if (!user) {
                    this.showNotification('Please login to continue', 'error');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }

                this.currentUser = user;
                const isAdmin = await this.verifyAdminAccess();
                if (isAdmin) {
                    this.updateUserInfo();
                    resolve();
                }
            });
        });
    }

    async verifyAdminAccess() {
        try {
            console.log('👮 Verifying admin access for:', this.currentUser.uid);
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            
            if (!userDoc.exists) {
                console.error('❌ User document does not exist');
                this.showNotification('User account not found', 'error');
                return false;
            }

            const userData = userDoc.data();
            console.log('📄 User data:', userData);
            
            if (userData.role !== 'admin') {
                console.error('❌ User is not admin. Role:', userData.role);
                this.showNotification('Access denied - Admin privileges required', 'error');
                await auth.signOut();
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return false;
            }

            console.log('✅ Admin access verified');
            return true;
        } catch (error) {
            console.error('❌ Auth verification error:', error);
            this.showNotification('Authentication error: ' + error.message, 'error');
            return false;
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.toggleMobileMenu());

        // Navigation
        document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Header actions
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('signOutBtn').addEventListener('click', () => this.signOut());
        document.getElementById('globalSearch').addEventListener('input', 
            this.debounce((e) => this.handleSearch(e), 300)
        );

        // User menu
        document.getElementById('userMenu').addEventListener('click', () => this.toggleUserMenu());

        // Notifications button
        document.getElementById('notificationsBtn').addEventListener('click', () => this.showNotifications());
    }

    setupUI() {
        this.updateUserInfo();
        this.hideLoadingState();
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = this.currentUser.email;
        if (userAvatar) {
            const initial = this.currentUser.email.charAt(0).toUpperCase();
            userAvatar.textContent = initial;
        }
    }

    async loadDashboardData() {
        console.log('📊 Loading dashboard data...');
        
        try {
            // Load all data in parallel with error handling for each
            const promises = [
                this.loadCollectionSafe('users'),
                this.loadCollectionSafe('tournaments'), 
                this.loadCollectionSafe('deposits'),
                this.loadCollectionSafe('withdrawals'),
                this.loadCollectionSafe('matches'),
                this.loadCollectionSafe('adminLogs')
            ];

            const [users, tournaments, deposits, withdrawals, matches, adminLogs] = await Promise.all(promises);
            
            this.currentData.users = users;
            this.currentData.tournaments = tournaments;
            this.currentData.deposits = deposits;
            this.currentData.withdrawals = withdrawals;
            this.currentData.matches = matches;
            this.currentData.adminLogs = adminLogs;

            console.log('✅ Data loaded:', {
                users: users.length,
                tournaments: tournaments.length,
                deposits: deposits.length,
                withdrawals: withdrawals.length,
                matches: matches.length,
                adminLogs: adminLogs.length
            });

            // Update badge counts
            this.updateBadgeCounts();
            
            // If dashboard is active, refresh it
            if (this.activeTab === 'dashboard') {
                await this.renderDashboard();
            }

        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showNotification('Failed to load dashboard data: ' + error.message, 'error');
            
            // Still try to render dashboard with empty data
            if (this.activeTab === 'dashboard') {
                await this.renderDashboard();
            }
        }
    }

    async loadCollectionSafe(collectionName) {
        try {
            console.log(`📁 Loading collection: ${collectionName}`);
            const snap = await db.collection(collectionName).get();
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`✅ ${collectionName} loaded:`, data.length, 'items');
            return data;
        } catch (error) {
            console.error(`❌ Error loading ${collectionName}:`, error);
            
            // If collection doesn't exist, return empty array instead of failing
            if (error.code === 'failed-precondition' || error.code === 'permission-denied') {
                console.log(`ℹ️  Collection ${collectionName} might not exist or access denied`);
                return [];
            }
            
            this.showNotification(`Warning: Could not load ${collectionName}`, 'warning');
            return [];
        }
    }

    updateBadgeCounts() {
        const badges = {
            usersBadge: this.currentData.users.length,
            tournamentsBadge: this.currentData.tournaments.length,
            depositsBadge: this.currentData.deposits.filter(d => d.status === 'pending').length,
            withdrawalsBadge: this.currentData.withdrawals.filter(w => w.status === 'pending').length
        };

        console.log('🔄 Updating badge counts:', badges);

        Object.entries(badges).forEach(([id, count]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = count > 99 ? '99+' : count;
                element.style.display = count > 0 ? 'flex' : 'none';
            }
        });
    }

    // Dashboard Rendering
    async renderDashboard() {
        const content = document.getElementById('content');
        
        const stats = this.calculateStats();
        const recentUsers = this.currentData.users.slice(0, 5);
        const recentTournaments = this.currentData.tournaments.slice(0, 5);
        const pendingDeposits = this.currentData.deposits.filter(d => d.status === 'pending').slice(0, 3);
        const pendingWithdrawals = this.currentData.withdrawals.filter(w => w.status === 'pending').slice(0, 3);

        console.log('🎨 Rendering dashboard with stats:', stats);

        content.innerHTML = `
            <div class="dashboard-overview">
                <!-- Debug Info -->
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface-light); border-radius: var(--radius); border-left: 4px solid var(--primary);">
                    <h4 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-info-circle" style="color: var(--primary);"></i>
                        System Status
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.875rem;">
                        <div><strong>Users:</strong> ${this.currentData.users.length}</div>
                        <div><strong>Tournaments:</strong> ${this.currentData.tournaments.length}</div>
                        <div><strong>Deposits:</strong> ${this.currentData.deposits.length}</div>
                        <div><strong>Withdrawals:</strong> ${this.currentData.withdrawals.length}</div>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="overview-grid">
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                12%
                            </div>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${stats.totalUsers}</div>
                            <div class="stat-label">Total Users</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #f97316);">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                8%
                            </div>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${stats.totalTournaments}</div>
                            <div class="stat-label">Active Tournaments</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="stat-trend ${stats.revenueChange < 0 ? 'down' : ''}">
                                <i class="fas fa-arrow-${stats.revenueChange < 0 ? 'down' : 'up'}"></i>
                                ${Math.abs(stats.revenueChange)}%
                            </div>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">$${stats.totalRevenue}</div>
                            <div class="stat-label">Total Revenue</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                15%
                            </div>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${stats.pendingActions}</div>
                            <div class="stat-label">Pending Actions</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card" style="cursor: pointer;" onclick="admin.switchTab('deposits')">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="stat-icon" style="background: var(--warning);">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div>
                                <div class="stat-value">${pendingDeposits.length}</div>
                                <div class="stat-label">Pending Deposits</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card" style="cursor: pointer;" onclick="admin.switchTab('withdrawals')">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="stat-icon" style="background: var(--error);">
                                <i class="fas fa-exclamation-circle"></i>
                            </div>
                            <div>
                                <div class="stat-value">${pendingWithdrawals.length}</div>
                                <div class="stat-label">Pending Withdrawals</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div class="data-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
                    <!-- Left Column -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        ${this.currentData.users.length > 0 ? `
                            <div class="data-section">
                                <div class="section-header">
                                    <h3 class="section-title">
                                        <i class="fas fa-users"></i>
                                        Recent Users
                                    </h3>
                                    <button class="btn btn-secondary btn-sm" onclick="admin.switchTab('users')">
                                        View All
                                    </button>
                                </div>
                                <div class="table-container">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Status</th>
                                                <th>Joined</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${recentUsers.map(user => `
                                                <tr>
                                                    <td>
                                                        <div style="font-weight: 500;">${this.escapeHtml(user.email || 'No email')}</div>
                                                        <div class="text-muted" style="font-size: 0.75rem;">${user.role || 'user'}</div>
                                                    </td>
                                                    <td>
                                                        <span class="status-badge ${user.verified ? 'success' : 'warning'}">
                                                            ${user.verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td>${this.formatDate(user.createdAt)}</td>
                                                    <td>
                                                        <div class="action-buttons">
                                                            ${!user.verified ? `
                                                                <button class="btn btn-success btn-sm" onclick="admin.verifyUser('${user.id}')">
                                                                    <i class="fas fa-check"></i>
                                                                </button>
                                                            ` : ''}
                                                            ${user.role !== 'admin' ? `
                                                                <button class="btn btn-primary btn-sm" onclick="admin.promoteUser('${user.id}')">
                                                                    <i class="fas fa-user-shield"></i>
                                                                </button>
                                                            ` : ''}
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ` : ''}

                        ${this.currentData.tournaments.length > 0 ? `
                            <div class="data-section">
                                <div class="section-header">
                                    <h3 class="section-title">
                                        <i class="fas fa-trophy"></i>
                                        Active Tournaments
                                    </h3>
                                    <button class="btn btn-secondary btn-sm" onclick="admin.switchTab('tournaments')">
                                        View All
                                    </button>
                                </div>
                                <div class="table-container">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Tournament</th>
                                                <th>Game</th>
                                                <th>Players</th>
                                                <th>Prize Pool</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${recentTournaments.filter(t => t.status === 'active').map(tournament => `
                                                <tr>
                                                    <td>
                                                        <div style="font-weight: 500;">${this.escapeHtml(tournament.title || 'Untitled')}</div>
                                                        <div class="text-muted" style="font-size: 0.75rem;">${this.formatDate(tournament.startDate)}</div>
                                                    </td>
                                                    <td>${this.escapeHtml(tournament.game || 'N/A')}</td>
                                                    <td>
                                                        <div>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</div>
                                                        <div class="text-muted" style="font-size: 0.75rem;">players</div>
                                                    </td>
                                                    <td>$${(tournament.prizePool || 0).toLocaleString()}</td>
                                                    <td>
                                                        <div class="action-buttons">
                                                            <button class="btn btn-secondary btn-sm" onclick="admin.viewTournament('${tournament.id}')">
                                                                <i class="fas fa-eye"></i>
                                                            </button>
                                                            <button class="btn btn-warning btn-sm" onclick="admin.editTournament('${tournament.id}')">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right Column -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <!-- Pending Actions -->
                        <div class="data-section">
                            <div class="section-header">
                                <h3 class="section-title">
                                    <i class="fas fa-clock"></i>
                                    Pending Actions
                                </h3>
                            </div>
                            <div style="padding: 1rem;">
                                ${pendingDeposits.length > 0 || pendingWithdrawals.length > 0 ? `
                                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                                        ${pendingDeposits.map(deposit => `
                                            <div style="display: flex; justify-content: between; align-items: center; padding: 0.75rem; background: var(--surface-dark); border-radius: var(--radius);">
                                                <div>
                                                    <div style="font-weight: 500;">Deposit - $${deposit.amount}</div>
                                                    <div class="text-muted" style="font-size: 0.75rem;">${deposit.userEmail}</div>
                                                </div>
                                                <button class="btn btn-success btn-sm" onclick="admin.approveDeposit('${deposit.id}')">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                            </div>
                                        `).join('')}
                                        ${pendingWithdrawals.map(withdrawal => `
                                            <div style="display: flex; justify-content: between; align-items: center; padding: 0.75rem; background: var(--surface-dark); border-radius: var(--radius);">
                                                <div>
                                                    <div style="font-weight: 500;">Withdrawal - $${withdrawal.amount}</div>
                                                    <div class="text-muted" style="font-size: 0.75rem;">${withdrawal.userEmail}</div>
                                                </div>
                                                <button class="btn btn-success btn-sm" onclick="admin.approveWithdrawal('${withdrawal.id}')">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="text-center text-muted" style="padding: 2rem;">
                                        <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                                        <div>No pending actions</div>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- System Status -->
                        <div class="data-section">
                            <div class="section-header">
                                <h3 class="section-title">
                                    <i class="fas fa-server"></i>
                                    System Status
                                </h3>
                            </div>
                            <div style="padding: 1rem;">
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div style="display: flex; justify-content: between; align-items: center;">
                                        <span>Database</span>
                                        <span class="status-badge success">Online</span>
                                    </div>
                                    <div style="display: flex; justify-content: between; align-items: center;">
                                        <span>Authentication</span>
                                        <span class="status-badge success">Online</span>
                                    </div>
                                    <div style="display: flex; justify-content: between; align-items: center;">
                                        <span>Storage</span>
                                        <span class="status-badge success">Online</span>
                                    </div>
                                    <div style="display: flex; justify-content: between; align-items: center;">
                                        <span>Last Backup</span>
                                        <span class="text-muted">${new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Stats -->
                        <div class="data-section">
                            <div class="section-header">
                                <h3 class="section-title">
                                    <i class="fas fa-chart-bar"></i>
                                    Quick Stats
                                </h3>
                            </div>
                            <div style="padding: 1rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div style="text-align: center;">
                                        <div class="stat-value" style="font-size: 1.5rem;">${this.currentData.users.filter(u => u.verified).length}</div>
                                        <div class="stat-label">Verified Users</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div class="stat-value" style="font-size: 1.5rem;">${this.currentData.tournaments.filter(t => t.status === 'completed').length}</div>
                                        <div class="stat-label">Completed Events</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div class="stat-value" style="font-size: 1.5rem;">${this.currentData.deposits.filter(d => d.status === 'approved').length}</div>
                                        <div class="stat-label">Processed Deposits</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div class="stat-value" style="font-size: 1.5rem;">${this.currentData.adminLogs.length}</div>
                                        <div class="stat-label">Admin Actions</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    calculateStats() {
        const totalRevenue = this.currentData.deposits
            .filter(d => d.status === 'approved')
            .reduce((sum, deposit) => sum + (parseFloat(deposit.amount) || 0), 0);

        return {
            totalUsers: this.currentData.users.length,
            totalTournaments: this.currentData.tournaments.length,
            totalRevenue: totalRevenue.toFixed(2),
            revenueChange: 12, // Placeholder
            pendingActions: this.currentData.deposits.filter(d => d.status === 'pending').length +
                          this.currentData.withdrawals.filter(w => w.status === 'pending').length
        };
    }

    // User Management
    async renderUsers() {
        const filteredUsers = this.currentData.users.filter(user =>
            !this.searchQuery ||
            user.email?.toLowerCase().includes(this.searchQuery) ||
            user.role?.toLowerCase().includes(this.searchQuery) ||
            user.id?.toLowerCase().includes(this.searchQuery)
        );

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-users"></i>
                        User Management
                    </h3>
                    <div class="section-actions">
                        <div class="search-container">
                            <input type="text" id="userSearch" class="search-input" placeholder="Search users..." value="${this.searchQuery}">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                        <button class="btn btn-primary" onclick="admin.createUserModal()">
                            <i class="fas fa-plus btn-icon"></i>
                            Add User
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-grid" style="margin: 1rem 0;">
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.users.length}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.users.filter(u => u.role === 'admin').length}</div>
                        <div class="stat-label">Admins</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.users.filter(u => u.verified).length}</div>
                        <div class="stat-label">Verified</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.users.filter(u => !u.verified).length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredUsers.length > 0 ? filteredUsers.map(user => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 500;">${this.escapeHtml(user.email || 'No email')}</div>
                                        <div class="text-muted" style="font-size: 0.75rem;">ID: ${user.id.substring(0, 8)}...</div>
                                    </td>
                                    <td>
                                        <span class="role-badge ${user.role || 'user'}">${user.role || 'user'}</span>
                                    </td>
                                    <td>
                                        <span class="status-badge ${user.verified ? 'success' : 'warning'}">
                                            ${user.verified ? 'Verified' : 'Pending'}
                                        </span>
                                    </td>
                                    <td>${this.formatDate(user.createdAt)}</td>
                                    <td>${this.formatDate(user.lastLogin || user.createdAt)}</td>
                                    <td>
                                        <div class="action-buttons">
                                            ${!user.verified ? `
                                                <button class="btn btn-success btn-sm" onclick="admin.verifyUser('${user.id}')" title="Verify User">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                            ` : `
                                                <button class="btn btn-warning btn-sm" onclick="admin.unverifyUser('${user.id}')" title="Unverify User">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            `}
                                            ${user.role !== 'admin' ? `
                                                <button class="btn btn-primary btn-sm" onclick="admin.promoteUser('${user.id}')" title="Promote to Admin">
                                                    <i class="fas fa-user-shield"></i>
                                                </button>
                                            ` : user.id !== this.currentUser?.uid ? `
                                                <button class="btn btn-secondary btn-sm" onclick="admin.demoteUser('${user.id}')" title="Demote to User">
                                                    <i class="fas fa-user"></i>
                                                </button>
                                            ` : ''}
                                            ${user.id !== this.currentUser?.uid ? `
                                                <button class="btn btn-danger btn-sm" onclick="admin.deleteUser('${user.id}')" title="Delete User">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="6" class="text-center text-muted" style="padding: 3rem;">
                                        <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <div>No users found</div>
                                        ${this.searchQuery ? '<div class="mt-1">Try adjusting your search terms</div>' : ''}
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add search functionality
        document.getElementById('userSearch').addEventListener('input', this.debounce((e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderUsers();
        }, 300));
    }

    // Tournament Management
    async renderTournaments() {
        const filteredTournaments = this.currentData.tournaments.filter(tournament =>
            !this.searchQuery ||
            tournament.title?.toLowerCase().includes(this.searchQuery) ||
            tournament.game?.toLowerCase().includes(this.searchQuery) ||
            tournament.status?.toLowerCase().includes(this.searchQuery)
        );

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-trophy"></i>
                        Tournament Management
                    </h3>
                    <div class="section-actions">
                        <div class="search-container">
                            <input type="text" id="tournamentSearch" class="search-input" placeholder="Search tournaments..." value="${this.searchQuery}">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                        <button class="btn btn-primary" onclick="admin.createTournamentModal()">
                            <i class="fas fa-plus btn-icon"></i>
                            Create Tournament
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-grid" style="margin: 1rem 0;">
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.tournaments.length}</div>
                        <div class="stat-label">Total Tournaments</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.tournaments.filter(t => t.status === 'active').length}</div>
                        <div class="stat-label">Active</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.tournaments.filter(t => t.status === 'upcoming').length}</div>
                        <div class="stat-label">Upcoming</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.tournaments.reduce((sum, t) => sum + (t.currentPlayers || 0), 0)}</div>
                        <div class="stat-label">Total Players</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Tournament</th>
                                <th>Game</th>
                                <th>Status</th>
                                <th>Players</th>
                                <th>Prize Pool</th>
                                <th>Start Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredTournaments.length > 0 ? filteredTournaments.map(tournament => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 500;">${this.escapeHtml(tournament.title || 'Untitled Tournament')}</div>
                                        ${tournament.description ? `<div class="text-muted" style="font-size: 0.75rem; margin-top: 0.25rem;">${this.escapeHtml(tournament.description)}</div>` : ''}
                                    </td>
                                    <td>${this.escapeHtml(tournament.game || 'N/A')}</td>
                                    <td>
                                        <span class="status-badge ${this.getStatusBadgeClass(tournament.status)}">
                                            ${tournament.status || 'draft'}
                                        </span>
                                    </td>
                                    <td>
                                        <div>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</div>
                                        <div class="text-muted" style="font-size: 0.75rem;">players</div>
                                    </td>
                                    <td>$${(tournament.prizePool || 0).toLocaleString()}</td>
                                    <td>${this.formatDate(tournament.startDate)}</td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-secondary btn-sm" onclick="admin.viewTournament('${tournament.id}')" title="View Details">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button class="btn btn-warning btn-sm" onclick="admin.editTournamentModal('${tournament.id}')" title="Edit Tournament">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-info btn-sm" onclick="admin.manageMatches('${tournament.id}')" title="Manage Matches">
                                                <i class="fas fa-gamepad"></i>
                                            </button>
                                            ${tournament.status !== 'cancelled' && tournament.status !== 'completed' ? `
                                                <button class="btn btn-danger btn-sm" onclick="admin.cancelTournament('${tournament.id}')" title="Cancel Tournament">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="7" class="text-center text-muted" style="padding: 3rem;">
                                        <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <div>No tournaments found</div>
                                        ${this.searchQuery ? '<div class="mt-1">Try adjusting your search terms</div>' : ''}
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add search functionality
        document.getElementById('tournamentSearch').addEventListener('input', this.debounce((e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTournaments();
        }, 300));
    }

    // Deposit Management
    async renderDeposits() {
        const filteredDeposits = this.currentData.deposits.filter(deposit =>
            !this.searchQuery ||
            deposit.userEmail?.toLowerCase().includes(this.searchQuery) ||
            deposit.status?.toLowerCase().includes(this.searchQuery) ||
            deposit.method?.toLowerCase().includes(this.searchQuery)
        );

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-money-bill-wave"></i>
                        Deposit Management
                    </h3>
                    <div class="section-actions">
                        <div class="search-container">
                            <input type="text" id="depositSearch" class="search-input" placeholder="Search deposits..." value="${this.searchQuery}">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-grid" style="margin: 1rem 0;">
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.deposits.length}</div>
                        <div class="stat-label">Total Deposits</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.deposits.filter(d => d.status === 'pending').length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.deposits.filter(d => d.status === 'approved').length}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">$${this.currentData.deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(2)}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="data-table">
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
                        <tbody>
                            ${filteredDeposits.length > 0 ? filteredDeposits.map(deposit => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 500;">${this.escapeHtml(deposit.userEmail || 'N/A')}</div>
                                        ${deposit.userId ? `<div class="text-muted" style="font-size: 0.75rem;">${deposit.userId.substring(0, 8)}...</div>` : ''}
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: var(--success);">$${parseFloat(deposit.amount || 0).toFixed(2)}</div>
                                    </td>
                                    <td>${this.escapeHtml(deposit.method || 'N/A')}</td>
                                    <td>
                                        <span class="status-badge ${deposit.status === 'approved' ? 'success' : deposit.status === 'rejected' ? 'error' : 'warning'}">
                                            ${deposit.status || 'pending'}
                                        </span>
                                    </td>
                                    <td>${this.formatDateTime(deposit.createdAt)}</td>
                                    <td>
                                        <code style="font-size: 0.75rem; background: var(--surface-dark); padding: 0.25rem 0.5rem; border-radius: 4px;">
                                            ${deposit.transactionId || 'N/A'}
                                        </code>
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            ${deposit.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="admin.approveDeposit('${deposit.id}')" title="Approve Deposit">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                                <button class="btn btn-danger btn-sm" onclick="admin.rejectDeposit('${deposit.id}')" title="Reject Deposit">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : `
                                                <span class="text-muted" style="font-size: 0.75rem;">Processed</span>
                                            `}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="7" class="text-center text-muted" style="padding: 3rem;">
                                        <i class="fas fa-money-bill-wave" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <div>No deposits found</div>
                                        ${this.searchQuery ? '<div class="mt-1">Try adjusting your search terms</div>' : ''}
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add search functionality
        document.getElementById('depositSearch').addEventListener('input', this.debounce((e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderDeposits();
        }, 300));
    }

    // Withdrawal Management
    async renderWithdrawals() {
        const filteredWithdrawals = this.currentData.withdrawals.filter(withdrawal =>
            !this.searchQuery ||
            withdrawal.userEmail?.toLowerCase().includes(this.searchQuery) ||
            withdrawal.status?.toLowerCase().includes(this.searchQuery) ||
            withdrawal.method?.toLowerCase().includes(this.searchQuery)
        );

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-wallet"></i>
                        Withdrawal Management
                    </h3>
                    <div class="section-actions">
                        <div class="search-container">
                            <input type="text" id="withdrawalSearch" class="search-input" placeholder="Search withdrawals..." value="${this.searchQuery}">
                            <i class="fas fa-search search-icon"></i>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-grid" style="margin: 1rem 0;">
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.withdrawals.length}</div>
                        <div class="stat-label">Total Withdrawals</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.withdrawals.filter(w => w.status === 'pending').length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${this.currentData.withdrawals.filter(w => w.status === 'approved').length}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">$${this.currentData.withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0).toFixed(2)}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="data-table">
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
                        <tbody>
                            ${filteredWithdrawals.length > 0 ? filteredWithdrawals.map(withdrawal => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 500;">${this.escapeHtml(withdrawal.userEmail || 'N/A')}</div>
                                        ${withdrawal.userId ? `<div class="text-muted" style="font-size: 0.75rem;">${withdrawal.userId.substring(0, 8)}...</div>` : ''}
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: var(--error);">-$${parseFloat(withdrawal.amount || 0).toFixed(2)}</div>
                                    </td>
                                    <td>${this.escapeHtml(withdrawal.method || 'N/A')}</td>
                                    <td>
                                        <span class="status-badge ${withdrawal.status === 'approved' ? 'success' : withdrawal.status === 'rejected' ? 'error' : 'warning'}">
                                            ${withdrawal.status || 'pending'}
                                        </span>
                                    </td>
                                    <td>${this.formatDateTime(withdrawal.createdAt)}</td>
                                    <td>
                                        ${withdrawal.accountNumber ? `
                                            <div style="font-size: 0.75rem;">
                                                <div>${this.escapeHtml(withdrawal.accountNumber)}</div>
                                                ${withdrawal.bankName ? `<div class="text-muted">${this.escapeHtml(withdrawal.bankName)}</div>` : ''}
                                            </div>
                                        ` : 'N/A'}
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            ${withdrawal.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="admin.approveWithdrawal('${withdrawal.id}')" title="Approve Withdrawal">
                                                    <i class="fas fa-check"></i>
                                                </button>
                                                <button class="btn btn-danger btn-sm" onclick="admin.rejectWithdrawal('${withdrawal.id}')" title="Reject Withdrawal">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : `
                                                <span class="text-muted" style="font-size: 0.75rem;">Processed</span>
                                            `}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="7" class="text-center text-muted" style="padding: 3rem;">
                                        <i class="fas fa-wallet" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <div>No withdrawals found</div>
                                        ${this.searchQuery ? '<div class="mt-1">Try adjusting your search terms</div>' : ''}
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add search functionality
        document.getElementById('withdrawalSearch').addEventListener('input', this.debounce((e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderWithdrawals();
        }, 300));
    }

    // Settings
    async renderSettings() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-cog"></i>
                        System Settings
                    </h3>
                </div>

                <div style="padding: 2rem;">
                    <!-- System Information -->
                    <div class="settings-section">
                        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-info-circle" style="color: var(--primary);"></i>
                            System Information
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                            <div style="background: var(--surface-dark); padding: 1.5rem; border-radius: var(--radius);">
                                <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Admin Details</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Email:</span>
                                        <span>${this.currentUser?.email || 'N/A'}</span>
                                    </div>
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">User ID:</span>
                                        <span style="font-family: monospace; font-size: 0.75rem;">${this.currentUser?.uid || 'N/A'}</span>
                                    </div>
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Last Login:</span>
                                        <span>${new Date().toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div style="background: var(--surface-dark); padding: 1.5rem; border-radius: var(--radius);">
                                <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Database Statistics</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Users:</span>
                                        <span>${this.currentData.users.length}</span>
                                    </div>
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Tournaments:</span>
                                        <span>${this.currentData.tournaments.length}</span>
                                    </div>
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Deposits:</span>
                                        <span>${this.currentData.deposits.length}</span>
                                    </div>
                                    <div style="display: flex; justify-content: between;">
                                        <span class="text-muted">Withdrawals:</span>
                                        <span>${this.currentData.withdrawals.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- System Controls -->
                    <div class="settings-section">
                        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-sliders-h" style="color: var(--primary);"></i>
                            System Controls
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                            <div style="background: var(--surface-dark); padding: 1.5rem; border-radius: var(--radius); text-align: center;">
                                <i class="fas fa-sync-alt" style="font-size: 2rem; margin-bottom: 1rem; color: var(--primary);"></i>
                                <h4 style="margin-bottom: 0.5rem;">Refresh Data</h4>
                                <p class="text-muted" style="margin-bottom: 1rem; font-size: 0.875rem;">Reload all data from database</p>
                                <button class="btn btn-primary" onclick="admin.refreshData()">
                                    <i class="fas fa-sync-alt btn-icon"></i>
                                    Refresh Now
                                </button>
                            </div>

                            <div style="background: var(--surface-dark); padding: 1.5rem; border-radius: var(--radius); text-align: center;">
                                <i class="fas fa-database" style="font-size: 2rem; margin-bottom: 1rem; color: var(--warning);"></i>
                                <h4 style="margin-bottom: 0.5rem;">Clear Cache</h4>
                                <p class="text-muted" style="margin-bottom: 1rem; font-size: 0.875rem;">Clear all cached data</p>
                                <button class="btn btn-warning" onclick="admin.clearCache()">
                                    <i class="fas fa-broom btn-icon"></i>
                                    Clear Cache
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Danger Zone -->
                    <div class="settings-section">
                        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
                            Danger Zone
                        </h3>
                        <div class="danger-zone">
                            <div style="display: flex; justify-content: between; align-items: center; padding: 1rem 0; border-bottom: 1px solid rgba(239, 68, 68, 0.3);">
                                <div>
                                    <div style="font-weight: 500; color: var(--text-primary);">Emergency Logout</div>
                                    <div class="text-muted" style="font-size: 0.875rem;">Sign out from all devices immediately</div>
                                </div>
                                <button class="btn btn-danger" onclick="admin.emergencyLogout()">
                                    <i class="fas fa-sign-out-alt btn-icon"></i>
                                    Logout All
                                </button>
                            </div>

                            <div style="display: flex; justify-content: between; align-items: center; padding: 1rem 0;">
                                <div>
                                    <div style="font-weight: 500; color: var(--text-primary);">System Maintenance</div>
                                    <div class="text-muted" style="font-size: 0.875rem;">Put system in maintenance mode</div>
                                </div>
                                <button class="btn btn-warning" onclick="admin.toggleMaintenance()">
                                    <i class="fas fa-tools btn-icon"></i>
                                    Maintenance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Admin Logs
    async renderLogs() {
        const content = document.getElementById('content');
        const recentLogs = this.currentData.adminLogs.slice(0, 50);

        content.innerHTML = `
            <div class="data-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-clipboard-list"></i>
                        Admin Activity Logs
                    </h3>
                    <div class="section-actions">
                        <button class="btn btn-secondary" onclick="admin.exportLogs()">
                            <i class="fas fa-download btn-icon"></i>
                            Export Logs
                        </button>
                    </div>
                </div>

                <div style="padding: 1rem;">
                    ${recentLogs.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            ${recentLogs.map(log => `
                                <div style="background: var(--surface-dark); padding: 1rem; border-radius: var(--radius); border-left: 4px solid var(--primary);">
                                    <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.5rem;">
                                        <div style="font-weight: 500; text-transform: capitalize;">
                                            ${log.action ? log.action.replace(/_/g, ' ') : 'Unknown Action'}
                                        </div>
                                        <div class="text-muted" style="font-size: 0.75rem;">
                                            ${this.formatDateTime(log.timestamp)}
                                        </div>
                                    </div>
                                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-size: 0.875rem;">
                                        <span class="text-muted">Admin:</span>
                                        <span>${this.escapeHtml(log.adminEmail || 'Unknown')}</span>
                                        
                                        <span class="text-muted">Target:</span>
                                        <span style="font-family: monospace;">${log.targetUid ? log.targetUid.substring(0, 8) + '...' : 'System'}</span>
                                        
                                        ${log.details ? `
                                            <span class="text-muted">Details:</span>
                                            <div style="background: var(--surface); padding: 0.5rem; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">
                                                ${JSON.stringify(log.details, null, 2)}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center text-muted" style="padding: 3rem;">
                            <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <div>No admin logs found</div>
                            <div class="mt-1">Admin activity will be logged here</div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Utility Methods
    getStatusBadgeClass(status) {
        const statusMap = {
            'active': 'success',
            'completed': 'info',
            'pending': 'warning',
            'cancelled': 'error',
            'draft': 'warning',
            'approved': 'success',
            'rejected': 'error'
        };
        return statusMap[status] || 'warning';
    }

    escapeHtml(text) {
        if (!text) return 'N/A';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        if (timestamp.toDate) {
            return timestamp.toDate().toLocaleDateString();
        }
        try {
            return new Date(timestamp).toLocaleDateString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    formatDateTime(timestamp) {
        if (!timestamp) return 'N/A';
        if (timestamp.toDate) {
            return timestamp.toDate().toLocaleString();
        }
        try {
            return new Date(timestamp).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    hideLoadingState() {
        const loadingState = document.querySelector('.loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }

    // UI Methods
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const logo = document.getElementById('logo');
        const toggleIcon = document.getElementById('toggleSidebar').querySelector('i');
        
        this.sidebarCollapsed = !this.sidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
        logo.classList.toggle('collapsed', this.sidebarCollapsed);
        
        toggleIcon.className = this.sidebarCollapsed ? 
            'fas fa-chevron-right' : 'fas fa-chevron-left';
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('mobile-open');
    }

    async switchTab(tabName) {
        this.activeTab = tabName;
        this.searchQuery = ''; // Reset search when switching tabs
        
        // Update active states
        document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });

        // Update page title
        const pageTitle = document.getElementById('pageTitle');
        const titles = {
            dashboard: 'Dashboard',
            users: 'User Management',
            tournaments: 'Tournament Management',
            deposits: 'Deposit Management',
            withdrawals: 'Withdrawal Management',
            settings: 'Settings',
            logs: 'Admin Logs'
        };
        pageTitle.textContent = titles[tabName] || 'Admin Dashboard';

        // Load tab content
        await this.loadTabContent(tabName);
    }

    async loadTabContent(tabName) {
        const content = document.getElementById('content');
        
        // Show loading state
        content.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading ${tabName}...</p>
            </div>
        `;

        try {
            switch (tabName) {
                case 'dashboard':
                    await this.renderDashboard();
                    break;
                case 'users':
                    await this.renderUsers();
                    break;
                case 'tournaments':
                    await this.renderTournaments();
                    break;
                case 'deposits':
                    await this.renderDeposits();
                    break;
                case 'withdrawals':
                    await this.renderWithdrawals();
                    break;
                case 'settings':
                    await this.renderSettings();
                    break;
                case 'logs':
                    await this.renderLogs();
                    break;
                default:
                    content.innerHTML = this.getErrorHTML('Tab not found');
            }
        } catch (error) {
            console.error(`Error loading ${tabName}:`, error);
            content.innerHTML = this.getErrorHTML(`Failed to load ${tabName}: ${error.message}`);
        }
    }

    getErrorHTML(message) {
        return `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: var(--error);"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary mt-2" onclick="location.reload()">
                    <i class="fas fa-redo btn-icon"></i>
                    Retry
                </button>
            </div>
        `;
    }

    async refreshData() {
        this.showNotification('Refreshing data...', 'info');
        await this.loadDashboardData();
        this.showNotification('Data refreshed successfully', 'success');
    }

    async signOut() {
        try {
            await auth.signOut();
            this.showNotification('Signed out successfully', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } catch (error) {
            console.error('Sign out error:', error);
            this.showNotification('Sign out failed', 'error');
        }
    }

    handleSearch(event) {
        this.searchQuery = event.target.value.toLowerCase();
        // Re-render current tab with search filter
        this.loadTabContent(this.activeTab);
    }

    toggleUserMenu() {
        this.showNotification('User menu clicked', 'info');
    }

    showNotifications() {
        this.showNotification('No new notifications', 'info');
    }

    // Action Methods (Placeholders - implement based on your needs)
    async verifyUser(userId) {
        try {
            await db.collection('users').doc(userId).update({
                verified: true,
                verificationStatus: 'verified',
                verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.showNotification('User verified successfully', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to verify user: ' + error.message, 'error');
        }
    }

    async unverifyUser(userId) {
        try {
            await db.collection('users').doc(userId).update({
                verified: false,
                verificationStatus: 'unverified',
                verifiedAt: null
            });
            this.showNotification('User verification revoked', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to unverify user: ' + error.message, 'error');
        }
    }

    async promoteUser(userId) {
        try {
            await db.collection('users').doc(userId).update({
                role: 'admin'
            });
            this.showNotification('User promoted to admin', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to promote user: ' + error.message, 'error');
        }
    }

    async demoteUser(userId) {
        try {
            await db.collection('users').doc(userId).update({
                role: 'user'
            });
            this.showNotification('User demoted to regular user', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to demote user: ' + error.message, 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        
        try {
            await db.collection('users').doc(userId).delete();
            this.showNotification('User deleted successfully', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to delete user: ' + error.message, 'error');
        }
    }

    async approveDeposit(depositId) {
        try {
            await db.collection('deposits').doc(depositId).update({
                status: 'approved',
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: this.currentUser.uid
            });
            this.showNotification('Deposit approved successfully', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to approve deposit: ' + error.message, 'error');
        }
    }

    async rejectDeposit(depositId) {
        try {
            await db.collection('deposits').doc(depositId).update({
                status: 'rejected',
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: this.currentUser.uid
            });
            this.showNotification('Deposit rejected', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to reject deposit: ' + error.message, 'error');
        }
    }

    async approveWithdrawal(withdrawalId) {
        try {
            await db.collection('withdrawals').doc(withdrawalId).update({
                status: 'approved',
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: this.currentUser.uid
            });
            this.showNotification('Withdrawal approved successfully', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to approve withdrawal: ' + error.message, 'error');
        }
    }

    async rejectWithdrawal(withdrawalId) {
        try {
            await db.collection('withdrawals').doc(withdrawalId).update({
                status: 'rejected',
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: this.currentUser.uid
            });
            this.showNotification('Withdrawal rejected', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to reject withdrawal: ' + error.message, 'error');
        }
    }

    async viewTournament(tournamentId) {
        this.showNotification(`Viewing tournament: ${tournamentId}`, 'info');
        // Implement tournament view modal
    }

    async editTournamentModal(tournamentId) {
        this.showNotification(`Editing tournament: ${tournamentId}`, 'info');
        // Implement tournament edit modal
    }

    async manageMatches(tournamentId) {
        this.showNotification(`Managing matches for tournament: ${tournamentId}`, 'info');
        // Implement match management
    }

    async cancelTournament(tournamentId) {
        if (!confirm('Are you sure you want to cancel this tournament? This action cannot be undone.')) return;
        
        try {
            await db.collection('tournaments').doc(tournamentId).update({
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                cancelledBy: this.currentUser.uid
            });
            this.showNotification('Tournament cancelled successfully', 'success');
            await this.refreshData();
        } catch (error) {
            this.showNotification('Failed to cancel tournament: ' + error.message, 'error');
        }
    }

    async createUserModal() {
        this.showNotification('Create user functionality coming soon', 'info');
    }

    async createTournamentModal() {
        this.showNotification('Create tournament functionality coming soon', 'info');
    }

    async clearCache() {
        if (!confirm('Clear all cached data? This will force a fresh reload from the database.')) return;
        
        this.currentData = {
            users: [],
            tournaments: [],
            deposits: [],
            withdrawals: [],
            matches: [],
            adminLogs: []
        };
        this.showNotification('Cache cleared successfully', 'success');
        await this.refreshData();
    }

    async emergencyLogout() {
        if (!confirm('This will sign you out from all devices immediately. Continue?')) return;
        
        try {
            await auth.signOut();
            this.showNotification('Signed out from all sessions', 'success');
            window.location.href = 'login.html';
        } catch (error) {
            this.showNotification('Logout failed: ' + error.message, 'error');
        }
    }

    async toggleMaintenance() {
        this.showNotification('Maintenance mode toggle coming soon', 'info');
    }

    async exportLogs() {
        this.showNotification('Export functionality coming soon', 'info');
    }
}

// Initialize the admin dashboard
const admin = new AdminDashboard();

// Make admin globally available for onclick handlers
window.admin = admin;

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
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