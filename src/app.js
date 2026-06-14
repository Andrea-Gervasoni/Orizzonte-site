/* ============================================================================
 *  APP  —  stato, form, rendering, persistenza
 * ========================================================================== */
(function () {
  const LS_KEY = "mc_pensione_v1";

  // ---- stato di default ----
  const stato = {
    lang: "it",
    tema: "carta",
    par: {
      versamentoAnnuo: 3000,
      etaAttuale: 30,
      etaPensione: 67,
      volatilita: 0.15,
      rendimentoMedio: 0.07,
      numSims: 10000,
    },
  };

  // ---- persistenza ----
  function carica() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s) {
        if (s.lang) stato.lang = s.lang;
        if (s.tema) stato.tema = s.tema;
        if (s.par) Object.assign(stato.par, s.par);
      }
    } catch (e) {}
  }
  function salva() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(stato)); } catch (e) {}
  }

  // ---- traduzione ----
  function t(key, repl) {
    let s = (window.I18N[stato.lang] && window.I18N[stato.lang][key]) || key;
    if (repl) for (const k in repl) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), repl[k]);
    return s;
  }

  // ---- formattazione valuta ----
  function euro(v, decim) {
    return new Intl.NumberFormat(stato.lang === "it" ? "it-IT" : "en-IE", {
      style: "currency", currency: "EUR", useGrouping: "always",
      minimumFractionDigits: decim || 0, maximumFractionDigits: decim || 0,
    }).format(v);
  }
  function num(v) {
    return new Intl.NumberFormat(stato.lang === "it" ? "it-IT" : "en-IE", { useGrouping: "always" }).format(v);
  }

  let ultimaSim = null;

  // ============ APPLICA TEMA / LINGUA ============
  function applicaTema() {
    document.documentElement.setAttribute("data-theme", stato.tema);
    document.querySelectorAll(".swatch").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.tema === stato.tema));
  }
  function applicaLingua() {
    document.documentElement.lang = stato.lang;
    document.title = t("docTitle");
    document.querySelectorAll(".lang-toggle button").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.lang === stato.lang));
    renderTesti();
    if (ultimaSim) renderRisultati(ultimaSim);
  }

  // ============ TESTI STATICI ============
  function renderTesti() {
    document.querySelectorAll("[data-i18n]").forEach(elm => {
      elm.textContent = t(elm.dataset.i18n);
    });
  }

  // ============ COSTRUISCI FORM ============
  function buildForm() {
    const host = document.getElementById("formFields");
    host.innerHTML = "";

    // versamento annuo (range)
    host.appendChild(sliderField({
      id: "versamentoAnnuo", min: 500, max: 15000, step: 250,
      labelKey: "pVersamento", helpKey: "pVersamentoHelp",
      fmt: v => euro(v),
    }));
    // eta attuale
    host.appendChild(sliderField({
      id: "etaAttuale", min: 18, max: 60, step: 1,
      labelKey: "pEtaAttuale", fmt: v => v + " " + (stato.lang === "it" ? "anni" : "yrs"),
    }));
    // eta pensione
    host.appendChild(sliderField({
      id: "etaPensione", min: 60, max: 75, step: 1,
      labelKey: "pEtaPensione", fmt: v => v + " " + (stato.lang === "it" ? "anni" : "yrs"),
    }));
    // volatilita
    host.appendChild(sliderField({
      id: "volatilita", min: 0.05, max: 0.30, step: 0.01,
      labelKey: "pVolatilita", helpKey: "pVolatilitaHelp",
      fmt: v => Math.round(v * 100) + "%",
    }));
    // rendimento medio
    host.appendChild(sliderField({
      id: "rendimentoMedio", min: 0.02, max: 0.12, step: 0.005,
      labelKey: "pRendimento", fmt: v => (v * 100).toFixed(1).replace(".0", "") + "%",
    }));
    // numero simulazioni (segmented)
    host.appendChild(segField({
      id: "numSims", labelKey: "pSimulazioni",
      opts: [1000, 5000, 10000, 20000], fmt: v => num(v),
    }));
  }

  function sliderField({ id, min, max, step, labelKey, helpKey, fmt }) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const val = stato.par[id];
    wrap.innerHTML = `
      <div class="field-top">
        <label for="f_${id}">${t(labelKey)}</label>
        <span class="field-val" id="v_${id}">${fmt(val)}</span>
      </div>
      <input type="range" id="f_${id}" min="${min}" max="${max}" step="${step}" value="${val}">
      ${helpKey ? `<div class="help">${t(helpKey)}</div>` : ""}`;
    const input = wrap.querySelector("input");
    const setFill = () => {
      const pct = ((stato.par[id] - min) / (max - min)) * 100;
      input.style.setProperty("--fill", pct + "%");
    };
    setFill();
    input.addEventListener("input", () => {
      stato.par[id] = parseFloat(input.value);
      wrap.querySelector("#v_" + id).textContent = fmt(stato.par[id]);
      setFill();
      salva();
    });
    return wrap;
  }

  function segField({ id, labelKey, opts, fmt }) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <div class="field-top"><label>${t(labelKey)}</label></div>
      <div class="seg" id="seg_${id}"></div>`;
    const seg = wrap.querySelector(".seg");
    opts.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = fmt(o);
      b.setAttribute("aria-pressed", stato.par[id] === o);
      b.addEventListener("click", () => {
        stato.par[id] = o;
        seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        salva();
      });
      seg.appendChild(b);
    });
    return wrap;
  }

  // ============ SIMULA ============
  function simula() {
    const btn = document.getElementById("btnSimula");
    const label = btn.querySelector(".btn-label");
    btn.disabled = true;
    label.textContent = t("simulating");
    // lascia ridipingere il bottone prima del calcolo (che e' sincrono)
    setTimeout(() => {
      ultimaSim = window.MonteCarlo.eseguiSimulazione(stato.par);
      renderRisultati(ultimaSim);
      btn.disabled = false;
      label.textContent = t("simula");
      // eventuale richiesta (anonima, con consenso) di contribuire i dati alla ricerca
      if (window.__research) window.__research.afterSim(stato.par, stato.lang);
    }, 30);
  }

  // ============ RENDER RISULTATI ============
  function renderRisultati(d) {
    const host = document.getElementById("results");

    const r = d.rendita;
    const coeffPct = (r.coeff * 100).toFixed(2).replace(".", stato.lang === "it" ? "," : ".") + "%";

    host.innerHTML = `
      <section>
        <div class="section-head reveal">
          <h2>${t("scenariTitle")}</h2>
          <p>${t("scenariSub", { n: num(d.numSims) })}</p>
        </div>
        <div class="scenari-grid">
          ${scenarioCard("is-bad", "sfortunato", "sfortunatoSub", d.stat.sfortunato, r.sfortunato, 0)}
          ${scenarioCard("is-mid", "tipico", "tipicoSub", d.stat.tipico, r.tipico, 1)}
          ${scenarioCard("is-good", "fortunato", "fortunatoSub", d.stat.fortunato, r.fortunato, 2)}
        </div>
        <div class="versato-row glass reveal">
          <span>${t("versatoLabel")}</span>
          <b>${euro(d.stat.totaleVersato)}</b>
          <span class="sep"></span>
          <span>${t("versatoSub", { anni: d.anni, imp: euro(stato.par.versamentoAnnuo) })}</span>
        </div>
      </section>

      <section class="chart-card glass reveal">
        <div class="section-head">
          <h2>${t("fanTitle")}</h2>
          <p>${t("fanSub")}</p>
        </div>
        <div class="chart-host"><svg id="fanChart"></svg></div>
        <div class="legend">
          <span class="item"><span class="key line" style="border-top-color:var(--gold)"></span>${t("legMediana")}</span>
          <span class="item"><span class="key" style="background:color-mix(in srgb,var(--accent) 24%,transparent)"></span>${t("leg2575")}</span>
          <span class="item"><span class="key" style="background:color-mix(in srgb,var(--accent) 13%,transparent)"></span>${t("leg1090")}</span>
          <span class="item"><span class="key line" style="border-top-color:var(--muted);border-top-style:dashed"></span>${t("legVersato")}</span>
        </div>
      </section>

      <section class="chart-card glass reveal">
        <div class="section-head">
          <h2>${t("histTitle")}</h2>
          <p>${t("histSub")}</p>
        </div>
        <div class="chart-host"><svg id="histChart"></svg></div>
      </section>`;

    // disegna grafici (dopo che il DOM ha dimensioni)
    requestAnimationFrame(() => {
      window.Charts.disegnaFanChart(document.getElementById("fanChart"), d, t);
      window.Charts.disegnaIstogramma(document.getElementById("histChart"), d, t);
    });

    // attiva la rivelazione allo scroll sui nuovi elementi
    if (window.__observeReveals) window.__observeReveals(host);

    // metodologia (coeff/eta dinamici)
    const m3 = document.getElementById("m3body");
    if (m3) m3.textContent = t("m3Body", { coeff: coeffPct, eta: d.etaPensione });
    const m2 = document.getElementById("m2body");
    if (m2) m2.textContent = t("m2Body", { n: num(d.numSims) });
  }

  function scenarioCard(cls, labKey, subKey, capitale, rendita, idx) {
    return `
      <div class="scenario glass reveal ${cls}" style="transition-delay:${(idx || 0) * 90}ms">
        <div class="s-label">${t(labKey)}</div>
        <div class="s-sub">${t(subKey)}</div>
        <div class="s-value">${euro(capitale)}</div>
        <div class="s-rendita">
          <span>${t("renditaLabel")}</span>
          <b>${euro(rendita)}${t("perMese")}</b>
        </div>
      </div>`;
  }

  // ============ INIT ============
  function init() {
    carica();
    applicaTema();

    // lingua
    document.querySelectorAll(".lang-toggle button").forEach(b => {
      b.addEventListener("click", () => { stato.lang = b.dataset.lang; salva(); buildForm(); applicaLingua(); });
    });
    // tema
    document.querySelectorAll(".swatch").forEach(b => {
      b.addEventListener("click", () => {
        stato.tema = b.dataset.tema; salva(); applicaTema();
        if (ultimaSim) requestAnimationFrame(() => {
          window.Charts.disegnaFanChart(document.getElementById("fanChart"), ultimaSim, t);
          window.Charts.disegnaIstogramma(document.getElementById("histChart"), ultimaSim, t);
        });
      });
    });
    // simula
    document.getElementById("btnSimula").addEventListener("click", simula);

    buildForm();
    applicaLingua();
    simula();

    // ridisegna grafici al resize
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!ultimaSim) return;
        const f = document.getElementById("fanChart");
        const h = document.getElementById("histChart");
        if (f) window.Charts.disegnaFanChart(f, ultimaSim, t);
        if (h) window.Charts.disegnaIstogramma(h, ultimaSim, t);
      }, 160);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
