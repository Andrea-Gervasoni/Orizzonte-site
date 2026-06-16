/* ============================================================================
 *  RACCOLTA DATI ANONIMA  —  a fini di ricerca scolastica
 *  ----------------------------------------------------------------------------
 *  Due fogli distinti, uno per versione del modello:
 *    - v1 (prototipo, congelato)  -> ENDPOINT_V1   (formato storico intatto)
 *    - v2 (realistico)            -> ENDPOINT_V2   (10 colonne)
 *
 *  Opzione A: dopo il consenso si invia OGNI simulazione, ciascuna con un
 *  numero progressivo (tentativo) e un ID di sessione anonimo, cosi' si puo'
 *  vedere quanto ogni persona esplora. Nessun dato identificativo.
 * ========================================================================== */
const ENDPOINT_V1 = "https://script.google.com/macros/s/AKfycby7rPhPkbhqZarhr6j75lgB3r4RKPe_-A7jeoscoXWVNw9jJc7ONuRAE_kE853npLkHtQ/exec";
const ENDPOINT_V2 = "https://script.google.com/macros/s/AKfycbwB9iGmvd0kFcAUeD4w2VpHoRtIEFBu539vQRWJQqENUM3bqsaqfNIVO1yrnSe5d8An/exec";

(function () {
  const LS = "mc_research_consent";          // "yes" | "no"
  const LS_SESS = "mc_research_session";     // ID anonimo dispositivo
  const LS_COUNT = "mc_research_count";      // contatore simulazioni inviate
  let askedThisLoad = false;

  function lang() { return document.documentElement.lang === "en" ? "en" : "it"; }
  function t(k) { return (window.I18N[lang()] || {})[k] || k; }

  function deciso() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function salvaScelta(v) { try { localStorage.setItem(LS, v); } catch (e) {} }

  // ID di sessione anonimo, generato una volta sola per dispositivo
  function sessione() {
    try {
      let s = localStorage.getItem(LS_SESS);
      if (!s) { s = Math.random().toString(36).slice(2, 8); localStorage.setItem(LS_SESS, s); }
      return s;
    } catch (e) { return ""; }
  }
  // contatore progressivo: 1 alla prima simulazione inviata, poi 2, 3...
  function prossimoTentativo() {
    try {
      const n = (parseInt(localStorage.getItem(LS_COUNT) || "0", 10) || 0) + 1;
      localStorage.setItem(LS_COUNT, String(n));
      return n;
    } catch (e) { return ""; }
  }

  function endpointFor(versione) {
    return versione === "v1" ? ENDPOINT_V1 : ENDPOINT_V2;
  }

  function invia() {
    const live = (typeof window.__liveParams === "function") ? window.__liveParams() : {};
    const versione = live.versione || "v2";
    const url = endpointFor(versione);
    if (!url) return;

    let payload;
    if (versione === "v1") {
      // formato storico del primo foglio: NON modificare (v1 resta intatto)
      payload = {
        versione: "v1",
        sessione: sessione(),
        tentativo: prossimoTentativo(),
        eta: live.etaAttuale,
        versamento: live.versamentoAnnuo,
        rischio: Math.round((live.volatilita || 0) * 100),
        ts: new Date().toISOString(),
      };
    } else {
      // foglio v2: 10 colonne (timestamp lo aggiunge Apps Script)
      payload = {
        sessione: sessione(),
        tentativo: prossimoTentativo(),
        eta_attuale: live.etaAttuale,
        eta_pensione: live.etaPensione,
        versamento_utente: live.versamentoAnnuo,
        contributo_datore: live.contributoDatore || 0,
        profilo_rischio: live.profilo || "",
        fascia_reddito: live.fasciaReddito || "",          // banda, non il reddito esatto
        costo_gestione: Math.round((live.costo || 0) * 1000) / 10, // ISC in %
      };
    }
    // 'no-cors' evita problemi di CORS con Apps Script: invio "fire and forget".
    fetch(url, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function mostraCard() {
    if (document.getElementById("researchCard")) return;
    const card = document.createElement("div");
    card.className = "research-card glass";
    card.id = "researchCard";
    card.innerHTML = `
      <div class="rc-head">
        <span class="gem rc-gem"><span class="gem-shine"></span></span>
        <h4>${t("researchTitle")}</h4>
      </div>
      <p>${t("researchBody")}</p>
      <div class="rc-actions">
        <button class="rc-btn rc-no">${t("researchDecline")}</button>
        <button class="rc-btn rc-yes">${t("researchAccept")}</button>
      </div>`;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add("in"));

    const chiudi = () => {
      card.classList.remove("in");
      setTimeout(() => card.remove(), 400);
    };
    card.querySelector(".rc-no").addEventListener("click", () => { salvaScelta("no"); chiudi(); });
    card.querySelector(".rc-yes").addEventListener("click", () => {
      salvaScelta("yes");
      invia();
      card.querySelector("p").textContent = t("researchThanks");
      card.querySelector(".rc-actions").remove();
      setTimeout(chiudi, 1800);
    });
  }

  window.__research = {
    afterSim() {
      const test = location.search.indexOf("test") !== -1;   // ?test = prova ripetibile
      const scelta = test ? null : deciso();
      if (scelta === "no") return;                  // ha rifiutato: niente
      if (scelta === "yes") { invia(); return; }    // ha accettato: invia OGNI simulazione
      // non ancora deciso (o test): chiedi una volta per visita
      if (askedThisLoad && !test) return;
      askedThisLoad = true;
      const show = () => {
        if (document.getElementById("splash")) { setTimeout(show, 400); return; }
        mostraCard();
      };
      setTimeout(show, 1100);
    },
  };
})();
