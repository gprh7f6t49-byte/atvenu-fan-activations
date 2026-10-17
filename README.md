# atVenu Fan Activations (pilot)

Fans opt in on a branded landing page for an artist activation, get a unique atVenu promo code as an
Apple / Google Wallet pass, and redeem it at the merch stand. Uploading atVenu's redemption report then ties
every sale back to the fan who claimed the code.

Example activation: **Oasis — Live '27 European Tour** (sample data).

## How it works

1. **Create an activation** in the admin: artist, tour, offer, brand colours, consent wording, tour dates.
2. **Import promo codes**: generate unique single-use codes in atVenu, export them as CSV, upload.
3. **Share the landing page** (`/a/<slug>`). Add `?utm_source=instagram` etc. to track where fans came from.
4. **The fan opts in** and gets the next unused code. Signing up again with the same email returns the same code.
   Marketing consents (artist / promoter / atVenu) are optional, unticked by default, and stored with the exact wording shown.
5. **Pass delivery**: pass page with QR + Add to Apple Wallet / Google Wallet, plus an email copy.
   The QR contains the raw atVenu promo code, so the POS reads it exactly like a typed code.
6. **Upload sales** after each show: the atVenu orders export (CSV). Each code is matched to its fan,
   giving conversion, attributed sales (per currency) and results by venue. Re-uploading the same file is safe.
7. **Export fans** (CSV, with consent flags) to share with the artist or promoter, only where consent was given.

GDPR access and erasure requests are under **Admin → Data requests**.

## Run it locally

Requires Node 22.13+ (uses the built-in SQLite).

```bash
npm install
cp .env.example .env.local      # set ADMIN_PASSWORD at minimum
npm run seed -- --demo          # Oasis example + 500 codes + sample fans and sales
npm run dev                     # http://localhost:3000
```

- Admin: http://localhost:3000/admin
- Fan landing page: http://localhost:3000/a/oasis-2027

Without SMTP or wallet credentials the app still works end to end. Emails go to the **Email outbox** tab and
the pass page shows the QR code with a "wallet coming soon" note.

## Going live checklist

| Item | What's needed |
|---|---|
| Apple Wallet | Apple Developer account (in atVenu's name), Pass Type ID + certificate. See `certs/README.md`. |
| Google Wallet | Google Pay & Wallet Console issuer account + service account key. See `certs/README.md`. |
| Email | Any SMTP provider (Postmark, SendGrid, SES). Set `SMTP_*` and `EMAIL_FROM` on a verified domain. |
| Hosting | Single Node server with a persistent disk (Render, Railway, Fly.io) **in an EU/UK region**, HTTPS domain e.g. `fans.atvenu.com`. |
| Legal | Review consent wording (`src/lib/consent.ts`) and the privacy notice URL for each activation. |
| atVenu POS | Confirm the merch-stand scanner accepts a QR containing the promo code text. Codes stay typeable as a fallback. |
| Artwork | Licensed artist artwork via the hero image URL. Use Apple/Google's official "Add to Wallet" badges. |

## CSV formats

Columns are matched by name, so exports don't need reformatting:

- **Codes**: a `code` / `promo code` / `discount code` column, or a single-column file.
- **Sales**: code (required) plus any of order ID, total, currency, items, date, venue, city.
  UK/EU `DD/MM/YYYY` dates are handled.

Samples: `public/samples/promo-codes.csv`, `public/samples/redemptions.csv`.

## Project layout

```
src/app/a/[slug]       fan landing page + opt-in
src/app/p/[token]      fan pass page
src/app/api/pass       .pkpass download, Google save link, QR image
src/app/admin          admin (activations, results, fans, imports, outbox, settings, data requests)
src/lib                database, CSV import, wallet pass builders, email, auth
scripts/seed.ts        Oasis example data
```

## Pilot limitations (next steps)

- One shared admin password → per-user logins / SSO.
- SQLite → Postgres when running more than one server.
- CSV import → atVenu API sync (codes created and redemptions pulled automatically).
- Wallet passes are static once issued → Apple/Google update push (e.g. mark as redeemed, new offers).
- No double opt-in email check. Consider adding one if codes are high value.
