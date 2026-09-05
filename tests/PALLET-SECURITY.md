# Public pallet editing

The user requested removal of login on 2026-09-05. Apply supabase-pallet-public-edit.sql after supabase-pallet-security.sql. All visitors may edit through save_pallet_changes. Direct table writes remain revoked; server version checks, stale-write rejection and atomic imports remain mandatory. The earlier editor allowlist is no longer consulted for pallet saves.

Validation: node --test tests/*.test.cjs and tests/pallet-security.sql (rollback-only transaction under anon). No login or email confirmation is required.
