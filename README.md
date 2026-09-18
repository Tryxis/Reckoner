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

## Find it on GitHub Pages
https://tryxis.github.io/Reckoner/
