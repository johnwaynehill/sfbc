-- Fix November 2025 meeting: admin overrode the vote result.
-- Neuromancer (id=49) won the vote but the club read
-- Victories Greater Than Death (id=3). Align meetings.winning_book_id
-- with monthly_picks.book_id.
UPDATE meetings
SET winning_book_id = 3,
    updated_at = datetime('now')
WHERE id = 3
  AND month_year = '2025-11'
  AND winning_book_id = 49;
