// ============================================
// ui.js — DOM Rendering & Animations
// ============================================

class GameUI {
  constructor() {
    this.toastQueue = [];
    this.currentMarketTab = 'open';
  }

  // ── Toast notifications ──
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ── Start Screen ──
  renderStartScreen() {
    return `
      <div class="start-screen" id="start-screen">
        <div class="start-title">🏏 Cricket Captain<br>× Market</div>
        <div class="start-subtitle">
          Make tactical captain decisions and trade prediction markets ball-by-ball in real-time.
          Can you outsmart the odds?
        </div>
        <div class="start-match-card">
          <div class="start-match-meta">ICC Men's T20 World Cup 2026 — FINAL</div>
          <div class="start-match-teams">
            <div class="team">
              <span class="flag">🇮🇳</span>
              <span class="name">India</span>
            </div>
            <span class="vs">VS</span>
            <div class="team">
              <span class="flag">🇳🇿</span>
              <span class="name">New Zealand</span>
            </div>
          </div>
          <div class="start-match-venue">📍 Narendra Modi Stadium, Ahmedabad</div>
        </div>
        <button class="btn-start" id="btn-start-match" onclick="app.startToss()">
          ⚡ START MATCH
        </button>
        <div class="api-setup-link" onclick="app.showApiModal()">
          🔗 Connect Live API (optional)
        </div>
      </div>
    `;
  }

  // ── Toss Screen ──
  renderTossScreen() {
    return `
      <div class="toss-screen" id="toss-screen">
        <h2>🪙 The Toss</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">Choose your team to captain</p>
        <div class="toss-teams">
          <div class="toss-team" id="toss-india" onclick="app.selectTossTeam('india')">
            <span class="flag">🇮🇳</span>
            <span class="name">India</span>
          </div>
          <span class="toss-vs">VS</span>
          <div class="toss-team" id="toss-nz" onclick="app.selectTossTeam('newZealand')">
            <span class="flag">🇳🇿</span>
            <span class="name">New Zealand</span>
          </div>
        </div>
        <div id="toss-choice" style="display: none;">
          <p style="color: var(--text-secondary); margin-bottom: 12px;">You won the toss! Choose to:</p>
          <div class="toss-choice">
            <button class="btn btn-primary" onclick="app.tossDecision('bat')">🏏 Bat First</button>
            <button class="btn btn-secondary" onclick="app.tossDecision('bowl')">🎳 Bowl First</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Main Game Layout ──
  renderGameLayout() {
    return `
      <div class="app-container" id="game-container">
        <!-- Header -->
        <header class="app-header">
          <div class="app-logo">
            <span class="logo-icon">🏏</span>
            <h1>CRICKET CAPTAIN × MARKET</h1>
          </div>
          <div class="header-controls">
            <div class="header-badge" id="innings-badge">
              <span>1st Innings</span>
            </div>
            <div class="header-badge" id="live-badge" style="display:none">
              <span>LIVE</span>
            </div>
            <div class="header-badge" id="captain-rating-badge">
              ⭐ <span id="captain-score-header">0</span>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="app.showApiModal()">⚙️</button>
          </div>
        </header>

        <!-- Main Grid -->
        <div class="main-grid">
          <!-- Scoreboard (spans full width) -->
          <div class="glass-card scoreboard" id="scoreboard">
            <div class="card-body" id="scoreboard-body">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Left: Captain Panel -->
          <div class="glass-card captain-panel" id="captain-panel">
            <div class="card-header">
              <h2><span class="icon">👨‍✈️</span> Captain Mode</h2>
              <span id="captain-feedback" style="font-size:0.72rem; color: var(--accent-green);"></span>
            </div>
            <div class="card-body" id="captain-body">
              <!-- Rendered dynamically -->
            </div>
            <div class="action-bar">
              <button class="btn btn-primary" id="btn-bowl-ball" onclick="app.bowlNextBall()" disabled>
                🏏 Bowl Next Ball
              </button>
            </div>
          </div>

          <!-- Right: Markets + Portfolio -->
          <div class="right-panel">
            <div class="glass-card markets-panel" id="markets-panel">
              <div class="card-header">
                <h2><span class="icon">📈</span> Prediction Markets</h2>
                <span id="markets-count" style="font-size:0.72rem; color: var(--text-muted);">0 open</span>
              </div>
              <div class="market-tabs">
                <button class="market-tab active" onclick="app.ui.switchMarketTab('open', this)">Open</button>
                <button class="market-tab" onclick="app.ui.switchMarketTab('resolved', this)">Resolved</button>
                <button class="market-tab" onclick="app.ui.switchMarketTab('portfolio', this)">My Positions</button>
              </div>
              <div class="card-body" id="markets-body">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <div class="glass-card portfolio-panel" id="portfolio-panel">
              <div class="card-header">
                <h2><span class="icon">💰</span> Portfolio</h2>
              </div>
              <div class="card-body" id="portfolio-body">
                <!-- Rendered dynamically -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Scoreboard ──
  renderScoreboard(engine) {
    const state = engine.getMatchState();
    const bat = TEAMS[state.battingTeam];
    const bowl = TEAMS[state.bowlingTeam];

    const strikerStats = engine.batStats[state.striker?.id] || {};
    const nonStrikerStats = engine.batStats[state.nonStriker?.id] || {};
    const bowlerStats = state.currentBowler ? engine.bowlStats[state.currentBowler.id] || {} : {};

    const targetHtml = state.target
      ? `<div class="target-info">Target: ${state.target} | Need ${state.target - state.runs} off ${(20*6) - state.totalBalls} balls</div>`
      : '';

    const ballsHtml = state.overBalls.map(b => {
      let cls = 'dot';
      if (b === 'W') cls = 'wicket';
      else if (b === '4') cls = 'four';
      else if (b === '6') cls = 'six';
      else if (b === '1') cls = 'single';
      else if (b === '2') cls = 'double';
      else if (b === '3') cls = 'triple';
      else if (b === 'wd') cls = 'wide';
      else if (b === 'nb') cls = 'noball';
      return `<div class="ball-indicator ${cls} new-ball">${b}</div>`;
    }).join('');

    const el = document.getElementById('scoreboard-body');
    if (!el) return;

    el.innerHTML = `
      <div class="score-main">
        <div class="team-display batting">
          <span class="team-flag">${bat.flag}</span>
          <div class="team-info">
            <h3>${bat.shortName}</h3>
            <div class="team-label">Batting</div>
          </div>
        </div>
        <div class="score-center">
          <div class="score-runs">${state.runs}/${state.wickets}</div>
          <div class="score-overs">Overs: ${state.currentOver}.${state.currentBall}</div>
          <div class="score-meta">
            <div class="meta-item"><span class="label">CRR</span><span class="value">${engine.getRunRate()}</span></div>
            ${state.target ? `<div class="meta-item"><span class="label">RRR</span><span class="value">${engine.getRequiredRunRate()}</span></div>` : ''}
          </div>
          ${targetHtml}
        </div>
        <div class="team-display bowling">
          <span class="team-flag">${bowl.flag}</span>
          <div class="team-info">
            <h3>${bowl.shortName}</h3>
            <div class="team-label">Bowling</div>
          </div>
        </div>
      </div>
      <div class="players-strip">
        <div class="player-stat">
          <span class="p-name ${state.striker ? 'on-strike' : ''}">${state.striker?.shortName || '-'}</span>
          <span class="p-score">${strikerStats.runs || 0}(${strikerStats.balls || 0}) ${strikerStats.fours ? `${strikerStats.fours}×4` : ''} ${strikerStats.sixes ? `${strikerStats.sixes}×6` : ''}</span>
        </div>
        <div class="player-stat">
          <span class="p-name">${state.nonStriker?.shortName || '-'}</span>
          <span class="p-score">${nonStrikerStats.runs || 0}(${nonStrikerStats.balls || 0})</span>
        </div>
        <div class="player-stat">
          <span class="p-name">🎳 ${state.currentBowler?.shortName || 'Select Bowler'}</span>
          <span class="p-score">${bowlerStats.overs || 0}-${bowlerStats.maidens || 0}-${bowlerStats.runs || 0}-${bowlerStats.wickets || 0}</span>
        </div>
        <div class="player-stat">
          <span class="p-name">Econ</span>
          <span class="p-score">${bowlerStats.economy || '-'}</span>
        </div>
      </div>
      <div class="over-balls">
        <span class="over-label">This Over</span>
        ${ballsHtml}
      </div>
    `;
  }

  // ── Captain Panel ──
  renderCaptainPanel(engine, captainMode) {
    const state = engine.getMatchState();
    const available = engine.getAvailableBowlers();
    const recommended = captainMode.getRecommendedBowler();
    const needsBowler = !engine.currentBowler;

    const bowlerCards = available.map(b => {
      const stats = engine.bowlStats[b.id];
      const isRecommended = recommended && recommended.id === b.id;
      const isSelected = engine.currentBowler?.id === b.id;
      const oversLeft = 4 - (stats?.overs || 0);

      return `
        <div class="bowler-option ${isSelected ? 'selected' : ''} ${oversLeft <= 0 ? 'disabled' : ''}"
             onclick="app.selectBowler('${b.id}')"
             title="${b.name} - ${b.bowlingStyle}">
          <div>
            <div class="bowler-name">${isRecommended ? '⭐ ' : ''}${b.shortName}</div>
            <div class="bowler-type">${b.bowlingStyle} ${b.isCaptain ? '(c)' : ''}</div>
          </div>
          <div class="bowler-stats">${stats?.overs || 0}-${stats?.wickets || 0}-${stats?.runs || 0} (${oversLeft}ov left)</div>
        </div>
      `;
    }).join('');

    const fieldSettings = ['🛡️ Defensive', '⚖️ Balanced', '⚔️ Attacking'];
    const fieldBtns = fieldSettings.map((label, i) => `
      <button class="field-btn ${state.fieldSetting === i ? 'active' : ''}"
              onclick="app.setField(${i})">
        <span class="field-icon">${label.split(' ')[0]}</span>
        ${label.split(' ')[1]}
      </button>
    `).join('');

    const el = document.getElementById('captain-body');
    if (!el) return;

    el.innerHTML = `
      <div class="captain-section">
        <h3>🎳 Select Bowler ${needsBowler ? '<span style="color:var(--accent-orange)">(Required)</span>' : ''}</h3>
        <div class="bowler-grid">${bowlerCards}</div>
      </div>

      <div class="captain-section">
        <h3>🏟️ Field Setting</h3>
        <div class="field-settings">${fieldBtns}</div>
      </div>

      <div class="captain-section">
        <h3>📋 DRS Review</h3>
        <div class="drs-panel">
          <span style="font-size:0.82rem; color: var(--text-primary);">Reviews Remaining</span>
          <span class="drs-reviews">${state.reviewsLeft} / 2</span>
        </div>
      </div>

      <div class="captain-section">
        <h3>📝 Commentary</h3>
        <div class="commentary-feed" id="commentary-feed">
          ${engine.commentary.slice(0, 10).map((c, i) => {
            let cls = '';
            if (c.outcome.type === 'wicket') cls = 'wicket';
            else if (c.outcome.runs === 4) cls = 'boundary';
            else if (c.outcome.runs === 6) cls = 'six';
            return `
              <div class="commentary-item ${cls}">
                <span class="commentary-over">${c.over}.${c.ball}</span>
                ${c.commentary}
              </div>
            `;
          }).join('') || '<div class="commentary-item" style="color:var(--text-muted);">Match hasn\'t started yet</div>'}
        </div>
      </div>
    `;

    // Update bowl button state
    const bowlBtn = document.getElementById('btn-bowl-ball');
    if (bowlBtn) {
      bowlBtn.disabled = needsBowler || engine.isComplete;
      bowlBtn.textContent = engine.isComplete ? '🏁 Match Over' :
                            needsBowler ? '🎳 Select a Bowler First' :
                            '🏏 Bowl Next Ball';
    }
  }

  // ── Markets Panel ──
  renderMarkets(market) {
    const el = document.getElementById('markets-body');
    if (!el) return;

    let markets;
    if (this.currentMarketTab === 'open') {
      markets = market.getOpenMarkets();
    } else if (this.currentMarketTab === 'resolved') {
      markets = market.getResolvedMarkets();
    } else {
      // Portfolio positions view
      this.renderPositionsView(market);
      return;
    }

    const countEl = document.getElementById('markets-count');
    if (countEl) countEl.textContent = `${market.getOpenMarkets().length} open`;

    if (markets.length === 0) {
      el.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
        ${this.currentMarketTab === 'open' ? 'No open markets. Start bowling to create markets!' : 'No resolved markets yet.'}
      </div>`;
      return;
    }

    el.innerHTML = markets.map(m => {
      const yesDecimal = (1 / m.yesPrice).toFixed(2);
      const noDecimal = (1 / m.noPrice).toFixed(2);
      const yesPercent = (m.yesPrice * 100).toFixed(0);
      const noPercent = (m.noPrice * 100).toFixed(0);

      const isResolved = m.status === 'resolved';

      // Price history for mini sparkline
      const lastTwo = m.priceHistory.slice(-2);
      let yesChange = '', noChange = '';
      if (lastTwo.length === 2) {
        const diff = lastTwo[1].yes - lastTwo[0].yes;
        if (diff > 0.005) yesChange = `<div class="odds-change up">▲ +${(diff*100).toFixed(1)}%</div>`;
        else if (diff < -0.005) yesChange = `<div class="odds-change down">▼ ${(diff*100).toFixed(1)}%</div>`;
        if (diff > 0.005) noChange = `<div class="odds-change down">▼ ${(diff*100).toFixed(1)}%</div>`;
        else if (diff < -0.005) noChange = `<div class="odds-change up">▲ +${(Math.abs(diff)*100).toFixed(1)}%</div>`;
      }

      const resolvedBadge = isResolved
        ? `<span class="market-badge resolved-${m.resolvedOutcome}">${m.resolvedOutcome === 'yes' ? '✅ YES' : '❌ NO'}</span>`
        : `<span class="market-badge open">OPEN</span>`;

      const actionsHtml = isResolved ? '' : `
        <div class="market-actions">
          <button class="btn btn-sm btn-yes" onclick="app.buyMarket(${m.id}, 'yes')">Buy YES</button>
          <input type="number" class="market-amount-input" id="market-amount-${m.id}" value="100" min="10" max="5000" step="10">
          <button class="btn btn-sm btn-no" onclick="app.buyMarket(${m.id}, 'no')">Buy NO</button>
        </div>
      `;

      return `
        <div class="market-card ${isResolved ? 'resolved' : ''}" id="market-${m.id}">
          <div class="market-header">
            <div class="market-title">
              <span class="market-icon">${m.icon}</span>
              ${m.title}
            </div>
            ${resolvedBadge}
          </div>
          <div class="market-odds">
            <div class="odds-side yes">
              <div class="odds-label">YES</div>
              <div class="odds-price">${yesDecimal}×</div>
              <div class="odds-percent">${yesPercent}%</div>
              ${yesChange}
            </div>
            <div class="odds-side no">
              <div class="odds-label">NO</div>
              <div class="odds-price">${noDecimal}×</div>
              <div class="odds-percent">${noPercent}%</div>
              ${noChange}
            </div>
          </div>
          ${actionsHtml}
        </div>
      `;
    }).join('');
  }

  renderPositionsView(market) {
    const el = document.getElementById('markets-body');
    const summary = market.getPortfolioSummary();

    if (summary.positions.length === 0 && summary.history.length === 0) {
      el.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
        No positions yet. Buy YES or NO on any market!
      </div>`;
      return;
    }

    const activeHtml = summary.positions.map(p => `
      <div class="position-row">
        <div class="position-market">
          ${p.marketIcon} ${p.marketTitle}
          <span class="position-side ${p.side}">${p.side}</span>
        </div>
        <div>
          <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted);">${p.shares.toFixed(1)} shares @ ${p.avgPrice.toFixed(3)}</div>
          <div class="position-pnl ${p.pnl >= 0 ? 'positive' : 'negative'}">${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)} (${p.pnlPercent}%)</div>
        </div>
      </div>
    `).join('');

    const historyHtml = summary.history.slice(-5).reverse().map(h => `
      <div class="position-row" style="opacity:0.7">
        <div class="position-market">
          ${h.marketIcon} ${h.marketTitle}
          <span class="position-side ${h.side}">${h.side}</span>
          <span style="font-size:0.65rem; color: ${h.outcome === h.side ? 'var(--accent-green)' : 'var(--accent-red)'};">
            ${h.outcome === h.side ? '✅ WON' : '❌ LOST'}
          </span>
        </div>
        <div class="position-pnl ${h.pnl >= 0 ? 'positive' : 'negative'}">${h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(0)}</div>
      </div>
    `).join('');

    el.innerHTML = `
      ${activeHtml ? `<h3 style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:8px;">Active Positions</h3>${activeHtml}` : ''}
      ${historyHtml ? `<h3 style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin: 12px 0 8px;">Trade History</h3>${historyHtml}` : ''}
    `;
  }

  // ── Portfolio Panel ──
  renderPortfolio(market) {
    const el = document.getElementById('portfolio-body');
    if (!el) return;

    const summary = market.getPortfolioSummary();

    el.innerHTML = `
      <div class="portfolio-summary">
        <div class="portfolio-stat">
          <div class="stat-label">Portfolio</div>
          <div class="stat-value neutral">${this.formatNumber(summary.totalValue)}</div>
        </div>
        <div class="portfolio-stat">
          <div class="stat-label">Cash</div>
          <div class="stat-value neutral">${this.formatNumber(summary.cash)}</div>
        </div>
        <div class="portfolio-stat">
          <div class="stat-label">Total P&L</div>
          <div class="stat-value ${summary.totalPnL >= 0 ? 'positive' : 'negative'}">${summary.totalPnL >= 0 ? '+' : ''}${this.formatNumber(summary.totalPnL)}</div>
        </div>
        <div class="portfolio-stat">
          <div class="stat-label">Return</div>
          <div class="stat-value ${parseFloat(summary.returnPercent) >= 0 ? 'positive' : 'negative'}">${summary.returnPercent}%</div>
        </div>
      </div>
      <div class="positions-list">
        ${summary.positions.length > 0 ? summary.positions.map(p => `
          <div class="position-row">
            <div class="position-market">
              ${p.marketIcon}
              <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.marketTitle}</span>
              <span class="position-side ${p.side}">${p.side}</span>
            </div>
            <div class="position-pnl ${p.pnl >= 0 ? 'positive' : 'negative'}">${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)}</div>
          </div>
        `).join('') : '<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:0.78rem;">No active positions</div>'}
      </div>
    `;
  }

  // ── Innings Break Overlay ──
  showInningsBreak(firstInningsData) {
    const team = TEAMS[firstInningsData.battingTeam];
    const overlay = document.createElement('div');
    overlay.className = 'innings-break-overlay';
    overlay.id = 'innings-break';
    overlay.innerHTML = `
      <h2>🏏 Innings Break</h2>
      <div style="font-size:1.1rem; color: var(--text-secondary);">${team.flag} ${team.name}</div>
      <div class="score-summary">${firstInningsData.runs}/${firstInningsData.wickets}</div>
      <div style="color: var(--text-secondary);">(${firstInningsData.overs} overs)</div>
      <button class="btn btn-primary" style="margin-top:20px; padding:14px 48px; font-size:1rem;" onclick="app.startSecondInnings()">
        🏏 Start ${TEAMS[app.engine.bowlingTeamKey].name}'s Chase
      </button>
    `;
    document.body.appendChild(overlay);
  }

  hideInningsBreak() {
    const el = document.getElementById('innings-break');
    if (el) el.remove();
  }

  // ── Match Result Overlay ──
  showMatchResult(result, portfolioSummary) {
    const overlay = document.createElement('div');
    overlay.className = 'match-result-overlay';
    overlay.id = 'match-result';

    const winner = result.winner ? TEAMS[result.winner] : null;
    const pnlColor = portfolioSummary.totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    overlay.innerHTML = `
      <h2>${winner ? `${winner.flag} ${winner.name} Win!` : '🏏 Match Tied!'}</h2>
      <div class="result-detail">${result.detail}</div>
      <div class="final-portfolio">
        <h3>Your Final Portfolio</h3>
        <div class="portfolio-final-value" style="color: ${pnlColor};">
          ${this.formatNumber(portfolioSummary.totalValue)} tokens
        </div>
        <div style="color: var(--text-secondary); margin-top:8px;">
          ${portfolioSummary.totalPnL >= 0 ? '📈' : '📉'} P&L: ${portfolioSummary.totalPnL >= 0 ? '+' : ''}${this.formatNumber(portfolioSummary.totalPnL)}
          (${portfolioSummary.returnPercent}%)
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top:24px; padding:14px 48px;" onclick="location.reload()">
        🔄 Play Again
      </button>
    `;
    document.body.appendChild(overlay);
  }

  // ── API Modal ──
  renderApiModal(currentKey) {
    return `
      <div class="modal-overlay active" id="api-modal" onclick="if(event.target===this)app.hideApiModal()">
        <div class="modal">
          <div class="modal-header">
            <h2>⚙️ Settings</h2>
            <button class="modal-close" onclick="app.hideApiModal()">✕</button>
          </div>
          <div class="modal-body">
            <label>CricketData.org API Key</label>
            <input type="text" id="api-key-input" value="${currentKey || ''}" placeholder="Enter your free API key...">
            <p style="font-size:0.72rem; color:var(--text-muted); margin-top:8px;">
              Get a free key at <a href="https://cricketdata.org" target="_blank" style="color:var(--accent-blue);">cricketdata.org</a> — 100 hits/day.
              The app works fully in simulation mode without a key.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.hideApiModal()">Cancel</button>
            <button class="btn btn-primary" onclick="app.saveApiKey()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  switchMarketTab(tab, btnEl) {
    this.currentMarketTab = tab;
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    if (window.app && window.app.market) {
      this.renderMarkets(window.app.market);
    }
  }

  formatNumber(n) {
    if (n === undefined || n === null) return '0';
    return Math.round(n).toLocaleString();
  }

  // Flash odds change animation
  flashOddsChange(marketId, direction) {
    const el = document.getElementById(`market-${marketId}`);
    if (!el) return;
    const cls = direction === 'up' ? 'odds-flash-up' : 'odds-flash-down';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 600);
  }
}
