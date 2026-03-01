#!/usr/bin/env node
'use strict';

/**
 * Seed test data: users, reviews, reactions.
 * Run: node db/seed-test-data.js
 * Idempotent — uses INSERT OR IGNORE so safe to re-run.
 */

const db = require('./index');
const { slugify } = require('../utils/slug');

// ---------------------------------------------------------------------------
// 1. Additional member users (varied names, avatar styles)
// ---------------------------------------------------------------------------
const MEMBERS = [
  { email: 'alice@example.com',   display_name: 'Alice Chen',      avatar_style: 'lorelei' },
  { email: 'bob@example.com',     display_name: 'Bob Martinez',    avatar_style: 'bottts' },
  { email: 'diana@example.com',   display_name: 'Diana Okafor',    avatar_style: 'fun-emoji' },
  { email: 'hank@example.com',    display_name: 'Hank Patel',      avatar_style: 'avataaars' },
  { email: 'iris@example.com',    display_name: 'Iris Tanaka',     avatar_style: 'micah' },
  { email: 'jake@example.com',    display_name: 'Jake Rivera',     avatar_style: 'thumbs' },
  { email: 'kara@example.com',    display_name: 'Kara Lindström',  avatar_style: 'personas' },
  { email: 'leo@example.com',     display_name: 'Leo Washington',  avatar_style: 'rings' },
  { email: 'maya@example.com',    display_name: 'Maya Singh',      avatar_style: 'shapes' },
  { email: 'nate@example.com',    display_name: 'Nate Kowalski',   avatar_style: 'notionists' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (email, display_name, role, avatar_style)
  VALUES (?, ?, 'member', ?)
`);

const updateSlug = db.prepare('UPDATE users SET user_slug = ? WHERE id = ? AND user_slug IS NULL');
const checkSlug  = db.prepare('SELECT 1 FROM users WHERE user_slug = ?');
const getUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?');

function ensureUsers() {
  let created = 0;
  for (const m of MEMBERS) {
    const info = insertUser.run(m.email, m.display_name, m.avatar_style);
    if (info.changes > 0) {
      created++;
      // Backfill slug
      const base = slugify(m.display_name) || 'member';
      let slug = base;
      let n = 2;
      while (checkSlug.get(slug)) slug = base + '-' + n++;
      updateSlug.run(slug, info.lastInsertRowid);
    }
  }
  console.log(`  [seed] Users: ${created} created, ${MEMBERS.length - created} already existed.`);
}

// ---------------------------------------------------------------------------
// 2. Reviews — spread across books and users with varied grades
// ---------------------------------------------------------------------------

// Use book IDs from completed meetings (results status)
// book_id → title mapping for reference:
//  1  The Long Way to a Small, Angry Planet
//  2  The Spear Cuts Through Water
//  3  Victories Greater Than Death
//  4  A Deadly Education
//  5  Children of Time
//  6  Red Rising
//  7  Dawn
//  8  Gideon the Ninth
//  9  The Murderbot Diaries 1-4
// 10  Jade City
// 12  Babel
// 13  Fifth Season
// 14  The Mountain in the Sea
// 53  Ubik

// Each entry: [book_id, user_email, grade, body_markdown, has_spoilers]
const REVIEWS = [
  // The Long Way to a Small, Angry Planet (book 1)
  [1, 'alice@example.com', 'A', 'Such a warm, cozy read. The found-family dynamics are *chef\'s kiss*. Rosemary\'s journey from sheltered bureaucrat to someone who truly belongs was beautifully done.', 0],
  [1, 'bob@example.com', 'B+', 'Loved the world-building and crew dynamics. Plot was a bit thin though — it felt more like a series of vignettes than a cohesive story. Still thoroughly enjoyed it.', 0],
  [1, 'diana@example.com', 'A-', 'Chambers does character work like nobody else. The Aeluon-Human culture clashes were fascinating. Would read ten more books set on this ship.', 0],
  [1, 'carol@example.com', 'B', 'Nice comfort read but I wanted more tension. The stakes never felt very high. Good palate cleanser between heavier reads though.', 0],

  // The Spear Cuts Through Water (book 2)
  [2, 'alice@example.com', 'A+', 'Absolutely stunning prose. The second-person narration was risky and it *paid off*. The mythology felt so lived-in and real.', 0],
  [2, 'hank@example.com', 'B-', 'The writing is gorgeous but the structure lost me more than once. I had to reread several passages to track what was happening. Ambitious but uneven.', 0],
  [2, 'iris@example.com', 'A', 'This book broke my brain in the best way. The way it weaves mythic storytelling with intimate character moments is masterful.', 0],
  [2, 'eve@example.com', 'B+', 'Beautiful but dense. The framing device with the theater was brilliant once I understood what was happening. Rewarding if you stick with it.', 0],

  // A Deadly Education (book 4)
  [4, 'bob@example.com', 'A+', 'El is one of the best protagonists in modern fantasy. The Scholomance is a horrifying, brilliantly realized setting. Couldn\'t put it down.', 0],
  [4, 'jake@example.com', 'A', 'Dark academia done right. The magic system is clever and the school-as-death-trap concept is executed perfectly. Novik is so good at voice.', 0],
  [4, 'kara@example.com', 'B+', 'Really fun but the info-dumps about the school\'s mechanics slowed things down in places. El\'s internal monologue is gold though.', 0],
  [4, 'maya@example.com', 'A-', 'The worldbuilding was wild — so many creative magical concepts. ||El\'s true power reveal at the end had me screaming.||', 1],
  [4, 'nate@example.com', 'B', 'Good premise, good execution. I liked it but didn\'t love it as much as everyone else seemed to. Maybe I\'m just tired of magical schools.', 0],

  // Children of Time (book 5)
  [5, 'alice@example.com', 'S', 'Genuinely one of the best sci-fi novels I\'ve ever read. The spider civilization chapters were riveting. Tchaikovsky made me *root for spiders*.', 0],
  [5, 'diana@example.com', 'A+', 'The parallel evolution storyline was brilliant. ||The final convergence of the human and Portiid storylines was so satisfying.||', 1],
  [5, 'frank@example.com', 'A-', 'Hard sci-fi at its finest. The generational spider POV was the standout. The human chapters dragged a bit by comparison.', 0],
  [5, 'leo@example.com', 'B+', 'Fascinating concept and impressive in scope. The spider chapters were great but the human side felt like it was just marking time.', 0],

  // Red Rising (book 6)
  [6, 'bob@example.com', 'A-', 'Pure adrenaline. The Hunger Games comparisons are fair but this goes way harder. Darrow\'s transformation was visceral.', 0],
  [6, 'jake@example.com', 'A', 'Space opera meets Roman Empire meets gladiator fiction. It shouldn\'t work but it absolutely does. Pierce Brown writes incredible action.', 0],
  [6, 'grace@example.com', 'B', 'Fun page-turner but some of the twists were predictable. The color-coded caste system was interesting worldbuilding though.', 0],
  [6, 'nate@example.com', 'B+', 'Bloodydamn fantastic. The Institute section was the highlight. ||Eo\'s death as motivation felt a bit fridgey but the story overcame it.||', 1],

  // Dawn (book 7)
  [7, 'iris@example.com', 'A+', 'Octavia Butler at her best — uncomfortable, thought-provoking, deeply humane. The Oankali are one of the most unsettling alien races in fiction.', 0],
  [7, 'alice@example.com', 'A', 'This book made me deeply uncomfortable and I think that\'s the point. The questions about consent and identity are haunting.', 0],
  [7, 'kara@example.com', 'A-', 'Slow burn but incredibly rewarding. Butler refuses to give easy answers about what it means to survive at a cost.', 0],
  [7, 'hank@example.com', 'B', 'Philosophically rich but the pacing tested my patience. The ideas are brilliant; I just wished it moved a bit faster.', 0],

  // Gideon the Ninth (book 8)
  [8, 'maya@example.com', 'S', 'Lesbian necromancers in space. Need I say more? Gideon\'s voice is ICONIC. Muir created something truly unique and unhinged and I am HERE for it.', 0],
  [8, 'diana@example.com', 'A', 'The humor was a delight, the mystery kept me guessing, and the worldbuilding is *bonkers* in the best way. ||That ending with Gideon\'s sacrifice destroyed me.||', 1],
  [8, 'leo@example.com', 'A-', 'Took me a bit to get into Gideon\'s voice but once it clicked, I was all in. The locked-room mystery structure was clever.', 0],
  [8, 'bob@example.com', 'B+', 'Wild ride. The necromancy system was creative and Gideon\'s snark carried the slower investigation chapters. Looking forward to Harrow.', 0],

  // Murderbot Diaries (book 9)
  [9, 'alice@example.com', 'A+', 'Murderbot is my spirit animal. The combination of social anxiety and competence is so relatable. Wells nails the voice perfectly.', 0],
  [9, 'frank@example.com', 'A', 'Quick, fun, and surprisingly emotional. The way Murderbot navigates having feelings it doesn\'t want is both funny and poignant.', 0],
  [9, 'jake@example.com', 'A-', 'Perfect pacing for novellas. Each one builds on the last really well. The found-family theme sneaks up on you.', 0],
  [9, 'eve@example.com', 'A', 'Binged all four in a weekend. Murderbot\'s character development across the series is subtle and wonderful.', 0],

  // Babel (book 12)
  [12, 'kara@example.com', 'A+', 'R.F. Kuang wrote an angry, gorgeous book about colonialism, translation, and betrayal. The silver-working magic system is a stunning metaphor.', 0],
  [12, 'iris@example.com', 'A', 'Dense, academic, and devastating. ||Robin\'s arc from grateful outsider to revolutionary felt inevitable and heartbreaking.||', 1],
  [12, 'grace@example.com', 'B+', 'Beautifully written and thought-provoking, but the pacing in the first half was slow. The payoff in the second half was worth it though.', 0],
  [12, 'nate@example.com', 'A-', 'Kuang doesn\'t pull punches. The way she uses the etymology/translation magic to talk about cultural erasure is brilliant.', 0],

  // Fifth Season (book 13)
  [13, 'maya@example.com', 'A+', 'The second-person sections threw me at first, then I realized how essential they were. ||When the three timelines converge as one person — jaw on the floor.||', 1],
  [13, 'leo@example.com', 'A', 'Jemisin earned every bit of that Hugo. The worldbuilding is brutal and beautiful. The orogeny system feels genuinely dangerous.', 0],
  [13, 'hank@example.com', 'A-', 'Dark, ambitious, and structurally inventive. The apocalyptic setting felt refreshingly non-Western in its influences.', 0],
  [13, 'alice@example.com', 'B+', 'Impressive craft but the bleakness wore me down. I respect it more than I enjoyed it, if that makes sense.', 0],

  // Ubik (book 53)
  [53, 'diana@example.com', 'A-', 'Classic PKD weirdness at its best. The reality-warping gets genuinely disorienting in the best way. Written in 1969 and still feels fresh.', 0],
  [53, 'bob@example.com', 'B+', 'Trippy and thought-provoking. The degradation of reality was creepy. Short enough that the wild premise doesn\'t overstay its welcome.', 0],
  [53, 'jake@example.com', 'B', 'Interesting ideas but PKD\'s prose style isn\'t for me. The concepts are more memorable than the characters.', 0],
  [53, 'kara@example.com', 'A', 'The paranoia is palpable. Every time you think you understand what\'s real, the rug gets pulled. Masterful unreliable reality.', 0],

  // Jade City (book 10)
  [10, 'frank@example.com', 'A+', 'Godfather meets wuxia meets urban fantasy. The Kaul family dynamics are riveting. Hilo is one of the most compelling anti-heroes I\'ve read.', 0],
  [10, 'maya@example.com', 'A', 'The jade magic system is so well-integrated into the culture and politics. ||Lan\'s death was devastating and changed the entire trajectory of the story.||', 1],
  [10, 'nate@example.com', 'A-', 'Fonda Lee writes fight scenes that jump off the page. The clan politics were dense but rewarding once you get invested.', 0],
  [10, 'grace@example.com', 'B+', 'Slow start but once the clan war escalates, it\'s unputdownable. The Kekonese culture felt lived-in and authentic.', 0],

  // The Mountain in the Sea (book 14)
  [14, 'leo@example.com', 'A', 'A quiet, cerebral sci-fi novel about consciousness and communication. The octopus chapters were mesmerizing.', 0],
  [14, 'iris@example.com', 'A-', 'Nayler asks big questions about intelligence and doesn\'t rush to answer them. The parallel AI/octopus storylines mirror each other beautifully.', 0],
  [14, 'eve@example.com', 'B+', 'Thoughtful and restrained where other sci-fi would go loud. Not action-packed but intellectually satisfying.', 0],
  [14, 'hank@example.com', 'B', 'Good ideas, slightly uneven execution. The Ha Noi setting was refreshing. Some of the philosophy felt more like essays than fiction.', 0],
];

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (book_id, user_id, grade, body_markdown, has_spoilers)
  VALUES (?, ?, ?, ?, ?)
`);

function seedReviews() {
  // Build email → id map
  const userMap = {};
  for (const m of [...MEMBERS, { email: 'carol@example.com' }, { email: 'eve@example.com' }, { email: 'frank@example.com' }, { email: 'grace@example.com' }]) {
    const row = getUserByEmail.get(m.email);
    if (row) userMap[m.email] = row.id;
  }

  let created = 0;
  for (const [bookId, email, grade, body, spoilers] of REVIEWS) {
    const userId = userMap[email];
    if (!userId) {
      console.log(`  [seed] Skipping review — user not found: ${email}`);
      continue;
    }
    const info = insertReview.run(bookId, userId, grade, body, spoilers);
    if (info.changes > 0) created++;
  }
  console.log(`  [seed] Reviews: ${created} created, ${REVIEWS.length - created} already existed.`);
}

// ---------------------------------------------------------------------------
// 3. Emoji reactions — scattered across reviews
// ---------------------------------------------------------------------------

// [review_book_id, review_user_email, reactor_email, emoji]
// We'll look up the review by (book_id, user_id) then insert the reaction
const REACTIONS = [
  // Reactions to Alice's reviews
  [1, 'alice@example.com', 'bob@example.com', '👍'],
  [1, 'alice@example.com', 'diana@example.com', '❤️'],
  [5, 'alice@example.com', 'frank@example.com', '🔥'],
  [5, 'alice@example.com', 'iris@example.com', '💯'],
  [5, 'alice@example.com', 'bob@example.com', '🔥'],
  [7, 'alice@example.com', 'kara@example.com', '💡'],

  // Reactions to Bob's reviews
  [4, 'bob@example.com', 'alice@example.com', '👏'],
  [4, 'bob@example.com', 'jake@example.com', '🙌'],
  [6, 'bob@example.com', 'nate@example.com', '⚔️'],
  [53, 'bob@example.com', 'kara@example.com', '🤯'],

  // Reactions to Maya's S-grade Gideon review
  [8, 'maya@example.com', 'alice@example.com', '😂'],
  [8, 'maya@example.com', 'diana@example.com', '❤️'],
  [8, 'maya@example.com', 'bob@example.com', '💀'],
  [8, 'maya@example.com', 'iris@example.com', '🔥'],
  [8, 'maya@example.com', 'jake@example.com', '👏'],
  [8, 'maya@example.com', 'leo@example.com', '😂'],

  // Reactions to Diana's reviews
  [5, 'diana@example.com', 'alice@example.com', '👍'],
  [8, 'diana@example.com', 'maya@example.com', '😭'],
  [53, 'diana@example.com', 'leo@example.com', '🤔'],

  // Reactions to Iris's reviews
  [7, 'iris@example.com', 'alice@example.com', '❤️'],
  [7, 'iris@example.com', 'hank@example.com', '👍'],
  [12, 'iris@example.com', 'kara@example.com', '😭'],
  [14, 'iris@example.com', 'leo@example.com', '🧠'],

  // Reactions to Kara's reviews
  [12, 'kara@example.com', 'iris@example.com', '🔥'],
  [12, 'kara@example.com', 'maya@example.com', '❤️'],
  [12, 'kara@example.com', 'nate@example.com', '👏'],
  [53, 'kara@example.com', 'bob@example.com', '💯'],

  // Reactions to Frank's Jade City review
  [10, 'frank@example.com', 'maya@example.com', '🔥'],
  [10, 'frank@example.com', 'nate@example.com', '⚔️'],
  [10, 'frank@example.com', 'grace@example.com', '👍'],

  // Reactions to spoiler reviews (people react with 🫣)
  [4, 'maya@example.com', 'bob@example.com', '🫣'],
  [6, 'nate@example.com', 'jake@example.com', '🫣'],
  [10, 'maya@example.com', 'frank@example.com', '😭'],

  // Reactions to Leo's reviews
  [13, 'leo@example.com', 'maya@example.com', '👍'],
  [13, 'leo@example.com', 'hank@example.com', '🙌'],
  [14, 'leo@example.com', 'iris@example.com', '❤️'],

  // More scattered reactions for variety
  [1, 'bob@example.com', 'carol@example.com', '👍'],
  [9, 'alice@example.com', 'eve@example.com', '❤️'],
  [9, 'alice@example.com', 'frank@example.com', '🤖'],
  [9, 'frank@example.com', 'alice@example.com', '🤖'],
  [13, 'maya@example.com', 'leo@example.com', '🔥'],
  [13, 'maya@example.com', 'hank@example.com', '🤯'],
];

const getReviewId = db.prepare('SELECT id FROM reviews WHERE book_id = ? AND user_id = ?');
const insertReaction = db.prepare(`
  INSERT OR IGNORE INTO review_reactions (review_id, user_id, emoji)
  VALUES (?, ?, ?)
`);

function seedReactions() {
  const userMap = {};
  const allEmails = new Set(REACTIONS.flatMap(([, reviewerEmail, reactorEmail]) => [reviewerEmail, reactorEmail]));
  for (const email of allEmails) {
    const row = getUserByEmail.get(email);
    if (row) userMap[email] = row.id;
  }

  let created = 0;
  let skipped = 0;
  for (const [bookId, reviewerEmail, reactorEmail, emoji] of REACTIONS) {
    const reviewerId = userMap[reviewerEmail];
    const reactorId = userMap[reactorEmail];
    if (!reviewerId || !reactorId) { skipped++; continue; }

    const review = getReviewId.get(bookId, reviewerId);
    if (!review) { skipped++; continue; }

    const info = insertReaction.run(review.id, reactorId, emoji);
    if (info.changes > 0) created++;
  }
  console.log(`  [seed] Reactions: ${created} created, ${skipped} skipped (missing user/review).`);
}

// ---------------------------------------------------------------------------
// Run everything in a transaction
// ---------------------------------------------------------------------------
db.transaction(() => {
  console.log('\n  Seeding test data...\n');
  ensureUsers();
  seedReviews();
  seedReactions();
  console.log('\n  Done!\n');
})();

process.exit(0);
