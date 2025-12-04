// =============================================
// 🏆 TOURNEYHUB - WALLET SCRIPT
// =============================================

// 🔧 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
  authDomain: "authapp-386ee.firebaseapp.com",
  projectId: "authapp-386ee",
  storageBucket: "authapp-386ee.firebasestorage.app",
  messagingSenderId: "809698525310",
  appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
  measurementId: "G-EJZTSBSGQT"
};

// 🚀 Initialize Firebase
let auth = null;
let db = null;

// Global Variables
let currentUser = null;
let cachedBalance = 0;
let currentTab = 'deposit';

// DOM element holders
let loadingScreen, mainContent, balanceAmount, balanceSubtitle, userBadge;
let tabContent, statusMessage, qrModal, qrImg, qrNote, qrTitle;

// =============================================
// 🎯 INITIALIZATION
// =============================================

function initApp() {
  console.log('🏁 Initializing TourneyHub Wallet...');
  
  // Get DOM elements
  loadingScreen = document.getElementById('loadingScreen');
  mainContent = document.getElementById('mainContent');
  balanceAmount = document.getElementById('balanceAmount');
  balanceSubtitle = document.getElementById('balanceSubtitle');
  userBadge = document.getElementById('userBadge');
  tabContent = document.getElementById('tabContent');
  statusMessage = document.getElementById('statusMessage');
  qrModal = document.getElementById('qrModal');
  qrImg = document.getElementById('qrImg');
  qrNote = document.getElementById('qrNote');
  qrTitle = document.getElementById('qrTitle');
  
  // Initialize Firebase
  try {
    if (typeof firebase === "undefined") {
      showStatus("Firebase SDK not loaded. Please refresh the page.", "error");
      return;
    }
    
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('✅ Firebase initialized successfully');
    
    // Setup auth state listener
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        console.log('🚪 No user found, redirecting to login...');
        window.location.href = 'login.html';
        return;
      }
      
      currentUser = user;
      console.log('👤 User authenticated:', user.email);
      
      try {
        await initializeWallet();
        showMainContent();
      } catch (err) {
        console.error('❌ Error during wallet initialization:', err);
        showStatus('Failed to load wallet: ' + err.message, 'error');
      }
    });
    
    // Setup QR modal close listener
    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) closeQRModal();
      });
    }
    
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    showStatus('Failed to initialize app: ' + error.message, 'error');
  }
}

// =============================================
// 🎮 WALLET FUNCTIONS
// =============================================

async function initializeWallet() {
  console.log('💼 Initializing wallet...');
  
  if (!currentUser || !db) {
    throw new Error('User or database not available');
  }
  
  updateLoadingText('Loading wallet data...');
  
  // Update user badge
  if (userBadge) {
    userBadge.textContent = currentUser.email || 'User';
  }
  
  // Load balance
  await updateWalletBalance();
  
  // Set initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'deposit';
  renderTab(initialTab);
  
  console.log('✅ Wallet initialized successfully');
}

// =============================================
// 💰 BALANCE MANAGEMENT
// =============================================

async function updateWalletBalance() {
  if (!currentUser || !db) {
    console.error('Cannot update balance: User or DB not available');
    return;
  }
  
  try {
    console.log('🔄 Updating wallet balance...');
    
    const userId = currentUser.uid;
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();
    
    let balance = 0;
    
    if (walletDoc.exists) {
      // Get balance from wallet document
      const walletData = walletDoc.data();
      balance = parseFloat(walletData.balance) || 0;
      console.log('💰 Wallet balance from document:', balance);
    } else {
      // Calculate from transactions (fallback for old users)
      console.log('📋 Wallet document not found, calculating from transactions...');
      
      const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
        db.collection('deposits')
          .where('userId', '==', userId)
          .where('status', '==', 'approved')
          .get(),
        db.collection('withdrawals')
          .where('userId', '==', userId)
          .where('status', '==', 'approved')
          .get()
      ]);
      
      let totalDeposits = 0;
      depositsSnapshot.forEach(doc => {
        totalDeposits += parseFloat(doc.data().amount) || 0;
      });
      
      let totalWithdrawals = 0;
      withdrawalsSnapshot.forEach(doc => {
        totalWithdrawals += parseFloat(doc.data().amount) || 0;
      });
      
      balance = totalDeposits - totalWithdrawals;
      
      // Create wallet document if it doesn't exist
      if (!walletDoc.exists) {
        await walletRef.set({
          balance: balance,
          userId: userId,
          email: currentUser.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          transactions: []
        });
        console.log('✅ Created new wallet document');
      }
    }
    
    cachedBalance = balance;
    
    // Update UI
    if (balanceAmount) {
      balanceAmount.textContent = `💎${balance.toLocaleString('en-IN', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })}`;
    }
    
    if (balanceSubtitle) {
      balanceSubtitle.textContent = `Last updated: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    console.log('✅ Balance updated:', cachedBalance);
    
  } catch (error) {
    console.error('❌ Error updating wallet balance:', error);
    showStatus('Failed to load balance: ' + error.message, 'error');
    
    if (balanceAmount) {
      balanceAmount.textContent = '💎—';
    }
  }
}

// =============================================
// 🎨 UI FUNCTIONS
// =============================================

function showMainContent() {
  console.log('🎨 Showing main content...');
  
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 300);
    }
    
    if (mainContent) {
      mainContent.style.display = 'block';
      setTimeout(() => {
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'translateY(0)';
      }, 50);
    }
  }, 500);
}

function updateLoadingText(text) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = text;
}

function showStatus(message, type = 'info') {
  if (!statusMessage) return;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  statusMessage.textContent = `${icons[type] || ''} ${message}`;
  statusMessage.className = `status-message ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status-message';
    }, 5000);
  }
}

function clearStatus() {
  if (statusMessage) {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }
}

// =============================================
// 📱 TAB MANAGEMENT
// =============================================

function switchTab(tabName) {
  console.log('🔀 Switching to tab:', tabName);
  currentTab = tabName;
  renderTab(tabName);
  
  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('tab', tabName);
  window.history.pushState({}, '', url);
}

function renderTab(tabName) {
  console.log('🎨 Rendering tab:', tabName);
  
  clearStatus();
  
  // Update active button styles
  document.querySelectorAll('.quick-actions .action-btn').forEach(btn => {
    btn.classList.remove('primary', 'secondary');
    if (btn.getAttribute('onclick')?.includes(`'${tabName}'`)) {
      btn.classList.add(tabName === 'deposit' ? 'primary' : 'secondary');
    } else {
      btn.classList.add('ghost');
    }
  });
  
  // Render tab content
  switch (tabName) {
    case 'deposit':
      renderDepositTab();
      break;
    case 'withdraw':
      renderWithdrawTab();
      break;
    case 'history':
      renderHistoryTab();
      break;
    default:
      renderDepositTab();
  }
}

function renderDepositTab() {
  if (!tabContent) return;
  
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Add Funds</h3>
      
      <div class="form-group">
        <label class="form-label">Amount (💎)</label>
        <input type="number" id="depositAmount" class="form-input" placeholder="Enter amount" min="1" step="1">
      </div>
      
      <div class="form-group">
        <label class="form-label">Transaction Reference (UTR)</label>
        <input type="text" id="depositUTR" class="form-input" placeholder="Enter bank UTR or transaction reference">
        <div class="muted" style="margin-top: 8px; font-size: 0.75rem;">
          Optional: Add UTR after payment
        </div>
      </div>
      
      <div class="btn-group">
        <button class="btn btn-primary" onclick="submitDeposit()">
          <span class="action-icon">💳</span> Submit Deposit
        </button>
        <button class="btn btn-ghost" onclick="showQRModal()">
          <span class="action-icon">📱</span> Show QR Code
        </button>
      </div>
      
      <div style="margin-top: 24px; padding: 16px; background: var(--surface-light); border-radius: var(--radius-sm);">
        <h4 style="margin-bottom: 8px; color: var(--text-primary);">💡 Payment Instructions</h4>
        <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">
          1. Use the QR code or manual transfer<br>
          2. After payment, submit deposit with UTR<br>
          3. Funds will be added after verification
        </p>
      </div>
    </div>
  `;
}

function renderWithdrawTab() {
  if (!tabContent) return;
  
  const safeBalance = typeof cachedBalance === 'number' ? cachedBalance : 0;
  
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Withdraw Funds</h3>
      
      <div class="form-group">
        <label class="form-label">Amount to Withdraw (💎)</label>
        <input type="number" id="withdrawAmount" class="form-input" placeholder="Enter amount" min="1" step="1" max="${safeBalance}">
        <div class="muted" style="margin-top: 8px; font-size: 0.75rem;">
          Available: 💎${safeBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Payment Details</label>
        <input type="text" id="withdrawDetails" class="form-input" placeholder="Enter UPI ID or bank account details">
      </div>
      
      <div class="btn-group">
        <button class="btn btn-primary" onclick="submitWithdrawal()">
          <span class="action-icon">💸</span> Request Withdrawal
        </button>
        <button class="btn btn-secondary" onclick="setMaxAmount()">
          <span class="action-icon">💰</span> Use Max Amount
        </button>
      </div>
    </div>
  `;
}

function renderHistoryTab() {
  if (!tabContent) return;
  
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Transaction History</h3>
      <div id="historyContent">
        <div class="text-center muted" style="padding: 40px;">
          <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
          Loading transactions...
        </div>
      </div>
    </div>
  `;
  
  loadTransactionHistory();
}

// =============================================
// 💳 DEPOSIT FUNCTIONS
// =============================================

async function submitDeposit() {
  if (!currentUser || !db) {
    showStatus('Please wait, system is initializing', 'error');
    return;
  }
  
  const amountInput = document.getElementById('depositAmount');
  const utrInput = document.getElementById('depositUTR');
  const amount = parseFloat(amountInput?.value || 0);
  const utr = (utrInput?.value || '').trim();
  
  if (amount <= 0 || isNaN(amount)) {
    showStatus('Please enter a valid deposit amount', 'error');
    return;
  }
  
  if (amount > 100000) {
    showStatus('Maximum deposit amount is 💎1,00,000', 'error');
    return;
  }
  
  try {
    showStatus('Submitting deposit request...', 'info');
    
    const depositData = {
      userId: currentUser.uid,
      email: currentUser.email,
      amount: amount,
      utr: utr || null,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('deposits').add(depositData);
    
    console.log('✅ Deposit request submitted:', docRef.id);
    showStatus(`Deposit request of 💎${amount} submitted successfully! It will be processed after verification.`, 'success');
    
    // Clear form
    if (amountInput) amountInput.value = '';
    if (utrInput) utrInput.value = '';
    
    // Refresh balance after delay
    setTimeout(updateWalletBalance, 2000);
    
  } catch (error) {
    console.error('❌ Deposit submission error:', error);
    showStatus('Failed to submit deposit: ' + error.message, 'error');
  }
}

// =============================================
// 💸 WITHDRAWAL FUNCTIONS
// =============================================

async function submitWithdrawal() {
  if (!currentUser || !db) {
    showStatus('Please wait, system is initializing', 'error');
    return;
  }
  
  const amountInput = document.getElementById('withdrawAmount');
  const detailsInput = document.getElementById('withdrawDetails');
  const amount = parseFloat(amountInput?.value || 0);
  const details = (detailsInput?.value || '').trim();
  
  if (amount <= 0 || isNaN(amount)) {
    showStatus('Please enter a valid withdrawal amount', 'error');
    return;
  }
  
  if (amount > cachedBalance) {
    showStatus(`Insufficient balance. Available: 💎${cachedBalance.toFixed(2)}`, 'error');
    return;
  }
  
  if (amount < 100) {
    showStatus('Minimum withdrawal amount is 💎100', 'error');
    return;
  }
  
  if (!details) {
    showStatus('Please enter payment details (UPI ID or bank account)', 'error');
    return;
  }
  
  try {
    showStatus('Submitting withdrawal request...', 'info');
    
    const withdrawalData = {
      userId: currentUser.uid,
      email: currentUser.email,
      amount: amount,
      details: details,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('withdrawals').add(withdrawalData);
    
    // Update balance immediately
    const walletRef = db.collection('wallets').doc(currentUser.uid);
    await walletRef.update({
      balance: firebase.firestore.FieldValue.increment(-amount),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    cachedBalance -= amount;
    
    showStatus(`Withdrawal request of 💎${amount} submitted successfully! It will be processed within 24-48 hours.`, 'success');
    
    // Clear form
    if (amountInput) amountInput.value = '';
    if (detailsInput) detailsInput.value = '';
    
    // Update UI
    updateWalletBalance();
    
  } catch (error) {
    console.error('❌ Withdrawal submission error:', error);
    showStatus('Failed to submit withdrawal: ' + error.message, 'error');
  }
}

function setMaxAmount() {
  const amountInput = document.getElementById('withdrawAmount');
  if (amountInput && cachedBalance > 0) {
    amountInput.value = cachedBalance;
  }
}

// =============================================
// 📱 QR CODE FUNCTIONS
// =============================================

function showQRModal() {
  // Use a default UPI ID or allow user to enter
  const defaultUPI = 'tourneyhub@okhdfcbank'; // Replace with your actual UPI ID
  const paymentText = prompt('Enter UPI ID for QR code:', defaultUPI);
  
  if (!paymentText) return;
  
  if (!qrImg || !qrModal || !qrTitle || !qrNote) {
    alert('QR modal unavailable.');
    return;
  }
  
  const upiLink = `upi://pay?pa=${encodeURIComponent(paymentText)}&pn=TourneyHub&mc=0000&tid=${Date.now()}&tr=TOURNEY${Date.now()}&tn=TourneyHub%20Deposit&am=0&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
  
  qrImg.src = qrCodeUrl;
  qrTitle.textContent = 'Scan to Pay via UPI';
  qrNote.textContent = `UPI ID: ${paymentText}\n1. Scan QR code with any UPI app\n2. Enter desired amount\n3. Complete payment\n4. Submit deposit with UTR`;
  
  qrModal.style.display = 'flex';
}

function closeQRModal() {
  if (qrModal) {
    qrModal.style.display = 'none';
  }
}

// =============================================
// 📊 HISTORY FUNCTIONS
// =============================================

async function loadTransactionHistory() {
  if (!currentUser || !db) return;
  
  try {
    console.log('📊 Loading transaction history...');
    
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get(),
      db.collection('withdrawals')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
    ]);
    
    const transactions = [];
    
    // Process deposits
    depositsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        type: 'deposit',
        amount: data.amount,
        status: data.status || 'pending',
        details: data.utr || 'N/A',
        timestamp: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt
      });
    });
    
    // Process withdrawals
    withdrawalsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        type: 'withdrawal',
        amount: data.amount,
        status: data.status || 'pending',
        details: data.details || 'N/A',
        timestamp: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt
      });
    });
    
    // Sort by date (newest first)
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    renderTransactionHistory(transactions);
    
  } catch (error) {
    console.error('❌ History loading error:', error);
    const historyContent = document.getElementById('historyContent');
    if (historyContent) {
      historyContent.innerHTML = `
        <div class="text-center muted" style="padding: 40px;">
          <p>Unable to load transaction history</p>
          <button class="btn btn-secondary" onclick="loadTransactionHistory()">Try Again</button>
        </div>
      `;
    }
  }
}

function renderTransactionHistory(transactions) {
  const historyContent = document.getElementById('historyContent');
  if (!historyContent) return;
  
  if (transactions.length === 0) {
    historyContent.innerHTML = `
      <div class="text-center muted" style="padding: 40px;">
        <p>No transactions yet</p>
        <p class="small" style="margin-top: 8px;">Your deposit and withdrawal history will appear here</p>
      </div>
    `;
    return;
  }
  
  const html = `
    <div class="history-list">
      ${transactions.map(tx => `
        <div class="history-item ${tx.status}">
          <div class="history-icon">
            ${tx.type === 'deposit' ? '💰' : '💸'}
          </div>
          <div class="history-info">
            <div class="history-header">
              <span class="history-type">${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
              <span class="history-status status-${tx.status}">${tx.status}</span>
            </div>
            <div class="history-details">${tx.details}</div>
            <div class="history-date">
              ${tx.timestamp.toLocaleDateString()} ${tx.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
          <div class="history-amount ${tx.type === 'deposit' ? 'positive' : 'negative'}">
            ${tx.type === 'deposit' ? '+' : '-'}💎${tx.amount.toLocaleString('en-IN')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  historyContent.innerHTML = html;
}

// =============================================
// 🌐 EXPORT FUNCTIONS TO GLOBAL SCOPE
// =============================================

window.switchTab = switchTab;
window.submitDeposit = submitDeposit;
window.submitWithdrawal = submitWithdrawal;
window.setMaxAmount = setMaxAmount;
window.showQRModal = showQRModal;
window.closeQRModal = closeQRModal;
window.loadTransactionHistory = loadTransactionHistory;
window.updateWalletBalance = updateWalletBalance;

// =============================================
// 🎬 START APPLICATION
// =============================================

document.addEventListener('DOMContentLoaded', initApp);

// Force show content if loading takes too long
setTimeout(() => {
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    console.log('⏰ Loading timeout - Showing content');
    showMainContent();
  }
}, 10000);

console.log('🎯 TourneyHub Wallet Script Loaded');

const walletData = {
  balance: balance,
  userId: currentUser.uid,
  email: currentUser.email,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  transactions: [] // optional array for transaction history
};