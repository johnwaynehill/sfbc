-- Add optional reason (pitch) and user identity to nominations
ALTER TABLE nominations ADD COLUMN reason TEXT;
ALTER TABLE nominations ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
