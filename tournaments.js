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
let currentFilter = 'all';
let urlParams = new URLSearchParams(window.location.search);
let selectedGame = urlParams.get('game');
let selectedCategory = urlParams.get('category');
let selectedType = urlParams.get('type');

// Auth state observer
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    await loadTournaments();
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadTournaments();
        });
    });
});

// Load tournaments from Firestore
async function loadTournaments() {
    try {
        const tournamentsContainer = document.getElementById('tournaments-list');
        tournamentsContainer.innerHTML = '<div class="loading">Loading tournaments...</div>';

        // Build query
        let query = db.collection('tournaments')
            .where('createdByRole', '==', 'admin');
        if (selectedGame) {
            query = query.where('game', '==', selectedGame);
        }
        query = query.where('status', '==', 'active');

        // Execute query
        const snapshot = await query.get();

        if (snapshot.empty) {
            tournamentsContainer.innerHTML = `
                <div class="no-tournaments">
                    <i class="fas fa-trophy fa-3x"></i>
                    <p>No live tournaments found for this game</p>
                </div>
            `;
            return;
        }

        // Render tournaments
        const tournamentsHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return createTournamentCard(doc.id, data);
        }).join('');

        tournamentsContainer.innerHTML = tournamentsHTML;

        // Add click handlers
        document.querySelectorAll('.tournament-card').forEach(card => {
            card.addEventListener('click', () => {
                const tournamentId = card.dataset.id;
                window.location.href = `tournament-details.html?id=${tournamentId}`;
            });
        });

    } catch (error) {
        console.error('Error loading tournaments:', error);
        document.getElementById('tournaments-list').innerHTML = `
            <div class="error">
                Error loading tournaments. Please try again later.
            </div>
        `;
    }
}

// Update page title based on selected game and category
function updatePageTitle() {
    const title = document.getElementById('tournament-title');
    const subtitle = document.getElementById('tournament-subtitle');
    
    if (!selectedGame || !selectedCategory) {
        title.textContent = 'All Tournaments';
        subtitle.textContent = 'Browse all available tournaments';
        return;
    }

    // Get game info from URL parameters
    const gameName = decodeURIComponent(selectedGame).toUpperCase();
    const categoryName = decodeURIComponent(selectedCategory)
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    title.textContent = `${gameName} - ${categoryName} Tournaments`;
    subtitle.textContent = `Browse available ${categoryName} tournaments for ${gameName}`;
}

// Create tournament card HTML
function createTournamentCard(id, tournament) {
    const startDate = tournament.startDate.toDate();
    const statusClass = `status-${tournament.status.toLowerCase()}`;
    
    return `
        <div class="tournament-card" data-id="${id}">
            <div class="tournament-info">
                <h3 class="tournament-title">${tournament.title}</h3>
                <div class="tournament-meta">
                    <span class="tournament-status ${statusClass}">
                        ${tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                    </span>
                    <span class="tournament-time">
                        <i class="far fa-clock"></i>
                        ${formatDate(startDate)}
                    </span>
                </div>
            </div>
            <div class="tournament-details">
                <div>
                    <span class="text-secondary">Teams:</span>
                    ${tournament.registeredTeams}/${tournament.maxTeams}
                </div>
                <div>
                    <span class="text-secondary">Match Type:</span>
                    ${tournament.matchType}
                </div>
                <div>
                    <span class="text-secondary">Map:</span>
                    ${tournament.map}
                </div>
            </div>
            <div class="tournament-action">
                <div class="prize-pool">₹${tournament.prizePool}</div>
                <div class="entry-fee">Entry: ₹${tournament.entryFee}</div>
                <button class="join-btn">View Details</button>
            </div>
        </div>
    `;
}

// Format date for display
function formatDate(date) {
    const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Logout function
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
});