# Installing Mosaic (for AI agents)

You are an AI coding agent helping a person set up Mosaic. Mosaic is a free plugin for Claude Code. Simulated investing legends debate the person's investment decision, and a local web page called the Room shows the debate and the verdict. It is not investment advice.

Follow the path that matches the agent you are. Run each command on its own, and tell the person what you are doing in one short line per step. Quote every path, because it may contain spaces.

## Path A: you are Claude Code

1. **Check Node.js.** Run `node --version`. Mosaic needs 20 or later.
   - If Node is missing or older, stop. Tell the person to install the LTS version from https://nodejs.org, then ask you again.
2. **Check Claude Code.** Run `claude --version`. The one-line install needs 2.1.292 or later.
   - If it is older, ask the person whether to run `claude update`. If they say no, use the two-command install in step 3.
3. **Install the plugin.** First run `claude plugin list --json`. If it already lists `mosaic@mosaic`, skip to step 4. Otherwise run:

   ```bash
   claude plugin install mosaic --marketplace abhinavuppal931/mosaic
   ```

   The two-command install, for older Claude Code: `claude plugin marketplace add abhinavuppal931/mosaic`, then `claude plugin install mosaic@mosaic`.
4. **Find the plugin folder.** Run `claude plugin list --json` and read `installPath` for `mosaic@mosaic`.
5. **Open the Room.** Start it in the background, so it keeps running:

   ```bash
   node "<installPath>/room/server.js" --open
   ```

   It prints a link, usually http://localhost:4731, and opens the browser. Until the person runs a council of their own, it shows three finished example councils.
   - If it says the Room is already open, give the person the link it printed.
   - If port 4731 is taken by something else, it moves to the next free port and prints that link instead.
6. **Hand over.** The plugin's `/mosaic` command works in a new Claude Code session, or after reloading plugins in this one. Tell the person, in plain words:
   - "Type `/reload-plugins`, then `/mosaic`. Or, in a new terminal, run `claude "/mosaic"`."
   - `/mosaic` checks their setup, then asks for their decision. For example: `/mosaic I plan to buy NVIDIA for a three-year hold`.
   - The first time, it asks for a name and email for the SEC, which asks every client to identify itself. Both are sent only to sec.gov.

Do not ask the person for API keys. Mosaic works with free data sources by default.

## Path B: you are another coding agent (Codex, Cursor, Windsurf or similar)

A council runs inside Claude Code. You can still show the person what Mosaic looks like, and then hand them to Claude Code.

1. **Check Node.js** as in Path A, step 1.
2. **Clone the repository** into a folder the person chooses (their home folder if they do not mind):

   ```bash
   git clone https://github.com/abhinavuppal931/mosaic.git
   ```

3. **Open the Room on the example councils.** Run this from the folder you cloned into. It needs no install and no keys:

   ```bash
   node mosaic/room/server.js --open
   ```

   Give the person the link it prints.
4. **Hand over.** Tell the person that a council of their own needs Claude Code (https://claude.com/claude-code). Once it is installed, these two commands in a terminal set up Mosaic and start it:

   ```bash
   claude plugin install mosaic --marketplace abhinavuppal931/mosaic
   ```

   ```bash
   claude "/mosaic"
   ```

## Check it worked

- The Room link opens a page with a finished council. The Journal page lists three example councils.
- In Claude Code, `/mosaic` (or `/mosaic:mosaic`) starts with a first-run check and then asks for a decision.

## If something fails

- `claude: command not found`, or "'claude' is not recognized": Claude Code is not installed. Point the person to https://claude.com/claude-code.
- "'/mosaic' is not recognized": the person typed it in the terminal. It must be typed inside Claude Code, or run as `claude "/mosaic"`.
- `error: unknown option '--marketplace'`: Claude Code is older than 2.1.292. Use the two-command install.
- "Repository not found": the repository is not public yet, or git has no access to it.
