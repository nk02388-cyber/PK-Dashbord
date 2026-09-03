# Database integration tests

The 2026-09-03 test used a real local PostgreSQL 17.10 cluster, two independent authenticated database login roles, an anonymous-role login, the repository schema/policies and synthetic inventory. Production catalog inspection confirmed the current grants and policy predicates match the pallet migration. No production inventory was written. Supabase Auth login/JWT issuance and the hosted PostgREST transport are not exercised by this local test.

`database.integration.cjs` executes the actual `persistMovementEdit` and movement calculation functions through a PostgreSQL-backed adapter. A barrier makes both sessions read the same version before attempting their updates. The function refuses non-local hosts and databases without a `codex_test_` prefix.

## Reproduce

Install `embedded-postgres@17.10.0-beta.17` and `pg@8.16.3` in a temporary directory using npm or pnpm. Approve only the platform binary package's postinstall when required by the package manager. Use the runner in `tests/run-database-tests.mjs` and set `QA_PG_RUNTIME` to that temporary directory. Run from the repository root:

```powershell
$env:QA_PG_RUNTIME = 'C:/path/to/temporary/pg-runtime'
node tests/run-database-tests.mjs
```

The runner binds only 127.0.0.1:55439, creates a new local test cluster under `work/`, uses a random admin password, and stops PostgreSQL when finished. It leaves the local test files for inspection. It never accepts a production URL, uses a production PIN, or creates operating-system users.

## Verified

- Direct access to PIN settings and stock snapshots denied to anon/authenticated roles.
- DELETE denied for pallet data.
- Wrong synthetic PIN leaves snapshot count unchanged; correct synthetic PIN writes exactly one snapshot.
- Two STOCK CARD editors: one succeeds, one receives a conflict; received quantity, remaining quantity, withdrawal history and one audit entry stay consistent.

## Open findings — not passing security requirements

1. Production currently grants anonymous INSERT/UPDATE on pallets and receive dates with unconditional policies. RLS is enabled but does not distinguish authorized editors. Restricting this requires an agreed login/editor-role model and corresponding UI/backend changes; existing production access was not silently changed.
2. Legacy whole-slot writes without an updated_at condition are last-write-wins. The integration test demonstrates this separately from the protected STOCK CARD path. They require a versioned mutation API or equivalent optimistic locking before claiming all writes are concurrency-safe.

The same findings were confirmed by reading the live policy catalog. The private Stock/PIN tables intentionally have no public SELECT policies; the public Stock RPC checks a PIN. Advisor notices for those functions are review items, not evidence that every warning is an exploitable defect.

Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
