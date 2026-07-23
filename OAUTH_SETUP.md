# OAuth Provider Setup Guide

This guide explains how to configure Apple and Facebook OAuth providers for Harbinger.

---

## Prerequisites

- Google OAuth is already configured in `.env` (working ✅)
- Docker containers running (`docker compose up -d`)
- Frontend accessible at `http://localhost:3300`
- Backend API accessible at `http://localhost:8082/api`

---

## Apple Sign-In Setup

### 1. Create an Apple Developer Account

Go to [developer.apple.com](https://developer.apple.com/) and sign up for a Developer account ($99/year).

### 2. Create an App ID

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** next to "Identifiers"
3. Select **App IDs** → **Continue**
4. Type a description (e.g., "Harbinger") and a Bundle Identifier (e.g., `com.harbinger.app`)
5. Check **"Sign in with Apple"** under Capabilities
6. Click **Continue** → **Register**

### 3. Configure Sign In with Apple

1. Go to the App ID you just created
2. Under "Configure" (next to "Sign In with Apple"), click **Configure**
3. Enable **"Allow this Web Domain to Use Sign in with Apple"**
4. Add your frontend URL: `http://localhost:3300`
5. Click **Save**

### 4. Create a Service ID

1. Go back to [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** → Select **Service IDs** → **Continue**
3. Description: "Harbinger Web"
4. Identifier: `com.harbinger.web` (must be unique across Apple services)
5. Click **Continue** → **Register**

### 5. Generate a Private Key (Sign In with Apple)

1. Go to [Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click **+** next to "Keys"
3. Enable **"Sign in with Apple"** → **Configure**
4. Key Name: "HarbingerKey"
5. Download the `.p8` file (you'll need the **Key ID** shown on screen)
6. **Save the Key ID and download the `.p8` file** — you won't see the key again

### 6. Create a Team ID

1. Go to [Membership Center](https://developer.apple.com/account/resources/profiles/list)
2. Your **Team ID** is displayed at the top (a 10-character string like `ABC1234567`)
3. Note it down — you'll need it in `.env`

### 7. Add Environment Variables

Add these to your `.env` file:

```env
# Apple OAuth
APPLE_CLIENT_ID=com.harbinger.web          # Your Service ID from step 4
APPLE_TEAM_ID=ABC1234567                    # Your Team ID from step 6
APPLE_KEY_ID=XYZ123456                      # Key ID from step 5 (shown when creating key)
APPLE_PRIVATE_KEY_PATH=/path/to/AuthKey_XYZ123456.p8  # Path to downloaded .p8 file
APPLE_CALLBACK_URL=http://localhost:8082/api/auth/apple/callback
```

### 8. Update the Private Key Path in Code

Edit `backend/src/infrastructure/auth/passport-apple.ts` and update the path to your `.p8` file if needed.

---

## Facebook Sign-In Setup

### 1. Create a Facebook Developer Account

Go to [developers.facebook.com](https://developers.facebook.com/) and create a developer account.

### 2. Create a Facebook App

1. Click **My Apps** → **Create App**
2. Select **Consumer** (or **Other**) → **Continue**
3. App Name: "Harbinger"
4. Contact Email: your email
5. Click **Create App**

### 3. Add Facebook Login Product

1. In your app dashboard, click **Facebook Login** under "Products"
2. Select **Web** as the platform
3. Site URL: `http://localhost:3300`
4. Click **Save Changes**

### 4. Configure OAuth Settings

1. Go to **Settings** → **Basic** in your app dashboard
2. Note down:
   - **App ID** (e.g., `123456789012345`)
   - **App Secret** (click **Show** to reveal)
3. Go to **Facebook Login** → **Settings**
4. Under "Valid OAuth Redirect URIs", add:
   ```
   http://localhost:8082/api/auth/facebook/callback
   ```
5. Click **Save Changes**

### 5. Add Environment Variables

Add these to your `.env` file:

```env
# Facebook OAuth
FACEBOOK_APP_ID=123456789012345             # Your App ID from step 4
FACEBOOK_APP_SECRET=abcdef123456789...      # Your App Secret from step 4
FACEBOOK_CALLBACK_URL=http://localhost:8082/api/auth/facebook/callback
```

### 6. Configure App Review (for Production)

When you're ready to go live:

1. Go to **App Review** in your app dashboard
2. Enable **"Make Harbinger public"**
3. Request permissions for `public_profile` and `email`
4. Submit for review (Apple requires this before App Store approval)

---

## Testing

After configuring both providers:

1. Restart your backend: `docker compose restart backend-api`
2. Go to `http://localhost:3300/login`
3. You should see all three buttons: Google, Apple, Facebook
4. Click each button and verify the OAuth flow completes successfully

---

## Troubleshooting

### Apple Issues

- **"The app has not been configured for Sign in with Apple"**: Ensure you enabled it in step 2
- **Invalid client_id**: Double-check your Service ID matches exactly (including `com.` prefix)
- **Key expired**: Generate a new key in step 5 and update `.env`

### Facebook Issues

- **"Invalid redirect URI"**: Ensure the callback URL matches exactly (no trailing slash differences)
- **"App not configured for Facebook Login"**: Enable Facebook Login product in step 3
- **Permission denied**: Check App Review status in step 6

---

## Security Notes

- **Never commit `.env` to git** — it's already in `.gitignore`
- Use different credentials for development and production
- Rotate keys annually or if compromised
- Store private keys in a secrets manager (e.g., AWS Secrets Manager) for production
