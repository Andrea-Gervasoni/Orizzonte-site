# Orizzonte

A Monte Carlo simulator for the Italian supplementary pension (the *pensione integrativa*). It estimates what a long term savings plan could realistically become, in today's euros, after costs and Italian taxes. Instead of handing you one tidy number that pretends the future is certain, it shows the whole spread of outcomes as a probability distribution.

**Live site:** https://andrea-gervasoni.github.io/Orizzonte-site/

**Original C++ engine:** https://github.com/Andrea-Gervasoni/Orizzonte-cpp

## The idea

Saving for retirement is a bet against an unknown future. Markets go up, markets go down, and a single "expected return" hides everything that matters: how bad a bad decade can be, and how much patience actually pays off.

Orizzonte answers that with the Monte Carlo method. Rather than assuming a fixed return, it plays out thousands of possible lives of your fund, each one with its own random sequence of yearly returns. Then it sorts the results and reads off where you land: the unlucky case, the typical case, and the lucky case.

The number it gives you is not a promise. It is a map of what could happen, and how likely each corner of that map is.

## Two versions, one dial

The model is meant to grow, so the site keeps its history. A small gem at the bottom of the page opens a dial that lets you move between versions.

**Version 1, the prototype (frozen).** The original engine, ported faithfully from C++. Each year the capital follows a simple rule:

```
capital = capital * (1 + r) + annual_contribution
```

where `r` is drawn from a normal distribution. It ignores costs, taxes and inflation on purpose: it is the clean teaching model, and it stays exactly as it was.

**Version 2, the realistic model (current default).** A much closer picture of how an Italian pension fund actually behaves:

* Returns drawn from a lognormal distribution, so a year can lose at most one hundred percent and grow without a ceiling, with the volatility drag built in.
* A yearly management cost (ISC) that quietly erodes performance.
* A twenty percent tax applied every year on positive gains, as Italian pension funds really are taxed.
* Contributions that grow two percent a year, keeping their value constant in real terms.
* An optional employer contribution that joins your own money in the fund.
* A reduced exit tax, from fifteen percent down to nine, based on years of participation.
* Everything deflated to today's euros, so the figures are comparable to your salary right now.
* A separate, honest read of the tax deduction you gain along the way.

## What you get on screen

* Three headline scenarios (unlucky, typical, lucky) with the capital and an estimated monthly income for each.
* A fan chart of the trajectories over time, with a hover tooltip that reads out the percentiles at any age.
* A histogram of the final outcomes, with adaptive bands and a hover readout.
* A clear summary of what you put in, what the employer adds, and what the deduction gives back.
* A collapsible methodology section with the full list of assumptions.
* A bilingual interface, Italian and English.

## Privacy

The optional research panel is anonymous and asks for consent before sending anything. It stores only a few non identifying values (age, contribution, risk profile, income band, management cost) together with an anonymous session id and an attempt counter, so the data can be studied without ever touching personal information. No name, no email, nothing that points back to a person.

## How it is built

A static site with no frameworks: plain HTML, CSS and JavaScript. The whole simulation runs in the browser as a faithful JavaScript port of the C++ engine. Anonymous data collection uses a Google Apps Script endpoint writing to a Google Sheet, one sheet per model version.

Project layout:

* `index.html` is the page itself.
* `src/montecarlo.js` is the simulation engine and the single source of truth for the model.
* `src/charts.js` draws the interactive fan chart and histogram in SVG.
* `src/app.js` handles the interface, the state and the rendering.
* `src/versions.js` defines the model versions and the dial.
* `src/research.js` handles the anonymous, consent based data collection.
* `src/i18n.js` holds the Italian and English copy.
* `src/fx.js` runs the splash, the ambient background and the scroll reveals.
* `src/styles.css` is the styling.

### Running it locally

Because it is static, you can open `index.html` directly. To avoid local file restrictions, a tiny server works better:

```bash
python3 -m http.server
# then open http://localhost:8000
```

## Honesty about the limits

This is an educational tool, not financial advice, and the numbers that feed it are illustrative and meant to be calibrated against official COVIP data. The deduction model simplifies the real brackets, and the monthly income is a conservative estimate that stops at age eighty five. Always check the real rules with COVIP and the Italian Revenue Agency before making decisions.

Past and simulated returns do not guarantee future results.

## In breve (italiano)

Orizzonte è un simulatore Monte Carlo per la pensione integrativa italiana. Invece di assumere un rendimento fisso, simula migliaia di possibili futuri del fondo e mostra il risultato come distribuzione di probabilità: scenario sfortunato, tipico e fortunato, in euro di oggi, al netto di costi e tasse. La versione 2 aggiunge rendimenti lognormali, costi di gestione, tassa annua sui guadagni, contributi crescenti e del datore, tassa finale agevolata, inflazione e deduzione fiscale. La versione 1, il prototipo originale portato dal C++, resta congelata e raggiungibile dalla gemma in fondo alla pagina. Sito statico, senza framework, bilingue. Raccolta dati anonima e su consenso. Strumento didattico, non consulenza finanziaria.

## Author

Andrea Celeste Gervasoni

## License: 

MIT
