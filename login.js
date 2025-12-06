// ==================== TOURNEYHUB AUTHENTICATION SYSTEM ====================
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

    // Enhanced Browser Detector
    const _browserDetector = {
        // Main detection method
        detect: () => {
            const ua = navigator.userAgent.toLowerCase();
            const platform = navigator.platform.toLowerCase();
            
            // Check for specific apps
            const isFacebook = ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab');
            const isInstagram = ua.includes('instagram');
            const isTwitter = ua.includes('twitter');
            const isWhatsApp = ua.includes('whatsapp');
            const isSnapchat = ua.includes('snapchat');
            const isTikTok = ua.includes('tiktok');
            const isDiscord = ua.includes('discord');
            const isTelegram = ua.includes('telegram');
            const isLine = ua.includes('line');
            
            // Check for WebView (in-app browsers)
            const isWebView = ua.includes('wv') || 
                             (ua.includes('android') && ua.includes('version/'));
            
            // Check for regular browsers
            const isChrome = /chrome/.test(ua) && !/edge|edg|opera|opr/.test(ua);
            const isFirefox = /firefox/.test(ua);
            const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
            const isEdge = /edge|edg/.test(ua);
            const isOpera = /opera|opr/.test(ua);
            const isIE = /trident|msie/.test(ua);
            
            // Platform detection
            const isAndroid = /android/.test(ua);
            const isIOS = /iphone|ipad|ipod/.test(ua);
            const isMobile = isAndroid || isIOS || /mobile/.test(ua);
            
            return {
                // Browser type
                isChrome,
                isFirefox,
                isSafari,
                isEdge,
                isOpera,
                isIE,
                
                // Platform
                isAndroid,
                isIOS,
                isMobile,
                
                // In-app browsers
                isFacebookApp: isFacebook,
                isInstagramApp: isInstagram,
                isTwitterApp: isTwitter,
                isWhatsAppApp: isWhatsApp,
                isSnapchatApp: isSnapchat,
                isTikTokApp: isTikTok,
                isDiscordApp: isDiscord,
                isTelegramApp: isTelegram,
                isLineApp: isLine,
                isWebView: isWebView,
                
                // Combined checks
                isInAppBrowser: isFacebook || isInstagram || isTwitter || 
                              isWhatsApp || isSnapchat || isTikTok || 
                              isDiscord || isTelegram || isLine || isWebView,
                
                // User agent string for debugging
                userAgent: navigator.userAgent,
                
                // Get browser name for display
                browserName: (() => {
                    if (isFacebook) return 'Facebook Browser';
                    if (isInstagram) return 'Instagram Browser';
                    if (isTwitter) return 'Twitter Browser';
                    if (isWhatsApp) return 'WhatsApp Browser';
                    if (isSnapchat) return 'Snapchat Browser';
                    if (isTikTok) return 'TikTok Browser';
                    if (isDiscord) return 'Discord Browser';
                    if (isTelegram) return 'Telegram Browser';
                    if (isLine) return 'Line Browser';
                    if (isChrome) return 'Chrome';
                    if (isFirefox) return 'Firefox';
                    if (isSafari) return 'Safari';
                    if (isEdge) return 'Edge';
                    if (isOpera) return 'Opera';
                    if (isIE) return 'Internet Explorer';
                    if (isWebView) return 'WebView';
                    return 'Unknown Browser';
                })(),
                
                // Get app name if in-app
                appName: (() => {
                    if (isFacebook) return 'Facebook';
                    if (isInstagram) return 'Instagram';
                    if (isTwitter) return 'Twitter';
                    if (isWhatsApp) return 'WhatsApp';
                    if (isSnapchat) return 'Snapchat';
                    if (isTikTok) return 'TikTok';
                    if (isDiscord) return 'Discord';
                    if (isTelegram) return 'Telegram';
                    if (isLine) return 'Line';
                    return null;
                })()
            };
        },
        
        // Check if we should redirect to Chrome
        shouldRedirectToChrome: () => {
            const detection = _browserDetector.detect();
            
            // Don't redirect if already in Chrome
            if (detection.isChrome) return false;
            
            // Always redirect from in-app browsers
            if (detection.isInAppBrowser) return true;
            
            // For mobile, suggest Chrome for better compatibility
            if (detection.isMobile && !detection.isChrome) return true;
            
            return false;
        },
        
        // Get redirect instructions based on browser
        getRedirectInstructions: () => {
            const detection = _browserDetector.detect();
            
            if (detection.isInAppBrowser) {
                return {
                    type: 'in-app',
                    title: `Open in Chrome`,
                    message: `You're using ${detection.appName || detection.browserName}. For Google login, please open this page in Chrome browser.`,
                    steps: [
                        'Tap the menu button (⋯)',
                        'Select "Open in Chrome" or "Open in Browser"',
                        'If not available, copy the link and paste in Chrome'
                    ],
                    buttonText: 'Open in Chrome',
                    showCopyLink: true
                };
            }
            
            if (detection.isMobile && !detection.isChrome) {
                return {
                    type: 'mobile-non-chrome',
                    title: `Switch to Chrome`,
                    message: `For best Google login experience, please use Chrome browser.`,
                    steps: detection.isAndroid ? [
                        'Tap "Open in Chrome" below',
                        'If Chrome is not installed, install from Play Store',
                        'Return to this page in Chrome'
                    ] : [
                        'Tap "Open in Chrome" below',
                        'If Chrome is not installed, install from App Store',
                        'Return to this page in Chrome'
                    ],
                    buttonText: 'Open in Chrome',
                    showCopyLink: false
                };
            }
            
            if (!detection.isMobile && !detection.isChrome) {
                return {
                    type: 'desktop-non-chrome',
                    title: `Use Chrome for Google Login`,
                    message: `You're using ${detection.browserName}. Google login works best in Chrome.`,
                    steps: [
                        'Click "Install Chrome" to download',
                        'Install Chrome browser',
                        'Open this site in Chrome'
                    ],
                    buttonText: 'Install Chrome',
                    showCopyLink: false
                };
            }
            
            return null;
        },
        
        // Try to open in Chrome
        openInChrome: () => {
            const detection = _browserDetector.detect();
            const currentUrl = window.location.href;
            
            if (detection.isAndroid) {
                // Android - try multiple methods
                
                // Method 1: Try to open directly with Chrome intent
                try {
                    window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;package=com.android.chrome;scheme=https;end`;
                    
                    // Fallback after 2 seconds
                    setTimeout(() => {
                        // Method 2: Open Chrome Play Store page
                        window.location.href = 'https://play.google.com/store/apps/details?id=com.android.chrome';
                    }, 2000);
                } catch (e) {
                    // Method 3: Open in new tab
                    window.open(currentUrl, '_blank');
                }
            } else if (detection.isIOS) {
                // iOS - try to open in Chrome
                try {
                    // Try googlechrome:// URL scheme
                    const chromeUrl = `googlechrome://${currentUrl}`;
                    window.location.href = chromeUrl;
                    
                    // Fallback after 2 seconds
                    setTimeout(() => {
                        // Open Chrome App Store page
                        window.location.href = 'https://apps.apple.com/app/chrome/id535886823';
                    }, 2000);
                } catch (e) {
                    // Open in new tab
                    window.open(currentUrl, '_blank');
                }
            } else {
                // Desktop - open Chrome download page
                window.open('https://www.google.com/chrome/', '_blank');
            }
            
            return true;
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

        return { userMessage };
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
                // Check if we should redirect to Chrome first
                if (_browserDetector.shouldRedirectToChrome()) {
                    return {
                        success: false,
                        requiresChrome: true,
                        browserInfo: _browserDetector.detect(),
                        instructions: _browserDetector.getRedirectInstructions()
                    };
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

        // Browser utilities
        openInChrome: () => {
            return _browserDetector.openInChrome();
        },

        checkBrowserCompatibility: () => {
            const detection = _browserDetector.detect();
            const instructions = _browserDetector.getRedirectInstructions();
            
            return {
                ...detection,
                requiresChrome: _browserDetector.shouldRedirectToChrome(),
                instructions
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

    const showChromeRedirectModal = (instructions) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'chrome-modal-overlay';
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

        const stepsHTML = instructions.steps.map((step, index) => `
            <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <div style="
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(45deg, #4285F4, #34A853);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    flex-shrink: 0;
                ">
                    ${index + 1}
                </div>
                <div style="color: #a0a0c0; flex: 1;">
                    ${step}
                </div>
            </div>
        `).join('');

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
                    ${instructions.title}
                </h2>
                
                <div style="
                    background: rgba(255, 107, 107, 0.1);
                    border: 1px solid rgba(255, 107, 107, 0.2);
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 20px;
                ">
                    <div style="color: #ff6b6b; font-weight: 600; margin-bottom: 5px;">
                        Detected: ${instructions.browserInfo?.browserName || 'Unknown Browser'}
                    </div>
                    <div style="color: #a0a0c0; font-size: 0.9rem;">
                        ${instructions.message}
                    </div>
                </div>
                
                <div style="margin-bottom: 25px; text-align: left;">
                    ${stepsHTML}
                </div>
                
                ${instructions.showCopyLink ? `
                <div style="
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 20px;
                    text-align: left;
                ">
                    <div style="color: #a0a0c0; margin-bottom: 8px; font-size: 0.9rem;">
                        Or copy this link and paste in Chrome:
                    </div>
                    <div style="
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 10px;
                        overflow: hidden;
                    ">
                        <code style="
                            color: #6bcf7f;
                            font-size: 0.85rem;
                            word-break: break-all;
                            display: block;
                        " id="copyable-link">${window.location.href}</code>
                    </div>
                    <button id="copyLinkBtn" style="
                        width: 100%;
                        padding: 12px;
                        background: rgba(107, 207, 127, 0.1);
                        border: 1px solid rgba(107, 207, 127, 0.2);
                        border-radius: 8px;
                        color: #6bcf7f;
                        cursor: pointer;
                        font-size: 0.9rem;
                    ">
                        📋 Copy Link
                    </button>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                    <button id="chromeRedirectBtn" style="
                        flex: 1;
                        padding: 15px 20px;
                        background: linear-gradient(45deg, #4285F4, #34A853);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        ${instructions.buttonText}
                    </button>
                    <button id="chromeCancelBtn" style="
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
                        <span style="color: #4285F4; font-weight: 600;">Why Chrome?</span><br>
                        Google requires secure browsers for authentication. Chrome provides the best security and compatibility with Google services.
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const redirectBtn = modalOverlay.querySelector('#chromeRedirectBtn');
        const cancelBtn = modalOverlay.querySelector('#chromeCancelBtn');
        const copyLinkBtn = modalOverlay.querySelector('#copyLinkBtn');

        redirectBtn.addEventListener('click', () => {
            TourneyHubAuth.openInChrome();
            showNotification('Opening in Chrome...', 'info');
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
            }, 1000);
        });

        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => {
                const linkText = modalOverlay.querySelector('#copyable-link').textContent;
                navigator.clipboard.writeText(linkText).then(() => {
                    copyLinkBtn.textContent = '✓ Copied!';
                    copyLinkBtn.style.background = 'rgba(76, 175, 80, 0.1)';
                    copyLinkBtn.style.borderColor = 'rgba(76, 175, 80, 0.2)';
                    copyLinkBtn.style.color = '#4CAF50';
                    
                    setTimeout(() => {
                        copyLinkBtn.textContent = '📋 Copy Link';
                        copyLinkBtn.style.background = 'rgba(107, 207, 127, 0.1)';
                        copyLinkBtn.style.borderColor = 'rgba(107, 207, 127, 0.2)';
                        copyLinkBtn.style.color = '#6bcf7f';
                    }, 2000);
                });
            });
        }

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
            
            .chrome-modal-overlay {
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
        const browserInfo = TourneyHubAuth.checkBrowserCompatibility();
        console.log('Browser Info:', browserInfo);
        
        // Show browser warning if needed
        if (browserInfo.requiresChrome && browserInfo.instructions) {
            console.log('Browser requires Chrome redirect');
        }

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
                // Show Chrome redirect modal with instructions
                TourneyHubUIManager.showChromeRedirectModal(compatibility.instructions);
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

    forgotLink.addEventListener('click', (e) => {
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
        
        TourneyHubUIManager.showNotification(
            'Password reset feature coming soon!',
            'info'
        );
    });
}

// ==================== GLOBAL EXPORTS ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;
window.TourneyHubEventManager = TourneyHubEventManager;