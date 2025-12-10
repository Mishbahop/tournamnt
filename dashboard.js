
// TourneyHub Pro - Complete Dashboard Implementation
// ===============================================

// Firebase Configuration
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

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Global State
let currentUser = null;
let userData = null;
let tournaments = [];
let matches = [];
let transactions = [];
let notifications = [];

// Dashboard Class
class Dashboard {
    constructor() {
        this.isLoading = false;
        this.currentTab = 'tournaments';
        this.theme = 'dark';
        this.notificationInterval = null;
        this.realTimeListeners = [];
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Check authentication
            await this.checkAuth();
            
            // Setup all event listeners
            this.setupEventListeners();
            
            // Initialize UI components
            this.initializeUI();
            
            // Load user data
            await this.loadUserData();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup real-time listeners
            this.setupRealTimeListeners();
            
            // Start background updates
            this.startBackgroundUpdates();
            
            // Hide loading screen
            setTimeout(() => {
                this.hideLoadingScreen();
                this.showNotification('Welcome back, ' + (userData?.displayName || 'Gamer') + '!', 'success');
            }, 1000);
            
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showNotification('Failed to initialize dashboard', 'error');
            
            // Fallback to sample data
            this.loadSampleData();
            this.hideLoadingScreen();
        }
    }

    // =================== AUTHENTICATION ===================
    async checkAuth() {
        return new Promise((resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                try {
                    if (!user) {
                        console.log('No user authenticated, redirecting to login...');
                        window.location.href = 'login.html';
                        return;
                    }

                    currentUser = user;
                    console.log('User authenticated:', user.email);
                    
                    // Load user document
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    
                    if (!userDoc.exists) {
                        console.log('Creating new user document...');
                        await this.createUserDocument(user);
                    } else {
                        userData = { id: userDoc.id, ...userDoc.data() };
                    }
                    
                    unsubscribe();
                    resolve(userData);
                    
                } catch (error) {
                    console.error('Error in auth check:', error);
                    reject(error);
                }
            });
        });
    }

    async createUserDocument(user) {
        const userData = {
            email: user.email,
            displayName: user.displayName || 'Pro Gamer',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}&backgroundColor=6366f1`,
            role: 'user',
            balance: 0,
            xp: 0,
            level: 1,
            tournamentsPlayed: 0,
            tournamentsWon: 0,
            winRate: 0,
            streak: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            preferences: {
                theme: 'dark',
                notifications: true,
                emailUpdates: true
            },
            stats: {
                totalMatches: 0,
                totalWins: 0,
                totalEarnings: 0,
                favoriteGame: 'Valorant'
            }
        };

        await db.collection('users').doc(user.uid).set(userData);
        return userData;
    }

    // =================== EVENT LISTENERS ===================
    setupEventListeners() {
        // Mobile Menu Toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const closeMobileMenu = document.getElementById('closeMobileMenu');
        const mobileMenu = document.getElementById('mobileMenu');
        
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.remove('hidden');
                mobileMenu.classList.add('active');
            });
        }
        
        if (closeMobileMenu) {
            closeMobileMenu.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                mobileMenu.classList.add('hidden');
            });
        }

        // Close mobile menu on outside click
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                mobileMenu.classList.remove('active');
                mobileMenu.classList.add('hidden');
            }
        });

        // Tab Navigation
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Bottom Navigation
        const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('onclick');
                if (target && target.includes('switchTab')) {
                    const tabName = target.match(/switchTab\('(.+)'\)/)[1];
                    this.switchTab(tabName);
                }
            });
        });

        // Sign Out Button
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.signOut());
        }

        // Mobile Notifications
        const mobileNotifications = document.getElementById('mobileNotifications');
        if (mobileNotifications) {
            mobileNotifications.addEventListener('click', () => {
                this.showNotification('Notifications feature coming soon!', 'info');
            });
        }

        // FAB Button
        const fabButton = document.getElementById('fabButton');
        if (fabButton) {
            fabButton.addEventListener('click', () => {
                this.showQuickActions();
            });
        }

        // Notification Toast Close
        const toastClose = document.getElementById('toastClose');
        if (toastClose) {
            toastClose.addEventListener('click', () => {
                this.hideNotificationToast();
            });
        }

        // Quick Action Buttons
        const quickActionButtons = document.querySelectorAll('.action-card');
        quickActionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.querySelector('.action-text').textContent;
                this.handleQuickAction(action);
            });
        });

        // Profile Settings
        const profileSettings = document.getElementById('profileSettings');
        if (profileSettings) {
            profileSettings.addEventListener('click', () => {
                this.editProfile();
            });
        }

        // Tournament Refresh
        const refreshTournaments = document.querySelector('[onclick="refreshTournaments()"]');
        if (refreshTournaments) {
            refreshTournaments.addEventListener('click', () => this.refreshTournaments());
        }

        // Wallet Buttons
        const walletButtons = document.querySelectorAll('.wallet-action-btn');
        walletButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.querySelector('.action-text').textContent;
                this.handleWalletAction(action);
            });
        });

        // Profile Buttons
        const profileButtons = document.querySelectorAll('.profile-actions button');
        profileButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const text = e.currentTarget.textContent.trim();
                this.handleProfileAction(text);
            });
        });

        // Touch Feedback
        const touchElements = document.querySelectorAll('.touch-feedback');
        touchElements.forEach(element => {
            element.addEventListener('touchstart', () => {
                element.classList.add('active');
            });
            
            element.addEventListener('touchend', () => {
                setTimeout(() => {
                    element.classList.remove('active');
                }, 150);
            });
        });

        // Window resize handling
        window.addEventListener('resize', () => this.handleResize());
        
        // Before unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    // =================== UI INITIALIZATION ===================
    initializeUI() {
        // Set current year if needed
        const yearElements = document.querySelectorAll('.current-year');
        yearElements.forEach(el => {
            el.textContent = new Date().getFullYear();
        });

        // Initialize mobile detection
        this.initializeMobileDetection();

        // Initialize animations
        this.initializeAnimations();

        // Initialize tooltips
        this.initializeTooltips();

        // Initialize scroll behavior
        this.initializeScrollBehavior();
    }

    initializeMobileDetection() {
        const isMobile = window.innerWidth <= 768;
        
        // Show/hide mobile elements
        const mobileElements = document.querySelectorAll('.mobile-show, .mobile-hide');
        mobileElements.forEach(el => {
            if (el.classList.contains('mobile-show') && isMobile) {
                el.classList.remove('hidden');
            } else if (el.classList.contains('mobile-hide') && isMobile) {
                el.classList.add('hidden');
            }
        });

        // Update tab indicator position
        this.updateTabIndicator();
    }

    initializeAnimations() {
        // Add intersection observer for lazy loading
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        // Observe elements with animate class
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    // =================== DATA LOADING ===================
    async loadUserData() {
        try {
            if (!currentUser) return;

            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                userData = { id: userDoc.id, ...userDoc.data() };
                this.updateUserUI(userData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Error loading profile data', 'error');
        }
    }

    async loadInitialData() {
        try {
            // Load all data in parallel
            await Promise.all([
                this.loadTournaments(),
                this.loadMatches(),
                this.loadTransactions(),
                this.loadNotifications(),
                this.loadUserStats()
            ]);
            
            // Update dashboard stats
            this.updateDashboardStats();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading dashboard data', 'error');
            
            // Load sample data as fallback
            this.loadSampleData();
        }
    }

    async loadTournaments() {
        try {
            this.setLoadingState('tournamentsList', true);
            
            let query = db.collection('tournaments')
                .where('status', 'in', ['active', 'upcoming', 'registering'])
                .orderBy('startDate', 'asc')
                .limit(10);

            // If user is logged in, also get their registered tournaments
            if (currentUser) {
                const registeredQuery = db.collection('tournaments')
                    .where('participants', 'array-contains', currentUser.uid)
                    .orderBy('startDate', 'asc')
                    .limit(5);

                const [activeSnap, registeredSnap] = await Promise.all([
                    query.get(),
                    registeredQuery.get()
                ]);

                const activeTournaments = activeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const registeredTournaments = registeredSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Merge and deduplicate
                tournaments = [...activeTournaments, ...registeredTournaments].filter((v, i, a) => 
                    a.findIndex(t => t.id === v.id) === i
                );

            } else {
                const snapshot = await query.get();
                tournaments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            this.renderTournaments();
            this.setLoadingState('tournamentsList', false);

        } catch (error) {
            console.error('Error loading tournaments:', error);
            this.setLoadingState('tournamentsList', false);
            this.renderTournamentsError();
        }
    }

    async loadMatches() {
        try {
            this.setLoadingState('matchesList', true);

            if (!currentUser) {
                this.renderSampleMatches();
                return;
            }

            const snapshot = await db.collection('matches')
                .where('participants', 'array-contains', currentUser.uid)
                .orderBy('scheduledTime', 'desc')
                .limit(10)
                .get();

            matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderMatches();
            this.setLoadingState('matchesList', false);

        } catch (error) {
            console.error('Error loading matches:', error);
            this.setLoadingState('matchesList', false);
            this.renderSampleMatches();
        }
    }

    async loadTransactions() {
        try {
            this.setLoadingState('transactionsList', true);

            if (!currentUser) {
                this.renderSampleTransactions();
                return;
            }

            const snapshot = await db.collection('transactions')
                .where('userId', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderTransactions();
            this.setLoadingState('transactionsList', false);

        } catch (error) {
            console.error('Error loading transactions:', error);
            this.setLoadingState('transactionsList', false);
            this.renderSampleTransactions();
        }
    }

    async loadNotifications() {
        try {
            if (!currentUser) return;

            const snapshot = await db.collection('notifications')
                .where('userId', '==', currentUser.uid)
                .where('read', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.updateNotificationBadge(notifications.length);

        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async loadUserStats() {
        try {
            if (!currentUser) return;

            // Calculate stats from user's tournaments and matches
            const [tournamentsSnap, matchesSnap] = await Promise.all([
                db.collection('tournaments')
                    .where('participants', 'array-contains', currentUser.uid)
                    .get(),
                db.collection('matches')
                    .where('participants', 'array-contains', currentUser.uid)
                    .get()
            ]);

            const userTournaments = tournamentsSnap.docs.map(doc => doc.data());
            const userMatches = matchesSnap.docs.map(doc => doc.data());

            // Calculate statistics
            const stats = {
                tournamentsJoined: userTournaments.length,
                tournamentsWon: userTournaments.filter(t => t.winner === currentUser.uid).length,
                totalMatches: userMatches.length,
                matchesWon: userMatches.filter(m => m.winner === currentUser.uid).length,
                winRate: userMatches.length > 0 ? 
                    (userMatches.filter(m => m.winner === currentUser.uid).length / userMatches.length * 100).toFixed(1) : 0
            };

            // Update user document with calculated stats
            await db.collection('users').doc(currentUser.uid).update({
                stats: stats,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            userData.stats = stats;
            this.updateDashboardStats();

        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    // =================== UI UPDATES ===================
    updateUserUI(user) {
        // Update user info in header
        const userNameElements = document.querySelectorAll('#userName, #mobileUserName, #profileName');
        const userEmailElements = document.querySelectorAll('#userEmail, #mobileUserEmail, #profileEmail');
        const userAvatarElements = document.querySelectorAll('.user-avatar img, .user-avatar-sm img, .profile-avatar-large img');
        
        userNameElements.forEach(el => {
            el.textContent = user.displayName || 'Pro Gamer';
        });
        
        userEmailElements.forEach(el => {
            el.textContent = user.email || 'user@tourneyhub.com';
        });
        
        // Update avatars
        userAvatarElements.forEach(img => {
            img.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}&backgroundColor=6366f1`;
            img.alt = `${user.displayName}'s avatar`;
        });

        // Update profile badges
        const memberSince = document.getElementById('memberSince');
        if (memberSince && user.joinedAt) {
            const date = user.joinedAt.toDate ? user.joinedAt.toDate() : new Date(user.joinedAt);
            memberSince.textContent = `Since ${date.getFullYear()}`;
        }

        // Update level badge if exists
        const levelBadge = document.querySelector('.user-level-badge');
        if (levelBadge && user.level) {
            levelBadge.textContent = `LVL ${user.level}`;
        }
    }

    updateDashboardStats() {
        const stats = userData?.stats || {};
        
        // Update quick stats
        const xpElement = document.querySelector('.stat-chip:nth-child(1) .text-lg');
        if (xpElement && userData?.xp) {
            xpElement.textContent = userData.xp.toLocaleString();
        }

        const streakElement = document.querySelector('.stat-chip:nth-child(2) .text-lg');
        if (streakElement && userData?.streak) {
            streakElement.textContent = `${userData.streak} days`;
        }

        // Update main stats
        const tournamentsJoined = document.getElementById('tournamentsJoined');
        if (tournamentsJoined) {
            tournamentsJoined.textContent = stats.tournamentsJoined || 0;
        }

        const tournamentsWon = document.getElementById('tournamentsWon');
        if (tournamentsWon) {
            tournamentsWon.textContent = stats.tournamentsWon || 0;
        }

        const walletBalance = document.getElementById('walletBalance');
        if (walletBalance && userData?.balance !== undefined) {
            walletBalance.innerHTML = `<span class="text-gradient bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">₮${userData.balance.toLocaleString()}</span>`;
        }

        const winRate = document.getElementById('winRate');
        if (winRate) {
            winRate.innerHTML = `<span class="text-gradient bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">${stats.winRate || 0}%</span>`;
        }

        // Update profile stats
        const profileTournaments = document.getElementById('profileTournaments');
        const profileWins = document.getElementById('profileWins');
        const profileWinRate = document.getElementById('profileWinRate');
        
        if (profileTournaments) profileTournaments.textContent = stats.tournamentsJoined || 0;
        if (profileWins) profileWins.textContent = stats.tournamentsWon || 0;
        if (profileWinRate) profileWinRate.textContent = `${stats.winRate || 0}%`;
    }

    // =================== RENDERING FUNCTIONS ===================
    renderTournaments() {
        const container = document.getElementById('tournamentsList');
        if (!container) return;

        if (tournaments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <h3>No Tournaments Found</h3>
                    <p>Join your first tournament to get started!</p>
                    <a href="tournaments.html" class="btn btn-primary mt-4">
                        <i class="fas fa-search mr-2"></i>
                        Browse Tournaments
                    </a>
                </div>
            `;
            return;
        }

        const tournamentCards = tournaments.map(tournament => {
            const startDate = tournament.startDate?.toDate ? tournament.startDate.toDate() : new Date(tournament.startDate);
            const now = new Date();
            const hoursUntilStart = Math.max(0, Math.floor((startDate - now) / (1000 * 60 * 60)));
            
            let statusBadge = '';
            switch(tournament.status) {
                case 'active':
                    statusBadge = '<span class="badge bg-green-500/20 text-green-400 border-green-500/30">Live</span>';
                    break;
                case 'upcoming':
                    statusBadge = '<span class="badge bg-blue-500/20 text-blue-400 border-blue-500/30">Upcoming</span>';
                    break;
                case 'registering':
                    statusBadge = '<span class="badge bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Registering</span>';
                    break;
                default:
                    statusBadge = '<span class="badge bg-gray-500/20 text-gray-400 border-gray-500/30">Draft</span>';
            }

            return `
                <div class="tournament-card touch-feedback" data-tournament-id="${tournament.id}">
                    <div class="tournament-header">
                        <div class="tournament-game">
                            <i class="fas fa-gamepad mr-2"></i>
                            ${tournament.game || 'Unknown Game'}
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="tournament-body">
                        <h4 class="tournament-title">${tournament.title || 'Untitled Tournament'}</h4>
                        <p class="tournament-description">${tournament.description?.substring(0, 80) || 'No description available'}...</p>
                        
                        <div class="tournament-details">
                            <div class="detail">
                                <i class="fas fa-users"></i>
                                <span>${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</span>
                            </div>
                            <div class="detail">
                                <i class="fas fa-coins"></i>
                                <span>₮${tournament.prizePool?.toLocaleString() || 0}</span>
                            </div>
                            <div class="detail">
                                <i class="fas fa-clock"></i>
                                <span>${hoursUntilStart > 24 ? 
                                    Math.floor(hoursUntilStart / 24) + ' days' : 
                                    hoursUntilStart + ' hours'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tournament-footer">
                        <button class="btn btn-sm btn-outline" onclick="dashboard.viewTournament('${tournament.id}')">
                            View Details
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="dashboard.joinTournament('${tournament.id}')">
                            Join Now
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = tournamentCards;
    }

    renderMatches() {
        const container = document.getElementById('matchesList');
        if (!container) return;

        if (matches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-crosshairs"></i>
                    </div>
                    <h3>No Matches Scheduled</h3>
                    <p>Join tournaments to get matches scheduled!</p>
                </div>
            `;
            return;
        }

        const matchCards = matches.map(match => {
            const scheduledTime = match.scheduledTime?.toDate ? match.scheduledTime.toDate() : new Date(match.scheduledTime);
            const timeString = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateString = scheduledTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            let statusClass = '';
            let statusText = '';
            
            if (match.status === 'completed') {
                statusClass = 'text-green-400';
                statusText = 'Completed';
            } else if (match.status === 'live') {
                statusClass = 'text-red-400 animate-pulse';
                statusText = 'Live Now';
            } else {
                statusClass = 'text-blue-400';
                statusText = 'Upcoming';
            }

            return `
                <div class="match-card touch-feedback">
                    <div class="match-header">
                        <div class="match-time">
                            <i class="far fa-clock"></i>
                            <span>${timeString} • ${dateString}</span>
                        </div>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <div class="match-body">
                        <div class="match-teams">
                            <div class="team">
                                <div class="team-name">${match.team1 || 'Team A'}</div>
                                <div class="team-score ${match.winner === match.team1 ? 'winner' : ''}">${match.score1 || 0}</div>
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-name">${match.team2 || 'Team B'}</div>
                                <div class="team-score ${match.winner === match.team2 ? 'winner' : ''}">${match.score2 || 0}</div>
                            </div>
                        </div>
                        <div class="match-tournament">
                            <i class="fas fa-trophy"></i>
                            ${match.tournamentName || 'Tournament Match'}
                        </div>
                    </div>
                    <div class="match-footer">
                        <button class="btn btn-sm btn-outline" onclick="dashboard.viewMatchDetails('${match.id}')">
                            <i class="fas fa-eye"></i>
                            Details
                        </button>
                        ${match.status === 'live' ? `
                            <button class="btn btn-sm btn-danger" onclick="dashboard.joinMatch('${match.id}')">
                                <i class="fas fa-play"></i>
                                Join Now
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = matchCards;
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                    <h3>No Transactions Yet</h3>
                    <p>Your transaction history will appear here</p>
                </div>
            `;
            return;
        }

        const transactionItems = transactions.map(transaction => {
            const timestamp = transaction.timestamp?.toDate ? transaction.timestamp.toDate() : new Date(transaction.timestamp);
            const timeAgo = this.getTimeAgo(timestamp);
            
            let amountClass = '';
            let amountPrefix = '';
            
            if (transaction.type === 'deposit' || transaction.type === 'winning') {
                amountClass = 'text-green-400';
                amountPrefix = '+';
            } else if (transaction.type === 'withdrawal' || transaction.type === 'entry_fee') {
                amountClass = 'text-red-400';
                amountPrefix = '-';
            }

            return `
                <div class="transaction-item">
                    <div class="transaction-icon">
                        <i class="fas fa-${this.getTransactionIcon(transaction.type)}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">${transaction.description || 'Transaction'}</div>
                        <div class="transaction-meta">
                            <span class="transaction-time">${timeAgo}</span>
                            <span class="transaction-id">#${transaction.id?.substring(0, 8) || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}₮${transaction.amount?.toLocaleString() || 0}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = transactionItems;
    }

    // =================== SAMPLE DATA (Fallback) ===================
    loadSampleData() {
        // Sample tournaments
        tournaments = [
            {
                id: '1',
                title: 'Valorant Championship',
                game: 'Valorant',
                status: 'active',
                prizePool: 5000,
                currentPlayers: 32,
                maxPlayers: 64,
                description: 'Monthly Valorant championship with cash prizes',
                startDate: new Date(Date.now() + 3600000) // 1 hour from now
            },
            {
                id: '2',
                title: 'CS:GO Open Tournament',
                game: 'CS:GO',
                status: 'registering',
                prizePool: 2500,
                currentPlayers: 16,
                maxPlayers: 32,
                description: 'Open CS:GO tournament for all skill levels',
                startDate: new Date(Date.now() + 86400000) // 1 day from now
            }
        ];

        // Sample matches
        matches = [
            {
                id: '1',
                team1: 'Team Alpha',
                team2: 'Team Beta',
                score1: 13,
                score2: 9,
                winner: 'Team Alpha',
                status: 'completed',
                scheduledTime: new Date(Date.now() - 86400000), // 1 day ago
                tournamentName: 'Weekly Showdown'
            },
            {
                id: '2',
                team1: 'Your Team',
                team2: 'Team Gamma',
                score1: 0,
                score2: 0,
                status: 'upcoming',
                scheduledTime: new Date(Date.now() + 7200000), // 2 hours from now
                tournamentName: 'Daily Challenge'
            }
        ];

        // Sample transactions
        transactions = [
            {
                id: 'txn_001',
                type: 'deposit',
                amount: 100,
                description: 'Wallet Top-up',
                timestamp: new Date(Date.now() - 172800000), // 2 days ago
                status: 'completed'
            },
            {
                id: 'txn_002',
                type: 'entry_fee',
                amount: 20,
                description: 'Tournament Entry Fee',
                timestamp: new Date(Date.now() - 86400000), // 1 day ago
                status: 'completed'
            },
            {
                id: 'txn_003',
                type: 'winning',
                amount: 250,
                description: 'Tournament Winnings',
                timestamp: new Date(Date.now() - 43200000), // 12 hours ago
                status: 'completed'
            }
        ];

        // Render sample data
        this.renderTournaments();
        this.renderMatches();
        this.renderTransactions();
    }

    renderSampleMatches() {
        const container = document.getElementById('matchesList');
        if (!container) return;

        container.innerHTML = `
            <div class="match-card touch-feedback">
                <div class="match-header">
                    <div class="match-time">
                        <i class="far fa-clock"></i>
                        <span>14:30 • Today</span>
                    </div>
                    <span class="text-blue-400">Upcoming</span>
                </div>
                <div class="match-body">
                    <div class="match-teams">
                        <div class="team">
                            <div class="team-name">Team Alpha</div>
                            <div class="team-score">-</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="team">
                            <div class="team-name">Team Beta</div>
                            <div class="team-score">-</div>
                        </div>
                    </div>
                    <div class="match-tournament">
                        <i class="fas fa-trophy"></i>
                        Daily Challenge
                    </div>
                </div>
                <div class="match-footer">
                    <button class="btn btn-sm btn-outline">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                </div>
            </div>
            
            <div class="match-card touch-feedback">
                <div class="match-header">
                    <div class="match-time">
                        <i class="far fa-clock"></i>
                        <span>19:00 • Tomorrow</span>
                    </div>
                    <span class="text-blue-400">Upcoming</span>
                </div>
                <div class="match-body">
                    <div class="match-teams">
                        <div class="team">
                            <div class="team-name">Your Team</div>
                            <div class="team-score">-</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="team">
                            <div class="team-name">Pro Gamers</div>
                            <div class="team-score">-</div>
                        </div>
                    </div>
                    <div class="match-tournament">
                        <i class="fas fa-trophy"></i>
                        Weekly Championship
                    </div>
                </div>
                <div class="match-footer">
                    <button class="btn btn-sm btn-outline">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                </div>
            </div>
        `;
    }

    renderSampleTransactions() {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        container.innerHTML = `
            <div class="transaction-item">
                <div class="transaction-icon">
                    <i class="fas fa-arrow-down text-green-500"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">Wallet Top-up</div>
                    <div class="transaction-meta">
                        <span class="transaction-time">2 hours ago</span>
                        <span class="transaction-id">#DEP001</span>
                    </div>
                </div>
                <div class="transaction-amount text-green-400">
                    +₮100
                </div>
            </div>
            
            <div class="transaction-item">
                <div class="transaction-icon">
                    <i class="fas fa-trophy text-yellow-500"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">Tournament Winnings</div>
                    <div class="transaction-meta">
                        <span class="transaction-time">1 day ago</span>
                        <span class="transaction-id">#WIN023</span>
                    </div>
                </div>
                <div class="transaction-amount text-green-400">
                    +₮250
                </div>
            </div>
            
            <div class="transaction-item">
                <div class="transaction-icon">
                    <i class="fas fa-ticket-alt text-red-500"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">Entry Fee</div>
                    <div class="transaction-meta">
                        <span class="transaction-time">2 days ago</span>
                        <span class="transaction-id">#ENT456</span>
                    </div>
                </div>
                <div class="transaction-amount text-red-400">
                    -₮20
                </div>
            </div>
        `;
    }

    renderTournamentsError() {
        const container = document.getElementById('tournamentsList');
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Failed to Load Tournaments</h3>
                <p>Please check your connection and try again</p>
                <button class="btn btn-primary mt-4" onclick="dashboard.refreshTournaments()">
                    <i class="fas fa-sync-alt mr-2"></i>
                    Try Again
                </button>
            </div>
        `;
    }

    // =================== TAB MANAGEMENT ===================
    switchTab(tabName) {
        if (this.isLoading) return;
        
        this.currentTab = tabName;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            }
        });

        // Update mobile tab indicator
        this.updateTabIndicator();

        // Show/hide tab panels
        const panels = document.querySelectorAll('.tab-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
            panel.hidden = true;
            if (panel.id === `${tabName}-panel`) {
                panel.classList.add('active');
                panel.hidden = false;
            }
        });

        // Update bottom nav
        const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
        bottomNavItems.forEach(item => {
            item.classList.remove('active');
            const text = item.querySelector('.nav-text').textContent;
            if ((tabName === 'profile' && text === 'Profile') ||
                (tabName === 'tournaments' && text === 'Tourneys')) {
                item.classList.add('active');
            }
        });

        // Load tab-specific data if needed
        switch(tabName) {
            case 'tournaments':
                if (tournaments.length === 0) {
                    this.loadTournaments();
                }
                break;
            case 'matches':
                if (matches.length === 0) {
                    this.loadMatches();
                }
                break;
            case 'wallet':
                if (transactions.length === 0) {
                    this.loadTransactions();
                }
                break;
            case 'profile':
                // Profile is already loaded
                break;
        }

        // Update URL without page reload
        history.replaceState(null, '', `#${tabName}`);
    }

    updateTabIndicator() {
        const indicator = document.getElementById('mobileTabIndicator');
        if (!indicator) return;

        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const rect = activeTab.getBoundingClientRect();
            const parentRect = activeTab.parentElement.getBoundingClientRect();
            
            indicator.style.width = `${rect.width}px`;
            indicator.style.transform = `translateX(${rect.left - parentRect.left}px)`;
            indicator.style.opacity = '1';
        }
    }

    // =================== ACTION HANDLERS ===================
    async handleQuickAction(action) {
        switch(action) {
            case 'Find Tourneys':
                window.location.href = 'tournaments.html';
                break;
            case 'Add Funds':
                this.showDepositModal();
                break;
            case 'Host Event':
                if (userData?.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    this.showNotification('Admin privileges required to host events', 'warning');
                }
                break;
            case 'Settings':
                this.editProfile();
                break;
        }
    }

    async handleWalletAction(action) {
        switch(action) {
            case 'Instant':
                this.showDepositModal();
                break;
            case 'Rewards':
                this.checkRewards();
                break;
            case 'History':
                this.switchTab('wallet');
                break;
            case 'Settings':
                window.location.href = 'settings.html?tab=wallet';
                break;
        }
    }

    async handleProfileAction(action) {
        switch(action.trim()) {
            case 'Edit Profile':
                this.editProfile();
                break;
            case 'Verify Email':
                this.verifyEmail();
                break;
            case 'Security':
                this.openSecurity();
                break;
            case 'Settings':
                this.openSettings();
                break;
        }
    }

    // =================== MODAL & NOTIFICATION FUNCTIONS ===================
    showDepositModal() {
        const modalHTML = `
            <div class="modal-overlay active" id="depositModal">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add Funds to Wallet</h3>
                        <button class="modal-close" onclick="dashboard.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="deposit-options">
                            <div class="amount-options">
                                <button class="amount-option" data-amount="100">₮100</button>
                                <button class="amount-option" data-amount="250">₮250</button>
                                <button class="amount-option" data-amount="500">₮500</button>
                                <button class="amount-option" data-amount="1000">₮1000</button>
                                <button class="amount-option" data-amount="2000">₮2000</button>
                                <button class="amount-option" data-amount="5000">₮5000</button>
                            </div>
                            <div class="custom-amount mt-4">
                                <label for="customAmount">Or enter custom amount:</label>
                                <input type="number" id="customAmount" placeholder="Enter amount" min="10" max="10000">
                            </div>
                            <div class="payment-methods mt-6">
                                <h4>Payment Method</h4>
                                <div class="method-options">
                                    <label class="method-option active">
                                        <input type="radio" name="paymentMethod" value="upi" checked>
                                        <i class="fab fa-google-pay"></i>
                                        <span>UPI / Google Pay</span>
                                    </label>
                                    <label class="method-option">
                                        <input type="radio" name="paymentMethod" value="card">
                                        <i class="fas fa-credit-card"></i>
                                        <span>Credit/Debit Card</span>
                                    </label>
                                    <label class="method-option">
                                        <input type="radio" name="paymentMethod" value="netbanking">
                                        <i class="fas fa-university"></i>
                                        <span>Net Banking</span>
                                    </label>
                                    <label class="method-option">
                                        <input type="radio" name="paymentMethod" value="paytm">
                                        <i class="fab fa-paypal"></i>
                                        <span>Paytm Wallet</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="dashboard.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="dashboard.processDeposit()">Deposit Now</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners to amount options
        document.querySelectorAll('.amount-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.amount-option').forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');
                document.getElementById('customAmount').value = e.currentTarget.dataset.amount;
            });
        });
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay.active');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastIcon || !toastMessage) return;
        
        // Set icon based on type
        let icon = 'ℹ️';
        switch(type) {
            case 'success': icon = '✅'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
        }
        
        toastIcon.textContent = icon;
        toastMessage.textContent = message;
        
        // Show toast
        toast.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotificationToast();
        }, 5000);
    }

    hideNotificationToast() {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    showQuickActions() {
        const actions = [
            { icon: 'fa-plus', text: 'Create Team', action: 'createTeam' },
            { icon: 'fa-search', text: 'Find Match', action: 'findMatch' },
            { icon: 'fa-bell', text: 'Notifications', action: 'notifications' },
            { icon: 'fa-qrcode', text: 'Scan QR', action: 'scanQR' }
        ];

        const fabMenu = document.createElement('div');
        fabMenu.className = 'fab-menu';
        fabMenu.innerHTML = actions.map(action => `
            <div class="fab-menu-item" onclick="dashboard.handleFabAction('${action.action}')">
                <i class="fas ${action.icon}"></i>
                <span>${action.text}</span>
            </div>
        `).join('');

        document.body.appendChild(fabMenu);
        
        // Remove on outside click
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.fab-menu') && !e.target.closest('.fab-button')) {
                    fabMenu.remove();
                }
            });
        }, 100);
    }

    handleFabAction(action) {
        switch(action) {
            case 'createTeam':
                this.showNotification('Team creation feature coming soon!', 'info');
                break;
            case 'findMatch':
                this.switchTab('tournaments');
                break;
            case 'notifications':
                this.showNotification('You have ' + (notifications.length || 0) + ' unread notifications', 'info');
                break;
            case 'scanQR':
                this.showNotification('QR scanner feature coming soon!', 'info');
                break;
        }
        
        // Remove fab menu
        const fabMenu = document.querySelector('.fab-menu');
        if (fabMenu) fabMenu.remove();
    }

    // =================== TOURNAMENT FUNCTIONS ===================
    async joinTournament(tournamentId) {
        try {
            if (!currentUser) {
                this.showNotification('Please login to join tournaments', 'error');
                return;
            }

            // Check if user has enough balance
            const tournament = tournaments.find(t => t.id === tournamentId);
            if (tournament?.entryFee > (userData?.balance || 0)) {
                this.showNotification('Insufficient balance. Please add funds.', 'error');
                this.showDepositModal();
                return;
            }

            // Add user to tournament participants
            await db.collection('tournaments').doc(tournamentId).update({
                participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                currentPlayers: firebase.firestore.FieldValue.increment(1)
            });

            // Deduct entry fee from user balance
            if (tournament.entryFee > 0) {
                await db.collection('users').doc(currentUser.uid).update({
                    balance: firebase.firestore.FieldValue.increment(-tournament.entryFee)
                });

                // Record transaction
                await db.collection('transactions').add({
                    userId: currentUser.uid,
                    type: 'entry_fee',
                    amount: tournament.entryFee,
                    description: `Entry fee for ${tournament.title}`,
                    tournamentId: tournamentId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'completed'
                });
            }

            this.showNotification('Successfully joined tournament!', 'success');
            
            // Refresh tournaments list
            await this.loadTournaments();
            
            // Update user stats
            await this.loadUserStats();

        } catch (error) {
            console.error('Error joining tournament:', error);
            this.showNotification('Failed to join tournament', 'error');
        }
    }

    viewTournament(tournamentId) {
        window.location.href = `tournament-details.html?id=${tournamentId}`;
    }

    refreshTournaments() {
        this.showNotification('Refreshing tournaments...', 'info');
        this.loadTournaments();
    }

    // =================== MATCH FUNCTIONS ===================
    viewMatchDetails(matchId) {
        this.showNotification('Match details feature coming soon!', 'info');
    }

    joinMatch(matchId) {
        this.showNotification('Joining match...', 'info');
        // Implement actual match joining logic
    }

    // =================== WALLET FUNCTIONS ===================
    async processDeposit() {
        try {
            const customAmountInput = document.getElementById('customAmount');
            const amount = parseFloat(customAmountInput?.value) || 0;
            
            if (amount < 10) {
                this.showNotification('Minimum deposit amount is ₮10', 'error');
                return;
            }

            if (amount > 10000) {
                this.showNotification('Maximum deposit amount is ₮10,000', 'error');
                return;
            }

            // Create deposit record
            const depositRef = await db.collection('deposits').add({
                userId: currentUser.uid,
                amount: amount,
                status: 'pending',
                method: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'upi',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // In a real app, this would redirect to payment gateway
            // For demo, simulate successful payment after 2 seconds
            this.showNotification('Processing payment...', 'info');
            
            setTimeout(async () => {
                try {
                    // Update deposit status
                    await db.collection('deposits').doc(depositRef.id).update({
                        status: 'approved',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // Update user balance
                    await db.collection('users').doc(currentUser.uid).update({
                        balance: firebase.firestore.FieldValue.increment(amount)
                    });

                    // Record transaction
                    await db.collection('transactions').add({
                        userId: currentUser.uid,
                        type: 'deposit',
                        amount: amount,
                        description: 'Wallet Deposit',
                        referenceId: depositRef.id,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'completed'
                    });

                    this.closeModal();
                    this.showNotification(`Successfully deposited ₮${amount}`, 'success');
                    
                    // Refresh wallet data
                    await Promise.all([
                        this.loadUserData(),
                        this.loadTransactions()
                    ]);

                } catch (error) {
                    console.error('Error processing deposit:', error);
                    this.showNotification('Error processing deposit', 'error');
                }
            }, 2000);

        } catch (error) {
            console.error('Error initiating deposit:', error);
            this.showNotification('Error initiating deposit', 'error');
        }
    }

    checkRewards() {
        this.showNotification('Checking for available rewards...', 'info');
        // Implement rewards check logic
    }

    viewAllTransactions() {
        window.location.href = 'wallet.html?tab=history';
    }

    // =================== PROFILE FUNCTIONS ===================
    editProfile() {
        window.location.href = 'profile.html';
    }

    async verifyEmail() {
        try {
            await currentUser.sendEmailVerification();
            this.showNotification('Verification email sent! Please check your inbox.', 'success');
        } catch (error) {
            console.error('Error sending verification email:', error);
            this.showNotification('Error sending verification email', 'error');
        }
    }

    openSecurity() {
        window.location.href = 'settings.html?tab=security';
    }

    openSettings() {
        window.location.href = 'settings.html';
    }

    changeAvatar() {
        this.showNotification('Avatar change feature coming soon!', 'info');
    }

    // =================== REAL-TIME UPDATES ===================
    setupRealTimeListeners() {
        if (!currentUser) return;

        // User data listener
        const userListener = db.collection('users').doc(currentUser.uid)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    userData = { id: doc.id, ...doc.data() };
                    this.updateUserUI(userData);
                    this.updateDashboardStats();
                }
            });

        // Tournament updates listener
        const tournamentListener = db.collection('tournaments')
            .where('status', 'in', ['active', 'upcoming', 'registering'])
            .onSnapshot((snapshot) => {
                if (this.currentTab === 'tournaments') {
                    this.loadTournaments();
                }
            });

        // Match updates listener
        const matchListener = db.collection('matches')
            .where('participants', 'array-contains', currentUser.uid)
            .onSnapshot((snapshot) => {
                if (this.currentTab === 'matches') {
                    this.loadMatches();
                }
            });

        // Notification listener
        const notificationListener = db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .onSnapshot((snapshot) => {
                notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.updateNotificationBadge(notifications.length);
            });

        // Store listeners for cleanup
        this.realTimeListeners = [userListener, tournamentListener, matchListener, notificationListener];
    }

    startBackgroundUpdates() {
        // Update last active every minute
        this.notificationInterval = setInterval(() => {
            if (currentUser) {
                db.collection('users').doc(currentUser.uid).update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }, 60000);
    }

    // =================== UTILITY FUNCTIONS ===================
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContent = document.getElementById('mainContent');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            
            // Simulate loading progress
            const progressBar = document.getElementById('loadingProgress');
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 90) {
                    clearInterval(interval);
                    progressBar.style.width = '100%';
                } else {
                    progressBar.style.width = `${progress}%`;
                }
            }, 200);
        }
        
        if (mainContent) {
            mainContent.classList.add('critical-hidden');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContent = document.getElementById('mainContent');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (mainContent) {
            mainContent.classList.remove('critical-hidden');
        }
    }

    setLoadingState(elementId, loading) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (loading) {
            element.classList.add('loading');
        } else {
            element.classList.remove('loading');
        }
    }

    updateNotificationBadge(count) {
        const badge = document.querySelector('#mobileNotifications .absolute:not(.animate-ping)');
        if (badge) {
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return 'just now';
    }

    getTransactionIcon(type) {
        const icons = {
            deposit: 'arrow-down',
            withdrawal: 'arrow-up',
            winning: 'trophy',
            entry_fee: 'ticket-alt',
            refund: 'undo',
            bonus: 'gift'
        };
        return icons[type] || 'exchange-alt';
    }

    handleResize() {
        this.initializeMobileDetection();
    }

    handleKeyboardShortcuts(e) {
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key.toLowerCase()) {
            case '1':
                this.switchTab('tournaments');
                break;
            case '2':
                this.switchTab('matches');
                break;
            case '3':
                this.switchTab('wallet');
                break;
            case '4':
                this.switchTab('profile');
                break;
            case 'r':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.refreshTournaments();
                }
                break;
            case 'f':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const searchInput = document.getElementById('globalSearch');
                    if (searchInput) searchInput.focus();
                }
                break;
            case 'escape':
                this.closeModal();
                this.hideNotificationToast();
                break;
        }
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

    cleanup() {
        // Clear intervals
        if (this.notificationInterval) {
            clearInterval(this.notificationInterval);
        }

        // Unsubscribe from real-time listeners
        this.realTimeListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });

        // Update last active before leaving
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).update({
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});

// Make dashboard available globally for inline event handlers
window.dashboard = dashboard;

// Helper functions for inline event handlers
window.switchTab = (tabName) => {
    if (dashboard) dashboard.switchTab(tabName);
};

window.refreshTournaments = () => {
    if (dashboard) dashboard.refreshTournaments();
};

window.signOut = () => {
    if (dashboard) dashboard.signOut();
};

window.viewAllTransactions = () => {
    if (dashboard) dashboard.viewAllTransactions();
};
