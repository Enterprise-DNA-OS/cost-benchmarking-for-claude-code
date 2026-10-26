# Cost benchmarking commands

All commands use node scripts/costs.mjs and support --json. Options use --name=value. Quote values containing spaces. Name/code matching is case-insensitive. Unique ID prefixes work. Ambiguous names list candidates and exit 1.

| Ask | CLI arguments |
|---|---|
| /help | Show this command list |
| /projects | List projects |
| /add-project | --code --name --sector --region --work-type --currency --area --owner |
| /plans | List plan revisions |
| /add-plan | PROJECT --ref --base-date --index-series --index --source --scope --assumptions --exclusions --uncertainty --contingency --due --actor |
| /cost-plan | PLAN: header, cost lines and total |
| /add-line | PLAN --code --description --quantity --unit --rate [--amount] --actor |
| /review | PLAN --decision=approved / changes --note --actor |
| /benchmark | PLAN: latest approved comparable plans, rebased to its index |
| /rate-review | List old benchmark plans and missing source records |
| /tender-add | PLAN --supplier --code --amount --source --date --actor |
| /tender-reconcile | PLAN: complete and incomplete tender comparisons |
| /plan-compare | PLAN PLAN: added, removed and changed elements |
| /attention | Overdue reviews and stale benchmarks |
| /compliance | Cost prediction record checks |
| /log | PROJECT --note --actor |
| /history | PROJECT: recorded changes and notes |
| /import | uniphi FILE.csv --project=PROJECT plus add-plan fields [--dry-run] |
| /export | --out=FILE.json: all records, refuses overwrite |
| /weekly-review | Write local HTML from plans, attention and compliance |
| /draft-cost-report | PLAN: local cost prediction report for professional review |
| /insights | Ten questions answered from the records |

/customise changes the data model through a migration. /new-view adds a read-only view. Both are agent recipes rather than CLI subcommands.
