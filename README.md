# Cost Benchmarking for Claude Code

Your elemental cost plans, comparable projects and review evidence in a database you own. Built by Enterprise DNA.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install it yourself. | Your measurement fields, classifications, review rules and imported records. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | Setup fee, then a retainer. [Build our version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=uniphi) | Setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=uniphi) |

## The desk this replaces

UniPhi sells a broad project platform with cost benchmarking. This base covers the quantity surveyor's cost evidence desk: elemental plans, source references, comparable projects, tender reconciliation and peer review. It does not measure drawings or administer contracts. Your own historical costs are the benchmark library; no third-party cost dataset is included.

UniPhi's [subscription terms](https://uniphi-software.com/community/faq/terms-of-service) describe monthly charges by licensed users. Current pricing needs a quote. Checked 26 October 2026. Compare your actual contract and required scope before switching.

## Quick start

Node 20 or later. Embedded PGlite needs no server. Postgres 15 or later is supported for caller-permission views.

```bash
git clone https://github.com/Enterprise-DNA-OS/cost-benchmarking-for-claude-code.git
cd cost-benchmarking-for-claude-code
npm install
npm test
npm run demo
node scripts/costs.mjs attention
node scripts/costs.mjs benchmark HARBOUR-1
node scripts/costs.mjs tender-reconcile HARBOUR-1
npm run view
npm run docs
```

The demo contains four fictional school cost plans, an overdue review, stale evidence and an incomplete tender. Dates are relative to first seed. Seed is idempotent and refuses remote databases. Start with npm run migrate alone for an empty database. DATA_DIR selects embedded storage. DATABASE_URL selects your dedicated Postgres database with certificate verification for remote connections.

## The surveyor's week

22 CLI commands and 24 agent recipes run in Claude Code, Codex, OpenCode or Cursor. [All arguments](docs/cli.md).

- /benchmark rebases current, approved comparable plans with the index values you recorded.
- /rate-review finds old observations and missing evidence.
- /tender-reconcile separates complete offers from omitted elements.
- /plan-compare shows which cost elements changed between revisions.
- /compliance lists missing prediction records before peer review.
- /weekly-review writes the Monday review from plans, attention and compliance.
- /draft-cost-report produces a local report for professional review. Nothing sends.

Every read has --json. Project and plan names match without case sensitivity. Unique ID prefixes work. Ambiguous names list candidates and exit 1. Use --name=value for options.

## Bring your UniPhi budget

Export Costs > Budget, save the worksheet as UTF-8 CSV, and import it with one command after setting the project's real comparison context. [Exact export, metadata and import instructions](docs/replace-uniphi.md). The synthetic fixture uses the vendor's documented hierarchical CodeN/DescriptionN, Qty, Unit, Rate and Budget headers.

The importer counts leaf elements once, excludes parent subtotals and preserves a direct Budget amount. Dry runs show the mapping. Unchanged imports reuse their receipt. Invalid rows roll back the entire import. Changed records need a new plan reference and revision. No approval is inherited from the export.

## Ten questions across your cost records

The insights command answers these today. UniPhi also offers configurable benchmarking and reporting. These are questions this owned version answers, not claims of missing UniPhi features.

1. Which reviews are overdue?
2. Which benchmark plans are older than a year?
3. Which cost plans lack source evidence?
4. Which cost plans have missing assumptions?
5. Which tenders omit cost elements?
6. Which complete tenders exceed the base estimate?
7. Which owners carry overdue reviews?
8. Which cost plans are awaiting independent review?
9. Which projects have multiple cost plan revisions?
10. Which comparison groups have fewer than two current approved projects?

## What the figures mean

Line amounts use exact decimal arithmetic. Rates and quantities allow four decimal places; amounts allow two. A supplied Budget overrides quantity times rate. Without one, the multiplication rounds to two places. Contingency is added once to the plan's base cost. Rate per square metre uses the recorded project area. Negative costs are rejected; credits need a deliberately extended model. No tax, exchange rate or forecast is guessed.

Benchmark comparisons match sector, region, work type, currency and index series. They use the latest approved revision per other project and exclude observations older than the local 365-day policy. A comparable's cost per square metre is multiplied by target index divided by comparable index. Operators supply and verify index values; no market series ships with the code. An empty result means no eligible evidence.

Tender variance compares a complete offer against base cost, excluding contingency. An offer missing any cost element gets no variance. This does not determine the winning tender or confirm equivalent scope.

## Reviews and documents

A new plan needs source, scope, assumptions, exclusions, uncertainty, contingency and base-date evidence. Peer approval requires a reviewer label different from the author and no blocking record gaps. Approved plans cannot be edited; a later revision leaves them intact. Project dimensions are fixed to keep issued comparisons stable. Actor labels are not authenticated signatures.

[Compliance sources and limitations](docs/compliance.md). The checks support professional review; they do not certify RICS or ICMS compliance. A qualified surveyor remains responsible for the prediction and applicable standards.

brand.json sets the business name, logo and colours. npm run docs renders elemental cost plans, tender reconciliations and review checklists. npm run view renders the review week, benchmark library and tender completeness. /new-view adds another read-only report. Imported text is escaped.

## Your first hour: ten things to ask for

1. Put our business name and colours on the reports.
2. Show the overdue Estuary review.
3. Explain why the Sydney plan is not an Auckland comparable.
4. Show the exact price-index adjustment.
5. Explain why the incomplete tender has no variance.
6. Add our project with its real measured area.
7. Do a dry run of our exported budget.
8. Reconcile leaf cost totals and scope against the workbook.
9. Record an independent review and produce the draft report.
10. Add our own cost-classification field through /customise.

## Operation and verification

One protected database per business, trusted operators only. RLS denies ungranted roles and views use caller permissions. The base has no login or client-specific access controls. Keep supplier access outside it until designed for your business. Keep source workbooks and attachments separately: evidence references do not copy files.

Export writes all records to a new JSON file and refuses overwrite. It is not a backup restoration command. Use native backups and test recovery before live use. There is no send, publishing, payment or UniPhi write function.

npm test uses a temporary database and exercises every CLI operation, monetary rounding, comparison eligibility, immutable reviews, incomplete tenders, atomic imports, duplicate handling, HTML escaping, access settings and CLI errors. CI runs Windows and Linux on Node 20 and 22, plus disposable Postgres. Check actual workflow results before assuming a remote platform passed.

[Why no front end](docs/why-no-front-end.md). MIT. UniPhi is its owner's trademark. This independent project is not affiliated with UniPhi.
