
// ADVANCED DASHBOARD JS - GAMING TOURNAMENT PLATFORM
// Features:
// - Firebase Auth + Firestore Integration
// - Real-time Data Updates
// - Touch/Swipe Gestures
// - Performance Optimized
// - Offline Support
// - Error Handling
// ============================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
  authDomain: "authapp-386ee.firebaseapp.com",
  projectId: "authapp-386ee",
  storageBucket: "authapp-386ee.firebasestorage.app",
  messagingSenderId: "809698525310",
  appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
  measurementId: "G-EJZTSBSGQT"
};

// Initialize Firebase
let auth, db;
try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  
  // Enable offline persistence
  db.enablePersistence()
    .catch((err) => {
      console.warn("Offline persistence failed:", err.code);
    });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// ============================================
// GLOBAL STATE & CONFIGURATION
// ============================================
const AppState = {
  currentUser: null,
  userData: {},
  tournaments: [],
  matches: [],
  transactions: [],
  walletBalance: 0,
  isLoading: true,
  activeTab: 'tournaments',
  isMobile: window.innerWidth <= 768,
  isOnline: navigator.onLine,
  pendingUpdates: [],
  config: {
    autoRefreshInterval: 30000, // 30 seconds
    maxRetries: 3,
    cacheDuration: 5 * 60 * 1000, // 5 minutes
  }
};

// DOM Elements Cache
const DOM = {
  // Loading Elements
  loadingScreen: document.getElementById('loadingScreen'),
  loadingProgress: document.getElementById('loadingProgress'),
  mainContent: document.getElementById('mainContent'),
  
  // Header Elements
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  signOutBtn: document.getElementById('signOutBtn'),
  
  // Stats Elements
  tournamentsJoined: document.getElementById('tournamentsJoined'),
  tournamentsWon: document.getElementById('tournamentsWon'),
  walletBalance: document.getElementById('walletBalance'),
  winRate: document.getElementById('winRate'),
  detailedBalance: document.getElementById('detailedBalance'),
  
  // Tab Elements
  tabList: document.getElementById('tabList'),
  tabs: document.querySelectorAll('.tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  mobileTabIndicator: document.getElementById('mobileTabIndicator'),
  
  // Content Containers
  tournamentsList: document.getElementById('tournamentsList'),
  matchesList: document.getElementById('matchesList'),
  transactionsList: document.getElementById('transactionsList'),
  profileContent: document.getElementById('profileContent'),
  
  // Mobile Menu Elements
  mobileMenuToggle: document.getElementById('mobileMenuToggle'),
  mobileMenu: document.getElementById('mobileMenu'),
  closeMobileMenu: document.getElementById('closeMobileMenu'),
  
  // Notification Elements
  notificationToast: document.getElementById('notificationToast'),
  toastIcon: document.getElementById('toastIcon'),
  toastMessage: document.getElementById('toastMessage'),
  toastClose: document.getElementById('toastClose'),
  
  // Other Elements
  profileSettings: document.getElementById('profileSettings'),
  verifiedBadge: document.getElementById('verifiedBadge'),
  memberSince: document.getElementById('memberSince'),
  profileTournaments: document.getElementById('profileTournaments'),
  profileWins: document.getElementById('profileWins'),
  profileWinRate: document.getElementById('profileWinRate'),
  
  // Buttons
  refreshTournamentsBtn: document.querySelector('[onclick="refreshTournaments()"]'),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Show loading state with progress
 */
function showLoading(progress = 0) {
  if (DOM.loadingProgress) {
    DOM.loadingProgress.style.width = `${progress}%`;
  }
  
  if (progress >= 100) {
    setTimeout(() => {
      if (DOM.loadingScreen) {
        DOM.loadingScreen.classList.add('hidden');
      }
      if (DOM.mainContent) {
        DOM.mainContent.style.opacity = '1';
      }
    }, 500);
  }
}

/**
 * Show notification toast
 */
function showToast(message, type = 'info', duration = 5000) {
  if (!DOM.notificationToast) return;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  DOM.toastIcon.textContent = icons[type] || icons.info;
  DOM.toastMessage.textContent = message;
  DOM.notificationToast.className = `notification-toast show ${type}`;
  
  setTimeout(() => {
    hideToast();
  }, duration);
}

/**
 * Hide notification toast
 */
function hideToast() {
  if (DOM.notificationToast) {
    DOM.notificationToast.classList.remove('show');
  }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('₹', '₮');
}

/**
 * Format date
 */
function formatDate(date) {
  if (!date) return 'N/A';
  
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diff = now - d;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Show date
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Debounce function for performance
 */
function debounce(func, wait) {
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

/**
 * Throttle function for scroll/resize events
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Check if user is online
 */
function checkOnlineStatus() {
  AppState.isOnline = navigator.onLine;
  
  if (AppState.isOnline && AppState.pendingUpdates.length > 0) {
    showToast('Syncing pending updates...', 'info');
    processPendingUpdates();
  }
  
  showToast(
    AppState.isOnline ? 'You are back online!' : 'You are offline',
    AppState.isOnline ? 'success' : 'warning',
    3000
  );
}

/**
 * Process pending updates when online
 */
async function processPendingUpdates() {
  for (const update of AppState.pendingUpdates) {
    try {
      await update();
      showToast('Update synced successfully', 'success');
    } catch (error) {
      console.error('Failed to sync update:', error);
    }
  }
  AppState.pendingUpdates = [];
}

// ============================================
// FIREBASE OPERATIONS
// ============================================

/**
 * Initialize authentication
 */
async function initAuth() {
  try {
    // Check auth state
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Redirect to login
        window.location.href = 'login.html';
        return;
      }
      
      AppState.currentUser = user;
      await loadUserData();
      
      // Initialize app
      initApp();
    });
    
  } catch (error) {
    console.error('Auth initialization failed:', error);
    showToast('Authentication failed. Please try again.', 'error');
  }
}

/**
 * Load user data from Firestore
 */
async function loadUserData() {
  try {
    if (!AppState.currentUser || !db) return;
    
    const userDoc = await db.collection('users').doc(AppState.currentUser.uid).get();
    
    if (userDoc.exists) {
      AppState.userData = userDoc.data();
      
      // Update DOM with user data
      updateUserProfile();
      
      // Load additional data in parallel
      await Promise.all([
        loadWalletData(),
        loadTournaments(),
        loadMatches(),
        loadTransactions()
      ]);
      
      // Update stats
      updateStats();
      
    } else {
      // Create new user document
      await db.collection('users').doc(AppState.currentUser.uid).set({
        uid: AppState.currentUser.uid,
        email: AppState.currentUser.email,
        displayName: AppState.currentUser.displayName || AppState.currentUser.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        stats: {
          tournamentsJoined: 0,
          tournamentsWon: 0,
          walletBalance: 0,
          winRate: 0
        },
        profile: {
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${AppState.currentUser.uid}`,
          level: 1,
          xp: 0,
          streak: 0
        }
      });
      
      AppState.userData = {
        displayName: AppState.currentUser.displayName || AppState.currentUser.email.split('@')[0],
        email: AppState.currentUser.email
      };
      
      updateUserProfile();
    }
    
  } catch (error) {
    console.error('Error loading user data:', error);
    showToast('Failed to load user data', 'error');
    
    // Fallback to mock data for demo
    loadMockData();
  }
}

/**
 * Load wallet data
 */
async function loadWalletData() {
  try {
    if (!AppState.currentUser || !db) {
      AppState.walletBalance = 1240;
      return;
    }
    
    const walletRef = db.collection('wallets').doc(AppState.currentUser.uid);
    const walletDoc = await walletRef.get();
    
    if (walletDoc.exists) {
      const walletData = walletDoc.data();
      AppState.walletBalance = walletData.balance || 0;
    } else {
      // Create wallet
      await walletRef.set({
        balance: 0,
        currency: 'INR',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      AppState.walletBalance = 0;
    }
    
    // Update DOM
    if (DOM.walletBalance) {
      DOM.walletBalance.innerHTML = `<span class="text-gradient bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">₮${AppState.walletBalance}</span>`;
    }
    if (DOM.detailedBalance) {
      DOM.detailedBalance.innerHTML = `<span class="text-gradient bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">₮${AppState.walletBalance.toLocaleString('en-IN')}</span>`;
    }
    
  } catch (error) {
    console.error('Error loading wallet:', error);
    showToast('Failed to load wallet data', 'warning');
    
    // Fallback
    AppState.walletBalance = 1240;
  }
}

/**
 * Load tournaments
 */
async function loadTournaments() {
  try {
    if (!AppState.currentUser || !db) {
      // Mock data for demo
      AppState.tournaments = getMockTournaments();
      renderTournaments();
      return;
    }
    
    // Get user's tournament IDs
    const userTournamentsRef = db.collection('userTournaments').doc(AppState.currentUser.uid);
    const userTournamentsDoc = await userTournamentsRef.get();
    
    if (userTournamentsDoc.exists && userTournamentsDoc.data().tournamentIds) {
      const tournamentIds = userTournamentsDoc.data().tournamentIds;
      
      if (tournamentIds.length > 0) {
        // Get tournament details
        const tournamentsSnapshot = await db.collection('tournaments')
          .where(firebase.firestore.FieldPath.documentId(), 'in', tournamentIds.slice(0, 10))
          .get();
        
        AppState.tournaments = tournamentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } else {
        AppState.tournaments = [];
      }
    } else {
      AppState.tournaments = [];
    }
    
    renderTournaments();
    
  } catch (error) {
    console.error('Error loading tournaments:', error);
    showToast('Failed to load tournaments', 'warning');
    
    // Fallback to mock data
    AppState.tournaments = getMockTournaments();
    renderTournaments();
  }
}

/**
 * Load matches
 */
async function loadMatches() {
  try {
    if (!AppState.currentUser || !db) {
      // Mock data for demo
      AppState.matches = getMockMatches();
      renderMatches();
      return;
    }
    
    const matchesSnapshot = await db.collection('matches')
      .where('userId', '==', AppState.currentUser.uid)
      .where('status', 'in', ['upcoming', 'completed'])
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    
    AppState.matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderMatches();
    
  } catch (error) {
    console.error('Error loading matches:', error);
    
    // Fallback to mock data
    AppState.matches = getMockMatches();
    renderMatches();
  }
}

/**
 * Load transactions
 */
async function loadTransactions() {
  try {
    if (!AppState.currentUser || !db) {
      // Mock data for demo
      AppState.transactions = getMockTransactions();
      renderTransactions();
      return;
    }
    
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('userId', '==', AppState.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),
      db.collection('withdrawals')
        .where('userId', '==', AppState.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
    ]);
    
    const transactions = [];
    
    depositsSnapshot.forEach(doc => {
      transactions.push({
        type: 'deposit',
        id: doc.id,
        ...doc.data()
      });
    });
    
    withdrawalsSnapshot.forEach(doc => {
      transactions.push({
        type: 'withdrawal',
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort by date
    AppState.transactions = transactions.sort((a, b) => {
      const dateA = a.createdAt?.toDate() || new Date(0);
      const dateB = b.createdAt?.toDate() || new Date(0);
      return dateB - dateA;
    }).slice(0, 5);
    
    renderTransactions();
    
  } catch (error) {
    console.error('Error loading transactions:', error);
    
    // Fallback to mock data
    AppState.transactions = getMockTransactions();
    renderTransactions();
  }
}

/**
 * Sign out user
 */
async function signOut() {
  try {
    await auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Sign out error:', error);
    showToast('Failed to sign out', 'error');
  }
}

// ============================================
// DOM RENDER FUNCTIONS
// ============================================

/**
 * Update user profile in DOM
 */
function updateUserProfile() {
  const user = AppState.currentUser;
  const userData = AppState.userData;
  
  if (!user) return;
  
  // Basic info
  const displayName = userData.displayName || user.email?.split('@')[0] || 'Gamer';
  const email = user.email || 'user@example.com';
  
  if (DOM.userName) DOM.userName.textContent = displayName;
  if (DOM.userEmail) DOM.userEmail.textContent = email;
  if (DOM.profileName) DOM.profileName.textContent = displayName;
  if (DOM.profileEmail) DOM.profileEmail.textContent = email;
  
  // Verified badge
  if (DOM.verifiedBadge) {
    if (user.emailVerified) {
      DOM.verifiedBadge.innerHTML = '<i class="fas fa-check mr-1"></i>Verified';
      DOM.verifiedBadge.className = 'badge verified bg-green-500/20 text-green-400 border-green-500/30';
    } else {
      DOM.verifiedBadge.innerHTML = '<i class="fas fa-times mr-1"></i>Unverified';
      DOM.verifiedBadge.className = 'badge bg-red-500/20 text-red-400 border-red-500/30';
    }
  }
  
  // Member since
  if (DOM.memberSince && user.metadata?.creationTime) {
    const joinDate = new Date(user.metadata.creationTime);
    DOM.memberSince.textContent = `Since ${joinDate.getFullYear()}`;
  }
}

/**
 * Update stats in DOM
 */
function updateStats() {
  const stats = AppState.userData.stats || {};
  
  // Calculate derived stats
  const tournamentsJoined = AppState.tournaments.length;
  const tournamentsWon = AppState.tournaments.filter(t => t.status === 'completed' && t.userRank === 1).length;
  const winRate = tournamentsJoined > 0 ? Math.round((tournamentsWon / tournamentsJoined) * 100) : 0;
  
  // Update DOM
  if (DOM.tournamentsJoined) DOM.tournamentsJoined.textContent = tournamentsJoined;
  if (DOM.tournamentsWon) DOM.tournamentsWon.textContent = tournamentsWon;
  if (DOM.winRate) {
    DOM.winRate.innerHTML = `<span class="text-gradient bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">${winRate}%</span>`;
  }
  
  // Update profile stats
  if (DOM.profileTournaments) DOM.profileTournaments.textContent = tournamentsJoined;
  if (DOM.profileWins) DOM.profileWins.textContent = tournamentsWon;
  if (DOM.profileWinRate) DOM.profileWinRate.textContent = `${winRate}%`;
}

/**
 * Render tournaments list
 */
function renderTournaments() {
  if (!DOM.tournamentsList || !AppState.tournaments.length) {
    DOM.tournamentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <h4>No Tournaments Yet</h4>
        <p>Join your first tournament to get started!</p>
        <a href="tournaments.html" class="btn btn-primary">Find Tournaments</a>
      </div>
    `;
    return;
  }
  
  const html = AppState.tournaments.map(tournament => {
    const statusClass = tournament.status === 'live' ? 'status-live' : 
                       tournament.status === 'upcoming' ? 'status-upcoming' : 'status-completed';
    const statusText = tournament.status === 'live' ? 'Live Now' : 
                      tournament.status === 'upcoming' ? 'Starts Soon' : 'Completed';
    
    const prizePool = tournament.prizePool ? formatCurrency(tournament.prizePool) : '₮0';
    const entryFee = tournament.entryFee ? formatCurrency(tournament.entryFee) : 'Free';
    
    const startDate = tournament.startDate ? 
      new Date(tournament.startDate.seconds * 1000).toLocaleDateString() : 'TBD';
    
    return `
      <div class="tournament-item touch-feedback" data-id="${tournament.id}">
        <div class="tournament-header">
          <div>
            <div class="tournament-title">
              ${tournament.title || 'Unknown Tournament'}
              ${tournament.status === 'live' ? `
                <span class="live-badge">
                  <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span class="text-xs font-bold text-red-500">LIVE</span>
                </span>
              ` : ''}
            </div>
            <div class="tournament-game text-sm text-text-secondary">
              <i class="fas fa-gamepad mr-1"></i>
              ${tournament.game || 'Unknown Game'} • ${tournament.format || 'Single Elim'}
            </div>
          </div>
          <span class="tournament-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="tournament-details grid grid-cols-2 gap-3 my-4">
          <div class="tournament-detail">
            <div class="detail-label">Prize Pool</div>
            <div class="detail-value prize-value font-bold">${prizePool}</div>
          </div>
          <div class="tournament-detail">
            <div class="detail-label">Entry Fee</div>
            <div class="detail-value">${entryFee}</div>
          </div>
          <div class="tournament-detail">
            <div class="detail-label">Starts</div>
            <div class="detail-value">${startDate}</div>
          </div>
          <div class="tournament-detail">
            <div class="detail-label">Players</div>
            <div class="detail-value">${tournament.currentPlayers || 0}/${tournament.maxPlayers || '∞'}</div>
          </div>
        </div>
        
        <div class="tournament-actions">
          <button class="btn btn-primary btn-sm flex-1" onclick="viewTournament('${tournament.id}')">
            <i class="fas fa-${tournament.status === 'live' ? 'play' : 'eye'} mr-2"></i>
            ${tournament.status === 'live' ? 'Join Match' : 'View Details'}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="shareTournament('${tournament.id}')">
            <i class="fas fa-share-alt"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  DOM.tournamentsList.innerHTML = html;
}

/**
 * Render matches list
 */
function renderMatches() {
  if (!DOM.matchesList || !AppState.matches.length) {
    DOM.matchesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚔️</div>
        <h4>No Matches Yet</h4>
        <p>Join a tournament to see your matches here</p>
        <a href="tournaments.html" class="btn btn-primary">Find Tournaments</a>
      </div>
    `;
    return;
  }
  
  const html = AppState.matches.map(match => {
    const isUpcoming = match.status === 'upcoming';
    const isWon = match.result === 'win';
    
    return `
      <div class="match-card bg-surface border border-border rounded-xl p-4 mb-3 touch-feedback">
        <div class="match-header flex justify-between items-center mb-3">
          <div class="match-title font-bold">${match.round || 'Match'}</div>
          <div class="${isUpcoming ? 'bg-blue-500/20 text-blue-400' : isWon ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} px-3 py-1 rounded-full text-xs font-bold">
            <i class="fas fa-${isUpcoming ? 'clock' : isWon ? 'check' : 'times'} mr-1"></i>
            ${isUpcoming ? 'In 45 min' : isWon ? 'Won' : 'Lost'}
          </div>
        </div>
        
        <div class="match-teams flex items-center justify-between mb-4">
          <div class="team text-center">
            <div class="team-logo w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span class="font-bold text-white">YOU</span>
            </div>
            <div class="team-name font-semibold ${isWon ? 'text-green-400' : ''}">Your Team</div>
            ${!isUpcoming ? `<div class="team-score text-2xl font-bold">${match.userScore || 0}</div>` : ''}
          </div>
          
          <div class="vs-section text-center">
            <div class="vs-badge ${isUpcoming ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-surface-dark text-text-secondary'} w-10 h-10 rounded-full flex items-center justify-center mx-auto font-bold">
              VS
            </div>
            <div class="match-format text-xs text-text-secondary mt-1">${match.format || 'BO1'}</div>
          </div>
          
          <div class="team text-center">
            <div class="team-logo w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span class="font-bold text-white">OP</span>
            </div>
            <div class="team-name font-semibold">${match.opponent || 'Opponent'}</div>
            ${!isUpcoming ? `<div class="team-score text-2xl font-bold">${match.opponentScore || 0}</div>` : ''}
          </div>
        </div>
        
        <div class="match-footer flex justify-between items-center">
          <div class="match-info text-sm text-text-secondary">
            <i class="fas fa-trophy mr-1"></i>
            ${match.prize ? formatCurrency(match.prize) + ' on the line' : 'Practice Match'}
          </div>
          <button class="btn ${isUpcoming ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="viewMatch('${match.id}')">
            <i class="fas fa-${isUpcoming ? 'play' : 'chart-bar'} mr-1"></i>
            ${isUpcoming ? 'Prepare' : 'Stats'}
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  DOM.matchesList.innerHTML = html;
}

/**
 * Render transactions list
 */
function renderTransactions() {
  if (!DOM.transactionsList || !AppState.transactions.length) {
    DOM.transactionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p>No transactions yet</p>
      </div>
    `;
    return;
  }
  
  const html = AppState.transactions.map(transaction => {
    const isDeposit = transaction.type === 'deposit';
    const icon = isDeposit ? 'arrow-down' : 'arrow-up';
    const colorClass = isDeposit ? 'text-green-500' : 'text-red-500';
    const bgClass = isDeposit ? 'bg-green-500/20' : 'bg-red-500/20';
    const sign = isDeposit ? '+' : '-';
    const amountClass = isDeposit ? 'amount-positive' : 'amount-negative';
    
    const date = transaction.createdAt ? formatDate(transaction.createdAt) : 'Recently';
    const status = transaction.status || 'completed';
    const statusClass = status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                       status === 'failed' ? 'bg-red-500/20 text-red-400' :
                       'bg-green-500/20 text-green-400';
    
    return `
      <div class="transaction-item touch-feedback">
        <div class="transaction-info">
          <div class="transaction-type flex items-center gap-2">
            <div class="type-icon w-8 h-8 ${bgClass} rounded-full flex items-center justify-center">
              <i class="fas fa-${icon} ${colorClass}"></i>
            </div>
            <div>
              <div class="font-medium">${transaction.description || (isDeposit ? 'Deposit' : 'Withdrawal')}</div>
              <div class="transaction-date text-xs text-text-secondary">${date}</div>
            </div>
          </div>
        </div>
        <div class="transaction-amount ${amountClass} font-bold">
          ${sign}₮${transaction.amount || 0}
        </div>
      </div>
    `;
  }).join('');
  
  DOM.transactionsList.innerHTML = html;
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Switch active tab
 */
function switchTab(tabName) {
  AppState.activeTab = tabName;
  
  // Update tab buttons
  DOM.tabs.forEach(tab => {
    const isActive = tab.getAttribute('data-tab') === tabName;
    tab.classList.toggle('active', isActive);
  });
  
  // Update tab panels
  DOM.tabPanels.forEach(panel => {
    const isActive = panel.id === `${tabName}-panel`;
    panel.classList.toggle('active', isActive);
  });
  
  // Update mobile indicator
  if (DOM.mobileTabIndicator) {
    const activeIndex = Array.from(DOM.tabs).findIndex(tab => 
      tab.getAttribute('data-tab') === tabName
    );
    DOM.mobileTabIndicator.style.transform = `translateX(${activeIndex * 100}%)`;
  }
  
  // Load data for tab if needed
  switch(tabName) {
    case 'tournaments':
      if (AppState.tournaments.length === 0) loadTournaments();
      break;
    case 'matches':
      if (AppState.matches.length === 0) loadMatches();
      break;
    case 'wallet':
      if (AppState.transactions.length === 0) loadTransactions();
      break;
  }
  
  // Track tab switch (analytics)
  trackEvent('tab_switch', { tab: tabName });
}

/**
 * Refresh tournaments
 */
async function refreshTournaments() {
  showToast('Refreshing tournaments...', 'info');
  await loadTournaments();
  showToast('Tournaments updated!', 'success');
}

/**
 * View tournament details
 */
function viewTournament(tournamentId) {
  window.location.href = `tournament.html?id=${tournamentId}`;
}

/**
 * View match details
 */
function viewMatch(matchId) {
  // Implement match details view
  showToast('Match details coming soon!', 'info');
}

/**
 * Share tournament
 */
async function shareTournament(tournamentId) {
  const tournament = AppState.tournaments.find(t => t.id === tournamentId);
  const shareData = {
    title: tournament?.title || 'Tournament',
    text: `Check out this ${tournament?.game || 'gaming'} tournament on TourneyHub!`,
    url: `${window.location.origin}/tournament.html?id=${tournamentId}`
  };
  
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareData.url);
      showToast('Link copied to clipboard!', 'success');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Share failed:', error);
    }
  }
}

/**
 * Edit profile
 */
function editProfile() {
  showToast('Edit profile feature coming soon!', 'info');
}

/**
 * Verify email
 */
async function verifyEmail() {
  try {
    await auth.currentUser.sendEmailVerification();
    showToast('Verification email sent!', 'success');
  } catch (error) {
    console.error('Email verification failed:', error);
    showToast('Failed to send verification email', 'error');
  }
}

// ============================================
// MOBILE INTERACTIONS
// ============================================

/**
 * Initialize mobile menu
 */
function initMobileMenu() {
  if (!AppState.isMobile) return;
  
  DOM.mobileMenuToggle?.addEventListener('click', () => {
    DOM.mobileMenu.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
  
  DOM.closeMobileMenu?.addEventListener('click', () => {
    DOM.mobileMenu.classList.add('hidden');
    document.body.style.overflow = '';
  });
  
  // Close menu on outside click
  DOM.mobileMenu?.addEventListener('click', (e) => {
    if (e.target === DOM.mobileMenu) {
      DOM.mobileMenu.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
}

/**
 * Initialize swipe gestures
 */
function initSwipeGestures() {
  if (!AppState.isMobile || !DOM.tabList) return;
  
  let startX = 0;
  let endX = 0;
  const threshold = 50;
  
  DOM.tabList.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
  
  DOM.tabList.addEventListener('touchmove', (e) => {
    endX = e.touches[0].clientX;
  });
  
  DOM.tabList.addEventListener('touchend', () => {
    const diff = startX - endX;
    
    if (Math.abs(diff) > threshold) {
      const tabs = ['tournaments', 'matches', 'wallet', 'profile'];
      const currentIndex = tabs.indexOf(AppState.activeTab);
      
      if (diff > 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        switchTab(tabs[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        switchTab(tabs[currentIndex - 1]);
      }
    }
  });
}

/**
 * Initialize touch feedback
 */
function initTouchFeedback() {
  const touchElements = document.querySelectorAll('.touch-feedback');
  
  touchElements.forEach(el => {
    el.addEventListener('touchstart', function() {
      this.style.opacity = '0.8';
      this.style.transform = 'scale(0.98)';
    });
    
    el.addEventListener('touchend', function() {
      this.style.opacity = '1';
      this.style.transform = 'scale(1)';
    });
    
    el.addEventListener('touchcancel', function() {
      this.style.opacity = '1';
      this.style.transform = 'scale(1)';
    });
  });
}

// ============================================
// MOCK DATA (FOR DEMO/OFLLINE)
// ============================================

function getMockTournaments() {
  return [
    {
      id: '1',
      title: 'Valorant Pro Series',
      game: 'Valorant',
      status: 'live',
      prizePool: 5000,
      entryFee: 150,
      startDate: { seconds: Date.now() / 1000 - 3600 },
      currentPlayers: 12,
      maxPlayers: 16,
      format: '5v5'
    },
    {
      id: '2',
      title: 'CS:GO Championship',
      game: 'CS:GO',
      status: 'upcoming',
      prizePool: 10000,
      entryFee: 200,
      startDate: { seconds: Date.now() / 1000 + 86400 },
      currentPlayers: 8,
      maxPlayers: 16,
      format: '5v5'
    },
    {
      id: '3',
      title: 'Fortnite Weekly',
      game: 'Fortnite',
      status: 'completed',
      prizePool: 2500,
      entryFee: 100,
      startDate: { seconds: Date.now() / 1000 - 172800 },
      currentPlayers: 100,
      maxPlayers: 100,
      format: 'Solo'
    }
  ];
}

function getMockMatches() {
  return [
    {
      id: '1',
      status: 'upcoming',
      round: 'Quarter Finals',
      opponent: 'Team Glitch',
      format: 'BO3',
      prize: 1200
    },
    {
      id: '2',
      status: 'completed',
      result: 'win',
      round: 'Group Stage',
      opponent: 'Vortex',
      format: 'BO3',
      userScore: 2,
      opponentScore: 1
    }
  ];
}

function getMockTransactions() {
  return [
    {
      type: 'deposit',
      amount: 750,
      description: 'Tournament Win',
      createdAt: { seconds: Date.now() / 1000 - 7200 },
      status: 'completed'
    },
    {
      type: 'withdrawal',
      amount: 200,
      description: 'Withdrawal',
      createdAt: { seconds: Date.now() / 1000 - 86400 },
      status: 'completed'
    },
    {
      type: 'deposit',
      amount: 500,
      description: 'Deposit',
      createdAt: { seconds: Date.now() / 1000 - 259200 },
      status: 'completed'
    }
  ];
}

function loadMockData() {
  AppState.tournaments = getMockTournaments();
  AppState.matches = getMockMatches();
  AppState.transactions = getMockTransactions();
  AppState.walletBalance = 1240;
  
  renderTournaments();
  renderMatches();
  renderTransactions();
  updateStats();
  updateUserProfile();
}

// ============================================
// ANALYTICS & TRACKING
// ============================================

function trackEvent(eventName, properties = {}) {
  // Simple analytics tracking
  const eventData = {
    event: eventName,
    timestamp: new Date().toISOString(),
    userId: AppState.currentUser?.uid || 'anonymous',
    userAgent: navigator.userAgent,
    platform: AppState.isMobile ? 'mobile' : 'desktop',
    ...properties
  };
  
  console.log('Event tracked:', eventData);
  
  // You can send this to your analytics service
  // Example: sendToAnalytics(eventData);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Show initial loading
    let progress = 0;
    const loadingInterval = setInterval(() => {
      progress += 10;
      showLoading(progress);
      
      if (progress >= 100) {
        clearInterval(loadingInterval);
        AppState.isLoading = false;
        
        // Initialize components
        initComponents();
        setupEventListeners();
        startAutoRefresh();
        
        showToast('Dashboard loaded successfully!', 'success', 3000);
      }
    }, 100);
    
  } catch (error) {
    console.error('App initialization failed:', error);
    showToast('Failed to initialize app', 'error');
    
    // Fallback to mock data
    loadMockData();
    showLoading(100);
  }
}

/**
 * Initialize components
 */
function initComponents() {
  // Set initial tab
  switchTab(AppState.activeTab);
  
  // Initialize mobile features
  if (AppState.isMobile) {
    initMobileMenu();
    initSwipeGestures();
    initTouchFeedback();
  }
  
  // Update stats
  updateStats();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tab switching
  DOM.tabs?.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Sign out
  DOM.signOutBtn?.addEventListener('click', signOut);
  
  // Profile settings
  DOM.profileSettings?.addEventListener('click', () => {
    switchTab('profile');
  });
  
  // Toast close
  DOM.toastClose?.addEventListener('click', hideToast);
  
  // Refresh tournaments button
  if (DOM.refreshTournamentsBtn) {
    DOM.refreshTournamentsBtn.onclick = refreshTournaments;
  }
  
  // Online/offline detection
  window.addEventListener('online', checkOnlineStatus);
  window.addEventListener('offline', checkOnlineStatus);
  
  // Resize handler
  window.addEventListener('resize', throttle(() => {
    AppState.isMobile = window.innerWidth <= 768;
  }, 250));
  
  // Before unload
  window.addEventListener('beforeunload', () => {
    trackEvent('page_unload');
  });
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
  setInterval(() => {
    if (AppState.isOnline && !AppState.isLoading) {
      loadWalletData();
      
      // Refresh active tab data
      switch(AppState.activeTab) {
        case 'tournaments':
          loadTournaments();
          break;
        case 'matches':
          loadMatches();
          break;
        case 'wallet':
          loadTransactions();
          break;
      }
    }
  }, AppState.config.autoRefreshInterval);
}

// ============================================
// START APPLICATION
// ============================================

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Remove no-js class if present
  document.documentElement.classList.remove('no-js');
  
  // Check if Firebase is available
  if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    initAuth();
  } else {
    // Firebase not available, use mock data
    console.warn('Firebase not available, using mock data');
    loadMockData();
    initApp();
  }
  
  // Initialize service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  }
});

// Make functions available globally
window.switchTab = switchTab;
window.refreshTournaments = refreshTournaments;
window.viewTournament = viewTournament;
window.viewMatch = viewMatch;
window.shareTournament = shareTournament;
window.editProfile = editProfile;
window.verifyEmail = verifyEmail;
window.signOut = signOut;

// ============================================
// ERROR HANDLING
// ============================================

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  trackEvent('error', {
    message: event.error?.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  trackEvent('promise_rejection', {
    reason: event.reason?.message || event.reason
  });
});

// ============================================
// PERFORMANCE MONITORING
// ============================================

// Monitor page load performance
if ('performance' in window) {
  window.addEventListener('load', () => {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    
    trackEvent('page_load', {
      loadTime,
      domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
      readyStart: timing.fetchStart - timing.navigationStart,
      redirectTime: timing.redirectEnd - timing.redirectStart,
      appcacheTime: timing.domainLookupStart - timing.fetchStart,
      unloadEventTime: timing.unloadEventEnd - timing.unloadEventStart,
      lookupDomainTime: timing.domainLookupEnd - timing.domainLookupStart,
      connectTime: timing.connectEnd - timing.connectStart,
      requestTime: timing.responseEnd - timing.requestStart,
      initDomTreeTime: timing.domInteractive - timing.responseEnd,
      domReadyTime: timing.domContentLoadedEventEnd - timing.domInteractive,
      loadEventTime: timing.loadEventEnd - timing.loadEventStart
    });
    
    console.log(`Page loaded in ${loadTime}ms`);
  });
}
