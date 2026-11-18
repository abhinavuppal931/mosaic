# First run: example councils in the Room (ABH-338)

A short note for Abs. Nothing here changes the approved A v3 look. These are the visible differences, all using components that already exist, and one idea that was not built because it needs a design decision.

## What a new user now sees

- With no council of their own, the Room opens on the newest example council (Buy NVIDIA) in the normal verdict view, instead of "No council yet".
- The verdict crumb reads "Examples / <question>" instead of "Councils / <question>".
- The live view's status chip reads "Example", in the existing grey "Finished" style.
- Save to journal is hidden on examples (the same rule that already hides it when a council has no journal file).
- The journal page, when the user's journal is empty, keeps its empty-state card. The text now reads "Nothing saved yet. Until you run a council of your own with /mosaic, here are three finished ones to open." Below it, the three examples are listed as ordinary journal rows (ticker and company, decision, label and the option, date, "Open it"). Each row is a link; the only new style is an underline on the row title on hover and keyboard focus.
- As soon as the user's first council writes `council.json`, it replaces the example, with the existing toast style ("Your council has started.").

## Not built: a dedicated example picker

Roast Room lists its examples under "Past sessions" on the main screen. The Room's equivalent would be a small "Examples" or "Past councils" strip on the waiting screen or above the journal list, with a card per example. That is a new layout element, so it is left for Abs to approve or reject. The journal-row version above covers the same need with no new layout.
