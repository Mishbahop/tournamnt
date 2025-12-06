// ==================== TOURNEYHUB AUTHENTICATION SYSTEM ====================
const TourneyHubAuth = (() => {
    // Private variables
    let _auth = null;
    let _db = null;
    let _googleAuthProvider = null;
    let _currentUser = null;
    let _loginAttempts = 0;
    let _lastFailedAttempt = null;
    let _securityKey = null;
    let _twoFAToken = null;

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

    class ValidationError extends Error {
        constructor(message, field) {
            super(message);
            this.name = 'ValidationError';
            this.field = field;
        }
    }

    // Private methods
    const _initializeFirebase = () => {
        return new Promise((resolve, reject) => {
            try {
                if (!firebase.apps.length) {
                    const app = firebase.initializeApp(_firebaseConfig);
                    
                    // Enable offline persistence for better UX
                    firebase.firestore().enablePersistence()
                        .catch(err => {
                            if (err.code === 'failed-precondition') {
                                console.warn('Multiple tabs open, persistence disabled');
                            } else if (err.code === 'unimplemented') {
                                console.warn('Browser doesn\'t support persistence');
                            }
                        });
                    
                    _auth = firebase.auth();
                    _db = firebase.firestore();
                    _googleAuthProvider = new firebase.auth.GoogleAuthProvider();
                    
                    // Configure Google provider
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
            if (_loginAttempts >= 5 && timeDiff < 300000) { // 5 attempts in 5 minutes
                const waitTime = Math.floor((300000 - timeDiff) / 1000 / 60);
                throw new AuthError(
                    `Too many failed attempts. Try again in ${waitTime} minutes.`,
                    'BRUTE_FORCE_BLOCKED'
                );
            }
            if (timeDiff > 300000) {
                // Reset after 5 minutes
                _loginAttempts = 0;
                _lastFailedAttempt = null;
            }
        }
    };

    const _validatePasswordStrength = (password) => {
        if (!password) {
            return {
                isValid: false,
                score: 0,
                errors: ['Password is required']
            };
        }

        const requirements = {
            minLength: 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const errors = [];
        if (password.length < requirements.minLength) {
            errors.push(`Password must be at least ${requirements.minLength} characters`);
        }
        if (!requirements.hasUpperCase) errors.push('Password must contain uppercase letter');
        if (!requirements.hasLowerCase) errors.push('Password must contain lowercase letter');
        if (!requirements.hasNumbers) errors.push('Password must contain number');
        if (!requirements.hasSpecialChar) errors.push('Password must contain special character');

        return {
            isValid: errors.length === 0,
            score: Math.min(100, Math.round(
                (password.length / 20 * 40) + 
                (requirements.hasUpperCase ? 15 : 0) +
                (requirements.hasLowerCase ? 15 : 0) +
                (requirements.hasNumbers ? 15 : 0) +
                (requirements.hasSpecialChar ? 15 : 0)
            )),
            errors
        };
    };

    const _generate2FAToken = () => {
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        _twoFAToken = token;
        
        localStorage.setItem('tourneyhub_2fa_token', token);
        localStorage.setItem('tourneyhub_2fa_expiry', Date.now() + 600000);
        
        return token;
    };

    const _validate2FAToken = (inputToken) => {
        const storedToken = localStorage.getItem('tourneyhub_2fa_token');
        const expiry = localStorage.getItem('tourneyhub_2fa_expiry');
        
        if (!storedToken || !expiry || Date.now() > parseInt(expiry)) {
            return false;
        }
        
        return inputToken === storedToken;
    };

    const _send2FAEmail = async (email, token) => {
        console.log(`[2FA] Token for ${email}: ${token}`);
        // In production, integrate with your email service
        return new Promise(resolve => {
            setTimeout(() => resolve(true), 1000);
        });
    };

    const _showNotification = (message, type = 'info', options = {}) => {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now(),
            ...options
        };

        // Dispatch custom event for UI manager
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
                action = 'suggest_signup';
                break;
            case 'auth/wrong-password':
                userMessage = 'Incorrect password';
                _loginAttempts++;
                _lastFailedAttempt = Date.now();
                break;
            case 'auth/too-many-requests':
                userMessage = 'Too many failed attempts. Try again later.';
                action = 'block_temporarily';
                break;
            case 'auth/network-request-failed':
                userMessage = 'Network error. Check your connection.';
                action = 'retry_connection';
                break;
            case 'auth/popup-blocked':
                userMessage = 'Popup blocked. Please use the redirect method.';
                action = 'use_redirect';
                break;
            case 'auth/operation-not-allowed':
                userMessage = 'Google sign-in is not enabled for this app. Contact support.';
                break;
            case 'auth/unauthorized-domain':
                userMessage = 'This domain is not authorized. Contact support.';
                break;
            default:
                if (error.message) {
                    userMessage = error.message;
                }
        }

        console.error(`Auth Error [${error.code || 'UNKNOWN'}]:`, error);

        return { userMessage, action };
    };

    const _createUserSession = async (user, loginMethod) => {
        try {
            // Store user data
            _currentUser = user;
            
            // Save to localStorage for persistence
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

    const _checkBrowserCompatibility = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Check for in-app browsers
        const isInAppBrowser = 
            /fbav|instagram|line|twitter|snapchat|whatsapp|slack|discord|telegram/.test(userAgent) ||
            userAgent.includes('wv') || // WebView
            userAgent.includes('fb_iab') || // Facebook in-app browser
            userAgent.includes('instagram') ||
            userAgent.includes('twitter');
        
        if (isInAppBrowser) {
            return {
                compatible: false,
                type: 'in_app',
                message: 'For Google login, please open in Chrome, Firefox, Safari, or Edge browser directly.'
            };
        }
        
        return {
            compatible: true,
            type: 'supported'
        };
    };

    // Public API
    return {
        // Initialization
        async init() {
            try {
                await _initializeFirebase();
                _securityKey = crypto.randomUUID();
                
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
                    throw new ValidationError('Email and password are required');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new ValidationError('Invalid email format', 'email');
                }

                // Set persistence based on remember me
                const persistence = rememberMe ? 
                    firebase.auth.Auth.Persistence.LOCAL : 
                    firebase.auth.Auth.Persistence.SESSION;
                
                await _auth.setPersistence(persistence);

                // Sign in
                const userCredential = await _auth.signInWithEmailAndPassword(email, password);
                
                // Reset failed attempts on success
                _loginAttempts = 0;
                _lastFailedAttempt = null;

                // Check if 2FA is enabled
                let userDoc;
                try {
                    userDoc = await _db.collection('users').doc(userCredential.user.uid).get();
                } catch (dbError) {
                    // If user doesn't exist in Firestore, create a basic entry
                    console.log('No user document found, creating default...');
                }

                const userData = userDoc?.data();
                
                if (userData?.twoFAEnabled) {
                    // Generate and send 2FA token
                    const token = _generate2FAToken();
                    await _send2FAEmail(email, token);
                    
                    return {
                        success: true,
                        requires2FA: true,
                        userId: userCredential.user.uid,
                        message: '2FA token sent to email'
                    };
                }

                // Create session for non-2FA users
                const userSession = await _createUserSession(userCredential.user, 'email');
                
                _showNotification('Login successful!', 'success');
                
                return {
                    success: true,
                    requires2FA: false,
                    user: userSession
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'EMAIL_LOGIN_ERROR', error);
            }
        },

        async verify2FA(userId, token) {
            try {
                if (!_validate2FAToken(token)) {
                    throw new AuthError('Invalid or expired 2FA token', 'INVALID_2FA');
                }

                // Get user from Firebase Auth
                const user = _auth.currentUser;
                if (!user || user.uid !== userId) {
                    throw new AuthError('User not found in auth state', 'AUTH_STATE_ERROR');
                }

                // Create session after 2FA verification
                const userSession = await _createUserSession(user, 'email_2fa');
                
                // Clear 2FA tokens
                localStorage.removeItem('tourneyhub_2fa_token');
                localStorage.removeItem('tourneyhub_2fa_expiry');
                
                _showNotification('2FA verification successful!', 'success');
                
                return {
                    success: true,
                    user: userSession
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || '2FA_ERROR', error);
            }
        },

        async loginWithGoogle() {
            try {
                _checkBruteForceProtection();
                
                // Check browser compatibility
                const browserCheck = _checkBrowserCompatibility();
                if (!browserCheck.compatible) {
                    throw new AuthError(browserCheck.message, 'BROWSER_INCOMPATIBLE');
                }

                // Try popup method first
                let result;
                try {
                    result = await _auth.signInWithPopup(_googleAuthProvider);
                } catch (popupError) {
                    // If popup is blocked, try redirect method
                    if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
                        // Store current URL to return after redirect
                        sessionStorage.setItem('tourneyhub_redirect_url', window.location.href);
                        
                        await _auth.signInWithRedirect(_googleAuthProvider);
                        return {
                            success: true,
                            method: 'redirect',
                            message: 'Redirecting to Google...'
                        };
                    }
                    throw popupError;
                }
                
                // Create session
                const userSession = await _createUserSession(result.user, 'google');
                
                _showNotification('Google login successful!', 'success');
                
                return {
                    success: true,
                    user: userSession,
                    method: 'popup'
                };
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
                    
                    // Clear redirect URL
                    sessionStorage.removeItem('tourneyhub_redirect_url');
                    
                    return {
                        success: true,
                        user: userSession
                    };
                }
                return { success: false, message: 'No redirect result' };
            } catch (error) {
                // Don't throw error for no redirect result
                if (error.code === 'auth/no-redirect-result') {
                    return { success: false, message: 'No redirect result' };
                }
                
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'REDIRECT_ERROR', error);
            }
        },

        // Password Management
        async resetPassword(email) {
            try {
                if (!email) {
                    throw new ValidationError('Email is required', 'email');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new ValidationError('Invalid email format', 'email');
                }

                // Check if user exists
                const methods = await _auth.fetchSignInMethodsForEmail(email);
                if (methods.length === 0) {
                    throw new AuthError('No account found with this email', 'USER_NOT_FOUND');
                }

                // Send reset email
                await _auth.sendPasswordResetEmail(email, {
                    url: window.location.origin + '/login.html',
                    handleCodeInApp: false
                });
                
                return {
                    success: true,
                    message: 'Password reset email sent. Check your inbox.'
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'PASSWORD_RESET_ERROR', error);
            }
        },

        // Session Management
        async validateCurrentSession() {
            try {
                // Check Firebase auth state
                await new Promise((resolve) => {
                    const unsubscribe = _auth.onAuthStateChanged((user) => {
                        unsubscribe();
                        resolve(user);
                    });
                });
                
                const user = _auth.currentUser;
                if (!user) {
                    // Check localStorage for cached user
                    const cachedUser = localStorage.getItem('tourneyhub_user');
                    if (cachedUser) {
                        return JSON.parse(cachedUser);
                    }
                    return null;
                }
                
                return {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                };
            } catch (error) {
                console.error('Session validation error:', error);
                return null;
            }
        },

        async logout() {
            try {
                await _auth.signOut();
                
                // Clear local storage
                localStorage.removeItem('tourneyhub_user');
                localStorage.removeItem('tourneyhub_remember_email');
                localStorage.removeItem('tourneyhub_remember_me');
                
                _currentUser = null;
                
                return { success: true, message: 'Logged out successfully' };
            } catch (error) {
                console.error('Logout error:', error);
                return { success: false, error: error.message };
            }
        },

        // User Management
        async getUserProfile() {
            if (!_currentUser) {
                const cachedUser = localStorage.getItem('tourneyhub_user');
                if (cachedUser) {
                    return JSON.parse(cachedUser);
                }
                return null;
            }

            try {
                const userDoc = await _db.collection('users').doc(_currentUser.uid).get();
                if (!userDoc.exists) return null;

                return {
                    uid: _currentUser.uid,
                    email: _currentUser.email,
                    emailVerified: _currentUser.emailVerified,
                    displayName: _currentUser.displayName,
                    photoURL: _currentUser.photoURL,
                    ...userDoc.data()
                };
            } catch (error) {
                console.error('Error fetching user profile:', error);
                return null;
            }
        },

        // Utility Methods
        validatePasswordStrength(password) {
            return _validatePasswordStrength(password);
        },

        checkBrowserCompatibility() {
            return _checkBrowserCompatibility();
        },

        // Getters
        getCurrentUser() {
            return _currentUser;
        },

        getAuthInstance() {
            return _auth;
        },

        getFirestoreInstance() {
            return _db;
        },

        // State management
        onAuthStateChanged(callback) {
            if (!_auth) return null;
            return _auth.onAuthStateChanged((user) => {
                _currentUser = user;
                callback(user);
            });
        }
    };
})();

// ==================== UI MANAGER ====================
const TourneyHubUIManager = (() => {
    let _isLoading = false;

    // Show notification using the existing toast in HTML
    const showNotification = (message, type = 'info', options = {}) => {
        const toast = document.getElementById('notificationToast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        const toastClose = document.getElementById('toastClose');

        if (!toast || !toastIcon || !toastMessage) return;

        // Set icon based on type
        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        // Set background color based on type
        const colorMap = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3'
        };

        toastIcon.textContent = iconMap[type] || 'ℹ️';
        toastMessage.textContent = message;
        toast.style.backgroundColor = colorMap[type] || '#2196F3';

        // Show toast with animation
        toast.classList.add('show');

        // Auto-hide after duration
        const duration = options.duration || 5000;
        setTimeout(() => {
            hideNotification();
        }, duration);

        // Close button event
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

    const show2FAModal = (userId, onVerify) => {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 90%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;

        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🔐</div>
                <h2 style="margin: 0 0 10px 0; font-size: 1.8rem; color: white;">
                    Two-Factor Authentication
                </h2>
                <p style="color: #a0a0c0; margin-bottom: 5px;">
                    Enter the 6-digit code sent to your email
                </p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; gap: 10px; justify-content: center;">
                    ${Array.from({ length: 6 }).map((_, i) => `
                        <input 
                            type="text" 
                            maxlength="1" 
                            class="2fa-digit" 
                            data-index="${i}"
                            style="
                                width: 50px;
                                height: 60px;
                                text-align: center;
                                font-size: 1.5rem;
                                background: rgba(255, 255, 255, 0.07);
                                border: 2px solid rgba(255, 255, 255, 0.1);
                                border-radius: 10px;
                                color: white;
                                transition: all 0.2s;
                            "
                        >
                    `).join('')}
                </div>
                <div id="2fa-error" style="color: #ff6b6b; font-size: 0.9rem; margin-top: 10px; min-height: 20px;"></div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button type="button" id="2fa-verify" style="
                    flex: 1;
                    padding: 15px;
                    background: linear-gradient(45deg, #6bcf7f, #4ca1af);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">
                    Verify & Continue
                </button>
                <button type="button" id="2fa-cancel" style="
                    padding: 15px 20px;
                    background: rgba(255, 255, 255, 0.07);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                ">
                    Cancel
                </button>
            </div>
        `;

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Setup digit inputs
        const digitInputs = modalContent.querySelectorAll('.2fa-digit');
        digitInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && index < 5) {
                    digitInputs[index + 1].focus();
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    digitInputs[index - 1].focus();
                }
                
                if (!/^\d$/.test(e.key) && 
                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                }
            });
        });

        // Setup buttons
        const verifyBtn = modalContent.querySelector('#2fa-verify');
        const cancelBtn = modalContent.querySelector('#2fa-cancel');
        const errorDiv = modalContent.querySelector('#2fa-error');
        
        verifyBtn.addEventListener('click', async () => {
            const code = Array.from(digitInputs)
                .map(input => input.value)
                .join('');
            
            if (code.length !== 6) {
                errorDiv.textContent = 'Please enter 6-digit code';
                digitInputs[0].focus();
                return;
            }
            
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Verifying...';
            
            try {
                await onVerify(userId, code);
                document.body.removeChild(modalOverlay);
            } catch (error) {
                errorDiv.textContent = error.message || 'Invalid code';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Continue';
            }
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            window.location.reload();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        });

        setTimeout(() => digitInputs[0].focus(), 100);
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
        show2FAModal,
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

        once(event, callback) {
            const unsubscribe = this.on(event, (data) => {
                unsubscribe();
                callback(data);
            });
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
        },

        removeAll(event) {
            if (event) {
                _events.delete(event);
            } else {
                _events.clear();
            }
        }
    };
})();

// ==================== DOM SETUP FUNCTIONS ====================
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const passwordToggle = document.getElementById('passwordToggle');
    const rememberMe = document.getElementById('rememberMe');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');

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

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            TourneyHubUIManager.showNotification(
                'Please enter a valid email address',
                'error'
            );
            return;
        }

        // Save remember me preference
        if (remember) {
            localStorage.setItem('tourneyhub_remember_email', email);
            localStorage.setItem('tourneyhub_remember_me', 'true');
        } else {
            localStorage.removeItem('tourneyhub_remember_email');
            localStorage.removeItem('tourneyhub_remember_me');
        }

        // Show loading state on button
        if (loginBtn && loginSpinner) {
            loginBtn.disabled = true;
            loginSpinner.style.display = 'block';
        }

        try {
            const result = await TourneyHubAuth.loginWithEmail(email, password, remember);
            
            if (result.requires2FA) {
                TourneyHubUIManager.show2FAModal(result.userId, async (userId, token) => {
                    TourneyHubUIManager.showLoading('Verifying 2FA code...');
                    try {
                        const verifyResult = await TourneyHubAuth.verify2FA(userId, token);
                        TourneyHubEventManager.emit('auth-success', verifyResult);
                    } catch (error) {
                        TourneyHubEventManager.emit('auth-error', error);
                    } finally {
                        TourneyHubUIManager.hideLoading();
                    }
                });
            } else {
                TourneyHubEventManager.emit('auth-success', result);
            }
            
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            // Reset button state
            if (loginBtn && loginSpinner) {
                loginBtn.disabled = false;
                loginSpinner.style.display = 'none';
            }
        }
    });
}

function setupGoogleButton() {
    const googleBtn = document.getElementById('googleSignInNewWindow');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            // Check browser compatibility first
            const browserCheck = TourneyHubAuth.checkBrowserCompatibility();
            if (!browserCheck.compatible) {
                TourneyHubUIManager.showNotification(browserCheck.message, 'warning');
                return;
            }
            
            TourneyHubUIManager.showLoading('Opening Google login...');
            googleBtn.disabled = true;
            
            try {
                const result = await TourneyHubAuth.loginWithGoogle();
                
                if (result.method === 'redirect') {
                    // Redirect initiated, nothing more to do
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
        
        // Validate email format
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
            await TourneyHubAuth.resetPassword(email);
            
            TourneyHubUIManager.showNotification(
                'Password reset email sent! Check your inbox.',
                'success'
            );
            
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            TourneyHubUIManager.hideLoading();
        }
    });
}

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize authentication system
        const initResult = await TourneyHubAuth.init();
        
        if (!initResult.success) {
            throw new Error('Failed to initialize authentication system');
        }

        // Setup event listeners
        TourneyHubEventManager.on('auth-notification', (event) => {
            TourneyHubUIManager.showNotification(
                event.detail.message,
                event.detail.type
            );
        });

        TourneyHubEventManager.on('auth-success', (data) => {
            if (data.user) {
                TourneyHubUIManager.showNotification(
                    'Login successful! Redirecting...',
                    'success'
                );
                
                // Redirect to main page after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        });

        TourneyHubEventManager.on('auth-error', (error) => {
            TourneyHubUIManager.showNotification(
                error.message || 'Authentication failed',
                'error'
            );
        });

        // Check for Google redirect result
        try {
            const redirectResult = await TourneyHubAuth.handleRedirectResult();
            if (redirectResult.success) {
                TourneyHubEventManager.emit('auth-success', redirectResult);
                return; // Stop further initialization since we're redirecting
            }
        } catch (error) {
            // Ignore redirect errors
        }

        // Check if user is already logged in
        const userSession = await TourneyHubAuth.validateCurrentSession();
        if (userSession) {
            // Auto-redirect if already logged in
            window.location.href = 'index.html';
            return;
        }

        // Setup DOM elements
        setupLoginForm();
        setupGoogleButton();
        setupForgotPassword();

        // Hide initial loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);

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
            
            .btn-spinner {
                display: none;
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            
            .2fa-digit:focus {
                outline: none;
                border-color: #6bcf7f !important;
                box-shadow: 0 0 0 3px rgba(107, 207, 127, 0.2) !important;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);

        console.log('✅ TourneyHub Authentication System Initialized');

    } catch (error) {
        console.error('Initialization error:', error);
        TourneyHubUIManager.showNotification(
            'Failed to initialize application. Please refresh.',
            'error'
        );
        
        // Show main content even if initialization fails
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
});

// ==================== GLOBAL EXPORTS ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;
window.TourneyHubEventManager = TourneyHubEventManager;