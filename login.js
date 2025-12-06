// ==================== SIMPLIFIED TOURNEYHUB AUTHENTICATION ====================
const TourneyHubAuth = (() => {
    // Private variables
    let _auth = null;
    let _db = null;
    let _googleAuthProvider = null;
    let _currentUser = null;

    // Firebase configuration
    const _firebaseConfig = {
        apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
        authDomain: "authapp-386ee.firebaseapp.com",
        projectId: "authapp-386ee",
        storageBucket: "authapp-386ee.appspot.com",
        messagingSenderId: "809698525310",
        appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
        measurementId: "G-EJZTSBSGQT"
    };

    // Simple browser detection
    const _browserDetector = {
        isInAppBrowser: () => {
            const ua = navigator.userAgent.toLowerCase();
            return /fbav|instagram|twitter|snapchat|whatsapp|slack|discord|telegram|line|kakao/.test(ua) ||
                   ua.includes('wv') || // WebView
                   ua.includes('fb_iab'); // Facebook in-app browser
        },
        
        getBrowserName: () => {
            const ua = navigator.userAgent;
            if (/chrome/.test(ua.toLowerCase()) && !/edge/.test(ua.toLowerCase())) return 'Chrome';
            if (/firefox/.test(ua.toLowerCase())) return 'Firefox';
            if (/safari/.test(ua.toLowerCase()) && !/chrome/.test(ua.toLowerCase())) return 'Safari';
            if (/edge/.test(ua.toLowerCase())) return 'Edge';
            if (/opera|opr/.test(ua.toLowerCase())) return 'Opera';
            if (/trident/.test(ua.toLowerCase())) return 'Internet Explorer';
            return 'Browser';
        }
    };

    // Custom Error Class
    class AuthError extends Error {
        constructor(message, code, originalError = null) {
            super(message);
            this.name = 'AuthError';
            this.code = code;
            this.originalError = originalError;
        }
    }

    // Private methods
    const _initializeFirebase = () => {
        return new Promise((resolve, reject) => {
            try {
                if (!firebase.apps.length) {
                    const app = firebase.initializeApp(_firebaseConfig);
                    
                    _auth = firebase.auth();
                    _db = firebase.firestore();
                    _googleAuthProvider = new firebase.auth.GoogleAuthProvider();
                    
                    _googleAuthProvider.addScope('email');
                    _googleAuthProvider.addScope('profile');
                    _googleAuthProvider.setCustomParameters({
                        prompt: 'select_account'
                    });
                    
                    resolve(app);
                } else {
                    _auth = firebase.auth();
                    _db = firebase.firestore();
                    resolve(firebase.app());
                }
            } catch (error) {
                reject(new AuthError('Firebase initialization failed', 'INIT_ERROR', error));
            }
        });
    };

    const _showNotification = (message, type = 'info') => {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now()
        };

        const event = new CustomEvent('auth-notification', {
            detail: notification,
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    const _handleAuthError = (error) => {
        let userMessage = 'Authentication failed';
        
        switch (error.code) {
            case 'auth/user-not-found':
                userMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                userMessage = 'Incorrect password';
                break;
            case 'auth/too-many-requests':
                userMessage = 'Too many failed attempts. Try again later.';
                break;
            case 'auth/network-request-failed':
                userMessage = 'Network error. Check your connection.';
                break;
            case 'auth/popup-blocked':
                userMessage = 'Popup blocked. Please use email login.';
                break;
            default:
                userMessage = error.message || 'Authentication failed';
        }

        return userMessage;
    };

    const _createUserSession = (user, loginMethod) => {
        try {
            _currentUser = user;
            
            localStorage.setItem('tourneyhub_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                loginMethod,
                lastLogin: Date.now()
            }));
            
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
        } catch (error) {
            console.error('Session creation failed:', error);
            throw new AuthError('Session creation failed', 'SESSION_ERROR', error);
        }
    };

    // SIMPLE SOLUTION: Open in browser directly
    const _openInBrowser = () => {
        const currentUrl = window.location.href;
        
        // Try to open in a new tab/window
        const newWindow = window.open(currentUrl, '_blank');
        
        if (!newWindow) {
            // If popup blocked, show instructions
            return {
                success: false,
                message: 'Popup blocked. Please allow popups or copy the link below and open in Chrome/Safari browser.',
                url: currentUrl
            };
        }
        
        return { success: true };
    };

    // SIMPLE SOLUTION 2: Show link to copy
    const _showLinkToCopy = () => {
        const currentUrl = window.location.href;
        
        return {
            url: currentUrl,
            message: 'Please copy this link and open in Chrome/Safari browser:',
            copyable: true
        };
    };

    // Public API
    return {
        // Initialization
        async init() {
            try {
                await _initializeFirebase();
                return { success: true };
            } catch (error) {
                console.error('TourneyHub Auth initialization failed:', error);
                return { success: false, error };
            }
        },

        // Authentication Methods
        async loginWithEmail(email, password, rememberMe = false) {
            try {
                if (!email || !password) {
                    throw new AuthError('Email and password are required');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new AuthError('Invalid email format', 'email');
                }

                const persistence = rememberMe ? 
                    firebase.auth.Auth.Persistence.LOCAL : 
                    firebase.auth.Auth.Persistence.SESSION;
                
                await _auth.setPersistence(persistence);

                const userCredential = await _auth.signInWithEmailAndPassword(email, password);
                
                const userSession = _createUserSession(userCredential.user, 'email');
                
                _showNotification('Login successful!', 'success');
                
                return {
                    success: true,
                    user: userSession
                };
            } catch (error) {
                const userMessage = _handleAuthError(error);
                throw new AuthError(userMessage, error.code || 'EMAIL_LOGIN_ERROR', error);
            }
        },

        async loginWithGoogle() {
            try {
                // Check if we're in an in-app browser
                if (_browserDetector.isInAppBrowser()) {
                    return {
                        success: false,
                        requiresBrowser: true,
                        browserInfo: {
                            isInApp: true,
                            name: _browserDetector.getBrowserName()
                        },
                        message: 'Google login requires Chrome or Safari browser.',
                        linkInfo: _showLinkToCopy()
                    };
                }

                // Try popup method
                try {
                    const result = await _auth.signInWithPopup(_googleAuthProvider);
                    const userSession = _createUserSession(result.user, 'google');
                    
                    _showNotification('Google login successful!', 'success');
                    
                    return {
                        success: true,
                        user: userSession,
                        method: 'popup'
                    };
                } catch (popupError) {
                    // If popup fails, try redirect
                    if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
                        await _auth.signInWithRedirect(_googleAuthProvider);
                        return {
                            success: true,
                            method: 'redirect',
                            message: 'Redirecting to Google...'
                        };
                    }
                    throw popupError;
                }
            } catch (error) {
                const userMessage = _handleAuthError(error);
                throw new AuthError(userMessage, error.code || 'GOOGLE_LOGIN_ERROR', error);
            }
        },

        async handleRedirectResult() {
            try {
                const result = await _auth.getRedirectResult();
                if (result.user) {
                    const userSession = _createUserSession(result.user, 'google_redirect');
                    return {
                        success: true,
                        user: userSession
                    };
                }
                return { success: false, message: 'No redirect result' };
            } catch (error) {
                if (error.code === 'auth/no-redirect-result') {
                    return { success: false, message: 'No redirect result' };
                }
                
                const userMessage = _handleAuthError(error);
                throw new AuthError(userMessage, error.code || 'REDIRECT_ERROR', error);
            }
        },

        // SIMPLE: Just open in browser
        openInBrowser: () => {
            return _openInBrowser();
        },

        // SIMPLE: Get link to copy
        getLinkForBrowser: () => {
            return _showLinkToCopy();
        },

        // Check browser
        checkBrowser: () => {
            return {
                isInApp: _browserDetector.isInAppBrowser(),
                browserName: _browserDetector.getBrowserName(),
                userAgent: navigator.userAgent
            };
        },

        // Getters
        getCurrentUser() {
            return _currentUser;
        },

        getAuthInstance() {
            return _auth;
        }
    };
})();

// ==================== SIMPLE UI MANAGER ====================
const TourneyHubUIManager = (() => {
    let _isLoading = false;

    const showNotification = (message, type = 'info', options = {}) => {
        const toast = document.getElementById('notificationToast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        const toastClose = document.getElementById('toastClose');

        if (!toast || !toastIcon || !toastMessage) return;

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toastIcon.textContent = iconMap[type] || 'ℹ️';
        toastMessage.textContent = message;
        toast.classList.add('show');

        const duration = options.duration || 5000;
        setTimeout(() => {
            hideNotification();
        }, duration);

        if (toastClose) {
            const closeHandler = () => {
                hideNotification();
                toastClose.removeEventListener('click', closeHandler);
            };
            toastClose.addEventListener('click', closeHandler);
        }
    };

    const hideNotification = () => {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.classList.remove('show');
        }
    };

    const showBrowserModal = (browserInfo, linkInfo) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'browser-modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(10px);
        `;

        modalOverlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                text-align: center;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">🌐</div>
                <h2 style="margin: 0 0 15px 0; font-size: 1.5rem; color: white;">
                    Open in Browser
                </h2>
                
                <div style="
                    background: rgba(255, 107, 107, 0.1);
                    border: 1px solid rgba(255, 107, 107, 0.2);
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 20px;
                ">
                    <div style="color: #ff6b6b; font-weight: 600; margin-bottom: 5px;">
                        Detected: ${browserInfo.name}
                    </div>
                    <div style="color: #a0a0c0; font-size: 0.9rem;">
                        Google login requires Chrome or Safari browser.
                    </div>
                </div>
                
                <div style="margin-bottom: 25px; text-align: left;">
                    <div style="color: #a0a0c0; margin-bottom: 10px;">
                        <strong>Simple Solution:</strong>
                    </div>
                    <div style="
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 8px;
                        padding: 15px;
                        margin-bottom: 15px;
                        overflow: hidden;
                    ">
                        <div style="color: #a0a0c0; margin-bottom: 8px; font-size: 0.9rem;">
                            Copy this link and open in Chrome/Safari:
                        </div>
                        <code style="
                            color: #6bcf7f;
                            font-size: 0.85rem;
                            word-break: break-all;
                            display: block;
                            background: rgba(0, 0, 0, 0.5);
                            padding: 10px;
                            border-radius: 5px;
                            margin-bottom: 10px;
                        " id="copyable-link">${linkInfo.url}</code>
                        <button id="copyLinkBtn" style="
                            width: 100%;
                            padding: 12px;
                            background: linear-gradient(45deg, #4285F4, #34A853);
                            border: none;
                            border-radius: 8px;
                            color: white;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 1rem;
                        ">
                            📋 Copy Link
                        </button>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                    <button id="openBrowserBtn" style="
                        flex: 1;
                        padding: 15px 20px;
                        background: linear-gradient(45deg, #6bcf7f, #4ca1af);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        Try to Open in Browser
                    </button>
                    <button id="cancelBtn" style="
                        padding: 15px 20px;
                        background: rgba(255, 255, 255, 0.07);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        color: white;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        Use Email Login
                    </button>
                </div>
                
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="color: #a0a0c0; font-size: 0.85rem; line-height: 1.5;">
                        <span style="color: #6bcf7f; font-weight: 600;">Tip:</span><br>
                        1. Copy the link above<br>
                        2. Open Chrome or Safari browser<br>
                        3. Paste the link and login with Google
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const copyLinkBtn = modalOverlay.querySelector('#copyLinkBtn');
        const openBrowserBtn = modalOverlay.querySelector('#openBrowserBtn');
        const cancelBtn = modalOverlay.querySelector('#cancelBtn');

        copyLinkBtn.addEventListener('click', () => {
            const linkText = modalOverlay.querySelector('#copyable-link').textContent;
            navigator.clipboard.writeText(linkText).then(() => {
                copyLinkBtn.textContent = '✓ Copied!';
                copyLinkBtn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
                
                setTimeout(() => {
                    copyLinkBtn.textContent = '📋 Copy Link';
                    copyLinkBtn.style.background = 'linear-gradient(45deg, #4285F4, #34A853)';
                }, 2000);
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = linkText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyLinkBtn.textContent = '✓ Copied!';
                copyLinkBtn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
                
                setTimeout(() => {
                    copyLinkBtn.textContent = '📋 Copy Link';
                    copyLinkBtn.style.background = 'linear-gradient(45deg, #4285F4, #34A853)';
                }, 2000);
            });
        });

        openBrowserBtn.addEventListener('click', () => {
            const result = TourneyHubAuth.openInBrowser();
            if (!result.success) {
                showNotification(result.message, 'warning');
            } else {
                showNotification('Opening in browser...', 'info');
            }
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
            }, 1000);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            const emailInput = document.getElementById('login-email');
            if (emailInput) {
                emailInput.focus();
            }
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        });
    };

    const showLoading = (message = 'Loading...') => {
        if (_isLoading) return;
        _isLoading = true;
        
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            const subtitle = loadingScreen.querySelector('.loading-subtitle');
            if (subtitle) {
                subtitle.textContent = message;
            }
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
    };

    const hideLoading = () => {
        _isLoading = false;
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    };

    return {
        showNotification,
        hideNotification,
        showBrowserModal,
        showLoading,
        hideLoading
    };
})();

// ==================== SIMPLE EVENT MANAGER ====================
const TourneyHubEventManager = (() => {
    const _events = new Map();

    return {
        on(event, callback) {
            if (!_events.has(event)) {
                _events.set(event, []);
            }
            _events.get(event).push(callback);
        },

        emit(event, data = null) {
            if (_events.has(event)) {
                const callbacks = _events.get(event);
                callbacks.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event handler for "${event}":`, error);
                    }
                });
            }
        }
    };
})();

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Add minimal CSS
        const style = document.createElement('style');
        style.textContent = `
            .notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 10px;
                color: white;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10001;
                transform: translateX(150%);
                transition: transform 0.3s ease;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                background: #2196F3;
            }
            
            .notification-toast.show {
                transform: translateX(0);
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .toast-icon {
                font-size: 1.2rem;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                opacity: 0.7;
                padding: 0;
                margin-left: 10px;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
            
            .loading-screen {
                transition: opacity 0.5s ease;
            }
            
            .browser-modal-overlay {
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Initialize authentication
        const initResult = await TourneyHubAuth.init();
        
        if (!initResult.success) {
            throw new Error('Failed to initialize authentication');
        }

        // Setup event listeners
        TourneyHubEventManager.on('auth-notification', (event) => {
            TourneyHubUIManager.showNotification(
                event.detail.message,
                event.detail.type
            );
        });

        TourneyHubEventManager.on('auth-success', (data) => {
            TourneyHubUIManager.showNotification(
                'Login successful! Redirecting...',
                'success'
            );
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        });

        TourneyHubEventManager.on('auth-error', (error) => {
            TourneyHubUIManager.showNotification(
                error.message || 'Authentication failed',
                'error'
            );
        });

        // Check for redirect result
        try {
            const redirectResult = await TourneyHubAuth.handleRedirectResult();
            if (redirectResult.success) {
                TourneyHubEventManager.emit('auth-success', redirectResult);
                return;
            }
        } catch (error) {
            // Ignore redirect errors
        }

        // Check existing session
        const user = TourneyHubAuth.getCurrentUser();
        if (user) {
            window.location.href = 'index.html';
            return;
        }

        // Setup DOM elements
        setupLoginForm();
        setupGoogleButton();

        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);

        console.log('✅ TourneyHub Login System Ready');

    } catch (error) {
        console.error('Initialization error:', error);
        TourneyHubUIManager.showNotification(
            'Failed to initialize. Please refresh.',
            'error'
        );
        
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
});

// ==================== DOM SETUP FUNCTIONS ====================
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const passwordToggle = document.getElementById('passwordToggle');
    const rememberMe = document.getElementById('rememberMe');

    if (!loginForm) return;

    // Load remembered email
    const savedEmail = localStorage.getItem('tourneyhub_remember_email');
    const savedRemember = localStorage.getItem('tourneyhub_remember_me') === 'true';
    
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
    }
    if (rememberMe) {
        rememberMe.checked = savedRemember;
    }

    // Password toggle
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = passwordToggle.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
            }
        });
    }

    // Form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const remember = rememberMe ? rememberMe.checked : false;

        if (!email || !password) {
            TourneyHubUIManager.showNotification(
                'Please fill in all fields',
                'error'
            );
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            TourneyHubUIManager.showNotification(
                'Please enter a valid email address',
                'error'
            );
            return;
        }

        // Save remember me
        if (remember) {
            localStorage.setItem('tourneyhub_remember_email', email);
            localStorage.setItem('tourneyhub_remember_me', 'true');
        } else {
            localStorage.removeItem('tourneyhub_remember_email');
            localStorage.removeItem('tourneyhub_remember_me');
        }

        TourneyHubUIManager.showLoading('Authenticating...');
        
        try {
            const result = await TourneyHubAuth.loginWithEmail(email, password, remember);
            TourneyHubEventManager.emit('auth-success', result);
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            TourneyHubUIManager.hideLoading();
        }
    });
}

function setupGoogleButton() {
    const googleBtn = document.getElementById('googleSignInNewWindow');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            // Check browser first
            const browserCheck = TourneyHubAuth.checkBrowser();
            
            if (browserCheck.isInApp) {
                // In-app browser - show modal with link to copy
                const linkInfo = TourneyHubAuth.getLinkForBrowser();
                TourneyHubUIManager.showBrowserModal(browserCheck, linkInfo);
                return;
            }
            
            // Regular browser - try Google login
            TourneyHubUIManager.showLoading('Opening Google login...');
            googleBtn.disabled = true;
            
            try {
                const result = await TourneyHubAuth.loginWithGoogle();
                
                if (result.method === 'redirect') {
                    // Redirect initiated
                    return;
                }
                
                TourneyHubEventManager.emit('auth-success', result);
            } catch (error) {
                TourneyHubEventManager.emit('auth-error', error);
            } finally {
                TourneyHubUIManager.hideLoading();
                googleBtn.disabled = false;
            }
        });
    }
}

// ==================== GLOBAL EXPORTS ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;