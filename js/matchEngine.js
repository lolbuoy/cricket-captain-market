// ============================================
// matchEngine.js — Ball-by-Ball Match Engine
// State machine: PRE_MATCH → TOSS → FIRST_INNINGS → INNINGS_BREAK → SECOND_INNINGS → COMPLETE
// ============================================

class MatchEngine {
  constructor(battingTeamKey, bowlingTeamKey) {
    this.battingTeamKey = battingTeamKey;
    this.bowlingTeamKey = bowlingTeamKey;
    this.battingTeam = TEAMS[battingTeamKey];
    this.bowlingTeam = TEAMS[bowlingTeamKey];

    // Match phase
    this.phase = 'FIRST_INNINGS'; // PRE_MATCH, TOSS, FIRST_INNINGS, INNINGS_BREAK, SECOND_INNINGS, COMPLETE

    // Current innings state
    this.innings = 1;
    this.totalOvers = 20;
    this.currentOver = 0;
    this.currentBall = 0;
    this.totalBalls = 0;
    this.runs = 0;
    this.wickets = 0;
    this.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

    // Target (for 2nd innings)
    this.target = null;

    // Batting
    this.battingOrder = getBattingOrder(battingTeamKey);
    this.striker = this.battingOrder[0];
    this.nonStriker = this.battingOrder[1];
    this.nextBatIdx = 2;
    this.fallOfWickets = [];

    // Individual batting stats
    this.batStats = {};
    this.battingOrder.forEach((p, i) => {
      this.batStats[p.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', position: i + 1 };
    });

    // Bowling
    this.bowlers = getBowlers(bowlingTeamKey);
    this.currentBowler = null;
    this.bowlStats = {};
    this.bowlers.forEach((b, i) => {
      this.bowlStats[b.id] = { overs: 0, balls: 0, runs: 0, wickets: 0, economy: 0, maidens: 0, position: i + 1 };
    });
    this.lastBowler = null;

    // Over tracking
    this.overRuns = 0;
    this.overWickets = 0;
    this.overBalls = [];

    // Field setting (0 = defensive, 1 = balanced, 2 = attacking)
    this.fieldSetting = 1;

    // DRS
    this.reviewsLeft = 2;

    // Commentary
    this.commentary = [];

    // Match state
    this.isComplete = false;
    this.result = null;

    // ── SCORECARD STORAGE (both innings) ──
    this.scorecard = {
      1: null, // Will be filled at end of 1st innings
      2: null, // Will be filled at end of 2nd innings
    };

    // Man of the Match
    this.manOfTheMatch = null;

    // Events
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  getPhase() {
    if (this.currentOver < 6) return 'powerplay';
    if (this.currentOver < 15) return 'middle';
    return 'death';
  }

  getRunRate() {
    const overs = this.currentOver + this.currentBall / 6;
    return overs > 0 ? (this.runs / overs).toFixed(2) : '0.00';
  }

  getRequiredRunRate() {
    if (!this.target) return null;
    const ballsLeft = (this.totalOvers * 6) - this.totalBalls;
    if (ballsLeft <= 0) return null;
    const runsNeeded = this.target - this.runs;
    return ((runsNeeded / ballsLeft) * 6).toFixed(2);
  }

  getOversDisplay() {
    return `${this.currentOver}.${this.currentBall}`;
  }

  setFieldSetting(setting) {
    this.fieldSetting = setting;
  }

  selectBowler(bowlerId) {
    const bowler = this.bowlers.find(b => b.id === bowlerId);
    if (!bowler) return false;
    if (this.bowlStats[bowlerId].overs >= 4) return false;
    if (this.lastBowler && this.lastBowler.id === bowlerId) return false;
    this.currentBowler = bowler;
    return true;
  }

  getAvailableBowlers() {
    return this.bowlers.filter(b => {
      const stats = this.bowlStats[b.id];
      if (stats.overs >= 4) return false;
      if (this.lastBowler && this.lastBowler.id === b.id && this.bowlers.filter(bl => this.bowlStats[bl.id].overs < 4).length > 1) return false;
      return true;
    });
  }

  // ── SAVE CURRENT INNINGS SCORECARD ──
  _saveCurrentInningsScorecard() {
    const batEntries = [];
    this.battingOrder.forEach(p => {
      const stat = this.batStats[p.id];
      if (stat.balls > 0 || stat.isOut) {
        batEntries.push({
          name: p.name,
          shortName: p.shortName,
          id: p.id,
          runs: stat.runs,
          balls: stat.balls,
          fours: stat.fours,
          sixes: stat.sixes,
          strikeRate: stat.balls > 0 ? ((stat.runs / stat.balls) * 100).toFixed(1) : '0.0',
          isOut: stat.isOut,
          dismissal: stat.dismissal || 'not out',
          position: stat.position,
        });
      }
    });

    const bowlEntries = [];
    this.bowlers.forEach(b => {
      const stat = this.bowlStats[b.id];
      if (stat.overs > 0 || stat.balls > 0) {
        bowlEntries.push({
          name: b.name,
          shortName: b.shortName,
          id: b.id,
          overs: stat.overs,
          maidens: stat.maidens,
          runs: stat.runs,
          wickets: stat.wickets,
          economy: stat.overs > 0 ? (stat.runs / stat.overs).toFixed(1) : '0.0',
          position: stat.position,
        });
      }
    });

    this.scorecard[this.innings] = {
      battingTeam: this.battingTeamKey,
      bowlingTeam: this.bowlingTeamKey,
      battingTeamName: this.battingTeam.name,
      bowlingTeamName: this.bowlingTeam.name,
      battingTeamFlag: this.battingTeam.flag,
      runs: this.runs,
      wickets: this.wickets,
      overs: this.getOversDisplay(),
      extras: { ...this.extras },
      extrasTotal: Object.values(this.extras).reduce((s, v) => s + v, 0),
      batting: batEntries,
      bowling: bowlEntries,
      fallOfWickets: [...this.fallOfWickets],
      commentary: [...this.commentary],
    };
  }

  // ── GET FULL SCORECARD FOR BOTH INNINGS ──
  getFullScorecard() {
    // Save current innings if still in progress
    if (!this.scorecard[this.innings]) {
      this._saveCurrentInningsScorecard();
    }

    return {
      innings1: this.scorecard[1],
      innings2: this.scorecard[2],
      result: this.result,
      mom: this.manOfTheMatch,
      phase: this.phase,
    };
  }

  // ── CALCULATE MAN OF THE MATCH ──
  calculateMoM() {
    const candidates = [];

    for (const inn of [1, 2]) {
      const sc = this.scorecard[inn];
      if (!sc) continue;

      // Batsmen — score points for runs, strike rate, boundaries
      sc.batting.forEach(b => {
        let points = b.runs * 1.0;
        if (b.runs >= 50) points += 20;
        if (b.runs >= 100) points += 50;
        points += b.fours * 1;
        points += b.sixes * 2;
        if (b.balls > 0) points += (b.runs / b.balls) * 10; // SR bonus
        candidates.push({
          name: b.name,
          shortName: b.shortName,
          team: sc.battingTeam,
          teamName: sc.battingTeamName,
          flag: sc.battingTeamFlag,
          points,
          stats: `${b.runs}(${b.balls})`,
          type: 'bat',
          innings: inn,
        });
      });

      // Bowlers — score points for wickets, economy
      sc.bowling.forEach(b => {
        let points = b.wickets * 25;
        if (b.wickets >= 3) points += 20;
        if (b.wickets >= 5) points += 50;
        if (b.overs > 0) {
          const eco = b.runs / b.overs;
          if (eco < 6) points += 15;
          if (eco < 4) points += 25;
        }
        candidates.push({
          name: b.name,
          shortName: b.shortName,
          team: sc.bowlingTeam,
          teamName: sc.bowlingTeamName,
          flag: sc.battingTeamFlag, // opponent's flag
          points,
          stats: `${b.overs}-${b.maidens}-${b.runs}-${b.wickets}`,
          type: 'bowl',
          innings: inn,
        });
      });
    }

    // Pick highest scoring candidate
    candidates.sort((a, b) => b.points - a.points);

    if (candidates.length > 0) {
      this.manOfTheMatch = candidates[0];
    }

    return this.manOfTheMatch;
  }

  // ── OUTCOME PROBABILITIES ──
  getOutcomeProbabilities() {
    const bowler = this.currentBowler;
    const batsman = this.striker;
    const phase = this.getPhase();

    let probs = {
      0: 0.35, 1: 0.28, 2: 0.10, 3: 0.02, 4: 0.12, 6: 0.06,
      wicket: 0.05, wide: 0.03, noBall: 0.01,
    };

    // Phase adjustments
    if (phase === 'powerplay') {
      probs[4] *= 1.3; probs[6] *= 1.2; probs[0] *= 0.85; probs.wicket *= 1.1;
    } else if (phase === 'death') {
      probs[4] *= 1.4; probs[6] *= 1.8; probs[0] *= 0.7; probs[1] *= 1.1; probs.wicket *= 1.3; probs.wide *= 1.5;
    }

    // Bowler skill
    if (bowler) {
      const ecoFactor = bowler.economy ? (8.0 / bowler.economy) : 1;
      probs[0] *= ecoFactor; probs[4] /= ecoFactor; probs[6] /= ecoFactor;
      probs.wicket = bowler.wicketProb || probs.wicket;
    }

    // Batsman
    if (batsman) {
      const srFactor = batsman.strikeRate / 140;
      probs[4] *= srFactor; probs[6] *= srFactor; probs[0] /= srFactor;
    }

    // Field setting
    if (this.fieldSetting === 2) { probs.wicket *= 1.3; probs[4] *= 1.2; probs[6] *= 1.15; probs[0] *= 0.85; }
    else if (this.fieldSetting === 0) { probs.wicket *= 0.7; probs[4] *= 0.8; probs[6] *= 0.75; probs[1] *= 1.3; probs[0] *= 1.15; }

    // Chase pressure
    if (this.target) {
      const rrr = parseFloat(this.getRequiredRunRate() || 0);
      if (rrr > 12) { probs.wicket *= 1.4; probs[6] *= 1.5; probs[4] *= 1.3; }
      else if (rrr > 9) { probs.wicket *= 1.2; probs[6] *= 1.2; }
    }

    // Normalize
    const total = Object.values(probs).reduce((s, v) => s + v, 0);
    Object.keys(probs).forEach(k => probs[k] /= total);
    return probs;
  }

  // ── SIMULATE BALL ──
  simulateBall(manualOutcome = null) {
    if (this.isComplete) return null;
    if (!this.currentBowler) return null;

    const outcome = manualOutcome || this._generateOutcome();
    const ballEvent = this._processBallOutcome(outcome);

    this.emit('ball', ballEvent);

    if (this.currentBall >= 6) {
      this._endOver();
    }

    this._checkMatchComplete();
    return ballEvent;
  }

  _generateOutcome() {
    const probs = this.getOutcomeProbabilities();
    const rand = Math.random();
    let cumProb = 0;

    cumProb += probs.wide;
    if (rand < cumProb) return { type: 'wide', runs: 1 };

    cumProb += probs.noBall;
    if (rand < cumProb) return { type: 'noBall', runs: 1 + (Math.random() < 0.3 ? (Math.random() < 0.5 ? 4 : 6) : 0) };

    cumProb += probs.wicket;
    if (rand < cumProb) {
      const dismissals = ['bowled', 'caught', 'lbw', 'stumped', 'run out'];
      const weights = this.currentBowler?.bowlingStyle === 'spin'
        ? [0.15, 0.35, 0.15, 0.2, 0.15]
        : [0.25, 0.4, 0.2, 0.02, 0.13];
      return { type: 'wicket', runs: 0, dismissal: this._weightedRandom(dismissals, weights) };
    }

    const runOptions = [0, 1, 2, 3, 4, 6];
    const runProbs = [probs[0], probs[1], probs[2], probs[3], probs[4], probs[6]];
    const totalRunProb = runProbs.reduce((s, v) => s + v, 0);
    const normRunProbs = runProbs.map(p => p / totalRunProb);

    const runRand = Math.random();
    let runCum = 0;
    for (let i = 0; i < runOptions.length; i++) {
      runCum += normRunProbs[i];
      if (runRand < runCum) return { type: 'runs', runs: runOptions[i] };
    }
    return { type: 'runs', runs: 0 };
  }

  _weightedRandom(items, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  _processBallOutcome(outcome) {
    const ballEvent = {
      over: this.currentOver,
      ball: this.currentBall,
      bowler: { ...this.currentBowler },
      striker: { ...this.striker },
      nonStriker: { ...this.nonStriker },
      outcome: { ...outcome },
      timestamp: Date.now(),
      score: null,
      commentary: ''
    };

    const isLegalDelivery = outcome.type !== 'wide' && outcome.type !== 'noBall';

    if (isLegalDelivery) {
      this.currentBall++;
      this.totalBalls++;
      this.batStats[this.striker.id].balls++;
    }

    if (outcome.type === 'wide') {
      this.runs += outcome.runs;
      this.extras.wides += outcome.runs;
      this.overRuns += outcome.runs;
      this.bowlStats[this.currentBowler.id].runs += outcome.runs;
      ballEvent.commentary = `Wide ball! ${outcome.runs} run(s) added`;
      this.overBalls.push('wd');
    } else if (outcome.type === 'noBall') {
      this.runs += outcome.runs;
      this.extras.noBalls++;
      this.overRuns += outcome.runs;
      this.bowlStats[this.currentBowler.id].runs += outcome.runs;
      const extraRuns = outcome.runs - 1;
      ballEvent.commentary = `No ball!${extraRuns > 0 ? ` Plus ${extraRuns} runs!` : ''}`;
      this.overBalls.push('nb');
    } else if (outcome.type === 'wicket') {
      this.wickets++;
      this.overWickets++;
      this.batStats[this.striker.id].isOut = true;
      this.batStats[this.striker.id].dismissal = this._getDismissalText(outcome.dismissal);
      this.bowlStats[this.currentBowler.id].wickets++;

      ballEvent.commentary = `OUT! ${this.striker.name} ${this._getDismissalText(outcome.dismissal)}! ${this.striker.name} ${this.batStats[this.striker.id].runs}(${this.batStats[this.striker.id].balls})`;

      this.fallOfWickets.push({
        batsman: this.striker.name,
        runs: this.runs,
        overs: this.getOversDisplay(),
        wicketNum: this.wickets
      });

      this.overBalls.push('W');

      if (this.nextBatIdx < this.battingOrder.length && this.wickets < 10) {
        this.striker = this.battingOrder[this.nextBatIdx];
        this.nextBatIdx++;
      }
    } else {
      this.runs += outcome.runs;
      this.overRuns += outcome.runs;
      this.batStats[this.striker.id].runs += outcome.runs;
      this.bowlStats[this.currentBowler.id].runs += outcome.runs;

      if (outcome.runs === 4) {
        this.batStats[this.striker.id].fours++;
        ballEvent.commentary = `FOUR! ${this.striker.name} finds the boundary!`;
        this.overBalls.push('4');
      } else if (outcome.runs === 6) {
        this.batStats[this.striker.id].sixes++;
        ballEvent.commentary = `SIX! ${this.striker.name} launches it into the stands!`;
        this.overBalls.push('6');
      } else if (outcome.runs === 0) {
        ballEvent.commentary = `Dot ball. Good delivery from ${this.currentBowler.shortName}`;
        this.overBalls.push('•');
      } else {
        ballEvent.commentary = `${outcome.runs} run${outcome.runs > 1 ? 's' : ''}. ${this.striker.name} works it away`;
        this.overBalls.push(String(outcome.runs));
      }

      if (outcome.runs % 2 === 1) {
        [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
      }
    }

    ballEvent.score = {
      runs: this.runs,
      wickets: this.wickets,
      overs: this.getOversDisplay(),
      runRate: this.getRunRate(),
      rrr: this.getRequiredRunRate(),
    };

    this.commentary.unshift(ballEvent);
    return ballEvent;
  }

  _getDismissalText(type) {
    switch (type) {
      case 'bowled': return `b ${this.currentBowler.shortName}`;
      case 'caught': return `c & b ${this.currentBowler.shortName}`;
      case 'lbw': return `lbw b ${this.currentBowler.shortName}`;
      case 'stumped': return `st b ${this.currentBowler.shortName}`;
      case 'run out': return 'run out';
      default: return `b ${this.currentBowler.shortName}`;
    }
  }

  _endOver() {
    this.bowlStats[this.currentBowler.id].overs++;
    this.bowlStats[this.currentBowler.id].balls = 0;
    const bs = this.bowlStats[this.currentBowler.id];
    bs.economy = bs.overs > 0 ? (bs.runs / bs.overs).toFixed(1) : '0.0';

    if (this.overRuns === 0) {
      this.bowlStats[this.currentBowler.id].maidens++;
    }

    [this.striker, this.nonStriker] = [this.nonStriker, this.striker];

    const overSummary = {
      overNum: this.currentOver,
      runs: this.overRuns,
      wickets: this.overWickets,
      balls: [...this.overBalls],
      bowler: { ...this.currentBowler }
    };

    this.emit('overEnd', overSummary);

    this.currentOver++;
    this.currentBall = 0;
    this.overRuns = 0;
    this.overWickets = 0;
    this.overBalls = [];
    this.lastBowler = this.currentBowler;
    this.currentBowler = null;
  }

  _checkMatchComplete() {
    if (this.wickets >= 10) { this._endInnings(); return; }
    if (this.currentOver >= this.totalOvers) { this._endInnings(); return; }
    if (this.target && this.runs >= this.target) {
      this.isComplete = true;
      this.phase = 'COMPLETE';
      this._saveCurrentInningsScorecard();
      this.result = {
        winner: this.battingTeamKey,
        winnerName: this.battingTeam.name,
        winnerFlag: this.battingTeam.flag,
        margin: `${10 - this.wickets} wickets`,
        detail: `${this.battingTeam.name} won by ${10 - this.wickets} wickets with ${(this.totalOvers * 6) - this.totalBalls} balls remaining`
      };
      this.calculateMoM();
      this.emit('matchEnd', this.result);
    }
  }

  _endInnings() {
    this._saveCurrentInningsScorecard();

    if (this.innings === 1) {
      this.phase = 'INNINGS_BREAK';
      this.emit('inningsEnd', this.scorecard[1]);
    } else {
      this.isComplete = true;
      this.phase = 'COMPLETE';

      if (this.runs >= this.target) {
        this.result = {
          winner: this.battingTeamKey,
          winnerName: this.battingTeam.name,
          winnerFlag: this.battingTeam.flag,
          margin: `${10 - this.wickets} wickets`,
          detail: `${this.battingTeam.name} won by ${10 - this.wickets} wickets`
        };
      } else if (this.runs === this.target - 1) {
        this.result = { winner: null, margin: 'Tie', detail: 'Match Tied!' };
      } else {
        // First batting team wins (bowling team = one who set the target)
        const firstBatTeam = this.scorecard[1]?.battingTeam;
        const firstBatName = TEAMS[firstBatTeam]?.name || this.bowlingTeam.name;
        const firstBatFlag = TEAMS[firstBatTeam]?.flag || '';
        this.result = {
          winner: firstBatTeam || this.bowlingTeamKey,
          winnerName: firstBatName,
          winnerFlag: firstBatFlag,
          margin: `${this.target - 1 - this.runs} runs`,
          detail: `${firstBatName} won by ${this.target - 1 - this.runs} runs`
        };
      }

      this.calculateMoM();
      this.emit('matchEnd', this.result);
    }
  }

  // ── Start 2nd Innings ──
  startSecondInnings() {
    if (this.innings !== 1) return;
    if (!this.scorecard[1]) this._saveCurrentInningsScorecard();

    this.target = this.scorecard[1].runs + 1;

    // Swap teams
    const tempBat = this.battingTeamKey;
    this.battingTeamKey = this.bowlingTeamKey;
    this.bowlingTeamKey = tempBat;
    this.battingTeam = TEAMS[this.battingTeamKey];
    this.bowlingTeam = TEAMS[this.bowlingTeamKey];

    // Reset state
    this.innings = 2;
    this.phase = 'SECOND_INNINGS';
    this.currentOver = 0;
    this.currentBall = 0;
    this.totalBalls = 0;
    this.runs = 0;
    this.wickets = 0;
    this.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

    this.battingOrder = getBattingOrder(this.battingTeamKey);
    this.striker = this.battingOrder[0];
    this.nonStriker = this.battingOrder[1];
    this.nextBatIdx = 2;
    this.fallOfWickets = [];

    this.batStats = {};
    this.battingOrder.forEach((p, i) => {
      this.batStats[p.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', position: i + 1 };
    });

    this.bowlers = getBowlers(this.bowlingTeamKey);
    this.currentBowler = null;
    this.bowlStats = {};
    this.bowlers.forEach((b, i) => {
      this.bowlStats[b.id] = { overs: 0, balls: 0, runs: 0, wickets: 0, economy: 0, maidens: 0, position: i + 1 };
    });
    this.lastBowler = null;

    this.overRuns = 0;
    this.overWickets = 0;
    this.overBalls = [];
    this.fieldSetting = 1;
    this.reviewsLeft = 2;
    this.commentary = [];

    this.emit('inningsStart', {
      innings: 2,
      battingTeam: this.battingTeamKey,
      bowlingTeam: this.bowlingTeamKey,
      target: this.target
    });
  }

  // ── LOAD FROM LIVE DATA ──
  // Hydrate engine state from API/scraper data without simulation
  loadFromLiveData(parsed) {
    if (!parsed || !parsed.scores || parsed.scores.length === 0) return;

    const scores = parsed.scores;

    // Determine first batting team from score data
    if (scores.length >= 1) {
      const firstInning = scores[0];

      // Update 1st innings if we have it
      if (scores.length >= 2 || this.innings === 1) {
        const sc1 = scores.length >= 2 ? scores[0] : scores[0];
        const firstTeamName = (sc1.inning || sc1.team || '').toLowerCase();

        // If we're still in first innings, update current state
        if (this.innings === 1) {
          this.runs = sc1.runs;
          this.wickets = sc1.wickets;
          const ov = parseFloat(sc1.overs);
          if (!isNaN(ov)) {
            this.currentOver = Math.floor(ov);
            this.currentBall = Math.round((ov % 1) * 10);
            this.totalBalls = this.currentOver * 6 + this.currentBall;
          }
        }

        // If 2nd innings exists, we need to set up for it
        if (scores.length >= 2) {
          // Save 1st innings scorecard
          if (!this.scorecard[1]) {
            this.scorecard[1] = {
              battingTeam: this.battingTeamKey,
              bowlingTeam: this.bowlingTeamKey,
              battingTeamName: this.battingTeam?.name,
              bowlingTeamName: this.bowlingTeam?.name,
              battingTeamFlag: this.battingTeam?.flag,
              runs: scores[0].runs,
              wickets: scores[0].wickets,
              overs: String(scores[0].overs),
              extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              extrasTotal: 0,
              batting: parsed.batting || [],
              bowling: parsed.bowling || [],
              fallOfWickets: [],
              commentary: [],
            };
          }

          // Set up 2nd innings
          if (this.innings === 1) {
            this.target = scores[0].runs + 1;
            this.innings = 2;
            this.phase = 'SECOND_INNINGS';

            // Swap teams
            const tempBat = this.battingTeamKey;
            this.battingTeamKey = this.bowlingTeamKey;
            this.bowlingTeamKey = tempBat;
            this.battingTeam = TEAMS[this.battingTeamKey];
            this.bowlingTeam = TEAMS[this.bowlingTeamKey];
          }

          // Update 2nd innings score
          const sc2 = scores[1];
          this.runs = sc2.runs;
          this.wickets = sc2.wickets;
          const ov2 = parseFloat(sc2.overs);
          if (!isNaN(ov2)) {
            this.currentOver = Math.floor(ov2);
            this.currentBall = Math.round((ov2 % 1) * 10);
            this.totalBalls = this.currentOver * 6 + this.currentBall;
          }
        }
      }
    }

    // Update batsmen from live data
    if (parsed.batting && parsed.batting.length > 0) {
      parsed.batting.forEach(b => {
        // Find matching player in batting order by name
        const player = this.battingOrder.find(p =>
          p.name.toLowerCase().includes(b.name.toLowerCase()) ||
          b.name.toLowerCase().includes(p.shortName.toLowerCase())
        );
        if (player && this.batStats[player.id]) {
          this.batStats[player.id].runs = b.runs || 0;
          this.batStats[player.id].balls = b.balls || 0;
          this.batStats[player.id].fours = b.fours || 0;
          this.batStats[player.id].sixes = b.sixes || 0;
        }
      });
    }

    // Check if match is complete from status
    if (parsed.status) {
      const status = parsed.status.toLowerCase();
      if (status.includes('won') || status.includes('lost') || status.includes('tie')) {
        this.isComplete = true;
        this.phase = 'COMPLETE';
        this._saveCurrentInningsScorecard();
        this.result = {
          detail: parsed.status,
          winner: null,
          margin: parsed.status,
        };
        this.calculateMoM();
      }
    }
  }

  // ── Get match state for market calculations ──
  getMatchState() {
    return {
      innings: this.innings,
      runs: this.runs,
      wickets: this.wickets,
      currentOver: this.currentOver,
      currentBall: this.currentBall,
      totalBalls: this.totalBalls,
      runRate: parseFloat(this.getRunRate()),
      requiredRunRate: this.getRequiredRunRate() ? parseFloat(this.getRequiredRunRate()) : null,
      target: this.target,
      firstInningsScore: this.scorecard[1],
      phase: this.phase,
      battingTeam: this.battingTeamKey,
      bowlingTeam: this.bowlingTeamKey,
      striker: this.striker,
      nonStriker: this.nonStriker,
      currentBowler: this.currentBowler,
      fieldSetting: this.fieldSetting,
      isComplete: this.isComplete,
      overRuns: this.overRuns,
      overWickets: this.overWickets,
      overBalls: [...this.overBalls],
      reviewsLeft: this.reviewsLeft,
    };
  }
}
