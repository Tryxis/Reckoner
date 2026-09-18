/* ------------------------------------------------------------------
   Reckoner — attack sequence calculator
   No dependencies, no network, no build step.

   Reading order:
     1. KEYWORDS      what the chips are
     2. chip UI       building and painting them
     3. solve()       the closed-form maths
     4. simulate()    Monte Carlo for models slain
     5. render()      writing it all to the page
     6. wiring        steppers, sheet, theme, service worker
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  /* ============ 1. keyword definitions ============
     p  -> chip carries an inline numeric value
     ex -> chips switched off when this one comes on                 */
  var GROUPS = [
    { name: "Weapon abilities", keys: [
      { id: "torrent",    label: "Torrent" },
      { id: "sustained",  label: "Sustained Hits", p: { def: 1, min: 1, max: 6 } },
      { id: "lethal",     label: "Lethal Hits" },
      { id: "dev",        label: "Devastating Wounds" },
      { id: "anti",       label: "Anti-X", p: { def: 4, min: 2, max: 6 }, suffix: "+" },
      { id: "twin",       label: "Twin-linked", ex: ["rrW1", "rrWall"] },
      { id: "lance",      label: "Lance (charged)" },
      { id: "heavy",      label: "Heavy (moved ≤3\")" },
      { id: "rapid",      label: "Rapid Fire", p: { def: 1, min: 1, max: 6 } },
      { id: "melta",      label: "Melta", p: { def: 2, min: 1, max: 6 } },
      { id: "blast",      label: "Blast / Cleave" },
      { id: "psychic",    label: "Psychic" },
      { id: "conversion", label: "Conversion (long range)" },
      { id: "ignoreCov",  label: "Ignores Cover" },
      { id: "indirect",   label: "Indirect Fire" }
    ]},
    { name: "Re-rolls", keys: [
      { id: "rrH1",    label: "Re-roll hit 1s",     ex: ["rrHall", "rrHcrit"] },
      { id: "rrHall",  label: "Re-roll all hits",   ex: ["rrH1", "rrHcrit"] },
      { id: "rrHcrit", label: "Fish for crit hits", ex: ["rrH1", "rrHall"] },
      { id: "rrW1",    label: "Re-roll wound 1s",   ex: ["rrWall", "twin"] },
      { id: "rrWall",  label: "Re-roll all wounds", ex: ["rrW1", "twin"] }
    ]},
    { name: "Modifiers", keys: [
      { id: "bsUp",    label: "+1 BS",             ex: ["bsDown"] },
      { id: "bsDown",  label: "−1 BS",        ex: ["bsUp"] },
      { id: "hitUp",   label: "+1 to hit",         ex: ["hitDown"] },
      { id: "hitDown", label: "−1 to hit",    ex: ["hitUp"] },
      { id: "wUp",     label: "+1 to wound",       ex: ["wDown"] },
      { id: "wDown",   label: "−1 to wound",  ex: ["wUp"] },
      { id: "critH5",  label: "Crit hits on 5+" },
      { id: "critW5",  label: "Crit wounds on 5+" }
    ]},
    { name: "Target's defensive rules", keys: [
      { id: "cover",   label: "Benefit of cover", ex: ["stealth"] },
      { id: "stealth", label: "Stealth",          ex: ["cover"] },
      { id: "aoc",     label: "Armour of Contempt" },
      { id: "fnp",     label: "Feel No Pain", p: { def: 5, min: 2, max: 6 }, suffix: "+" },
      { id: "dmg1",    label: "−1 Damage" },
      { id: "halve",   label: "Halve damage" }
    ]}
  ];

  var DMG_PRESETS = ["1", "2", "3", "D3", "D6", "D6+1", "D6+2", "2D6"];

  var on = Object.create(null);
  var val = Object.create(null);

  var $ = function (id) { return document.getElementById(id); };

  /* ============ 2. chip UI ============ */
  var chipHost = $("chipHost");
  GROUPS.forEach(function (g) {
    var block = document.createElement("div");
    block.className = "group";
    var h = document.createElement("h3");
    h.textContent = g.name;
    block.appendChild(h);

    var row = document.createElement("div");
    row.className = "chips";

    g.keys.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.id = "chip-" + k.id;
      b.setAttribute("aria-pressed", "false");

      var txt = document.createElement("span");
      txt.textContent = k.label;
      b.appendChild(txt);

      if (k.p) {
        val[k.id] = k.p.def;
        var inp = document.createElement("input");
        inp.type = "number";
        inp.inputMode = "numeric";
        inp.id = "val-" + k.id;
        inp.min = k.p.min; inp.max = k.p.max; inp.step = 1;
        inp.value = k.p.def;
        inp.hidden = true;
        inp.setAttribute("aria-label", k.label + " value");
        inp.addEventListener("click", function (e) { e.stopPropagation(); });
        inp.addEventListener("input", function () {
          var n = parseInt(inp.value, 10);
          val[k.id] = isNaN(n) ? k.p.def : Math.max(k.p.min, Math.min(k.p.max, n));
          update();
        });
        b.appendChild(inp);

        if (k.suffix) {
          var sfx = document.createElement("span");
          sfx.textContent = k.suffix;
          sfx.hidden = true;
          sfx.id = "sfx-" + k.id;
          b.appendChild(sfx);
        }
      }

      b.addEventListener("click", function () {
        on[k.id] = !on[k.id];
        if (on[k.id] && k.ex) {
          k.ex.forEach(function (x) { if (on[x]) { on[x] = false; paint(x); } });
        }
        paint(k.id);
        update();
      });

      row.appendChild(b);
    });

    block.appendChild(row);
    chipHost.appendChild(block);
  });

  function paint(id) {
    var b = $("chip-" + id);
    if (!b) return;
    var active = !!on[id];
    b.setAttribute("aria-pressed", active ? "true" : "false");
    var inp = $("val-" + id);
    if (inp) inp.hidden = !active;
    var sfx = $("sfx-" + id);
    if (sfx) sfx.hidden = !active;
  }

  // damage quick-picks
  var dq = $("dmgQuick");
  DMG_PRESETS.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip qp";
    b.textContent = d;
    b.addEventListener("click", function () {
      $("i-d").value = d;
      update();
    });
    dq.appendChild(b);
  });

  /* ============ 3. the maths ============ */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function num(id, dflt) {
    var n = parseInt($(id).value, 10);
    return isNaN(n) ? dflt : n;
  }

  // d6 success needing n+: an unmodified 1 always fails, a 6 always succeeds
  function pNeed(n) { return (7 - clamp(n, 2, 6)) / 6; }

  // saving throws have no automatic success on a 6
  function pSaveNeed(n) { return n > 6 ? 0 : (7 - Math.max(n, 2)) / 6; }

  function reroll(p, c, mode) {
    if (mode === "ones") return [p + p / 6, c + c / 6];
    if (mode === "all")  return [p + (1 - p) * p, c + (1 - p) * c];
    if (mode === "crit") return [c + (1 - c) * p, c + (1 - c) * c];
    return [p, c];
  }

  function parseDamage(str) {
    var s = String(str || "1").toLowerCase().replace(/\s+/g, "");
    var m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (m) {
      return {
        n: m[1] ? parseInt(m[1], 10) : 1,
        faces: parseInt(m[2], 10),
        flat: m[3] ? parseInt(m[3], 10) : 0
      };
    }
    var f = parseInt(s, 10);
    return { n: 0, faces: 0, flat: isNaN(f) ? 1 : f };
  }

  function rollDamage(d) {
    var t = d.flat;
    for (var i = 0; i < d.n; i++) t += 1 + Math.floor(Math.random() * d.faces);
    return t;
  }

  function woundTarget(S, T) {
    if (S >= T * 2) return 2;
    if (S > T)      return 3;
    if (S === T)    return 4;
    if (S * 2 <= T) return 6;
    return 5;
  }

  function fmt(x, dp) { return x.toFixed(dp === undefined ? 2 : dp); }

  function pct(x) {
    if (x >= 0.995 && x < 1) return "99%";
    if (x > 0 && x < 0.005) return "<1%";
    return Math.round(x * 100) + "%";
  }

  function solve() {
    var A      = clamp(num("i-a", 10), 1, 200);
    var BS     = clamp(num("i-bs", 3), 2, 6);
    var S      = clamp(num("i-s", 4), 1, 30);
    var AP     = clamp(num("i-ap", 0), 0, 6);
    var dmg    = parseDamage($("i-d").value);
    var T      = clamp(num("i-t", 4), 1, 30);
    var Sv     = clamp(num("i-sv", 3), 2, 7);
    var invRaw = $("i-inv").value;
    var Inv    = invRaw === "" ? null : clamp(parseInt(invRaw, 10) || 7, 2, 6);
    var W      = clamp(num("i-w", 1), 1, 40);
    var MODELS = clamp(num("i-models", 5), 1, 30);

    var flags = [];

    /* --- attack dice --- */
    var attacks = A;
    if (on.rapid) attacks += val.rapid;
    if (on.blast) attacks += Math.floor(MODELS / 5);

    /* --- hit step --- */
    var inCover = (on.cover || on.stealth || on.indirect) && !on.ignoreCov;

    var bsMod = 0;
    if (on.bsUp)   bsMod += 1;
    if (on.bsDown) bsMod -= 1;
    if (inCover)   bsMod -= 1;
    bsMod = clamp(bsMod, -1, 1);

    var hitMod = 0;
    if (on.hitUp)   hitMod += 1;
    if (on.hitDown) hitMod -= 1;
    if (on.heavy)   hitMod += 1;
    hitMod = clamp(hitMod, -1, 1);
    if (on.psychic) hitMod = 0;

    var effBS   = clamp(BS - bsMod, 2, 6);
    var hitNeed = clamp(effBS - hitMod, 2, 6);

    var critHitOn = 6;
    if (on.critH5)     critHitOn = 5;
    if (on.conversion) critHitOn = Math.min(critHitOn, 4);

    var pHit   = pNeed(hitNeed);
    var pCritH = pNeed(critHitOn);
    if (pCritH > pHit) pHit = pCritH;          // a critical hit always hits

    var hitRR = "none";
    if (on.rrH1)    hitRR = "ones";
    if (on.rrHall)  hitRR = "all";
    if (on.rrHcrit) hitRR = "crit";
    if (on.indirect && hitRR !== "none") {
      hitRR = "none";
      flags.push("Indirect Fire — hit re-rolls ignored");
    }
    var rh = reroll(pHit, pCritH, hitRR);
    pHit = rh[0]; pCritH = rh[1];

    if (on.torrent) { pHit = 1; pCritH = 0; hitNeed = 0; }

    /* --- wound step --- */
    var wBase = woundTarget(S, T);
    var wMod = 0;
    if (on.wUp)   wMod += 1;
    if (on.wDown) wMod -= 1;
    if (on.lance) wMod += 1;
    wMod = clamp(wMod, -1, 1);
    var wNeed = clamp(wBase - wMod, 2, 6);

    var critWOn = 6;
    if (on.critW5) critWOn = 5;
    if (on.anti)   critWOn = Math.min(critWOn, val.anti);

    var pW     = pNeed(wNeed);
    var pCritW = pNeed(critWOn);
    if (pCritW > pW) pW = pCritW;

    var wRR = "none";
    if (on.rrW1) wRR = "ones";
    if (on.rrWall || on.twin) wRR = "all";
    var rw = reroll(pW, pCritW, wRR);
    pW = rw[0]; pCritW = rw[1];

    /* --- save step --- */
    var apEff  = Math.max(0, AP - (on.aoc ? 1 : 0));
    var armour = Sv + apEff;
    var saveUsed = armour, saveKind = "Armour";
    if (Inv !== null && Inv < armour) { saveUsed = Inv; saveKind = "Invuln"; }
    if (saveUsed > 6) saveKind = "None";
    var pSaveOK = pSaveNeed(saveUsed);

    /* --- damage --- */
    var meltaX   = on.melta ? val.melta : 0;
    var pFnpSave = on.fnp ? pNeed(val.fnp) : 0;

    /* --- closed-form expectation --- */
    var sustainedX  = on.sustained ? val.sustained : 0;
    var normalHits  = pHit - pCritH;
    var woundDice   = normalHits + (on.lethal ? 0 : pCritH) + pCritH * sustainedX;
    var autoWounds  = on.lethal ? pCritH : 0;

    var expHits    = attacks * (pHit + pCritH * sustainedX);
    var expWounds  = attacks * (autoWounds + woundDice * pW);
    var expDev     = on.dev ? attacks * woundDice * pCritW : 0;
    var expNormalW = expWounds - expDev;
    var expUnsaved = expDev + expNormalW * (1 - pSaveOK);

    var meanD = dmg.flat + dmg.n * (dmg.faces + 1) / 2 + meltaX;
    if (on.halve) meanD = meanD / 2;
    if (on.dmg1)  meanD = meanD - 1;
    if (meanD < 1) meanD = 1;
    var expDamage = expUnsaved * meanD * (1 - pFnpSave);

    /* --- readable damage expression --- */
    var base = dmg.n
      ? (dmg.n > 1 ? dmg.n : "") + "D" + dmg.faces + (dmg.flat ? (dmg.flat > 0 ? "+" + dmg.flat : dmg.flat) : "")
      : String(dmg.flat);
    var dmgLabel = base + (meltaX ? "+" + meltaX : "");
    if (on.halve) dmgLabel = "⌈(" + dmgLabel + ")÷2⌉";
    if (on.dmg1)  dmgLabel = dmgLabel + " −1";
    if (on.halve || on.dmg1) dmgLabel += " min 1";

    if (on.torrent && (on.lethal || on.sustained)) flags.push("Torrent makes no hit rolls — no critical hits");
    if (on.psychic && (on.hitUp || on.hitDown || on.heavy)) flags.push("Psychic ignores hit-roll modifiers");
    if (on.ignoreCov && (on.cover || on.stealth)) flags.push("Ignores Cover cancels the cover penalty");
    if (on.dev && Inv !== null) flags.push("Devastating Wounds bypass the invulnerable save");

    return {
      attacks: attacks, hitNeed: hitNeed, wNeed: wNeed, saveUsed: saveUsed, saveKind: saveKind,
      effBS: effBS, hitMod: hitMod, wMod: wMod, critHitOn: critHitOn, critWOn: critWOn,
      pHit: pHit, pCritH: pCritH, pW: pW, pCritW: pCritW, pSaveOK: pSaveOK, pFnpSave: pFnpSave,
      sustained: sustainedX, lethal: !!on.lethal, dev: !!on.dev, torrent: !!on.torrent,
      dmg: dmg, melta: meltaX, halve: !!on.halve, dmg1: !!on.dmg1, fnp: !!on.fnp,
      W: W, models: MODELS,
      expHits: expHits, expWounds: expWounds, expUnsaved: expUnsaved, expDamage: expDamage,
      dmgLabel: dmgLabel, flags: flags
    };
  }

  /* ============ 4. simulation ============ */
  var TRIALS = 20000;

  function simulate(s) {
    var counts = new Array(s.models + 1);
    for (var z = 0; z <= s.models; z++) counts[z] = 0;
    var totalSlain = 0;

    for (var t = 0; t < TRIALS; t++) {
      var alive = s.models, curW = s.W, slain = 0;

      for (var a = 0; a < s.attacks && alive > 0; a++) {
        var dice = 0, autoW = 0;

        if (s.torrent) {
          dice = 1;
        } else {
          var r = Math.random();
          if (r < s.pCritH) {
            if (s.lethal) autoW++; else dice++;
            dice += s.sustained;
          } else if (r < s.pHit) {
            dice++;
          }
        }

        var normalW = autoW, devW = 0;
        for (var i = 0; i < dice; i++) {
          var rw = Math.random();
          if (rw < s.pCritW) { if (s.dev) devW++; else normalW++; }
          else if (rw < s.pW) { normalW++; }
        }

        var unsaved = devW;
        for (var j = 0; j < normalW; j++) {
          if (Math.random() >= s.pSaveOK) unsaved++;
        }

        for (var u = 0; u < unsaved && alive > 0; u++) {
          var d = rollDamage(s.dmg) + s.melta;
          if (s.halve) d = Math.ceil(d / 2);
          if (s.dmg1)  d -= 1;
          if (d < 1) d = 1;

          if (s.fnp) {
            var through = 0;
            for (var k = 0; k < d; k++) { if (Math.random() >= s.pFnpSave) through++; }
            d = through;
          }
          if (d <= 0) continue;

          if (d >= curW) { alive--; slain++; curW = s.W; }  // excess damage is lost
          else curW -= d;
        }
      }

      counts[slain]++;
      totalSlain += slain;
    }

    return { counts: counts, mean: totalSlain / TRIALS };
  }

  /* ============ 5. render ============ */
  function renderFast(s) {
    var hitEl = $("p-hit");
    hitEl.className = "v" + (s.torrent ? " na" : "");
    hitEl.textContent = s.torrent ? "AUTO" : s.hitNeed + "+";
    $("n-hit").textContent = s.torrent
      ? "Torrent"
      : "BS " + s.effBS + "+" + (s.hitMod ? (s.hitMod > 0 ? " +1" : " −1") : "") +
        (s.critHitOn < 6 ? " · crit " + s.critHitOn + "+" : "");

    $("p-wound").textContent = s.wNeed + "+";
    $("n-wound").textContent =
      (s.wMod ? (s.wMod > 0 ? "+1 wound" : "−1 wound") : "S vs T") +
      (s.critWOn < 6 ? " · crit " + s.critWOn + "+" : "");

    var sv = $("p-save");
    if (s.saveKind === "None") { sv.className = "v na"; sv.textContent = "NONE"; }
    else { sv.className = "v"; sv.textContent = s.saveUsed + "+"; }
    $("n-save").textContent = s.saveKind === "None" ? "AP strips it" : s.saveKind;

    $("p-dmg").textContent = s.dmgLabel;

    $("r-att").textContent     = s.attacks;
    $("r-hits").textContent    = fmt(s.expHits);
    $("r-wounds").textContent  = fmt(s.expWounds);
    $("r-unsaved").textContent = fmt(s.expUnsaved);
    $("r-dmg").textContent     = fmt(s.expDamage, 1);

    $("e-crith").textContent = s.torrent ? "automatic" : "crit " + pct(s.pCritH);
    $("e-critw").textContent = s.dev ? "crits unsaveable" : "";
    $("e-fnp").textContent   = s.fnp ? "after FNP" : "";

    $("flags").textContent = s.flags.join(" · ");
    $("n-slain").textContent = "of " + s.models;

    var n = 0;
    for (var key in on) { if (on[key]) n++; }
    $("selCount").textContent = n ? n + " on" : "none";
  }

  function renderSim(s) {
    var sim = simulate(s);
    $("p-slain").textContent = fmt(sim.mean, 1);
    $("r-slain").textContent = fmt(sim.mean, 1);

    var host = $("dist");
    host.textContent = "";
    var max = 1;
    for (var m = 0; m < sim.counts.length; m++) { if (sim.counts[m] > max) max = sim.counts[m]; }

    for (var i = 0; i < sim.counts.length; i++) {
      var row = document.createElement("div");
      row.className = "distrow";

      var k = document.createElement("span");
      k.className = "dk";
      k.textContent = i;

      var bar = document.createElement("div");
      bar.className = "bar";
      var fill = document.createElement("i");
      if (i === s.models) fill.className = "wipe";
      fill.style.width = (sim.counts[i] / max * 100).toFixed(1) + "%";
      bar.appendChild(fill);

      var v = document.createElement("span");
      v.className = "dv";
      v.textContent = pct(sim.counts[i] / TRIALS);

      row.appendChild(k); row.appendChild(bar); row.appendChild(v);
      host.appendChild(row);
    }

    $("p-wipe").textContent = pct(sim.counts[s.models] / TRIALS);
  }

  // The closed-form half is instant; the 20k simulation is debounced so
  // holding down a stepper stays smooth on a phone.
  var simTimer = null;
  function update() {
    var s = solve();
    renderFast(s);
    if (simTimer) clearTimeout(simTimer);
    simTimer = setTimeout(function () { renderSim(s); }, 130);
  }

  /* ============ 6. wiring ============ */
  var FIELDS = ["i-a", "i-bs", "i-s", "i-ap", "i-d", "i-t", "i-sv", "i-inv", "i-w", "i-models"];
  FIELDS.forEach(function (id) { $(id).addEventListener("input", update); });

  // stepper buttons, with press-and-hold repeat
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-step]") : null;
    if (!b) return;
    nudge(b.getAttribute("data-for"), parseInt(b.getAttribute("data-step"), 10));
  });

  function nudge(id, by) {
    var el = $(id);
    var min = el.min === "" ? -Infinity : parseInt(el.min, 10);
    var max = el.max === "" ? Infinity : parseInt(el.max, 10);

    // The invulnerable field may be empty, meaning the target has none.
    // Stepping down from empty gives the weakest save; stepping up from
    // empty does nothing, because nothing is worse than no save at all.
    if (el.value === "") {
      if (by > 0) return;
      el.value = max;
      update();
      return;
    }

    var cur = parseInt(el.value, 10);
    if (isNaN(cur)) cur = min;
    var next = cur + by;

    if (id === "i-inv" && next > max) { el.value = ""; update(); return; }

    el.value = clamp(next, min, max);
    update();
  }

  $("clearBtn").addEventListener("click", function () {
    Object.keys(on).forEach(function (k) { if (on[k]) { on[k] = false; paint(k); } });
    update();
  });

  /* results sheet (phones only — on wide screens CSS pins it as a column) */
  var results = $("results");
  var scrim = $("scrim");
  var grab = $("grabBtn");
  var caption = $("grabCaption");

  function setSheet(open) {
    results.classList.toggle("open", open);
    scrim.hidden = !open;
    // let the element paint before the opacity transition starts
    requestAnimationFrame(function () { scrim.classList.toggle("on", open); });
    grab.setAttribute("aria-expanded", open ? "true" : "false");
    caption.textContent = open ? "Tap to collapse" : "Tap for full breakdown";
  }
  grab.addEventListener("click", function () {
    setSheet(!results.classList.contains("open"));
  });
  scrim.addEventListener("click", function () { setSheet(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && results.classList.contains("open")) setSheet(false);
  });

  /* theme */
  var THEME_KEY = "reckoner.theme";
  try {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  } catch (err) { /* private mode, blocked storage — the OS theme still applies */ }

  $("themeBtn").addEventListener("click", function () {
    var root = document.documentElement;
    var cur = root.getAttribute("data-theme");
    if (!cur) {
      cur = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    var next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#171b1e");
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* ignore */ }
  });

  /* offline cache — only on a real web origin, never inside the native shell */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () { /* offline is a bonus, not a requirement */ });
    });
  }

  update();
})();
