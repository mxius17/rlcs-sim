# RL Esports Simulator

A Rocket League esports tournament simulator modelled on the 256Teams "Custom tournament" mode, using RLCS 2026 rosters from Liquipedia. It has a responsive minimalist design: Midnight Ink (primary), Azure Blue (secondary) and Vermilion Orange (accent), on a full Midnight Ink background.

Open `index.html` in a browser. There is no build step and nothing to install.

## Features
- **3D intro:** a full-screen three.js scene greets you on arrival. It shows a silver championship cup with the RLCS 2027 partner teams' logos orbiting it, drifting boost sparks and the title. **Click to play** (or Enter) opens the menu. Without WebGL a 2D version of the same screen appears instead. three.js r128 is bundled in `js/vendor/` (MIT licence).
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
**Season archive.** `js/data_hist.js` holds every RLCS season from Season 1 (2016) to 2025 (32 events): the Season 1–8 Finals; Season 9's regional championships (its Finals were cancelled because of COVID-19); Season X's online regional Majors and Championships (it had no LAN events); and every Major and World Championship from 2021-22 to 2025. Each has venue, dates, prize pool, the real field and each team's roster at the time, plus the real champion and runner-up. Team ratings for these seasons are estimates from how teams placed at that season's events. Real formats with stages the simulator doesn't model (wildcard rounds, play-ins, group stages) are run with the closest format, and each event says how. Event colours come from each event's own branding; Seasons 1–9 and Season X use the series logos of the time (the classic RLCS crest and the RLCS X wordmark), the only branding Liquipedia has for those events.

**Player ages.** `js/births.js` holds the birth dates of 612 players, read from their Liquipedia player pages. Career mode uses them for real ages as of the 2027 season start, rolling forward each season. Players without a Liquipedia birth date (mostly amateur open-qualifier players) get an estimated age, shown as "~22".

**Team logos.** `js/logos.js` bundles 148 team logos from Liquipedia: every team in the library that has a logo there. They're bundled as small inline images so the page works offline and on the published artifact. Logos are trademarks of their organisations. Teams without a Liquipedia logo keep their coloured tag badge.

**Two roster sets.** `js/data.js` holds the RLCS 2026 rosters (unchanged). `js/data27.js` holds the RLCS 2027 rosters as of 17 November 2026. These were built from the 2027 Club Championship Kick-Off and Kick-Off Open participant lists, plus every player transfer listed on Liquipedia from 21 September to 17 November 2026, applied to the 2026 rosters. RLCS 2027 events shown are the Kick-Off Opens, the London Kick-Off, the seven regional Club Leagues and the Club Finale. Slots that haven't been decided yet are filled with the best-rated eligible teams and marked as projected.

`js/data.js` is generated from the Liquipedia pages for the RLCS 2026 World Championship (September 2026) and the Paris Major regional opens. Liquipedia content is licensed CC-BY-SA 3.0. Team ratings are estimates based on 2026 results, and you can edit them in the app.

## Accounts & cross-device sync

Sign in with e-mail (👤 button, or Settings › Account) to keep careers, tournaments and settings in sync on every device.
It runs on Firebase (Authentication + Cloud Firestore, free plan):

1. Create a project at https://console.firebase.google.com.
2. Authentication › Sign-in method › enable **Email/Password**.
3. Firestore Database › create a database, then paste `firestore.rules` into its **Rules** tab and publish.
4. Project settings › Your apps › add a **Web app**, copy `js/firebase-config.example.js` to `js/firebase-config.local.js`
   (git-ignored) and paste the config in. Deploy that file as `js/firebase-config.js`, replacing the placeholder.
5. Authentication › Settings › **Authorized domains**: add the domain the site runs on.

Without that file the simulator works as before (saves stay in the browser) and the account button says accounts aren't set up.
