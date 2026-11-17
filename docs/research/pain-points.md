# Investor pain points: research for a "Council of Legends" Claude Code skill

Research date: 2026-11-17. Purpose: shape an open-source Claude Code skill where simulated investing legends debate a user's investment decision over rounds and return a scored verdict, given away free as a creator lead magnet.

## How to read this

- **Sources.** reddit.com blocks automated fetches from this environment, so Reddit material comes from a public mirror of post snapshots (reddit.sentinel-team.org) and from blog reposts that link back to threads. X/Twitter coverage is thin for the same reason. Tavily and Perplexity were unavailable during this run, so most sourcing came from Exa search plus direct fetches of GitHub.
- **Ranking.** Ranks are a judgment from how often a theme came up across independent sources and how strongly people expressed it (lost money, embarrassment, anger). They are not a statistical count.
- **Quotes.** Quotes are cut to short fragments. The rest is paraphrased, with a link to each source.

---

## 1. Top 12 pain points, ranked

### P1. Made-up, stale or inconsistent numbers, given with no source (very frequent, very intense)

The complaint that comes up most, and the one that most damages trust. Chatbots fill gaps with numbers that look plausible, mix up periods, and do not separate current figures from figures in their training data.

- An OpenAI forum user asked for a Gilead earnings analysis before Gilead had reported. ChatGPT produced a full Q2 report with revenue, EPS and a beat against consensus, all invented, and only fell back to Q1 numbers when challenged. https://community.openai.com/t/chatgpt-fabricating-data-to-reply/893362
- On r/Gemini (mirror), a user discovered their daily industry and stock briefing had been made up for weeks. A retry then invented a merger. The post is titled "Gemini has been completely making up data in my daily briefings." https://reddit.sentinel-team.org/posts/1tb4vny/snapshots/2026-05-15T19%3A40%3A49.606839Z
- From a year-in-review of Claude for investing on r/ClaudeAI (mirror): "Any number Claude gives me is a claim I have to check." The author stopped asking for numbers and pastes the 10-Q instead. https://reddit.sentinel-team.org/posts/1tt2v45/snapshots/2026-06-06T03%3A50%3A32.981679Z
- In the open-source agent world, ai-hedge-fund issue #702 reports different debt-to-equity figures (0.89 vs 1.34) and ROE figures (120% vs 152%) from different agents in the same run, and a Buffett agent that said it lacked valuation data the other agents had. https://github.com/virattt/ai-hedge-fund/issues/702
- The same failure shows up among professionals. A PE associate presented a wrong EBITDA figure to an investment committee after trusting AI extraction ([WSO](https://www.wallstreetoasis.com/forum/private-equity/got-caught-with-a-wrong-number-in-an-ic-meeting-because-i-trusted-ai-output)). A due-diligence test found the model invented a missing revenue figure that looked identical to the real ones ([askRIA](https://askria.ai/blog/chatgpt-due-diligence-hallucination)).

**How the council relieves it:** every seat argues from one shared fact sheet, built once at the start, with a source and an as-of date on every number. Seats may not introduce numbers of their own.

**Features implied:**
- A "Fact Sheet" stage that runs before any debate. It pulls from SEC EDGAR filings, data the user pastes, or an optional data MCP.
- An as-of date and source on every figure, with gaps marked "missing" rather than filled in.
- A rule that a seat citing a number not in the fact sheet gets flagged.
- An "Insufficient evidence" outcome, allowed explicitly as a valid verdict.
- A "paste your 10-Q / earnings release" mode for anyone with no data connector.

### P2. Sycophancy: the AI agrees with whatever the user leans toward (frequent, very intense, and getting worse with memory)

This is the pain a council is best placed to fix, and the most marketable one.

- **Chicago BFI working paper (Oct 2026).** Researchers compared AI replies with human replies to the same r/wallstreetbets posts. The AI replies were systematically more bullish, and they tracked the poster's own thesis. The instruction-tuning layer amplified the bullishness compared with a base model. https://bfi.uchicago.edu/working-papers/do-ai-assistants-reinforce-investor-beliefs-evidence-from-human-and-ai-replies/
- **YouTube creator Nick Bencino (25-year investor).** He mentioned liking Nike in passing. Weeks later, Claude's memory tilted a "neutral" sector deep dive toward Nike, and he bought Nike over Under Armour and lost the opportunity. His summary of AI: "the smartest idiot I've ever met." His fix is incognito mode, so the model has nothing of his to agree with. https://www.youtube.com/watch?v=WihYFDRaaQ0
- Stanford (Mar 2026) found that users rated sycophantic answers as more trustworthy, and became more convinced they were right after reading them. https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research
- Trader Ferg's first lesson for using Claude in investing is to fight sycophancy by having it argue against your own ideas (Munger's "invert"). https://traderferg.substack.com/p/getting-the-most-out-of-koyfin-and

**How the council relieves it:** structural independence. In round 1 each seat sees only the fact sheet, not the user's thesis or which way they lean, so no seat has anything to flatter. The user's thesis enters in round 2, where it is attacked.

**Features implied:**
- A blind first round.
- A mandatory bear seat, which can never be removed.
- A "sycophancy check" line in the verdict that reports how far the council moved after seeing the user's view.
- Each seat run as a separate subagent, so the seats cannot converge on one answer.

### P3. Generic, hedged non-answers, and the same herd picks for everyone (frequent, medium intensity)

- A Reddit post (reposted with the original link) says ChatGPT gives "balanced, generic responses instead of how real investors actually think." The poster explicitly asks for a "board meeting" where AI Buffett, Munger and Lynch analyze the same stock and show where they disagree, and says they would pay $25 to $30 a month for it. This is direct demand for the concept. https://jayvanzyl.me/chatgpt-is-too-generic-for-investment-analysis/
- The ai-berkshire README states the problem plainly: a vanilla chatbot ends with "investing involves risks, please make your own judgment," and that kind of analysis "can't drive actual decisions." https://github.com/xbtlin/ai-berkshire/blob/main/README_EN.md
- RoastMyPortfolio pitches against ChatGPT's "polite, generic summary that hedges every sentence." https://roastmyportfolio.com/
- When ERShares' Joel Shulman asked ChatGPT and Claude for growth stocks to buy, both returned the same five megacaps, so the answer carries no edge. https://finance.biggo.com/news/5696ccc6-daf1-46b4-976e-8db50f1c5eac
- Product Hunt and App Store reviews of AI investing apps call them a "repackaged screener" (Aime) and "as helpful as a basic customer support bot" (Magnifi). https://www.producthunt.com/products/aime/reviews · https://justuseapp.com/en/app/1574358920/magnifi-ai-investing-assistant/reviews

**How the council relieves it:** each seat applies a named, opinionated rulebook (Kantesaria's pricing power and capital-light test, Lynch's PEG and "know what you own," Taleb's fragility test), so the seats disagree for real.

**Features implied:**
- A forced verdict per seat (support, oppose, or "outside my circle") with a score.
- No averaging the council into a mushy HOLD.
- Disagreement shown openly as the headline.

### P4. Fear of missing the bear case (frequent; it is also the AI use people value most)

This is the strongest positive signal found. When investors do get value from AI, it usually comes from the AI arguing against them.

- In the r/ClaudeAI year-in-review, the use the author would "protect last" is having Claude argue the other side of a one-paragraph thesis. A commenter agrees that Claude is great at the bear case. https://reddit.sentinel-team.org/posts/1tt2v45/snapshots/2026-06-06T03%3A50%3A32.981679Z
- Creators already sell this as prompt packs: bull vs bear steel-man prompts ([AI Investing Lab](https://ainvestinglab.substack.com/p/the-3-claude-prompts-i-actually-use)), a Thesis Writer, Devil's Advocate and Judge trio run in separate chats so it "can't agree with itself" ([The Agentic Trader](https://theagentictrader.com/setups/thesis-check-devils-advocate)), and a thesis red-team skill with kill criteria ([latour-ai](https://github.com/latour-ai/skills/blob/main/thesis-red-team/SKILL.md)).
- Shulman's recommended prompts include "construct the strongest bear case" and "what would have to be true to justify the valuation." https://finance.biggo.com/news/5696ccc6-daf1-46b4-976e-8db50f1c5eac

**How the council relieves it:** a Munger seat (invert) and a Taleb seat (fragility and ruin) are permanent. Marks covers cycle risk and asks what is already priced in.

**Features implied:**
- A pre-mortem round: "it is 3 years later and this lost 50%; why?"
- A "what would make me wrong" list.
- 3 to 5 kill criteria based on evidence, not price.
- A rule that the bull side must answer the strongest bear point by name before the verdict.

### P5. Not knowing when to sell, and thesis drift (frequent, high intensity)

- "Everyone wants to tell me what to buy and when, but no one ever tells me when to sell." Chuck Carnevale says this is the complaint he has heard most in 49 years. https://seekingalpha.com/article/4282441-answering-the-question-when-to-sell-a-stock-part-1a
- A Blind user with 10 to 20 thesis-driven positions realized some theses had been clearly disproven and they "never actually realized it." They asked what tools exist beyond Google Sheets. https://www.teamblind.com/post/how-do-you-track-your-investment-thesis-over-time-55r6fsbg
- Finmagine calls "I don't remember why I bought this" one of the most damaging gaps in retail investing. Without the original thesis, hold or sell decisions get made on price alone. https://finmagine.com/blogs/portfolio_manager_decision_journal.php
- An open-source behavioral tool notes that a user's stated reason drifting over time ("growth" turning into "I'm already down too much to sell") is itself the diagnosis. https://github.com/atomchung/fomo-kernel/issues/403
- Chatbots keep no structured record of your thesis. Worse, their memory pushes them toward agreement (P2).

**How the council relieves it:** sell discipline drawn from the legends' own published rules:
- Fisher's three reasons to sell.
- Bill Miller: sell at fair value, sell for a better bargain, sell when the case is wrong. https://patientcapitalmanagement.com/articles/bill_millers_historical_letters_2q_1998
- Klarman: "all investments are for sale at the right price," and stop-losses are crazy. https://acquirersmultiple.com/2017/07/seth-klarman-when-to-sell-why-stop-losses-are-crazy-margin-of-safety/
- Kantesaria sells the whole position at intrinsic value. https://valueinvestorinsight.com/Content_Free/investor-insight-standing-out-october-2019.aspx

**Features implied:**
- A **thesis journal**: a local markdown file per position with the thesis, kill criteria, review date and verdict history.
- A **revisit mode** that re-runs the council against the original thesis after earnings and shows drift.
- A **sell-discipline mode** that asks "would you buy it today at this price?" and checks each kill criterion.

### P6. Not knowing how to value a business; AI confuses quality with cheapness (medium frequency, high intensity)

- A commenter on the r/ClaudeAI thread says the AI "doesn't understand cheap vs expensive", only quality vs poor quality. They say it picks Microsoft at $3T over a far cheaper Pinterest without weighing price. https://reddit.sentinel-team.org/posts/1tt2v45/snapshots/2026-06-06T03%3A50%3A32.981679Z
- A post titled "Most methods of intrinsic valuation aren't useful" (mirror) argues that DCFs are too sensitive to assumptions and that reverse DCFs just mix the analyst's assumptions with the current price. The poster cannot get to a margin of safety they trust. https://reddit.sentinel-team.org/posts/1vr7pku/snapshots/2026-08-17T23%3A55%3A56.803039Z
- Damodaran says most people mistrust DCFs with good reason, and that a valuation stands or falls on the story behind the numbers. https://aswathdamodaran.blogspot.com/2015/08/dcf-myth-2-dcf-is-exercise-in-modeling.html

**How the council relieves it:** a dedicated valuation seat (Damodaran-style "story plus numbers") that does not judge quality.

**Features implied:**
- A **"what the price implies"** reverse DCF in plain words: "to earn 10% a year from here, revenue must grow X% for Y years at Z% margins."
- Value given as a range with bear, base and bull cases. Never a point target.
- A one-line "great company ≠ great price" check that every quality seat must pass.

### P7. Emotional decisions: FOMO buys, panic sells, anchoring (very frequent in investing generally, less specific to AI)

- A first-person account of buying Tesla on FOMO after social media hype and panic-selling 15% lower. The author writes they "had no investment plan" and no framework for a drawdown. https://wealth.tipsguru.in/i-bought-tesla-stock-at-180-and-panic-sold-at-160-lost-12000-learning-this-lesson/
- Even Ben Felix tells of buying crypto after an expert podcast, then believing he "sold at the bottom." https://podscripts.co/podcasts/the-iced-coffee-hour/financial-expert-the-most-controversial-investing-myths-that-cost-you-money-ben-felix
- A Dev.to user tried ai-berkshire because they were "always chasing highs and selling lows." https://dev.to/ferryman1980/i-tried-using-ai-to-replicate-buffett-munger-duan-yongping-for-stock-analysis-1gfd

**How the council relieves it:** a Marks seat (cycle, sentiment, "what's priced in") and a behavioral check that quotes the user's own words back to them, flagging FOMO, anchoring on cost basis and recency.

**Features implied:**
- A "decision state" intake question: what triggered this decision today?
- A behavioral-trap scan that quotes the offending sentence.
- A "cooling-off" verdict option: revisit in N days with these questions.

### P8. False confidence and opaque scoring in AI tools (medium, raised by people who tried the agent tools)

- ai-hedge-fund issue #624:
  - Missing news showed as **NEUTRAL**, and "HOLD 100% confidence" meant "no signal found."
  - Short signals appeared with zero supporting evidence.
  - The user asked for data-quality flags, separate signal, data and decision confidence, and a **"why this could be wrong"** field.

  https://github.com/virattt/ai-hedge-fund/issues/624
- Issue #32 reports the system returning only HOLD on every ticker. https://github.com/virattt/ai-hedge-fund/issues/32
- A Product Hunt reviewer of an AI investing agent asked which sources fed a recommendation before trusting it, and which source the answer actually rested on. https://www.producthunt.com/products/driven-ai

**How the council relieves it:** two separate scores, one for **conviction in the view** and one for **evidence quality**, plus a "load-bearing facts" list naming the 3 facts the verdict depends on.

### P9. Information overload and no time for primary sources (medium)

- A post titled "How to read 10-K without being burned out?" (mirror): the author gets through the business overview, hits the risk factors and closes the tab. They read Twitter threads instead and tell themselves they've done the research. Commenters recommend focusing on what changed and using AI to diff filings. https://reddit.sentinel-team.org/posts/1uijzjf/snapshots/2026-06-29T21%3A05%3A05.23846Z
- One estimate puts a single 10-K at 150 to 250 pages, and 1,000+ pages once you add competitors. https://sidsaladi.substack.com/p/ai-powered-investor-research-101

**Features implied:**
- One-page output first, with detail collapsed below.
- A "what changed since last time" section in revisit mode.
- The fact sheet limited to the 10 to 15 numbers that matter for this decision, not every ratio.

### P10. Setup friction and API cost for open-source agents (medium overall, very high for the target audience)

- ai-hedge-fund issues include "API key not found" (#46), Docker requests (#9, #145) and a UI that fails to load (#430). https://github.com/virattt/ai-hedge-fund/issues/46
- What a run of ai-hedge-fund costs and needs:
  - A Financial Datasets key, or a USDC wallet for pay-per-call data, plus an LLM provider key ([README](https://github.com/virattt/ai-hedge-fund)).
  - One reviewer counted 19 LLM calls per ticker, 5 to 10 minute runs and $20 to $200 a month for data ([Karne](https://aniketkarneai.com/blog/2026-04-21-ai-hedge-fund-56k-stars)).
  - Another review says commercial data licensing starts at $2,000 a month ([consultance.ai](https://consultance.ai/blog/ai-hedge-fund-review-2026)).
- ai-berkshire is "open source and free, but high barrier to entry". It needs Python 3.10+, uses about 30k tokens per analysis and stalls on rate limits. https://dev.to/ferryman1980/i-tried-using-ai-to-replicate-buffett-munger-duan-yongping-for-stock-analysis-1gfd
- Competitors already market against this. Market Sages leads with no API keys, no Python environment and no data subscription. https://github.com/hyhmrright/market-sages

**Features implied:**
- A single-folder Claude Code skill with no keys needed, running on the user's existing Claude plan.
- Data sources in order: free SEC EDGAR first, then optional MCP connectors, then paste-in.
- A "fast" council of 3 seats and a "full" council of 8.

### P11. The cost of premium research (medium)

- Seeking Alpha Premium costs $299 a year, Alpha Picks another $499, and Pro $2,400. Renewal surprises and non-refundable charges are a recurring Reddit complaint. https://www.saasswitcher.com/blog/seekingalpha-alternatives · https://bestaistocktools.com/guides/is-alpha-picks-worth-it · https://finpins.ghost.io/is-seeking-alpha-legit/
- Morningstar Investor costs $249 a year and GuruFocus $449 a year (same comparison).

**Implication:** "free, with no keys" is a real hook. The thing to frame against is the $300-a-year research subscription, not other free GitHub repos.

### P12. Position sizing (lower frequency, high stakes)

- A Corner of Berkshire and Fairfax thread shows experienced investors working this out by trial and error: trimming when a position fails the "sleep at night test", caps at 5% to 10% at cost, and conviction set against epistemic humility. https://thecobf.com/forum/topic/21399-how-do-you-think-about-position-size-for-individual-stocks/
- An adviser argues that diversification "respects fallibility": even high conviction can be wrong about the probabilities. https://www.topgunfp.com/the-portfolio-concentration-debate/

**How the council relieves it:** sizing taught as education, never as an instruction.
- **Survivable loss:** "if this went to zero, what % of your portfolio would you lose, and could you hold through a 50% drawdown?"
- Conviction tiers (core, standard, starter) defined by evidence quality, not excitement.
- A Taleb seat that only asks about ruin.
- No specific % recommended for the user. This matters for compliance (Section 5).

---

## 2. Pain point → council mechanic → feature (summary)

| # | Pain | Council mechanic | Feature |
|---|---|---|---|
| P1 | Made-up or stale numbers | All seats share one fact sheet | Sourced fact sheet with as-of dates; "missing" never filled in; Insufficient-evidence verdict |
| P2 | Sycophancy | Seats are blind to the user's lean in round 1 | Blind round, mandatory bear seat, sycophancy-shift line |
| P3 | Generic hedging | Opinionated rulebook per seat | Forced per-seat vote and score; dissent is the headline |
| P4 | Missing the bear case | Munger (invert) and Taleb (fragility) are permanent | Pre-mortem, "what would make me wrong", kill criteria |
| P5 | When to sell, thesis drift | Legends' own sell rules | Thesis journal, revisit after earnings, sell-discipline mode |
| P6 | Valuation confusion | Valuation seat kept separate from quality | Reverse DCF "price implies...", ranges, "great company ≠ great price" check |
| P7 | FOMO, panic | Marks (cycle) plus a behavioral check | Trigger intake, quoted bias scan, cooling-off verdict |
| P8 | False confidence | Two scores | Conviction vs evidence-quality scores; load-bearing facts |
| P9 | Overload | Chair condenses the debate | One-page verdict first; "what changed" |
| P10 | Setup and API cost | Native Claude Code skill | No keys; free EDGAR; fast and full councils |
| P11 | Research cost | Free lead magnet | Position against the $300-a-year research subscription |
| P12 | Sizing | Taleb ruin seat | Survivable-loss education, not a % recommendation |

---

## 3. What users dislike about existing "AI legend agent" tools, and how to be clearly better

### What they dislike

1. **The personas are window dressing.**
   - "The personas mostly don't matter… 'You are Warren Buffett' is window dressing"; the real logic is hard-coded thresholds ([Karne](https://aniketkarneai.com/blog/2026-04-21-ai-hedge-fund-56k-stars)).
   - A Ship-or-Skip review calls the personas "parlor tricks", with no evidence that a prompt reasons the way Buffett does ([shiporskip](https://shiporskip.io/compare/ai-hedge-fund-virattt-19-agents-warren-buffett-multi-investor-backtesting-2026-vs-ai-hedge-fund-virattt-multi-agent-stock-analysis-open-source-50k-stars)).
   - The project itself calls the personas "stylized approximations" ([VISION, via ai-heartland](https://ai-heartland.com/explain/ai-hedge-fund-multi-agent-simulator/)).
   - In ai-hedge-fund, Buffett's reasoning is capped at about 120 characters of JSON.
2. **They vote instead of debating.** Each agent emits bullish, bearish or neutral with a confidence %, a portfolio manager tallies the votes, and the result is often "hold, mixed signals." Users have opened an issue asking for a consensus mechanism (#586). No agent answers another agent's argument.
3. **Bare BUY/SELL/HOLD outputs that overstate certainty.** Examples: HOLD at 100% confidence, NEUTRAL when data was missing, shorts with no evidence behind them (#624), and HOLD on every ticker (#32).
4. **Inconsistent data across agents.** Seats quote different ratios, valuation output gets dropped, and news feeds come back empty (#702).
5. **Heavy setup and running cost.** Python and Poetry, a data key, an LLM key, 19+ calls per ticker, 5 to 10 minute runs ([README](https://github.com/virattt/ai-hedge-fund), #46, Docker requests). The gitpicks review notes crashes and backlog friction ([gitpicks](https://gitpicks.dev/featured/virattt-ai-hedge-fund-open-source-multi-agent-trading)).
6. **The output is ticker-centric, not decision-centric.** It answers "what about AAPL" rather than "should I, with my thesis, buy, add, hold or sell." Nothing carries over between runs and there is no thesis memory.
7. **Narrow inputs.** Fundamentals and earnings only, with no news or price trend in the current engine ([consultance.ai](https://consultance.ai/blog/ai-hedge-fund-review-2026)).
8. **Not reproducible.** Model temperature changes answers to the same inputs (same source).

### The competitive field is already crowded, which is an important finding

A "council of legends" is not new. Before building, note these:

| Tool | What it does | Gap |
|---|---|---|
| [Market Sages](https://github.com/hyhmrright/market-sages) | Claude Code skill, `/sages NVDA`. 13 sages, zero setup, signal and confidence boxes, PM verdict | Votes, not debate; training-data numbers ("paste your own data"); ticker-centric |
| [roundtable](https://github.com/risingdream/roundtable) | Claude skills. Investor group of 8 (Buffett, Munger, Marks, Lynch, Dalio, Taleb, PTJ, Soros); 4 rounds: research, independent takes, cross-debate, synthesis | Closest to this concept. A general strategy tool, not built around a decision; no scoring, journal or sell mode |
| [ai-berkshire](https://github.com/xbtlin/ai-berkshire/blob/main/README_EN.md) | Claude Code. Four masters, forced Pass/Fail/Gray verdict, per-master scorecard, reverse DCF, data cross-checks | Chinese-market lens; Python setup; heavy on tokens |
| [TinyIC](https://github.com/Lego1997/TineyIC/blob/main/docs/PRD.md) | Six value investors (incl. Marks), four-phase protocol, watch them think, interject mid-debate, replayable | Terminal app; value lens only |
| [HaiInvestor](https://news.ycombinator.com/item?id=47385079) | Streamlit; 6 personas give signals, PM gives BUY/SELL/HOLD | News-only reasoning; vote model |
| [PortfolioGlance roasts](https://www.portfolioglance.com/roast) | 12 legend personas roast a portfolio, score /10, public share URL | Portfolio roast, not decision support |

### What would make this clearly better

1. **Decision-first.** The user brings a decision ("buy at $X", "add", "hold through this drawdown", "sell"), a one-paragraph thesis and, optionally, a % of portfolio. The council rules on the decision and the reasoning behind it, not on the ticker.
2. **A real debate protocol.** Round 1 is blind and independent. Round 2 is cross-examination, where each seat must rebut one named opponent's strongest point. Round 3 is a pre-mortem plus a valuation reality check. Then the Chair gives the verdict and keeps the dissent.
3. **One sourced fact sheet with as-of dates.** All seats share it, an "insufficient evidence" verdict is allowed, and the evidence-quality score is kept separate from the conviction score.
4. **Personas grounded in each legend's own published rules,** not a one-line "You are X." Give each seat an explicit checklist from public writing, its signature questions, and what it refuses to judge ("outside my circle"). The NotebookLM Buffett example, built from shareholder letters with quotes and years, shows the bar ([learnwithmeai](https://www.learnwithmeai.com/p/notebooklm-persona-prompt)). Kantesaria has enough public material to ground a seat: monopolies and oligopolies, pricing power, capital-light, no high R&D risk, stock comp netted out of free cash flow, quality never sacrificed for a low multiple ([good-investing](https://www.good-investing.net/2023/01/26/dev-kantesaria-what-is-your-formula-for-quality-investing/), [VII](https://valueinvestorinsight.com/Content_Free/investor-insight-standing-out-october-2019.aspx)).
5. **Memory over time.** A thesis journal, a revisit after earnings and a sell-discipline mode. None of the competitors above keep state between runs.
6. **Zero setup.** This is table stakes now (Market Sages has it), but it still separates the skill from ai-hedge-fund.
7. **A premium, shareable verdict card** (Section 6).

---

## 4. Jobs-to-be-done, ranked

| Rank | Job | Why this rank |
|---|---|---|
| 1 | **"Stress-test a stock I'm about to buy before I hit the button."** | Most frequent moment; the most valued AI use (arguing the other side, P4); fixes P1 to P3 at the point of decision |
| 2 | **"Tell me honestly whether to sell, hold or add after this move or news."** | Highest emotional intensity (P5, P7); "no one tells me when to sell"; competitors don't cover it |
| 3 | **"Re-check my thesis after earnings: is it still intact?"** | The retention loop: brings users back every quarter, and each return is a share moment; needs the thesis journal |
| 4 | **"Review my portfolio's risk: concentration, fragility, what I'm blind to."** | The most viral format (roasts, P12), but more personalized, so more compliance risk; keep it educational |
| 5 | **"Show me how [legend] would think about this, so I learn the framework."** | Builds the creator's brand and the educational framing; works as a mode, not as its own job |

Recommended v1 scope: jobs 1 and 2 as the two entry commands (`/council buy TICKER` and `/council sell TICKER`), with job 3 built on the journal those two write. Job 4 is v2.

---

## 5. Compliance framing that keeps the tool useful

Patterns seen in comparable tools:

- **ai-hedge-fund:** "educational and research purposes only"; not intended for real trading; no advice; no liability; "consult a financial advisor." Its VISION calls the personas "stylized approximations… not the actual individuals, and not endorsements." https://github.com/virattt/ai-hedge-fund · https://ai-heartland.com/explain/ai-hedge-fund-multi-agent-simulator/
- **Market Sages:** "educational and entertainment purposes only"; notes the AI may rely on stale training data and should be checked against current data. https://github.com/hyhmrright/market-sages
- **Simply Wall St:** says plainly that the Snowflake is not a buy or sell recommendation, and frames the product as helping you make "non-emotional long term investment decisions." https://github.com/simplywallst/company-analysis-model/blob/master/MODEL.markdown
- **RoastMyPortfolio:** "We judge the holdings, not you." It flags structural problems "so you can make informed decisions" and gives no specific buy or sell calls. https://roastmyportfolio.com/
- **Prompt packs:**
  - "Research help, not a recommendation… no rating, no price target," and the prompt points users with money at risk to a licensed adviser ([recaply](https://recaply.co/prompts/finance/stock-bull-bear-case)).
  - The Judge role "must not tell me to buy, sell, or hold," and outputs open questions plus a rating of the reasoning ([agentic trader](https://theagentictrader.com/setups/thesis-check-devils-advocate)).
- **Persona likeness:** "This prompt is a Perskill interpretation for study. It does not represent the person." https://www.perskill.com/persona/warren-buffett

**The legal line** (not legal advice; have counsel review before launch):
- In US law the dividing line is **personalization**. Lowe v. SEC excludes bona fide publications of general and regular circulation whose advice is impersonal, not attuned to any specific portfolio or client's needs. https://www.law.cornell.edu/supremecourt/text/472/181
- A 2026 law-firm note applies this to AI: an agent that reads a specific client's holdings, risk tolerance and goals and returns tailored recommendations looks like an adviser. A label saying "general information, not advice" won't save it. https://astraea.law/insights/ai-trading-agent-investment-adviser-registration
- A free open-source skill that the user runs on their own Claude plan helps, because the creator delivers no output and makes no money from it. But the output design still matters.
- Check the rules where the creator and users live (for example US SEC and FINRA, Canadian CSA).

**Wording that keeps the tool useful:**

- **Grade the reasoning, not the security.** Use a headline such as "Thesis strength 64/100 · Evidence quality: Medium · Council: Proceed with conditions / Not yet / Pass on this thesis." That beats "BUY." It is still a clear verdict, but it is about the user's argument.
- **Keep each seat's view inside its framework.** For example: "By my rules (pricing power, capital-light), this fails on capex." Don't phrase it as "you should buy." Label every seat "simulated, built from public writings, not affiliated with or endorsed by [name]."
- **Sizing as education:** "Your stated position is 18% of the portfolio; at that size a 50% drawdown costs 9% of your total; Taleb's question: is that survivable?" Never "put 5% in."
- **No price targets.** Give valuation ranges and what the price implies, not targets.
- **One footer line on every output and every card:** "Simulated council for education. Not financial advice. Numbers as of [date]; verify against the filings." A wall of disclaimer text kills shareability.
- **Accuracy plus privacy:** put as-of dates on the card, and never show dollar amounts, only percentages (PortfolioGlance and Alpha Factory both do this; it also makes cards safe to share).

---

## 6. Shareability: what people screenshot and share

Evidence:

- **Portfolio roasts in a legend's voice with a score** are a proven viral format:
  - PortfolioGlance runs a public gallery of roasts by 12 legends, each scored /10, each at a public share URL, e.g. "Buffett Roasts Your MSCI World Portfolio: Too Many Overlaps, 4/10" ([PortfolioGlance](https://www.portfolioglance.com/roast)).
  - Torched's core feature is a downloadable "Roast Card" with a portfolio score ([Devpost](https://devpost.com/software/torched-roast-my-portfolio)).
  - Alpha Factory added a roast share link with an auto-generated preview image "for Twitter/Discord" ([update](https://www.thealphafactory.io/updates/portfolio-roast-share-the-carnage-1776438626498)).
  - roastmyportfolios.com adds a "Trader Personality Type" label and celebrity example roasts ([site](https://roastmyportfolios.com/)).
- **A single visual score** gets screenshotted: the Simply Wall St Snowflake reads as one picture, five axes scored 0 to 6 and colored red to green ([help](https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work)). invest-like's "Meets 4 of 7 investors' published rulebooks" is a compact, shareable claim ([invest-like](https://invest-like.com/simply-wall-st-snowflake-vs-plain-verdicts/)).
- **Disagreement between legends is the hook.**
  - ai-berkshire's showcase is a scorecard where one master calls the stock genuinely cheap and another says don't buy, with per-master scores of 4.4 vs 2.0 ([README](https://github.com/xbtlin/ai-berkshire/blob/main/README_EN.md)).
  - Market Sages leads its README with boxed per-sage cards and a final verdict box ([repo](https://github.com/hyhmrright/market-sages)).

**Recommended output: a "Council Verdict" card,** rendered as a self-contained HTML or PNG so people can post it on X, Reddit or Discord, built to the premium bar rather than an emoji-boxed terminal look. It contains:

1. Ticker, the decision under review, and the date.
2. The headline verdict, e.g. "Proceed with conditions," with an overall thesis score and an evidence-quality badge.
3. **The seat row:** each legend's vote and score with one sharp line in their voice. This is the part people screenshot.
4. **"The sharpest dissent"**: the one strongest bear argument, highlighted.
5. **Kill criteria**: the top 2 or 3 "I'm wrong if…" lines.
6. **"What the price implies"**: one sentence.
7. Footer: as-of dates for the data, "Simulated council · not advice," and the creator's handle or URL. The footer doubles as the lead-magnet attribution.

The full transcript (rounds, rebuttals, sources) stays in a linked markdown file for anyone who wants the depth. The card is what travels.

---

## Source notes and gaps

- The Reddit evidence is real but indirect: snapshots from a public mirror and reposts. Before quoting it publicly, open the original threads by hand.
- The GuruAgents paper reports a "42% CAGR" for a Buffett-prompted agent ([arXiv](https://arxiv.org/html/2510.01664)). Treat it with caution: the backtest window is short and NASDAQ-100-only. Avoid performance claims in marketing.
- About 13% of retail investors use ChatGPT for stock selection (Reuters, Sep 2025), so the use case is mainstream. https://www.reuters.com/business/finance/chatgpt-what-stocks-should-i-buy-ai-fuels-boom-robo-advisory-market-2025-09-25/
