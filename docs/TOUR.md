# A tour of Mosaic

What a council looks like, from install to a verdict you can share. Every screen below was captured from the real Room, using the three example councils that ship in `room/examples/`. To capture them again, run `npm run tour --prefix room` inside the clone.

![A council playing live in the Room: Howard Marks, Michael Burry and Nassim Taleb take turns on whether to sell some of a Costco position, then the verdict appears: Conviction earned](hero-loop.gif)

The same recording as a video: [hero-loop.mp4](hero-loop.mp4).

## 1. Install

From any folder, in a terminal:

```bash
claude plugin install mosaic --marketplace abhinavuppal931/mosaic
```

Then start Claude Code with `claude` and type `/mosaic`. The README's [quick start](../README.md#quick-start) also covers installing from a git clone and installing from inside Claude Code.

## 2. First run

`/mosaic` checks Node, your Mosaic home and the SEC contact. Then it opens the Room and asks for your decision. Until you have a council of your own, the Room shows a finished example, so there is something to look at straight away.

![The Room on first run, showing the finished NVIDIA example verdict](tour/01-first-run.webp)

The journal page lists all three examples: a buy (NVIDIA), a sell (Costco) and a sizing decision (Microsoft). Your first council replaces the example as soon as it starts.

![The journal page offering the three example councils](tour/02-examples.webp)

## 3. Round 1, blind

You describe the decision in plain words, for example `/mosaic I plan to sell some of my Costco position after a 60% year`. The Chair builds one sourced fact sheet. Then every seat answers at the same time, without knowing which way you lean.

![Round 1 on the Costco decision: Nassim Taleb gives his opening view from the evidence alone](tour/04-round-1.webp)

## 4. The debate

In Round 2 the Chair reveals your lean, and the seats answer each other's strongest point. The speaker is lit, and each fact chip under a line shows the number it cites from the fact sheet; hover to see its source. "The mosaic so far" updates as scores move.

![Round 2: Michael Burry answers Warren Buffett while the score grid updates](tour/03-live-debate.webp)

## 5. The verdict

After Round 3, the Chair returns a graded verdict. It shows what the council would do, how close the vote was, how strong the evidence is, how split the seats were, and how far your lean pulled the scores. Each seat's vote is derived from its own scores.

![The verdict on the Costco decision: Conviction earned, sell about a third, with the council score, evidence, agreement and bias check](tour/05-verdict.webp)

The full page adds the scorecard, the strongest objection, how this could go wrong (the pre-mortem), what would change the call (the kill criteria) and the next check-in date. [See the whole page](tour/06-verdict-full.webp).

![The per-seat scorecard: every seat's score for every option, and whether it agrees](tour/07-scorecard.webp)

## 6. The journal and rechecks

Save a verdict and it joins your journal, with its next check-in date.

![The journal with a saved NVIDIA thesis and its next check-in](tour/08-journal.webp)

When results or news arrive, `/mosaic recheck COST` runs a quick council on what changed since the last fact sheet, tripped kill criteria first.

![The recheck banner on a verdict, with the /mosaic recheck COST command](tour/09-recheck.webp)

## 7. Share it

Share downloads a 1200 by 630 card of the verdict and copies a short text summary to your clipboard.

![The share card: the verdict label, the council's call and the seats' votes](tour/10-share-card.webp)

Download PDF prints the verdict with a print layout made for paper.

![The verdict as a printed A4 page](tour/11-pdf.webp)

## 8. On a phone

The Room works at phone width too: the live debate on the left, and the verdict on the right.

<p>
  <img src="tour/12-phone.webp" alt="The live debate on a phone" width="300">
  <img src="tour/12b-phone-verdict.webp" alt="The verdict on a phone" width="300">
</p>

---

Mosaic grades how a decision was made. It is not investment advice. The seats are simulations built from public work. They are not the people and do not speak for them.

Back to the [README](../README.md). Mosaic is made by Abhinav Uppal; more of his work is on [his website][site].

[site]: https://abhinav-uppal-website.vercel.app
