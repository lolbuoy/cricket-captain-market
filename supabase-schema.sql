-- ============================================
-- Supabase Schema for Cricket Captain × Market
-- Run this in Supabase SQL Editor
-- ============================================

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cricbuzz_id TEXT UNIQUE NOT NULL,
  name TEXT,
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  venue TEXT,
  toss_winner TEXT,
  toss_decision TEXT,
  match_status TEXT DEFAULT 'pre_match',  -- pre_match, toss, first_innings, innings_break, second_innings, complete
  result_text TEXT,
  winner TEXT,
  mom TEXT,          -- Man of the Match player name
  mom_stats TEXT,    -- e.g. "87(52) 2×4 5×6" or "4-0-28-3"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Innings
CREATE TABLE IF NOT EXISTS innings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  innings_num INTEGER NOT NULL CHECK (innings_num IN (1, 2)),
  batting_team TEXT NOT NULL,
  bowling_team TEXT NOT NULL,
  total_runs INTEGER DEFAULT 0,
  total_wickets INTEGER DEFAULT 0,
  total_overs TEXT DEFAULT '0.0',
  extras_wides INTEGER DEFAULT 0,
  extras_noballs INTEGER DEFAULT 0,
  extras_byes INTEGER DEFAULT 0,
  extras_legbyes INTEGER DEFAULT 0,
  extras_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (match_id, innings_num)
);

-- Batting Scorecards
CREATE TABLE IF NOT EXISTS batting_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  innings_id UUID REFERENCES innings(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  strike_rate NUMERIC(6,2) DEFAULT 0,
  dismissal TEXT DEFAULT 'not out',  -- "not out", "b Bumrah", "c Allen b Santner", etc.
  position INTEGER DEFAULT 0,        -- batting order position
  is_striker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (innings_id, player_name)
);

-- Bowling Scorecards
CREATE TABLE IF NOT EXISTS bowling_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  innings_id UUID REFERENCES innings(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  overs NUMERIC(4,1) DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy NUMERIC(5,2) DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (innings_id, player_name)
);

-- Ball Events
CREATE TABLE IF NOT EXISTS ball_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  innings_id UUID REFERENCES innings(id) ON DELETE CASCADE,
  over_num INTEGER NOT NULL,
  ball_num INTEGER NOT NULL,
  batsman TEXT NOT NULL,
  bowler TEXT NOT NULL,
  runs_scored INTEGER DEFAULT 0,
  extras_type TEXT,        -- null, 'wide', 'noball', 'bye', 'legbye'
  extras_runs INTEGER DEFAULT 0,
  is_wicket BOOLEAN DEFAULT false,
  wicket_type TEXT,        -- 'bowled', 'caught', 'lbw', 'stumped', 'run out'
  dismissed_player TEXT,
  commentary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fall of Wickets
CREATE TABLE IF NOT EXISTS fall_of_wickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  innings_id UUID REFERENCES innings(id) ON DELETE CASCADE,
  wicket_num INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  team_score INTEGER NOT NULL,
  team_overs TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE batting_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowling_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ball_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_of_wickets ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read innings" ON innings FOR SELECT USING (true);
CREATE POLICY "Public read batting" ON batting_cards FOR SELECT USING (true);
CREATE POLICY "Public read bowling" ON bowling_cards FOR SELECT USING (true);
CREATE POLICY "Public read balls" ON ball_events FOR SELECT USING (true);
CREATE POLICY "Public read fow" ON fall_of_wickets FOR SELECT USING (true);

-- Anon key insert/update access
CREATE POLICY "Anon insert matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update matches" ON matches FOR UPDATE USING (true);
CREATE POLICY "Anon insert innings" ON innings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update innings" ON innings FOR UPDATE USING (true);
CREATE POLICY "Anon insert batting" ON batting_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update batting" ON batting_cards FOR UPDATE USING (true);
CREATE POLICY "Anon insert bowling" ON bowling_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update bowling" ON bowling_cards FOR UPDATE USING (true);
CREATE POLICY "Anon insert balls" ON ball_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert fow" ON fall_of_wickets FOR INSERT WITH CHECK (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
