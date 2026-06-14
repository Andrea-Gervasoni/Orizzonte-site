/* ============================================================================
 *  RACCOLTA DATI ANONIMA  —  a fini di ricerca scolastica
 *  ----------------------------------------------------------------------------
 *  Invia SOLO tre numeri non identificativi (eta', versamento annuo, rischio)
 *  a un Foglio Google, e SOLO dopo consenso esplicito dell'utente.
 *
 *  >>> PER ATTIVARLA: incolla qui sotto l'URL della tua Web App di Apps Script.
 *      Finche' resta vuoto, la raccolta e' disattivata e non compare nulla.   */
const RESEARCH_ENDPOINT = "https://script.google.com/macros/s/AKfycby7rPhPkbhqZarhr6j75lgB3r4RKPe_-A7jeoscoXWVNw9jJc7ONuRAE_kE853npLkHtQ/exec";   // es: "https://script.google.com/macros/s/XXXX/exec"

(function () {
  const LS = "mc_research_consent";          // "yes" | "no"
  let askedThisLoad = false;

  function lang() { return document.documentElement.lang === "en" ? "en" : "it"; }
  function t(k) { return (window.I18N[lang()] || {})[k] || k; }

  function deciso() {
    try { return localStorage.getItem(LS); } catch (e) { return null; }
  }
  function salvaScelta(v) {
    try { localStorage.setItem(LS, v); } catch (e) {}
  }

  function invia(par) {
    const payload = {
      eta: par.etaAttuale,
      versamento: par.versamentoAnnuo,
      rischio: Math.round(par.volatilita * 100),   // % di volatilita' scelta
      ts: new Date().toISOString(),
    };
    // 'no-cors' evita problemi di CORS con Apps Script: invio "fire and forget".
    fetch(RESEARCH_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function mostraCard(par) {
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
      invia(par);
      card.querySelector("p").textContent = t("researchThanks");
      card.querySelector(".rc-actions").remove();
      setTimeout(chiudi, 1800);
    });
  }

  window.__research = {
    afterSim(par) {
      if (!RESEARCH_ENDPOINT) return;       // non configurato: silenzioso
      if (deciso()) return;                 // l'utente ha gia' scelto
      if (askedThisLoad) return;            // chiedi una sola volta per visita
      askedThisLoad = true;
      // mostra con garbo dopo i risultati, e mai sopra/dietro la splash
      const show = () => {
        if (document.getElementById("splash")) { setTimeout(show, 400); return; }
        mostraCard(par);
      };
      setTimeout(show, 1100);
    },
  };
})();
