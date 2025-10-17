// Firebase configuration
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

// Global variables
let currentUser = null;

// Firebase Auth State Listener
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "../login/login.html";
        return;
    }
    
    currentUser = user;
    
    // Update user info in header
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = user.email;
    
    renderProfile(user);
    await loadLiveTournaments();
    await loadMyTournaments();
    await loadMyMatches();
    await loadWallet();
});

// Profile Function
function renderProfile(user) {
    const myProfile = document.getElementById("my-profile");
    if (!myProfile) return;
    
    myProfile.innerHTML = `
    <div class="card">
        <h3>👤 Profile Information</h3>
        <div class="profile-info">
            <div class="info-item">
                <span class="info-label">Email:</span>
                <span class="info-value">${user.email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">User ID:</span>
                <span class="info-value">${user.uid}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Account Created:</span>
                <span class="info-value">${new Date(user.metadata.creationTime).toLocaleString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Last Login:</span>
                <span class="info-value">${new Date(user.metadata.lastSignInTime).toLocaleString()}</span>
            </div>
        </div>
        <button id="logout-btn" class="btn btn-danger">🚪 Logout</button>
    </div>`;
    
    // Add logout functionality
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await auth.signOut();
            window.location.href = "../login/login.html";
        };
    }
}

// Load Live Tournaments Function
async function loadLiveTournaments() {
    const container = document.getElementById("live-tournaments");
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading live tournaments...</div>';
    
    try {
        // Get all live tournaments
        const tournamentsRef = db.collection("tournaments")
            .where("status", "==", "live")
            .orderBy("startDate", "asc")
            .limit(10);
        
        const snapshot = await tournamentsRef.get();
        const tournaments = [];
        
        snapshot.forEach(doc => {
            const tournamentData = doc.data();
            tournaments.push({
                id: doc.id,
                name: tournamentData.name || 'Unknown Tournament',
                game: tournamentData.game || 'Unknown Game',
                status: tournamentData.status || 'live',
                prizePool: tournamentData.prizePool || 0,
                entryFee: tournamentData.entryFee || 0,
                startDate: tournamentData.startDate,
                maxPlayers: tournamentData.maxPlayers || 0,
                currentPlayers: tournamentData.currentPlayers || 0,
                format: tournamentData.format || 'Single Elimination',
                rules: tournamentData.rules || '',
                platform: tournamentData.platform || 'Cross-platform'
            });
        });
        
        if (tournaments.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🎮</div>
                    <h3>No Live Tournaments</h3>
                    <p>There are no tournaments currently live. Check back later!</p>
                </div>
            `;
            return;
        }
        
        // Render live tournaments
        container.innerHTML = tournaments.map(tournament => `
            <div class="tournament-card live-tournament">
                <div class="tournament-header">
                    <div class="tournament-game">
                        <div class="game-icon">${getGameIcon(tournament.game)}</div>
                        <div class="game-info">
                            <div class="game-name">${tournament.game}</div>
                            <div class="game-category">${tournament.format}</div>
                        </div>
                    </div>
                    <div class="tournament-status status-live">
                        <span class="live-pulse"></span>
                        LIVE
                    </div>
                </div>
                
                <div class="tournament-body">
                    <h3 class="tournament-title">${tournament.name}</h3>
                    
                    <div class="tournament-details">
                        <div class="tournament-detail">
                            <span class="detail-icon">💰</span>
                            <span>Prize: $${tournament.prizePool.toLocaleString()}</span>
                        </div>
                        <div class="tournament-detail">
                            <span class="detail-icon">🎫</span>
                            <span>Entry: $${tournament.entryFee}</span>
                        </div>
                        <div class="tournament-detail">
                            <span class="detail-icon">👥</span>
                            <span>${tournament.currentPlayers}/${tournament.maxPlayers} Players</span>
                        </div>
                        <div class="tournament-detail">
                            <span class="detail-icon">🎯</span>
                            <span>${tournament.platform}</span>
                        </div>
                    </div>
                    
                    <div class="tournament-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(tournament.currentPlayers / tournament.maxPlayers) * 100}%"></div>
                        </div>
                        <div class="progress-text">${Math.round((tournament.currentPlayers / tournament.maxPlayers) * 100)}% filled</div>
                    </div>
                </div>
                
                <div class="tournament-footer">
                    <div class="tournament-timer">
                        <span class="timer-icon">⏰</span>
                        <span>Started: ${tournament.startDate ? formatDate(tournament.startDate) : 'Now'}</span>
                    </div>
                    <div class="tournament-actions">
                        <button class="btn btn-primary" onclick="joinTournament('${tournament.id}')">
                            🎮 Join Now
                        </button>
                        <button class="btn btn-secondary" onclick="viewTournamentDetails('${tournament.id}')">
                            📊 Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Error loading live tournaments:", error);
        container.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">⚠️</div>
                <h3>Error Loading Tournaments</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Load My Tournaments Function
async function loadMyTournaments() {
    const container = document.getElementById("my-tournaments");
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading your tournaments...</div>';
    
    try {
        // Get user's tournament registrations
        const userTournamentsRef = db.collection("userTournaments").doc(currentUser.uid);
        const userDoc = await userTournamentsRef.get();
        
        if (!userDoc.exists) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🏆</div>
                    <h3>No Tournaments Joined</h3>
                    <p>Join tournaments from the Live Tournaments section!</p>
                </div>
            `;
            return;
        }
        
        const userData = userDoc.data();
        const tournamentIds = userData.tournamentIds || [];
        
        if (tournamentIds.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🏆</div>
                    <h3>No Tournaments Joined</h3>
                    <p>Join tournaments from the Live Tournaments section!</p>
                </div>
            `;
            return;
        }
        
        // Fetch tournament details for each tournament ID
        const tournaments = [];
        for (const tournamentId of tournamentIds.slice(0, 10)) {
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
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🏆</div>
                    <h3>No Tournaments Found</h3>
                    <p>Join tournaments from the Live Tournaments section!</p>
                </div>
            `;
            return;
        }
        
        // Render tournaments
        container.innerHTML = tournaments.map(tournament => `
            <div class="tournament-card my-tournament">
                <div class="tournament-header">
                    <div class="tournament-game">
                        <div class="game-icon">${getGameIcon(tournament.game)}</div>
                        <div class="game-info">
                            <div class="game-name">${tournament.game}</div>
                            <div class="game-category">Tournament</div>
                        </div>
                    </div>
                    <div class="tournament-status status-${tournament.status}">
                        ${tournament.status.toUpperCase()}
                    </div>
                </div>
                
                <div class="tournament-body">
                    <h3 class="tournament-title">${tournament.name}</h3>
                    
                    <div class="tournament-details">
                        <div class="tournament-detail">
                            <span class="detail-icon">💰</span>
                            <span>Prize: $${tournament.prizePool.toLocaleString()}</span>
                        </div>
                        <div class="tournament-detail">
                            <span class="detail-icon">👥</span>
                            <span>${tournament.currentPlayers}/${tournament.maxPlayers} Players</span>
                        </div>
                        <div class="tournament-detail">
                            <span class="detail-icon">📅</span>
                            <span>${tournament.startDate ? formatDate(tournament.startDate) : 'TBD'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="tournament-footer">
                    <div class="tournament-actions">
                        <button class="btn btn-primary" onclick="viewTournamentDetails('${tournament.id}')">
                            View Details
                        </button>
                        ${tournament.status === 'upcoming' ? 
                            `<button class="btn btn-danger" onclick="leaveTournament('${tournament.id}')">
                                Leave
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Error loading tournaments:", error);
        container.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">⚠️</div>
                <h3>Error Loading Tournaments</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Load My Matches Function
async function loadMyMatches() {
    const container = document.getElementById("my-matches");
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading your matches...</div>';
    
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
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">⚔️</div>
                    <h3>No Matches Scheduled</h3>
                    <p>Your matches will appear here once tournaments begin.</p>
                </div>
            `;
            return;
        }
        
        // Render matches
        container.innerHTML = matches.map(match => `
            <div class="match-card">
                <div class="match-header">
                    <h4>${match.tournamentName}</h4>
                    <span class="match-round">${match.round}</span>
                </div>
                
                <div class="match-body">
                    <div class="match-vs">
                        <div class="player you">
                            <span class="player-name">You</span>
                            <span class="player-status">Ready</span>
                        </div>
                        <div class="vs">VS</div>
                        <div class="player opponent">
                            <span class="player-name">${match.opponent}</span>
                            <span class="player-status">Waiting</span>
                        </div>
                    </div>
                    
                    <div class="match-info">
                        <div class="match-detail">
                            <span class="detail-icon">📅</span>
                            <span>${match.scheduledTime ? formatDate(match.scheduledTime) : 'TBD'}</span>
                        </div>
                        <div class="match-detail">
                            <span class="detail-icon">📊</span>
                            <span class="status-${match.status}">${match.status}</span>
                        </div>
                    </div>
                </div>
                
                <div class="match-actions">
                    <button class="btn btn-primary" onclick="viewMatchDetails('${match.id}')">
                        Match Details
                    </button>
                    ${match.status === 'scheduled' ? 
                        `<button class="btn btn-success" onclick="readyForMatch('${match.id}')">
                            Ready to Play
                        </button>` : 
                        ''
                    }
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Error loading matches:", error);
        container.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">⚠️</div>
                <h3>Error Loading Matches</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Wallet Function
async function loadWallet() {
    const container = document.getElementById("wallet-balance");
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading wallet...</div>';
    
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
            <div class="wallet-card">
                <div class="wallet-header">
                    <h3>💰 Wallet Balance</h3>
                    <div class="balance-amount">$${balance.toFixed(2)}</div>
                </div>
                
                <div class="wallet-actions">
                    <button class="btn btn-primary" onclick="depositFunds()">
                        💳 Deposit
                    </button>
                    <button class="btn btn-secondary" onclick="withdrawFunds()">
                        🏧 Withdraw
                    </button>
                    <button class="btn btn-outline" onclick="viewTransactionHistory()">
                        📊 History
                    </button>
                </div>
            </div>
            
            <div class="transactions-card">
                <h4>Recent Transactions</h4>
                ${transactions.length > 0 ? 
                    transactions.slice(0, 5).map(transaction => `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-description">
                                    ${transaction.description || 'Transaction'}
                                </div>
                                <div class="transaction-date">
                                    ${transaction.date ? formatDate(transaction.date) : 'Recent'}
                                </div>
                            </div>
                            <div class="transaction-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
                                ${transaction.amount >= 0 ? '+' : ''}$${Math.abs(transaction.amount).toFixed(2)}
                            </div>
                        </div>
                    `).join('') :
                    '<div class="no-transactions">No transactions yet</div>'
                }
            </div>
        `;
        
    } catch (error) {
        console.error("Error loading wallet:", error);
        container.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">⚠️</div>
                <h3>Error Loading Wallet</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Join Tournament Function
async function joinTournament(tournamentId) {
    if (!currentUser) return;
    
    try {
        // Check if user already registered
        const userTournamentsRef = db.collection("userTournaments").doc(currentUser.uid);
        const userDoc = await userTournamentsRef.get();
        
        let tournamentIds = [];
        if (userDoc.exists) {
            const userData = userDoc.data();
            tournamentIds = userData.tournamentIds || [];
            
            if (tournamentIds.includes(tournamentId)) {
                alert('You are already registered for this tournament!');
                return;
            }
        }
        
        // Get tournament details to check entry fee and capacity
        const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
        if (!tournamentDoc.exists) {
            alert('Tournament not found!');
            return;
        }
        
        const tournamentData = tournamentDoc.data();
        
        // Check if tournament is full
        if (tournamentData.currentPlayers >= tournamentData.maxPlayers) {
            alert('This tournament is already full!');
            return;
        }
        
        // Check if user has enough balance for entry fee
        const walletRef = db.collection("wallets").doc(currentUser.uid);
        const walletDoc = await walletRef.get();
        const userBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
        
        if (userBalance < tournamentData.entryFee) {
            alert(`Insufficient balance! You need $${tournamentData.entryFee} to join this tournament.`);
            return;
        }
        
        // Deduct entry fee and register user
        await walletRef.update({
            balance: firebase.firestore.FieldValue.increment(-tournamentData.entryFee),
            transactions: firebase.firestore.FieldValue.arrayUnion({
                amount: -tournamentData.entryFee,
                description: `Entry fee for ${tournamentData.name}`,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'tournament_entry'
            })
        });
        
        // Add user to tournament
        await userTournamentsRef.set({
            tournamentIds: firebase.firestore.FieldValue.arrayUnion(tournamentId),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Update tournament player count
        await db.collection("tournaments").doc(tournamentId).update({
            currentPlayers: firebase.firestore.FieldValue.increment(1)
        });
        
        alert('Successfully joined the tournament!');
        
        // Reload data
        await loadLiveTournaments();
        await loadMyTournaments();
        await loadWallet();
        
    } catch (error) {
        console.error("Error joining tournament:", error);
        alert('Error joining tournament. Please try again.');
    }
}

// Helper Functions
function getGameIcon(gameName) {
    const gameIcons = {
        'valorant': '🎯',
        'free fire': '🔥',
        'cod mobile': '🎮',
        'bgmi': '🏹',
        'pubg': '🎯',
        'fortnite': '🏰',
        'csgo': '🔫',
        'dota': '⚔️',
        'lol': '⚡'
    };
    
    const lowerGame = gameName.toLowerCase();
    return gameIcons[lowerGame] || '🎮';
}

function formatDate(date) {
    if (!date) return 'TBD';
    
    try {
        if (date.toDate) {
            return date.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

// Tab Management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tab functionality
    const tabs = document.querySelectorAll('.tab');
    const sections = {
        'live-tournaments': 'live-tournaments-section',
        'my-tournaments': 'my-tournaments-section',
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
                
                // Load section-specific data if needed
                switch(target) {
                    case 'live-tournaments':
                        loadLiveTournaments();
                        break;
                    case 'my-tournaments':
                        loadMyTournaments();
                        break;
                    case 'my-matches':
                        loadMyMatches();
                        break;
                    case 'my-wallet':
                        loadWallet();
                        break;
                }
            }
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Set initial active tab
    const initialTab = document.getElementById('tab-live-tournaments');
    if (initialTab) initialTab.click();
});

// Action Functions (keep your existing ones)
function viewTournamentDetails(tournamentId) {
    window.location.href = `../tournament/tournament-details.html?id=${tournamentId}`;
}

async function leaveTournament(tournamentId) {
    if (!confirm('Are you sure you want to leave this tournament? Entry fee will not be refunded.')) {
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
        
        alert('Successfully left the tournament');
        await loadMyTournaments();
        await loadLiveTournaments();
        
    } catch (error) {
        console.error("Error leaving tournament:", error);
        alert('Error leaving tournament. Please try again.');
    }
}

function viewMatchDetails(matchId) {
    window.location.href = `../tournament/match-details.html?id=${matchId}`;
}

async function readyForMatch(matchId) {
    try {
        await db.collection("matches").doc(matchId).update({
            status: 'ready',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('You are now marked as ready for the match!');
        await loadMyMatches();
        
    } catch (error) {
        console.error("Error updating match status:", error);
        alert('Error updating match status. Please try again.');
    }
}

function depositFunds() {
    const amount = prompt('Enter deposit amount ($):');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }
    
    const depositAmount = parseFloat(amount);
    simulateDeposit(depositAmount);
}

function withdrawFunds() {
    const amount = prompt('Enter withdrawal amount ($):');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }
    
    const withdrawAmount = parseFloat(amount);
    alert(`Withdrawal request submitted for $${withdrawAmount.toFixed(2)}. This may take 1-3 business days to process.`);
}

function viewTransactionHistory() {
    alert('Transaction history page would open here');
}

async function simulateDeposit(amount) {
    try {
        const walletRef = db.collection("wallets").doc(currentUser.uid);
        
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
        await loadWallet();
        
    } catch (error) {
        console.error("Error processing deposit:", error);
        alert('Error processing deposit. Please try again.');
    }
}

// Export functions for global access
window.joinTournament = joinTournament;
window.viewTournamentDetails = viewTournamentDetails;
window.leaveTournament = leaveTournament;
window.viewMatchDetails = viewMatchDetails;
window.readyForMatch = readyForMatch;
window.depositFunds = depositFunds;
window.withdrawFunds = withdrawFunds;
window.viewTransactionHistory = viewTransactionHistory;

console.log('Tournament dashboard initialized');