# BOM simulation and multi-FG planning

Per-FG exclusions are temporary simulations. The standard capacity stays visible,
excluded components are listed, and Restore clears the selected FG's exclusions.
Reload clears all simulations. Summary KPIs and multi-FG plans always use standard
packaging formulas, regardless of simulation exclusions.

The planner accepts FG quantities, combines repeated additions, supports immediate
quantity edits and removal, and clears on reload. It does not reserve or write stock.
For each component code, it sums usage × requested FG quantity across all selected
formulas, including repeated component lines within a formula. It then compares this
demand against eligible stock once, excluding warehouses 800 and 900.

Unit aliases and explicitly sourced conversion rules are shared with the standard
BOM calculation. Mixed demand units use a common reachable unit, independent of FG
entry order. Missing types, units, quantities or conversions produce an incomplete
result; partial demand or stock totals are not presented as complete. Readiness
requires all selected formulas and component rows to be calculable and sufficient.
The result refreshes when the inventory snapshot changes.

Validation: `node --test tests/*.test.cjs` (17 passing files). The planner regression
covers shared supply, duplicate component demand, excluded warehouses, missing data,
unit conversions, invalid quantities and source immutability. Browser checks cover
add/combine/edit/remove, simulation isolation and restore, reload reset, and mobile
layout. Isolated preview disables production Supabase clients.
