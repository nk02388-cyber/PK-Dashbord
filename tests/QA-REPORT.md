# Dashboard QA — 2026-09-02

## Follow-up: positive-stock-only location search

- Search index/suggestions/FIFO lists now include only finite remaining quantities greater than zero, using the same remaining balance as the pallet panel. Zero, negative, unknown and invalid quantities are excluded without deleting any item or movement history.
- Open search results refresh after sync/withdrawal/return without auto-opening a modal. Returned stock can reappear.
- All 12 regression suites passed, including new `search-stock.test.cjs`: mixed positive/empty lots, decimals, zero overrides, unknown balances, live list updates and return reappearance.
- Read-only local browser + server check: SKU 31-0028-06-53 had remaining 0 at D-11, E-20, E-21 and E-22; search correctly returned no in-stock position. D-11 still displayed its receipt 3,600 and withdrawal 3,600 in the pallet history. SKU 31-0120-07-61 retained two positive-stock FIFO results. No browser errors were reported; no production stock was changed.

Scope: frontend regression checks, Stock Movement editing, search/FIFO, map controls, responsive smoke tests and GitHub Pages deployment. Applied code-review, debug, webapp-testing and deploy-checklist workflows.

## Fixes

- Compare movement snapshots by JSON values, ignoring object-key order returned by PostgreSQL JSONB. Real value changes and array reordering still conflict.
- Retain movement form drafts across same-slot realtime refreshes. A changed underlying item displays a conflict and disables save.
- Keep save errors in editor state so a realtime re-render cannot hide the error in detached DOM. Failed saves preserve the original balance and allow retry.
- Reject whitespace, booleans and objects as movement quantities instead of coercing them to zero.
- Escape product codes/names in the location-search datalist; preserve numeric zero when escaping text.
- Correct an undefined row-count variable in the inactive legacy zone-detail renderer.
- Live smoke testing revealed that opening a slot before initial Supabase loading finished left its panel empty until reopened. Full-sync completion now refreshes the active slot panel; matching-slot and unrelated-slot cases have regression assertions.

## Automated verification

All 11 `tests/*.test.cjs` suites passed. Coverage includes BOM partial code/name search, date formatting, FIFO order/ties/missing dates, map rotations/geometry, zone selection, mixed-unit balance summaries, movement arithmetic and all edit types, audit values, invalid/negative quantities, concurrent-save rejection, simulated server failures, JSONB key reordering, retained drafts and escaped search text.

All three inline application scripts parse. Embedded inventory/BOM/catalog/map content hash is unchanged. `git diff --check` passed.

## Browser verification

Used isolated `tests/preview-history.cjs` on localhost:8767 with both Supabase URLs disabled. Test-only controls simulate refresh, conflicting edits and network failures; they are injected by the local server, not included in production HTML.

- Receipt 21 → 22: balance 14 → 15.
- Withdrawal 9 → 8: balance 15 → 16.
- Return 3 → 2: balance 16 → 15.
- Withdrawal 999: rejected, no balance mutation.
- Same-slot refresh: quantity and Lot draft retained.
- Conflicting remote quantity: visible warning, save disabled.
- Simulated save failure after re-render: visible error, draft retained, original balance 14 unchanged, retry enabled.
- Four FIFO results: C-05 (01/08), D-21 (04/08), C-06 (04/08), D-16 (01/09), one row each.
- BOM partial code search, suggestion selection and result rendering succeeded.
- Main-map and pallet-map rotation buttons operated successfully.
- 390×844: edit fields and save/cancel controls accessible; movement table scrolls horizontally within its container.
- 1024×768: stock tab/summary rendered; no browser error logs in tested flows.
- Read-only production check: K-04 contained two items; first movement balances were 8,645 → 8,345 → 4,170, second receipt was 235. Confirmed initial-load stale-panel issue by reopening without any write.

## Deployment and limits

Deploy only after passing tests to the existing GitHub Pages repository. Verify deployed HTML contains the new snapshot/draft helpers, then perform read-only live smoke checks. Roll back the release commit if pages fail to load or movement totals regress; previous deployment was `0dd20b5`. No database migration is involved.

Production write paths were not exercised against real stock; failures and concurrent updates were simulated. No production inventory, PIN or database permissions were changed. Server-side authorization/RLS and legacy whole-slot last-write-wins operations are outside this frontend check; the new movement editor's conflict checks do not make every older client write transactional. This is a bounded regression assessment, not a claim that every possible bug has been eliminated.
