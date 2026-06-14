/* ============================================================================
 *  GRAFICI  —  SVG disegnati a mano, nitidi e scalabili
 *  Tutti i colori arrivano dalle variabili CSS del tema attivo.
 * ========================================================================== */
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fmtEuroShort(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".0", "") + "M";
  if (a >= 1e3) return Math.round(v / 1e3) + "k";
  return Math.round(v).toString();
}

/* --- "Nice" tick step per un asse 0..max -------------------------------- */
function niceTicks(max, target = 5) {
  if (max <= 0) return [0];
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm < 1.5) step = 1; else if (norm < 3) step = 2; else if (norm < 7) step = 5; else step = 10;
  step *= mag;
  const ticks = [];
  for (let t = 0; t <= max + step * 0.5; t += step) ticks.push(t);
  return ticks;
}

/* ============================================================================
 *  FAN CHART
 * ========================================================================== */
function disegnaFanChart(svg, dati, t) {
  svg.innerHTML = "";
  const W = svg.clientWidth || 720;
  const H = svg.clientHeight || 420;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const m = { top: 24, right: 20, bottom: 46, left: 64 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const { bande, anni, etaAttuale } = dati;
  const yMaxData = bande.p90[anni] * 1.08 || 1;
  const ticks = niceTicks(yMaxData, 5);
  const yMax = ticks[ticks.length - 1];

  const X = i => m.left + (anni === 0 ? 0 : (i / anni) * iw);
  const Y = v => m.top + ih - (v / yMax) * ih;

  const cAccent = cssVar("--accent");
  const cGold = cssVar("--gold");
  const cLine = cssVar("--line");
  const cMuted = cssVar("--muted");

  // griglia orizzontale + etichette Y
  ticks.forEach(tk => {
    const y = Y(tk);
    svg.appendChild(el("line", { x1: m.left, y1: y, x2: m.left + iw, y2: y, stroke: cLine, "stroke-width": 1 }));
    const lab = el("text", { x: m.left - 10, y: y + 4, "text-anchor": "end", class: "chart-axis-label" });
    lab.textContent = fmtEuroShort(tk);
    svg.appendChild(lab);
  });

  // etichette X (eta')
  const passoX = anni <= 12 ? 2 : anni <= 25 ? 5 : 10;
  for (let i = 0; i <= anni; i++) {
    if (i % passoX === 0 || i === anni) {
      const lab = el("text", { x: X(i), y: m.top + ih + 26, "text-anchor": "middle", class: "chart-axis-label" });
      lab.textContent = etaAttuale + i;
      svg.appendChild(lab);
    }
  }

  // helper: area tra due serie
  const area = (sup, inf) => {
    let d = `M ${X(0)} ${Y(sup[0])}`;
    for (let i = 1; i <= anni; i++) d += ` L ${X(i)} ${Y(sup[i])}`;
    for (let i = anni; i >= 0; i--) d += ` L ${X(i)} ${Y(inf[i])}`;
    return d + " Z";
  };
  const linea = (serie, color, w, dash) => {
    let d = `M ${X(0)} ${Y(serie[0])}`;
    for (let i = 1; i <= anni; i++) d += ` L ${X(i)} ${Y(serie[i])}`;
    const p = el("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round" });
    if (dash) p.setAttribute("stroke-dasharray", dash);
    return p;
  };

  // bande
  svg.appendChild(el("path", { d: area(bande.p90, bande.p10), fill: cAccent, "fill-opacity": 0.12 }));
  svg.appendChild(el("path", { d: area(bande.p75, bande.p25), fill: cAccent, "fill-opacity": 0.22 }));

  // percorsi campione (tenui)
  (dati.percorsiCampione || []).slice(0, 22).forEach(p => {
    let d = `M ${X(0)} ${Y(p[0])}`;
    for (let i = 1; i < p.length; i++) d += ` L ${X(i)} ${Y(Math.min(p[i], yMax))}`;
    svg.appendChild(el("path", { d, fill: "none", stroke: cAccent, "stroke-width": 1, "stroke-opacity": 0.16 }));
  });

  // linea "solo versato" (riferimento, rendimento 0%)
  const versato = [];
  for (let i = 0; i <= anni; i++) versato.push(dati.stat.totaleVersato / anni * i || 0);
  svg.appendChild(linea(versato, cMuted, 1.5, "4 4"));

  // mediana
  svg.appendChild(linea(bande.p50, cGold, 3));

  // assi
  svg.appendChild(el("line", { x1: m.left, y1: m.top, x2: m.left, y2: m.top + ih, stroke: cMuted, "stroke-width": 1.2 }));
  svg.appendChild(el("line", { x1: m.left, y1: m.top + ih, x2: m.left + iw, y2: m.top + ih, stroke: cMuted, "stroke-width": 1.2 }));

  // titoli assi
  const ax = el("text", { x: m.left + iw / 2, y: H - 6, "text-anchor": "middle", class: "chart-axis-title" });
  ax.textContent = t("axisEta");
  svg.appendChild(ax);
}

/* ============================================================================
 *  ISTOGRAMMA
 * ========================================================================== */
function disegnaIstogramma(svg, dati, t) {
  svg.innerHTML = "";
  const W = svg.clientWidth || 720;
  const H = svg.clientHeight || 360;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const m = { top: 20, right: 18, bottom: 56, left: 56 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const { bins, maxCount } = dati.istogramma;
  const n = bins.length;
  const gap = 6;
  const bw = (iw - gap * (n - 1)) / n;

  const cAccent = cssVar("--accent");
  const cGold = cssVar("--gold");
  const cLine = cssVar("--line");
  const cMuted = cssVar("--muted");

  const yMaxPct = (maxCount / dati.numSims) * 1.12 || 1;
  const ticks = niceTicks(yMaxPct * 100, 4);
  const yMax = ticks[ticks.length - 1] / 100;
  const Y = p => m.top + ih - (p / yMax) * ih;

  // griglia + etichette probabilita'
  ticks.forEach(tk => {
    const y = Y(tk / 100);
    svg.appendChild(el("line", { x1: m.left, y1: y, x2: m.left + iw, y2: y, stroke: cLine, "stroke-width": 1 }));
    const lab = el("text", { x: m.left - 8, y: y + 4, "text-anchor": "end", class: "chart-axis-label" });
    lab.textContent = tk + "%";
    svg.appendChild(lab);
  });

  const medianIdx = bins.findIndex(b => dati.stat.tipico >= b.lo && dati.stat.tipico < b.hi);

  bins.forEach((b, i) => {
    const x = m.left + i * (bw + gap);
    const h = (b.pct / yMax) * ih;
    const y = m.top + ih - h;
    const rect = el("rect", {
      x, y, width: bw, height: Math.max(0, h), rx: 2,
      fill: i === medianIdx ? cGold : cAccent,
      "fill-opacity": i === medianIdx ? 0.92 : 0.66,
    });
    svg.appendChild(rect);

    // etichetta fascia (mostra solo alcune per non affollare)
    if (i % 2 === 0 || i === n - 1) {
      const lab = el("text", { x: x + bw / 2, y: m.top + ih + 22, "text-anchor": "middle", class: "chart-axis-label" });
      lab.textContent = fmtEuroShort(b.lo);
      svg.appendChild(lab);
    }
  });

  // asse base
  svg.appendChild(el("line", { x1: m.left, y1: m.top + ih, x2: m.left + iw, y2: m.top + ih, stroke: cMuted, "stroke-width": 1.2 }));

  const ax = el("text", { x: m.left + iw / 2, y: H - 8, "text-anchor": "middle", class: "chart-axis-title" });
  ax.textContent = t("axisFascia");
  svg.appendChild(ax);
}

window.Charts = { disegnaFanChart, disegnaIstogramma };
