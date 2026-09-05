# Pallet write security

Apply `supabase-pallet-security.sql` after the original pallet schema. It adds server
versions and an editor allowlist, revokes direct browser writes, and exposes one
authenticated RPC. Reading pallets remains public. Stock inventory RPCs are unchanged.

An editor must have a confirmed, non-anonymous Supabase Auth account whose email is in
`public.pallet_editors`. This table is inaccessible to browser roles. Admins manage it
through Supabase SQL Editor. Add the approved lowercase email with an INSERT; remove
its row to revoke write access immediately. No browser user can grant themselves access.

Login uses Supabase email magic links. The Auth Site URL is the deployed dashboard URL.
Email delivery uses the project's configured email provider and limits. The account
owner completes email verification; automated tests do not send emails or use their session.

Every slot/date write supplies the version the editor saw. The RPC updates that exact
version and increments it on the server. Version 0 creates an absent row, rejecting a
creation race. Direct table writes are denied even to authenticated users, so stale
clients cannot bypass concurrency checks. Imports use one transaction for all rows;
any stale row rolls back the whole import. A failed request is not automatically retried.

Local state changes only after successful persistence. Open slot editors retain their
baseline when realtime events arrive, preventing array indices from silently pointing
at another item. On conflict, form values remain available for copying; reopen the slot
or refresh to load the new version before re-entering the intended edit.

Validation: `node --test tests/*.test.cjs` (21 files), plus `tests/pallet-security.sql`
in one rollback-only database transaction. The SQL test covers allowlisting, confirmed
email, anonymous identities, version increments, stale writes, import rollback and
receive-date creation races. Local browser preview `tests/preview-pallet-security.cjs`
disables production clients and tests denied edits, conflict retention and successful
withdrawal. Anonymous HTTP writes/RPC returned 401; public reads returned 200.

Deployment data check: 1,001 slots preserved, pallet-content hash unchanged:
`e44bf1e853ab579548dcd8088d8f0336`. Test users and rows were rolled back.

Rollback must preserve the write restriction. Restore/fix the frontend or RPC, rather
than re-granting anonymous INSERT/UPDATE or deploying the old unversioned client.
