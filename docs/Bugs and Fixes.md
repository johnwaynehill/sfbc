# Bugs and Fixes
I tested the book club app with about 22 people tonight and one of the biggest book club meetings we have had. It worked incredibly well. A few things came up to fix.

## Bugs
1. Drag and Sort stacked ranking did not work for everyone, the entire card for the nomination shoudl be dragable
  2. Make this more obvious
3. Light Mode did not work on Android phones running the Samsung browser
4. Show/Hide Review in /admin/reviews did not work. The button changes state, but the review is not actually hidden.
5. Opening Nominations and/or Voting for the next meeting/month might have changed the Status of other books.
  6. Only ever change the status of the current book / meeting
  7. Page Count should not be displayed in Hero section (currently reading) on Home
8. Selected book in Dark Mode on /admin/meetings is not readable
  9. Vertically stack the information

## Updates
1. If a Nomation does not have an associated user, hide the "nomation" text in the Admin view
2. In the Admin View, add the ability to Edit a Nomination
  3. This can help fix spelling errors 
4. Admin view should also show the "why this book" rationale
5. Create a Placeholder image for book covers
6. Add SF Library link, and Libby app deep link, to Book Details so users can directly check out an upcoming book
7. If not logged in, show a button in the Reviews section of Book Details with information that a user needs to be logged in to leave a review
8. Dark Mode status tags could have more contrast for readability
9. Hide emails on /admin/users for privacy
10. Update Icon for Members in stats section of About page
11. Results page showed different color bar graphs for every user, make this standard
  12. Assign a color per book so that every users sees the same color
  13. *future idea* make the bar chart color based on the book cover
14. Nominations might start with a Search bar and then allow users to select from a list
  15. This would help prevent typos
  16. And would help ensure Book Covers are shown for every nomination
17. Recent Reads section
  18. Normalize the Book Title, Author, and 'reading month' to be horizontally aligned across all books
19. Coming Up section
  20. Enlargen the Book Covers and vertical space for each book

## Add to Roadmap
* Sort and Filter Reviews in Admin
* Sort and Filter Users in Admin
* Add ability to Promote a User to Admin from /admin/users
* Add link to Profile from /admin/users
* Better UX on Profile Settings page
* Ability to see Public Profile for yourself
* Add Members page to public view
  * Shows members info, stats, when the joined
  * Links to Member Profile
* Keep the Results for each vote active so that it is also an Archive of the past
* Make sure Past Nominations don't interfer with canonical urls for winners
