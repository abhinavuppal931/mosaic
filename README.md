# Mosaic

A council of investing legends for Claude Code. Work in progress; see docs/spec.md.


## The Room

The Room is a local web page that plays a council live, then shows the verdict. It reads the session files the council writes and makes no AI calls. It needs Node 20 or later and nothing else.

```bash
node room/server.js --session room/examples/2026-11-17-nvda-buy
```

Open http://localhost:4731. Without `--session`, the Room follows the newest council in `<home>/sessions`, so a council started after the Room opens shows up by itself. `/mosaic room` starts it this way and prints the address. Other options are `--port` (or `MOSAIC_ROOM_PORT`), `--home`, `--sessions`, `--journal` and `--roster`.

Three finished councils in `room/examples/` run with no live council: a buy (NVIDIA), a sell (Costco) and a sizing decision (Microsoft). Tests are in `room/test/`; run `npm test` inside `room/` for the unit tests, and `npm run test:e2e` for the browser tests, which need Playwright.
