# See You Soon — Alex + Toby

A small, private, mobile-first web app (installable on the iPhone Home Screen) for the time apart and the Vietnam trip, **7–20 December 2026**.

- **Home** — cover with latest activity, countdown to the reunion, journey map + “currently in”, the time-apart calendar, the signals (*Thinking of you*, *Feeling down*, *Call me?*) and the mood (“horniness”) indicator.
- **Wishlist** — image-led bento board / list, place + type filters, add/edit/delete, visited state with an optional memory.
- **Planner** — 7–20 Dec day by day, fixed arrival/departure anchors, travel between cities, sticky drawer of unassigned ideas (long-press drag **or** tap → “Add to day…”).
- **Memories** — postcards (flip to read), small moments, and visited wishlist places.

Stack: Next.js 16 (App Router, TypeScript) on Vercel · Firebase Auth (email + password) · Cloud Firestore (with offline cache) · a few tiny server routes for identity, place search, optional photo search and optional push.

---

## 1. Set up Firebase (≈10 minutes, free “Spark” plan is enough)

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Authentication → Users → Add user**: create one account for Alex and one for Toby (real email addresses, a password each).
   Do this *before* sharing the URL — the app has no sign-up screen.
4. **Build → Firestore Database → Create database** (production mode, a region near you, e.g. `asia-southeast1`).
5. Open `firestore.rules` in this repo and replace the two placeholder emails with your real ones (lowercase):
   ```
   'alex@example.com': 'alex',
   'toby@example.com': 'toby'
   ```
   Then paste the whole file into **Firestore → Rules → Publish** (or run `npm run deploy:rules` after `npx firebase-tools login`).
6. **Project settings → General → Your apps → Web app (</>)** → register an app → copy the config values for the next step.

Photos are compressed on the phone and stored as private Firestore documents, so **Cloud Storage and the paid Blaze plan are not needed**.

## 2. Deploy on Vercel

1. Push this repository to GitHub and import it at <https://vercel.com/new> (framework: Next.js, no other settings).
2. Add these **Environment Variables** (Project → Settings → Environment Variables):

| Variable | Required | Value |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | from the Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | `your-project` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | from the web config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | no | from the web config |
| `ALEX_EMAIL` | yes | Alex's sign-in email (same as in `firestore.rules`) |
| `TOBY_EMAIL` | yes | Toby's sign-in email |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optional | push notifications — see below |
| `VAPID_PRIVATE_KEY` | optional | push notifications |
| `VAPID_SUBJECT` | optional | e.g. `mailto:you@example.com` |
| `UNSPLASH_ACCESS_KEY` | optional | enables “Find a photo instead” in the wishlist form |

3. Deploy. The Firebase web config is not secret (security comes from the rules); the emails, VAPID private key and Unsplash key stay server-side only.
4. In Firebase → **Authentication → Settings → Authorized domains**, add your `*.vercel.app` domain (and any custom domain).

**Do not** set `NEXT_PUBLIC_FIREBASE_EMULATORS` or `FIREBASE_AUTH_EMULATOR_HOST` on Vercel — they are for local development only.

### Optional: push notifications
```bash
npx web-push generate-vapid-keys
```
Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`, redeploy. Each person then opens **Settings (≡ at the bottom of the side rail) → Turn on notifications** *from the Home Screen app*. On iPhone this needs iOS 16.4+ and the app installed to the Home Screen. Without push, everything still shows up in the cover's activity slot.

### Optional: photo search
Create a free app at <https://unsplash.com/developers>, put its **Access Key** in `UNSPLASH_ACCESS_KEY`. Photos are hot-linked and credited as Unsplash requires. Without the key the button is simply not shown.

## 3. Install on the iPhone

1. Open the Vercel URL in **Safari** and sign in.
2. Tap **Share → Add to Home Screen → Add**.
3. Open it from the new icon. It runs full-screen, always opens on the cover, and keeps working offline with the last synced data.
4. In **Settings**: upload a cover photo of the two of you, check the dates/reunion time, and (optionally) turn on notifications.

## 4. What's configurable (in the app, Settings)

Only **Toby** sees and can change the trip settings below. Alex's Settings only show his account, the Home Screen guide and his own notifications. This is enforced in `firestore.rules` (`ownerKey()`), not just hidden in the UI; the owner is set in `src/config/app.ts` (`OWNER`).

Cover title · cover photo · first day apart (seeded **10 Oct**, from the earlier prototype) · reunion date + time (seeded **7 Dec, 12:00** — also from the prototype, please confirm) · reunion place · trip start/end · timezone (default `Asia/Ho_Chi_Minh`; every “today” and the countdown use it) · mood fade time · the journey route (seeded with country-level stops Uzbekistan → Japan → South Korea → Vietnam — add the real cities via search).

Until Alex shares a location for the first time, the map shows him in **Tokyo, Japan** (Uzbekistan done), labelled “until Alex shares an update” — change `DEFAULT_TRAVELLER_LOCATION` in `src/config/app.ts` if needed.

**Daily question:** in Memories, under the postcards. A new question unlocks every day at midnight Vietnam time, starting 10 Nov 2026. You answer for yourself, then guess what the other person would say. Answers are final, and the other person's answer only becomes readable (also in the rules) once you've answered that day yourself. Missed days stay open; after a result, *Next question* takes you to the next open one. The cover's first update line shows "New daily question is available", "[Partner] already did the daily question" or "See the result of the daily question" (gone once you've looked). Answering sends a push but no activity entry. Past days are under *Show archive*.

To **add questions**, append them to the end of `src/config/questions.ts` with a new unique `id` (free answer, or `choice` with up to 6 options). Never remove or rename the id of a question that has already been asked. Toby can reorder the upcoming ones (not today's or past ones) in Settings, which also shows how many are left.

**State of mind pictures:** under the mood selector each of you can add one picture per mood tier (Innocent → Very distracted) — for the *other* person. When you pick a mood, you see the picture your partner added for it as a big, blurred square (tap to peek); with no mood set, or no picture for that tier, nothing is shown. Toby's pictures from before this change count as his set (Alex sees them). Mood changes are only announced after staying the same for 20 seconds. They always show in the activity, but a push ("… horniness increased.") only goes out when the mood moved *up* the scale compared with the last announced one, and never for Innocent. Clearing or letting a mood expire resets that baseline.

The arrival (“Toby arrives in Hanoi”, 7 Dec) and departure (“Both leave from Ho Chi Minh City”, 20 Dec) anchors are editable from the Planner but can't be deleted. No flight details were invented — add them in the anchor's note.

Code-level settings live in `src/config/app.ts` (names, who the traveller is, wishlist categories, mood scale) and design tokens in `src/app/globals.css` (`--cobalt` primary, `--blush` secondary, `--blush-ink` for small pink text, paper neutrals).

**Fonts:** Fraunces (soft/wonky, display), Newsreader (editorial), Be Vietnam Pro (interface) — all with Vietnamese support. If you have a licence for **Magilio**, convert it to `Magilio.woff2` and put it in `public/fonts/`; the cover title then uses it automatically (Magilio has no Vietnamese accents, so it is only used for the English cover title). If you add a wishlist category, also add it to `itemTypes()` in `firestore.rules`.

## 5. Local development

Uses the Firebase emulators (needs Java 11+), so no real project is touched.

```bash
npm install
cp .env.example .env.local   # then use the emulator values below
npm run emulators            # terminal 1: Auth :9099 + Firestore :8080 with firestore.rules
npm run seed:emulator        # terminal 2: creates the two accounts from .env.local in the emulator (password reunion-test-1) + clearly marked SAMPLE content
npm run dev                  # http://localhost:3000
```
`.env.local` for the emulators:
```
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-sys.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-sys
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:demo
NEXT_PUBLIC_FIREBASE_EMULATORS=1
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
ALEX_EMAIL=alex@example.com   # must match the emails in firestore.rules
TOBY_EMAIL=toby@example.com
```
Checks: `npm run typecheck`, `npm run lint`, `npm run build`. `npm run icons` regenerates the Home Screen icons.

## 6. How it works (short)

- **Identity**: Firebase email/password sign-in. `/api/me` verifies the ID token (Google's public keys, no service account) and maps the email to Alex or Toby. Every record stores `by: "alex" | "toby"`, and the rules check it matches the signed-in account — a name can't be picked or faked.
- **Data**: one shared space `spaces/main` with sub-collections `items`, `places`, `travel`, `fixed`, `postcards`, `moments`, `moods`, `events`, `status/location`, `members`, `images`, `thumbs`. Each wishlist item, postcard, event and assignment is its own document; planner assignment is a field on the item (one day at a time).
- **Honest states**: “Saved”/“Sent” only appear after the server confirms. Offline, buttons say “Waiting for connection…” and a bar explains you're seeing the last synced copy. Editing an idea the other person changed meanwhile shows a conflict instead of silently overwriting.
- **Location** is only shared when Alex taps *Update location* (or types a place), rounded to ~1 km, and shown with “shared X ago” — never “live”.
- **Place search** uses Photon/OpenStreetMap (free, no key) through `/api/places/*`. Google Maps links are treated as links only (never scraped for images).

## 7. Known limits

- Google Places photos are not used (paid API). Photos come from your own uploads or (optionally) Unsplash.
- Each photo is capped at ~0.9 MB after on-device compression (plenty for a phone screen).
- Drag-and-drop uses a long-press (≈¼ s) on touch so scrolling never assigns by accident; tapping a card always offers “Add to day…”.
- Push notifications on iPhone only work from the installed Home Screen app (iOS 16.4+).

## 8. Two-device test checklist

1. Both sign in on their own phone; a third email gets “This space is private”.
2. Toby adds a wishlist idea with a photo → it appears on Alex's board within seconds, and Alex's cover shows “Toby added somewhere to go”.
3. Alex taps *Update location* (allow location) → Toby sees the new city, “shared just now”, and the map highlight moves. Toby has no *Update location* button.
4. Alex sends a postcard → Toby's cover shows “A postcard from Alex.”, Memories has a dot; opening it marks it read and the dot disappears.
5. *Thinking of you*, *Feeling down* or *Call me?* from either side → shows on the other cover; a second tap within 90 s doesn't send again.
6. Set a mood → the other person sees it; *Clear it now* removes it; it also fades after the configured hours.
7. Planner: drag an idea from the drawer onto a day (long-press) and tap-assign another; both phones show the same days; the drawer count drops.
8. Add travel Hanoi → Hội An on 11 Dec → “Now in Hội An” appears before 11 Dec on both phones.
9. Both edit the same idea at once → the second save shows the conflict notice.
10. Alex opens Settings → only account, Home Screen guide and notifications; no dates, cover or route editing, and no picture controls in the mood section.
11. Airplane mode → the app still opens with the last data and says it's offline; a postcard waits (“Waiting for connection…”) and sends when back online.
