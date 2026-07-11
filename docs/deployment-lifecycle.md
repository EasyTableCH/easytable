# EasyTable Deployment, Discovery and Lifecycle

## Runtime model

- `localMaster` is the operational source of truth for one location.
- Local Staff is served by LocalMaster at `/staff` and reads `/api/runtime-context` from the same origin.
- Hosted Staff reads the authenticated tenant/location context from RelaySyncApi and never calls a private HTTP address.
- Remote mutations remain idempotent Relay commands and are complete only after LocalMaster returns `accepted`.

## Authentication context

`GET /api/auth/me` returns all tenant memberships and active locations available to the Better Auth user. One location is selected automatically; multiple locations require an explicit Staff selection. Saved selections are user-scoped and revalidated after login.

Local Staff devices are paired with a short-lived LocalMaster pairing code. The paired device can list active bootstrapped users and exchange a valid PIN for a 12-hour LocalMaster-only session. Device secrets and local sessions never become cloud credentials.

## Initial setup

1. Platform Admin creates tenant, location and initial owner.
2. Owner completes Better Auth account setup in hosted Staff.
3. A signed Master Station installer installs LocalMaster as an automatically starting Windows service.
4. The setup wizard claims the location using the short-lived code generated in Platform Admin.
5. LocalMaster bootstraps location users, output stations and configuration.
6. POS, KDS and local Staff devices pair locally using separate short-lived codes.
7. Setup is complete only when identity, cloud binding, bootstrap and API compatibility checks pass.

Manual URLs, instance ids and relay credentials belong in a technician/recovery surface, not the normal owner flow.

## Release and update contract

LocalMaster identity publishes service and API compatibility versions. POS blocks operation when its API version is outside the advertised range. `/api/update/status` blocks installation while orders or payment recovery work are open.

Relay exposes `/api/releases/manifest`. Production manifests must contain an HTTPS URL, SHA-256 digest and signature and are supplied through `EASYTABLE_RELEASE_MANIFEST_JSON`. Signing keys are release-infrastructure secrets and must not be committed.

POS uses the official Tauri updater. Before producing a release, configure Tauri updater endpoints and the public signing key. LocalMaster distribution uses WinSW (or an equivalent signed Windows service host), a bundled Node runtime, the built service, the built Staff assets and ProgramData-backed SQLite. The production installer must add backup-before-migration, post-restart health verification and rollback.

## Release gates

- Sign Windows installer and Tauri artifacts.
- Validate `stable` and `beta` manifests independently.
- Upgrade LocalMaster before incompatible clients.
- Do not install during open payments, open orders, recovery jobs or migrations.
- Back up SQLite and verify `/health` after restart.
- Roll back binaries if identity, migration or database checks fail.
