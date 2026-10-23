# atVenu Activations (pilot)

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

**Client accounts**: atVenu admins create a client (e.g. a merch company) under **Clients** and invite its first
user. Each client signs in with their own email and password and only ever sees their own tours, activations, fans,
crew and reports. Client admins invite teammates under **Team**. Invites and password resets are one-time links,
emailed when SMTP is set up and always shown to the inviter to copy.

| Role | Can |
|---|---|
| atVenu admin | See and manage every client, create clients, invite atVenu admins |
| Client admin | Manage their organisation's tours and activations, invite and manage teammates |
| Client member | Manage their organisation's tours and activations |

**Tours** hold the dates and cities (a city can have several dates). Activations attached to a tour use its dates
automatically, and crew / comp activations can then get **PIN-protected city sign-up links**.

Example: **Oasis — Live '27 European Tour** (sample data), with all three types and crew links for London,
Manchester and Dublin.

## How it works

1. **Create an activation** in the admin: pick the type, then artist, tour, discount, brand colours, tour dates.
2. **Get promo codes**, either way:
   - **Generate them here** (quantity, prefix, length) and go live straight away. Then **Download for atVenu**
     (CSV of codes with the activation's discount) and send it to atVenu to load. Each batch shows *Not sent yet*,
     then *Sent · awaiting atVenu*, then *Loaded*. Until a batch is marked loaded, a warning reminds you that passes work
     but the till won't accept those codes yet.
   - **Import them**: export codes already created in atVenu as CSV and upload.
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

**Campaigns** hold activations. A campaign is a **Tour** (many shows across cities), a **Festival** (any mix of days and
venues — several weekends, several sites) or an **Event** (a one-off show or two, a pop-up shop, a food & drink offer).
The Campaigns screen lists them, one row each, with a chip per activation (dot = live / draft / ended; "F&B" when it
covers food & drink). Click one to open its **Overview** (summary cards, dates, name and details, recent changes) with a
tab per activation type (Fan / Crew / Comps), each keeping its own Results, people, sign-up links, codes and settings,
plus **+ Add activation**. **New campaign** asks for the type, then the name; add the dates (paste any format) and set up
the activations on the Overview.

Each activation's discount covers **merch, food & drink, or both** on one pass (Settings → "What does the discount
cover?"), with optional wording for where the pass is shown (e.g. "VIP Bar"). Headlines, terms, the landing page,
passes and emails follow it ("15% off merch, food & drink"), and the atVenu code download has an "Applies To" column so
each till system can be set up. Crew / comp sign-up links are per city for tours and events, and per venue for festivals.

Existing data converts automatically: tours become Tour campaigns, standalone activations become Event campaigns (old
links redirect), and bar / food & drink offers are marked as food & drink.

**Deleting:** an activation can be deleted from its Settings tab (type its name to confirm). This removes its passes,
codes, sign-up links and imported sales, and anyone left with no passes. A tour can be deleted only once all its
activations are gone; a standalone event goes with its last activation. Only client admins (and atVenu admins) can
delete. **Renaming:** use **Rename** next to a tour or event's title.

**Change log** (menu): who created, edited, renamed, launched, ended or deleted tours, events, activations, dates,
codes, sales imports and sign-up links, with what changed (e.g. "Discount: 15 → 20"). Searchable, filterable per tour /
event (each Overview shows its recent changes) and downloadable as CSV.

1. **Tours → New tour** (or **New activation → Create a tour**): add the dates. Dates are typed as **DD-MM-YYYY**. The quickest way is **Import dates from the
   tour page**: paste the artist's or promoter's tour page link (or copy the dates off the page and paste the text).
   You'll see the dates it found in an editable table, with any already on the tour unticked, and add the ones you want.
   It reads the schema.org event data most ticketing and artist sites publish, and falls back to the page text. Sites
   that block automated reading or load dates with scripts need the copy-and-paste route. Only public web addresses
   are fetched. Dates in the same city are grouped together.
2. **Set up activations** on the tour page: tick Crew sales (and Fan / Comps if needed), generate or later import the
   codes, then **Go live**.
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

### Branding

The admin and sign-in pages use the atVenu dark theme from `public/brand/atvenu-brand.css` (tokens, Rubik / Inter,
gradient buttons, light-blue links), with the logos in `public/brand/`. It's applied by the `.atv` class in
`src/app/globals.css`, which remaps the Tailwind colours used across the admin. Fan landing pages, pass pages and crew
sign-up pages keep each artist's colours and carry a small "Powered by atVenu" link.

### Images

**Landing page image layout** (activation Settings, or the setup page): choose **Poster** (whole image, uncropped,
on a blurred copy of itself; the default for new activations), **Full background** (fills the first screen behind
the text) or **Banner** (a strip across the top). Click the image to set the **focal point** that stays in view when
it's cropped, pick a **tint** (Light / Medium / Strong; a suggestion is made from the image's brightness), and check
the live desktop and phone previews. Small images get a warning for layouts that would stretch them. Activations
created before this keep the Full background look.

In an activation's **Settings**, upload a **Landing page image** (fan activations) and a **Pass image** (JPG, PNG or
WebP, up to 10 MB). Uploads are checked, resized to 2400px max and stripped of metadata. They're stored next to the
database (`uploads/` on the Railway volume). The pass image is used for the Apple Wallet strip, the Google Wallet hero,
the pass page and the email banner (the banner only appears on an https domain). Without a pass image, fan passes use
the landing image, and otherwise the brand colours.

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

See **DEPLOY.md** for putting it online (Railway, ~15 minutes).

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

- Email + password accounts → add SSO / two-factor for larger clients.
- Rate limits are in-memory (one server) → Redis or edge rate limiting when scaling out.
- SQLite → Postgres when running more than one server.
- CSV import → atVenu API sync (codes created and redemptions pulled automatically).
- Wallet passes are static once issued → Apple/Google update push (e.g. mark as redeemed, new offers).
- No double opt-in email check. Consider adding one if codes are high value.
