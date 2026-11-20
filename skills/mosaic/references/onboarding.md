# Onboarding: a few questions, once

The first time someone uses Mosaic, learn just enough to make every later council fit them, without slowing them down. One question batch, about twenty seconds, every question skippable, and nothing asked that a council would not use. The answers live in `<home>/profile.json` and survive plugin updates. Nothing personal goes in it: no name, no email, no holdings, no money amounts.

## When it runs

The first-run check (`setup --status`) prints a `Your preferences` line:

- `NEW` means there is no profile yet, or it could not be read. Run onboarding as below.
- `ok` means there is a profile. Read `<home>/profile.json` and apply it (see "Using the profile"). Never ask these questions again unless the user types `/mosaic profile`.

How onboarding runs depends on what the user typed:

| The user typed | What to do |
|---|---|
| `/mosaic` with nothing else | Start the Room, say one welcome line, then ask the **onboarding batch**. Then the follow-up, if one is needed. Then ask for their first decision. |
| `/mosaic <a decision or question>` | Do not hold up their council with a separate batch. Run the usual intake batch (`intake.md`), and if it has a free slot (it allows four questions), add the **Experience** question. After intake, save a profile from what you learned. |
| `/mosaic profile` | Show the current preferences in a short table, then ask the onboarding batch again with their current answers listed first. Save it. No council. |

The welcome line, before the batch: "Welcome to Mosaic. Four quick questions so the council fits how you invest. Skip any you like." Say nothing else first: no list of features and no explanation of the Room (it is already open on an example).

## The onboarding batch

One AskUserQuestion call with these four questions, in this order. Use these headers and options exactly. Each option's description is one short line saying what it changes.

1. **Experience** (header "Experience"): "How would you describe your investing experience? It sets how much the council explains."
   - "New to investing": plain words, every term explained, a short guide to reading the verdict.
   - "Some experience": the standard summary.
   - "Experienced": terser, with the score math and spread shown.
2. **What for** (header "Use it for", multiSelect): "What would you like the council's help with? Pick any."
   - "Buy or sell a stock"
   - "Stress-test a thesis"
   - "Check my portfolio's risk"
   - "Big-picture market questions"
3. **Horizon** (header "Horizon"): "How long do you usually hold an investment? It becomes the default, so you are not asked every time."
   - "Under a year", "One to three years", "Three to five years", "Five years or more". If they type something else, such as "it depends", save `"ask"`.
4. **Council size** (header "Council"): "How big should a council be by default?"
   - "Full council (Recommended)": seven investors, three rounds, the most thorough. Uses more of your Claude plan.
   - "Quick council": four investors, usually two rounds. Faster and lighter.
   - "Ask me each time"

If AskUserQuestion is not available (another agent, or a host without the tool), ask the same four questions in one message as a numbered list with lettered options, and accept short replies such as "1b, 2a and 2c, 3d, 4a". A blank or skipped answer takes the default.

## The follow-up (only when it is needed)

Ask nothing more unless one of these applies, and then only in one line of chat:

- **SEC contact.** If they picked anything other than only "Big-picture market questions", and the first-run check said the SEC contact is not set, ask: "One more thing, for company filings: the SEC asks every client to identify itself. What name and email should Mosaic send to sec.gov? Say skip to do it later." Write it as `{ "providers": { "sec-edgar": { "contact": "<name> <email>" } } }` into `<home>/mosaic.config.json` with your file tools, merged with what is there. Never repeat it back and never put it on a command line. If they skip, go on: a council then shows filings as missing, and Step 0 asks again before the first stock council.
- **Portfolio.** If they picked "Check my portfolio's risk", add one line to the first-decision prompt below: "For a portfolio check, paste your holdings as tickers with rough percentages, for example MSFT 20%, AAPL 15%. No dollar amounts needed."

## Save the profile

Write `<home>/profile.json` with your file tools:

```json
{
  "schema": "mosaic.profile/1",
  "created": "YYYY-MM-DD",
  "experience": "new | some | pro",
  "focus": ["decision", "stress_test", "portfolio", "macro"],
  "horizon": "under-1y | 1-3y | 3-5y | 5y-plus | ask",
  "mode": "full | quick | ask",
  "board": "auto"
}
```

- `focus` lists what they picked, in the order of the options above. Leave it empty if they skipped the question.
- `board`: write `"auto"` only for "New to investing", so a new user is never asked to choose between investors they do not know yet. The council recommends a board and says who and why in one line. Otherwise leave `board` out, so the roster's setting applies.
- A skipped question takes its default: experience `some`, horizon `ask`, mode `full`.
- When onboarding came from the intake batch, use the answers you have (the horizon they gave for this decision, the council size this run used), and defaults for the rest.

Then confirm in one line, in plain words, and say how to change it. For example: "Saved: some experience, three to five years, full councils. Type /mosaic profile any time to change it."

## The first decision

Ask for it in one line, with one example that matches what they picked (use the first of their `focus` values):

| Focus | Example |
|---|---|
| decision, or nothing picked | "For example: I'm thinking of buying Costco and holding it for five years." |
| stress_test | "For example: My thesis is that Microsoft's cloud growth keeps paying for its data center spending. Poke holes in it." |
| portfolio | "For example: Here are my holdings, MSFT 20%, AAPL 15%, NVDA 10%. What could hurt me?" |
| macro | "For example: Will interest rates fall next year, and should I lock in bond yields now?" |

For "New to investing", add: "Plain words are fine. You don't need any numbers."

## Using the profile (every council)

Read `<home>/profile.json` once, after the first-run check. What the user says in this run always wins over the profile.

- **Horizon**: unless it is `ask`, put it in the brief as the horizon, marked `(from your profile)`, and do not ask for it in the intake batch. A horizon the user states in their request replaces it.
- **Council size**: with no `--quick`, `--seats` or `--all` on the run, `quick` runs a quick council and `full` a full one. `ask` adds a "Council" question to the intake batch (Full council (Recommended), Quick council).
- **Board**: `board` in the profile, when set, is used in place of the roster's `"board"` setting (`seats.md`, Step 3).
- **Focus**: when a request could be two jobs (`intake.md`, section 1), prefer the one in `focus` instead of asking.
- **Experience**: shapes the chat summary only. It never changes the council, the scores or the Room.
  - `new`: write the summary in the plainest words, explain each term the first time it appears (for example, "kill criteria, the signs that would prove the plan wrong"), and end with a two-line guide: "How to read this: the score is how strongly the council backs the plan, out of 10. The dissent and the warning signs are there so you can decide for yourself."
  - `some`: the standard summary.
  - `pro`: the standard summary, plus the option math line from `scores.json` and the spread and confidence, with no guide.
