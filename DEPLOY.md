# Putting the pilot online (Railway)

Railway runs the app straight from the GitHub repo. Cost is usage-based, typically around $5–10/month for a pilot.

## 1. Create the project
1. Sign up at https://railway.com (use **Login with GitHub**).
2. **New Project → Deploy from GitHub repo** → choose `atvenu-fan-activations`.
   If the repo isn't listed, use **Configure GitHub App** to give Railway access to it.
3. Railway detects a Next.js app and starts building. The first build fails or the app restarts until steps 2–3 below are done. That's expected.

## 2. Keep the data: add a volume
The app stores everything in one SQLite file, which must live on a volume or it is wiped on every deploy.
1. In the service, open **Settings** and add a **Volume** with mount path `/data`.
2. While in Settings, set the **region** to an EU location (e.g. Amsterdam), for UK/EU data protection.

## 3. Settings (Variables tab)
| Variable | Value |
|---|---|
| `DATABASE_PATH` | `/data/activations.db` |
| `ADMIN_EMAIL` | your email: the first atVenu admin login |
| `ADMIN_PASSWORD` | a strong password for that login (only used to create the account; change it later under Account) |
| `SESSION_SECRET` | a long random string (40+ characters) |
| `SEED_DEMO` | `true` to load the Oasis demo data (remove later for real use) |
| `PUBLIC_BASE_URL` | the app's web address from step 4, e.g. `https://atvenu-fan-activations.up.railway.app` |

## 4. Get a web address
**Settings → Networking → Generate Domain.** Copy it into `PUBLIC_BASE_URL` (step 3). Railway redeploys automatically.

Then open:
- `https://<your-domain>/admin` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- `https://<your-domain>/a/oasis-2027` for the fan landing page

The city sign-up links and PINs are on each crew activation's **City sign-up links** tab.

## 5. Later
- **Own domain** (e.g. `fans.atvenu.com`): Settings → Networking → Custom Domain, then add the CNAME record it shows at your DNS provider. Update `PUBLIC_BASE_URL`.
- **Email**: Railway blocks SMTP on Trial/Hobby plans, so use an HTTPS email API:
  1. Sign up at **Postmark** (postmarkapp.com) or **Resend** (resend.com).
  2. Add and verify your sending domain (e.g. `livetouch.app`) by adding the DNS records they show (DKIM + return path).
  3. In Railway Variables set `POSTMARK_SERVER_TOKEN` (or `RESEND_API_KEY`) and `EMAIL_FROM`, e.g.
     `Activations <passes@livetouch.app>`.
  4. In the app: **Account → Send test email to me**.
- **Wallet passes**: see `certs/README.md`. Certificates can be pasted into variables as PEM text
  (`APPLE_SIGNER_CERT`, `APPLE_SIGNER_KEY`, `APPLE_WWDR_CERT`, `GOOGLE_WALLET_PRIVATE_KEY`).
- **Real use**: remove `SEED_DEMO`. To start clean, delete and recreate the volume.

Every push to `main` on GitHub redeploys automatically.
