/* ============================================================================
 *  VERSIONI DEL MODELLO  +  MANOPOLA (dial orizzontale stile sintonia radio)
 *  ----------------------------------------------------------------------------
 *  Aggiungi una voce all'array e comparira' nella manopola. La prima con
 *  stato "attiva" e' quella in uso (al centro all'apertura).
 * ========================================================================== */
window.VERSIONI = [
  {
    id: "v1",
    nome: { it: "Prototipo", en: "Prototype" },
    data: "2026",
    stato: "attiva",
    assunzioni: [
      { it: "Rendimento medio 7%", en: "Mean return 7%" },
      { it: "Volatilità 15%",       en: "Volatility 15%" },
      { it: "Senza inflazione",     en: "No inflation" },
      { it: "Senza costi né tasse", en: "No fees or taxes" },
    ],
    note: {
      it: "Prima versione: motore Monte Carlo gaussiano portato fedelmente dal C++, percentili 10/50/90 e rendita semplificata.",
      en: "First version: Gaussian Monte Carlo engine faithfully ported from C++, 10/50/90 percentiles and simplified annuity.",
    },
  },
  {
    id: "v2",
    nome: { it: "Inflazione & costi", en: "Inflation & fees" },
    data: null,
    stato: "in-arrivo",
    assunzioni: [
      { it: "Inflazione reale", en: "Real inflation" },
      { it: "Costi di gestione", en: "Management fees" },
    ],
    note: {
      it: "In arrivo: inflazione reale, costi di gestione e tassazione dei fondi pensione.",
      en: "Coming soon: real inflation, management fees and pension-fund taxation.",
    },
  },
  {
    id: "v3",
    nome: { it: "Mercati storici", en: "Historical markets" },
    data: null,
    stato: "in-arrivo",
    assunzioni: [
      { it: "Rendimenti storici", en: "Historical returns" },
      { it: "Correlazioni", en: "Correlations" },
    ],
    note: {
      it: "In studio: simulazioni basate su serie storiche reali dei mercati, non più su una sola campana gaussiana.",
      en: "In study: simulations based on real historical market series, no longer a single Gaussian bell.",
    },
  },
];

(function () {
  function lang() { return document.documentElement.lang === "en" ? "en" : "it"; }
  function tr(o) { return o ? (o[lang()] || o.it) : ""; }
  function t(key) { return (window.I18N[lang()] || {})[key] || key; }

  const wrap = document.getElementById("versionWrap");
  const pill = document.getElementById("versionPill");
  if (!wrap || !pill) return;

  const V = window.VERSIONI;
  const N = V.length;
  const activeReal = Math.max(0, V.findIndex(v => v.stato === "attiva"));
  pill.querySelector(".version-id").textContent = V[activeReal].id;

  // costanti animazione
  const SPACING = 134;   // distanza orizzontale tra le tacche
  const ANGLE   = 46;    // rotazione prospettica ai lati
  const reduce  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let overlay = null, track = null, items = [], caption = null, dialWindow = null;
  let active = activeReal;     // puo' essere frazionario durante il trascinamento
  let lastSettled = activeReal;

  /* ---- costruzione DOM della manopola ---- */
  function build() {
    overlay = document.createElement("div");
    overlay.className = "dial-overlay glass";
    overlay.innerHTML = `
      <div class="dial">
        <div class="dial-window"></div>
        <div class="dial-track"></div>
        <button class="dial-arrow prev" aria-label="prev">‹</button>
        <button class="dial-arrow next" aria-label="next">›</button>
        <div class="dial-fade left"></div>
        <div class="dial-fade right"></div>
      </div>
      <div class="dial-caption"></div>`;
    track = overlay.querySelector(".dial-track");
    caption = overlay.querySelector(".dial-caption");
    dialWindow = overlay.querySelector(".dial-window");

    items = V.map((v, i) => {
      const b = document.createElement("button");
      b.className = "dial-item";
      b.dataset.i = i;
      b.innerHTML = `<span class="di-id">${v.id}</span><span class="di-name">${tr(v.nome)}</span>`;
      b.addEventListener("click", () => { if (!dragging) goTo(i); });
      track.appendChild(b);
      return b;
    });

    overlay.querySelector(".prev").addEventListener("click", () => goTo(Math.round(active) - 1));
    overlay.querySelector(".next").addEventListener("click", () => goTo(Math.round(active) + 1));

    overlay.addEventListener("wheel", onWheel, { passive: false });
    track.addEventListener("pointerdown", onDown);

    wrap.appendChild(overlay);
  }

  /* ---- disposizione (transform per ogni tacca) ---- */
  function layout() {
    items.forEach((el, i) => {
      const off = i - active;
      const a = Math.abs(off);
      const x = off * SPACING;
      const ry = -off * ANGLE;
      const z = -a * 80;
      const sc = Math.max(0.62, 1 - a * 0.16);
      const op = Math.max(0, 1 - a * 0.5);
      el.style.transform =
        `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${sc})`;
      el.style.opacity = op;
      el.style.zIndex = String(100 - Math.round(a));
      el.classList.toggle("is-center", Math.round(off) === 0);
      el.style.pointerEvents = op < 0.15 ? "none" : "auto";
    });
  }

  /* ---- vai alla versione i (con snap morbido) ---- */
  function goTo(i) {
    i = Math.max(0, Math.min(N - 1, i));
    track.classList.remove("dragging");
    active = i;
    layout();
    settle(i);
  }

  /* ---- aggiorna pill + didascalia quando si "posa" su una versione ---- */
  function settle(i) {
    if (i === lastSettled && caption.dataset.ready) return;
    lastSettled = i;
    const v = V[i];
    const isOn = v.stato === "attiva";
    const stato = isOn ? t("statoAttiva") : t("statoInArrivo");
    const chips = (v.assunzioni || []).map(a => `<span class="vc-chip">${tr(a)}</span>`).join("");
    const html = `
      <div class="dc-top">
        <span class="dc-name"><b>${v.id}</b> · ${tr(v.nome)}</span>
        <span class="v-state ${isOn ? "on" : "soon"}">${stato}${v.data ? " · " + v.data : ""}</span>
      </div>
      <p class="dc-note">${tr(v.note)}</p>
      ${chips ? `<div class="v-chips">${chips}</div>` : ""}`;
    // crossfade morbido della didascalia
    caption.style.opacity = "0";
    setTimeout(() => {
      caption.innerHTML = html;
      caption.dataset.ready = "1";
      requestAnimationFrame(() => { caption.style.opacity = "1"; });
    }, reduce ? 0 : 130);
  }

  /* ---- trascinamento ---- */
  let dragging = false, startX = 0, startActive = 0, moved = false;
  function onDown(e) {
    dragging = true; moved = false;
    startX = e.clientX; startActive = active;
    track.classList.add("dragging");
    track.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    active = Math.max(-0.5, Math.min(N - 0.5, startActive - dx / SPACING));
    layout();
    const r = Math.round(Math.max(0, Math.min(N - 1, active)));
    if (r !== lastSettled) settle(r);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    goTo(Math.round(active));
  }

  /* ---- rotellina ---- */
  let wheelLock = false;
  function onWheel(e) {
    e.preventDefault();
    if (wheelLock) return;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    goTo(Math.round(active) + (d > 0 ? 1 : -1));
    wheelLock = true;
    setTimeout(() => { wheelLock = false; }, 260);
  }

  /* ---- apertura / chiusura ---- */
  function open() {
    if (overlay) return;
    build();
    active = activeReal;
    caption.dataset.ready = "";
    layout();
    settle(activeReal);
    requestAnimationFrame(() => overlay.classList.add("show"));
    pill.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey);
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove("show");
    pill.setAttribute("aria-expanded", "false");
    const o = overlay; overlay = null; items = [];
    setTimeout(() => o.remove(), 260);
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey);
  }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") goTo(Math.round(active) - 1);
    else if (e.key === "ArrowRight") goTo(Math.round(active) + 1);
  }

  pill.addEventListener("click", e => {
    e.stopPropagation();
    overlay ? close() : open();
  });
})();
