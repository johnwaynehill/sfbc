-- Fix September 2025: Red Rising (book_id=6) was erroneously included
-- in the vote results despite being the August 2025 pick. This was a
-- Strawpoll import error. Remove it from vote_results_json and correct
-- meetings.winning_book_id to Children of Time (book_id=5), which
-- matches monthly_picks.

UPDATE meetings
SET winning_book_id = 5,
    vote_results_json = '{"rankings":[{"book_id":5,"title":"Children of Time","author":"Adrian Tchaikovsky","cover_url":"/img/covers/adrian-tchaikovsky_children-of-time.jpg","author_slug":"adrian-tchaikovsky","title_slug":"children-of-time","points":46,"rank":1,"pct":100,"nominator_name":null},{"book_id":131,"title":"August Kitko and the Mechas from Space","author":"Alex White","cover_url":null,"author_slug":"alex-white","title_slug":"august-kitko-and-the-mechas-from-space-2","points":35,"rank":2,"pct":76,"nominator_name":null},{"book_id":132,"title":"Chain Gang All Stars","author":"Nana Kwame Adjei-Brenyah","cover_url":null,"author_slug":"nana-kwame-adjei-brenyah","title_slug":"chain-gang-all-stars","points":29,"rank":3,"pct":63,"nominator_name":null},{"book_id":130,"title":"Spinning Silver","author":"Naomi Novik","cover_url":null,"author_slug":"naomi-novik","title_slug":"spinning-silver","points":21,"rank":4,"pct":46,"nominator_name":null},{"book_id":99,"title":"Blood Over Bright Haven","author":"M. L. Wang","cover_url":null,"author_slug":"m-l-wang","title_slug":"blood-over-bright-haven","points":17,"rank":5,"pct":37,"nominator_name":null}],"voteCount":13,"maxPoints":46}',
    updated_at = datetime('now')
WHERE id = 5
  AND month_year = '2025-09';

UPDATE monthly_picks
SET vote_results_json = '{"rankings":[{"book_id":5,"title":"Children of Time","author":"Adrian Tchaikovsky","cover_url":"/img/covers/adrian-tchaikovsky_children-of-time.jpg","author_slug":"adrian-tchaikovsky","title_slug":"children-of-time","points":46,"rank":1,"pct":100,"nominator_name":null},{"book_id":131,"title":"August Kitko and the Mechas from Space","author":"Alex White","cover_url":null,"author_slug":"alex-white","title_slug":"august-kitko-and-the-mechas-from-space-2","points":35,"rank":2,"pct":76,"nominator_name":null},{"book_id":132,"title":"Chain Gang All Stars","author":"Nana Kwame Adjei-Brenyah","cover_url":null,"author_slug":"nana-kwame-adjei-brenyah","title_slug":"chain-gang-all-stars","points":29,"rank":3,"pct":63,"nominator_name":null},{"book_id":130,"title":"Spinning Silver","author":"Naomi Novik","cover_url":null,"author_slug":"naomi-novik","title_slug":"spinning-silver","points":21,"rank":4,"pct":46,"nominator_name":null},{"book_id":99,"title":"Blood Over Bright Haven","author":"M. L. Wang","cover_url":null,"author_slug":"m-l-wang","title_slug":"blood-over-bright-haven","points":17,"rank":5,"pct":37,"nominator_name":null}],"voteCount":13,"maxPoints":46}',
    updated_at = datetime('now')
WHERE id = 5
  AND month_year = '2025-09';
