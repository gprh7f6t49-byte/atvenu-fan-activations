# Wallet credentials

Files in this folder are git-ignored. Never commit them.

## Apple Wallet

1. Apple Developer account → Certificates, IDs & Profiles → Identifiers → **Pass Type IDs** → create
   e.g. `pass.com.atvenu.activations`.
2. Create a **Pass Type ID certificate** for it (upload a CSR), download the `.cer`.
3. Download Apple's **WWDR intermediate certificate (G4)**.
4. Convert to PEM:
   ```bash
   openssl x509 -inform DER -in pass.cer -out signerCert.pem
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   # signerKey.pem = the private key you used for the CSR (or export from Keychain as .p12, then:)
   openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem
   ```
5. Set in `.env.local`: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_WWDR_CERT=./certs/wwdr.pem`,
   `APPLE_SIGNER_CERT=./certs/signerCert.pem`, `APPLE_SIGNER_KEY=./certs/signerKey.pem`
   (+ `APPLE_SIGNER_KEY_PASSPHRASE` if set).

## Google Wallet

1. Sign up at the **Google Pay & Wallet Console** and request issuer access. Note the **Issuer ID**.
2. In Google Cloud: enable the **Google Wallet API**, create a **service account**, download its JSON key.
3. In the Wallet Console → Users, add the service account email as a user.
4. Set `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_KEY_FILE=./certs/google-service-account.json`.

Google requires `PUBLIC_BASE_URL` to be HTTPS for pass images and the save link's allowed origin.
