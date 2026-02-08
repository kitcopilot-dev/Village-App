# Manual Database Fixes

## 2026-02-08: Fixed school_years collection user relation

**Issue:** School year save was failing with "Failed to save school year" error.

**Root Cause:** The `user` relation field in the `school_years` collection was pointing to `collectionId: "users"` but the actual users collection ID in PocketBase is `_pb_users_auth_`.

**Fix Applied:** Updated the schema in the `_collections` table directly:
```bash
ssh bear-nan.exe.xyz "sudo sqlite3 /opt/pocketbase/pb_data/data.db \"UPDATE _collections SET schema='...' WHERE name='school_years';\""
```

The `user` field's `options.collectionId` was changed from `"users"` to `"_pb_users_auth_"`.

**Result:** School year creation now works correctly.

**Note:** This was a manual database fix. The migration files in `pb_migrations/` still reference `"users"` but the live database has been corrected.
