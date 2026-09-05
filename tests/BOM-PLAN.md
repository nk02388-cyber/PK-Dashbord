# BOM simulation and multi-FG planning

Per-FG exclusions are temporary simulations. The standard capacity stays visible,
excluded components are listed, and Restore clears the selected FG's exclusions.
Reload clears all simulations. Summary KPIs and multi-FG plans always use standard
packaging formulas, regardless of simulation exclusions.

The planner accepts FG quantities, combines repeated additions, supports immediate
quantity edits and removal. Draft FG codes and quantities are saved automatically in this browser and restored on reload; calculated stock results are always refreshed. Clear removes the saved draft. It does not reserve or write stock.
For each component code, it sums usage × requested FG quantity across all selected
formulas, including repeated component lines within a formula. It then compares this
demand against eligible stock once, excluding warehouses 800 and 900.

Unit aliases and explicitly sourced conversion rules are shared with the standard
BOM calculation. Mixed demand units use a common reachable unit, independent of FG
entry order. Missing types, units, quantities or conversions produce an incomplete
result; partial demand or stock totals are not presented as complete. Readiness
requires all selected formulas and component rows to be calculable and sufficient.
The result refreshes when the inventory snapshot changes.

Validation: `node --test tests/*.test.cjs` (20 passing files). The planner regression
covers shared supply, duplicate component demand, excluded warehouses, missing data,
unit conversions, invalid quantities and source immutability. Browser checks cover
add/combine/edit/remove, simulation isolation and restore, draft restoration, shortage filters, Excel download, and mobile
layout. Isolated preview disables production Supabase clients.

The brand selector is collapsed initially on mobile (up to 640 px). Planner filters show all, shortage, or unknown component rows without changing totals. Excel exports the complete plan in three sheets with snapshot metadata, FG quantities, and component demand. Storage failures are visible and never reported as saved.
