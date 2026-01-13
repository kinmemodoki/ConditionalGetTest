// AbortController for conditional authentication
let conditionalAuthAbortController = null;

// Generate random challenge per WebAuthn specification
function generateChallenge() {
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    return buffer;
}

// Show status message
function showStatus(elementId, message, type) {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
}

// Register a new passkey
async function registerPasskey() {
    const registerButton = document.getElementById('registerButton');
    registerButton.disabled = true;
    showStatus('registerStatus', '登録処理中...', 'info');

    // Abort conditional authentication if it's running
    if (conditionalAuthAbortController) {
        conditionalAuthAbortController.abort();
        conditionalAuthAbortController = null;
    }

    try {
        // Generate random challenge
        const challenge = generateChallenge();
        
        // User information - always use "test-user" as username
        const userId = generateChallenge(); // Random user ID
        const userName = 'test-user';
        const userDisplayName = 'Test User';

        // Create credential options
        const createCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rp: {
                    name: "WebAuthn Conditional UI Test",
                    id: window.location.hostname,
                },
                user: {
                    id: userId,
                    name: userName,
                    displayName: userDisplayName,
                },
                pubKeyCredParams: [
                    {
                        type: "public-key",
                        alg: -7  // ES256
                    },
                    {
                        type: "public-key",
                        alg: -257 // RS256
                    }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    requireResidentKey: true,
                    residentKey: "required",
                    userVerification: "required" // Required as per specification
                },
                timeout: 60000,
                attestation: "none"
            }
        };

        // Create credential
        const credential = await navigator.credentials.create(createCredentialOptions);
        
        console.log('Credential created:', credential);
        showStatus('registerStatus', 'パスキーの登録に成功しました！', 'success');
        
        // Reload the page after successful registration
        setTimeout(() => {
            window.location.reload();
        }, 1000); // Wait 1 second to show success message
    } catch (error) {
        console.error('Registration failed:', error);
        showStatus('registerStatus', `登録に失敗しました: ${error.message}`, 'error');
    } finally {
        registerButton.disabled = false;
    }
}

// Perform conditional authentication (autofill)
async function conditionalAuthentication() {
    // Abort any existing conditional authentication before starting a new one
    if (conditionalAuthAbortController) {
        conditionalAuthAbortController.abort();
        conditionalAuthAbortController = null;
    }

    // Create AbortController for this conditional authentication
    const abortController = new AbortController();
    conditionalAuthAbortController = abortController;

    try {
        // Check if conditional mediation is supported
        if (!window.PublicKeyCredential || 
            !PublicKeyCredential.isConditionalMediationAvailable) {
            console.log('Conditional mediation not supported');
            return;
        }

        const available = await PublicKeyCredential.isConditionalMediationAvailable();
        if (!available) {
            console.log('Conditional mediation not available');
            return;
        }

        // Generate random challenge
        const challenge = generateChallenge();

        // Authentication options
        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                userVerification: "required", // Required as per specification
                timeout: 60000
            },
            mediation: "conditional", // Enable conditional UI
            signal: abortController.signal // Add AbortSignal
        };

        // Start conditional authentication
        const credential = await navigator.credentials.get(getCredentialOptions);
        
        if (credential) {
            console.log('Authentication successful:', credential);
            showStatus('loginStatus', '認証に成功しました！', 'success');
            return credential;
        }
    } catch (error) {
        // Don't show errors for user cancellation or conditional UI not being triggered
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
            console.error('Authentication failed:', error);
            showStatus('loginStatus', `認証に失敗しました: ${error.message}`, 'error');
        }
    } finally {
        // Clean up the abort controller only if it's still the current one
        if (conditionalAuthAbortController === abortController) {
            conditionalAuthAbortController = null;
        }
    }
}

// Manual login
async function performLogin(event) {
    event.preventDefault();
    
    showStatus('loginStatus', '認証処理中...', 'info');

    try {
        // Generate random challenge
        const challenge = generateChallenge();

        // Authentication options
        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                userVerification: "required", // Required as per specification
                timeout: 60000
            }
        };

        // Get credential
        const credential = await navigator.credentials.get(getCredentialOptions);
        
        if (credential) {
            console.log('Authentication successful:', credential);
            showStatus('loginStatus', '認証に成功しました！', 'success');
        }
    } catch (error) {
        console.error('Authentication failed:', error);
        showStatus('loginStatus', `認証に失敗しました: ${error.message}`, 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Register button event
    const registerButton = document.getElementById('registerButton');
    registerButton.addEventListener('click', registerPasskey);

    // Login form event
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', performLogin);

    // Start conditional authentication
    conditionalAuthentication();
});
