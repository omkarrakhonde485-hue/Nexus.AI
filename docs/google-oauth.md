# Google Workspace OAuth & Credential Infrastructure

## 1. Overview
NEXUS AI integrates with Google Workspace via a secure, server-side OAuth 2.0 web application flow. This connection infrastructure provides encrypted credential persistence and on-demand authenticated API clients for future Google tools:
- **Google Drive** (via `https://www.googleapis.com/auth/drive.file`)
- **Google Calendar** (via `https://www.googleapis.com/auth/calendar`)
- **Gmail** (via `https://www.googleapis.com/auth/gmail.send`)

---

## 2. Architecture & Identity Bridge

```
Browser (Vercel Frontend)
    │
    ↓ 1. GET /api/integrations/google/start (Bearer Token)
Render Backend (API Server)
    │
    ↓ 2. Generate 32-byte CSRF state -> Hash (SHA-256) -> Store in oauth_states
Google Consent Screen
    │
    ↓ 3. User grants consent -> Redirects to Callback
Render Callback: GET /api/integrations/google/callback?code=...&state=...
    │
    ↓ 4. Hash state -> Lookup user_id in oauth_states -> Consume state
    │ 5. Exchange code for tokens via Google OAuth2 Client
    │ 6. Encrypt refresh token with AES-256-GCM
    │ 7. UPSERT google_connections (user_id, encrypted_token, scopes)
    │ 8. Audit log: google_connected
    ↓
Redirect to Frontend: /integrations?google=connected
```

---

## 3. Google Cloud Project Setup

### Required API Enabling
To use Google tools in subsequent blocks, ensure the following APIs are explicitly enabled in your Google Cloud Console project:
1. **Google Drive API**
2. **Google Calendar API**
3. **Gmail API**
4. **Google People API / UserInfo API**

### Authorized Redirect URIs
Configure the exact callback URIs under **Google Cloud Console > Credentials > OAuth 2.0 Client IDs**:
- **Local Development**: `http://localhost:5000/api/integrations/google/callback`
- **Production (Render)**: `https://<YOUR-RENDER-BACKEND-DOMAIN>/api/integrations/google/callback`

---

## 4. OAuth Scope Configuration

Scopes are strictly centralized in `backend/src/config/google.js`:

| Scope | Purpose | Classification |
| :--- | :--- | :--- |
| `openid` | OpenID identity validation | Core |
| `https://www.googleapis.com/auth/userinfo.email` | Account identification | Core |
| `https://www.googleapis.com/auth/userinfo.profile` | User display profile | Core |
| `https://www.googleapis.com/auth/drive.file` | Per-file Drive read/write for NEXUS assets | Narrow / Recommended |
| `https://www.googleapis.com/auth/calendar` | Event scheduling & management | Operations |
| `https://www.googleapis.com/auth/gmail.send` | Outbound email notifications | Sensitive / Write |

---

## 5. Security & Token Protection

### CSRF Protection (`oauth_states`)
- A cryptographically random 32-byte hex token is generated per flow.
- Only the **SHA-256 hash** of the state is stored in PostgreSQL (`oauth_states`).
- States expire after **10 minutes**.
- States are **deleted immediately** upon first lookup (single-use enforcement).

### AES-256-GCM Token Encryption
- Refresh tokens are encrypted with a 256-bit key (`GOOGLE_TOKEN_ENCRYPTION_KEY`).
- Each encryption generates a fresh, random 16-byte IV.
- Format: `v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
- Plaintext refresh tokens **never leave server memory** and are never logged or returned over REST endpoints.

---

## 6. Connection Lifecycle & Health Checks

- **`GET /api/integrations/google/status`**: Returns safe status metadata (`connected`, `googleEmail`, `status`, `scopes`).
- **`GET /api/integrations/google/test`**: Performs a real Google UserInfo API call with decrypted credentials to verify live token validity.
- **`POST /api/integrations/google/disconnect`**: Revokes the refresh token with Google and removes the database connection record.
- **Automatic Reauthorization Handling**: If token refresh fails due to revocation or invalid grant, status transitions to `reauthorization_required` and an audit event is logged.

---

## 7. Verification Results
Run the automated test suite:
```bash
node backend/scripts/verify-block6.js
```
All 7 automated security and lifecycle tests verify encryption roundtrip, state security, token tamper resistance, user isolation, and disconnect cleanup.
