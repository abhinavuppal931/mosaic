# Investor spotlight (B6, approved 2026-11-19)

The investor detail in the Room. Picking one of the seven investor cards opens that investor's detail in place, under the cards, joined to the selected card by a caret. The verdict and the other cards stay on the page.

- `B6-Spotlight.dc.html` is the approved board, open at any width (`B6-Spotlight-Phone.dc.html` frames it at 390px). Image placeholders `{{v.img}}` 404 when it's opened outside the canvas; the faces are in `room/public/img`.
- The PNGs are renders of the board: Buffett and Burry open on desktop, the rounds at desktop width, closed, and the phone states (open, sticky header while scrolling, the round steps, closed).

The board shows the layout, type, colour and copy. These must-fixes came from the review and are part of the build, even though the board doesn't show them:

1. Switching investor scrolls the panel's top into view.
2. On desktop, Previous, Next and Close stay in view while you scroll the panel (sticky), as on phone.
3. Esc closes the panel. The left and right arrow keys move between investors. Opening moves focus to the panel heading, and closing returns it to the card.
4. Each investor has a URL (hash). Loading it opens the panel on that investor, and Back closes or steps it.
5. The summary compares against the council with dot rows: a solid dot for the final score, a hollow ring for round 1 joined by a line when he moved, and a grey council tick.
