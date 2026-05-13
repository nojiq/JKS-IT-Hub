# Pulse Org Sync

IT Hub keeps LDAP as the user identity source and enriches synced users with JKSPulse org data from MongoDB.

## Sync Flow

1. Manual LDAP sync or scheduled LDAP sync reads LDAP entries.
2. IT Hub maps LDAP attributes into `users.ldap_attributes`.
3. If Pulse org sync is enabled, IT Hub looks up the matching JKSPulse Mongo user by LDAP email or username.
4. If no Pulse user matches, IT Hub falls back to matching LDAP department against Pulse departments.
5. IT Hub stores the result in `users.org_snapshot` and `users.org_synced_at`.

The frontend reads org data only from IT Hub APIs. It does not connect to JKSPulse MongoDB.

## Matching Order

1. Exact email match: LDAP `mail`, `email`, or `userPrincipalName` to Pulse `users.email`.
2. Username match: IT Hub username to Pulse email prefix or Pulse `username`.
3. Department fallback: LDAP `department` or `dept` to Pulse `departments.name`.

Section is only reliable when a Pulse user match succeeds. Department-only fallback can resolve department and division, but not user section.

## Configuration

```bash
PULSE_ORG_SYNC_ENABLED=false
PULSE_MONGO_URI="mongodb://localhost:27017/jkspulse"
PULSE_MONGO_DATABASE="jkspulse"
PULSE_MONGO_TIMEOUT_MS=2000
```

If Pulse sync is disabled or MongoDB is unavailable, LDAP sync continues. Existing org snapshots are left untouched when Pulse lookup fails.

## Rollout

1. Deploy DB migration adding `users.org_snapshot` and `users.org_synced_at`.
2. Deploy API with `PULSE_ORG_SYNC_ENABLED=false`.
3. Configure `PULSE_MONGO_URI` on the server.
4. Set `PULSE_ORG_SYNC_ENABLED=true`.
5. Run manual LDAP sync once.
6. Check snapshot coverage:

```sql
SELECT username, JSON_EXTRACT(org_snapshot, '$.department.name') AS department, org_synced_at
FROM users
WHERE org_snapshot IS NOT NULL
LIMIT 10;
```
