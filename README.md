# RL Esports Simulator

A Rocket League esports tournament simulator modelled on the 256Teams "Custom tournament" mode, using RLCS 2026 rosters from Liquipedia. It has a responsive minimalist design: Midnight Ink (primary), Azure Blue (secondary) and Vermilion Orange (accent), on a full Midnight Ink background.

Open `index.html` in a browser. There is no build step and nothing to install.

## Features
- **Homepage** (modelled on the 256Teams home): resume banner, featured RLCS 2026 Worlds / Paris / Boston cards, a searchable competitions grid (real event fields plus 7 regional opens), regional leagues, and more simulators (Custom tournament, Custom match, 128-team knockout, Build a league). A Teams page ranks all 251 rosters.
- **Live pitch** (`js/pitch.js`): a to-scale Soccar field (cut corners, goals, boost pads) with RLCS kickoff positions, cars rotating as first/second/third man, boost trails, demos and goal explosions. Every goal, shot, save and demo from the match engine is staged on the pitch at its game time.
- **Setup**
  - Choose the number of teams and one of 7 formats: Knockout, Double elimination, Swiss + playoffs, Groups + knockout, RLCS Major (groups + Final Eight), League, and League + playoffs.
  - Pick a team from the library of 251 RLCS 2026 teams, or auto-fill the field by ranking, region, Worlds field, random or underdogs.
  - Randomise the slots, create custom teams, or clear the field (with undo).
  - Optionally manage one team.
  - Save and import presets.
- **Draw:** swap teams between groups or seeds, seed the field by rating, and shuffle. Use *Edit match* on any series to change its length or force the result and series score.
- **Advanced settings:**
  - Match type: full games or sudden-death overtime only.
  - Simulation style: Realistic, Standard or Pure chaos.
  - Goal level and series/final length.
  - Third-place match.
  - Team ratings and player editor.
- **Tournament**
  - Play a series live on a 2D top-down pitch with commentary. The viewer has Extended, Highlights and Commentary-only modes, speeds from 1× to 16×, and pause, skip game and reveal controls.
  - Or quick-sim one series, simulate a matchday or round, or simulate everything that's left.
  - Panels show live stats and scoreboards, group, league and Swiss tables, brackets (including upper and lower), a team filter, a leaders panel (goals, MVP race, saves, assists) and a "Tournament pulse" story feed.
  - When it ends you get a Champion screen with awards, plus a "Your team are out" flow.
- Your setup and tournament save automatically in localStorage.

## Data
**Team logos.** `js/logos.js` bundles 148 team logos from Liquipedia: every team in the library that has a logo there. They're bundled as small inline images so the page works offline and on the published artifact. Logos are trademarks of their organisations. Teams without a Liquipedia logo keep their coloured tag badge.

**Two roster sets.** `js/data.js` holds the RLCS 2026 rosters (unchanged). `js/data27.js` holds the RLCS 2027 rosters as of 17 November 2026. These were built from the 2027 Club Championship Kick-Off and Kick-Off Open participant lists, plus every player transfer listed on Liquipedia from 21 September to 17 November 2026, applied to the 2026 rosters. RLCS 2027 events shown are the Kick-Off Opens, the London Kick-Off, the seven regional Club Leagues and the Club Finale. Slots that haven't been decided yet are filled with the best-rated eligible teams and marked as projected.

`js/data.js` is generated from the Liquipedia pages for the RLCS 2026 World Championship (September 2026) and the Paris Major regional opens. Liquipedia content is licensed CC-BY-SA 3.0. Team ratings are estimates based on 2026 results, and you can edit them in the app.
