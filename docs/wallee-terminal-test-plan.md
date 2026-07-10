# Wallee terminal test plan

Stand: 2026-07-10

This matrix turns the scenarios from `deep-research-report.md` and `wallee-terminal-review.md` into executable gates. Test doubles are permitted only in test files. Runtime bundles must never import them.

## Automated repository gates

Run from the repository root:

```powershell
npm test
npm run build:master
npm run build:relay-sync
npm run build:pos
npm run build:platform-admin
npm run build:staff
```

`services/localMaster/src/__tests__/walleePayment.integration.test.ts` starts test-only HTTP contract servers and verifies:

- API V2 create, explicit confirm, terminal perform, transaction read and terminal receipts.
- JWT request authentication and the `Space` header on every provider request.
- HTTP 543 continuation with the same provider transaction and terminal parameters.
- bounded HTTP 542 retry, HTTP 409 read recovery and fail-fast HTTP 442 behavior.
- pending and undocumented provider states becoming `reconciliation_required`, never success.
- test-acquirer decline patterns 101, 102, 109, 128 and 130 without order snapshot, sales ledger or completed payment.
- request replay and conflicting payload handling without a duplicate provider transaction.
- official V2 refund resource, minor-to-major amount conversion and stable refund `externalId`.
- receipt Base64/MIME validation and durable receipt-recovery jobs.
- encrypted local credentials, stale/foreign/checksum-mismatched configuration, rejected terminal updates and atomic disable.
- successful payments after Relay shutdown.
- immutable local order snapshots and idempotent sales/payment ledger entries.

`services/localMaster/src/__tests__/localMaster.integration.test.ts` remains the broad local regression suite for cash, orders, ledger, storno, printing, day close, layout, Relay commands and offline reads. Relay tests verify scoped configuration delivery, removal of payment execution, raw-body ECDSA verification, event deduplication and webhook hints.

## Wallee staging contract gate

Run against an isolated Wallee test space and dedicated PAX A920 Pro. Never run these cases in a production space.

Required environment:

- `LOCAL_MASTER_WALLEE_ENCRYPTION_KEY`
- a Relay profile scoped to one test tenant/location/LocalMaster instance
- Wallee Space ID, Application User ID and Authentication Key with the minimum required permissions
- one unambiguous active default terminal with recorded internal ID, displayed identifier/TID and serial number

Execute and retain provider transaction IDs, LocalMaster attempt IDs and timestamps for:

1. CHF 5.00 Create -> Confirm -> Perform -> Read -> Receipt.
2. Declines 101, 102, 109, 128 and 130.
3. Every documented test-acquirer family used by the tenant in 1xx, 11xx and 21xx.
4. interruption after Create, after Confirm and after authorization; restart LocalMaster and reconcile by transaction read.
5. Relay unavailable before and during payment while Wallee remains reachable.
6. Wallee unreachable while Relay remains reachable; verify Relay cannot execute or simulate a payment.
7. full refund, partial refund with line allocation, void before completion and deferred completion.
8. customer/merchant receipts, provider `printed=true` and `printed=false`, PDF/TXT rendering and printer retry.
9. webhook before long-poll response, after local completion, duplicate event, delayed event and LocalMaster offline.

For every non-success case assert: no paid order, no sales ledger entry, no `PAYMENT_COMPLETED` outbox event and no receipt print job. For provider success followed by a forced local persistence fault, assert a durable recovery/reversal record before returning control to POS.

## PAX A920 Pro operational gate

Record terminal serial number, Wallee internal ID and displayed identifier before testing:

- WLAN, SIM/APN, WLAN-to-SIM and SIM-to-WLAN transitions.
- temporary internet loss and terminal restart during perform.
- LocalMaster restart during long polling.
- information receipt and serial-number reconciliation.
- receipt printing enabled and disabled.
- final balance trigger, transaction summary read and rendered summary receipt.
- PayDroid/support log collection with EasyTable attempt and Wallee transaction correlation.

## Release evidence

A release candidate is accepted only when repository gates are green and staging/hardware evidence is attached to the release. Hardware and live Wallee staging cases cannot be represented as passing solely by local contract tests.
