// ==================== ADVANCED TOURNEYHUB AUTHENTICATION SYSTEM ====================
const TourneyHubAuth = (() => {
    // Private variables
    let _auth = null;
    let _db = null;
    let _googleAuthProvider = null;
    let _currentUser = null;
    let _authStateListener = null;
    let _isInitialized = false;
    let _redirectAttempted = false;

    // Session storage keys
    const STORAGE_KEYS = {
        USER: 'tourneyhub_user',
        REMEMBER_ME: 'tourneyhub_remember_me',
        REMEMBER_EMAIL: 'tourneyhub_remember_email',
        SESSION_TOKEN: 'tourneyhub_session_token',
        LAST_LOGIN_METHOD: 'tourneyhub_last_login_method',
        REDIRECT_URL: 'tourneyhub_redirect_url'
    };

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

    // Browser detection
    const _browserDetector = {
        isInAppBrowser: () => {
            const ua = navigator.userAgent.toLowerCase();
            return /fbav|instagram|twitter|snapchat|whatsapp|slack|discord|telegram|line|kakao/.test(ua) ||
                   ua.includes('wv') ||
                   ua.includes('fb_iab');
        },
        
        getBrowserName: () => {
            const ua = navigator.userAgent;
            if (/chrome/.test(ua.toLowerCase()) && !/edge/.test(ua.toLowerCase())) return 'Chrome';
            if (/firefox/.test(ua.toLowerCase())) return 'Firefox';
            if (/safari/.test(ua.toLowerCase()) && !/chrome/.test(ua.toLowerCase())) return 'Safari';
            if (/edge/.test(ua.toLowerCase())) return 'Edge';
            if (/opera|opr/.test(ua.toLowerCase())) return 'Opera';
            if (/trident/.test(ua.toLowerCase())) return 'Internet Explorer';
            return 'Unknown Browser';
        },
        
        isMobile: () => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
    };

    // Custom Error Class
    class AuthError extends Error {
        constructor(message, code, originalError = null) {
            super(message);
            this.name = 'AuthError';
            this.code = code;
            this.originalError = originalError;
            this.timestamp = Date.now();
        }
    }

    // Session Manager
    const _sessionManager = {
        createSession: (user, loginMethod) => {
            try {
                const sessionData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    loginMethod: loginMethod,
                    lastLogin: Date.now(),
                    sessionToken: _generateSessionToken(),
                    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                };
                
                // Store session data
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionData));
                localStorage.setItem(STORAGE_KEYS.LAST_LOGIN_METHOD, loginMethod);
                localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionData.sessionToken);
                
                // Store in sessionStorage for immediate access
                sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sessionData));
                
                _currentUser = sessionData;
                return sessionData;
            } catch (error) {
                console.error('Session creation failed:', error);
                throw new AuthError('Session creation failed', 'SESSION_ERROR', error);
            }
        },
        
        restoreSession: () => {
            try {
                const sessionData = localStorage.getItem(STORAGE_KEYS.USER);
                if (!sessionData) return null;
                
                const user = JSON.parse(sessionData);
                
                // Check if session is expired
                if (user.expiresAt && user.expiresAt < Date.now()) {
                    _sessionManager.clearSession();
                    return null;
                }
                
                // Verify session token
                const storedToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
                if (!storedToken || storedToken !== user.sessionToken) {
                    _sessionManager.clearSession();
                    return null;
                }
                
                _currentUser = user;
                return user;
            } catch (error) {
                console.error('Session restoration failed:', error);
                _sessionManager.clearSession();
                return null;
            }
        },
        
        clearSession: () => {
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
            localStorage.removeItem(STORAGE_KEYS.LAST_LOGIN_METHOD);
            sessionStorage.removeItem(STORAGE_KEYS.USER);
            _currentUser = null;
        },
        
        refreshSession: () => {
            const user = _sessionManager.restoreSession();
            if (user) {
                // Extend session
                user.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
                _currentUser = user;
            }
            return user;
        }
    };

    // Helper functions
    const _generateSessionToken = () => {
        return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };

    const _showNotification = (message, type = 'info') => {
        const event = new CustomEvent('auth-notification', {
            detail: { message, type, timestamp: Date.now() },
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    const _handleAuthError = (error) => {
        const errorMap = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/too-many-requests': 'Too many failed attempts. Try again later.',
            'auth/network-request-failed': 'Network error. Check your connection.',
            'auth/popup-blocked': 'Popup blocked. Please use email login.',
            'auth/popup-closed-by-user': 'Login popup was closed',
            'auth/cancelled-popup-request': 'Login cancelled',
            'auth/account-exists-with-different-credential': 'Account exists with different credentials'
        };
        
        return errorMap[error.code] || error.message || 'Authentication failed';
    };

    const _getRedirectUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || localStorage.getItem(STORAGE_KEYS.REDIRECT_URL);
        return redirect || 'index.html';
    };

    const _saveRedirectUrl = (url) => {
        localStorage.setItem(STORAGE_KEYS.REDIRECT_URL, url);
    };

    const _initializeFirebase = async () => {
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
                
                return app;
            } else {
                _auth = firebase.auth();
                _db = firebase.firestore();
                return firebase.app();
            }
        } catch (error) {
            throw new AuthError('Firebase initialization failed', 'INIT_ERROR', error);
        }
    };

    const _setupAuthStateListener = () => {
        if (_authStateListener) return;
        
        _authStateListener = _auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in with Firebase
                const loginMethod = localStorage.getItem(STORAGE_KEYS.LAST_LOGIN_METHOD) || 'firebase';
                const userSession = _sessionManager.createSession(firebaseUser, loginMethod);
                
                // Check if we need to redirect after successful login
                if (!_redirectAttempted) {
                    _redirectAttempted = true;
                    setTimeout(() => {
                        _performRedirect(userSession);
                    }, 500);
                }
            } else {
                // User is signed out
                _currentUser = null;
            }
        });
    };

    const _performRedirect = (userData) => {
        const redirectUrl = _getRedirectUrl();
        
        // Clear redirect URL
        localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        
        // Store user in global context for immediate access
        window.tourneyHubUser = userData;
        
        // Show success message
        _showNotification(`Welcome back, ${userData.displayName || userData.email}!`, 'success');
        
        // Redirect after short delay
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1000);
    };

    const _openInBrowser = () => {
        const currentUrl = window.location.href;
        const newWindow = window.open(currentUrl, '_blank');
        
        if (!newWindow) {
            return {
                success: false,
                message: 'Popup blocked. Please allow popups or copy the link below.',
                url: currentUrl
            };
        }
        
        return { success: true };
    };

    // Public API
    return {
        // Initialization
        async init() {
            try {
                if (_isInitialized) return { success: true, user: _currentUser };
                
                await _initializeFirebase();
                _setupAuthStateListener();
                
                // Check for existing session
                const restoredUser = _sessionManager.restoreSession();
                
                // Check for redirect result
                if (!restoredUser && !_redirectAttempted) {
                    await this.handleRedirectResult();
                }
                
                _isInitialized = true;
                return { 
                    success: true, 
                    user: restoredUser,
                    isAuthenticated: !!restoredUser
                };
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

                // Save remember me preference
                if (rememberMe) {
                    localStorage.setItem(STORAGE_KEYS.REMEMBER_EMAIL, email);
                    localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
                } else {
                    localStorage.removeItem(STORAGE_KEYS.REMEMBER_EMAIL);
                    localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'false');
                }

                // Set persistence
                const persistence = rememberMe ? 
                    firebase.auth.Auth.Persistence.LOCAL : 
                    firebase.auth.Auth.Persistence.SESSION;
                
                await _auth.setPersistence(persistence);

                const userCredential = await _auth.signInWithEmailAndPassword(email, password);
                _sessionManager.createSession(userCredential.user, 'email');
                
                return {
                    success: true,
                    user: _currentUser,
                    rememberMe: rememberMe
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
                            name: _browserDetector.getBrowserName(),
                            isMobile: _browserDetector.isMobile()
                        },
                        message: 'Google login requires Chrome or Safari browser.',
                        solution: 'copy_link'
                    };
                }

                let result;
                
                // Try popup method first
                try {
                    result = await _auth.signInWithPopup(_googleAuthProvider);
                } catch (popupError) {
                    // If popup fails, try redirect
                    if (popupError.code === 'auth/popup-blocked' || 
                        popupError.code === 'auth/popup-closed-by-user') {
                        
                        // Save current URL for redirect back
                        _saveRedirectUrl(window.location.href);
                        await _auth.signInWithRedirect(_googleAuthProvider);
                        
                        return {
                            success: true,
                            method: 'redirect',
                            message: 'Redirecting to Google...'
                        };
                    }
                    throw popupError;
                }

                // Handle successful popup login
                _sessionManager.createSession(result.user, 'google');
                
                return {
                    success: true,
                    user: _currentUser,
                    method: 'popup'
                };
            } catch (error) {
                const userMessage = _handleAuthError(error);
                throw new AuthError(userMessage, error.code || 'GOOGLE_LOGIN_ERROR', error);
            }
        },

        async handleRedirectResult() {
            try {
                if (_redirectAttempted) return { success: false, message: 'Redirect already processed' };
                
                const result = await _auth.getRedirectResult();
                if (result.user) {
                    _sessionManager.createSession(result.user, 'google_redirect');
                    _redirectAttempted = true;
                    return {
                        success: true,
                        user: _currentUser,
                        method: 'redirect'
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

        // Session Management
        getCurrentUser() {
            return _currentUser || _sessionManager.restoreSession();
        },

        isAuthenticated() {
            return !!this.getCurrentUser();
        },

        async logout() {
            try {
                if (_auth) {
                    await _auth.signOut();
                }
                _sessionManager.clearSession();
                window.tourneyHubUser = null;
                return { success: true };
            } catch (error) {
                console.error('Logout failed:', error);
                // Still clear local session even if Firebase logout fails
                _sessionManager.clearSession();
                return { success: false, error };
            }
        },

        // Remember Me functionality
        getRememberMeData() {
            return {
                email: localStorage.getItem(STORAGE_KEYS.REMEMBER_EMAIL) || '',
                rememberMe: localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true'
            };
        },

        // Browser utilities
        openInBrowser: _openInBrowser,
        
        getLinkForBrowser: () => {
            return {
                url: window.location.href,
                message: 'Copy this link and open in Chrome/Safari:',
                timestamp: Date.now()
            };
        },

        checkBrowser: () => {
            return {
                isInApp: _browserDetector.isInAppBrowser(),
                browserName: _browserDetector.getBrowserName(),
                isMobile: _browserDetector.isMobile(),
                userAgent: navigator.userAgent
            };
        },

        // Getters
        getAuthInstance() {
            return _auth;
        },
        
        getFirestoreInstance() {
            return _db;
        }
    };
})();

// ==================== ADVANCED UI MANAGER ====================
const TourneyHubUIManager = (() => {
    let _isLoading = false;
    let _activeModal = null;

    const showNotification = (message, type = 'info', options = {}) => {
        const toast = document.getElementById('notificationToast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        const toastClose = document.getElementById('toastClose');

        if (!toast || !toastIcon || !toastMessage) return;

        // Set icon and color
        const settings = {
            success: { icon: '✅', color: '#4CAF50' },
            error: { icon: '❌', color: '#F44336' },
            warning: { icon: '⚠️', color: '#FF9800' },
            info: { icon: 'ℹ️', color: '#2196F3' }
        }[type] || { icon: 'ℹ️', color: '#2196F3' };

        toastIcon.textContent = settings.icon;
        toastMessage.textContent = message;
        toast.style.backgroundColor = settings.color;
        toast.classList.add('show');

        // Auto-hide
        const duration = options.duration || 5000;
        const hideTimer = setTimeout(() => {
            hideNotification();
        }, duration);

        // Close button
        if (toastClose) {
            const closeHandler = () => {
                clearTimeout(hideTimer);
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
        if (_activeModal) return;
        
        const modalId = 'browser-modal-' + Date.now();
        _activeModal = modalId;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = modalId;
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
            animation: modalFadeIn 0.3s ease;
        `;

        modalOverlay.innerHTML = `
            <div class="browser-modal" style="
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                text-align: center;
                animation: modalSlideIn 0.3s ease;
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
                        Detected: ${browserInfo.name} ${browserInfo.isMobile ? '(Mobile)' : ''}
                    </div>
                    <div style="color: #a0a0c0; font-size: 0.9rem;">
                        Google login requires Chrome or Safari browser.
                    </div>
                </div>
                
                <div style="margin-bottom: 25px; text-align: left;">
                    <div style="color: #a0a0c0; margin-bottom: 10px;">
                        <strong>Solution:</strong>
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
                        <div style="position: relative;">
                            <code style="
                                color: #6bcf7f;
                                font-size: 0.85rem;
                                word-break: break-all;
                                display: block;
                                background: rgba(0, 0, 0, 0.5);
                                padding: 10px 40px 10px 10px;
                                border-radius: 5px;
                                margin-bottom: 10px;
                                border: 1px solid rgba(255, 255, 255, 0.1);
                            " id="copyable-link-${modalId}">${linkInfo.url}</code>
                            <button id="quickCopyBtn-${modalId}" style="
                                position: absolute;
                                right: 10px;
                                top: 10px;
                                background: rgba(255, 255, 255, 0.1);
                                border: none;
                                border-radius: 4px;
                                color: white;
                                padding: 4px 8px;
                                cursor: pointer;
                                font-size: 0.8rem;
                            ">Copy</button>
                        </div>
                        <button id="copyLinkBtn-${modalId}" style="
                            width: 100%;
                            padding: 12px;
                            background: linear-gradient(45deg, #4285F4, #34A853);
                            border: none;
                            border-radius: 8px;
                            color: white;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 1rem;
                            margin-top: 10px;
                        ">
                            📋 Copy Link & Instructions
                        </button>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                    <button id="openBrowserBtn-${modalId}" style="
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
                    <button id="cancelBtn-${modalId}" style="
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
                        <span style="color: #6bcf7f; font-weight: 600;">Instructions:</span><br>
                        1. Copy the link above<br>
                        2. Open Chrome or Safari browser<br>
                        3. Paste the link in address bar<br>
                        4. Login with Google
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Copy functionality
        const copyToClipboard = (text) => {
            const fullText = `${text}\n\nInstructions:\n1. Open Chrome or Safari browser\n2. Paste this link in address bar\n3. Login with Google\n\nIf login doesn't work, try:\n- Clear browser cache\n- Enable third-party cookies\n- Use incognito mode`;
            
            navigator.clipboard.writeText(fullText).then(() => {
                showNotification('Link and instructions copied!', 'success');
            }).catch(() => {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = fullText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showNotification('Link copied!', 'success');
            });
        };

        // Event listeners
        modalOverlay.querySelector(`#quickCopyBtn-${modalId}`).addEventListener('click', () => {
            const linkText = modalOverlay.querySelector(`#copyable-link-${modalId}`).textContent;
            copyToClipboard(linkText);
        });

        modalOverlay.querySelector(`#copyLinkBtn-${modalId}`).addEventListener('click', () => {
            const linkText = modalOverlay.querySelector(`#copyable-link-${modalId}`).textContent;
            copyToClipboard(linkText);
        });

        modalOverlay.querySelector(`#openBrowserBtn-${modalId}`).addEventListener('click', () => {
            const result = TourneyHubAuth.openInBrowser();
            if (!result.success) {
                showNotification(result.message, 'warning');
            } else {
                showNotification('Opening in browser...', 'info');
                setTimeout(() => hideModal(), 1000);
            }
        });

        modalOverlay.querySelector(`#cancelBtn-${modalId}`).addEventListener('click', () => {
            hideModal();
            const emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.focus();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) hideModal();
        });

        const hideModal = () => {
            if (_activeModal === modalId) {
                document.body.removeChild(modalOverlay);
                _activeModal = null;
            }
        };

        // Add CSS animations
        if (!document.querySelector('#modal-animations')) {
            const style = document.createElement('style');
            style.id = 'modal-animations';
            style.textContent = `
                @keyframes modalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    };

    const showLoading = (message = 'Loading...', options = {}) => {
        if (_isLoading) return;
        _isLoading = true;
        
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            const subtitle = loadingScreen.querySelector('.loading-subtitle');
            if (subtitle) subtitle.textContent = message;
            
            loadingScreen.style.display = 'flex';
            setTimeout(() => {
                loadingScreen.style.opacity = '1';
            }, 10);
        }
        
        // Disable form inputs
        if (options.disableForm) {
            const form = document.getElementById('loginForm');
            if (form) form.style.pointerEvents = 'none';
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
        
        // Re-enable form inputs
        const form = document.getElementById('loginForm');
        if (form) form.style.pointerEvents = 'auto';
    };

    const updateButtonState = (buttonId, isLoading) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            const spinner = button.querySelector('.btn-spinner');
            if (spinner) spinner.style.display = 'block';
        } else {
            button.disabled = false;
            const spinner = button.querySelector('.btn-spinner');
            if (spinner) spinner.style.display = 'none';
        }
    };

    return {
        showNotification,
        hideNotification,
        showBrowserModal,
        showLoading,
        hideLoading,
        updateButtonState
    };
})();

// ==================== EVENT MANAGER ====================
const TourneyHubEventManager = (() => {
    const _events = new Map();
    const _oneTimeEvents = new Map();

    return {
        on(event, callback) {
            if (!_events.has(event)) _events.set(event, []);
            _events.get(event).push(callback);
        },

        once(event, callback) {
            if (!_oneTimeEvents.has(event)) _oneTimeEvents.set(event, []);
            _oneTimeEvents.get(event).push(callback);
        },

        emit(event, data = null) {
            // Regular event listeners
            if (_events.has(event)) {
                _events.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event handler for "${event}":`, error);
                    }
                });
            }
            
            // One-time event listeners
            if (_oneTimeEvents.has(event)) {
                _oneTimeEvents.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in one-time event handler for "${event}":`, error);
                    }
                });
                _oneTimeEvents.delete(event);
            }
        },

        off(event, callback) {
            if (_events.has(event)) {
                const callbacks = _events.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) callbacks.splice(index, 1);
            }
        }
    };
})();

// ==================== PERSISTENT SESSION MANAGER ====================
const TourneyHubSessionManager = (() => {
    const checkExistingSession = async () => {
        const user = TourneyHubAuth.getCurrentUser();
        
        if (user) {
            // Check session validity
            if (user.expiresAt && user.expiresAt > Date.now()) {
                // Session is valid, refresh it
                TourneyHubAuth.sessionManager.refreshSession();
                
                // Check if we should auto-redirect
                const urlParams = new URLSearchParams(window.location.search);
                const autoLogin = urlParams.get('autoLogin');
                
                if (autoLogin !== 'false') {
                    // Auto-redirect to dashboard
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 100);
                    return true;
                }
            } else {
                // Session expired, clear it
                await TourneyHubAuth.logout();
            }
        }
        
        return false;
    };

    const handleRememberMe = () => {
        const rememberData = TourneyHubAuth.getRememberMeData();
        const emailInput = document.getElementById('login-email');
        const rememberCheckbox = document.getElementById('rememberMe');
        
        if (emailInput && rememberData.email) {
            emailInput.value = rememberData.email;
        }
        
        if (rememberCheckbox) {
            rememberCheckbox.checked = rememberData.rememberMe;
        }
        
        return rememberData;
    };

    const saveRedirectDestination = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect) {
            localStorage.setItem('tourneyhub_redirect_url', redirect);
        }
    };

    return {
        checkExistingSession,
        handleRememberMe,
        saveRedirectDestination,
        
        initialize: async () => {
            saveRedirectDestination();
            
            const hasSession = await checkExistingSession();
            if (hasSession) return true;
            
            handleRememberMe();
            return false;
        }
    };
})();

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Add enhanced CSS styles
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
                transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                min-width: 300px;
                max-width: 400px;
            }
            
            .notification-toast.show {
                transform: translateX(0);
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
            }
            
            .toast-icon {
                font-size: 1.2rem;
            }
            
            .toast-message {
                flex: 1;
                font-size: 0.95rem;
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
                line-height: 1;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
            
            .loading-screen {
                transition: opacity 0.5s ease;
            }
            
            .btn-spinner {
                display: none;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s ease-in-out infinite;
                margin-left: 10px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .form-input:disabled,
            .btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .checkbox-container {
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .checkmark {
                width: 18px;
                height: 18px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 4px;
                display: inline-block;
                position: relative;
                transition: all 0.2s ease;
            }
            
            .checkbox-container input:checked + .checkmark {
                background: #4285F4;
                border-color: #4285F4;
            }
            
            .checkbox-container input:checked + .checkmark::after {
                content: '✓';
                position: absolute;
                color: white;
                font-size: 12px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
        `;
        document.head.appendChild(style);

        // Show initial loading
        TourneyHubUIManager.showLoading('Initializing...');

        // Initialize session manager
        const hasActiveSession = await TourneyHubSessionManager.initialize();
        if (hasActiveSession) {
            return; // Already redirected
        }

        // Initialize authentication
        const initResult = await TourneyHubAuth.init();
        
        if (!initResult.success) {
            throw new Error('Failed to initialize authentication system');
        }

        // Setup event system
        setupEventListeners();

        // Setup DOM elements
        setupLoginForm();
        setupGoogleButton();
        setupForgotPassword();
        setupPasswordToggle();

        // Check for redirect result
        await checkRedirectResult();

        // Hide loading screen with delay
        setTimeout(() => {
            TourneyHubUIManager.hideLoading();
            
            // Auto-focus email input
            const emailInput = document.getElementById('login-email');
            if (emailInput && !emailInput.value) {
                setTimeout(() => emailInput.focus(), 100);
            }
            
            console.log('✅ TourneyHub Advanced Login System Ready');
        }, 800);

    } catch (error) {
        console.error('Initialization error:', error);
        TourneyHubUIManager.showNotification(
            'System initialization failed. Please refresh the page.',
            'error',
            { duration: 10000 }
        );
        TourneyHubUIManager.hideLoading();
    }
});

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
    // Auth notifications
    TourneyHubEventManager.on('auth-notification', (event) => {
        TourneyHubUIManager.showNotification(
            event.detail.message,
            event.detail.type
        );
    });

    // Auth success
    TourneyHubEventManager.on('auth-success', (data) => {
        const user = data.user || TourneyHubAuth.getCurrentUser();
        const message = user ? `Welcome back, ${user.displayName || user.email}!` : 'Login successful!';
        
        TourneyHubUIManager.showNotification(message, 'success');
        
        // Store user in global context for immediate access
        window.tourneyHubUser = user;
        
        // Get redirect URL
        const redirectUrl = localStorage.getItem('tourneyhub_redirect_url') || 'index.html';
        
        // Clear redirect URL
        localStorage.removeItem('tourneyhub_redirect_url');
        
        // Redirect with delay
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
    });

    // Auth error
    TourneyHubEventManager.on('auth-error', (error) => {
        TourneyHubUIManager.showNotification(
            error.message || 'Authentication failed',
            'error'
        );
        TourneyHubUIManager.hideLoading();
    });
}

// ==================== DOM SETUP FUNCTIONS ====================
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('loginBtn');
    const rememberCheckbox = document.getElementById('rememberMe');

    if (!loginForm) return;

    // Load remember me data
    const rememberData = TourneyHubSessionManager.handleRememberMe();

    // Form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput?.value.trim() || '';
        const password = passwordInput?.value || '';
        const rememberMe = rememberCheckbox?.checked || false;

        // Validation
        if (!email || !password) {
            TourneyHubUIManager.showNotification('Please fill in all fields', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            TourneyHubUIManager.showNotification('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }

        // Show loading
        TourneyHubUIManager.showLoading('Signing in...', { disableForm: true });
        TourneyHubUIManager.updateButtonState('loginBtn', true);

        try {
            const result = await TourneyHubAuth.loginWithEmail(email, password, rememberMe);
            
            // Save remember me preference
            if (rememberMe) {
                localStorage.setItem('tourneyhub_remember_email', email);
                localStorage.setItem('tourneyhub_remember_me', 'true');
            } else {
                localStorage.removeItem('tourneyhub_remember_email');
                localStorage.setItem('tourneyhub_remember_me', 'false');
            }
            
            TourneyHubEventManager.emit('auth-success', result);
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            TourneyHubUIManager.hideLoading();
            TourneyHubUIManager.updateButtonState('loginBtn', false);
        }
    });

    // Enter key navigation
    if (emailInput) {
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && passwordInput) {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                loginForm.dispatchEvent(new Event('submit'));
            }
        });
    }
}

function setupGoogleButton() {
    const googleBtn = document.getElementById('googleSignInNewWindow');
    
    if (!googleBtn) return;

    googleBtn.addEventListener('click', async () => {
        // Check browser first
        const browserCheck = TourneyHubAuth.checkBrowser();
        
        if (browserCheck.isInApp) {
            // In-app browser - show modal
            const linkInfo = TourneyHubAuth.getLinkForBrowser();
            TourneyHubUIManager.showBrowserModal(browserCheck, linkInfo);
            return;
        }
        
        // Regular browser - try Google login
        TourneyHubUIManager.showLoading('Connecting to Google...', { disableForm: true });
        googleBtn.disabled = true;
        
        try {
            const result = await TourneyHubAuth.loginWithGoogle();
            
            if (result.method === 'redirect') {
                // Redirect initiated
                TourneyHubUIManager.showNotification('Redirecting to Google...', 'info');
                return;
            }
            
            // Save remember me for Google login
            localStorage.setItem('tourneyhub_remember_me', 'true');
            
            TourneyHubEventManager.emit('auth-success', result);
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            TourneyHubUIManager.hideLoading();
            googleBtn.disabled = false;
        }
    });
}

function setupForgotPassword() {
    const forgotLink = document.getElementById('forgotPassword');
    
    if (!forgotLink) return;

    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const email = emailInput?.value || '';
        
        if (email) {
            localStorage.setItem('tourneyhub_reset_email', email);
        }
        
        // Redirect to password reset page
        window.location.href = 'reset-password.html';
    });
}

function setupPasswordToggle() {
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('login-password');
    
    if (!passwordToggle || !passwordInput) return;

    passwordToggle.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = passwordToggle.querySelector('.toggle-icon');
        if (icon) {
            icon.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
        }
        
        // Update input icon
        const inputIcon = document.querySelector('.input-icon[data-for="password"]');
        if (inputIcon) {
            inputIcon.textContent = type === 'password' ? '••••' : '';
        }
    });
}

async function checkRedirectResult() {
    try {
        const result = await TourneyHubAuth.handleRedirectResult();
        if (result.success) {
            TourneyHubEventManager.emit('auth-success', result);
        }
    } catch (error) {
        // Ignore redirect errors
        if (error.code !== 'auth/no-redirect-result') {
            console.error('Redirect result error:', error);
        }
    }
}

// ==================== GLOBAL EXPORTS & UTILITIES ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;
window.TourneyHubEventManager = TourneyHubEventManager;
window.TourneyHubSessionManager = TourneyHubSessionManager;

// Auto-check session on page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        TourneyHubSessionManager.checkExistingSession();
    }
});

// Handle browser back/forward
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        TourneyHubSessionManager.initialize();
    }
});

// ==================== HELPER FUNCTIONS ====================
function formatEmailForDisplay(email) {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (username.length > 10) {
        return `${username.substring(0, 7)}...@${domain}`;
    }
    return email;
}

function setupRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshContainer = document.getElementById('refreshContainer');
  
  if (!refreshBtn) return;
  
  // Create refresh button if it doesn't exist in DOM
  if (!refreshContainer) {
    const refreshContainer = document.createElement('div');
    refreshContainer.className = 'refresh-container';
    refreshContainer.id = 'refreshContainer';
    refreshContainer.innerHTML = `
      <button type="button" class="btn-refresh" id="refreshBtn" title="Refresh Session">
        <span class="refresh-icon">🔄</span>
        <span class="refresh-tooltip">Refresh Session</span>
      </button>
    `;
    document.body.appendChild(refreshContainer);
  }
  
  // Refresh button click handler
  refreshBtn.addEventListener('click', async () => {
    // Show loading state
    refreshBtn.classList.add('loading');
    
    // Perform refresh actions
    await performSessionRefresh();
    
    // Remove loading state after a delay
    setTimeout(() => {
      refreshBtn.classList.remove('loading');
    }, 1000);
  });
  
  // Auto-hide/show based on scroll and activity
  let hideTimeout;
  
  const showRefreshButton = () => {
    refreshContainer.style.opacity = '1';
    refreshContainer.style.visibility = 'visible';
    
    // Auto-hide after 5 seconds of inactivity
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!document.querySelector('.btn-refresh:hover')) {
        refreshContainer.style.opacity = '0';
        refreshContainer.style.visibility = 'hidden';
      }
    }, 5000);
  };
  
  const hideRefreshButton = () => {
    refreshContainer.style.opacity = '0';
    refreshContainer.style.visibility = 'hidden';
  };
  
  // Show button on mouse move
  document.addEventListener('mousemove', () => {
    showRefreshButton();
  });
  
  // Show button on touch
  document.addEventListener('touchstart', () => {
    showRefreshButton();
  });
  
  // Initially show button
  setTimeout(() => {
    showRefreshButton();
  }, 2000);
}

async function performSessionRefresh() {
  try {
    // Show loading notification
    TourneyHubUIManager.showNotification('Refreshing session...', 'info');
    
    // Refresh current session
    const currentUser = TourneyHubAuth.getCurrentUser();
    
    if (currentUser) {
      // Refresh Firebase session
      const auth = TourneyHubAuth.getAuthInstance();
      if (auth && auth.currentUser) {
        // Refresh ID token
        await auth.currentUser.getIdToken(true);
        
        // Update local session
        TourneyHubAuth.sessionManager.refreshSession();
        
        TourneyHubUIManager.showNotification('Session refreshed successfully!', 'success');
      }
    } else {
      // If no session, clear any stored data and reload
      localStorage.removeItem('tourneyhub_temp_data');
      sessionStorage.clear();
      
      // Soft reload without full page refresh
      TourneyHubUIManager.showNotification('Clearing local data...', 'info');
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    
    // Check for updated user data
    const updatedUser = TourneyHubAuth.getCurrentUser();
    if (updatedUser) {
      console.log('Session refreshed for:', updatedUser.email);
    }
    
  } catch (error) {
    console.error('Refresh failed:', error);
    TourneyHubUIManager.showNotification('Refresh failed. Please try again.', 'error');
  }
}