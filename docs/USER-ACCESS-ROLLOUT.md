# User access rollout

The application now has a username/password login screen, one Admin role, and an Admin-only user list with add/delete actions. Passwords are handled by Supabase Auth. No password or service key belongs in Git or the browser bundle.

## Rollout order

1. Deploy the recovery form, send a Supabase password-recovery email to the existing Admin account, and have the account owner enter the new credential on the live recovery page.
2. Run `supabase-app-users.sql` in the project's SQL Editor. It creates the `app_users` profile table, promotes the existing account to the one Admin, and installs guarded RPC wrappers without changing the old public API yet. Check that the transaction commits and that there is exactly one Admin.
3. Deploy `supabase/functions/pk-user-access/index.ts` as `pk-user-access`, using `supabase/config.toml` (`verify_jwt = true`). Login requests use the project's publishable key as the gateway bearer token. Every management action replaces it with the signed-in user's JWT, validates that JWT, and checks the Admin role. Do not expose the service role key to the website.
4. Test Admin login, Admin user listing, user creation, subuser login, rejected subuser management, subuser deletion, and rejected login after deletion against a staging URL or preview. Confirm that password values never appear in logs or source.
5. Deploy the new website files together. Then run `supabase-app-users-lockdown.sql` so anonymous clients lose live data and write access, and the old unrestricted RPC names are no longer executable by browsers. Verify both Admin and subuser can still read and save pallets, and only Admin can replace stock.

## Important limitation

`index.html` still contains an embedded stock/BOM snapshot in its source. The login screen blocks ordinary UI access, and the lockdown script protects live Supabase data, but anyone who downloads the public HTML can inspect that historical snapshot. Do not describe this build as confidential until the embedded data has been moved behind authenticated server access. The original data in the source must be removed, not merely hidden with CSS or JavaScript.

If any step before lockdown fails, keep the old public API unchanged and do not publish the website login gate. If lockdown succeeds but the new UI fails, restore the previous website build only together with a reviewed database rollback; serving the old site against the locked API will break writes.
