# GatherBound — Bugs

Field-reported bugs. Enhancements and feature work are tracked in [BACKLOG.md](BACKLOG.md).

---

## Open

- [ ] Samsung browser: Light Mode did not work on Android phones (P2)
## Fixed

- [x] Book could not be nominated — case-sensitive matching created duplicate book records, causing false "already read" rejections *(GAT-42, May 2026)*
- [x] Duplicate book accepted despite already being read — same root cause; case mismatch bypassed the already-read check *(GAT-43, May 2026)*
- [x] User count differs across pages — About showed 20, Admin showed 18, Members showed 19; unified to `COUNT(*) FROM users` *(GAT-44, May 2026)*
- [x] Error notification when voting after admin removes nominee — stale ballot validation rejected votes; now reconciled server-side *(GAT-45, May 2026)*
- [x] Same user could vote multiple times — vote dedup was cookie-fingerprint only, so logging in again from a private window cast a second vote (changed a prod winner). Now one vote per logged-in user (app check + DB partial unique index, migration 026); anonymous re-votes are surfaced to admins via per-meeting IP-hash clustering in the vote inspector *(GAT-46, May 2026)*
- [x] Email addresses with `+` symbols rejected on account creation — *fixed Sprint 11: normalizeEmail options preserve subaddress aliases*
- [x] Admin badge on Users page is black in Dark Mode — *fixed Sprint 5: `--amber` variable added to tokens.css*
- [x] Spoiler checkbox should be a toggle — *fixed Sprint 5: CSS-only restyle as toggle switch*
