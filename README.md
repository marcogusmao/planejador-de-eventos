# Planejador de Eventos — event P&L forecasting

A local-first web app for planning the finances of live events (parties, concerts, festivals): it forecasts revenue and costs before the event, tracks what was actually spent and earned, and closes the books afterwards — so a producer can decide *whether the event pays off* and see *where the money went*.

> The interface is in Brazilian Portuguese (pt-BR), built for the São Paulo events market. All event names, brands and figures in this repository — including the built-in benchmarks and test fixtures — are **fictional**.

## What it does

- **Ticketing model** — ticket batches (*lotes*) with price, quantity and sell-through, booking fees, cashback and courtesy tickets.
- **Three scenarios** — pessimistic, realistic and optimistic projections side by side, with break-even and margin for each.
- **Costs by category** — F&B, venue & permits, structure, staff, talent, marketing and contingency, with estimated vs. actual per line item and payment status.
- **Other revenue** — bar (fixed or per-head), sponsorships by stage (proposal → confirmed → received) and taxes on configurable bases.
- **Sales curve** — planned vs. actual ticket sales pace up to the event date.
- **Benchmarks** — compare a new event against past ones (cost per head, ticket average, profit), and promote a closed event into a benchmark.
- **Closing** — realized P&L, estimated vs. actual variance and forecast accuracy across events.
- **Reports** — printable report, presentation mode for meetings, and a copy-ready summary.
- **Import / export** — Excel budget import and export (SheetJS + ExcelJS), CSV exports for the accountant and payment schedule.
- **Safety net** — undo/redo, automatic snapshots, trash, JSON backups, and corrupted-data quarantine. Data lives in the browser (`localStorage`); nothing is sent to a server.

## Stack

- **React 19** + **Vite 6**
- **Tailwind CSS 4**
- **Vitest 3** + Testing Library + jsdom — ~4,250 tests across ~200 files, run in two time zones (UTC and America/Sao_Paulo)
- ExcelJS and SheetJS (vendored in `vendor/`), lucide-react icons
- Optional: a zero-dependency Node server (`servidor/`) that serves the built app behind an OIDC login, with a `Dockerfile` for deployment

## Running locally

Requires Node 20 or 22+.

```bash
npm ci            # install (also enables the repo's git hooks)
npm run dev       # dev server at http://localhost:5173
npm test          # full test suite
npm run build     # production build in dist/
npm run preview   # serve the build at http://localhost:4173
```

## Engineering guardrails

The repo treats "a wrong number shown as right" as worse than a crash, and backs that with automation:

- **Money in integer cents** and golden tests that pin every formula; changes to calculation files are gated by `scripts/portao-golden.sh` and need an explicit approval line in the commit message.
- **Data-leak guard** — `scripts/trava-dados.sh` (pre-commit, pre-push and CI) blocks spreadsheets, CSV exports, backups and databases from ever being committed; `gitleaks` scans for secrets.
- **Acceptance battery** for the guards themselves (`scripts/portao-teste.sh`) and a weekly mutation-testing workflow.
- `scripts/auditoria.sh` runs the whole audit locally, stopping at the first red step.

## Project layout

```
src/components/   React screens and dialogs (+ render tests)
src/lib/          calculation, import/export and storage logic (+ unit tests)
servidor/         optional authenticated Node server
scripts/          guards, audit, proofs and build helpers
vendor/           vendored SheetJS tarball
```

## License

[MIT](LICENSE). The Jost font (`src/assets/fontes/`) is under the SIL Open Font License; SheetJS (`vendor/`) is under Apache-2.0.
