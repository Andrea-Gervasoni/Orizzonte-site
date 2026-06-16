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
      versione: "v2",             // v1 (congelato) | v2 (realistico) — scelta dalla gemma
      versamentoAnnuo: 3000,
      contributoDatore: 0,         // contributo annuo datore (0 = nessuno) [v2]
      etaAttuale: 30,
      etaPensione: 67,
      profilo: "dinamico",        // rischio+rendimento accoppiati (vedi MODELLO.profili)
      volatilita: 0.15,           // DERIVATO dal profilo (sigma)
      rendimentoMedio: 0.07,      // DERIVATO dal profilo (mu)
      fasciaReddito: "media",     // per la deduzione fiscale [v2]
      costo: 0.01,                // costo di gestione ISC (default 1%) [v2]
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
    if (typeof renderMetodologia === "function") renderMetodologia();
    if (typeof aggiornaPill === "function") aggiornaPill();
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
    const v2 = stato.par.versione !== "v1";

    const group = key => {
      const d = document.createElement("div");
      d.className = "form-group-label";
      d.innerHTML = `<span class="fg-tick"></span>${t(key)}`;
      host.appendChild(d);
    };

    // --- VERSAMENTI ---
    group("grpVersamenti");
    host.appendChild(sliderField({
      id: "versamentoAnnuo", min: 500, max: 15000, step: 250,
      labelKey: "pVersamento", fmt: v => euro(v),
    }));
    if (v2) host.appendChild(sliderField({
      id: "contributoDatore", min: 0, max: 8000, step: 100,
      labelKey: "pDatore", fmt: v => v === 0 ? t("nessuno") : euro(v),
    }));

    // --- ORIZZONTE TEMPORALE ---
    group("grpTempo");
    host.appendChild(sliderField({
      id: "etaAttuale", min: 18, max: 60, step: 1,
      labelKey: "pEtaAttuale", fmt: v => v + " " + (stato.lang === "it" ? "anni" : "yrs"),
    }));
    host.appendChild(sliderField({
      id: "etaPensione", min: 60, max: 75, step: 1,
      labelKey: "pEtaPensione", fmt: v => v + " " + (stato.lang === "it" ? "anni" : "yrs"),
    }));

    // --- STRATEGIA ---
    group("grpStrategia");
    host.appendChild(profiloField());
    if (v2) {
      host.appendChild(redditoField());
      host.appendChild(sliderField({
        id: "costo", min: 0.001, max: 0.03, step: 0.001,
        labelKey: "pCosto", fmt: v => (v * 100).toFixed(1).replace(".", stato.lang === "it" ? "," : ".") + "%",
      }));
    }

    // --- PRECISIONE ---
    group("grpPrecisione");
    host.appendChild(segField({
      id: "numSims", labelKey: "pSimulazioni",
      opts: v2 ? [1000, 5000, 10000, 20000] : [1000, 5000, 10000, 20000],
      fmt: v => num(v),
    }));
  }

  // ---- fascia di reddito -> aliquota marginale per la deduzione ----
  function redditoField() {
    const FA = window.MonteCarlo.MODELLO.fasceReddito;
    const order = ["bassa", "media", "alta"];
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <div class="field-top"><label>${t("pReddito")}</label></div>
      <div class="seg" id="seg_reddito"></div>
      <div class="reddito-reveal" id="redditoReveal"></div>`;
    const seg = wrap.querySelector(".seg");
    const reveal = wrap.querySelector("#redditoReveal");
    function updateReveal() {
      const al = Math.round(FA[stato.par.fasciaReddito].aliquota * 100);
      reveal.innerHTML = `${t("aliquotaMarginale")} <b>${al}%</b>`;
    }
    order.forEach(key => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t("reddito_" + key);
      b.setAttribute("aria-pressed", stato.par.fasciaReddito === key);
      b.addEventListener("click", () => {
        stato.par.fasciaReddito = key;
        seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        updateReveal();
        salva();
      });
      seg.appendChild(b);
    });
    updateReveal();
    return wrap;
  }

  // ---- il profilo fissa la coppia (mu, sigma): coupling rischio-rendimento ----
  function applicaProfilo() {
    const P = window.MonteCarlo.MODELLO.profili;
    const p = P[stato.par.profilo] || P[window.MonteCarlo.MODELLO.profiloDefault];
    stato.par.rendimentoMedio = p.mu;
    stato.par.volatilita = p.sigma;
  }

  function profiloField() {
    const P = window.MonteCarlo.MODELLO.profili;
    const order = ["prudente", "bilanciato", "dinamico"];
    const muMax = P.dinamico.mu, sigMax = P.dinamico.sigma;
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <div class="field-top"><label>${t("pProfilo")}</label></div>
      <div class="risk-select" id="profiloGroup"></div>
      <div class="risk-readout">
        <div class="rr-stat is-return">
          <span class="rr-cap">${t("rrReturn")}</span>
          <span class="rr-val"><span class="js-mu">7</span><span class="rr-unit">%</span></span>
          <span class="rr-bar"><i class="js-mu-bar"></i></span>
        </div>
        <div class="rr-div"></div>
        <div class="rr-stat is-risk">
          <span class="rr-cap">${t("rrRisk")}</span>
          <span class="rr-val"><span class="js-sigma">15</span><span class="rr-unit">%</span></span>
          <span class="rr-bar gold"><i class="js-sigma-bar"></i></span>
        </div>
      </div>`;
    const group = wrap.querySelector("#profiloGroup");
    const muEl = wrap.querySelector(".js-mu"), sigEl = wrap.querySelector(".js-sigma");
    const muBar = wrap.querySelector(".js-mu-bar"), sigBar = wrap.querySelector(".js-sigma-bar");

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function updateReveal() {
      const p = P[stato.par.profilo];
      muEl.textContent = Math.round(p.mu * 100);
      sigEl.textContent = Math.round(p.sigma * 100);
      muBar.style.width = (p.mu / muMax * 100) + "%";
      sigBar.style.width = (p.sigma / sigMax * 100) + "%";
    }

    order.forEach((key, i) => {
      const nameKey = "prof" + cap(key);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "risk-opt";
      b.dataset.k = key;
      b.style.setProperty("--lvl", i);
      b.setAttribute("aria-pressed", stato.par.profilo === key);
      b.innerHTML =
        `<span class="ro-dotwrap"><span class="ro-dot"></span></span>` +
        `<span class="ro-name">${t(nameKey)}</span>` +
        `<span class="ro-sub">${t(nameKey + "Sub")}</span>`;
      b.addEventListener("click", () => {
        stato.par.profilo = key;
        applicaProfilo();
        group.querySelectorAll(".risk-opt").forEach(x => x.setAttribute("aria-pressed", x.dataset.k === key));
        updateReveal();
        salva();
      });
      group.appendChild(b);
    });
    updateReveal();
    return wrap;
  }

  // ---- (rimosse le icone "i": le etichette parlano da sole) ----

  function sliderField({ id, min, max, step, labelKey, fmt }) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const val = stato.par[id];
    wrap.innerHTML = `
      <div class="field-top">
        <label for="f_${id}">${t(labelKey)}</label>
        <span class="field-val" id="v_${id}">${fmt(val)}</span>
      </div>
      <input type="range" id="f_${id}" min="${min}" max="${max}" step="${step}" value="${val}">`;
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
  function simula(fromUser) {
    const btn = document.getElementById("btnSimula");
    const label = btn.querySelector(".btn-label");
    // guardia: gli anni rimasti devono essere > 0
    if (stato.par.etaPensione <= stato.par.etaAttuale) {
      mostraErrore();
      return;
    }
    btn.disabled = true;
    label.textContent = t("simulating");
    // lascia ridipingere il bottone prima del calcolo (che e' sincrono)
    setTimeout(() => {
      ultimaSim = window.MonteCarlo.eseguiSimulazione(stato.par);
      renderRisultati(ultimaSim);
      btn.disabled = false;
      label.textContent = t("simula");
      // chiedi i dati alla ricerca SOLO dopo una simulazione avviata dall'utente
      // (mai dalla simulazione automatica al caricamento, che usa i default)
      if (fromUser && window.__research) window.__research.afterSim(stato.par, stato.lang);
    }, 30);
  }

  // ============ RENDER RISULTATI ============
  function mostraErrore() {
    ultimaSim = null;
    const host = document.getElementById("results");
    host.innerHTML = `<div class="sim-error glass">${t("etaErrore")}</div>`;
  }

  function renderRisultati(d) {
    const host = document.getElementById("results");
    const r = d.rendita;

    // blocco dopo gli scenari: dipende dalla versione
    let extra;
    if (d.versione === "v2") {
      const ded = d.deduzione;
      const hasDatore = d.versato.datore > 0;
      // costo reale per euro versato dopo la deduzione (sui versamenti dell'utente)
      const costoUnitario = d.versato.utente > 0
        ? (d.versato.utente - ded.risparmio) / d.versato.utente : 1;
      const costoStr = costoUnitario.toLocaleString(stato.lang === "it" ? "it-IT" : "en-IE",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const rigaDatore = hasDatore ? `
          <div class="rp-row">
            <span class="rp-dot emp"></span>
            <span class="rp-label">${t("datoreAggiunge")}</span>
            <span class="rp-amount accent">+ ${euro(d.versato.datore)}</span>
          </div>
          <div class="rp-row total">
            <span class="rp-label">${t("totaleFondo")}</span>
            <span class="rp-amount">${euro(d.versato.totale)}</span>
          </div>` : "";

      extra = `
        <div class="riepilogo glass reveal">
          <span class="rp-eyebrow">${t("riepilogoTitle")}</span>
          <div class="rp-rows">
            <div class="rp-row">
              <span class="rp-dot you"></span>
              <span class="rp-label">${t("verseraiLabel")}</span>
              <span class="rp-amount">${euro(d.versato.utente)}</span>
            </div>
            ${rigaDatore}
          </div>
          <div class="rp-saving">
            <div class="rp-saving-fig">
              <span class="rp-saving-num">${euro(ded.risparmio)}</span>
              <span class="rp-saving-cap">${t("deduzioneTitle")} · ${Math.round(ded.aliquota * 100)}%</span>
            </div>
            <p class="rp-saving-txt">${t("costoRealeTxt", { costo: costoStr })}</p>
          </div>
        </div>
        <p class="rendita-nota reveal">${t("renditaNota")}</p>`;
    } else {
      // v1 (congelato): semplice riga "totale versato"
      extra = `
        <div class="versato-row glass reveal">
          <span>${t("versatoLabel")}</span>
          <b>${euro(d.stat.totaleVersato)}</b>
          <span class="sep"></span>
          <span>${t("versatoSub", { anni: d.anni, imp: euro(stato.par.versamentoAnnuo) })}</span>
        </div>`;
    }

    host.innerHTML = `
      <section>
        <div class="section-head reveal">
          <h2>${t("scenariTitle")}</h2>
          <p>${t(d.versione === "v2" ? "scenariSubV2" : "scenariSub", { n: num(d.numSims) })}</p>
        </div>
        <div class="scenari-grid">
          ${scenarioCard("is-bad", "sfortunato", "sfortunatoSub", d.stat.sfortunato, r.sfortunato, 0)}
          ${scenarioCard("is-mid", "tipico", "tipicoSub", d.stat.tipico, r.tipico, 1)}
          ${scenarioCard("is-good", "fortunato", "fortunatoSub", d.stat.fortunato, r.fortunato, 2)}
        </div>
        ${extra}
      </section>

      <section class="chart-card glass reveal">
        <div class="section-head">
          <h2>${t("fanTitle")}</h2>
          <p>${t(d.versione === "v2" ? "fanSubV2" : "fanSub")}</p>
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
          <p>${t(d.versione === "v2" ? "histSubV2" : "histSub")}</p>
        </div>
        <div class="chart-host"><svg id="histChart"></svg></div>
      </section>`;

    // disegna i grafici e mostra i reveal. Uso setTimeout (non rAF) perche'
    // scatta anche a tab nascosto; il layout del DOM e' gia' disponibile.
    setTimeout(() => {
      const f = document.getElementById("fanChart");
      const h = document.getElementById("histChart");
      if (f) window.Charts.disegnaFanChart(f, d, t);
      if (h) window.Charts.disegnaIstogramma(h, d, t);
      if (window.__observeReveals) window.__observeReveals();
    }, 40);
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

  // ============ METODOLOGIA (per-versione) ============
  function getArr(key) { return (window.I18N[stato.lang] || {})[key] || (window.I18N.it[key] || []); }

  function renderMetodologia() {
    const hostM = document.getElementById("method-host");
    if (!hostM) return;
    const v2 = stato.par.versione !== "v1";
    const src = "https://github.com/Andrea-Gervasoni/orizzonte";

    if (!v2) {
      // ---- v1 (CONGELATA): 4 celle concettuali + codice C++ ----
      hostM.innerHTML = `
        <div class="section-head reveal"><h2>${t("methodTitle")}</h2><p>${t("methodLead")}</p></div>
        <div class="method-grid">
          <div class="method-cell glass reveal"><div class="num">01</div><h3>${t("m1Title")}</h3><p>${t("m1Body")}</p>
            <div class="code-block"><code><span class="c-com">// rendimento casuale ~ N(media, volatilita)</span>
<span class="c-key">double</span> r = campana(gen);
tot = tot * (<span class="c-key">1.0</span> + r) + versamentoXanno;</code></div>
            <a class="source-link" href="${src}" target="_blank" rel="noopener">${t("sourceCode")}</a></div>
          <div class="method-cell glass reveal" style="transition-delay:80ms"><div class="num">02</div><h3>${t("m2Title")}</h3><p>${t("m2Body")}</p>
            <div class="code-block"><code><span class="c-key">for</span> (<span class="c-key">int</span> i = 0; i &lt; maxSim; i++)
    finale[i] = montecarlo(pers);
sort(finale, finale + maxSim);</code></div></div>
          <div class="method-cell glass reveal" style="transition-delay:40ms"><div class="num">03</div><h3>${t("m3Title")}</h3><p>${t("m3Body")}</p></div>
          <div class="method-cell glass reveal" style="transition-delay:120ms"><div class="num">04</div><h3>${t("m4Title")}</h3><p>${t("m4Body")}</p></div>
        </div>
        <p class="disclaimer reveal">${t("disclaimer")}</p>`;
    } else {
      // ---- v2: risultato in primo piano, dettaglio in sezione collassabile ----
      const concetti = getArr("conceptV2").map((c, i) =>
        `<div class="concept"><span class="c-num">0${i + 1}</span><div><h4>${c.t}</h4><p>${c.b}</p></div></div>`).join("");
      const note = getArr("noteV2").map(n => `<li>${n}</li>`).join("");
      hostM.innerHTML = `
        <div class="section-head reveal"><h2>${t("methodTitleV2")}</h2><p>${t("methodLeadV2")}</p></div>
        <details class="assunzioni glass reveal">
          <summary><span class="as-txt">${t("assunzioniSummary")}</span><span class="as-chev">›</span></summary>
          <div class="as-body">
            <div class="concept-grid">${concetti}</div>
            <div class="code-block"><code><span class="c-com">// rendimento log-normale: mai sotto -100%, volatility drag</span>
<span class="c-key">double</span> draw = normale(mu, sigma);
<span class="c-key">double</span> r = exp(draw - <span class="c-key">0.5</span>*sigma*sigma) - <span class="c-key">1</span>;
<span class="c-key">double</span> g = capitale * (r - costo);        <span class="c-com">// i costi erodono</span>
<span class="c-key">if</span> (g &gt; <span class="c-key">0</span>) g *= (<span class="c-key">1</span> - <span class="c-key">0.20</span>);            <span class="c-com">// tassa 20% annua</span>
capitale += g + (versamento + datore)*pow(<span class="c-key">1.02</span>, i);</code></div>
            <h4 class="note-title">${t("assunzioniListTitle")}</h4>
            <ol class="note-list">${note}</ol>
            <a class="source-link" href="${src}" target="_blank" rel="noopener">${t("sourceCode")}</a>
          </div>
        </details>
        <p class="disclaimer reveal">${t("disclaimerV2")}</p>`;
    }
    if (window.__observeReveals) window.__observeReveals(hostM);
  }

  // ---- aggiorna la pill della gemma (id + meta) ----
  function aggiornaPill() {
    const idEl = document.querySelector("#versionPill .version-id");
    if (idEl) idEl.textContent = stato.par.versione;
    const metaEl = document.querySelector("#versionPill .version-meta");
    if (metaEl) metaEl.textContent = t(stato.par.versione === "v2" ? "pillMetaV2" : "pillMetaV1");
  }

  // ---- cambia versione del modello (chiamata dalla gemma) ----
  function setVersione(id) {
    if (id !== "v1" && id !== "v2") return false;   // v3 "in arrivo": non selezionabile
    if (stato.par.versione === id) return true;
    stato.par.versione = id;
    applicaProfilo();
    salva();
    buildForm();
    renderMetodologia();
    aggiornaPill();
    simula(false);
    return true;
  }

  // ============ INIT ============
  function init() {
    carica();
    applicaTema();
    // garantisce un profilo valido e SINCRONIZZA mu/sigma dal profilo
    // (impedisce coppie rischio-rendimento incoerenti salvate in precedenza)
    if (!window.MonteCarlo.MODELLO.profili[stato.par.profilo]) {
      stato.par.profilo = window.MonteCarlo.MODELLO.profiloDefault;
    }
    applicaProfilo();

    // espone il cambio versione alla gemma in fondo
    window.__setVersione = setVersione;
    window.__getVersione = function () { return stato.par.versione; };

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
    document.getElementById("btnSimula").addEventListener("click", () => simula(true));

    // espone i parametri VIVI: la ricerca legge sempre i valori correnti all'invio
    window.__liveParams = function () { return stato.par; };

    buildForm();
    renderMetodologia();
    aggiornaPill();
    applicaLingua();
    simula(false);

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
