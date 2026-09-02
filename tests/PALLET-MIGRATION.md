# ADR: Move pallet data into the managed Stock project

Status: database copy and verification complete; frontend cutover release prepared 2026-09-02.

## Context and decision

Move `pallet_slots` and `receive_dates` from `ddumrwpkpgfrkocwcruz` to `zgsxbuckjrplkpvtlbmn`. The user confirmed all pallet writers are paused. Keep the source database unchanged. Do not add archive/Log features: that request was cancelled.

Options: keep the inaccessible source (cannot manage its schema), or copy into new independent tables in the existing managed project. Chosen: copy the data, verify full content, then switch the frontend. Reusing the existing project avoids creating a paid project or storing data with a new provider. Stock snapshot/PIN tables and Stock RPCs remain unchanged.

## Data, security and cutover

- Baseline release: `da5409b`.
- Source backup outside the published repository: `work/migration-backups/2026-09-02T08-45-10-910Z/pallet-source.json` relative to workspace root.
- Backup contains 1,001 pallet rows, 310 occupied positions, 353 items, 64 withdrawal and 6 return transactions; 0 receive_dates rows. Existing per-item receive dates are inside the items JSON and are retained.
- Backup read twice for stability. Paginated exact-count reads avoid truncation at the API row limit. Compare canonical SHA-256 including all row fields, items, movement history, flags and timestamps.
- Target tables must not exist before DDL; copy refuses non-empty targets. No overwrite of Stock tables or removal of source rows.
- Preserve source browser permissions: select/insert/update on pallet tables only; no delete permission. This remains a public-key, no-login pallet app, not a new authentication system. Stock/PIN table access remains denied.
- Update the app to load every page, and reuse one Supabase client for the now-shared project to avoid competing auth clients.
- Test new target reads/writes, error handling and realtime with identifiable disposable test rows, then remove those test rows.
- Verify source is unchanged and target content matches before publishing. After publishing, all PCs must reload the new release; cached/old downloaded HTML can still point to the source.

## Rollback

Before users resume writes: revert frontend connection to `da5409b` if initial load, realtime, Stock/BOM or hashes fail. Leave both databases and local backup intact.

After users resume: stop all writes first. Back up target data and reconcile post-cutover changes before any frontend rollback; never blindly restore the stale source. No automatic overwrite or destructive rollback.

## Verification record

Source and target hashes match after copy and after test cleanup: `ca5a8afb5329292704f11da0c337b5abc1fe5b8ffc0b8f93d8e1164661bb83a5`; empty receive_dates hash: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

Stock baseline: 6 snapshot rows, checksum `e98e2b9564c020bc69a7ec3712dcf74f`; 1 settings row, checksum `4a234045cf572c758543ac9de85cd347`.

- All 13 regression test suites passed, including 0/500/1000/1001/1507-row pagination cases and network/duplicate/count-change failures.
- Both new tables are in `supabase_realtime`. Browser-role select/insert/update allowed; delete and direct PIN reads denied.
- Local integration harness with two independent browser tabs loaded all 1,001 rows. Insert/update on both tables propagated through the application's existing realtime handlers without reloading the observing tab.
- Reload retained test values, proving server persistence. The only disposable rows (`__migration_check_20260902__`) were deleted afterward. Rechecked the entire target against backup and confirmed source stayed unchanged.
- Read-only browser smoke: target connection subscribed, K-04 retains movement balances 8,645 → 8,345 → 4,170 and second receipt 235. No browser errors/warnings in the standard preview.
- Stock snapshot and settings checksums after migration equal the baseline above.

Before resuming user edits: publish and confirm the new frontend URL/key and pagination helper; run live read-only smoke; tell every PC to reload. Do not run a 15-minute write simulation on production inventory: integration writes were restricted to the disposable rows above.
