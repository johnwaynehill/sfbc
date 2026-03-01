# GatherBound - Bugs & Enhancements

## Home
- [x] Announcements need spacing above (between Nav and annoucement) (P1)
  - [x] Make the design more subtle; the placement alone makes it stand out enough
- [ ] Announcements should appear live and expire (SSE) without the user needing to refresh the browser (P2)
- [x] Annoucments do not seem to Expire (P0)

## Book Detail
- [x] Spoiler checkbox does  not hide/show reviews with spoilers (P0)
- [ ] Spoiler checkbox should be a toggle (P2)

## Voting
- [x] Randomize starting order of nominations (P1) — already implemented via seededShuffle

## Results
- [x] Increase size of Winning Book's Cover
  - ~~Remove the auto-dismiss~~ Done
  - ~~Add a close button~~ Done
- [x] Winner without a cover still showed in the full-screen dynamic experience; but this is okay. Let's keep this as is.


## Admin
### Annoucements
- [x] Date picker icon not visible in Dark Mode. Icon still shows as black (P0)
  - Same on other pages

------

## Not able to test
- [ ] Changelong only has one entry, so I unable to verify if collapse/show functionality works
- [x] Need to seed local database with Reviews, Reactions, and Users for full testing — `node db/seed-test-data.js`
- [x] No way to test 4H from PR #4 "Member profile reactions" as there isn't proper local data — seeded

## Enhancements 
- [ ] Create a Nominations page for users to see nominations as they come in live
  - This could just be a version of the Voting page without an ability to vote
- [ ] Create placeholder image for books that don't have covers
- [ ] Results pages should be persistant; they are part of the culture of the clubs
- [ ] Users should be able to see Who has left What Reaction to their review
  - Tap/click on a Reaction to see a list of Reactions and who all left that reaction. 
  - Similar to Discord

### Book Detail
- [ ] Grade distribution should be some kind of chart, not just stacked bar lines
