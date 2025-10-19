// Global variables
let currentUser = null;
let tournamentsDb = null;

// Auth state observer
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;
    document.getElementById('user-name').textContent = user.email;
    tournamentsDb = firebase.firestore();
    await updateTournamentCounts();
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Game card click handlers
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const gameId = card.dataset.game;
            showGameCategories(gameId);
        });
    });

    // Check authentication status
    const user = firebase.auth().currentUser;
    if (user) {
        document.getElementById('user-name').textContent = user.email;
    }
});

// Show game categories
function showGameCategories(gameId) {
    const game = gameCategories[gameId];
    if (!game) return;

    // Update title
    document.getElementById('selected-game-name').textContent = `${game.fullName} Tournaments`;

    // Generate category cards
    const categoriesContainer = document.getElementById('categories-container');
    categoriesContainer.innerHTML = game.categories.map(category => `
        <div class="category-card" onclick="selectCategory('${gameId}', '${category.id}')">
            <div class="category-icon">${category.icon}</div>
            <h3 class="category-name">${category.name}</h3>
            <p class="category-description">${category.description}</p>
            <div class="category-meta">
                <div class="prize-pool">
                    <i class="fas fa-trophy"></i>
                    Prize: ${category.prizeRange}
                </div>
                <div class="entry-fee">
                    <i class="fas fa-ticket-alt"></i>
                    Entry: ${category.entryFee}
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
}

// Select tournament category
function selectCategory(gameId, categoryId) {
    window.location.href = `tournament-type.html?game=${gameId}&category=${categoryId}`;
}

// Update tournament counts from Firestore
async function updateTournamentCounts() {
    if (!tournamentsDb) return;
    
    try {
        const now = firebase.firestore.Timestamp.now();
        
        for (const gameId in gameCategories) {
            const tournamentsRef = tournamentsDb.collection('tournaments')
                .where('game', '==', gameId)
                .where('status', '==', 'active')
                .where('startTime', '>', now);
                
            const snapshot = await tournamentsRef.get();
            const count = snapshot.size;
            
            // Update count in UI
            const gameCard = document.querySelector(`.game-card[data-game="${gameId}"]`);
            if (gameCard) {
                const countElement = gameCard.querySelector('.tournament-count');
                if (countElement) {
                    countElement.textContent = `${count} Active`;
                }
            }
        }
    } catch (error) {
        console.error('Error updating tournament counts:', error);
    }
}

// Game categories configuration
const gameCategories = {
    bgmi: {
        name: "BGMI",
        fullName: "Battlegrounds Mobile India",
        categories: [
            {
                id: "solo",
                name: "Solo",
                icon: "👤",
                description: "Battle alone against 99 other players",
                prizeRange: "₹1,000 - ₹10,000",
                entryFee: "₹50 - ₹500"
            },
            {
                id: "duo",
                name: "Duo",
                icon: "👥",
                description: "Team up with a partner against 49 other teams",
                prizeRange: "₹2,000 - ₹20,000",
                entryFee: "₹100 - ₹1,000"
            },
            {
                id: "squad",
                name: "Squad",
                icon: "👥👥",
                description: "Form a team of 4 against 24 other squads",
                prizeRange: "₹4,000 - ₹40,000",
                entryFee: "₹200 - ₹2,000"
            }
        ]
    },
    freefire: {
        name: "Free Fire",
        fullName: "Garena Free Fire MAX",
        categories: [
            {
                id: "solo",
                name: "Solo",
                icon: "👤",
                description: "Battle alone in intense matches",
                prizeRange: "₹500 - ₹5,000",
                entryFee: "₹25 - ₹250"
            },
            {
                id: "duo",
                name: "Duo",
                icon: "👥",
                description: "Team up with a friend",
                prizeRange: "₹1,000 - ₹10,000",
                entryFee: "₹50 - ₹500"
            }
        ]
    },
    codm: {
        name: "COD Mobile",
        fullName: "Call of Duty: Mobile",
        categories: [
            {
                id: "mp",
                name: "Multiplayer",
                icon: "🎯",
                description: "5v5 team-based matches",
                prizeRange: "₹1,000 - ₹15,000",
                entryFee: "₹50 - ₹750"
            },
            {
                id: "br",
                name: "Battle Royale",
                icon: "🗺️",
                description: "100 player battle royale",
                prizeRange: "₹2,000 - ₹25,000",
                entryFee: "₹100 - ₹1,250"
            }
        ]
    },
    "8ballpool": {
        name: "8 Ball Pool",
        fullName: "Miniclip 8 Ball Pool",
        categories: [
            {
                id: "1v1",
                name: "1v1 Matches",
                icon: "🎱",
                description: "Head-to-head pool matches",
                prizeRange: "₹100 - ₹1,000",
                entryFee: "₹10 - ₹100"
            },
            {
                id: "tournament",
                name: "Tournament",
                icon: "🏆",
                description: "8-player knockout tournament",
                prizeRange: "₹500 - ₹5,000",
                entryFee: "₹50 - ₹500"
            }
        ]
    }
};