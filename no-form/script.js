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
    const rpIdHash = new Uint8Array(authData.slice(0, 32));
    const flags = dataView.getUint8(32);
    const signCount = dataView.getUint32(33, false);

    return {
        rpIdHash: arrayBufferToHex(rpIdHash),
        flags: {
            userPresent: !!(flags & 0x01),
            userVerified: !!(flags & 0x04),
            backupEligible: !!(flags & 0x08),
            backupState: !!(flags & 0x10),
            attestedCredentialData: !!(flags & 0x40),
            extensionDataIncluded: !!(flags & 0x80)
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
    assertionDetails.querySelector('.json-value').textContent = clientDataText;
    assertionSection.style.display = 'block';
}

// Register a new passkey
async function registerPasskey() {
    const registerButton = document.getElementById('registerButton');
    registerButton.disabled = true;
    showStatus('registerStatus', '登録処理中...', 'info');

    if (conditionalAuthAbortController) {
        conditionalAuthAbortController.abort();
        conditionalAuthAbortController = null;
    }

    try {
        const challenge = generateChallenge();
        const userId = generateChallenge();
        const userName = 'test-user';
        const userDisplayName = 'Test User';

        const createCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rp: {
                    name: "Passkey Autofill Test",
                    id: window.location.hostname,
                },
                user: {
                    id: userId,
                    name: userName,
                    displayName: userDisplayName,
                },
                pubKeyCredParams: [
                    { type: "public-key", alg: -7 },
                    { type: "public-key", alg: -257 }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    requireResidentKey: true,
                    residentKey: "required",
                    userVerification: "required"
                },
                timeout: 60000,
                attestation: "none"
            }
        };

        const credential = await navigator.credentials.create(createCredentialOptions);

        console.log('Credential created:', credential);
        showStatus('registerStatus', 'パスキーの登録に成功しました！', 'success');

        setTimeout(() => {
            window.location.reload();
        }, REGISTRATION_SUCCESS_RELOAD_DELAY);
    } catch (error) {
        console.error('Registration failed:', error);
        showStatus('registerStatus', `登録に失敗しました: ${error.message}`, 'error');
    } finally {
        registerButton.disabled = false;
        conditionalAuthentication();
    }
}

// Perform conditional authentication (autofill)
async function conditionalAuthentication() {
    if (conditionalAuthAbortController) {
        conditionalAuthAbortController.abort();
        conditionalAuthAbortController = null;
    }

    const abortController = new AbortController();
    conditionalAuthAbortController = abortController;

    try {
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

        const challenge = generateChallenge();

        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                userVerification: "required",
                timeout: 60000
            },
            mediation: "conditional",
            signal: abortController.signal
        };

        const credential = await navigator.credentials.get(getCredentialOptions);

        if (credential) {
            console.log('Authentication successful:', credential);
            showStatus('loginStatus', '認証に成功しました！', 'success');
            displayAssertionDetails(credential);
            return credential;
        }
    } catch (error) {
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
            console.error('Authentication failed:', error);
            showStatus('loginStatus', `認証に失敗しました: ${error.message}`, 'error');
        }
    } finally {
        if (conditionalAuthAbortController === abortController) {
            conditionalAuthAbortController = null;
        }
    }
}

// Manual login
async function performLogin() {
    showStatus('loginStatus', '認証処理中...', 'info');

    try {
        const challenge = generateChallenge();

        const getCredentialOptions = {
            publicKey: {
                challenge: challenge,
                rpId: window.location.hostname,
                userVerification: "required",
                timeout: 60000
            }
        };

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
    const registerButton = document.getElementById('registerButton');
    registerButton.addEventListener('click', registerPasskey);

    // No form - use button click
    const loginButton = document.getElementById('loginButton');
    loginButton.addEventListener('click', performLogin);

    conditionalAuthentication();
});
