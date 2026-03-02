-- Persist vote results as JSON when voting closes.
-- Avoids recalculating from individual votes on every page load
-- and preserves results even if vote rows are later cleaned up.
ALTER TABLE meetings ADD COLUMN vote_results_json TEXT;
