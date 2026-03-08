// ============================================
// teams.js — India & NZ Squad Data for ICC T20 WC 2026 Final
// ============================================

const TEAMS = {
  india: {
    name: 'India',
    shortName: 'IND',
    flag: '🇮🇳',
    color: '#138808',
    accentColor: '#FF9933',
    coach: 'Gautam Gambhir',
    players: [
      { id: 'ind_1',  name: 'Suryakumar Yadav',     shortName: 'SKY',     role: 'batsman',    isCaptain: true,  battingOrder: 3,  battingStyle: 'right', bowlingStyle: null,      strikeRate: 168, average: 35, economy: null, wicketProb: 0 },
      { id: 'ind_2',  name: 'Abhishek Sharma',       shortName: 'Abhishek', role: 'allrounder', isCaptain: false, battingOrder: 1,  battingStyle: 'left',  bowlingStyle: 'spin',    strikeRate: 172, average: 28, economy: 8.2, wicketProb: 0.08 },
      { id: 'ind_3',  name: 'Sanju Samson',          shortName: 'Samson',   role: 'wicketkeeper', isCaptain: false, battingOrder: 2,  battingStyle: 'right', bowlingStyle: null,      strikeRate: 155, average: 32, economy: null, wicketProb: 0 },
      { id: 'ind_4',  name: 'Tilak Varma',           shortName: 'Tilak',    role: 'batsman',    isCaptain: false, battingOrder: 4,  battingStyle: 'left',  bowlingStyle: 'spin',    strikeRate: 148, average: 34, economy: 9.0, wicketProb: 0.05 },
      { id: 'ind_5',  name: 'Hardik Pandya',         shortName: 'Pandya',   role: 'allrounder', isCaptain: false, battingOrder: 5,  battingStyle: 'right', bowlingStyle: 'pace',    strikeRate: 152, average: 27, economy: 8.5, wicketProb: 0.12 },
      { id: 'ind_6',  name: 'Rinku Singh',           shortName: 'Rinku',    role: 'batsman',    isCaptain: false, battingOrder: 6,  battingStyle: 'left',  bowlingStyle: null,      strikeRate: 145, average: 25, economy: null, wicketProb: 0 },
      { id: 'ind_7',  name: 'Shivam Dube',           shortName: 'Dube',     role: 'allrounder', isCaptain: false, battingOrder: 7,  battingStyle: 'left',  bowlingStyle: 'medium',  strikeRate: 140, average: 22, economy: 9.5, wicketProb: 0.06 },
      { id: 'ind_8',  name: 'Axar Patel',            shortName: 'Axar',     role: 'allrounder', isCaptain: false, battingOrder: 8,  battingStyle: 'left',  bowlingStyle: 'spin',    strikeRate: 138, average: 18, economy: 7.0, wicketProb: 0.15 },
      { id: 'ind_9',  name: 'Kuldeep Yadav',         shortName: 'Kuldeep',  role: 'bowler',     isCaptain: false, battingOrder: 10, battingStyle: 'left',  bowlingStyle: 'spin',    strikeRate: 95,  average: 8,  economy: 6.8, wicketProb: 0.18 },
      { id: 'ind_10', name: 'Jasprit Bumrah',        shortName: 'Bumrah',   role: 'bowler',     isCaptain: false, battingOrder: 11, battingStyle: 'right', bowlingStyle: 'pace',    strikeRate: 60,  average: 5,  economy: 6.2, wicketProb: 0.22 },
      { id: 'ind_11', name: 'Arshdeep Singh',        shortName: 'Arshdeep', role: 'bowler',     isCaptain: false, battingOrder: 9,  battingStyle: 'left',  bowlingStyle: 'pace',    strikeRate: 80,  average: 8,  economy: 7.8, wicketProb: 0.16 },
      { id: 'ind_12', name: 'Mohammed Siraj',        shortName: 'Siraj',    role: 'bowler',     isCaptain: false, battingOrder: 11, battingStyle: 'right', bowlingStyle: 'pace',    strikeRate: 50,  average: 4,  economy: 8.0, wicketProb: 0.14 },
      { id: 'ind_13', name: 'Varun Chakaravarthy',   shortName: 'Varun',    role: 'bowler',     isCaptain: false, battingOrder: 11, battingStyle: 'right', bowlingStyle: 'spin',    strikeRate: 40,  average: 3,  economy: 6.5, wicketProb: 0.20 },
      { id: 'ind_14', name: 'Washington Sundar',     shortName: 'Washi',    role: 'allrounder', isCaptain: false, battingOrder: 8,  battingStyle: 'left',  bowlingStyle: 'spin',    strikeRate: 120, average: 15, economy: 7.2, wicketProb: 0.13 },
      { id: 'ind_15', name: 'Ishan Kishan',          shortName: 'Ishan',    role: 'wicketkeeper', isCaptain: false, battingOrder: 3, battingStyle: 'left', bowlingStyle: null,      strikeRate: 150, average: 28, economy: null, wicketProb: 0 },
    ]
  },
  newZealand: {
    name: 'New Zealand',
    shortName: 'NZ',
    flag: '🇳🇿',
    color: '#000000',
    accentColor: '#FFFFFF',
    coach: 'Gary Stead',
    players: [
      { id: 'nz_1',  name: 'Mitchell Santner',  shortName: 'Santner',    role: 'allrounder',   isCaptain: true,  battingOrder: 7,  battingStyle: 'left',  bowlingStyle: 'spin',   strikeRate: 128, average: 18, economy: 6.8, wicketProb: 0.14 },
      { id: 'nz_2',  name: 'Finn Allen',        shortName: 'Allen',      role: 'batsman',      isCaptain: false, battingOrder: 1,  battingStyle: 'right', bowlingStyle: null,     strikeRate: 170, average: 26, economy: null, wicketProb: 0 },
      { id: 'nz_3',  name: 'Devon Conway',      shortName: 'Conway',     role: 'batsman',      isCaptain: false, battingOrder: 2,  battingStyle: 'left',  bowlingStyle: null,     strikeRate: 135, average: 36, economy: null, wicketProb: 0 },
      { id: 'nz_4',  name: 'Rachin Ravindra',   shortName: 'Rachin',     role: 'allrounder',   isCaptain: false, battingOrder: 3,  battingStyle: 'left',  bowlingStyle: 'spin',   strikeRate: 140, average: 30, economy: 7.5, wicketProb: 0.10 },
      { id: 'nz_5',  name: 'Daryl Mitchell',    shortName: 'Mitchell',   role: 'allrounder',   isCaptain: false, battingOrder: 4,  battingStyle: 'right', bowlingStyle: 'medium', strikeRate: 145, average: 32, economy: 8.8, wicketProb: 0.07 },
      { id: 'nz_6',  name: 'Glenn Phillips',    shortName: 'Phillips',   role: 'batsman',      isCaptain: false, battingOrder: 5,  battingStyle: 'right', bowlingStyle: 'spin',   strikeRate: 158, average: 28, economy: 7.8, wicketProb: 0.09 },
      { id: 'nz_7',  name: 'Mark Chapman',      shortName: 'Chapman',    role: 'batsman',      isCaptain: false, battingOrder: 6,  battingStyle: 'left',  bowlingStyle: 'spin',   strikeRate: 138, average: 24, economy: 8.5, wicketProb: 0.05 },
      { id: 'nz_8',  name: 'James Neesham',     shortName: 'Neesham',    role: 'allrounder',   isCaptain: false, battingOrder: 8,  battingStyle: 'left',  bowlingStyle: 'medium', strikeRate: 155, average: 20, economy: 8.2, wicketProb: 0.10 },
      { id: 'nz_9',  name: 'Tim Seifert',       shortName: 'Seifert',    role: 'wicketkeeper', isCaptain: false, battingOrder: 5,  battingStyle: 'right', bowlingStyle: null,     strikeRate: 142, average: 22, economy: null, wicketProb: 0 },
      { id: 'nz_10', name: 'Cole McConchie',    shortName: 'McConchie',  role: 'allrounder',   isCaptain: false, battingOrder: 7,  battingStyle: 'right', bowlingStyle: 'spin',   strikeRate: 120, average: 16, economy: 7.4, wicketProb: 0.11 },
      { id: 'nz_11', name: 'Ish Sodhi',         shortName: 'Sodhi',      role: 'bowler',       isCaptain: false, battingOrder: 10, battingStyle: 'right', bowlingStyle: 'spin',   strikeRate: 95,  average: 8,  economy: 7.0, wicketProb: 0.17 },
      { id: 'nz_12', name: 'Lockie Ferguson',   shortName: 'Ferguson',   role: 'bowler',       isCaptain: false, battingOrder: 11, battingStyle: 'right', bowlingStyle: 'pace',   strikeRate: 60,  average: 5,  economy: 7.5, wicketProb: 0.19 },
      { id: 'nz_13', name: 'Matt Henry',        shortName: 'Henry',      role: 'bowler',       isCaptain: false, battingOrder: 11, battingStyle: 'left',  bowlingStyle: 'pace',   strikeRate: 70,  average: 6,  economy: 7.8, wicketProb: 0.15 },
      { id: 'nz_14', name: 'Jacob Duffy',       shortName: 'Duffy',      role: 'bowler',       isCaptain: false, battingOrder: 11, battingStyle: 'right', bowlingStyle: 'pace',   strikeRate: 55,  average: 4,  economy: 8.0, wicketProb: 0.13 },
      { id: 'nz_15', name: 'Kyle Jamieson',     shortName: 'Jamieson',   role: 'bowler',       isCaptain: false, battingOrder: 9,  battingStyle: 'right', bowlingStyle: 'pace',   strikeRate: 110, average: 12, economy: 8.5, wicketProb: 0.14 },
    ]
  }
};

// Playing XI selectors (default XI for each team)
const DEFAULT_PLAYING_XI = {
  india: ['ind_1', 'ind_2', 'ind_3', 'ind_4', 'ind_5', 'ind_6', 'ind_8', 'ind_9', 'ind_10', 'ind_11', 'ind_13'],
  newZealand: ['nz_1', 'nz_2', 'nz_3', 'nz_4', 'nz_5', 'nz_6', 'nz_8', 'nz_9', 'nz_11', 'nz_12', 'nz_13']
};

function getPlayingXI(teamKey) {
  const team = TEAMS[teamKey];
  const xiIds = DEFAULT_PLAYING_XI[teamKey];
  return xiIds.map(id => team.players.find(p => p.id === id)).filter(Boolean);
}

function getBowlers(teamKey) {
  return getPlayingXI(teamKey).filter(p =>
    p.bowlingStyle && p.wicketProb > 0
  );
}

function getBattingOrder(teamKey) {
  return getPlayingXI(teamKey).sort((a, b) => a.battingOrder - b.battingOrder);
}
