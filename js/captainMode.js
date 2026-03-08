// ============================================
// captainMode.js — Captain Tactical Decisions
// ============================================

class CaptainMode {
  constructor(engine, market) {
    this.engine = engine;
    this.market = market;
    this.captainScore = 0;
    this.decisions = [];
    this.autoSimulate = false;
    this.needsBowlerSelection = true;
  }

  // Score captain decisions
  scoreDecision(type, params) {
    let points = 0;
    let feedback = '';

    switch (type) {
      case 'bowlerSelection': {
        const bowler = params.bowler;
        const phase = this.engine.getPhase();
        // Reward matching bowler type to phase
        if (phase === 'powerplay' && bowler.bowlingStyle === 'pace') {
          points = 10;
          feedback = 'Good choice! Pace in powerplay creates early pressure.';
        } else if (phase === 'middle' && bowler.bowlingStyle === 'spin') {
          points = 10;
          feedback = 'Smart! Spinners thrive in the middle overs.';
        } else if (phase === 'death' && bowler.bowlingStyle === 'pace' && bowler.wicketProb > 0.15) {
          points = 15;
          feedback = 'Excellent! Your best death bowler at the crucial phase.';
        } else {
          points = 5;
          feedback = 'Decent choice.';
        }
        break;
      }

      case 'fieldSetting': {
        const setting = params.setting;
        const wickets = this.engine.wickets;
        const phase = this.engine.getPhase();

        if (setting === 2 && wickets < 3 && phase === 'powerplay') {
          points = 10;
          feedback = 'Aggressive in the powerplay! Bold call.';
        } else if (setting === 0 && phase === 'death' && this.engine.target) {
          const rrr = parseFloat(this.engine.getRequiredRunRate() || 0);
          if (rrr > 12) {
            points = 5;
            feedback = 'Defensive when they need to go big — risky but could pay off.';
          } else {
            points = 8;
            feedback = 'Defensive to protect runs. Smart.';
          }
        } else if (setting === 2 && wickets >= 6) {
          points = 12;
          feedback = 'Going for the kill with the tail! Captaincy masterclass.';
        } else {
          points = 5;
          feedback = 'Standard field placement.';
        }
        break;
      }

      case 'drsReview': {
        // Random DRS outcome (would be better with actual data)
        const success = Math.random() < 0.35; // DRS success rate ~35%
        if (success) {
          points = 20;
          feedback = '🟢 DRS SUCCESSFUL! Brilliant review!';
        } else {
          points = -10;
          feedback = '🔴 DRS FAILED! Wasted review.';
          this.engine.reviewsLeft--;
        }
        break;
      }
    }

    this.captainScore += points;
    const decision = {
      type,
      points,
      feedback,
      timestamp: Date.now(),
      matchState: { ...this.engine.getMatchState() }
    };
    this.decisions.push(decision);

    return decision;
  }

  getCaptainRating() {
    const maxPossible = this.decisions.length * 15;
    if (maxPossible === 0) return { rating: 'N/A', score: 0, stars: 0 };

    const percent = (this.captainScore / maxPossible) * 100;
    let rating, stars;

    if (percent >= 80) { rating = 'Legendary'; stars = 5; }
    else if (percent >= 65) { rating = 'Excellent'; stars = 4; }
    else if (percent >= 50) { rating = 'Good'; stars = 3; }
    else if (percent >= 35) { rating = 'Average'; stars = 2; }
    else { rating = 'Poor'; stars = 1; }

    return { rating, score: this.captainScore, stars, percent: percent.toFixed(0) };
  }

  // Get recommended bowler (AI suggestion)
  getRecommendedBowler() {
    const available = this.engine.getAvailableBowlers();
    const phase = this.engine.getPhase();

    // Sort by best match for current phase
    const scored = available.map(b => {
      let score = 0;
      if (phase === 'powerplay' && b.bowlingStyle === 'pace') score += 3;
      if (phase === 'middle' && b.bowlingStyle === 'spin') score += 3;
      if (phase === 'death' && b.bowlingStyle === 'pace') score += 2;
      score += b.wicketProb * 10;
      score -= (b.economy || 8) * 0.3;
      // Prefer bowlers with overs remaining
      const oversLeft = 4 - (this.engine.bowlStats[b.id]?.overs || 0);
      score += oversLeft * 0.5;
      return { bowler: b, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.bowler || available[0];
  }
}
