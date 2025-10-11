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

// Global Variables
let currentUser = null;
let cachedBalance = 0;
let currentTab = 'deposit';

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const balanceAmount = document.getElementById('balanceAmount');
const balanceSubtitle = document.getElementById('balanceSubtitle');
const userBadge = document.getElementById('userBadge');
const tabContent = document.getElementById('tabContent');
const statusMessage = document.getElementById('statusMessage');
const qrModal = document.getElementById('qrModal');
const qrImg = document.getElementById('qrImg');
const qrNote = document.getElementById('qrNote');
const qrTitle = document.getElementById('qrTitle');

// Initialize Application
function initApp() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    currentUser = user;
    await initializeWallet();
    showMainContent();
  });
}

// Initialize Wallet
async function initializeWallet() {
  try {
    updateLoadingText('Loading wallet data...');
    userBadge.textContent = currentUser.email;
    
    await updateWalletBalance();
    renderTab('deposit');
    
  } catch (error) {
    console.error('Wallet initialization error:', error);
    showStatus('Error initializing wallet', 'error');
  }
}

// Show Main Content
function showMainContent() {
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    mainContent.style.display = 'block';
    
    setTimeout(() => {
      mainContent.classList.add('fade-in');
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

// Update Wallet Balance
async function updateWalletBalance() {
  if (!currentUser) return;
  
  try {
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

    cachedBalance = totalDeposits - totalWithdrawals;
    
    // Update UI
    balanceAmount.textContent = `₹${cachedBalance.toLocaleString('en-IN')}`;
    balanceSubtitle.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    
  } catch (error) {
    console.error('Balance calculation error:', error);
    balanceAmount.textContent = '₹—';
    balanceSubtitle.textContent = 'Unable to load balance';
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
  tabContent.innerHTML = `
    <div class="tab-section active">
      <h3 style="margin-bottom: 20px; color: var(--text-primary);">Withdraw Funds</h3>
      
      <div class="form-group">
        <label class="form-label">Amount to Withdraw (₹)</label>
        <input type="number" id="withdrawAmount" class="form-input" 
               placeholder="Enter amount" min="1" step="1" max="${cachedBalance}">
        <div class="muted" style="margin-top: 8px; font-size: 0.75rem;">
          Available: ₹${cachedBalance.toLocaleString('en-IN')}
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
      
      <div style="margin-top: 24px; padding: 16px; background: var(--surface-light); border-radius: var(--radius-sm);">
        <h4 style="margin-bottom: 8px; color: var(--text-primary);">ℹ️ Processing Time</h4>
        <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">
          • Withdrawals processed within 24 hours<br>
          • Make sure payment details are correct<br>
          • Contact support for urgent requests
        </p>
      </div>
    </div>
  `;
}

// Render History Tab
function renderHistoryTab() {
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

// Submit Deposit
async function submitDeposit() {
  const amountInput = document.getElementById('depositAmount');
  const utrInput = document.getElementById('depositUTR');
  
  const amount = Number(amountInput?.value || 0);
  const utr = (utrInput?.value || '').trim();
  
  // Validation
  if (amount <= 0) {
    showStatus('Please enter a valid deposit amount', 'error');
    return;
  }
  
  if (!utr && !confirm('No UTR entered. Submit deposit without reference?')) {
    return;
  }
  
  try {
    showStatus('Submitting deposit request...', 'info');
    
    await db.collection('deposits').add({
      email: currentUser.email,
      amount: amount,
      utr: utr || null,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient: new Date().toISOString(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Clear form
    if (amountInput) amountInput.value = '';
    if (utrInput) utrInput.value = '';
    
    showStatus(`Deposit request of ₹${amount} submitted successfully!`, 'success');
    
    // Refresh balance after a delay
    setTimeout(updateWalletBalance, 2000);
    
  } catch (error) {
    console.error('Deposit submission error:', error);
    showStatus('Error submitting deposit request', 'error');
  }
}

// Submit Withdrawal
async function submitWithdrawal() {
  const amountInput = document.getElementById('withdrawAmount');
  const detailsInput = document.getElementById('withdrawDetails');
  
  const amount = Number(amountInput?.value || 0);
  const details = (detailsInput?.value || '').trim();
  
  // Validation
  if (amount <= 0) {
    showStatus('Please enter a valid withdrawal amount', 'error');
    return;
  }
  
  if (amount > cachedBalance) {
    showStatus(`Insufficient balance. Available: ₹${cachedBalance}`, 'error');
    return;
  }
  
  if (!details) {
    showStatus('Please enter payment details', 'error');
    return;
  }
  
  try {
    showStatus('Submitting withdrawal request...', 'info');
    
    await db.collection('withdrawals').add({
      email: currentUser.email,
      amount: amount,
      details: details,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient: new Date().toISOString(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Clear form
    if (amountInput) amountInput.value = '';
    if (detailsInput) detailsInput.value = '';
    
    showStatus(`Withdrawal request of ₹${amount} submitted successfully!`, 'success');
    
    // Refresh balance after a delay
    setTimeout(updateWalletBalance, 2000);
    
  } catch (error) {
    console.error('Withdrawal submission error:', error);
    showStatus('Error submitting withdrawal request', 'error');
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
  qrModal.style.display = 'none';
}

// Load Transaction History
async function loadTransactionHistory() {
  try {
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits')
        .where('email', '==', currentUser.email)
        .orderBy('createdAt', 'desc')
        .get(),
      db.collection('withdrawals')
        .where('email', '==', currentUser.email)
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
        status: data.status,
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
        status: data.status,
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
    
    renderTransactionHistory(transactions);
    
  } catch (error) {
    console.error('History loading error:', error);
    document.getElementById('historyContent').innerHTML = `
      <div class="text-center muted" style="padding: 40px;">
        <div style="font-size: 3rem; margin-bottom: 16px;">😕</div>
        <p>Unable to load transaction history</p>
        <button class="btn btn-secondary" onclick="loadTransactionHistory()" style="margin-top: 16px;">
          Try Again
        </button>
      </div>
    `;
  }
}

// Render Transaction History
function renderTransactionHistory(transactions) {
  const historyContent = document.getElementById('historyContent');
  
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
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(clearStatus, 5000);
  }
}

// Clear Status Message
function clearStatus() {
  statusMessage.className = 'status-message';
  statusMessage.textContent = '';
}

// Close modal when clicking outside
qrModal.addEventListener('click', (e) => {
  if (e.target === qrModal) {
    closeQRModal();
  }
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);