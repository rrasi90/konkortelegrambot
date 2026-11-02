# Telegram CloudStorage learner snapshot recovery — PR #8

**Scope:** React client backup/recovery only; not canonical store migration and not a production release.  
**PR:** https://github.com/rrasi90/konkortelegrambot/pull/8  
**Branch:** `fix/telegram-cloud-snapshot-20261102`

## Defect found

The React client previously wrote a compact mastery/statistics summary to Telegram CloudStorage but never read it back. Full `nodeStates`, `cards` and `stats` were read from browser LocalStorage only. Consequently, the stated cross-device learner recovery did not exist; card review scheduling was not present in the Telegram cloud summary.

## Implementation

- Local full snapshot uses `ael_tma_state_v4`; the previous local v3 full snapshot remains a read fallback.
- Telegram CloudStorage v4 persists the complete learner payload: `nodeStates`, `cards`, `stats`, `savedAt`.
- JSON is split into 3,000-character chunks, below Telegram's documented 4,096-character value ceiling.
- Two alternating slots are used. The manifest is committed only after every chunk is stored; a failed new write leaves the previously committed slot available.
- The manifest records version, slot, chunk count, saved timestamp, serialized length and FNV-1a checksum. The checksum is corruption detection, not cryptographic authentication.
- Chunks are restored with `getItems` where available, with bounded `getItem` fallback.
- Local and cloud full snapshots are compared by `savedAt`; the newest valid full snapshot is reconciled against current nodes/questions before UI interaction is enabled.
- Autosave remains disabled until async restore finishes; this avoids writing the initial zero-state over an existing cloud backup.
- Reset removes local full snapshots and invalidates the cloud manifest before the next snapshot is committed.
- Legacy v3 cloud summary recovery is partial by definition: it can restore only mastery summary and selected counters, not cards or FSRS schedule. The user is warned.
- Telegram clients without CloudStorage are explicitly shown as device-local-only. The web preview remains local-only by design.

## Storage bounds and official API contract

Telegram's Mini Apps documentation specifies up to 1,024 CloudStorage items per bot/user, key names of 1–128 permitted ASCII characters, and values up to 4,096 characters. This implementation caps each value at 3,000 characters and uses at most 240 chunks per slot plus one manifest (481 active application keys across the two slots, excluding the temporary legacy v3 key). See the official [Telegram Mini Apps CloudStorage reference](https://core.telegram.org/bots/webapps#cloudstorage).

## Automated verification

The PR CI run [41433872695](https://github.com/rrasi90/konkortelegrambot/actions/runs/41433872695) is the current verification record. The branch includes tests for:
- Full cloud restore after clearing browser LocalStorage.
- Failure during a new slot write preserving the prior committed snapshot.
- Unicode surrogate pair at the exact chunk boundary.
- Newer local snapshot winning over older cloud snapshot.
- Legacy v3 partial recovery and invalid coverage-label rejection.
- Oversized snapshot rejection without manifest commit.
- Telegram client without CloudStorage API.
- Zero-State manifest invalidation.

## Explicit limitations

- The React client still does not use Worker API/Supabase as its sole learner store. R-025 remains open; cloud backup is transitional, not architectural convergence.
- Mistake notebook is still LocalStorage-only and is not included in this snapshot.
- No real Telegram-host E2E or multi-device live-user trial has been run for this implementation.
- Snapshot limit is 720,000 UTF-16 code units (240 × 3,000). Larger snapshots remain local and report cloud backup failure.
- FNV-1a is not a cryptographic integrity/authenticity mechanism.
- Concurrent independent clients editing the same learner account are not protected by a server-side compare-and-swap protocol; last committed manifest wins.

**Release remains NO-GO / DEFER.**
