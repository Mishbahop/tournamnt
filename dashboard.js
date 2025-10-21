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

// --- DOM Elements (as before) ---
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const signOutBtn = document.getElementById('signOutBtn');
const notificationToast = document.getElementById('notificationToast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.getElementById('toastClose');
const tournamentsJoined = document.getElementById('tournamentsJoined');
const tournamentsWon = document.getElementById('tournamentsWon');
const walletBalance = document.getElementById('walletBalance');
const winRate = document.getElementById('winRate');
const detailedBalance = document.getElementById('detailedBalance');
const tournamentsList = document.getElementById('tournamentsList');
const transactionsList = document.getElementById('transactionsList');
const verifiedBadge = document.getElementById('verifiedBadge');
const memberSince = document.getElementById('memberSince');
const profileTournaments = document.getElementById('profileTournaments');
const profileWins = document.getElementById('profileWins');
const profileWinRate = document.getElementById('profileWinRate');

let currentUser = null;

// =================================================================
// INITIALIZATION
// =================================================================
function initApp() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    await loadDashboardData();
    showMainContent();
  });
}

async function loadDashboardData() {
  try {
    // These now run in parallel for faster loading
    await Promise.all([
        updateUserProfile(),
        loadWalletData(),
        loadUserTournaments(),
        loadRecentTransactions()
    ]);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showNotification('Error loading your dashboard', 'error');
  }
}


// =================================================================
// USER AND PROFILE LOGIC
// =================================================================
async function updateUserProfile() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    let userData = userDoc.exists ? userDoc.data() : {};

    const displayName = userData?.displayName || currentUser.email.split('@')[0];
    const email = currentUser.email;
  
    if (userName) userName.textContent = displayName;
    if (userEmail) userEmail.textContent = email;
    if (profileName) profileName.textContent = displayName;
    if (profileEmail) profileEmail.textContent = email;
  
    if (verifiedBadge) {
        if (currentUser.emailVerified) {
            verifiedBadge.textContent = '✓ Verified';
            verifiedBadge.className = 'badge verified';
        } else {
            verifiedBadge.textContent = '✗ Unverified';
            verifiedBadge.className = 'badge warning';
        }
    }
  
    if (memberSince && currentUser.metadata.creationTime) {
        const joinDate = new Date(currentUser.metadata.creationTime);
        memberSince.textContent = `Member since ${joinDate.getFullYear()}`;
    }
}


// =================================================================
// WALLET & TRANSACTION LOGIC (FIXED)
// =================================================================

// FIX #1: Using the same self-healing logic from wallet.js to ensure consistency
async function loadWalletData() {
  if (!currentUser || !db) return;
  try {
    const walletRef = db.collection('wallets').doc(currentUser.uid);
    const walletDoc = await walletRef.get();
    let finalBalance = 0;

    if (walletDoc.exists && typeof walletDoc.data().balance !== 'undefined') {
      finalBalance = walletDoc.data().balance;
    } else {
      // Fallback for new users - calculate and create the wallet document
      console.warn("Wallet document not found for user. Calculating from history...");
      const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
        db.collection('deposits').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get(),
        db.collection('withdrawals').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get()
      ]);
      let totalDeposits = 0;
      depositsSnapshot.forEach(doc => totalDeposits += (parseFloat(doc.data().amount) || 0));
      let totalWithdrawals = 0;
      withdrawalsSnapshot.forEach(doc => totalWithdrawals += (parseFloat(doc.data().amount) || 0));
      finalBalance = totalDeposits - totalWithdrawals;
      // Create the wallet doc so this calculation is not needed again
      await walletRef.set({ balance: finalBalance, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    if (walletBalance) walletBalance.textContent = `₹${Math.round(finalBalance).toLocaleString()}`;
    if (detailedBalance) detailedBalance.textContent = `₹${finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  } catch (error) {
    console.error('Error loading wallet data:', error);
    if (walletBalance) walletBalance.textContent = '₹?';
    showNotification('Error loading wallet information', 'error');
  }
}

async function loadRecentTransactions() {
  if (!transactionsList || !currentUser) return;
  try {
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
        db.collection('deposits').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').limit(3).get(),
        db.collection('withdrawals').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').limit(3).get()
    ]);
    const transactions = [];
    depositsSnapshot.forEach(doc => transactions.push({ type: 'deposit', ...doc.data(), date: doc.data().createdAt?.toDate() || new Date() }));
    withdrawalsSnapshot.forEach(doc => transactions.push({ type: 'withdrawal', ...doc.data(), date: doc.data().createdAt?.toDate() || new Date() }));
    
    transactions.sort((a, b) => b.date - a.date);
    displayTransactions(transactions.slice(0, 5));
  } catch (error) {
    console.error('Error loading transactions:', error);
    if (transactionsList) transactionsList.innerHTML = '<div class="muted">Error loading transactions</div>';
  }
}

function displayTransactions(transactions) {
    if (!transactionsList) return;
    if (transactions.length === 0) {
        transactionsList.innerHTML = `<div class="empty-state"><div class="empty-icon">💸</div><p>No recent transactions</p></div>`;
        return;
    }
    const html = transactions.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-type">${t.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}
                    <span class="badge ${t.status}">${t.status}</span>
                </div>
                <div class="transaction-date">${t.date.toLocaleDateString()}</div>
            </div>
            <div class="transaction-amount ${t.type === 'deposit' ? 'amount-positive' : 'amount-negative'}">
                ${t.type === 'deposit' ? '+' : '-'}₹${t.amount}
            </div>
        </div>`).join('');
    transactionsList.innerHTML = html;
}

// =================================================================
// TOURNAMENT LOGIC (FIXED)
// =================================================================

// FIX #2: Load REAL tournaments from Firestore instead of sample data
async function loadUserTournaments() {
  if (!tournamentsList || !currentUser) return;

  try {
    // Step 1: Get the list of tournament IDs the user has joined
    const userTournamentsDoc = await db.collection('userTournaments').doc(currentUser.uid).get();

    if (!userTournamentsDoc.exists || !userTournamentsDoc.data().tournamentIds || userTournamentsDoc.data().tournamentIds.length === 0) {
      displayTournaments([]); // Show empty state
      if (tournamentsJoined) tournamentsJoined.textContent = 0;
      return;
    }
    
    const tournamentIds = userTournamentsDoc.data().tournamentIds;

    // Step 2: Fetch the details for all those tournaments in a single query
    const tournamentsSnapshot = await db.collection('tournaments')
      .where(firebase.firestore.FieldPath.documentId(), 'in', tournamentIds)
      .get();
      
    const tournaments = tournamentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Step 3: Update stats based on real data
    if (tournamentsJoined) tournamentsJoined.textContent = tournaments.length;
    // Note: 'wins' would need a more complex system (e.g., checking results subcollection), for now we use a placeholder.
    if (tournamentsWon) tournamentsWon.textContent = 0; // Placeholder

    displayTournaments(tournaments);

  } catch (error) {
    console.error('Error loading tournaments:', error);
    tournamentsList.innerHTML = `<div class="empty-state"><h4>Error Loading Tournaments</h4><p>${error.message}</p></div>`;
  }
}

// FIX #3: Display tournaments categorized by status
function displayTournaments(tournaments) {
  if (!tournamentsList) return;

  if (tournaments.length === 0) {
    tournamentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <h4>No Tournaments Yet</h4>
        <p>Join your first tournament to get started!</p>
        <a href="tournaments.html" class="btn btn-primary">Find Tournaments</a>
      </div>`;
    return;
  }
  
  // Categorize tournaments
  const live = tournaments.filter(t => t.status === 'active');
  const upcoming = tournaments.filter(t => ['upcoming', 'registering'].includes(t.status));
  const completed = tournaments.filter(t => t.status === 'completed');

  let finalHTML = '';

  const createTournamentHTML = (t) => `
    <div class="tournament-item">
      <div class="tournament-header">
        <div>
          <div class="tournament-title">${t.title}</div>
          <div class="tournament-game muted">${t.game}</div>
        </div>
        <span class="tournament-status status-${t.status}">${t.status}</span>
      </div>
      <div class="tournament-details">
        <div class="tournament-detail">
          <div class="detail-label">Prize Pool</div>
          <div class="detail-value prize-value">₹${t.prizePool?.toLocaleString() || 0}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Entry Fee</div>
          <div class="detail-value">₹${t.entryFee?.toLocaleString() || 0}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Starts</div>
          <div class="detail-value">${t.startDate?.toDate().toLocaleDateString() || 'TBD'}</div>
        </div>
        <div class="tournament-detail">
          <div class="detail-label">Players</div>
          <div class="detail-value">${t.currentPlayers || 0} / ${t.maxPlayers || '∞'}</div>
        </div>
      </div>
      <div class="tournament-actions">
        <button class="btn btn-primary" onclick="viewTournamentDetails('${t.id}')">View Details</button>
      </div>
    </div>`;
  
  if (live.length > 0) {
    finalHTML += `<h3>Live</h3><div class="tournaments-grid">` + live.map(createTournamentHTML).join('') + `</div>`;
  }
  if (upcoming.length > 0) {
    finalHTML += `<h3>Upcoming</h3><div class="tournaments-grid">` + upcoming.map(createTournamentHTML).join('') + `</div>`;
  }
  if (completed.length > 0) {
    finalHTML += `<h3>Completed</h3><div class="tournaments-grid">` + completed.map(createTournamentHTML).join('') + `</div>`;
  }

  tournamentsList.innerHTML = finalHTML;
}


// =================================================================
// UTILITY & UI FUNCTIONS
// =================================================================
function showMainContent() {
  setTimeout(() => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (mainContent) mainContent.style.opacity = '1';
    initTabs();
  }, 500);
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
    });
  });
}

function showNotification(message, type = 'info') {
    if (!notificationToast) return;
    toastIcon.textContent = { success: '✅', error: '❌', info: 'ℹ️' }[type] || 'ℹ️';
    toastMessage.textContent = message;
    notificationToast.className = `notification-toast show ${type}`;
    setTimeout(hideNotification, 5000);
}

function hideNotification() {
    if (notificationToast) notificationToast.classList.remove('show');
}

function refreshTournaments() {
  if (tournamentsList) tournamentsList.innerHTML = `<div class="loading-state"><div class="loading-spinner-small"></div><p>Refreshing...</p></div>`;
  setTimeout(() => {
    loadUserTournaments();
    showNotification('Tournaments refreshed!', 'success');
  }, 1000);
}

function viewTournamentDetails(tournamentId) {
    window.location.href = `tournament.html?id=${tournamentId}`; // Link to your main tournament page
}

function signOut() {
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  }).catch(error => {
    console.error('Sign out error:', error);
    showNotification('Error signing out', 'error');
  });
}

// =================================================================
// EVENT LISTENERS
// =================================================================
function setupEventListeners() {
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);
    if (toastClose) toastClose.addEventListener('click', hideNotification);
    
    const profileSettings = document.getElementById('profileSettings');
    if (profileSettings) {
        profileSettings.addEventListener('click', () => {
            document.querySelector('[data-tab="profile"]')?.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initApp();
});