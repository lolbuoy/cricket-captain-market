# 🏏 Cricket Captain × Market

> Play as cricket captain and trade prediction markets ball-by-ball. Combining Cricket Captain with Polymarket.

![Dark Theme](https://img.shields.io/badge/theme-dark%20glassmorphism-1a1f3a)
![No Framework](https://img.shields.io/badge/stack-vanilla%20JS-f7df1e)
![Live Data](https://img.shields.io/badge/data-live%20scraping-00d4ff)

---

## What is this?

A real-time cricket strategy game where you make **tactical captain decisions** (bowling changes, field settings, DRS) and **trade prediction markets** (Polymarket-style YES/NO shares with live odds) — all updating ball by ball.

**Pre-loaded match:** ICC T20 World Cup 2026 Final — India 🇮🇳 vs New Zealand 🇳🇿

### The Game Loop

```
🎯 Captain Mode  → Select bowler, set field, use DRS
📈 Market Mode   → Buy YES/NO shares on live markets (wicket this over? 50+ powerplay runs?)
⚡ Outcome       → Ball is bowled, markets resolve, odds shift, portfolio updates
```

---

## Features

| Feature | Details |
|---------|---------|
| **Captain Mode** | Select bowlers (AI-recommended ⭐), set fields (defensive/balanced/attacking), DRS reviews |
| **Prediction Markets** | 6+ markets per over: match winner, wicket this over, runs O/U, sixes, powerplay total |
| **Portfolio** | 10,000 starting tokens, buy/sell YES/NO shares, live P&L, return %, trade history |
| **Live Data** | Cricbuzz web scraping (no API key!) or CricketData.org API (free, 100 hits/day) |
| **Ball-by-Ball** | Phase-aware simulation: powerplay/middle/death overs with player skill weighting |
| **Real Squads** | Actual India & NZ squads with batting/bowling stats |

---

## Quick Start

### Option 1: With live data (recommended)
```bash
node server.js
# Opens at http://localhost:8080
# Auto-scrapes Cricbuzz — no API key needed!
```

### Option 2: Simulation only
```bash
npx -y http-server -p 8080 -c-1
# Opens at http://localhost:8080
# Uses ball-by-ball simulation engine
```

### Option 3: CricketData.org API
1. Get a free key from [cricketdata.org](https://cricketdata.org)
2. Click ⚙️ in the app, paste your key
3. Live scores update every 20s

---

## How It Works

### Data Sources (priority order)
1. **Cricbuzz Scraper** — `node server.js` runs a local proxy that scrapes Cricbuzz live scores. No API key, no rate limits.
2. **CricketData.org API** — Falls back to this if scraper isn't available. Free tier: 100 requests/day.
3. **Simulation Engine** — If no live data, the match engine simulates realistic ball-by-ball outcomes.

### Prediction Market Engine
- **LMSR-inspired** odds calculation (same model as Polymarket)
- Odds shift after every ball based on match state
- Markets auto-resolve at over end, innings end, and match end
- 8 market types: Match Winner, Wicket This Over, Runs O/U, Powerplay Runs, Six This Over, Top Scorer, 3+ Wickets

### Captain Scoring
- Points for smart tactical decisions
- Bowler selection scored by match situation awareness
- Field setting scored by game phase appropriateness
- DRS reviews scored by success rate

---

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Backend:** Node.js `server.js` (optional, for Cricbuzz scraping)
- **Design:** Dark glassmorphism theme, Google Fonts (Inter + JetBrains Mono)
- **Data:** Cricbuzz scraping + CricketData.org API + simulation engine

---

## Project Structure

```
cricket-captain-market/
├── index.html          # Entry point
├── server.js          # Dev server + Cricbuzz scraping proxy
├── css/
│   └── styles.css     # Dark glassmorphism design system
└── js/
    ├── teams.js       # India & NZ squad data
    ├── matchEngine.js # Ball-by-ball simulation
    ├── market.js      # Polymarket-style odds engine
    ├── captainMode.js # Captain tactical scoring
    ├── api.js         # CricketData.org integration
    ├── scraper.js     # Cricbuzz scraper client
    ├── ui.js          # DOM rendering & animations
    └── app.js         # Main controller
```

---

## License

MIT
