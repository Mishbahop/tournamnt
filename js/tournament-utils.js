// Tournament related utilities and shared functions
const TournamentUtils = {
    // Format currency in Indian Rupees
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    },

    // Format date and time
    formatDateTime: (date) => {
        return new Intl.DateTimeFormat('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    },

    // Generate a unique tournament ID
    generateTournamentId: () => {
        return 'T' + Date.now().toString(36).toUpperCase() + 
               Math.random().toString(36).substring(2, 7).toUpperCase();
    },

    // Validate game username
    validateGameUsername: (username) => {
        return username.length >= 3 && username.length <= 20 && 
               /^[a-zA-Z0-9_.-]+$/.test(username);
    },

    // Validate game ID
    validateGameId: (gameId) => {
        return /^\d{6,12}$/.test(gameId);
    },

    // Get status badge class
    getStatusBadgeClass: (status) => {
        const statusMap = {
            'active': 'status-badge active',
            'upcoming': 'status-badge upcoming',
            'completed': 'status-badge completed',
            'cancelled': 'status-badge danger'
        };
        return statusMap[status] || 'status-badge';
    },

    // Calculate time remaining
    getTimeRemaining: (targetDate) => {
        const total = Date.parse(targetDate) - Date.parse(new Date());
        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));
        
        return {
            total,
            days,
            hours,
            minutes,
            seconds
        };
    },

    // Format time remaining
    formatTimeRemaining: (timeObj) => {
        if (timeObj.total <= 0) {
            return 'Started';
        }
        if (timeObj.days > 0) {
            return `${timeObj.days}d ${timeObj.hours}h`;
        }
        if (timeObj.hours > 0) {
            return `${timeObj.hours}h ${timeObj.minutes}m`;
        }
        return `${timeObj.minutes}m ${timeObj.seconds}s`;
    },

    // Update countdown timer
    initializeCountdown: (elementId, targetDate) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const updateClock = () => {
            const t = TournamentUtils.getTimeRemaining(targetDate);
            element.textContent = TournamentUtils.formatTimeRemaining(t);

            if (t.total <= 0) {
                clearInterval(timeinterval);
            }
        };

        updateClock();
        const timeinterval = setInterval(updateClock, 1000);
        return timeinterval;
    },

    // Tournament entry fees
    entryFees: {
        'solo': {
            'beginner': 50,
            'intermediate': 100,
            'pro': 200
        },
        'duo': {
            'beginner': 100,
            'intermediate': 200,
            'pro': 400
        },
        'squad': {
            'beginner': 200,
            'intermediate': 400,
            'pro': 800
        }
    },

    // Prize pool calculation
    calculatePrizePool: (entryFee, maxTeams) => {
        const totalPool = entryFee * maxTeams;
        return {
            total: totalPool,
            firstPlace: Math.floor(totalPool * 0.5),
            secondPlace: Math.floor(totalPool * 0.3),
            thirdPlace: Math.floor(totalPool * 0.2)
        };
    },

    // Loading indicator
    showLoading: (containerId, message = 'Loading...') => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <div class="loading-text">${message}</div>
                </div>
            `;
        }
    },

    // Error handler
    handleError: (error, containerId = null) => {
        console.error('Tournament Error:', error);
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>${error.message || 'An error occurred. Please try again.'}</p>
                    </div>
                `;
            }
        }
        return false;
    },

    // Success message
    showSuccess: (message, containerId) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // Tournament validation
    validateTournamentData: (data) => {
        const errors = [];
        if (!data.title) errors.push('Tournament title is required');
        if (!data.startDate) errors.push('Start date is required');
        if (!data.maxTeams) errors.push('Maximum teams is required');
        if (!data.entryFee) errors.push('Entry fee is required');
        return errors;
    }
};

// Export the utilities for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentUtils;
}