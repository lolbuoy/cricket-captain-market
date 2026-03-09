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

    // 1st innings summary bar (shown during 2nd innings)
    let firstInningsSummary = '';
    if (engine.innings === 2 && engine.scorecard[1]) {
      const sc1 = engine.scorecard[1];
      firstInningsSummary = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; background:rgba(255,255,255,0.04); border-radius:10px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:0.75rem; color:var(--text-muted);">${sc1.battingTeamFlag || ''} ${sc1.battingTeamName || 'Team 1'} - 1st Innings</span>
          <span style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700; color:var(--text-secondary);">${sc1.runs}/${sc1.wickets} (${sc1.overs})</span>
          <button onclick="app.showScorecard()" style="font-size:0.65rem; background:rgba(0,212,255,0.15); border:1px solid rgba(0,212,255,0.3); color:#00d4ff; padding:3px 10px; border-radius:6px; cursor:pointer;">Scorecard</button>
        </div>
      `;
    }

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
      ${firstInningsSummary}
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
          <span class="p-name ${state.striker ? 'on-strike' : ''}">${state.striker?.shortName || '-'} *</span>
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
  showInningsBreak(firstInningsData, engine) {
    const team = TEAMS[firstInningsData.battingTeam];
    const overlay = document.createElement('div');
    overlay.className = 'innings-break-overlay';
    overlay.id = 'innings-break';

    // Build batting table
    let batHtml = '';
    if (firstInningsData.batting && firstInningsData.batting.length > 0) {
      const rows = firstInningsData.batting.map(b => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
          <td style="padding:5px 8px; font-size:0.78rem; color:#e8eaf6;">${b.name || b.shortName}</td>
          <td style="padding:5px 8px; font-size:0.68rem; color:#8892b0;">${b.dismissal || 'not out'}</td>
          <td style="padding:5px 4px; font-family:var(--font-mono); font-size:0.78rem; color:var(--accent-green); text-align:right;">${b.runs}</td>
          <td style="padding:5px 4px; font-size:0.68rem; color:#8892b0; text-align:right;">${b.balls}</td>
          <td style="padding:5px 4px; font-size:0.68rem; color:#8892b0; text-align:right;">${b.fours || 0}</td>
          <td style="padding:5px 4px; font-size:0.68rem; color:#8892b0; text-align:right;">${b.sixes || 0}</td>
          <td style="padding:5px 4px; font-size:0.68rem; color:#00d4ff; text-align:right;">${b.strikeRate || '-'}</td>
        </tr>
      `).join('');
      batHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
            <th style="text-align:left; font-size:0.65rem; color:#4a5568; padding:4px 8px;">BATSMAN</th>
            <th style="text-align:left; font-size:0.65rem; color:#4a5568; padding:4px 8px;"></th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">R</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">B</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">4s</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">6s</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">SR</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // Build bowling table
    let bowlHtml = '';
    if (firstInningsData.bowling && firstInningsData.bowling.length > 0) {
      const rows = firstInningsData.bowling.map(b => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
          <td style="padding:5px 8px; font-size:0.78rem; color:#e8eaf6;">${b.name || b.shortName}</td>
          <td style="padding:5px 4px; font-family:var(--font-mono); font-size:0.78rem; color:#8892b0; text-align:right;">${b.overs}</td>
          <td style="padding:5px 4px; font-size:0.78rem; color:#8892b0; text-align:right;">${b.maidens}</td>
          <td style="padding:5px 4px; font-size:0.78rem; color:var(--accent-red); text-align:right;">${b.runs}</td>
          <td style="padding:5px 4px; font-size:0.78rem; color:var(--accent-green); text-align:right; font-weight:700;">${b.wickets}</td>
          <td style="padding:5px 4px; font-size:0.78rem; color:#00d4ff; text-align:right;">${b.economy || '-'}</td>
        </tr>
      `).join('');
      bowlHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
            <th style="text-align:left; font-size:0.65rem; color:#4a5568; padding:4px 8px;">BOWLER</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">O</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">M</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">R</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">W</th>
            <th style="text-align:right; font-size:0.65rem; color:#4a5568; padding:4px 4px;">Econ</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    const chaseTeamName = engine ? TEAMS[engine.bowlingTeamKey].name : 'Team 2';

    overlay.innerHTML = `
      <h2>🏏 Innings Break</h2>
      <div style="font-size:1.1rem; color: var(--text-secondary);">${team.flag} ${team.name}</div>
      <div class="score-summary">${firstInningsData.runs}/${firstInningsData.wickets}</div>
      <div style="color: var(--text-secondary);">(${firstInningsData.overs} overs)</div>
      <div style="max-height:300px; overflow-y:auto; width:100%; max-width:600px; margin-top:12px;">
        ${batHtml}
        ${bowlHtml}
      </div>
      <button class="btn btn-primary" style="margin-top:20px; padding:14px 48px; font-size:1rem;" onclick="app.startSecondInnings()">
        🏏 Start ${chaseTeamName}'s Chase
      </button>
    `;
    document.body.appendChild(overlay);
  }

  hideInningsBreak() {
    const el = document.getElementById('innings-break');
    if (el) el.remove();
  }

  // ── Match Result Overlay ──
  showMatchResult(result, portfolioSummary, engine) {
    const overlay = document.createElement('div');
    overlay.className = 'match-result-overlay';
    overlay.id = 'match-result';

    const winner = result.winner ? TEAMS[result.winner] : null;
    const pnlColor = portfolioSummary.totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    // Man of the Match
    let momHtml = '';
    if (engine) {
      const sc = engine.getFullScorecard();
      if (sc.mom) {
        momHtml = `
          <div style="margin-top:16px; padding:12px 20px; background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.3); border-radius:12px; text-align:center;">
            <div style="font-size:0.68rem; color:#ffd700; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:4px;">🏆 Man of the Match</div>
            <div style="font-size:1.1rem; font-weight:700; color:#e8eaf6;">${sc.mom.name}</div>
            <div style="font-size:0.82rem; color:#ffd700; font-family:var(--font-mono); margin-top:2px;">${sc.mom.stats}</div>
            <div style="font-size:0.68rem; color:#8892b0; margin-top:2px;">${sc.mom.teamName || ''}</div>
          </div>
        `;
      }

      // Both innings summary
      let inningsSummaryHtml = '';
      if (sc.innings1) {
        inningsSummaryHtml += `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:0.82rem; color:#8892b0;">${sc.innings1.battingTeamFlag || ''} ${sc.innings1.battingTeamName || 'Team 1'}</span>
          <span style="font-family:var(--font-mono); font-size:0.92rem; font-weight:700; color:#e8eaf6;">${sc.innings1.runs}/${sc.innings1.wickets} (${sc.innings1.overs})</span>
        </div>`;
      }
      if (sc.innings2) {
        inningsSummaryHtml += `<div style="display:flex; justify-content:space-between; padding:6px 0;">
          <span style="font-size:0.82rem; color:#8892b0;">${sc.innings2.battingTeamFlag || ''} ${sc.innings2.battingTeamName || 'Team 2'}</span>
          <span style="font-family:var(--font-mono); font-size:0.92rem; font-weight:700; color:#e8eaf6;">${sc.innings2.runs}/${sc.innings2.wickets} (${sc.innings2.overs})</span>
        </div>`;
      }
      if (inningsSummaryHtml) {
        momHtml = `<div style="margin-top:16px; padding:8px 20px; background:rgba(255,255,255,0.04); border-radius:10px; min-width:300px;">${inningsSummaryHtml}</div>` + momHtml;
      }
    }

    overlay.innerHTML = `
      <h2>${winner ? `${winner.flag} ${winner.name} Win!` : '🏏 Match Tied!'}</h2>
      <div class="result-detail">${result.detail}</div>
      ${momHtml}
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
      <div style="display:flex; gap:12px; margin-top:24px;">
        <button class="btn btn-secondary" onclick="app.showScorecard()" style="padding:14px 32px;">📋 Full Scorecard</button>
        <button class="btn btn-primary" onclick="location.reload()" style="padding:14px 32px;">🔄 Play Again</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ── Full Scorecard Overlay ──
  showFullScorecard(engine) {
    const sc = engine.getFullScorecard();
    const overlay = document.createElement('div');
    overlay.className = 'innings-break-overlay';
    overlay.id = 'scorecard-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(5,10,30,0.95); z-index:1000; display:flex; align-items:center; justify-content:center; flex-direction:column; overflow-y:auto; padding:20px;';

    const renderInningsTable = (inn, num) => {
      if (!inn) return '<div style="color:#4a5568; text-align:center; padding:20px;">Innings not played yet</div>';

      const batRows = (inn.batting || []).map(b => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:6px 10px; font-size:0.8rem; color:#e8eaf6;">${b.name || b.shortName}${!b.isOut && b.balls > 0 ? ' *' : ''}</td>
          <td style="padding:6px 8px; font-size:0.7rem; color:#8892b0; max-width:120px; overflow:hidden; text-overflow:ellipsis;">${b.isOut === false ? 'not out' : (b.dismissal || 'not out')}</td>
          <td style="padding:6px 6px; font-family:var(--font-mono); font-weight:700; color:var(--accent-green); text-align:right;">${b.runs}</td>
          <td style="padding:6px 6px; font-size:0.75rem; color:#8892b0; text-align:right;">${b.balls}</td>
          <td style="padding:6px 6px; font-size:0.75rem; color:#8892b0; text-align:right;">${b.fours || 0}</td>
          <td style="padding:6px 6px; font-size:0.75rem; color:#8892b0; text-align:right;">${b.sixes || 0}</td>
          <td style="padding:6px 6px; font-size:0.75rem; color:#00d4ff; text-align:right;">${b.strikeRate || '-'}</td>
        </tr>
      `).join('');

      const bowlRows = (inn.bowling || []).map(b => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:6px 10px; font-size:0.8rem; color:#e8eaf6;">${b.name || b.shortName}</td>
          <td style="padding:6px 6px; font-family:var(--font-mono); color:#8892b0; text-align:right;">${b.overs}</td>
          <td style="padding:6px 6px; color:#8892b0; text-align:right;">${b.maidens}</td>
          <td style="padding:6px 6px; color:var(--accent-red); text-align:right;">${b.runs}</td>
          <td style="padding:6px 6px; color:var(--accent-green); font-weight:700; text-align:right;">${b.wickets}</td>
          <td style="padding:6px 6px; color:#00d4ff; text-align:right;">${b.economy || '-'}</td>
        </tr>
      `).join('');

      const fowHtml = (inn.fallOfWickets || []).map(f => `${f.wicketNum}-${f.runs} (${f.batsman}, ${f.overs})`).join(', ');

      return `
        <div style="margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.85rem; font-weight:600; color:#e8eaf6;">${inn.battingTeamFlag || ''} ${inn.battingTeamName || 'Team'}</span>
            <span style="font-family:var(--font-mono); font-size:1.1rem; font-weight:700; color:#e8eaf6;">${inn.runs}/${inn.wickets} <span style="font-size:0.8rem; color:#00d4ff;">(${inn.overs})</span></span>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
              <th style="text-align:left; font-size:0.6rem; color:#4a5568; padding:4px 10px;">BATSMAN</th>
              <th style="text-align:left; font-size:0.6rem; color:#4a5568;"></th>
              <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">R</th>
              <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">B</th>
              <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">4s</th>
              <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">6s</th>
              <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">SR</th>
            </tr></thead>
            <tbody>${batRows}</tbody>
          </table>
          ${inn.extrasTotal ? `<div style="font-size:0.7rem; color:#8892b0; padding:6px 10px; border-top:1px solid rgba(255,255,255,0.06);">Extras: ${inn.extrasTotal} (w ${inn.extras?.wides||0}, nb ${inn.extras?.noBalls||0}, b ${inn.extras?.byes||0}, lb ${inn.extras?.legByes||0})</div>` : ''}
          ${bowlRows ? `
            <div style="margin-top:12px; font-size:0.65rem; text-transform:uppercase; letter-spacing:1px; color:#4a5568; margin-bottom:4px;">Bowling</div>
            <table style="width:100%; border-collapse:collapse;">
              <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="text-align:left; font-size:0.6rem; color:#4a5568; padding:4px 10px;">BOWLER</th>
                <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">O</th>
                <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">M</th>
                <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">R</th>
                <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">W</th>
                <th style="text-align:right; font-size:0.6rem; color:#4a5568; padding:4px 6px;">Econ</th>
              </tr></thead>
              <tbody>${bowlRows}</tbody>
            </table>
          ` : ''}
          ${fowHtml ? `<div style="font-size:0.65rem; color:#4a5568; padding:6px 10px; margin-top:6px;">FOW: ${fowHtml}</div>` : ''}
        </div>
      `;
    };

    // MoM section
    let momSection = '';
    if (sc.mom) {
      momSection = `<div style="padding:12px 20px; background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.2); border-radius:10px; text-align:center; margin-top:12px;">
        <span style="font-size:0.65rem; color:#ffd700; text-transform:uppercase;">🏆 Man of the Match</span>
        <div style="font-weight:700; color:#e8eaf6; margin-top:2px;">${sc.mom.name} — <span style="color:#ffd700;">${sc.mom.stats}</span></div>
      </div>`;
    }

    overlay.innerHTML = `
      <div style="background:rgba(15,20,50,0.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:28px; max-width:650px; width:100%; max-height:85vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="margin:0; font-size:1.1rem; color:#e8eaf6;">📋 Full Scorecard</h2>
          <button onclick="app.hideScorecard()" style="background:none; border:none; color:#8892b0; cursor:pointer; font-size:1.2rem;">✕</button>
        </div>
        ${renderInningsTable(sc.innings1, 1)}
        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:16px 0;">
        ${renderInningsTable(sc.innings2, 2)}
        ${sc.result ? `<div style="text-align:center; padding:12px; font-size:0.85rem; color:var(--accent-green); font-weight:600;">${sc.result.detail}</div>` : ''}
        ${momSection}
      </div>
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
