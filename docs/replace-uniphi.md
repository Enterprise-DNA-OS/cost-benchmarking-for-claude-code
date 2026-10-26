# Replace the UniPhi cost benchmarking desk

This base handles your own elemental cost plans, source references, peer reviews, comparable projects and tender evidence. UniPhi also has contract, project, time and other functions. Agree the required scope before retiring it.

## Export and preserve

UniPhi documents [Costs > Budget > Export](https://knowledge.uniphi-software.com/post/8-how-to-create-import-budgets). The workbook carries a Budget named range, hierarchical Code1/Description1 and subsequent CodeN/DescriptionN columns, plus Qty, Unit, Rate and Budget. Export each project and revision you need. Keep the original workbook unchanged, then save the budget worksheet as UTF-8 CSV. The supplied fixture is synthetic, using documented headers; it is not evidence that every customised workbook has the same layout.

## Set the comparison context

Create the project with add-project, supplying its actual sector, region, work type, currency, measured area and owner. Then import one exported budget in one command:

```bash
node scripts/costs.mjs import uniphi imports/budget.csv --project=SCH-01 --ref=HARBOUR-2 --base-date=2026-10-01 --index-series="Your published series and edition" --index=110 --source="UniPhi workbook and index evidence reference" --scope="Classroom block" --assumptions="Normal ground" --exclusions="Land and GST" --uncertainty=15 --contingency=10 --due=2026-11-01 --actor="Surveyor" --dry-run
```

Inspect the dry run, then repeat without --dry-run. One import creates the plan, leaf cost elements, import receipt and history. A repeat of the same content and metadata returns its existing receipt. Changed data requires a new ref and becomes a new revision. Every import is atomic. No partial plan survives a rejected row.

## Mapping

| Export | Destination |
|---|---|
| Code1 through CodeN | Slash-separated full cost path |
| Deepest DescriptionN | Element description |
| Qty, Unit, Rate | Measured quantity, unit and unit rate |
| Budget | Authoritative line amount, when present |
| Parent subtotal | Excluded when child paths exist |
| Budget without measured quantities | One lump-sum item, clearly labelled item |
| Project, area, sector, currency, dates, price index, scope | Explicit operator metadata, never guessed |

Decimal cells use a period, no currency signs or grouped thousands. Negative costs, formulas, sparse hierarchy, duplicate paths, malformed CSV and partial Qty/Unit/Rate rows are rejected. Budget-only lines are supported, including zero. If Budget differs from quantity times rate it remains authoritative, as the documented export allows a direct budget amount. Reconcile that difference before approval. Each source code must be unique within its parent, and slash characters in source codes need mapping before import.

## Reconcile before switching

Check leaf counts and sums against the original workbook, then compare area, currency, base date, contingency, excluded scope and each code path. Parent totals must not be counted again. Run cost-plan, compliance and draft-cost-report. Have another surveyor review the evidence and approve the new plan. Run both processes until the responsible operator agrees the records and reports match.

Documents, attachments, custom workbook layouts, formulas, historical reviews, permissions, forecasts, live accounting links, project schedules and contract administration do not transfer in this import. Enterprise DNA maps and builds the parts your custom version needs. This base does not read a native XLSX binary directly. Saving the worksheet as CSV is the export preparation step.

Export writes all records to JSON without overwriting an existing file. It is a portability export, not a backup restoration command. Use native database backups and test recovery before relying on the system.
