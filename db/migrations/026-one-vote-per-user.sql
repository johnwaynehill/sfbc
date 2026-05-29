-- Enforce one vote per logged-in user per meeting.
--
-- Dedup was previously only by submitted_fingerprint (HMAC of _client_id +
-- meeting_id), so a logged-in member could vote, open a private window (fresh
-- _client_id cookie → fresh fingerprint), log in again, and vote a second time.
-- The user_id has been stored on votes since migration 024 but never used for
-- dedup.
--
-- First remove any pre-existing duplicate user votes (keep each user's earliest
-- vote per meeting — lowest id preserves original intent), then add a partial
-- unique index. Anonymous votes (user_id IS NULL) are unaffected, and cached
-- results of finished meetings (vote_results_json) are not recomputed, so
-- historical displayed standings do not change.
DELETE FROM votes
WHERE user_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM votes
    WHERE user_id IS NOT NULL
    GROUP BY meeting_id, user_id
  );

CREATE UNIQUE INDEX idx_votes_user_meeting
  ON votes(meeting_id, user_id)
  WHERE user_id IS NOT NULL;
