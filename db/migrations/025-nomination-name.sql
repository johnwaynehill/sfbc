-- Allow non-signed-in nominators to attach their name
ALTER TABLE nominations ADD COLUMN nominator_name TEXT;
