/* config.js — settings for the game. Plain values; edit and reload. */
(function (root) {
  var CONFIG = {
    title: 'RNGdle',                // name shown in the header (rename the game freely)
    tagline: 'One roll per day. One number. What will yours be?',
    max: 1000000,                   // rolls are whole numbers from 0 to max, inclusive
    mode: 'daily',                  // 'daily': one counted roll per day, then practice rolls; 'free': every roll counts
    embedMode: 'free',              // mode used inside the projects page (index.html?embed=1)
    epPerProbability: 100,          // EP for a badge = this ÷ probability. 100 → a 1% badge is worth 10,000 EP
    backend: 'firebase',                // 'demo': simulated other players (works anywhere)
                                    // 'local': only you, saved in this browser
                                    // 'firebase': real shared leaderboards (see README for the 10-minute setup)
    firebase: {                     // only used when backend is 'firebase'
      apiKey: 'AIzaSyARFJcbCNd4K0NsopwzoZff4LlUspiWX20', authDomain: 'rngdlee.firebaseapp.com', databaseURL: 'https://rngdlee-default-rtdb.firebaseio.com', projectId: 'rngdlee', appId: '1:48345095823:web:9286a9b9a1c49fc3f45afa'
    },
    demoPlayers: 40,                // how many simulated players the demo backend shows
    leaderboardSize: 50,
    theme: { accent: '#8ab4ff', accent2: '#b9a6ff' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  root.RNGDLE_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
