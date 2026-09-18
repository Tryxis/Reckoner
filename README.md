# Reckoner

An attack-sequence probability calculator for tabletop wargames. Put in a weapon
profile and a target, toggle the keywords in play, and it gives you the rolls you
need, the expected damage, and how many models are likely to fall.

The whole app is four static files with no dependencies, no build step and no
network requests. That is deliberate: it means the same folder can be served from
GitHub Pages **and** wrapped as an iOS/Android app without changing a line.

---

## What's in here

```
reckoner/
├── www/                      the entire app — this folder is what gets published
│   ├── index.html
│   ├── app.css
│   ├── app.js                keyword definitions, maths engine, simulation, UI
│   ├── manifest.webmanifest  makes it installable
│   ├── sw.js                 offline cache
│   └── icons/
├── tools/
│   └── make-icons.py         regenerates every icon from one script
├── capacitor.config.json     native app id, name and colours
├── package.json
├── .github/workflows/pages.yml
└── README.md
```

Everything uses **relative paths**, which is what lets it work from a project
subfolder like `tryxis.github.io/reckoner/` instead of only at a domain root.

---

## Run it locally

Any static server will do. With Node installed:

```bash
npm run serve          # http://localhost:5173
```

Or with Python, which needs nothing installed:

```bash
cd www && python3 -m http.server 5173
```

Opening `www/index.html` directly with `file://` mostly works, but the service
worker won't register, so use a server if you want to test offline behaviour.

---

## Host it on GitHub Pages

**Option A — the included workflow (recommended).** It publishes `www/` without
you having to restructure anything.

1. Create a repo (e.g. `reckoner`) and push this folder to `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push once more, or run the workflow manually from the **Actions** tab.

You'll be live at `https://tryxis.github.io/reckoner/` in a minute or two.

**Option B — no Actions.** Rename `www` to `docs`, then **Settings → Pages →
Source: Deploy from a branch → main / docs**. If you do this, change `webDir` in
`capacitor.config.json` to `"docs"` too, so the native build keeps working.

### Installing it on a phone from Pages

Once it's hosted, it's a proper installable web app — no store needed:

- **iOS Safari:** Share → Add to Home Screen
- **Android Chrome:** ⋮ menu → Add to Home screen / Install app

It then opens full-screen with its own icon and runs with no signal.

> Pages caches aggressively and so does the service worker. After you deploy a
> change, bump `CACHE = "reckoner-v1"` to `v2` in `www/sw.js` — that is what
> tells already-installed copies to fetch the new files.

---

## Build the iOS and Android apps

Capacitor wraps `www/` in a native shell. Your web code is the app; there's no
port and no rewrite.

### Prerequisites

| Target  | You need |
|---------|----------|
| Android | [Android Studio](https://developer.android.com/studio), JDK 17 |
| iOS     | A Mac, Xcode 15+, CocoaPods (`sudo gem install cocoapods`) |

Node 18+ for both.

### First-time setup

```bash
npm install
npx cap add android        # creates ./android
npx cap add ios            # creates ./ios   (Mac only)
```

### Every time you change the web app

```bash
npx cap sync               # copies www/ into both native projects
npm run android            # or: npm run ios
```

That opens Android Studio or Xcode. Press Run to put it on a device or simulator.

### Before you ship

- **App icons and splash.** The easiest route is
  [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets): drop a
  1024×1024 PNG and a splash image in `assets/`, then
  `npx @capacitor/assets generate`. Or edit `tools/make-icons.py` and export a
  1024px version to feed it.
- **Status bar.** The dark app bar sits under the iOS status bar. Install
  `@capacitor/status-bar` and set the style to `Dark` on launch if you want the
  clock to stay legible.
- **Signing.** Android wants a release keystore; iOS wants a provisioning profile
  from an Apple Developer account (£79/yr). Google Play is a one-off $25.
- **App Store review.** Apple rejects apps that are just a website in a wrapper
  (guideline 4.2, "Minimum Functionality"). Offline operation and the native
  install help; if it's refused, the usual fix is to add something the web can't
  do — saved unit profiles, a share sheet, or a home-screen widget.

### Changing the name or bundle ID

`capacitor.config.json` holds both:

```json
"appId":   "io.github.tryxis.reckoner",
"appName": "Reckoner"
```

Change them **before** running `cap add`, because the ID is baked into the native
projects. If you change it afterwards, delete `ios/` and `android/` and re-add.

---

## How the maths works

Written against the current edition of the rules it models.

- **Wound chart** — 2+ if Strength is double Toughness or more, 3+ if Strength is
  higher, 4+ if equal, 5+ if lower, 6+ if half or less. Unmodified 1s always fail;
  unmodified 6s are critical hits and critical wounds and always succeed.
- **Cover** is a −1 to the attacker's ballistic skill, not a save bonus, so it
  does nothing against melee and never touches an invulnerable save.
- **Modifier caps** — ballistic-skill, hit-roll and wound-roll modifiers are each
  clamped to ±1 and tracked separately, so cover plus a −1 to hit stacks to an
  effective −2.
- **Saves** — the invulnerable save is used whenever it beats the AP-modified
  armour save. Devastating Wounds bypass both and leave only Feel No Pain.
- **Damage order** — roll, add Melta, halve and round up, subtract reduction, to a
  minimum of 1. Feel No Pain is rolled per point of damage.
- **Damage does not spill.** Whatever is left when a model dies is lost, which is
  why a D6-damage weapon is so wasteful against one-wound models.

Hits, wounds and unsaved wounds are exact closed-form expectations. **Models
slain** comes from 20,000 simulated attack sequences per update, because spill,
Feel No Pain and variable damage interact in ways a formula handles badly — so
that figure wobbles in the last decimal between runs.

If your group plays the damage order or the modifier caps differently, both live
in `solve()` in `app.js` and are a two-line change.

---

## A note before publishing

The app contains no game rules text, no datasheets and no publisher artwork — it
only does arithmetic on numbers you type in, which is the safe side of the line.
Keep it that way in the store listing: no publisher trademarks in the app name,
icon, screenshots or description, and describe it generically. Games Workshop's
[IP guidelines](https://www.games-workshop.com/en-GB/Intellectual-Property-Guidelines)
are worth reading in full before you put anything on a store.

---

MIT licensed. Built for David Butterworth.
