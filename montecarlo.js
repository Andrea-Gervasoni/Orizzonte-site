/* ============================================================================
 *  MOTORE MONTE CARLO  —  Orizzonte
 *  ----------------------------------------------------------------------------
 *  DUE versioni del modello, selezionabili dalla gemma in fondo alla pagina:
 *
 *   v1  "Prototipo"  (CONGELATO — non modificare): rendimenti normali,
 *        capitalizzazione semplice, rendita da coefficiente. E' la prima versione
 *        storica e resta tale: eseguiSimulazioneV1().
 *
 *   v2  "Realistico" (modello avanzato): rendimenti LOG-NORMALI con volatility
 *        drag, costi (ISC), tassa 20% annua sui guadagni, contributi crescenti,
 *        contributo del datore, tassa finale 15->9%, deflazione (euro di oggi),
 *        deduzione fiscale e rendita con formula finanziaria: eseguiSimulazioneV2().
 *
 *  Per aggiungere una v3 in futuro: scrivi eseguiSimulazioneV3() e aggiungi il
 *  caso nel dispatcher in fondo. Le versioni precedenti restano intatte.
 * ========================================================================== */

const MODELLO = {
  simulazioniDefault: 10000,

  // --- PROFILI DI RISCHIO (rischio e rendimento ACCOPPIATI) — condivisi ---
  profili: {
    prudente:   { mu: 0.03, sigma: 0.05 },  // obbligazionario
    bilanciato: { mu: 0.05, sigma: 0.10 },  // misto
    dinamico:   { mu: 0.07, sigma: 0.15 },  // azionario
  },
  profiloDefault: "dinamico",

  // --- v1: coefficienti di trasformazione capitale -> rendita (CONGELATI) ---
  coefficienti: [
    [57, 0.0419], [60, 0.0455], [63, 0.0501],
    [65, 0.0535], [67, 0.0568], [70, 0.0625],
  ],

  // --- v2: fasce di reddito imponibile -> aliquota marginale (deduzione) ---
  fasceReddito: {
    bassa: { max: 28000, aliquota: 0.23 },   // fino a 28.000
    media: { max: 50000, aliquota: 0.33 },   // 28.000 - 50.000
    alta:  { max: Infinity, aliquota: 0.43 },// oltre 50.000
  },
  fasciaDefault: "media",

  // --- v2: costanti / assunzioni ---
  inflazione:        0.02,   // 2%/anno
  crescitaContributi:0.02,   // 2%/anno -> contributo reale costante
  tassaRendimenti:   0.20,   // 20% annuo sui guadagni positivi (semplificato)
  tettoDeduzione:    5300,   // EUR/anno deducibili (regola 2026)
  rendimentoRealePensione: 0.02, // 2%/anno reale per la rendita
  aspettativaVita:   85,     // anni
  costoDefault:      0.01,   // ISC default 1%
};

/* --- Numero casuale gaussiano (Box-Muller). Generatore condiviso (Math.random). */
function gaussiana(media, sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return media + sigma * z;
}

function percentile(ordinato, p) {
  const i = Math.min(ordinato.length - 1, Math.max(0, Math.floor(p * ordinato.length)));
  return ordinato[i];
}

/* ===========================================================================
 *  ============================  VERSIONE 1  ===============================
 *  CONGELATA. Rendimenti normali, tot = tot*(1+r) + versamento.
 * ========================================================================= */
function coeffTrasformazione(eta) {
  const tab = MODELLO.coefficienti;
  if (eta <= tab[0][0]) return tab[0][1];
  if (eta >= tab[tab.length - 1][0]) return tab[tab.length - 1][1];
  for (let i = 0; i < tab.length - 1; i++) {
    const [a0, c0] = tab[i], [a1, c1] = tab[i + 1];
    if (eta >= a0 && eta <= a1) {
      const t = (eta - a0) / (a1 - a0);
      return c0 + t * (c1 - c0);
    }
  }
  return tab[tab.length - 1][1];
}

function eseguiSimulazioneV1(par) {
  const P = MODELLO.profili[par.profilo] || MODELLO.profili[MODELLO.profiloDefault];
  const versamentoAnnuo = par.versamentoAnnuo;
  const rendimentoMedio = P.mu, volatilita = P.sigma;
  const numSims = par.numSims || MODELLO.simulazioniDefault;
  const anni = Math.max(0, Math.round(par.etaPensione - par.etaAttuale));

  const valoriPerAnno = [];
  for (let y = 0; y <= anni; y++) valoriPerAnno.push(new Float64Array(numSims));
  const nCampioni = Math.min(28, numSims);
  const percorsiCampione = [];

  for (let s = 0; s < numSims; s++) {
    let tot = 0;
    valoriPerAnno[0][s] = 0;
    const tieni = s < nCampioni;
    const perc = tieni ? [0] : null;
    for (let y = 0; y < anni; y++) {
      const r = gaussiana(rendimentoMedio, volatilita);
      tot = tot * (1 + r) + versamentoAnnuo;     // capitalizzazione semplice
      valoriPerAnno[y + 1][s] = tot;
      if (tieni) perc.push(tot);
    }
    if (tieni) percorsiCampione.push(perc);
  }

  const bande = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let y = 0; y <= anni; y++) {
    const colonna = Float64Array.from(valoriPerAnno[y]).sort();
    bande.p10.push(percentile(colonna, 0.10));
    bande.p25.push(percentile(colonna, 0.25));
    bande.p50.push(percentile(colonna, 0.50));
    bande.p75.push(percentile(colonna, 0.75));
    bande.p90.push(percentile(colonna, 0.90));
  }

  const finaliOrdinati = Float64Array.from(valoriPerAnno[anni]).sort();
  const sfortunato = percentile(finaliOrdinati, 0.10);
  const tipico     = percentile(finaliOrdinati, 0.50);
  const fortunato  = percentile(finaliOrdinati, 0.90);
  let somma = 0;
  for (let i = 0; i < finaliOrdinati.length; i++) somma += finaliOrdinati[i];
  const media = somma / finaliOrdinati.length;

  const coeff = coeffTrasformazione(par.etaPensione);
  const rendita = {
    sfortunato: (sfortunato * coeff) / 12,
    tipico:     (tipico * coeff) / 12,
    fortunato:  (fortunato * coeff) / 12,
    coeff,
  };

  const lo = percentile(finaliOrdinati, 0.01);
  const hi = percentile(finaliOrdinati, 0.99);
  const nBin = 12;
  const passo = (hi - lo) / nBin || 1;
  const bins = [];
  for (let b = 0; b < nBin; b++) bins.push({ lo: lo + b * passo, hi: lo + (b + 1) * passo, count: 0 });
  for (let i = 0; i < finaliOrdinati.length; i++) {
    let idx = Math.floor((finaliOrdinati[i] - lo) / passo);
    if (idx < 0) idx = 0; if (idx >= nBin) idx = nBin - 1;
    bins[idx].count++;
  }
  let maxCount = 0;
  bins.forEach(b => { b.pct = b.count / numSims; if (b.count > maxCount) maxCount = b.count; });

  return {
    versione: "v1",
    anni, etaAttuale: par.etaAttuale, etaPensione: par.etaPensione, numSims,
    rendimentoMedio, volatilita,
    bande, percorsiCampione, finaliOrdinati,
    stat: { sfortunato, tipico, fortunato, media, totaleVersato: versamentoAnnuo * anni },
    rendita,
    istogramma: { bins, maxCount, lo, hi },
  };
}

/* ===========================================================================
 *  ============================  VERSIONE 2  ===============================
 *  Modello realistico: log-normale, costi, tasse, crescita, datore,
 *  tassa finale, deflazione, deduzione, rendita finanziaria.
 * ========================================================================= */

/* aliquota tassa finale: 15% meno 0,30% per ogni anno oltre il 15°, min 9% */
function aliquotaFinale(anni) {
  return Math.max(0.09, 0.15 - 0.003 * Math.max(0, anni - 15));
}

function simulaUnaVitaV2(c) {
  let capitale = 0;
  const traj = new Float64Array(c.anni + 1);
  traj[0] = 0;
  const drag = 0.5 * c.sigma * c.sigma;
  for (let i = 0; i < c.anni; i++) {
    const draw = gaussiana(c.mu, c.sigma);
    const r = Math.exp(draw - drag) - 1;             // rendimento log-normale
    let guadagno = capitale * (r - c.costo);         // (1) i costi erodono il rendimento
    if (guadagno > 0) guadagno *= (1 - MODELLO.tassaRendimenti); // (2) tassa 20% sui guadagni
    const contributo = (c.vers + c.datore) * Math.pow(1 + MODELLO.crescitaContributi, i);
    capitale = capitale + guadagno + contributo;
    traj[i + 1] = capitale;
  }
  return traj;
}

function eseguiSimulazioneV2(par) {
  const P = MODELLO.profili[par.profilo] || MODELLO.profili[MODELLO.profiloDefault];
  const F = MODELLO.fasceReddito[par.fasciaReddito] || MODELLO.fasceReddito[MODELLO.fasciaDefault];

  const vers   = par.versamentoAnnuo;
  const datore = par.contributoDatore || 0;
  const mu = P.mu, sigma = P.sigma;
  const costo = (par.costo != null) ? par.costo : MODELLO.costoDefault;
  const numSims = par.numSims || MODELLO.simulazioniDefault;
  const anni = Math.max(0, Math.round(par.etaPensione - par.etaAttuale));

  // quantita' DETERMINISTICHE (uguali in ogni simulazione)
  const g = 1 + MODELLO.crescitaContributi;
  let baseDedotta = 0;   // NOMINALE: base per la tassa finale sul capitale nominale
  for (let i = 0; i < anni; i++) {
    const contribAnno = (vers + datore) * Math.pow(g, i);
    baseDedotta += Math.min(contribAnno, MODELLO.tettoDeduzione);
  }
  // --- VALORI PER IL DISPLAY, in euro di oggi ---
  // I contributi crescono del 2% nominale = inflazione, quindi restano COSTANTI
  // in valore reale: il totale in euro di oggi e' semplicemente importo x anni.
  const totUtente = vers * anni;
  const totDatore = datore * anni;
  // Deduzione in euro di oggi: tetto adeguato all'inflazione (risparmio reale costante).
  const risparmioDeduzione = Math.min(vers, MODELLO.tettoDeduzione) * F.aliquota * anni;
  const aliqFin = aliquotaFinale(anni);
  const tassaFinaleImporto = baseDedotta * aliqFin;
  const defl = Math.pow(1 + MODELLO.inflazione, anni);

  const cfg = { vers, datore, mu, sigma, costo, anni };
  const valoriPerAnno = [];
  for (let y = 0; y <= anni; y++) valoriPerAnno.push(new Float64Array(numSims));
  const nCampioni = Math.min(28, numSims);
  const percorsiCampione = [];

  for (let s = 0; s < numSims; s++) {
    const traj = simulaUnaVitaV2(cfg);
    const tieni = s < nCampioni;
    const perc = tieni ? new Array(anni + 1) : null;
    for (let y = 0; y <= anni; y++) {
      let reale;
      if (y === anni) reale = (traj[y] - tassaFinaleImporto) / defl;  // euro di oggi, netto
      else            reale = traj[y] / Math.pow(1 + MODELLO.inflazione, y);
      valoriPerAnno[y][s] = reale;
      if (tieni) perc[y] = reale;
    }
    if (tieni) percorsiCampione.push(perc);
  }

  const bande = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let y = 0; y <= anni; y++) {
    const colonna = Float64Array.from(valoriPerAnno[y]).sort();
    bande.p10.push(percentile(colonna, 0.10));
    bande.p25.push(percentile(colonna, 0.25));
    bande.p50.push(percentile(colonna, 0.50));
    bande.p75.push(percentile(colonna, 0.75));
    bande.p90.push(percentile(colonna, 0.90));
  }

  const finaliOrdinati = Float64Array.from(valoriPerAnno[anni]).sort();
  const sfortunato = percentile(finaliOrdinati, 0.10);
  const tipico     = percentile(finaliOrdinati, 0.50);
  const fortunato  = percentile(finaliOrdinati, 0.90);
  let somma = 0;
  for (let i = 0; i < finaliOrdinati.length; i++) somma += finaliOrdinati[i];
  const media = somma / finaliOrdinati.length;

  // rendita mensile: rata = pot*rm/(1-(1+rm)^-n), rm=(1+2%)^(1/12)-1, n=mesi fino a 85
  const rm = Math.pow(1 + MODELLO.rendimentoRealePensione, 1 / 12) - 1;
  const nMesi = Math.max(1, Math.round((MODELLO.aspettativaVita - par.etaPensione) * 12));
  const rendi = pot => (pot <= 0) ? 0 : pot * rm / (1 - Math.pow(1 + rm, -nMesi));
  const rendita = {
    sfortunato: rendi(sfortunato), tipico: rendi(tipico), fortunato: rendi(fortunato),
    mesi: nMesi, rm,
  };

  const lo = percentile(finaliOrdinati, 0.01);
  const hi = percentile(finaliOrdinati, 0.99);
  const nBin = 12;
  const passo = (hi - lo) / nBin || 1;
  const bins = [];
  for (let b = 0; b < nBin; b++) bins.push({ lo: lo + b * passo, hi: lo + (b + 1) * passo, count: 0 });
  for (let i = 0; i < finaliOrdinati.length; i++) {
    let idx = Math.floor((finaliOrdinati[i] - lo) / passo);
    if (idx < 0) idx = 0; if (idx >= nBin) idx = nBin - 1;
    bins[idx].count++;
  }
  let maxCount = 0;
  bins.forEach(b => { b.pct = b.count / numSims; if (b.count > maxCount) maxCount = b.count; });

  const totaleVersatoReale = (vers + datore) * anni;  // euro di oggi -> retta riferimento

  return {
    versione: "v2",
    anni, etaAttuale: par.etaAttuale, etaPensione: par.etaPensione, numSims,
    rendimentoMedio: mu, volatilita: sigma, costo,
    bande, percorsiCampione, finaliOrdinati,
    stat: { sfortunato, tipico, fortunato, media, totaleVersato: totaleVersatoReale },
    rendita,
    istogramma: { bins, maxCount, lo, hi },
    versato: { utente: totUtente, datore: totDatore, totale: totUtente + totDatore },
    deduzione: { risparmio: risparmioDeduzione, aliquota: F.aliquota },
    finaleTax: { aliquota: aliqFin, base: baseDedotta, importo: tassaFinaleImporto },
  };
}

/* ===========================================================================
 *  DISPATCHER — sceglie il motore in base a par.versione (default v2)
 * ========================================================================= */
function eseguiSimulazione(par) {
  return (par.versione === "v1") ? eseguiSimulazioneV1(par) : eseguiSimulazioneV2(par);
}

window.MonteCarlo = {
  eseguiSimulazione, eseguiSimulazioneV1, eseguiSimulazioneV2,
  MODELLO, coeffTrasformazione, aliquotaFinale,
};
