// ============================================
// db.js — Supabase Client Wrapper
// Fetches config from /api/config, then uses
// Supabase JS SDK for all DB operations.
// ============================================

class MatchDB {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async init() {
    try {
      const res = await fetch('/api/config');
      const { config } = await res.json();

      if (!config.supabaseUrl || !config.supabaseAnonKey ||
          config.supabaseUrl.includes('your-project')) {
        console.warn('⚠️ Supabase not configured. DB features disabled.');
        return false;
      }

      // Use the Supabase CDN global
      if (typeof supabase === 'undefined' || !supabase.createClient) {
        console.warn('⚠️ Supabase JS SDK not loaded.');
        return false;
      }

      this.client = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      this.isReady = true;
      console.log('✅ Supabase connected');
      return true;
    } catch (err) {
      console.warn('⚠️ Supabase init failed:', err.message);
      return false;
    }
  }

  // ── Match Operations ──

  async createOrGetMatch(cricbuzzId, matchInfo = {}) {
    if (!this.isReady) return null;

    // Try to get existing
    const { data: existing } = await this.client
      .from('matches')
      .select('*')
      .eq('cricbuzz_id', cricbuzzId)
      .single();

    if (existing) return existing;

    // Create new
    const { data, error } = await this.client
      .from('matches')
      .insert({
        cricbuzz_id: cricbuzzId,
        name: matchInfo.name || '',
        team1: matchInfo.team1 || 'India',
        team2: matchInfo.team2 || 'New Zealand',
        venue: matchInfo.venue || '',
        match_status: matchInfo.status || 'pre_match',
      })
      .select()
      .single();

    if (error) console.error('DB createMatch error:', error);
    return data;
  }

  async updateMatchStatus(matchId, status, result = {}) {
    if (!this.isReady) return;

    const update = { match_status: status };
    if (result.winner) update.winner = result.winner;
    if (result.result_text) update.result_text = result.result_text;
    if (result.mom) update.mom = result.mom;
    if (result.mom_stats) update.mom_stats = result.mom_stats;

    const { error } = await this.client
      .from('matches')
      .update(update)
      .eq('id', matchId);

    if (error) console.error('DB updateMatch error:', error);
  }

  // ── Innings Operations ──

  async createOrGetInnings(matchId, inningsNum, battingTeam, bowlingTeam) {
    if (!this.isReady) return null;

    const { data: existing } = await this.client
      .from('innings')
      .select('*')
      .eq('match_id', matchId)
      .eq('innings_num', inningsNum)
      .single();

    if (existing) return existing;

    const { data, error } = await this.client
      .from('innings')
      .insert({
        match_id: matchId,
        innings_num: inningsNum,
        batting_team: battingTeam,
        bowling_team: bowlingTeam,
      })
      .select()
      .single();

    if (error) console.error('DB createInnings error:', error);
    return data;
  }

  async updateInnings(inningsId, data) {
    if (!this.isReady) return;

    const { error } = await this.client
      .from('innings')
      .update({
        total_runs: data.runs,
        total_wickets: data.wickets,
        total_overs: data.overs,
        extras_wides: data.extras?.wides || 0,
        extras_noballs: data.extras?.noBalls || 0,
        extras_byes: data.extras?.byes || 0,
        extras_legbyes: data.extras?.legByes || 0,
        extras_total: Object.values(data.extras || {}).reduce((s, v) => s + v, 0),
      })
      .eq('id', inningsId);

    if (error) console.error('DB updateInnings error:', error);
  }

  // ── Scorecard Operations ──

  async upsertBattingCard(inningsId, player) {
    if (!this.isReady) return;

    const sr = player.balls > 0 ? ((player.runs / player.balls) * 100).toFixed(2) : '0.00';

    const { error } = await this.client
      .from('batting_cards')
      .upsert({
        innings_id: inningsId,
        player_name: player.name,
        runs: player.runs,
        balls: player.balls,
        fours: player.fours || 0,
        sixes: player.sixes || 0,
        strike_rate: parseFloat(sr),
        dismissal: player.dismissal || 'not out',
        position: player.position || 0,
        is_striker: player.isStriker || false,
      }, { onConflict: 'innings_id,player_name' });

    if (error) console.error('DB upsertBatting error:', error);
  }

  async upsertBowlingCard(inningsId, player) {
    if (!this.isReady) return;

    const { error } = await this.client
      .from('bowling_cards')
      .upsert({
        innings_id: inningsId,
        player_name: player.name,
        overs: player.overs || 0,
        maidens: player.maidens || 0,
        runs: player.runs || 0,
        wickets: player.wickets || 0,
        economy: player.economy || 0,
        position: player.position || 0,
      }, { onConflict: 'innings_id,player_name' });

    if (error) console.error('DB upsertBowling error:', error);
  }

  // ── Ball Events ──

  async saveBallEvent(inningsId, ball) {
    if (!this.isReady) return;

    const { error } = await this.client
      .from('ball_events')
      .insert({
        innings_id: inningsId,
        over_num: ball.over,
        ball_num: ball.ball,
        batsman: ball.batsman,
        bowler: ball.bowler,
        runs_scored: ball.runs || 0,
        extras_type: ball.extrasType || null,
        extras_runs: ball.extrasRuns || 0,
        is_wicket: ball.isWicket || false,
        wicket_type: ball.wicketType || null,
        dismissed_player: ball.dismissedPlayer || null,
        commentary: ball.commentary || '',
      });

    if (error) console.error('DB saveBall error:', error);
  }

  async saveFallOfWicket(inningsId, fow) {
    if (!this.isReady) return;

    const { error } = await this.client
      .from('fall_of_wickets')
      .insert({
        innings_id: inningsId,
        wicket_num: fow.wicketNum,
        player_name: fow.playerName,
        team_score: fow.teamScore,
        team_overs: fow.teamOvers,
      });

    if (error) console.error('DB saveFOW error:', error);
  }

  // ── Full Scorecard Retrieval ──

  async getFullScorecard(cricbuzzId) {
    if (!this.isReady) return null;

    // Get match
    const { data: match } = await this.client
      .from('matches')
      .select('*')
      .eq('cricbuzz_id', cricbuzzId)
      .single();

    if (!match) return null;

    // Get innings
    const { data: inningsList } = await this.client
      .from('innings')
      .select('*')
      .eq('match_id', match.id)
      .order('innings_num');

    const scorecard = { match, innings: [] };

    for (const inn of (inningsList || [])) {
      const [{ data: batting }, { data: bowling }, { data: fow }] = await Promise.all([
        this.client.from('batting_cards').select('*').eq('innings_id', inn.id).order('position'),
        this.client.from('bowling_cards').select('*').eq('innings_id', inn.id).order('position'),
        this.client.from('fall_of_wickets').select('*').eq('innings_id', inn.id).order('wicket_num'),
      ]);

      scorecard.innings.push({
        ...inn,
        batting: batting || [],
        bowling: bowling || [],
        fallOfWickets: fow || [],
      });
    }

    return scorecard;
  }
}
