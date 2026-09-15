Drop your licensed Rules Gothic Condensed webfont files here using these
exact filenames (both woff2 and woff recommended, woff2 alone is fine
for modern browsers):

  RulesGothicCondensed-Regular.woff2   (weight 400)
  RulesGothicCondensed-Medium.woff2    (weight 500)
  RulesGothicCondensed-SemiBold.woff2  (weight 600)
  RulesGothicCondensed-Bold.woff2      (weight 700)
  RulesGothicCondensed-Black.woff2     (weight 900)

These are wired up in style.css via @font-face already — no other
change needed. Until these files are present, the site falls back to
Barlow Condensed automatically.

If your export uses different weight names (e.g. only Regular/Bold),
either rename the files to match above, or edit the @font-face block
at the top of style.css to match what you have.
