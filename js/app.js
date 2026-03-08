// ============================================
// app.js — Main Application Controller
// ============================================

class App {
  constructor() {
    this.ui = new GameUI();
    this.api = new CricketAPI();
    this.engine = null;
    this.market = null;
    this.captain = null;

    this.userTeam = null;
    this.opponentTeam = null;
    this.firstBattingTeam = null;
    this.gamePhase = 'start'; // start, toss, playing, inningsBreak, matchEnd

    this.init();
  }

  init() {
    document.getElementById('app').innerHTML = this.ui.renderStartScreen();
  }

  // ── Toss Flow ──
  startToss() {
    document.getElementById('start-screen').remove();
    document.getElementById('app').innerHTML = this.ui.renderTossScreen();
    this.gamePhase = 'toss';
  }

  selectTossTeam(teamKey) {
    this.userTeam = teamKey;
    this.opponentTeam = teamKey === 'india' ? 'newZealand' : 'india';

    document.querySelectorAll('.toss-team').forEach(el => el.classList.remove('selected'));
    document.getElementById(teamKey === 'india' ? 'toss-india' : 'toss-nz').classList.add('selected');

    document.getElementById('toss-choice').style.display = 'block';
  }

  tossDecision(choice) {
    if (choice === 'bat') {
      this.firstBattingTeam = this.userTeam;
    } else {
      this.firstBattingTeam = this.opponentTeam;
    }

    const userTeamName = TEAMS[this.userTeam].name;
    const batFirstName = TEAMS[this.firstBattingTeam].name;
    this.ui.showToast(`${userTeamName} won the toss and chose to ${choice} first!`, 'success');

    // Remove toss screen and start match
    setTimeout(() => this.startMatch(), 800);
  }

  // ── Match Start ──
  startMatch() {
    const bowlingFirst = this.firstBattingTeam === this.userTeam ? this.opponentTeam : this.userTeam;

    // Initialize engine
    this.engine = new MatchEngine(this.firstBattingTeam, bowlingFirst);
    this.market = new PredictionMarket();
    this.captain = new CaptainMode(this.engine, this.market);

    // Set up event listeners
    this.engine.on('ball', (event) => this.onBall(event));
    this.engine.on('overEnd', (summary) => this.onOverEnd(summary));
    this.engine.on('inningsEnd', (data) => this.onInningsEnd(data));
    this.engine.on('matchEnd', (result) => this.onMatchEnd(result));

    // Initialize markets
    this.market.initializeMatchMarkets(this.firstBattingTeam, bowlingFirst);

    // Render game
    const tossScreen = document.getElementById('toss-screen');
    if (tossScreen) tossScreen.remove();
    document.getElementById('app').innerHTML = this.ui.renderGameLayout();

    this.gamePhase = 'playing';

    // Create first over markets
    this.market.createOverMarkets(0, this.engine.getMatchState());

    // Initial render
    this.updateAllUI();

    // Check if user is bowling team — they make captain decisions
    this.ui.showToast(`${TEAMS[this.firstBattingTeam].name} batting first. Select your bowler!`, 'info');
  }

  // ── Captain Actions ──
  selectBowler(bowlerId) {
    const success = this.engine.selectBowler(bowlerId);
    if (success) {
      const bowler = this.engine.currentBowler;
      const decision = this.captain.scoreDecision('bowlerSelection', { bowler });
      document.getElementById('captain-feedback').textContent = decision.feedback;
      document.getElementById('captain-score-header').textContent = this.captain.captainScore;
      this.updateAllUI();
    }
  }

  setField(setting) {
    this.engine.setFieldSetting(setting);
    const decision = this.captain.scoreDecision('fieldSetting', { setting });
    document.getElementById('captain-feedback').textContent = decision.feedback;
    document.getElementById('captain-score-header').textContent = this.captain.captainScore;
    this.updateAllUI();
  }

  useDRS() {
    if (this.engine.reviewsLeft <= 0) {
      this.ui.showToast('No reviews remaining!', 'error');
      return;
    }
    const decision = this.captain.scoreDecision('drsReview', {});
    this.ui.showToast(decision.feedback, decision.points > 0 ? 'success' : 'error');
    document.getElementById('captain-score-header').textContent = this.captain.captainScore;
    this.updateAllUI();
  }

  // ── Ball Actions ──
  bowlNextBall() {
    if (!this.engine.currentBowler) {
      this.ui.showToast('Select a bowler first!', 'warning');
      return;
    }

    if (this.engine.isComplete) return;

    const ballEvent = this.engine.simulateBall();
    if (!ballEvent) return;

    // Update markets after each ball
    this.market.updateOdds(this.engine.getMatchState());

    // UI update with animation delay
    this.updateAllUI();

    // Special toasts for big events
    if (ballEvent.outcome.type === 'wicket') {
      this.ui.showToast(`☠️ WICKET! ${ballEvent.striker.name} is out!`, 'error', 4000);
    } else if (ballEvent.outcome.runs === 6) {
      this.ui.showToast(`💥 MASSIVE SIX by ${ballEvent.striker.name}!`, 'success', 3000);
    } else if (ballEvent.outcome.runs === 4) {
      this.ui.showToast(`🏏 FOUR! Beautiful shot!`, 'info', 2000);
    }
  }

  // ── Market Actions ──
  buyMarket(marketId, side) {
    const amountInput = document.getElementById(`market-amount-${marketId}`);
    const amount = amountInput ? parseInt(amountInput.value) || 100 : 100;

    const result = this.market.buyShares(marketId, side, amount);
    if (result) {
      this.ui.showToast(
        `Bought ${result.shares.toFixed(1)} ${side.toUpperCase()} shares at ${result.price.toFixed(3)} (${result.total} tokens)`,
        'success',
        3000
      );
      this.ui.renderMarkets(this.market);
      this.ui.renderPortfolio(this.market);
    } else {
      this.ui.showToast('Trade failed. Check your balance!', 'error');
    }
  }

  // ── Event Handlers ──
  onBall(event) {
    // Update innings badge
    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = this.engine.innings === 1 ? '1st Innings' : '2nd Innings';
    }
  }

  onOverEnd(summary) {
    // Resolve over markets
    const state = this.engine.getMatchState();
    // We need the overRuns/overWickets from the summary, before they were reset
    const overState = {
      ...state,
      overRuns: summary.runs,
      overWickets: summary.wickets,
      overBalls: summary.balls,
    };
    this.market.resolveOverMarkets(summary.overNum, overState);

    // Check if powerplay is ending
    if (summary.overNum + 1 === 6) {
      this.market.resolveOverMarkets(summary.overNum, { ...overState, runs: this.engine.runs });
    }

    // Create markets for next over if match continues
    if (!this.engine.isComplete && this.engine.currentOver < 20) {
      this.market.createOverMarkets(this.engine.currentOver, this.engine.getMatchState());
    }

    this.ui.showToast(
      `End of Over ${summary.overNum + 1}: ${summary.runs} runs, ${summary.wickets} wickets | ${summary.balls.join(' ')}`,
      'info',
      4000
    );

    // Need new bowler selection
    this.captain.needsBowlerSelection = true;
    this.updateAllUI();
  }

  onInningsEnd(data) {
    // Resolve innings markets
    this.market.resolveInningsMarkets(data);

    this.gamePhase = 'inningsBreak';
    this.ui.showInningsBreak(data);
  }

  startSecondInnings() {
    this.ui.hideInningsBreak();
    this.engine.startSecondInnings();

    // Create new over markets for second innings
    this.market.createOverMarkets(0, this.engine.getMatchState());

    // Update innings badge
    const badge = document.getElementById('innings-badge');
    if (badge) {
      badge.querySelector('span').textContent = '2nd Innings';
    }

    this.gamePhase = 'playing';
    this.ui.showToast(
      `${TEAMS[this.engine.battingTeamKey].name} need ${this.engine.target} to win!`,
      'info',
      4000
    );

    this.updateAllUI();
  }

  onMatchEnd(result) {
    // Resolve all remaining markets
    this.market.resolveMatchMarkets(result, this.firstBattingTeam);

    // Resolve any remaining open markets as cancelled (resolve with current outcome)
    this.market.getOpenMarkets().forEach(m => {
      this.market.resolveMarket(m.id, 'no');
    });

    const summary = this.market.getPortfolioSummary();
    this.gamePhase = 'matchEnd';

    // Small delay for dramatic effect
    setTimeout(() => {
      this.ui.showMatchResult(result, summary);
    }, 1500);
  }

  // ── UI Update ──
  updateAllUI() {
    if (!this.engine) return;
    this.ui.renderScoreboard(this.engine);
    this.ui.renderCaptainPanel(this.engine, this.captain);
    this.ui.renderMarkets(this.market);
    this.ui.renderPortfolio(this.market);
  }

  // ── API Modal ──
  showApiModal() {
    const existing = document.getElementById('api-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', this.ui.renderApiModal(this.api.getApiKey()));
  }

  hideApiModal() {
    const modal = document.getElementById('api-modal');
    if (modal) modal.remove();
  }

  saveApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input ? input.value.trim() : '';
    this.api.setApiKey(key);
    this.hideApiModal();
    this.ui.showToast(key ? 'API key saved!' : 'API key cleared. Using simulation mode.', key ? 'success' : 'info');

    // If we have a key and match is live, try connecting
    if (key && this.gamePhase === 'playing') {
      this.tryLiveConnect();
    }
  }

  async tryLiveConnect() {
    if (!this.api.hasApiKey()) return;

    const liveBadge = document.getElementById('live-badge');
    this.ui.showToast('Searching for live match...', 'info');

    const match = await this.api.findLiveMatch();
    if (match) {
      this.ui.showToast(`Found live match: ${match.name || 'T20 match'}`, 'success');
      if (liveBadge) {
        liveBadge.style.display = 'flex';
        liveBadge.classList.add('live');
      }
      this.api.startPolling(match.id);
    } else {
      this.ui.showToast('No live match found. Using simulation mode.', 'warning');
    }
  }
}

// ── Initialize App ──
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
