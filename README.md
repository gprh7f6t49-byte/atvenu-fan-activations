# atVenu Fan Activations (pilot)

Unique atVenu promo codes delivered as Apple / Google Wallet QR passes, redeemed at the merch stand, with
atVenu's redemption report tying every sale back to the person who held the code.

Three activation types:

| Type | Who gets passes | How | Typical discount |
|---|---|---|---|
| **Fan activation** | The public | Fans opt in on a branded landing page (with GDPR consents) | 15% off, one use |
| **Crew sales** | Touring crew | Merch team issues named passes (one at a time or CSV crew list) | 25% off, reusable all tour |
| **Venue & management comps** | Venue staff, management, label, promoter reps | Merch team issues named passes, tagged by group and organisation | £40 off or 100% off, one use |

Each activation has its own pool of atVenu codes and a **discount** set as a percentage or a fixed amount
(GBP / EUR / USD), with codes set to one order each or reusable. Set the same discount on the codes in atVenu.
atVenu applies it at the till; this app shows it on the pass and estimates discount value in reports.

**Tours** hold the dates and cities (a city can have several dates). Activations attached to a tour use its dates
automatically, and crew / comp activations can then get **PIN-protected city sign-up links**.

Example: **Oasis — Live '27 European Tour** (sample data), with all three types and crew links for London,
Manchester and Dublin.

## How it works

1. **Create an activation** in the admin: pick the type, then artist, tour, discount, brand colours, tour dates.
2. **Import promo codes**: generate unique single-use codes in atVenu, export them as CSV, upload.
3. **Share the landing page** (`/a/<slug>`). Add `?utm_source=instagram` etc. to track where fans came from.
4. **The fan opts in** and gets the next unused code. Signing up again with the same email returns the same code.
   Marketing consents (artist / promoter / atVenu) are optional, unticked by default, and stored with the exact wording shown.
5. **Pass delivery**: pass page with QR + Add to Apple Wallet / Google Wallet, plus an email copy.
   The QR contains the raw atVenu promo code, so the POS reads it exactly like a typed code.
6. **Upload sales** after each show: the atVenu orders export (CSV). Each code is matched to its fan,
   giving conversion, attributed sales (per currency) and results by venue. Re-uploading the same file is safe.
7. **Export fans** (CSV, with consent flags) to share with the artist or promoter, only where consent was given.

**Crew and comps** skip the landing page (there is no public sign-up). Under the **Crew / Recipients** tab, issue
passes one by one or upload a CSV list (`name`, `email`, plus `department` for crew or `group`, `organisation`, `role`
for comps). Passes can be emailed, opened, re-sent or **revoked**. Revoking kills the pass page and wallet downloads;
also disable the code in atVenu. Results show usage by department or group and the estimated discount given.
If the atVenu export includes a discount column, that figure is used instead of the estimate.

### Crew self sign-up (city links)

1. **Tours → New tour**: add the dates (one by one or paste a list). Dates in the same city are grouped together.
2. Create the crew activation from the tour page (**+ Crew sales**) and import its atVenu codes. Then **Go live**.
3. **City sign-up links** tab: pick a city. You get a short URL (e.g. `/c/DEtEcCVS`) and a random 6-digit PIN.
   Options: pass valid for that city's dates only or the whole tour, when the link closes (default: the morning after
   the city's last show), and a cap on sign-ups.
4. Share it with the **WhatsApp** / **Text message** buttons (pre-written message with link and PIN), copy the link or
   PIN separately, or print the QR code for the production office.
5. Crew open the link, enter the PIN, then give their name, email and department, and get their pass immediately
   (also emailed). City-only passes show "Valid in London" and expire after the city's dates in Apple / Google Wallet.

Security: a wrong PIN counts against the connection (10 per 15 minutes) and the link (100 per hour). Correct entries
don't count, so crew sharing venue Wi-Fi aren't locked out. **New PIN** signs everyone out of the old one, and existing
passes keep working. Signing up again with an email that already has a pass re-sends it by email rather than showing it,
so nobody can pull up someone else's pass by typing their email. The fan landing page now works the same way.

GDPR access and erasure requests are under **Admin → Data requests**.

## Run it locally

Requires Node 22.13+ (uses the built-in SQLite).

```bash
npm install
cp .env.example .env.local      # set ADMIN_PASSWORD at minimum
npm run seed -- --demo          # Oasis fan, crew and comps examples with sample passes and sales
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

- **Crew / comp lists**: `name` (or first/last name) and `email`, plus optional department, group, organisation, role.

Samples are in `public/samples/`: promo codes, redemptions, crew list and comp list.

## Project layout

```
src/app/a/[slug]       fan landing page + opt-in
src/app/c/[token]      PIN-protected crew / comp city sign-up page
src/app/p/[token]      fan pass page
src/app/api/pass       .pkpass download, Google save link, QR image
src/app/admin          admin (tours, activations, results, people, city links, imports, outbox, settings, data requests)
src/lib                database, CSV import, wallet pass builders, email, auth
scripts/seed.ts        Oasis example data
```

## Pilot limitations (next steps)

- One shared admin password → per-user logins / SSO.
- Rate limits are in-memory (one server) → Redis or edge rate limiting when scaling out.
- SQLite → Postgres when running more than one server.
- CSV import → atVenu API sync (codes created and redemptions pulled automatically).
- Wallet passes are static once issued → Apple/Google update push (e.g. mark as redeemed, new offers).
- No double opt-in email check. Consider adding one if codes are high value.
