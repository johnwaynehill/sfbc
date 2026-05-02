# Analytics

How we instrument the app, what we capture, and how to add or change events. Pairs with [Tech-Specs.md](Tech-Specs.md) and [SHIPPED.md](SHIPPED.md).

---

## 1. Tools

| Tool | Purpose | Wired in | Fires when |
|---|---|---|---|
| **PostHog** | Product analytics — events, funnels, retention, dashboards | [`services/analytics.js`](../services/analytics.js) (server) + client snippet in all `views/layouts/*-shell.ejs` files | `NODE_ENV === 'production'` AND `POSTHOG_API_KEY` is set |
| **Sentry** | Error tracking + select warning alerts | [`server.js`](../server.js) `Sentry.init()`; `captureException` in global error handler; `captureMessage` for IP-backstop rate-limit trips | `SENTRY_DSN` is set |

**Both no-op cleanly without keys**, so dev environments don't pollute either system.

### Roles of each

- **PostHog** answers "what are users doing?" — every behavioral event lands here. Use it for trend analysis, funnel conversion, retention, and ad-hoc exploration.
- **Sentry** answers "what's broken?" — exceptions auto-capture; we additionally fire `captureMessage` for the IP backstop because that's a rare, high-signal event worth a real-time alert.

We deliberately **don't** double-write every event to Sentry to keep its signal-to-noise high.

---

## 2. Distinct ID Strategy

PostHog groups events into "persons" by `distinctId`. Funnels and retention only work when the same user produces events with matching IDs across steps. We use a consistent fallback chain everywhere on the server:

```
session.userId   →   fingerprint (HMAC of _client_id + meetingId)   →   _client_id cookie   →   'anonymous'
```

**Why this order:**
- **`session.userId`** is the strongest identity for logged-in members.
- **`fingerprint`** is HMAC-derived per `(clientId, meetingId)`. We use it for vote/nomination flows because it's already the per-meeting deduplication key in the DB. It's stable for the same browser within one meeting.
- **`_client_id` cookie** is the persistent (1-year) browser ID — used when no meeting context exists (e.g. `book_viewed`).
- **`'anonymous'`** is a last-resort literal. Avoid; it collapses every anonymous user into one person.

> ⚠️ **Funnel coherence rule:** the `meeting_viewed → vote_cast` funnel only works because both events use the **same** fallback chain. Mixing client-side `$pageview` (PostHog's auto-UUID) with server events keyed by `fingerprint` will break funnels.

PostHog client SDK is loaded in shell layouts but is **not** explicitly `identify()`d to user IDs today, so client-only events (autocapture pageviews/clicks) do not link to server events for anonymous visitors.

---

## 3. Event Catalog

All server-side events are sent via [`analytics.track(distinctId, event, properties)`](../services/analytics.js).

### Auth & Account

| Event | Source | Properties | Distinct ID |
|---|---|---|---|
| `account_created` | `routes/auth.js` (both magic-link and password paths) | `email`, `method`, `invited` | `user.id` |
| `magic_link_requested` | `routes/auth.js` POST `/auth/send-link` | `email` | `user.id` |
| `magic_link_consumed` | `routes/auth.js` GET `/auth/callback` (success) | `email` | `user.id` |
| `magic_link_failed` | GET `/auth/callback` (no/invalid token) | `reason: missing_token \| invalid_or_expired` | `'anonymous'` |
| `user_login` | both auth paths on success | `method: magic_link \| password` | `user.id` |
| `login_failed` | password path | `method`, `reason: missing_password \| password_too_short \| invalid_credentials`, `userExists`, `hasPasswordHash` | `email` (so brute-force clusters) |
| `invite_created` | `routes/api.js` admin invite create | `code` | `user.id` |
| `invite_redeemed` | both auth paths when session has stashed `inviteCode` | `code`, `method` | `user.id` |

### Meeting Lifecycle

| Event | Source | Properties | Distinct ID |
|---|---|---|---|
| `meeting_status_changed` | `routes/api.js` admin advance-status | `meetingId`, `from`, `to` | `user.id` (admin) |
| `meeting_viewed` | `routes/vote.js`, `nominate.js`, `nominations.js` | `kind: vote \| nominate \| nominations_live`, `meetingId`, `monthYear`, plus context-specific fields | userId → fingerprint |
| `nomination_created` | `routes/api.js` POST nominations | `meetingId`, `bookTitle` | userId → fingerprint |
| `nomination_rejected` | various rejection paths in nomination route | `reason: validation_failure \| invalid_meeting_id \| meeting_not_found \| not_nominating_status \| already_read`, plus context | userId → cookie → 'anonymous' |
| `vote_cast` | POST votes (success) | `meetingId` | userId → fingerprint |
| `vote_rejected` | various rejection paths in vote route | `reason: invalid_meeting_id \| meeting_not_found \| not_voting_status \| already_voted \| invalid_ranking_count \| invalid_book_ids` | userId → cookie → fingerprint |

### Books & Reviews

| Event | Source | Properties | Distinct ID |
|---|---|---|---|
| `book_viewed` | `routes/public.js` GET book detail | `bookId`, `title`, `author`, `monthYear`, `isClubPick` | userId → cookie → 'anonymous' |
| `book_search_no_results` | `routes/api.js` GET `/books/search` and `/books/search-multi` | `kind`, `q_length` / `titleLen` / `authorLen` | userId → cookie → 'anonymous' |
| `review_submitted` | POST review | `bookId`, `grade`, `hasSpoiler`, `didFinish` | `user.id` |
| `review_updated` | PUT review | same | `user.id` |
| `reaction_added` | reaction toggle (only fires when `result.active` true) | `reviewId`, `emoji` | `user.id` |
| `reply_created` | reply create | `reviewId` | `user.id` |
| `profile_updated` | profile field updates | `field: display_name \| username \| social_links` | `user.id` |

### Activation Milestones

Fire **exactly once per user**, alongside the regular event. Detected by counting prior occurrences in the DB. Only meaningful for logged-in users (anonymous actors have no stable identity across meetings).

| Event | Source | Detection |
|---|---|---|
| `first_review_submitted` | POST review | `count(*) FROM reviews WHERE user_id = ?` after insert == 1 |
| `first_nomination_created` | POST nomination | `count(*) FROM nominations WHERE user_id = ? AND meeting_id != current` == 0 (excludes re-noms in same meeting) |
| `first_vote_cast` | POST vote | `count(*) FROM votes WHERE user_id = ? AND meeting_id != current` == 0 |

### System & Health

| Event | Source | Properties | Distinct ID |
|---|---|---|---|
| `rate_limit_hit` | rate-limit handler in `routes/api.js` | `scope: device \| ip_backstop`, `endpoint`, `meeting_id`, `authenticated`, `limit_max`, `window_ms` | userId → cookie → 'anonymous' |

When `scope === 'ip_backstop'`, the same handler also fires `Sentry.captureMessage(... level: warning ...)` because hitting the per-IP cap is rare and indicates either a very large gathering or cookie-rotation abuse.

### Client-side (PostHog SDK autocapture)

The SDK loaded in shell layouts captures `$pageview`, `$autocapture` (clicks, form submits), `$rageclick`, and `$pageleave` automatically. These are useful for navigation analysis but **do not link to server-side events for anonymous users** (different distinct-id space — see §2).

---

## 4. Rate Limiting & Friction Telemetry

Two stacked rate limiters protect submission endpoints (`POST /api/meetings/:id/nominations`, `POST /api/meetings/:id/votes`):

| Limiter | Cap | Key | Purpose |
|---|---|---|---|
| `submissionLimiter` | 60 / 15 min | `session.userId → _client_id → IP subnet` | Per-device cap. Generous for normal use. |
| `submissionIpBackstop` | 500 / 15 min | IP subnet (`ipKeyGenerator`) | Catches cookie-rotation scripts. Above any realistic gathering (50 attendees × 10 actions each). |

Each 429 fires `rate_limit_hit` (see catalog). The IP backstop additionally pages Sentry.

**Why this matters:** the original "Too many submissions" production incident happened because the limiter was IP-keyed and 17 members shared the venue WiFi. With device keying, a single venue can sustain hundreds of legitimate submissions while still blocking abuse.

---

## 5. Dashboards

Both live in PostHog project `345495`.

### Engagement & Health (id `1534992`)
> [Open dashboard](https://us.posthog.com/project/345495/dashboard/1534992)

Catches friction & abuse:
- Rate-limit hits by scope
- Vote / nomination rejections by reason
- Login & magic-link failures by reason
- Daily active members (logins)
- Vote cast vs rejected, nomination created vs rejected
- Book search dead-ends

### Funnels & Growth (id `1534993`)
> [Open dashboard](https://us.posthog.com/project/345495/dashboard/1534993)

Conversion through core flows:
- Magic-link signup funnel (`magic_link_requested → magic_link_consumed → user_login`)
- Invite redemption (`invite_created → invite_redeemed → account_created`)
- Nomination flow (`meeting_viewed kind=nominate → nomination_created`)
- Voting flow (`meeting_viewed kind=vote → vote_cast`)
- Club pick → review (`book_viewed isClubPick=true → review_submitted`)
- Activation triad (`account_created → first_*`) with 30-day window
- New accounts per day, reviews per day, engagement on reviews

---

## 6. Adding a New Event

1. **Decide on the distinct ID strategy.** If the event is part of a funnel with another event, both must use the same fallback chain (see §2).
2. **Pick a name.** Snake_case verbs, past-tense for actions (`vote_cast`), present-tense for milestones (`first_review_submitted`). Reuse an existing event with a new property when possible.
3. **Call `analytics.track`:**
   ```js
   const analytics = require('../services/analytics');
   analytics.track(req.session?.userId || fingerprint, 'event_name', {
     // small, queryable scalars only — no large blobs
     meetingId,
     reason,
   });
   ```
4. **Add properties sparingly.** Each property becomes a column in PostHog and bloats event payloads. Typical event has 1–6 properties.
5. **Test locally.** `analytics.track` is a no-op in dev, so add a temporary `console.log` or check the PostHog Live Events tab in production after deploy.
6. **Document it here** in the catalog above.

### Patterns to follow

- **Rejection events** mirror their success counterpart (e.g. `vote_cast` ↔ `vote_rejected`) with a `reason` enum so both feed the same dashboard tile.
- **Activation milestones** fire alongside, not instead of, the regular event. Detection should be race-free (count after insert with a UNIQUE constraint, or count "other" rows that exclude the current row).
- **No PII in property values** beyond what we already store in the user record (email is fine — already in PostHog identify).

### Patterns to avoid

- ❌ Using `'anonymous'` as a fallback distinct ID — collapses every anonymous user into one person, breaks funnels.
- ❌ Tracking every keystroke (e.g. search-as-you-type). Use the friction signal only — `book_search_no_results` is fired ONLY when results are empty.
- ❌ Routing event names through user input. Hard-code event names; user data goes in properties.
- ❌ Calling `Sentry.captureMessage` for routine product events. Save Sentry for genuine alarms.

---

## 7. Querying & Verification

### Live tail (HogQL via PostHog UI)

The fastest sanity check: PostHog → **Activity** → **Live events**, filter by event name. Server events arrive within seconds of firing.

### Ad-hoc HogQL

Personal API key needs `query:read` scope. From the project root:

```bash
TOKEN=$(jq -r .token ~/.posthog/credentials.json)
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "https://us.posthog.com/api/projects/345495/query/" \
  -d '{"query":{"kind":"HogQLQuery","query":"SELECT event, count() AS n FROM events WHERE timestamp > now() - INTERVAL 1 DAY GROUP BY event ORDER BY n DESC"}}'
```

Or via CLI:
```bash
posthog-cli exp query run "SELECT event, count() FROM events WHERE timestamp > now() - INTERVAL 1 HOUR GROUP BY event"
```

### Programmatic dashboard / insight changes

API token needs `dashboard:write`, `insight:write`. Dashboard IDs are noted in §5; insight IDs are visible in the URL of each tile. Use `PATCH /api/projects/345495/insights/{id}/` to modify a tile's `query` field.

---

## 8. Known Limitations & Future Work

- **Client and server distinct IDs aren't linked** for anonymous visitors — autocapture pageviews can't be funneled with server events without a cookie-bridge or a `posthog.identify()` call on login.
- **`magic_link_failed` distinct ID is the literal string `'anonymous'`** because the failed lookup gives us no user. This is acceptable since the event is a counter, not a per-person funnel step.
- **Sentry sampling:** `tracesSampleRate: 0.1` — only 10% of transactions are traced. Errors are not sampled.
- **No client-side `posthog.identify()` on login** — would link client autocapture to server events for logged-in members. Worth adding if we need per-user pageview attribution.
