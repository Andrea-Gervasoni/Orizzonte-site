# Orizzonte

**Monte Carlo simulator for the Italian private pension (*pensione integrativa*).**
It estimates how much a contribution plan could be worth over time by simulating thousands of market scenarios, showing the result as a probability distribution — not a single, misleading number.

🔗 **Live site:** _(paste your GitHub Pages link here after publishing)_
🧮 **Original C++ engine:** https://github.com/Andrea-Gervasoni/orizzonte

---

## What it is

Planning a private pension means dealing with uncertainty: future returns are unknown. **Orizzonte** tackles this with the **Monte Carlo method**: instead of assuming a fixed return, it simulates thousands of "possible lives" of your capital, each with annual returns drawn at random from a realistic distribution.

The output isn't a promise — it's a **probability map**: what happens in the unlucky scenario, the typical one, and the lucky one.

## How the model works

Each year the capital evolves with this rule (identical to the original C++ code):

```
capital = capital × (1 + r) + annual_contribution
```

where `r` is a random return drawn from a normal distribution (mean 7%, volatility 15% in version 1). Repeating the simulation **10,000 times** and sorting the results gives the percentiles:

- **10th percentile** → unlucky scenario (worst 10% of cases)
- **50th percentile** → typical scenario (the median)
- **90th percentile** → lucky scenario (best 10% of cases)

The final capital is then converted into an **estimated monthly annuity** using simplified transformation coefficients, inspired by those of Italian pension funds.

## Features

- 📊 **Fan chart** of the capital trajectories, year by year
- 🎯 **Three scenarios** (unlucky / typical / lucky) with estimated monthly annuity
- 📈 **Histogram** of the outcome distribution
- 🎛️ Adjustable parameters: annual contribution, age, retirement age, risk, number of simulations
- 🌍 **Bilingual** Italian / English
- 🔭 **Version dial**: the model grows over time, and its evolution is navigable
- 🔬 **Anonymous data collection** (opt-in) for research: age, contribution and risk appetite

## Privacy

Data collection is **anonymous and opt-in**. Only three non-identifying values are stored (age, annual contribution, chosen risk) for statistical/research purposes. **No** name, email or personal data. Consent is asked only once per visitor.

## Tech

A **static** site, no frameworks: plain HTML, CSS and JavaScript. The Monte Carlo simulation runs entirely in the browser (a faithful JavaScript port of the original C++ model). Data collection uses a Google Apps Script endpoint + Google Sheet.

```
index.html         → main page
src/montecarlo.js   → simulation engine (single source of truth for the model)
src/charts.js       → SVG charts (fan chart + histogram)
src/app.js          → UI, state, rendering
src/versions.js     → model versions (the dial)
src/research.js     → anonymous data collection
src/i18n.js         → translations IT / EN
src/fx.js           → effects (splash, background, scroll reveal)
src/styles.css      → styling
```

### Run it locally

Since it's static, just open `index.html` in a browser. To avoid local-file restrictions, a tiny server is better:

```bash
# with Python
python3 -m http.server
# then open http://localhost:8000
```

## Stated limitations (v1)

This is an **evolving educational prototype**: returns are independent across years, and inflation, management fees and taxation are not yet modelled. Built to grow — future versions are already tracked in the dial at the bottom of the site.

> ⚠️ **Educational tool, not financial advice.** Past and simulated returns do not guarantee future results.

---

## Riassunto in italiano

**Orizzonte** è un simulatore Monte Carlo per la pensione integrativa italiana. Invece di assumere un rendimento fisso, simula 10.000 possibili percorsi di mercato del capitale e mostra il risultato come distribuzione di probabilità: scenario sfortunato (10° percentile), tipico (mediana) e fortunato (90°), con una rendita mensile stimata. Il motore di simulazione è un porting fedele in JavaScript di un [programma C++ originale](https://github.com/Andrea-Gervasoni/orizzonte). Sito statico, senza framework, bilingue IT/EN. Raccolta dati anonima e su consenso. Strumento didattico, non consulenza finanziaria.

---

**Author:** Andrea Celeste Gervasoni
**License:** _(optional — e.g. MIT)_
