// AbortController for conditional authentication
let conditionalAuthAbortController = null;

// Delay before reloading page after successful registration (milliseconds)
const REGISTRATION_SUCCESS_RELOAD_DELAY = 1000;

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

// Helper function to convert ArrayBuffer or Uint8Array to hex string
function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Parse authenticator data from credential response
function parseAuthenticatorData(authData) {
    const dataView = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
    
    // RP ID Hash (32 bytes)
    const rpIdHash = new Uint8Array(authData.slice(0, 32));
    
    // Flags (1 byte)
    const flags = dataView.getUint8(32);
    
    // Sign Count (4 bytes, big-endian)
    const signCount = dataView.getUint32(33, false);
    
    return {
        rpIdHash: arrayBufferToHex(rpIdHash),
        flags: {
            userPresent: !!(flags & 0x01),              // UP (bit 0)
            userVerified: !!(flags & 0x04),             // UV (bit 2)
            backupEligible: !!(flags & 0x08),           // BE (bit 3)
            backupState: !!(flags & 0x10),              // BS (bit 4)
            attestedCredentialData: !!(flags & 0x40),   // AT (bit 6)
            extensionDataIncluded: !!(flags & 0x80)     // ED (bit 7)
        },
        flagsByte: flags,
        signCount: signCount
    };
}

// Display assertion details in UI
function displayAssertionDetails(credential) {
    const response = credential.response;
    const authData = new Uint8Array(response.authenticatorData);
    const parsedData = parseAuthenticatorData(authData);
    
    const assertionSection = document.getElementById('assertionSection');
    const assertionDetails = document.getElementById('assertionDetails');
    
    const flagsHtml = Object.entries(parsedData.flags)
        .map(([key, value]) => {
            const status = value ? '✓' : '✗';
            const className = value ? 'flag-true' : 'flag-false';
            return `<div class="flag-item"><span class="${className}">${status}</span> ${key}</div>`;
        })
        .join('');
    
    // Decode client data JSON safely
    const clientDataText = new TextDecoder().decode(response.clientDataJSON);
    
    const html = `
        <div class="detail-group">
            <h3>Credential ID</h3>
            <div class="detail-value hex-value">${arrayBufferToHex(credential.rawId)}</div>
        </div>
        <div class="detail-group">
            <h3>Authenticator Data</h3>
            <div class="detail-item">
                <strong>RP ID Hash:</strong>
                <div class="detail-value hex-value">${parsedData.rpIdHash}</div>
            </div>
            <div class="detail-item">
                <strong>Flags (0x${parsedData.flagsByte.toString(16).padStart(2, '0')}):</strong>
                <div class="flags-list">${flagsHtml}</div>
            </div>
            <div class="detail-item">
                <strong>Sign Count:</strong>
                <div class="detail-value">${parsedData.signCount}</div>
            </div>
        </div>
        <div class="detail-group">
            <h3>Client Data JSON</h3>
            <div class="detail-value json-value"></div>
        </div>
        <div class="detail-group">
            <h3>Signature</h3>
            <div class="detail-value hex-value">${arrayBufferToHex(response.signature)}</div>
        </div>
    `;
    
    assertionDetails.innerHTML = html;
    // Set client data JSON safely using textContent to prevent XSS
    assertionDetails.querySelector('.json-value').textContent = clientDataText;
    assertionSection.style.display = 'block';
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
        }, REGISTRATION_SUCCESS_RELOAD_DELAY); // Wait to show success message
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
            displayAssertionDetails(credential);
            return credential;
        }
    } catch (error) {
        // Don't show errors for user cancellation or conditional UI not being triggered
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
            console.error('Authentication failed:', error);
            showStatus('loginStatus', `認証に失敗しました: ${error.message}`, 'error');
        }
    } finally {
        // Clean up the abort controller only if it matches the local reference
        // This prevents clearing a newer controller created by concurrent calls
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
            displayAssertionDetails(credential);
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
