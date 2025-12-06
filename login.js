// ==================== TOURNEYHUB AUTHENTICATION SYSTEM ====================
const TourneyHubAuth = (() => {
    // Private variables
    let _auth = null;
    let _db = null;
    let _googleAuthProvider = null;
    let _currentUser = null;
    let _loginAttempts = 0;
    let _lastFailedAttempt = null;

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

    // Browser detection utility
    const _browserDetector = {
        isChrome: () => {
            const userAgent = navigator.userAgent.toLowerCase();
            return /chrome/.test(userAgent) && !/edge|edg|opera|opr/.test(userAgent);
        },
        
        isFirefox: () => {
            return navigator.userAgent.toLowerCase().includes('firefox');
        },
        
        isSafari: () => {
            const userAgent = navigator.userAgent.toLowerCase();
            return /safari/.test(userAgent) && !/chrome/.test(userAgent);
        },
        
        isEdge: () => {
            return navigator.userAgent.toLowerCase().includes('edge');
        },
        
        isInAppBrowser: () => {
            const userAgent = navigator.userAgent.toLowerCase();
            return /fbav|instagram|twitter|snapchat|whatsapp|slack|discord|telegram|line|kakao/.test(userAgent) ||
                   userAgent.includes('wv') || // Android WebView
                   userAgent.includes('fb_iab'); // Facebook in-app browser
        },
        
        isMobile: () => {
            return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
                navigator.userAgent.toLowerCase()
            );
        },
        
        getBrowserName: () => {
            const ua = navigator.userAgent;
            if (/chrome/.test(ua.toLowerCase()) && !/edge/.test(ua.toLowerCase())) return 'Chrome';
            if (/firefox/.test(ua.toLowerCase())) return 'Firefox';
            if (/safari/.test(ua.toLowerCase()) && !/chrome/.test(ua.toLowerCase())) return 'Safari';
            if (/edge/.test(ua.toLowerCase())) return 'Edge';
            if (/opera|opr/.test(ua.toLowerCase())) return 'Opera';
            if (/trident/.test(ua.toLowerCase())) return 'Internet Explorer';
            return 'Unknown';
        }
    };

    // Custom Error Classes
    class AuthError extends Error {
        constructor(message, code, originalError = null) {
            super(message);
            this.name = 'AuthError';
            this.code = code;
            this.originalError = originalError;
            this.timestamp = Date.now();
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

    const _checkBruteForceProtection = () => {
        if (_lastFailedAttempt) {
            const timeDiff = Date.now() - _lastFailedAttempt;
            if (_loginAttempts >= 5 && timeDiff < 300000) {
                const waitTime = Math.floor((300000 - timeDiff) / 1000 / 60);
                throw new AuthError(
                    `Too many failed attempts. Try again in ${waitTime} minutes.`,
                    'BRUTE_FORCE_BLOCKED'
                );
            }
            if (timeDiff > 300000) {
                _loginAttempts = 0;
                _lastFailedAttempt = null;
            }
        }
    };

    const _showNotification = (message, type = 'info', options = {}) => {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now(),
            ...options
        };

        const event = new CustomEvent('auth-notification', {
            detail: notification,
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    const _handleAuthError = (error) => {
        let userMessage = 'Authentication failed';
        let action = null;

        switch (error.code) {
            case 'auth/user-not-found':
                userMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                userMessage = 'Incorrect password';
                _loginAttempts++;
                _lastFailedAttempt = Date.now();
                break;
            case 'auth/too-many-requests':
                userMessage = 'Too many failed attempts. Try again later.';
                break;
            case 'auth/network-request-failed':
                userMessage = 'Network error. Check your connection.';
                break;
            case 'auth/popup-blocked':
                userMessage = 'Popup blocked. Please allow popups or use email login.';
                break;
            case 'auth/operation-not-allowed':
                userMessage = 'Google sign-in is not enabled. Contact support.';
                break;
            default:
                if (error.message) {
                    userMessage = error.message;
                }
        }

        return { userMessage, action };
    };

    const _createUserSession = async (user, loginMethod) => {
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

    // Chrome redirection logic
    const _redirectToChrome = () => {
        const currentUrl = window.location.href;
        const isMobile = _browserDetector.isMobile();
        
        if (isMobile) {
            // Mobile devices
            const isAndroid = /android/i.test(navigator.userAgent);
            const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
            
            if (isAndroid) {
                // Android - try to open in Chrome using intent
                const chromeIntentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;package=com.android.chrome;scheme=https;end`;
                window.location.href = chromeIntentUrl;
                
                // Fallback - open Chrome on Play Store if not installed
                setTimeout(() => {
                    window.location.href = 'https://play.google.com/store/apps/details?id=com.android.chrome';
                }, 2000);
            } else if (isIOS) {
                // iOS - try to open in Chrome
                const chromeUrl = `googlechrome://${currentUrl}`;
                window.location.href = chromeUrl;
                
                // Fallback - open Chrome on App Store if not installed
                setTimeout(() => {
                    window.location.href = 'https://apps.apple.com/app/chrome/id535886823';
                }, 2000);
            }
        } else {
            // Desktop - show instructions to open in Chrome
            const message = `For best Google login experience, please use Google Chrome browser.\n\nClick OK to learn how to install Chrome.`;
            if (confirm(message)) {
                window.open('https://www.google.com/chrome/', '_blank');
            }
        }
        
        return false; // Indicate that redirection was attempted
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
                _checkBruteForceProtection();
                
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
                
                _loginAttempts = 0;
                _lastFailedAttempt = null;

                const userSession = await _createUserSession(userCredential.user, 'email');
                
                _showNotification('Login successful!', 'success');
                
                return {
                    success: true,
                    user: userSession
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'EMAIL_LOGIN_ERROR', error);
            }
        },

        async loginWithGoogle() {
            try {
                _checkBruteForceProtection();
                
                // Check if we need to redirect to Chrome
                if (!_browserDetector.isChrome()) {
                    if (_browserDetector.isInAppBrowser()) {
                        // In-app browser detected - force redirect to Chrome
                        return {
                            success: false,
                            requiresChrome: true,
                            browser: _browserDetector.getBrowserName(),
                            message: 'Google login requires Chrome browser'
                        };
                    } else if (!_browserDetector.isFirefox() && !_browserDetector.isSafari() && !_browserDetector.isEdge()) {
                        // Unsupported browser
                        return {
                            success: false,
                            requiresChrome: true,
                            browser: _browserDetector.getBrowserName(),
                            message: 'Please use Chrome for Google login'
                        };
                    }
                }

                // Try popup method
                try {
                    const result = await _auth.signInWithPopup(_googleAuthProvider);
                    const userSession = await _createUserSession(result.user, 'google');
                    
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
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'GOOGLE_LOGIN_ERROR', error);
            }
        },

        async handleRedirectResult() {
            try {
                const result = await _auth.getRedirectResult();
                if (result.user) {
                    const userSession = await _createUserSession(result.user, 'google_redirect');
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
                
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'REDIRECT_ERROR', error);
            }
        },

        // Chrome redirection methods
        redirectToChrome: () => {
            return _redirectToChrome();
        },

        checkBrowserCompatibility: () => {
            const isInApp = _browserDetector.isInAppBrowser();
            const isChrome = _browserDetector.isChrome();
            const browserName = _browserDetector.getBrowserName();
            
            return {
                isChrome,
                isInAppBrowser: isInApp,
                browserName,
                requiresChrome: isInApp || !isChrome,
                message: isInApp ? 
                    'You are using an in-app browser. For Google login, please open in Chrome.' :
                    !isChrome ? 
                        `You are using ${browserName}. For best Google login experience, please use Chrome.` :
                        'Browser is compatible'
            };
        },

        // Utility methods
        getBrowserInfo: () => {
            return {
                name: _browserDetector.getBrowserName(),
                isMobile: _browserDetector.isMobile(),
                isChrome: _browserDetector.isChrome(),
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

// ==================== UI MANAGER ====================
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

        const colorMap = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
            chrome: '#4285F4'
        };

        toastIcon.textContent = iconMap[type] || 'ℹ️';
        toastMessage.textContent = message;
        toast.style.backgroundColor = colorMap[type] || '#2196F3';

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

    const showChromeRedirectModal = (browserName, isMobile) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'chrome-modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(10px);
        `;

        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isAndroid = /android/i.test(navigator.userAgent);
        
        let instructions = '';
        if (isMobile) {
            if (isAndroid) {
                instructions = `
                    <p style="color: #a0a0c0; margin-bottom: 20px;">
                        <strong>Android Users:</strong><br>
                        1. Tap "Open in Chrome" below<br>
                        2. If Chrome is not installed, you'll be directed to Play Store<br>
                        3. Install Chrome and return to this page
                    </p>
                `;
            } else if (isIOS) {
                instructions = `
                    <p style="color: #a0a0c0; margin-bottom: 20px;">
                        <strong>iPhone/iPad Users:</strong><br>
                        1. Tap "Open in Chrome" below<br>
                        2. If Chrome is not installed, you'll be directed to App Store<br>
                        3. Install Chrome and return to this page
                    </p>
                `;
            }
        } else {
            instructions = `
                <p style="color: #a0a0c0; margin-bottom: 20px;">
                    <strong>Desktop Users:</strong><br>
                    1. Click "Install Chrome" to download Google Chrome<br>
                    2. Install Chrome on your computer<br>
                    3. Open this website in Chrome browser
                </p>
            `;
        }

        modalOverlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                text-align: center;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">🌐</div>
                <h2 style="margin: 0 0 15px 0; font-size: 1.8rem; color: white;">
                    Google Login Requires Chrome
                </h2>
                <div style="color: #ff6b6b; margin-bottom: 15px; font-weight: 600;">
                    Detected: ${browserName} Browser
                </div>
                <p style="color: #a0a0c0; margin-bottom: 10px;">
                    For secure Google authentication, please use Google Chrome browser.
                </p>
                ${instructions}
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                    <button id="chromeRedirectBtn" style="
                        padding: 15px 30px;
                        background: linear-gradient(45deg, #4285F4, #34A853);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        ${isMobile ? 'Open in Chrome' : 'Install Chrome'}
                    </button>
                    <button id="chromeCancelBtn" style="
                        padding: 15px 30px;
                        background: rgba(255, 255, 255, 0.07);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        color: white;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        Use Email Login Instead
                    </button>
                </div>
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <p style="color: #a0a0c0; font-size: 0.9rem;">
                        <span style="color: #4285F4;">Why Chrome?</span><br>
                        Google requires secure browsers for authentication. Chrome provides the best security and compatibility.
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const redirectBtn = modalOverlay.querySelector('#chromeRedirectBtn');
        const cancelBtn = modalOverlay.querySelector('#chromeCancelBtn');

        redirectBtn.addEventListener('click', () => {
            if (isMobile) {
                // Try to redirect to Chrome
                const success = TourneyHubAuth.redirectToChrome();
                if (!success) {
                    showNotification('Redirecting to Chrome...', 'info');
                }
            } else {
                // Open Chrome download page
                window.open('https://www.google.com/chrome/', '_blank');
                showNotification('Please install Chrome and return to this page.', 'info');
            }
            document.body.removeChild(modalOverlay);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            // Focus on email field for alternative login
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
        showChromeRedirectModal,
        showLoading,
        hideLoading
    };
})();

// ==================== EVENT MANAGER ====================
const TourneyHubEventManager = (() => {
    const _events = new Map();

    return {
        on(event, callback) {
            if (!_events.has(event)) {
                _events.set(event, []);
            }
            _events.get(event).push(callback);
            
            return () => {
                const callbacks = _events.get(event);
                if (callbacks) {
                    const index = callbacks.findIndex(cb => cb === callback);
                    if (index > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            };
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
        // Add CSS for animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
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
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
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
                transition: opacity 0.2s;
                padding: 0;
                margin-left: 10px;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
            
            .loading-screen {
                transition: opacity 0.5s ease;
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
        setupForgotPassword();

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

        // Log browser info
        console.log('Browser Info:', TourneyHubAuth.getBrowserInfo());
        console.log('✅ TourneyHub Authentication System Initialized');

    } catch (error) {
        console.error('Initialization error:', error);
        TourneyHubUIManager.showNotification(
            'Failed to initialize application. Please refresh.',
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
            // Check browser compatibility first
            const compatibility = TourneyHubAuth.checkBrowserCompatibility();
            
            if (compatibility.requiresChrome) {
                // Show Chrome redirect modal
                const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
                    navigator.userAgent.toLowerCase()
                );
                TourneyHubUIManager.showChromeRedirectModal(compatibility.browserName, isMobile);
                return;
            }
            
            // Browser is Chrome, proceed with Google login
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

function setupForgotPassword() {
    const forgotLink = document.getElementById('forgotPassword');
    
    if (!forgotLink) return;

    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const email = emailInput?.value.trim() || '';
        
        if (!email) {
            TourneyHubUIManager.showNotification(
                'Please enter your email in the email field first',
                'warning'
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
        
        TourneyHubUIManager.showLoading('Sending reset email...');
        
        try {
            // We'll implement password reset later
            TourneyHubUIManager.showNotification(
                'Password reset feature coming soon!',
                'info'
            );
        } finally {
            TourneyHubUIManager.hideLoading();
        }
    });
}

// ==================== GLOBAL EXPORTS ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;
window.TourneyHubEventManager = TourneyHubEventManager;