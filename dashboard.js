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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const signOutBtn = document.getElementById('signOutBtn');
const notificationToast = document.getElementById('notificationToast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.getElementById('toastClose');

// Stats Elements
const tournamentsJoined = document.getElementById('tournamentsJoined');
const tournamentsWon = document.getElementById('tournamentsWon');
const walletBalance = document.getElementById('walletBalance');
const winRate = document.getElementById('winRate');
const detailedBalance = document.getElementById('detailedBalance');

// Content Elements
const tournamentsList = document.getElementById('tournamentsList');
const matchesList = document.getElementById('matchesList');
const transactionsList = document.getElementById('transactionsList');
const profileContent = document.getElementById('profileContent');
const verifiedBadge = document.getElementById('verifiedBadge');
const memberSince = document.getElementById('memberSince');
const profileTournaments = document.getElementById('profileTournaments');
const profileWins = document.getElementById('profileWins');
const profileWinRate = document.getElementById('profileWinRate');

// Global Variables
let currentUser = null;
let userData = null;

// Initialize Application
function initApp() {
  console.log('Initializing dashboard...');
  
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // User not logged in, redirect to login
      window.location.href = 'login.html';
      return;
    }
    
    currentUser = user;
    await loadUserData();
    showMainContent();
  });
}

// Load User Data from Firestore
async function loadUserData() {
  try {
    console.log('Loading user data...');
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    
    if (userDoc.exists) {
      userData = userDoc.data();
      console.log('User data loaded:', userData);
      
      // Update UI with user data
      updateUserProfile();
      await loadUserStats();
      await loadUserTournaments();
      await loadWalletData();
      await loadRecentTransactions();
    } else {
      // Create user document if it doesn't exist
      await createUserProfile();
      userData = {
        email: currentUser.email,
        displayName: currentUser.email.split('@')[0],
        role: 'user',
        walletBalance: 0,
        tournamentsJoined: 0,
        tournamentsWon: 0,
        createdAt: new Date()
      };
      updateUserProfile();
    }
    
  } catch (error) {
    console.error('Error loading user data:', error);
    showNotification('Error loading user data', 'error');
  }
}

// Create User Profile in Firestore
async function createUserProfile() {
  try {
    await db.collection('users').doc(currentUser.uid).set({
      email: currentUser.email,
      displayName: currentUser.email.split('@')[0],
      role: 'user',
      walletBalance: 0,
      tournamentsJoined: 0,
      tournamentsWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      emailVerified: currentUser.emailVerified
    });
    console.log('User profile created');
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}

// Update User Profile UI
function updateUserProfile() {
  const displayName = userData?.displayName || currentUser.email.split('@')[0];
  const email = currentUser.email;
  
  // Update header
  userName.textContent = displayName;
  userEmail.textContent = email;
  
  // Update profile section
  profileName.textContent = displayName;
  profileEmail.textContent = email;
  
  // Update verification badge
  if (currentUser.emailVerified) {
    verifiedBadge.textContent = '✓ Verified';
    verifiedBadge.className = 'badge verified';
  } else {
    verifiedBadge.textContent = '✗ Unverified';
    verifiedBadge.className = 'badge warning';
    verifiedBadge.style.background = 'rgba(245, 158, 11, 0.2)';
    verifiedBadge.style.color = 'var(--warning)';
    verifiedBadge.style.border = '1px solid var(--warning)';
  }
  
  // Update member since
  if (userData?.createdAt) {
    const joinDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
    memberSince.textContent = `Member since ${joinDate.getFullYear()}`;
  }
}

// Load User Stats
async function loadUserStats() {
  if (!userData) return;
  
  // Update stats from user data
  tournamentsJoined.textContent = userData.tournamentsJoined || 0;
  tournamentsWon.textContent = userData.tournamentsWon || 0;
  walletBalance.textContent = `₹${(userData.walletBalance || 0).toLocaleString()}`;
  detailedBalance.textContent = `₹${(userData.walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  
  // Calculate win rate
  const joined = userData.tournamentsJoined || 0;
  const won = userData.tournamentsWon || 0;
  const winRateValue = joined > 0 ? Math.round((won / joined) * 100) : 0;
  winRate.textContent = `${winRateValue}%`;
  
  // Update profile stats
  profileTournaments.textContent = userData.tournamentsJoined || 0;
  profileWins.textContent = userData.tournamentsWon || 0;
  profileWinRate.textContent = `${winRateValue}%`;
}

// Load User Tournaments
async function loadUserTournaments() {
  try {
    // In a real app, you would query tournaments where user is registered
    // For now, we'll use sample data
    const sampleTournaments = [
      {
        id: 1,
        title: 'Valorant Showdown Championship',
        game: 'Valorant',
        status: 'upcoming',
        prize: '₹50,000',
        entryFee: '₹500',
        startDate: '2024-12-20',
        players: '32/64'
      },
      {
        id: 2,
        title: 'Free Fire Clash Royale',
        game: 'Free Fire',
        status: 'live',
        prize: '₹25,000',
        entryFee: '₹300',
        startDate: '2024-12-15',
        players: '24/32'
      },
      {
        id: 3,
        title: 'COD Mobile Masters Cup',
        game: 'COD Mobile',
        status: 'completed',
        prize: '₹40,000',
        entryFee: '₹400',
        startDate: '2024-12-10',
        players: '48/48',
        position: '3rd'
      }
    ];
    
    displayTournaments(sampleTournaments);
    
  } catch (error) {
    console.error('Error loading tournaments:', error);
    tournamentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <h4>Error Loading Tournaments</h4>
        <p>Unable to load your tournament data</p>
        <button class="btn btn-secondary" onclick="loadUserTournaments()">Try Again</button>
      </div>
    `;
  }
}

// Display Tournaments
function displayTournaments(tournaments) {
  if (!tournaments || tournaments.length === 0) {
    tournamentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <h4>No Tournaments Yet</h4>
        <p>Join your first tournament to get started!</p>
        <a href="tournaments.html" class="btn btn-primary">Find Tournaments</a>
      </div>
    `;
    return;
  }
  
  const tournamentsHTML = tournaments.map(tournament => `
    <div class="tournament-item">
      <div class="tournament-header">
        <div>
          <div class="tournament-title">${tournament.title}</div>
          <div class="tournament-game muted">${tournament.game}</div>
        </div>
        <span class="tournament-status status-${tournament.status}">
          ${tournament.status.toUpperCase()}
        </span>
      </div>
      
      <div class="tournament-details">
        <div class="tournament-detail">
          <div class="detail-label">Prize Pool</div>
          <div class="detail-value prize-value">${tournament.prize}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Entry Fee</div>
          <div class="detail-value">${tournament.entryFee}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Start Date</div>
          <div class="detail-value">${tournament.startDate}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Players</div>
          <div class="detail-value">${tournament.players}</div>
        </div>
      </div>
      
      <div class="tournament-actions">
        <button class="btn btn-primary" onclick="viewTournament(${tournament.id})">
          <span class="btn-icon">👁️</span>
          View Details
        </button>
        ${tournament.status === 'upcoming' ? `
          <button class="btn btn-secondary" onclick="withdrawFromTournament(${tournament.id})">
            <span class="btn-icon">🚫</span>
            Withdraw
          </button>
        ` : ''}
        ${tournament.position ? `
          <div class="tournament-position">
            <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid var(--warning);">
              Finished ${tournament.position}
            </span>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  tournamentsList.innerHTML = tournamentsHTML;
}

// Load Wallet Data
async function loadWalletData() {
  try {
    // Calculate balance from deposits and withdrawals
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('email', '==', currentUser.email)
        .where('status', '==', 'approved')
        .get(),
      db.collection('withdrawals')
        .where('email', '==', currentUser.email)
        .where('status', '==', 'approved')
        .get()
    ]);

    let totalDeposits = 0;
    depositsSnapshot.forEach(doc => {
      totalDeposits += Number(doc.data().amount) || 0;
    });

    let totalWithdrawals = 0;
    withdrawalsSnapshot.forEach(doc => {
      totalWithdrawals += Number(doc.data().amount) || 0;
    });

    const balance = totalDeposits - totalWithdrawals;
    
    // Update wallet balance
    walletBalance.textContent = `₹${balance.toLocaleString()}`;
    detailedBalance.textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    
  } catch (error) {
    console.error('Error loading wallet data:', error);
    showNotification('Error loading wallet information', 'error');
  }
}

// Load Recent Transactions
async function loadRecentTransactions() {
  try {
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('email', '==', currentUser.email)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),
      db.collection('withdrawals')
        .where('email', '==', currentUser.email)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
    ]);
    
    const transactions = [];
    
    // Process deposits
    depositsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        type: 'deposit',
        amount: data.amount,
        status: data.status,
        date: data.createdAt?.toDate() || new Date(),
        id: doc.id
      });
    });
    
    // Process withdrawals
    withdrawalsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        type: 'withdrawal',
        amount: data.amount,
        status: data.status,
        date: data.createdAt?.toDate() || new Date(),
        id: doc.id
      });
    });
    
    // Sort by date and display
    transactions.sort((a, b) => b.date - a.date);
    displayTransactions(transactions.slice(0, 5));
    
  } catch (error) {
    console.error('Error loading transactions:', error);
    transactionsList.innerHTML = '<div class="muted">Error loading transactions</div>';
  }
}

// Display Transactions
function displayTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    transactionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p>No transactions yet</p>
      </div>
    `;
    return;
  }
  
  const transactionsHTML = transactions.map(transaction => `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-type">
          ${transaction.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}
          <span class="transaction-status" style="
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            margin-left: 8px;
            background: ${transaction.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
            color: ${transaction.status === 'approved' ? 'var(--success)' : 'var(--warning)'};
            border: 1px solid ${transaction.status === 'approved' ? 'var(--success)' : 'var(--warning)'};
          ">
            ${transaction.status}
          </span>
        </div>
        <div class="transaction-date">
          ${transaction.date.toLocaleDateString()}
        </div>
      </div>
      <div class="transaction-amount ${transaction.type === 'deposit' ? 'amount-positive' : 'amount-negative'}">
        ${transaction.type === 'deposit' ? '+' : '-'}₹${transaction.amount}
      </div>
    </div>
  `).join('');
  
  transactionsList.innerHTML = transactionsHTML;
}

// Show Main Content
function showMainContent() {
  console.log('Showing dashboard content...');
  
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    
    if (mainContent) {
      mainContent.style.opacity = '1';
    }
    
    // Initialize tab functionality
    initTabs();
    
  }, 1000);
}

// Initialize Tab Functionality
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding panel
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `${targetTab}-panel`) {
          panel.classList.add('active');
        }
      });
    });
  });
}

// Show Notification
function showNotification(message, type = 'info') {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  toastIcon.textContent = icons[type] || icons.info;
  toastMessage.textContent = message;
  notificationToast.className = `notification-toast show ${type}`;
  
  setTimeout(() => {
    hideNotification();
  }, 5000);
}

// Hide Notification
function hideNotification() {
  notificationToast.classList.remove('show');
}

// Refresh Tournaments
function refreshTournaments() {
  tournamentsList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner-small"></div>
      <p>Refreshing tournaments...</p>
    </div>
  `;
  
  setTimeout(() => {
    loadUserTournaments();
    showNotification('Tournaments refreshed', 'success');
  }, 1000);
}

// View Tournament
function viewTournament(tournamentId) {
  showNotification(`Opening tournament ${tournamentId}...`, 'info');
  // In real app, redirect to tournament page
  // window.location.href = `tournament.html?id=${tournamentId}`;
}

// Withdraw from Tournament
function withdrawFromTournament(tournamentId) {
  if (confirm('Are you sure you want to withdraw from this tournament?')) {
    showNotification('Withdrawal request submitted', 'success');
    // In real app, implement withdrawal logic
  }
}

// Edit Profile
function editProfile() {
  showNotification('Profile editing feature coming soon!', 'info');
}

// Verify Email
function verifyEmail() {
  if (currentUser.emailVerified) {
    showNotification('Email is already verified', 'success');
    return;
  }
  
  currentUser.sendEmailVerification()
    .then(() => {
      showNotification('Verification email sent! Please check your inbox.', 'success');
    })
    .catch(error => {
      console.error('Error sending verification email:', error);
      showNotification('Error sending verification email', 'error');
    });
}

// Sign Out
function signOut() {
  auth.signOut()
    .then(() => {
      showNotification('Signed out successfully', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1000);
    })
    .catch(error => {
      console.error('Sign out error:', error);
      showNotification('Error signing out', 'error');
    });
}

// Event Listeners
function setupEventListeners() {
  // Sign out button
  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOut);
  }
  
  // Toast close button
  if (toastClose) {
    toastClose.addEventListener('click', hideNotification);
  }
  
  // Profile settings in quick actions
  const profileSettings = document.getElementById('profileSettings');
  if (profileSettings) {
    profileSettings.addEventListener('click', () => {
      // Switch to profile tab
      document.querySelector('[data-tab="profile"]').click();
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Dashboard DOM loaded');
  setupEventListeners();
  initApp();
});

// Fallback: if loading takes too long, force show content
setTimeout(() => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    console.log('Fallback: forcing content to show');
    showMainContent();
  }
}, 5000);