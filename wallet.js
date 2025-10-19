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
  if (typeof firebase === "undefined") throw new Error("Firebase SDK not loaded");
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  auth = null;
  db = null;
}

// Global Variables (DOM refs will be set in initApp)
let currentUser = null;
let cachedBalance = 0;
let currentTab = 'deposit';

// DOM element holders (initialized later)
let loadingScreen = null;
let mainContent = null;
let balanceAmount = null;
let balanceSubtitle = null;
let userBadge = null;
let tabContent = null;
let statusMessage = null;
let qrModal = null;
let qrImg = null;
let qrNote = null;
let qrTitle = null;

// Initialize Application
function initApp() {
  // Query DOM elements here so the script is robust regardless of include position
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

  if (!auth) {
    showStatus('Firebase not initialized properly', 'error');
    console.error('Firebase auth is not available. Wallet functions will be disabled.');
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log('❌ No user found, redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    currentUser = user;
    try {
      await initializeWallet();
      showMainContent();
    } catch (err) {
      console.error('Error during wallet initialization:', err);
      showStatus('Error initializing wallet: ' + (err.message || 'unknown'), 'error');
    }
  });

  // safe QR modal click outside to close
  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) closeQRModal();
    });
  }
}

// Initialize Wallet
async function initializeWallet() {
  try {
    updateLoadingText('Loading wallet data...');
    userBadge.textContent = currentUser.email || 'User';
    
    await updateWalletBalance();
    renderTab('deposit');
    
  } catch (error) {
    console.error('Wallet initialization error:', error);
    showStatus('Error initializing wallet: ' + error.message, 'error');
  }
}

// Show Main Content
function showMainContent() {
  setTimeout(() => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (mainContent) mainContent.style.display = 'block';
    
    setTimeout(() => {
      if (mainContent) mainContent.classList.add('fade-in');
    }, 50);
  }, 500);
}

// Update Loading Text
function updateLoadingText(text) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

// Safety: ensure cachedBalance is numeric
function getSafeCachedBalance() {
  return (typeof cachedBalance === 'number' && !isNaN(cachedBalance)) ? cachedBalance : 0;
}

// Update Wallet Balance
async function updateWalletBalance() {
  if (!currentUser || !db) return;
  try {
    if (loadingScreen) updateLoadingText('Loading wallet data...');
    if (userBadge) userBadge.textContent = currentUser.email || 'User';

    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get(),
      db.collection('withdrawals').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get()
    ]);

    let totalDeposits = 0;
    depositsSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount) || 0;
      totalDeposits += amount;
    });

    let totalWithdrawals = 0;
    withdrawalsSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount) || 0;
      totalWithdrawals += amount;
    });

    cachedBalance = totalDeposits - totalWithdrawals;

    if (balanceAmount) {
      balanceAmount.textContent = `₹${cachedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    if (balanceSubtitle) {
      balanceSubtitle.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

  } catch (error) {
    console.error('❌ Balance calculation error:', error);
    if (balanceAmount) balanceAmount.textContent = '₹—';
    if (balanceSubtitle) balanceSubtitle.textContent = 'Unable to load balance';
    showStatus('Error loading balance: ' + (error.message || 'unknown'), 'error');
  }
}

// Switch Tabs
function switchTab(tabName) {
  currentTab = tabName;
  renderTab(tabName);
}

// Render Tab Content
function renderTab(tabName) {
  clearStatus();
  
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

// Render Deposit Tab
function renderDepositTab() {
  if (!tabContent) return;
  
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Add Funds</h3>
      
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input type="number" id="depositAmount" class="form-input" 
               placeholder="Enter amount" min="1" step="1">
      </div>
      
      <div class="form-group">
        <label class="form-label">Transaction Reference (UTR)</label>
        <input type="text" id="depositUTR" class="form-input" 
               placeholder="Enter bank UTR or transaction reference">
        <div class="muted" style="margin-top: 8px; font-size: 0.75rem;">
          Optional: Add UTR after payment
        </div>
      </div>
      
      <div class="btn-group">
        <button class="btn btn-primary" onclick="submitDeposit()">
          <span class="action-icon">💳</span>
          Submit Deposit
        </button>
        <button class="btn btn-ghost" onclick="showQRModal()">
          <span class="action-icon">📱</span>
          Show QR Code
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

// Render Withdraw Tab
function renderWithdrawTab() {
  if (!tabContent) return;
  const safeBalance = getSafeCachedBalance();
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Withdraw Funds</h3>
      <div class="form-group">
        <label class="form-label">Amount to Withdraw (₹)</label>
        <input type="number" id="withdrawAmount" class="form-input" placeholder="Enter amount" min="1" step="1" max="${safeBalance}">
        <div class="muted" style="margin-top: 8px; font-size: 0.75rem;">
          Available: ₹${safeBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Payment Details</label>
        <input type="text" id="withdrawDetails" class="form-input" 
               placeholder="Enter UPI ID or bank account details">
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="submitWithdrawal()">
          <span class="action-icon">💸</span>
          Request Withdrawal
        </button>
        <button class="btn btn-secondary" onclick="setMaxAmount()">
          <span class="action-icon">💰</span>
          Use Max Amount
        </button>
      </div>
    </div>
  `;
}

// Render History Tab
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

// small helper: ensure user's email is verified, offer to resend verification if not
async function ensureEmailVerified() {
  // No longer require email verification for wallet actions
  return true;
}

// --- ensure token is fresh after verification ---
async function refreshUserToken() {
	// refresh user profile & id token
	if (!currentUser) return;
	try {
		if (typeof currentUser.reload === 'function') await currentUser.reload();
		if (typeof currentUser.getIdToken === 'function') await currentUser.getIdToken(true);
		console.log('✅ User token refreshed');
	} catch (e) {
		console.warn('refreshUserToken failed', e);
	}
}

// Submit Deposit - UPDATED: auto-approve for verified users and update wallet
async function submitDeposit() {
	console.log('🔄 Submitting deposit...');

	if (!currentUser || !db) {
		showStatus('Please wait, system is initializing', 'error');
		return;
	}

    // No longer require email verification before deposit

	// Refresh token to avoid stale-permission issues
	await refreshUserToken();

	const amountInput = document.getElementById('depositAmount');
	const utrInput = document.getElementById('depositUTR');

	const amount = parseFloat(amountInput?.value || 0);
	const utr = (utrInput?.value || '').trim();

	// Validation
	if (amount <= 0 || isNaN(amount)) {
		showStatus('Please enter a valid deposit amount', 'error');
		return;
	}

	try {
		showStatus('Submitting deposit request...', 'info');

		const depositData = {
			userId: currentUser.uid,
			email: currentUser.email,
			amount: amount,
			status: 'pending',
			createdAt: firebase.firestore.FieldValue.serverTimestamp(),
			createdAtClient: new Date().toISOString()
		};
		if (utr) depositData.utr = utr;

		// Add deposit doc
		const docRef = await db.collection('deposits').add(depositData);
		console.log('🆔 Deposit doc created:', docRef.id);

    // Always leave deposit as pending for admin approval
    showStatus(`Deposit request of ₹${amount} submitted and awaiting approval.`, 'info');

		// Clear form
		if (amountInput) amountInput.value = '';
		if (utrInput) utrInput.value = '';

		// Refresh balance display
		setTimeout(updateWalletBalance, 1200);

	} catch (error) {
		console.error('❌ Deposit submission error:', error);
		let errorMessage = 'Error submitting deposit request';

    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied.';
    } else if (error.code === 'unavailable') {
			errorMessage = 'Network error. Please check your connection.';
		} else {
			errorMessage = 'Error submitting deposit request: ' + (error.message || '');
		}

		showStatus(errorMessage, 'error');
	}
}

// Submit Withdrawal - UPDATED FOR YOUR RULES
async function submitWithdrawal() {
  console.log('🔄 Submitting withdrawal...');
  
  if (!currentUser || !db) {
    showStatus('Please wait, system is initializing', 'error');
    return;
  }

  // No longer require email verification before withdrawal

  const amountInput = document.getElementById('withdrawAmount');
  const detailsInput = document.getElementById('withdrawDetails');
  
  const amount = parseFloat(amountInput?.value || 0);
  const details = (detailsInput?.value || '').trim();
  
  // Validation
  if (amount <= 0 || isNaN(amount)) {
    showStatus('Please enter a valid withdrawal amount', 'error');
    return;
  }
  
  if (amount > cachedBalance) {
    showStatus(`Insufficient balance. Available: ₹${cachedBalance.toFixed(2)}`, 'error');
    return;
  }
  
  if (!details) {
    showStatus('Please enter payment details', 'error');
    return;
  }
  
  try {
    showStatus('Submitting withdrawal request...', 'info');
    
    console.log('📝 Creating withdrawal document...');
    const withdrawalData = {
      userId: currentUser.uid, // Required by your rules
      email: currentUser.email,
      amount: amount,
      details: details,
      destination: details, // Required by your rules (must be a string)
      status: 'pending', // Required by your rules
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Required by your rules
      createdAtClient: new Date().toISOString()
    };
    
    console.log('💾 Saving withdrawal data:', withdrawalData);
    
    // Add document to Firestore
    const docRef = await db.collection('withdrawals').add(withdrawalData);
    console.log('✅ Withdrawal submitted with ID:', docRef.id);
    
    // Clear form
    if (amountInput) amountInput.value = '';
    if (detailsInput) detailsInput.value = '';
    
    showStatus(`Withdrawal request of ₹${amount} submitted successfully!`, 'success');
    
    // Refresh balance after a delay
    setTimeout(updateWalletBalance, 2000);
    
  } catch (error) {
    console.error('❌ Withdrawal submission error:', error);
    let errorMessage = 'Error submitting withdrawal request';
    
    // More specific error messages
    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied.';
    } else if (error.code === 'unavailable') {
      errorMessage = 'Network error. Please check your connection.';
    } else {
      errorMessage = 'Error submitting withdrawal request: ' + error.message;
    }
    
    showStatus(errorMessage, 'error');
  }
}

// Set Max Amount for Withdrawal
function setMaxAmount() {
  const amountInput = document.getElementById('withdrawAmount');
  if (amountInput && cachedBalance > 0) {
    amountInput.value = cachedBalance;
  }
}

// Show QR Modal
function showQRModal() {
  const paymentText = prompt('Enter payment details for QR code (UPI ID or payment link):', 
                            'your-upi-id@oksbi');
  
  if (!paymentText) return;
  
  if (!qrImg || !qrModal || !qrTitle || !qrNote) {
    console.warn('QR modal elements not found in DOM');
    alert('QR modal unavailable. Please try manual transfer.');
    return;
  }

  // Generate QR code using Google Charts API
  const encodedText = encodeURIComponent(paymentText);
  const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodedText}&choe=UTF-8`;
  
  qrImg.src = qrCodeUrl;
  qrTitle.textContent = 'Scan to Pay';
  qrNote.textContent = 'Scan this QR code with any UPI app to make payment. After payment, remember to submit the deposit with your UTR.';
  
  qrModal.style.display = 'flex';
}

// Close QR Modal
function closeQRModal() {
  if (qrModal) qrModal.style.display = 'none';
}

// Load Transaction History - UPDATED FOR YOUR RULES
async function loadTransactionHistory() {
  if (!currentUser || !db) return;

  try {
    console.log('📜 Loading transaction history...');
    
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get(),
      db.collection('withdrawals')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
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
        details: data.utr || 'No UTR provided',
        timestamp: data.createdAt?.toDate() || new Date(data.createdAtClient),
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
        details: data.details || 'No details provided',
        timestamp: data.createdAt?.toDate() || new Date(data.createdAtClient),
        createdAt: data.createdAt
      });
    });
    
    // Sort by timestamp
    transactions.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.timestamp).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    console.log(`📊 Found ${transactions.length} transactions`);
    renderTransactionHistory(transactions);
    
  } catch (error) {
    console.error('❌ History loading error:', error);
    const historyContent = document.getElementById('historyContent');
    if (historyContent) {
      historyContent.innerHTML = `
        <div class="text-center muted" style="padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">😕</div>
          <p>Unable to load transaction history</p>
          <p style="font-size: 0.875rem; margin-top: 8px;">${error.message}</p>
          <button class="btn btn-secondary" onclick="loadTransactionHistory()" style="margin-top: 16px;">
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// Render Transaction History
function renderTransactionHistory(transactions) {
  const historyContent = document.getElementById('historyContent');
  if (!historyContent) return;
  
  if (transactions.length === 0) {
    historyContent.innerHTML = `
      <div class="text-center muted" style="padding: 40px;">
        <div style="font-size: 3rem; margin-bottom: 16px;">💸</div>
        <p>No transactions yet</p>
        <p style="font-size: 0.875rem; margin-top: 8px;">Your transactions will appear here</p>
      </div>
    `;
    return;
  }
  
  const historyHTML = `
    <div class="history-list">
      ${transactions.map(transaction => `
        <div class="history-item">
          <div class="history-info">
            <div class="history-type">
              ${transaction.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}
              <span class="history-status status-${transaction.status}">
                ${transaction.status}
              </span>
            </div>
            <div class="history-details">
              ${transaction.details}
            </div>
            <div class="muted" style="font-size: 0.75rem; margin-top: 4px;">
              ${transaction.timestamp.toLocaleString()}
            </div>
          </div>
          <div class="history-amount ${transaction.type === 'deposit' ? 'positive' : 'negative'}">
            ${transaction.type === 'deposit' ? '+' : '-'}₹${transaction.amount}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  historyContent.innerHTML = historyHTML;
}

// Show Status Message
function showStatus(message, type = 'info') {
  if (!statusMessage) {
    console.warn('statusMessage element missing:', message, type);
    return;
  }
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  if (type === 'success') setTimeout(clearStatus, 5000);
}

// Clear Status Message
function clearStatus() {
  if (!statusMessage) return;
  statusMessage.className = 'status-message';
  statusMessage.textContent = '';
}

// Close modal when clicking outside
if (qrModal) {
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      closeQRModal();
    }
  });
}

// Expose functions to global scope for inline onclick handlers and other pages
window.switchTab = switchTab;
window.renderTab = renderTab;
window.renderDepositTab = renderDepositTab;
window.renderWithdrawTab = renderWithdrawTab;
window.renderHistoryTab = renderHistoryTab;
window.submitDeposit = submitDeposit;
window.submitWithdrawal = submitWithdrawal;
window.setMaxAmount = setMaxAmount;
window.showQRModal = showQRModal;
window.closeQRModal = closeQRModal;
window.loadTransactionHistory = loadTransactionHistory;
window.loadWallet = updateWalletBalance; // keep available if other scripts call loadWallet -> will update balance

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);