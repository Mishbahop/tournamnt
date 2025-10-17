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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;

// Firebase Auth State Listener
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;
    
    // Update user info in header
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = user.email;
    
    renderProfile(user);
    await loadingTournaments();
    await loadingArticles();
    await loadWallet();
});

// Profile Function
function renderProfile(user) {
    const myProfile = document.getElementById("my-profile");
    if (!myProfile) return;
    
    myProfile.innerHTML = `
    <div class="cart">
        <b>${user.email}</b>
        <div class="cart-meta">UID: ${user.uid}</div>
        <div class="cart-meta">Created: ${new Date(user.metadata.creationTime).toLocaleString()}</div>
        <div class="cart-meta">Last login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}</div>
        <button id="logout-btn" class="btn ghost">Logout</button>
    </div>`;
    
    // Add logout functionality
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await auth.signOut();
            window.location.href = "login.html";
        };
    }
}

// My Tournaments Function
async function loadingTournaments() {
    const container = document.getElementById("my-registrations");
    if (!container) return;
    
    container.innerHTML = '<div class="no-data">Loading tournaments...</div>';
    
    try {
        // Get user's tournament registrations
        const userTournamentsRef = db.collection("userTournaments").doc(currentUser.uid);
        const userDoc = await userTournamentsRef.get();
        
        if (!userDoc.exists) {
            container.innerHTML = '<div class="no-data">No tournaments registered</div>';
            return;
        }
        
        const userData = userDoc.data();
        const tournamentIds = userData.tournamentIds || [];
        
        if (tournamentIds.length === 0) {
            container.innerHTML = '<div class="no-data">No tournaments registered</div>';
            return;
        }
        
        // Fetch tournament details for each tournament ID
        const tournaments = [];
        for (const tournamentId of tournamentIds.slice(0, 10)) { // Limit to 10 tournaments
            try {
                const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
                if (tournamentDoc.exists) {
                    const tournamentData = tournamentDoc.data();
                    tournaments.push({
                        id: tournamentDoc.id,
                        name: tournamentData.name || 'Unknown Tournament',
                        game: tournamentData.game || 'Unknown Game',
                        status: tournamentData.status || 'upcoming',
                        prizePool: tournamentData.prizePool || 0,
                        entryFee: tournamentData.entryFee || 0,
                        startDate: tournamentData.startDate,
                        maxPlayers: tournamentData.maxPlayers || 0,
                        currentPlayers: tournamentData.currentPlayers || 0
                    });
                }
            } catch (error) {
                console.error(`Error fetching tournament ${tournamentId}:`, error);
            }
        }
        
        if (tournaments.length === 0) {
            container.innerHTML = '<div class="no-data">No tournaments found</div>';
            return;
        }
        
        // Render tournaments
        container.innerHTML = tournaments.map(tournament => `
            <div class="card">
                <h3>${tournament.name}</h3>
                <div class="card-meta">🎮 ${tournament.game}</div>
                <div class="card-meta">💰 Prize: $${tournament.prizePool.toLocaleString()}</div>
                <div class="card-meta">🎯 Status: <span class="status-${tournament.status}">${tournament.status}</span></div>
                <div class="card-meta">👥 Players: ${tournament.currentPlayers}/${tournament.maxPlayers}</div>
                <div class="action-row">
                    <button class="btn" onclick="viewTournament('${tournament.id}')">View Tournament</button>
                    <button class="btn ghost" onclick="leaveTournament('${tournament.id}')">Leave</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Error loading tournaments:", error);
        container.innerHTML = '<div class="no-data">Error loading tournaments</div>';
    }
}

// My Matches Function
async function loadingMatches() {
    const container = document.getElementById("my-matches");
    if (!container) return;
    
    container.innerHTML = '<div class="no-data">Loading matches...</div>';
    
    try {
        // Get matches where user is a participant
        const matchesRef = db.collection("matches")
            .where("participants", "array-contains", currentUser.uid)
            .orderBy("scheduledTime", "desc")
            .limit(5);
        
        const snapshot = await matchesRef.get();
        const matches = [];
        
        snapshot.forEach(doc => {
            const matchData = doc.data();
            matches.push({
                id: doc.id,
                tournamentId: matchData.tournamentId,
                tournamentName: matchData.tournamentName || 'Unknown Tournament',
                opponent: matchData.opponent || 'TBD',
                scheduledTime: matchData.scheduledTime,
                status: matchData.status || 'scheduled',
                round: matchData.round || 'Group Stage'
            });
        });
        
        if (matches.length === 0) {
            container.innerHTML = '<div class="no-data">No matches scheduled</div>';
            return;
        }
        
        // Render matches
        container.innerHTML = matches.map(match => `
            <div class="card">
                <h3>${match.tournamentName}</h3>
                <div class="card-meta">⚔️ vs ${match.opponent}</div>
                <div class="card-meta">📅 ${match.scheduledTime ? new Date(match.scheduledTime.toDate()).toLocaleString() : 'TBD'}</div>
                <div class="card-meta">🎯 Round: ${match.round}</div>
                <div class="card-meta">📊 Status: <span class="status-${match.status}">${match.status}</span></div>
                <div class="action-row">
                    <button class="btn" onclick="viewMatch('${match.id}')">Match Details</button>
                    ${match.status === 'scheduled' ? 
                        `<button class="btn ghost" onclick="joinMatch('${match.id}')">Ready to Play</button>` : 
                        ''
                    }
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Error loading matches:", error);
        container.innerHTML = '<div class="no-data">Error loading matches</div>';
    }
}

// Wallet Function
async function loadWallet() {
    const container = document.getElementById("wallet-balance");
    if (!container) return;
    
    container.innerHTML = '<div class="no-data">Loading wallet...</div>';
    
    try {
        // Get user's wallet
        const walletRef = db.collection("wallets").doc(currentUser.uid);
        const walletDoc = await walletRef.get();
        
        let balance = 0;
        let transactions = [];
        
        if (walletDoc.exists) {
            const walletData = walletDoc.data();
            balance = walletData.balance || 0;
            transactions = walletData.transactions || [];
        } else {
            // Create wallet if it doesn't exist
            await walletRef.set({
                balance: 0,
                transactions: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Render wallet
        container.innerHTML = `
            <div class="card">
                <h3>💰 Wallet Balance</h3>
                <div style="font-size: 2rem; font-weight: bold; color: var(--accent); margin: 1rem 0; text-align: center;">
                    $${balance.toFixed(2)}
                </div>
                <div class="action-row">
                    <button class="btn" onclick="depositFunds()">💳 Deposit</button>
                    <button class="btn" onclick="withdrawFunds()">🏧 Withdraw</button>
                    <button class="btn ghost" onclick="viewTransactionHistory()">📊 History</button>
                </div>
            </div>
            
            <div class="card">
                <h3>Recent Transactions</h3>
                ${transactions.length > 0 ? 
                    transactions.slice(0, 5).map(transaction => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--muted);">
                            <div style="flex: 1;">
                                <div style="font-weight: 500;">${transaction.description || 'Transaction'}</div>
                                <div style="font-size: 0.8rem; color: var(--muted);">
                                    ${transaction.date ? new Date(transaction.date.toDate()).toLocaleDateString() : 'Recent'}
                                </div>
                            </div>
                            <div style="font-weight: bold; color: ${transaction.amount >= 0 ? 'var(--ok)' : 'var(--danger)'}">
                                ${transaction.amount >= 0 ? '+' : ''}$${Math.abs(transaction.amount).toFixed(2)}
                            </div>
                        </div>
                    `).join('') :
                    '<div class="no-data" style="text-align: center; padding: 2rem;">No transactions yet</div>'
                }
            </div>
        `;
        
    } catch (error) {
        console.error("Error loading wallet:", error);
        container.innerHTML = '<div class="no-data">Error loading wallet</div>';
    }
}

// Articles Function (Placeholder)
async function loadingArticles() {
    console.log("Loading articles functionality...");
    // This can be implemented based on your articles structure
}

// Tab Management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tab functionality
    const tabs = document.querySelectorAll('.tab');
    const sections = {
        'my-tournaments': 'my-registrations-section',
        'my-matches': 'my-matches-section',
        'my-wallet': 'my-wallet-section',
        'my-profile': 'my-profile-section'
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.id.replace('tab-', '');
            const targetSection = sections[target];
            
            if (!targetSection) return;
            
            // Hide all sections
            Object.values(sections).forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (section) section.style.display = 'none';
            });
            
            // Show target section
            const activeSection = document.getElementById(targetSection);
            if (activeSection) {
                activeSection.style.display = 'block';
                
                // Load section-specific data
                switch(target) {
                    case 'my-matches':
                        loadingMatches();
                        break;
                    case 'my-wallet':
                        loadWallet();
                        break;
                    case 'my-tournaments':
                        loadingTournaments();
                        break;
                    case 'my-profile':
                        // Profile is already loaded
                        break;
                }
            }
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Set initial active tab
    const initialTab = document.getElementById('tab-my-tournaments');
    if (initialTab) initialTab.click();
});

// Action Functions
function viewTournament(tournamentId) {
    window.location.href = `../tournament/tournament-details.html?id=${tournamentId}`;
}

async function leaveTournament(tournamentId) {
    if (!confirm('Are you sure you want to leave this tournament? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Remove tournament from user's registered tournaments
        await db.collection("userTournaments").doc(currentUser.uid).update({
            tournamentIds: firebase.firestore.FieldValue.arrayRemove(tournamentId)
        });
        
        // Decrement player count in tournament
        await db.collection("tournaments").doc(tournamentId).update({
            currentPlayers: firebase.firestore.FieldValue.increment(-1)
        });
        
        // Show success message
        alert('Successfully left the tournament');
        
        // Reload tournaments
        await loadingTournaments();
        
    } catch (error) {
        console.error("Error leaving tournament:", error);
        alert('Error leaving tournament. Please try again.');
    }
}

function viewMatch(matchId) {
    window.location.href = `../tournament/match-details.html?id=${matchId}`;
}

async function joinMatch(matchId) {
    try {
        // Update match status to ready
        await db.collection("matches").doc(matchId).update({
            status: 'ready',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('You are now marked as ready for the match!');
        
        // Reload matches
        await loadingMatches();
        
    } catch (error) {
        console.error("Error joining match:", error);
        alert('Error joining match. Please try again.');
    }
}

function depositFunds() {
    const amount = prompt('Enter deposit amount ($):');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }
    
    const depositAmount = parseFloat(amount);
    
    // In a real app, this would integrate with a payment processor
    // For now, we'll simulate the deposit
    simulateDeposit(depositAmount);
}

function withdrawFunds() {
    const amount = prompt('Enter withdrawal amount ($):');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }
    
    const withdrawAmount = parseFloat(amount);
    
    // Check if user has sufficient balance
    // This would require getting current balance first
    alert(`Withdrawal request submitted for $${withdrawAmount.toFixed(2)}. This may take 1-3 business days to process.`);
}

function viewTransactionHistory() {
    alert('Transaction history page would open here');
    // window.location.href = "../wallet/transaction-history.html";
}

// Simulate deposit (for demo purposes)
async function simulateDeposit(amount) {
    try {
        const walletRef = db.collection("wallets").doc(currentUser.uid);
        
        // Add transaction
        await walletRef.update({
            balance: firebase.firestore.FieldValue.increment(amount),
            transactions: firebase.firestore.FieldValue.arrayUnion({
                amount: amount,
                description: 'Deposit',
                date: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'deposit',
                status: 'completed'
            })
        });
        
        alert(`Successfully deposited $${amount.toFixed(2)}!`);
        await loadWallet(); // Reload wallet display
        
    } catch (error) {
        console.error("Error processing deposit:", error);
        alert('Error processing deposit. Please try again.');
    }
}

// Utility function to format dates
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date.toDate()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Add some basic styles for status indicators
const style = document.createElement('style');
style.textContent = `
    .status-active { color: var(--ok); font-weight: bold; }
    .status-upcoming { color: var(--warning); font-weight: bold; }
    .status-completed { color: var(--muted); font-weight: bold; }
    .status-scheduled { color: var(--accent); font-weight: bold; }
    .status-ready { color: var(--ok); font-weight: bold; }
    .status-in-progress { color: var(--warning); font-weight: bold; }
`;
document.head.appendChild(style);

// Export functions for global access
window.viewTournament = viewTournament;
window.leaveTournament = leaveTournament;
window.viewMatch = viewMatch;
window.joinMatch = joinMatch;
window.depositFunds = depositFunds;
window.withdrawFunds = withdrawFunds;
window.viewTransactionHistory = viewTransactionHistory;

// Initialize the dashboard when page loads
console.log('Dashboard initialized');