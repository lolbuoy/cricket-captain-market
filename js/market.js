// ============================================
// market.js — Polymarket-style Prediction Market Engine
// ============================================

class PredictionMarket {
  constructor() {
    this.markets = [];
    this.portfolio = {
      cash: 10000,
      positions: [], // { marketId, side: 'yes'|'no', shares, avgPrice, timestamp }
      history: [],   // resolved trades
    };
    this.nextMarketId = 1;
  }

  // LMSR-inspired cost function
  _lmsrCost(q, b = 100) {
    return b * Math.log(Math.exp(q / b));
  }

  // Create a new market
  createMarket(config) {
    const market = {
      id: this.nextMarketId++,
      title: config.title,
      description: config.description || '',
      category: config.category || 'general', // 'match', 'over', 'innings', 'player'
      resolvesAt: config.resolvesAt || 'manual', // 'overEnd', 'inningsEnd', 'matchEnd', 'manual'
      resolveOverNum: config.resolveOverNum || null,
      status: 'open', // 'open', 'resolved', 'cancelled'

      // Odds
      yesPrice: config.initialYesPrice || 0.5,
      noPrice: null,
      yesVolume: 0,
      noVolume: 0,

      // Resolution
      resolvedOutcome: null, // 'yes' or 'no'
      resolvedAt: null,

      // Odds history for charts
      priceHistory: [],

      // Config
      icon: config.icon || '📊',
      createdAt: Date.now(),
    };

    market.noPrice = parseFloat((1 - market.yesPrice).toFixed(3));
    market.priceHistory.push({
      time: Date.now(),
      yes: market.yesPrice,
      no: market.noPrice
    });

    this.markets.push(market);
    return market;
  }

  // Initialize standard markets for match start
  initializeMatchMarkets(battingTeamKey, bowlingTeamKey) {
    const bat = TEAMS[battingTeamKey];
    const bowl = TEAMS[bowlingTeamKey];

    // Match winner
    this.createMarket({
      title: `${bat.flag} ${bat.shortName} wins the match`,
      category: 'match',
      resolvesAt: 'matchEnd',
      initialYesPrice: 0.55,
      icon: '🏆'
    });

    // First innings total
    this.createMarket({
      title: `First innings Over 165.5 runs`,
      category: 'innings',
      resolvesAt: 'inningsEnd',
      initialYesPrice: 0.45,
      icon: '📊'
    });

    // Powerplay score
    this.createMarket({
      title: `Powerplay Over 50.5 runs`,
      category: 'phase',
      resolvesAt: 'overEnd',
      resolveOverNum: 6,
      initialYesPrice: 0.50,
      icon: '⚡'
    });
  }

  // Create per-over markets
  createOverMarkets(overNum, matchState) {
    // Wicket this over
    const wicketProb = this._estimateWicketProb(matchState);
    this.createMarket({
      title: `Wicket in Over ${overNum + 1}?`,
      category: 'over',
      resolvesAt: 'overEnd',
      resolveOverNum: overNum + 1,
      initialYesPrice: parseFloat(wicketProb.toFixed(2)),
      icon: '🎯'
    });

    // Runs this over
    const expectedRuns = this._estimateOverRuns(matchState);
    const line = Math.round(expectedRuns) + 0.5;
    this.createMarket({
      title: `Over ${overNum + 1}: Over/Under ${line} runs`,
      category: 'over',
      resolvesAt: 'overEnd',
      resolveOverNum: overNum + 1,
      initialYesPrice: 0.50,
      icon: '🏏'
    });

    // Six this over
    this.createMarket({
      title: `Six hit in Over ${overNum + 1}?`,
      category: 'over',
      resolvesAt: 'overEnd',
      resolveOverNum: overNum + 1,
      initialYesPrice: parseFloat(this._estimateSixProb(matchState).toFixed(2)),
      icon: '💥'
    });
  }

  _estimateWicketProb(state) {
    let base = 0.25; // ~25% chance of wicket in any over
    if (state.phase === 'powerplay') base = 0.22;
    if (state.phase === 'death') base = 0.32;
    if (state.wickets >= 7) base *= 1.3;
    if (state.fieldSetting === 2) base *= 1.2;
    if (state.fieldSetting === 0) base *= 0.8;
    return Math.min(0.85, Math.max(0.10, base));
  }

  _estimateOverRuns(state) {
    let base = 8;
    if (state.phase === 'powerplay') base = 8.5;
    if (state.phase === 'death') base = 10.5;
    if (state.phase === 'middle') base = 7.5;
    if (state.target) {
      const rrr = state.requiredRunRate;
      if (rrr > 12) base += 2;
      else if (rrr > 9) base += 1;
    }
    return base;
  }

  _estimateSixProb(state) {
    let base = 0.30;
    if (state.phase === 'powerplay') base = 0.28;
    if (state.phase === 'death') base = 0.45;
    if (state.fieldSetting === 2) base *= 1.1;
    return Math.min(0.80, Math.max(0.10, base));
  }

  // Update odds based on match events
  updateOdds(matchState) {
    this.markets.forEach(market => {
      if (market.status !== 'open') return;

      const oldYes = market.yesPrice;

      if (market.category === 'match') {
        market.yesPrice = this._calcMatchWinnerOdds(matchState);
      } else if (market.title.includes('Powerplay') && market.category === 'phase') {
        market.yesPrice = this._calcPowerplayOdds(matchState);
      } else if (market.title.includes('First innings Over') && market.category === 'innings') {
        market.yesPrice = this._calcInningsTotalOdds(matchState, 165.5);
      } else if (market.title.includes('Wicket in Over') && market.category === 'over') {
        market.yesPrice = this._calcWicketOverOdds(matchState, market);
      } else if (market.title.includes('Over/Under') && market.category === 'over') {
        market.yesPrice = this._calcOverRunsOdds(matchState, market);
      } else if (market.title.includes('Six hit') && market.category === 'over') {
        market.yesPrice = this._calcSixOverOdds(matchState, market);
      }

      market.yesPrice = parseFloat(Math.min(0.95, Math.max(0.05, market.yesPrice)).toFixed(3));
      market.noPrice = parseFloat((1 - market.yesPrice).toFixed(3));

      if (Math.abs(oldYes - market.yesPrice) > 0.005) {
        market.priceHistory.push({
          time: Date.now(),
          yes: market.yesPrice,
          no: market.noPrice
        });
      }
    });
  }

  _calcMatchWinnerOdds(state) {
    if (state.innings === 1) {
      // First innings: adjust based on scoring rate
      const rr = state.runRate || 0;
      const projectedScore = rr * 20;
      let prob = 0.55;
      if (projectedScore > 180) prob = 0.65;
      else if (projectedScore > 160) prob = 0.58;
      else if (projectedScore < 130) prob = 0.40;
      else if (projectedScore < 150) prob = 0.48;

      // Wickets falling = lower for batting team
      prob -= state.wickets * 0.03;
      return prob;
    } else {
      // Second innings: chase dynamics
      const ballsLeft = (20 * 6) - state.totalBalls;
      const runsNeeded = state.target - state.runs;

      if (runsNeeded <= 0) return 0.99;
      if (ballsLeft <= 0) return 0.01;

      const rrr = (runsNeeded / ballsLeft) * 6;
      const wicketsLeft = 10 - state.wickets;

      // Base chase probability
      let prob;
      if (rrr < 6) prob = 0.80;
      else if (rrr < 8) prob = 0.65;
      else if (rrr < 10) prob = 0.45;
      else if (rrr < 12) prob = 0.30;
      else if (rrr < 15) prob = 0.15;
      else prob = 0.05;

      // Wickets factor
      prob *= (wicketsLeft / 10) * 0.5 + 0.5;

      // The match winner market was for the team that batted first!
      // So high chase probability = low first team win probability
      return 1 - prob;
    }
  }

  _calcPowerplayOdds(state) {
    if (state.currentOver >= 6) {
      // Already past powerplay
      return state.runs > 50.5 ? 0.95 : 0.05;
    }
    const oversLeft = 6 - (state.currentOver + state.currentBall / 6);
    const projectedPP = state.runs + (state.runRate || 8) * oversLeft;
    let prob = 0.5;
    if (projectedPP > 60) prob = 0.75;
    else if (projectedPP > 55) prob = 0.65;
    else if (projectedPP > 50) prob = 0.55;
    else if (projectedPP < 40) prob = 0.25;
    else if (projectedPP < 45) prob = 0.35;
    return prob;
  }

  _calcInningsTotalOdds(state, line) {
    if (state.innings === 2 || state.currentOver >= 20) {
      return state.runs > line ? 0.95 : 0.05;
    }
    const oversLeft = 20 - (state.currentOver + state.currentBall / 6);
    const projected = state.runs + (state.runRate || 8) * oversLeft;
    const diff = projected - line;
    return 0.5 + (diff / 60); // Simple linear mapping
  }

  _calcWicketOverOdds(state, market) {
    if (state.overWickets > 0) return 0.95; // Already got a wicket this over
    const ballsLeft = 6 - state.currentBall;
    // Probability of at least one wicket in remaining balls
    const probPerBall = state.phase === 'death' ? 0.06 : 0.05;
    const probNoWicket = Math.pow(1 - probPerBall, ballsLeft);
    return 1 - probNoWicket;
  }

  _calcOverRunsOdds(state, market) {
    const lineMatch = market.title.match(/Over\/Under ([\d.]+)/);
    if (!lineMatch) return 0.5;
    const line = parseFloat(lineMatch[1]);
    const ballsLeft = 6 - state.currentBall;
    const expectedRemaining = (state.phase === 'death' ? 1.7 : 1.3) * ballsLeft;
    const projected = state.overRuns + expectedRemaining;
    const diff = projected - line;
    return Math.min(0.90, Math.max(0.10, 0.5 + diff / 15));
  }

  _calcSixOverOdds(state, market) {
    // Check if six already hit
    if (state.overBalls.some(b => b === '6')) return 0.95;
    const ballsLeft = 6 - state.currentBall;
    const sixProbPerBall = state.phase === 'death' ? 0.12 : 0.08;
    const probNoSix = Math.pow(1 - sixProbPerBall, ballsLeft);
    return 1 - probNoSix;
  }

  // Buy shares
  buyShares(marketId, side, amount) {
    const market = this.markets.find(m => m.id === marketId);
    if (!market || market.status !== 'open') return null;
    if (amount <= 0 || amount > this.portfolio.cash) return null;

    const price = side === 'yes' ? market.yesPrice : market.noPrice;
    const shares = amount / price;

    this.portfolio.cash -= amount;
    market[side === 'yes' ? 'yesVolume' : 'noVolume'] += amount;

    // Check if position exists
    const existing = this.portfolio.positions.find(p => p.marketId === marketId && p.side === side);
    if (existing) {
      const totalShares = existing.shares + shares;
      existing.avgPrice = ((existing.avgPrice * existing.shares) + (price * shares)) / totalShares;
      existing.shares = totalShares;
    } else {
      this.portfolio.positions.push({
        marketId,
        side,
        shares,
        avgPrice: price,
        timestamp: Date.now(),
        marketTitle: market.title,
        marketIcon: market.icon,
      });
    }

    return {
      shares,
      price,
      total: amount,
      side,
      market: market.title
    };
  }

  // Sell shares
  sellShares(marketId, side, sharesToSell) {
    const position = this.portfolio.positions.find(p => p.marketId === marketId && p.side === side);
    if (!position || sharesToSell > position.shares) return null;

    const market = this.markets.find(m => m.id === marketId);
    if (!market || market.status !== 'open') return null;

    const price = side === 'yes' ? market.yesPrice : market.noPrice;
    const proceeds = sharesToSell * price;

    this.portfolio.cash += proceeds;
    position.shares -= sharesToSell;

    if (position.shares <= 0) {
      this.portfolio.positions = this.portfolio.positions.filter(p => !(p.marketId === marketId && p.side === side));
    }

    return { sharesToSell, price, proceeds };
  }

  // Resolve a market
  resolveMarket(marketId, outcome) {
    const market = this.markets.find(m => m.id === marketId);
    if (!market || market.status !== 'open') return;

    market.status = 'resolved';
    market.resolvedOutcome = outcome; // 'yes' or 'no'
    market.resolvedAt = Date.now();

    // Settle positions
    const positions = this.portfolio.positions.filter(p => p.marketId === marketId);
    positions.forEach(pos => {
      let payout = 0;
      if (pos.side === outcome) {
        payout = pos.shares * 1; // Each winning share pays $1
      }
      const cost = pos.shares * pos.avgPrice;
      const pnl = payout - cost;

      this.portfolio.cash += payout;
      this.portfolio.history.push({
        marketId,
        marketTitle: pos.marketTitle,
        marketIcon: pos.marketIcon,
        side: pos.side,
        outcome,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        payout,
        pnl,
        resolvedAt: Date.now()
      });
    });

    // Remove resolved positions
    this.portfolio.positions = this.portfolio.positions.filter(p => p.marketId !== marketId);
  }

  // Resolve over-end markets
  resolveOverMarkets(overNum, matchState) {
    this.markets.forEach(market => {
      if (market.status !== 'open') return;
      if (market.resolvesAt !== 'overEnd') return;
      if (market.resolveOverNum !== overNum + 1) return;

      if (market.title.includes('Wicket')) {
        this.resolveMarket(market.id, matchState.overWickets > 0 ? 'yes' : 'no');
      } else if (market.title.includes('Over/Under')) {
        const lineMatch = market.title.match(/Over\/Under ([\d.]+)/);
        if (lineMatch) {
          const line = parseFloat(lineMatch[1]);
          this.resolveMarket(market.id, matchState.overRuns > line ? 'yes' : 'no');
        }
      } else if (market.title.includes('Six hit')) {
        const hadSix = matchState.overBalls.some(b => b === '6');
        this.resolveMarket(market.id, hadSix ? 'yes' : 'no');
      } else if (market.title.includes('Powerplay')) {
        this.resolveMarket(market.id, matchState.runs > 50.5 ? 'yes' : 'no');
      }
    });
  }

  // Resolve innings-end markets
  resolveInningsMarkets(inningsScore) {
    this.markets.forEach(market => {
      if (market.status !== 'open') return;
      if (market.resolvesAt !== 'inningsEnd') return;

      if (market.title.includes('First innings Over')) {
        const lineMatch = market.title.match(/Over ([\d.]+)/);
        if (lineMatch) {
          const line = parseFloat(lineMatch[1]);
          this.resolveMarket(market.id, inningsScore.runs > line ? 'yes' : 'no');
        }
      }
    });
  }

  // Resolve match-end markets
  resolveMatchMarkets(result, firstBattingTeam) {
    this.markets.forEach(market => {
      if (market.status !== 'open') return;
      if (market.resolvesAt !== 'matchEnd') return;

      if (market.category === 'match') {
        // Match winner market was for the first batting team
        const firstBatWon = result.winner === firstBattingTeam;
        this.resolveMarket(market.id, firstBatWon ? 'yes' : 'no');
      }
    });
  }

  // Get portfolio summary
  getPortfolioSummary() {
    let unrealizedPnL = 0;
    const activePositions = this.portfolio.positions.map(pos => {
      const market = this.markets.find(m => m.id === pos.marketId);
      const currentPrice = market ? (pos.side === 'yes' ? market.yesPrice : market.noPrice) : pos.avgPrice;
      const currentValue = pos.shares * currentPrice;
      const cost = pos.shares * pos.avgPrice;
      const pnl = currentValue - cost;
      unrealizedPnL += pnl;

      return {
        ...pos,
        currentPrice,
        currentValue,
        cost,
        pnl,
        pnlPercent: ((pnl / cost) * 100).toFixed(1),
      };
    });

    const realizedPnL = this.portfolio.history.reduce((sum, h) => sum + h.pnl, 0);
    const totalValue = this.portfolio.cash + activePositions.reduce((sum, p) => sum + p.currentValue, 0);

    return {
      cash: this.portfolio.cash,
      totalValue,
      unrealizedPnL,
      realizedPnL,
      totalPnL: unrealizedPnL + realizedPnL,
      positions: activePositions,
      history: this.portfolio.history,
      startingCapital: 10000,
      returnPercent: (((totalValue - 10000) / 10000) * 100).toFixed(1),
    };
  }

  // Get open markets
  getOpenMarkets() {
    return this.markets.filter(m => m.status === 'open');
  }

  getResolvedMarkets() {
    return this.markets.filter(m => m.status === 'resolved');
  }
}
