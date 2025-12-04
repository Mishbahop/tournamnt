// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Game categories configuration
const gameCategories = {
    bgmi: {
        name: "BGMI",
        fullName: "Battlegrounds Mobile India",
        image: "images/bgmi-logo.png",
        categories: [
            {
                id: "classic-solo",
                name: "Classic Solo",
                icon: "👤",
                description: "Solo Battle Royale matches on Erangel, Miramar, or Sanhok",
                prizeRange: "💎1,000 - 💎10,000",
                entryFee: "💎50 - 💎500",
                minLevel: 30
            },
            {
                id: "classic-duo",
                name: "Classic Duo",
                icon: "👥",
                description: "Team up with a partner in intense 2-player matches",
                prizeRange: "💎2,000 - 💎20,000",
                entryFee: "💎100 - 💎1,000",
                minLevel: 25
            },
            {
                id: "classic-squad",
                name: "Classic Squad",
                icon: "👥👥",
                description: "4-player squad battles for ultimate team supremacy",
                prizeRange: "💎4,000 - 💎40,000",
                entryFee: "💎200 - 💎2,000",
                minLevel: 20
            },
            {
                id: "tdm",
                name: "TDM",
                icon: "⚔️",
                description: "Fast-paced 4v4 Team Deathmatch tournaments",
                prizeRange: "💎1,000 - 💎5,000",
                entryFee: "💎50 - 💎250",
                minLevel: 15
            }
        ]
    },
    freefire: {
        name: "Free Fire",
        fullName: "Garena Free Fire MAX",
        image: "images/freefire-logo.png",
        categories: [
            {
                id: "battle-royale-solo",
                name: "BR Solo",
                icon: "👤",
                description: "50-player Battle Royale solo matches",
                prizeRange: "💎500 - 💎5,000",
                entryFee: "💎25 - 💎250",
                minLevel: 20
            },
            {
                id: "battle-royale-duo",
                name: "BR Duo",
                icon: "👥",
                description: "25 teams of 2 battle for victory",
                prizeRange: "💎1,000 - 💎10,000",
                entryFee: "💎50 - 💎500",
                minLevel: 15
            },
            {
                id: "clash-squad",
                name: "Clash Squad",
                icon: "⚔️",
                description: "4v4 round-based elimination matches",
                prizeRange: "💎800 - 💎8,000",
                entryFee: "💎40 - 💎400",
                minLevel: 10
            }
        ]
    },
    codm: {
        name: "COD Mobile",
        fullName: "Call of Duty: Mobile",
        image: "images/codm-logo.png",
        categories: [
            {
                id: "multiplayer",
                name: "Multiplayer",
                icon: "🎯",
                description: "5v5 competitive multiplayer tournaments",
                prizeRange: "💎1,000 - 💎15,000",
                entryFee: "💎50 - 💎750",
                minLevel: 20
            },
            {
                id: "battle-royale",
                name: "Battle Royale",
                icon: "🗺️",
                description: "100-player Battle Royale matches",
                prizeRange: "💎2,000 - 💎25,000",
                entryFee: "💎100 - 💎1,250",
                minLevel: 15
            }
        ]
    },
    "8ballpool": {
        name: "8 Ball Pool",
        fullName: "Miniclip 8 Ball Pool",
        image: "images/8ballpool-logo.png",
        categories: [
            {
                id: "1v1-standard",
                name: "1v1 Standard",
                icon: "🎱",
                description: "Standard rules 1v1 matches",
                prizeRange: "💎100 - 💎1,000",
                entryFee: "💎10 - 💎100",
                minLevel: 10
            },
            {
                id: "1v1-quick",
                name: "1v1 Quick Fire",
                icon: "⚡",
                description: "Quick fire 1v1 matches with time limits",
                prizeRange: "💎200 - 💎2,000",
                entryFee: "💎20 - 💎200",
                minLevel: 15
            }
        ]
    }
};

// Global variables
let currentUser = null;
let currentGame = null;

// Auth state observer
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;
    
    // Initialize tournament counts
    await updateTournamentCounts();
});

// Event listeners for game selection
document.addEventListener('DOMContentLoaded', () => {
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            const game = card.dataset.game;
            showGameCategories(game);
        });
    });

    // Logout handler
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    });
});

// Update tournament counts
async function updateTournamentCounts() {
    try {
        const now = firebase.firestore.Timestamp.now();
        
        for (const gameId in gameCategories) {
            const tournamentsRef = db.collection('tournaments')
                .where('game', '==', gameId)
                .where('status', '==', 'active')
                .where('startTime', '>', now);
                
            const snapshot = await tournamentsRef.get();
            const count = snapshot.size;
            
            updateGameCardStatus(gameId, count);
        }
    } catch (error) {
        console.error('Error updating tournament counts:', error);
    }
}

// Update game card status
function updateGameCardStatus(gameId, count) {
    const gameCard = document.querySelector(`.game-card[data-game="${gameId}"]`);
    if (!gameCard) return;

    const countElement = gameCard.querySelector('.tournament-count');
    const statusElement = gameCard.querySelector('.game-status');

    if (countElement) {
        countElement.textContent = `${count} Active Tournament${count !== 1 ? 's' : ''}`;
    }

    if (statusElement) {
        const icon = statusElement.querySelector('i');
        if (count > 0) {
            statusElement.style.color = 'var(--tournament-success)';
            icon.className = 'fas fa-circle';
            statusElement.innerHTML = `${icon.outerHTML} Live`;
        } else {
            statusElement.style.color = 'var(--tournament-text-secondary)';
            icon.className = 'far fa-circle';
            statusElement.innerHTML = `${icon.outerHTML} No Events`;
        }
    }
}

// Show game categories
function showGameCategories(gameId) {
    currentGame = gameId;
    const game = gameCategories[gameId];
    
    if (!game) {
        console.error('Game not found:', gameId);
        return;
    }
    
    // Update header
    document.getElementById('selected-game-name').textContent = game.fullName;
    
    // Generate category cards
    const categoriesContainer = document.getElementById('categories-container');
    categoriesContainer.innerHTML = game.categories.map(category => `
        <div class="category-card slide-up" onclick="selectCategory('${gameId}', '${category.id}')">
            <div class="category-icon">${category.icon}</div>
            <h3 class="category-name">${category.name}</h3>
            <p class="category-details">${category.description}</p>
            <div class="category-meta">
                <div class="prize-range">
                    <i class="fas fa-trophy"></i> ${category.prizeRange}
                </div>
                <div class="entry-fee">
                    <i class="fas fa-ticket-alt"></i> ${category.entryFee}
                </div>
            </div>
        </div>
    `).join('');
    
    // Show categories section
    document.getElementById('game-selection').classList.add('hidden');
    document.getElementById('game-categories').classList.remove('hidden');
}

// Go back to games
function goBackToGames() {
    document.getElementById('game-selection').classList.remove('hidden');
    document.getElementById('game-categories').classList.add('hidden');
    currentGame = null;
}

// Select category
async function selectCategory(gameId, categoryId) {
    try {
        const game = gameCategories[gameId];
        const category = game.categories.find(c => c.id === categoryId);
        
        if (!game || !category) {
            console.error('Invalid game or category');
            return;
        }
        
        // Redirect to tournament type selection
        window.location.href = `tournament-type.html?game=${gameId}&category=${categoryId}`;
        
    } catch (error) {
        console.error('Error selecting category:', error);
        TournamentUtils.handleError(error, 'categories-container');
    }
}