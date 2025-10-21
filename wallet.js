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

// Global Variables
let currentUser = null;
let cachedBalance = 0;
let currentTab = 'deposit';

// DOM element holders
let loadingScreen, mainContent, balanceAmount, balanceSubtitle, userBadge, tabContent, statusMessage, qrModal, qrImg, qrNote, qrTitle;

// Initialize Application
function initApp() {
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
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    try {
      await initializeWallet();
      showMainContent();
    } catch (err) {
      console.error('Error during wallet initialization:', err);
    }
  });

  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) closeQRModal();
    });
  }
}

async function initializeWallet() {
  try {
    updateLoadingText('Loading wallet data...');
    if (userBadge) userBadge.textContent = currentUser.email || 'User'; 
    await updateWalletBalance();
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'deposit';
    renderTab(initialTab);
  } catch (error) {
    console.error('Wallet initialization error:', error);
    if (statusMessage) showStatus('Error initializing wallet: ' + error.message, 'error'); 
  }
}

function showMainContent() {
  setTimeout(() => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (mainContent) mainContent.style.display = 'block';
    setTimeout(() => {
      if (mainContent) mainContent.classList.add('fade-in');
    }, 50);
  }, 500);
}

function updateLoadingText(text) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = text;
}

function getSafeCachedBalance() {
  return (typeof cachedBalance === 'number' && !isNaN(cachedBalance)) ? cachedBalance : 0;
}

// --- SELF-HEALING BALANCE LOGIC ---
async function updateWalletBalance() {
    if (!currentUser || !db) return;
    try {
        // 1. Fetch authoritative secure balance
        const walletRef = db.collection('wallets').doc(currentUser.uid);
        const walletDoc = await walletRef.get();
        let secureBalance = (walletDoc.exists) ? walletDoc.data().balance : undefined;

        // 2. Calculate historic balance from deposits/withdrawals
        const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
            db.collection('deposits').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get(),
            db.collection('withdrawals').where('userId', '==', currentUser.uid).where('status', '==', 'approved').get()
        ]);
        let totalDeposits = 0;
        depositsSnapshot.forEach(doc => totalDeposits += (parseFloat(doc.data().amount) || 0));
        let totalWithdrawals = 0;
        withdrawalsSnapshot.forEach(doc => totalWithdrawals += (parseFloat(doc.data().amount) || 0));
        const calculatedBalance = totalDeposits - totalWithdrawals;

        // 3. Synchronization Logic
        if (typeof secureBalance === 'undefined') {
            // Case A: Wallet doesn't exist yet. Create it with calculated balance.
            console.log('⚙️ Initializing new wallet document...');
            await walletRef.set({
                balance: calculatedBalance,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                transactions: []
            });
            cachedBalance = calculatedBalance;
        } 
        else if (secureBalance === 0 && calculatedBalance > 0) {
            // Case B: Wallet exists but is 0, while history shows money. SYNC IT.
            console.warn('⚠️ Wallet out of sync (shows 0, should be ' + calculatedBalance + '). Auto-correcting...');
            await walletRef.update({
                balance: calculatedBalance,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            cachedBalance = calculatedBalance;
            showStatus('Wallet balance synchronized with deposit history.', 'success');
        } 
        else {
            // Case C: Wallet exists and seems fine, or both are 0. Trust the secure wallet.
            cachedBalance = secureBalance;
        }

        console.log('✅ Final loaded balance:', cachedBalance);

        // Update UI
        if (balanceAmount) {
            balanceAmount.textContent = `₹${cachedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
        if (balanceSubtitle) {
            balanceSubtitle.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }

    } catch (error) {
        console.error('❌ Balance sync error:', error);
        if (balanceAmount) balanceAmount.textContent = '₹—';
        showStatus('Error syncing balance: ' + error.message, 'error');
    }
}

// --- UI and FORM LOGIC ---
function switchTab(tabName) {
  currentTab = tabName;
  renderTab(tabName);
}

function renderTab(tabName) {
  clearStatus();
  document.querySelectorAll('.quick-actions .action-btn').forEach(btn => {
      btn.classList.remove('primary', 'secondary');
      if (btn.getAttribute('onclick').includes(`'${tabName}'`)) {
          btn.classList.add(tabName === 'deposit' ? 'primary' : 'secondary');
      } else {
          btn.classList.add('ghost');
      }
  });
  switch (tabName) {
    case 'deposit': renderDepositTab(); break;
    case 'withdraw': renderWithdrawTab(); break;
    case 'history': renderHistoryTab(); break;
    default: renderDepositTab();
  }
}

function renderDepositTab() {
  if (!tabContent) return;
  tabContent.innerHTML = `<div class="tab-section active"><h3 style="margin-bottom: 20px; color: var(--text-primary);">Add Funds</h3><div class="form-group"><label class="form-label">Amount (₹)</label><input type="number" id="depositAmount" class="form-input" placeholder="Enter amount" min="1" step="1"></div><div class="form-group"><label class="form-label">Transaction Reference (UTR)</label><input type="text" id="depositUTR" class="form-input" placeholder="Enter bank UTR or transaction reference"><div class="muted" style="margin-top: 8px; font-size: 0.75rem;">Optional: Add UTR after payment</div></div><div class="btn-group"><button class="btn btn-primary" onclick="submitDeposit()"><span class="action-icon">💳</span> Submit Deposit</button><button class="btn btn-ghost" onclick="showQRModal()"><span class="action-icon">📱</span> Show QR Code</button></div><div style="margin-top: 24px; padding: 16px; background: var(--surface-light); border-radius: var(--radius-sm);"><h4 style="margin-bottom: 8px; color: var(--text-primary);">💡 Payment Instructions</h4><p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">1. Use the QR code or manual transfer<br>2. After payment, submit deposit with UTR<br>3. Funds will be added after verification</p></div></div>`;
}

function renderWithdrawTab() {
  if (!tabContent) return;
  const safeBalance = getSafeCachedBalance();
  tabContent.innerHTML = `<div class="tab-section active"><h3 style="margin-bottom: 20px; color: var(--text-primary);">Withdraw Funds</h3><div class="form-group"><label class="form-label">Amount to Withdraw (₹)</label><input type="number" id="withdrawAmount" class="form-input" placeholder="Enter amount" min="1" step="1" max="${safeBalance}"><div class="muted" style="margin-top: 8px; font-size: 0.75rem;">Available: ₹${safeBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div><div class="form-group"><label class="form-label">Payment Details</label><input type="text" id="withdrawDetails" class="form-input" placeholder="Enter UPI ID or bank account details"></div><div class="btn-group"><button class="btn btn-primary" onclick="submitWithdrawal()"><span class="action-icon">💸</span> Request Withdrawal</button><button class="btn btn-secondary" onclick="setMaxAmount()"><span class="action-icon">💰</span> Use Max Amount</button></div></div>`;
}

function renderHistoryTab() {
  if (!tabContent) return;
  tabContent.innerHTML = `<div class="tab-section active"><h3 style="margin-bottom: 20px; color: var(--text-primary);">Transaction History</h3><div id="historyContent"><div class="text-center muted" style="padding: 40px;"><div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>Loading transactions...</div></div></div>`;
  loadTransactionHistory();
}

async function refreshUserToken() {
	if (!currentUser) return;
	try {
		if (typeof currentUser.reload === 'function') await currentUser.reload();
		if (typeof currentUser.getIdToken === 'function') await currentUser.getIdToken(true);
		console.log('✅ User token refreshed');
	} catch (e) { console.warn('refreshUserToken failed', e); }
}

async function submitDeposit() {
	if (!currentUser || !db) { showStatus('Please wait, system is initializing', 'error'); return; }
	await refreshUserToken();
	const amountInput = document.getElementById('depositAmount');
	const utrInput = document.getElementById('depositUTR');
	const amount = parseFloat(amountInput?.value || 0);
	const utr = (utrInput?.value || '').trim();
	if (amount <= 0 || isNaN(amount)) { showStatus('Please enter a valid deposit amount', 'error'); return; }
	try {
		showStatus('Submitting deposit request...', 'info');
		const depositData = { userId: currentUser.uid, email: currentUser.email, amount: amount, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdAtClient: new Date().toISOString() };
		if (utr) depositData.utr = utr;
		const docRef = await db.collection('deposits').add(depositData);
		console.log('🆔 Deposit doc created:', docRef.id);
        showStatus(`Deposit request of ₹${amount} submitted and awaiting approval.`, 'info');
		if (amountInput) amountInput.value = '';
		if (utrInput) utrInput.value = '';
		setTimeout(updateWalletBalance, 1200);
	} catch (error) {
		console.error('❌ Deposit submission error:', error);
		showStatus('Error: ' + error.message, 'error');
	}
}

async function submitWithdrawal() {
  if (!currentUser || !db) { showStatus('Please wait, system is initializing', 'error'); return; }
  const amountInput = document.getElementById('withdrawAmount');
  const detailsInput = document.getElementById('withdrawDetails');
  const amount = parseFloat(amountInput?.value || 0);
  const details = (detailsInput?.value || '').trim();
  if (amount <= 0 || isNaN(amount)) { showStatus('Please enter a valid withdrawal amount', 'error'); return; }
  if (amount > cachedBalance) { showStatus(`Insufficient balance. Available: ₹${cachedBalance.toFixed(2)}`, 'error'); return; }
  if (!details) { showStatus('Please enter payment details', 'error'); return; }
  try {
    showStatus('Submitting withdrawal request...', 'info');
    const withdrawalData = { userId: currentUser.uid, email: currentUser.email, amount: amount, details: details, destination: details, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdAtClient: new Date().toISOString() };
    await db.collection('withdrawals').add(withdrawalData);
    if (amountInput) amountInput.value = '';
    if (detailsInput) detailsInput.value = '';
    showStatus(`Withdrawal request of ₹${amount} submitted successfully!`, 'success');
    setTimeout(updateWalletBalance, 2000);
  } catch (error) {
    console.error('❌ Withdrawal submission error:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

function setMaxAmount() {
  const amountInput = document.getElementById('withdrawAmount');
  if (amountInput && cachedBalance > 0) amountInput.value = cachedBalance;
}

function showQRModal() {
  const paymentText = prompt('Enter payment details for QR code (UPI ID or payment link):', 'your-upi-id@oksbi');
  if (!paymentText) return;
  if (!qrImg || !qrModal || !qrTitle || !qrNote) { alert('QR modal unavailable.'); return; }
  const encodedText = encodeURIComponent(paymentText);
  const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodedText}&choe=UTF-8`;
  qrImg.src = qrCodeUrl;
  qrModal.style.display = 'flex';
}

function closeQRModal() {
  if (qrModal) qrModal.style.display = 'none';
}

async function loadTransactionHistory() {
  if (!currentUser || !db) return;
  try {
    const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
      db.collection('deposits').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').get(),
      db.collection('withdrawals').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').get()
    ]);
    const transactions = [];
    depositsSnapshot.forEach(doc => transactions.push({ id: doc.id, type: 'deposit', amount: doc.data().amount, status: doc.data().status || 'pending', details: doc.data().utr || 'N/A', timestamp: doc.data().createdAt?.toDate() || new Date(doc.data().createdAtClient), createdAt: doc.data().createdAt }));
    withdrawalsSnapshot.forEach(doc => transactions.push({ id: doc.id, type: 'withdrawal', amount: doc.data().amount, status: doc.data().status || 'pending', details: doc.data().details || 'N/A', timestamp: doc.data().createdAt?.toDate() || new Date(doc.data().createdAtClient), createdAt: doc.data().createdAt }));
    transactions.sort((a, b) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
    renderTransactionHistory(transactions);
  } catch (error) {
    console.error('❌ History loading error:', error);
    const historyContent = document.getElementById('historyContent');
    if (historyContent) historyContent.innerHTML = `<div class="text-center muted" style="padding: 40px;"><p>Unable to load transaction history</p><button class="btn btn-secondary" onclick="loadTransactionHistory()">Try Again</button></div>`;
  }
}

function renderTransactionHistory(transactions) {
  const historyContent = document.getElementById('historyContent');
  if (!historyContent) return;
  if (transactions.length === 0) {
    historyContent.innerHTML = `<div class="text-center muted" style="padding: 40px;"><p>No transactions yet</p></div>`;
    return;
  }
  historyContent.innerHTML = `<div class="history-list">${transactions.map(tx => `<div class="history-item"><div class="history-info"><div class="history-type">${tx.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}<span class="history-status status-${tx.status}">${tx.status}</span></div><div class="history-details">${tx.details}</div><div class="muted">${tx.timestamp.toLocaleString()}</div></div><div class="history-amount ${tx.type === 'deposit' ? 'positive' : 'negative'}">${tx.type === 'deposit' ? '+' : '-'}₹${tx.amount}</div></div>`).join('')}</div>`;
}

function showStatus(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  if (type === 'success') setTimeout(clearStatus, 5000);
}

function clearStatus() {
  if (!statusMessage) return;
  statusMessage.className = 'status-message';
  statusMessage.textContent = '';
}

window.switchTab = switchTab;
window.renderTab = renderTab;
window.submitDeposit = submitDeposit;
window.submitWithdrawal = submitWithdrawal;
window.setMaxAmount = setMaxAmount;
window.showQRModal = showQRModal;
window.closeQRModal = closeQRModal;
window.loadTransactionHistory = loadTransactionHistory;
window.updateWalletBalance = updateWalletBalance;

document.addEventListener('DOMContentLoaded', initApp);