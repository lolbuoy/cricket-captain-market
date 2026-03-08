// ============================================
// matchEngine.js — Ball-by-Ball Match Simulation Engine
// ============================================

class MatchEngine {
  constructor(battingTeamKey, bowlingTeamKey) {
    this.battingTeamKey = battingTeamKey;
    this.bowlingTeamKey = bowlingTeamKey;
    this.battingTeam = TEAMS[battingTeamKey];
    this.bowlingTeam = TEAMS[bowlingTeamKey];

    // Match state
    this.innings = 1;
    this.totalOvers = 20;
    this.currentOver = 0;
    this.currentBall = 0; // balls in current over (0-5)
    this.totalBalls = 0;
    this.runs = 0;
    this.wickets = 0;
    this.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

    // Target (for 2nd innings)
    this.target = null;
    this.firstInningsScore = null;

    // Batting
    this.battingOrder = getBattingOrder(battingTeamKey);
    this.striker = this.battingOrder[0];
    this.nonStriker = this.battingOrder[1];
    this.nextBatIdx = 2;
    this.fallOfWickets = [];

    // Individual batting stats
    this.batStats = {};
    this.battingOrder.forEach(p => {
      this.batStats[p.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '' };
    });

    // Bowling
    this.bowlers = getBowlers(bowlingTeamKey);
    this.currentBowler = null;
    this.bowlStats = {};
    this.bowlers.forEach(b => {
      this.bowlStats[b.id] = { overs: 0, balls: 0, runs: 0, wickets: 0, economy: 0, maidens: 0 };
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
    this.fieldSetting = setting; // 0=defensive, 1=balanced, 2=attacking
  }

  selectBowler(bowlerId) {
    const bowler = this.bowlers.find(b => b.id === bowlerId);
    if (!bowler) return false;
    if (this.bowlStats[bowlerId].overs >= 4) return false; // max 4 overs
    if (this.lastBowler && this.lastBowler.id === bowlerId) return false; // can't bowl consecutive
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

  // Calculate outcome probabilities based on game state
  getOutcomeProbabilities() {
    const bowler = this.currentBowler;
    const batsman = this.striker;
    const phase = this.getPhase();

    // Base probabilities
    let probs = {
      0: 0.35,  // dot ball
      1: 0.28,  // single
      2: 0.10,  // double
      3: 0.02,  // triple
      4: 0.12,  // four
      6: 0.06,  // six
      wicket: 0.05,
      wide: 0.03,
      noBall: 0.01,
    };

    // Adjust for phase
    if (phase === 'powerplay') {
      probs[4] *= 1.3;
      probs[6] *= 1.2;
      probs[0] *= 0.85;
      probs.wicket *= 1.1;
    } else if (phase === 'death') {
      probs[4] *= 1.4;
      probs[6] *= 1.8;
      probs[0] *= 0.7;
      probs[1] *= 1.1;
      probs.wicket *= 1.3;
      probs.wide *= 1.5;
    }

    // Adjust for bowler skill
    if (bowler) {
      const ecoFactor = bowler.economy ? (8.0 / bowler.economy) : 1;
      probs[0] *= ecoFactor;
      probs[4] /= ecoFactor;
      probs[6] /= ecoFactor;
      probs.wicket = bowler.wicketProb || probs.wicket;
    }

    // Adjust for batsman
    if (batsman) {
      const srFactor = batsman.strikeRate / 140;
      probs[4] *= srFactor;
      probs[6] *= srFactor;
      probs[0] /= srFactor;
    }

    // Adjust for field setting
    if (this.fieldSetting === 2) { // attacking
      probs.wicket *= 1.3;
      probs[4] *= 1.2;
      probs[6] *= 1.15;
      probs[0] *= 0.85;
    } else if (this.fieldSetting === 0) { // defensive
      probs.wicket *= 0.7;
      probs[4] *= 0.8;
      probs[6] *= 0.75;
      probs[1] *= 1.3;
      probs[0] *= 1.15;
    }

    // Chase pressure (2nd innings)
    if (this.target) {
      const rrr = parseFloat(this.getRequiredRunRate() || 0);
      if (rrr > 12) {
        probs.wicket *= 1.4;
        probs[6] *= 1.5;
        probs[4] *= 1.3;
      } else if (rrr > 9) {
        probs.wicket *= 1.2;
        probs[6] *= 1.2;
      }
    }

    // Normalize
    const total = Object.values(probs).reduce((s, v) => s + v, 0);
    Object.keys(probs).forEach(k => probs[k] /= total);

    return probs;
  }

  // Simulate a single ball
  simulateBall(manualOutcome = null) {
    if (this.isComplete) return null;
    if (!this.currentBowler) return null;

    let outcome;

    if (manualOutcome) {
      outcome = manualOutcome;
    } else {
      outcome = this._generateOutcome();
    }

    // Process the outcome
    const ballEvent = this._processBallOutcome(outcome);

    // Emit events
    this.emit('ball', ballEvent);

    // Check end of over
    if (this.currentBall >= 6) {
      this._endOver();
    }

    // Check match complete
    this._checkMatchComplete();

    return ballEvent;
  }

  _generateOutcome() {
    const probs = this.getOutcomeProbabilities();
    const rand = Math.random();
    let cumProb = 0;

    // Check wide first
    cumProb += probs.wide;
    if (rand < cumProb) return { type: 'wide', runs: 1 };

    // Check no ball
    cumProb += probs.noBall;
    if (rand < cumProb) return { type: 'noBall', runs: 1 + (Math.random() < 0.3 ? (Math.random() < 0.5 ? 4 : 6) : 0) };

    // Check wicket
    cumProb += probs.wicket;
    if (rand < cumProb) {
      const dismissals = ['bowled', 'caught', 'lbw', 'stumped', 'run out'];
      const weights = this.currentBowler?.bowlingStyle === 'spin'
        ? [0.15, 0.35, 0.15, 0.2, 0.15]
        : [0.25, 0.4, 0.2, 0.02, 0.13];
      const dismissal = this._weightedRandom(dismissals, weights);
      return { type: 'wicket', runs: 0, dismissal };
    }

    // Runs
    const runOptions = [0, 1, 2, 3, 4, 6];
    const runProbs = [probs[0], probs[1], probs[2], probs[3], probs[4], probs[6]];
    const totalRunProb = runProbs.reduce((s, v) => s + v, 0);
    const normRunProbs = runProbs.map(p => p / totalRunProb);

    const runRand = Math.random();
    let runCum = 0;
    for (let i = 0; i < runOptions.length; i++) {
      runCum += normRunProbs[i];
      if (runRand < runCum) {
        return { type: 'runs', runs: runOptions[i] };
      }
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
      this.batStats[this.striker.id].dismissal = outcome.dismissal;
      this.bowlStats[this.currentBowler.id].wickets++;

      const dismissalText = this._getDismissalText(outcome.dismissal);
      ballEvent.commentary = `OUT! ${this.striker.name} ${dismissalText}! ${this.striker.name} ${this.batStats[this.striker.id].runs}(${this.batStats[this.striker.id].balls})`;

      this.fallOfWickets.push({
        batsman: this.striker.name,
        runs: this.runs,
        overs: this.getOversDisplay(),
        wicketNum: this.wickets
      });

      this.overBalls.push('W');

      // New batsman
      if (this.nextBatIdx < this.battingOrder.length && this.wickets < 10) {
        this.striker = this.battingOrder[this.nextBatIdx];
        this.nextBatIdx++;
      }
    } else {
      // Normal runs
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

      // Rotate strike on odd runs
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
    // Update bowler stats
    this.bowlStats[this.currentBowler.id].overs++;
    this.bowlStats[this.currentBowler.id].balls = 0;
    const bs = this.bowlStats[this.currentBowler.id];
    bs.economy = bs.overs > 0 ? (bs.runs / bs.overs).toFixed(1) : '0.0';

    if (this.overRuns === 0) {
      this.bowlStats[this.currentBowler.id].maidens++;
    }

    // Rotate strike at end of over
    [this.striker, this.nonStriker] = [this.nonStriker, this.striker];

    const overSummary = {
      overNum: this.currentOver,
      runs: this.overRuns,
      wickets: this.overWickets,
      balls: [...this.overBalls],
      bowler: { ...this.currentBowler }
    };

    this.emit('overEnd', overSummary);

    // Reset over tracking
    this.currentOver++;
    this.currentBall = 0;
    this.overRuns = 0;
    this.overWickets = 0;
    this.overBalls = [];
    this.lastBowler = this.currentBowler;
    this.currentBowler = null;
  }

  _checkMatchComplete() {
    // All out
    if (this.wickets >= 10) {
      this._endInnings();
      return;
    }
    // Overs complete
    if (this.currentOver >= this.totalOvers) {
      this._endInnings();
      return;
    }
    // Target achieved
    if (this.target && this.runs >= this.target) {
      this.isComplete = true;
      this.result = {
        winner: this.battingTeamKey,
        margin: `${10 - this.wickets} wickets`,
        detail: `${this.battingTeam.name} won by ${10 - this.wickets} wickets with ${(this.totalOvers * 6) - this.totalBalls} balls remaining`
      };
      this.emit('matchEnd', this.result);
    }
  }

  _endInnings() {
    if (this.innings === 1) {
      this.firstInningsScore = {
        runs: this.runs,
        wickets: this.wickets,
        overs: this.getOversDisplay(),
        battingTeam: this.battingTeamKey,
        batStats: { ...this.batStats },
        bowlStats: { ...this.bowlStats },
        commentary: [...this.commentary]
      };
      this.emit('inningsEnd', this.firstInningsScore);
    } else {
      // Match complete
      this.isComplete = true;
      if (this.runs >= this.target) {
        this.result = {
          winner: this.battingTeamKey,
          margin: `${10 - this.wickets} wickets`,
          detail: `${this.battingTeam.name} won by ${10 - this.wickets} wickets`
        };
      } else if (this.runs === this.target - 1) {
        this.result = {
          winner: null,
          margin: 'Tie',
          detail: 'Match Tied!'
        };
      } else {
        this.result = {
          winner: this.bowlingTeamKey,
          margin: `${this.target - 1 - this.runs} runs`,
          detail: `${this.bowlingTeam.name} won by ${this.target - 1 - this.runs} runs`
        };
      }
      this.emit('matchEnd', this.result);
    }
  }

  // Start 2nd innings
  startSecondInnings() {
    if (this.innings !== 1) return;
    const firstScore = this.firstInningsScore;
    this.target = firstScore.runs + 1;

    // Swap teams
    const tempBat = this.battingTeamKey;
    this.battingTeamKey = this.bowlingTeamKey;
    this.bowlingTeamKey = tempBat;
    this.battingTeam = TEAMS[this.battingTeamKey];
    this.bowlingTeam = TEAMS[this.bowlingTeamKey];

    // Reset state
    this.innings = 2;
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
    this.battingOrder.forEach(p => {
      this.batStats[p.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '' };
    });

    this.bowlers = getBowlers(this.bowlingTeamKey);
    this.currentBowler = null;
    this.bowlStats = {};
    this.bowlers.forEach(b => {
      this.bowlStats[b.id] = { overs: 0, balls: 0, runs: 0, wickets: 0, economy: 0, maidens: 0 };
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

  // Get full match state for market calculations
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
      firstInningsScore: this.firstInningsScore,
      phase: this.getPhase(),
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
