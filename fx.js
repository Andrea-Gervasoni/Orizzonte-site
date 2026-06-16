/* ============================================================================
 *  FX  —  effetti d'ambiente: blob fluttuanti, parallasse, navbar scrolled.
 *  Tutto puramente decorativo e rispettoso di prefers-reduced-motion.
 * ========================================================================== */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // mobile / touch: niente effetti pesanti (blob sfocati, parallasse) per non scaldare il telefono
  const lowPower = window.matchMedia("(max-width: 880px)").matches
    || window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  /* --- 0. SPLASH / schermata di caricamento ----------------------------- */
  (function splash() {
    const sp = document.getElementById("splash");
    const reveal = () => { document.body.classList.remove("booting"); document.body.classList.add("revealed"); };
    if (!sp) { reveal(); return; }
    // sottotitolo nella lingua salvata
    try {
      const s = JSON.parse(localStorage.getItem("mc_pensione_v1"));
      const sub = document.getElementById("splashSub");
      if (sub && s && s.lang === "en") sub.textContent = "10,000 scenarios for your future";
    } catch (e) {}
    // blocca lo scroll mentre la splash e' visibile
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const durata = reduce ? 2000 : 4000;
    function chiudi() {
      sp.classList.add("done");
      reveal();                                   // l'hero si rivela mentre la splash sfuma
      document.documentElement.style.overflow = prevOverflow;
      setTimeout(() => sp.remove(), 800);
    }
    // chiude dopo la durata, ma solo quando il tab e' davvero visibile
    setTimeout(() => {
      if (document.visibilityState === "visible") chiudi();
      else document.addEventListener("visibilitychange", function once() {
        if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", once); chiudi(); }
      });
    }, durata);
  })();

  /* --- 1. Protezione anti-"contenuto invisibile" -------------------------
   * Se la pagina viene caricata mentre il tab e' nascosto, il browser ferma
   * la timeline delle animazioni: forziamo lo stato visibile finche' non
   * diventa attiva. */
  if (document.visibilityState !== "visible") document.body.classList.add("no-anim");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") document.body.classList.remove("no-anim");
  });

  /* --- 2. Blob morbidi che fluttuano dietro il vetro --------------------- */
  const fluids = document.getElementById("fluids");
  if (fluids && !reduce && !lowPower) {
    const oro   = "oklch(0.78 0.10 80 / 0.42)";
    const argilla = "oklch(0.70 0.10 50 / 0.40)";
    const blob = [
      { s: 540, x: "-6%",  y: "2%",   dx: "60px",  dy: "40px",  c: oro,     dur: 19, mdur: 23, delay: 0 },
      { s: 460, x: "72%",  y: "-8%",  dx: "-50px", dy: "60px",  c: argilla, dur: 22, mdur: 26, delay: 1.5 },
      { s: 600, x: "58%",  y: "46%",  dx: "40px",  dy: "-50px", c: oro,     dur: 25, mdur: 21, delay: 3 },
      { s: 420, x: "10%",  y: "60%",  dx: "-44px", dy: "-36px", c: argilla, dur: 20, mdur: 24, delay: 0.8 },
      { s: 500, x: "34%",  y: "20%",  dx: "30px",  dy: "54px",  c: oro,     dur: 27, mdur: 29, delay: 2.2 },
    ];
    blob.forEach(b => {
      const d = document.createElement("div");
      d.className = "fluid";
      d.style.cssText =
        `--s:${b.s}px;--x:${b.x};--y:${b.y};--dx:${b.dx};--dy:${b.dy};` +
        `--c:${b.c};--dur:${b.dur}s;--mdur:${b.mdur}s;--delay:${b.delay}s;`;
      fluids.appendChild(d);
    });
  }

  /* --- 3. Parallasse leggero col mouse (profondita') --------------------- */
  if (!reduce && !lowPower && fluids && window.matchMedia("(hover: hover)").matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const ambient = document.querySelector(".ambient");
    function loop() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      fluids.style.transform = `translate(${cx}px, ${cy}px)`;
      if (ambient) ambient.style.transform = `translate(${cx * -0.4}px, ${cy * -0.4}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
      else raf = null;
    }
    window.addEventListener("pointermove", e => {
      const nx = (e.clientX / window.innerWidth - 0.5);
      const ny = (e.clientY / window.innerHeight - 0.5);
      tx = nx * 26; ty = ny * 26;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  /* --- 4. Navbar: stato "scrolled" -------------------------------------- */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --- 4b. Rivelazione allo scroll -------------------------------------- *
   * Gli elementi con .reveal compaiono (fade + salita) quando entrano nel
   * viewport. Uso getBoundingClientRect su scroll/resize: affidabile in ogni
   * ambiente. window.__observeReveals() ri-scansiona dopo render dinamici. */
  (function () {
    if (reduce) {
      window.__observeReveals = function () {
        document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
      };
      window.__observeReveals();
      return;
    }
    let els = [];
    function check() {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      els = els.filter(el => {
        const r = el.getBoundingClientRect();
        const inView = r.top < vh * 0.92 && r.bottom > 0;
        if (inView) { el.classList.add("in"); return false; }
        return true;
      });
    }
    window.__observeReveals = function () {
      els = Array.prototype.slice.call(document.querySelectorAll(".reveal:not(.in)"));
      // mostra subito elementi già in viewport (o sopra il fold)
      requestAnimationFrame(function() { check(); });
    };
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { check(); ticking = false; });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // mostra subito tutto ciò che è già visibile al caricamento
    setTimeout(function() { window.__observeReveals(); }, 120);
  })();

  /* --- 5. Firma autore: finche' il sito non esiste, mostra un avviso ----- */
  document.querySelectorAll(".byline").forEach(a => {
    a.addEventListener("click", e => {
      if (a.getAttribute("href") === "#") {
        e.preventDefault();
        toast(document.documentElement.lang === "en"
          ? "Personal site coming soon"
          : "Sito personale in arrivo");
      }
    });
  });

  let toastT = null;
  function toast(msg) {
    let el = document.getElementById("fxToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "fxToast";
      el.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(14px);" +
        "z-index:1000;padding:12px 20px;border-radius:999px;font:600 14px var(--ff-body);" +
        "color:var(--ink);background:var(--glass);-webkit-backdrop-filter:blur(16px) saturate(140%);" +
        "backdrop-filter:blur(16px) saturate(140%);border:1px solid var(--glass-line);" +
        "box-shadow:var(--shadow-lg),0 0 0 1px var(--glass-ring);opacity:0;" +
        "transition:opacity .25s, transform .25s;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(14px)"; }, 2200);
  }
})();
