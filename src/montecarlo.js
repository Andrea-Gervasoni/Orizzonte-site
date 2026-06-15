/* ============================================================================
 *  MOTORE MONTE CARLO  —  porting fedele dal C++
 *  ----------------------------------------------------------------------------
 *  Questo file e' l'UNICA fonte di verita' del modello.
 *  Quando aggiorni il C++, aggiorna SOLO le costanti qui sotto e la funzione
 *  passoAnnuale(): tutto il resto del sito si adegua da solo.
 *
 *  Equivalenza con il tuo C++:
 *    normal_distribution<double> campana(0.07, 0.15);   ->  MODELLO.rendimentoMedio / volatilita
 *    tot = tot * (1.0 + r) + versamentoXanno;           ->  passoAnnuale()
 *    finale[1000] / finale[5000] / finale[9000]         ->  percentili 10 / 50 / 90
 * ========================================================================== */

const MODELLO = {
  rendimentoMedioDefault: 0.07,   // media della "campana" (7%)
  volatilitaDefault:      0.15,   // deviazione standard (15%)
  simulazioniDefault:     10000,  // come maxSim nel C++

  // --- PROFILI DI RISCHIO (rischio e rendimento ACCOPPIATI) -----------------
  // Un profilo => una sola coppia (mu, sigma). L'utente NON sceglie mu e sigma
  // separatamente: niente combinazioni impossibili (alto rendimento + basso
  // rischio). I numeri sono illustrativi: aggiornali qui, e' la fonte di verita'.
  profili: {
    prudente:   { mu: 0.03, sigma: 0.05 },  // obbligazionario
    bilanciato: { mu: 0.05, sigma: 0.10 },  // misto
    dinamico:   { mu: 0.07, sigma: 0.15 },  // azionario
  },
  profiloDefault: "dinamico",

  // Coefficienti di trasformazione capitale -> rendita annua (semplificati,
  // ispirati ai coefficienti dei fondi pensione italiani). Facili da aggiornare.
  coefficienti: [
    [57, 0.0419], [60, 0.0455], [63, 0.0501],
    [65, 0.0535], [67, 0.0568], [70, 0.0625],
  ],
};

/* --- Numero casuale gaussiano (Box-Muller) ---------------------------------
 * Equivale a normal_distribution<double>(media, sigma) del C++.            */
function gaussiana(media, sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return media + sigma * z;
}

/* --- Un singolo anno -------------------------------------------------------
 * tot = tot * (1 + r) + versamento     (identico al C++)                   */
function passoAnnuale(capitale, versamento, rendimentoMedio, volatilita) {
  const r = gaussiana(rendimentoMedio, volatilita);
  return capitale * (1 + r) + versamento;
}

/* --- Coefficiente di trasformazione in rendita per una data eta ----------- */
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

/* --- Percentile da array ORDINATO ----------------------------------------- */
function percentile(ordinato, p) {
  const i = Math.min(ordinato.length - 1, Math.max(0, Math.floor(p * ordinato.length)));
  return ordinato[i];
}

/* ============================================================================
 *  SIMULAZIONE COMPLETA
 *  Esegue numSims scenari, ognuno lungo (etaPensione - etaAttuale) anni.
 *  Restituisce tutto cio' che serve ai grafici e ai numeri chiave.
 * ========================================================================== */
function eseguiSimulazione(par) {
  const {
    versamentoAnnuo,
    etaAttuale,
    etaPensione,
    rendimentoMedio = MODELLO.rendimentoMedioDefault,
    volatilita      = MODELLO.volatilitaDefault,
    numSims         = MODELLO.simulazioniDefault,
  } = par;

  const anni = Math.max(0, Math.round(etaPensione - etaAttuale));

  // Valori di ogni anno, per ogni simulazione -> servono per le bande del fan chart.
  const valoriPerAnno = [];
  for (let y = 0; y <= anni; y++) valoriPerAnno.push(new Float64Array(numSims));

  // Teniamo alcuni percorsi interi per disegnare le linee tenui dietro le bande.
  const nCampioni = Math.min(28, numSims);
  const percorsiCampione = [];

  for (let s = 0; s < numSims; s++) {
    let tot = 0;
    valoriPerAnno[0][s] = 0;
    const tieni = s < nCampioni;
    const perc = tieni ? [0] : null;

    for (let y = 0; y < anni; y++) {
      tot = passoAnnuale(tot, versamentoAnnuo, rendimentoMedio, volatilita);
      valoriPerAnno[y + 1][s] = tot;
      if (tieni) perc.push(tot);
    }
    if (tieni) percorsiCampione.push(perc);
  }

  // --- Bande percentili anno per anno (10/25/50/75/90) ---
  const bande = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let y = 0; y <= anni; y++) {
    const colonna = Float64Array.from(valoriPerAnno[y]).sort();
    bande.p10.push(percentile(colonna, 0.10));
    bande.p25.push(percentile(colonna, 0.25));
    bande.p50.push(percentile(colonna, 0.50));
    bande.p75.push(percentile(colonna, 0.75));
    bande.p90.push(percentile(colonna, 0.90));
  }

  // --- Capitali finali ordinati (come sort(finale) nel C++) ---
  const finaliOrdinati = Float64Array.from(valoriPerAnno[anni]).sort();
  const sfortunato = percentile(finaliOrdinati, 0.10); // finale[1000]
  const tipico     = percentile(finaliOrdinati, 0.50); // finale[5000]
  const fortunato  = percentile(finaliOrdinati, 0.90); // finale[9000]
  let somma = 0;
  for (let i = 0; i < finaliOrdinati.length; i++) somma += finaliOrdinati[i];
  const media = somma / finaliOrdinati.length;

  // --- Rendita mensile stimata ---
  const coeff = coeffTrasformazione(etaPensione);
  const rendita = {
    sfortunato: (sfortunato * coeff) / 12,
    tipico:     (tipico * coeff) / 12,
    fortunato:  (fortunato * coeff) / 12,
    coeff,
  };

  // --- Istogramma dinamico (12 bin tra p1 e p99 per evitare code estreme) ---
  const lo = percentile(finaliOrdinati, 0.01);
  const hi = percentile(finaliOrdinati, 0.99);
  const nBin = 12;
  const passo = (hi - lo) / nBin || 1;
  const bins = [];
  for (let b = 0; b < nBin; b++) {
    bins.push({ lo: lo + b * passo, hi: lo + (b + 1) * passo, count: 0 });
  }
  for (let i = 0; i < finaliOrdinati.length; i++) {
    const v = finaliOrdinati[i];
    let idx = Math.floor((v - lo) / passo);
    if (idx < 0) idx = 0;
    if (idx >= nBin) idx = nBin - 1;
    bins[idx].count++;
  }
  let maxCount = 0;
  bins.forEach(b => { b.pct = b.count / numSims; if (b.count > maxCount) maxCount = b.count; });

  // --- Totale versato (per confronto: quanto hai messo vs quanto e' diventato) ---
  const totaleVersato = versamentoAnnuo * anni;

  return {
    anni,
    etaAttuale,
    etaPensione,
    numSims,
    rendimentoMedio,
    volatilita,
    bande,
    percorsiCampione,
    finaliOrdinati,
    stat: { sfortunato, tipico, fortunato, media, totaleVersato },
    rendita,
    istogramma: { bins, maxCount, lo, hi },
  };
}

window.MonteCarlo = { eseguiSimulazione, MODELLO, coeffTrasformazione };
