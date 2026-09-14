/* Music button (top-right): a small panel with stations, play/pause, mute and volume.
   Two station types (see `music` in content/site.js):
     youtube  – plays a YouTube video or 24/7 stream through the official player (shown small in the panel)
     synth    – music generated right here with the Web Audio API; no files, no internet ("lofi" and "chip" presets) */
window.Music = (function () {
  'use strict';
  var U = window.U;
  var cfg = {}, stations = [];
  var S = { idx: 0, playing: false, muted: false, volume: 0.6, status: 'Paused', yt: null, ytLoading: false, ytQueue: [], synth: null, open: false };
  var els = {};

  /* ---------------- persistence ---------------- */
  function load() {
    try { var saved = JSON.parse(U.local.get('music') || '{}'); if (typeof saved.idx === 'number') S.idx = saved.idx; if (typeof saved.muted === 'boolean') S.muted = saved.muted; if (typeof saved.volume === 'number') S.volume = saved.volume; } catch (e) { /* ignore */ }
    if (S.idx >= stations.length) S.idx = 0;
  }
  function save() { U.local.set('music', JSON.stringify({ idx: S.idx, muted: S.muted, volume: S.volume })); }

  /* ---------------- YouTube stations ---------------- */
  function loadYT(cb) {
    if (window.YT && window.YT.Player) return cb();
    S.ytQueue.push(cb);
    if (S.ytLoading) return;
    S.ytLoading = true;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (prev) prev(); var q = S.ytQueue; S.ytQueue = []; q.forEach(function (f) { f(); }); };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = function () { S.ytLoading = false; S.ytQueue = []; setStatus('YouTube could not be loaded. Try a built-in station.'); };
    document.head.appendChild(s);
    setTimeout(function () { if (!(window.YT && window.YT.Player)) { setStatus('YouTube is taking too long. Try a built-in station.'); } }, 8000);
  }
  function playYouTube(st) {
    setStatus('Connecting…');
    els.ytBox.hidden = false;
    loadYT(function () {
      if (S.yt) { S.yt.loadVideoById(st.id); S.yt.setVolume(Math.round(S.volume * 100)); if (S.muted) S.yt.mute(); else S.yt.unMute(); S.yt.playVideo(); return; }
      S.yt = new YT.Player('music-yt', {
        width: '100%', height: '100%', videoId: st.id,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady: function (e) { e.target.setVolume(Math.round(S.volume * 100)); if (S.muted) e.target.mute(); else e.target.unMute(); e.target.playVideo(); },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) { S.playing = true; setStatus('Playing'); }
            else if (e.data === YT.PlayerState.BUFFERING) setStatus('Buffering…');
            else if (e.data === YT.PlayerState.PAUSED) { S.playing = false; setStatus('Paused'); }
            else if (e.data === YT.PlayerState.ENDED) { S.playing = false; setStatus('Ended'); }
            render();
          },
          onError: function () { S.playing = false; setStatus('This stream is unavailable right now. Pick another station.'); render(); }
        }
      });
    });
  }
  function stopYouTube() { if (S.yt) { try { S.yt.pauseVideo(); } catch (e) { /* ignore */ } } }

  /* ---------------- generated stations (Web Audio) ---------------- */
  function Synth(preset, volume, muted) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = new AC();
    var chip = preset === 'chip';
    var bpm = chip ? 128 : 74, swing = chip ? 0 : 0.28;
    var stepDur = 60 / bpm / 4;
    var master = ac.createGain(), mute = ac.createGain(), lp = ac.createBiquadFilter(), comp = ac.createDynamicsCompressor();
    master.gain.value = volume; mute.gain.value = muted ? 0 : 1;
    lp.type = 'lowpass'; lp.frequency.value = chip ? 9000 : 5200;
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(lp); lp.connect(comp); comp.connect(mute); mute.connect(ac.destination);
    // tape wobble for the lofi preset: a slow LFO on oscillator detune
    var wobble = ac.createGain(); wobble.gain.value = chip ? 0 : 5;
    var lfo = ac.createOscillator(); lfo.frequency.value = 0.37; lfo.connect(wobble); lfo.start();
    // noise buffer (2 s)
    var nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    function noise(t, dur, filterType, freq, q, gain, decay) {
      var src = ac.createBufferSource(); src.buffer = nb; src.loop = true;
      var f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
      var g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
    }
    var vinyl = null;
    if (!chip) {
      vinyl = ac.createBufferSource(); vinyl.buffer = nb; vinyl.loop = true;
      var vf = ac.createBiquadFilter(); vf.type = 'bandpass'; vf.frequency.value = 3200; vf.Q.value = 0.6;
      var vg = ac.createGain(); vg.gain.value = 0.018;
      vinyl.connect(vf); vf.connect(vg); vg.connect(master); vinyl.start();
    }
    function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    function env(g, t, peak, a, d, s, holdTo, r) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
      g.gain.setValueAtTime(Math.max(0.0001, peak * s), holdTo);
      g.gain.exponentialRampToValueAtTime(0.0001, holdTo + r);
    }
    function osc(type, freq, detune) { var o = ac.createOscillator(); o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune; wobble.connect(o.detune); return o; }
    function epiano(n, t, vel, len) {
      var f = midi(n), g = ac.createGain(), flt = ac.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 2100; flt.Q.value = 0.7;
      var o1 = osc('sine', f, (Math.random() - 0.5) * 6), o2 = osc('triangle', f * 2.003, 0), o3 = osc('sine', f * 0.5, 0);
      var g2 = ac.createGain(); g2.gain.value = 0.22; var g3 = ac.createGain(); g3.gain.value = 0.35;
      o1.connect(flt); o2.connect(g2); g2.connect(flt); o3.connect(g3); g3.connect(flt); flt.connect(g); g.connect(master);
      env(g, t, vel, 0.008, 0.9, 0.22, t + len, 0.7);
      [o1, o2, o3].forEach(function (o) { o.start(t); o.stop(t + len + 0.8); });
    }
    function bass(n, t, vel, len) {
      var f = midi(n), g = ac.createGain(), flt = ac.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = chip ? 900 : 380;
      var o1 = osc(chip ? 'square' : 'sine', f, 0), o2 = osc('triangle', f, 0), g2 = ac.createGain(); g2.gain.value = chip ? 0.5 : 0.4;
      o1.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(master);
      env(g, t, vel, 0.01, 0.3, 0.5, t + len, 0.12);
      o1.start(t); o2.start(t); o1.stop(t + len + 0.2); o2.stop(t + len + 0.2);
    }
    function lead(n, t, vel, len) {
      var f = midi(n), g = ac.createGain();
      var o1 = osc(chip ? 'square' : 'sine', f, 0), o2 = osc('sine', f * 3, 0), g2 = ac.createGain(); g2.gain.value = chip ? 0 : 0.06;
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      env(g, t, vel, 0.015, chip ? 0.08 : 1.1, chip ? 0.5 : 0.15, t + len, chip ? 0.04 : 0.5);
      o1.start(t); o2.start(t); o1.stop(t + len + 0.6); o2.stop(t + len + 0.6);
    }
    function kick(t, vel) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(chip ? 180 : 150, t); o.frequency.exponentialRampToValueAtTime(chip ? 50 : 42, t + 0.11);
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (chip ? 0.18 : 0.3));
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.35);
    }
    function snare(t, vel) {
      noise(t, 0.3, 'bandpass', chip ? 2600 : 1700, 0.9, vel, chip ? 0.12 : 0.2);
      if (!chip) { var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 190; g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12); }
    }
    function hat(t, vel, open) { noise(t, 0.35, 'highpass', chip ? 8500 : 7000, 0.7, vel, open ? 0.26 : 0.05); }
    function crackle(t) { noise(t, 0.02, 'highpass', 2500, 0.5, 0.12, 0.012); }

    // harmony: two mellow progressions for lofi, a bright one for chip. Bar chords as MIDI note arrays.
    var progs = chip
      ? [[[60, 64, 67, 72], [67, 71, 74, 79], [69, 72, 76, 81], [65, 69, 72, 77]]]           // C  G  Am  F
      : [[[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],           // Fmaj7 Em7 Dm7 Cmaj7
         [[45, 52, 55, 59], [50, 57, 60, 64], [43, 53, 57, 64], [48, 55, 59, 62]]];          // Am9 Dm9 G13 Cmaj9
    var roots = chip ? [[48, 43, 45, 41]] : [[41, 40, 38, 36], [33, 38, 31, 36]];
    var pent = chip ? [72, 74, 76, 79, 81, 84, 86] : [69, 72, 74, 76, 79, 81, 84];
    var step = 0, nextT = 0, timer = 0, bar = 0;
    function scheduleStep(i, t) {
      var s16 = i % 16, pi = Math.floor(bar / 8) % progs.length, ci = bar % 4;
      var chord = progs[pi][ci], root = roots[pi][ci];
      if (chip) {
        if (s16 === 0 || s16 === 8 || (s16 === 11 && Math.random() < 0.5)) kick(t, 0.8);
        if (s16 === 4 || s16 === 12) snare(t, 0.35);
        if (s16 % 2 === 0) hat(t, 0.08, s16 === 14);
        if (s16 % 2 === 0) bass(root, t, 0.16, stepDur * 1.6);
        var arp = chord[(Math.floor(i / 2) % 6 < 4) ? (Math.floor(i / 2) % 4) : (6 - Math.floor(i / 2) % 6)];
        lead(arp + 12, t, 0.09, stepDur * 0.9);
        if (s16 === 0) chord.forEach(function (n) { lead(n, t, 0.03, stepDur * 14); });
      } else {
        if (s16 === 0 || s16 === 7 || (s16 === 10 && Math.random() < 0.35)) kick(t, 0.9);
        if (s16 === 4 || s16 === 12) snare(t, 0.5);
        if (s16 % 2 === 0) hat(t, 0.16 + (s16 % 4 === 0 ? 0.06 : 0), s16 === 14 && Math.random() < 0.4);
        if (s16 % 2 === 1 && Math.random() < 0.18) hat(t, 0.07, false);
        if (s16 === 0) chord.forEach(function (n, k) { epiano(n, t + k * 0.012, 0.16, stepDur * 12); });
        if (s16 === 10 && Math.random() < 0.5) chord.slice(1).forEach(function (n) { epiano(n, t, 0.09, stepDur * 4); });
        if (s16 === 0) bass(root, t, 0.32, stepDur * 5);
        if (s16 === 6) bass(root + 7, t, 0.22, stepDur * 2);
        if (s16 === 11) bass(root + 12, t, 0.2, stepDur * 2);
        if (s16 === 12) bass(root, t, 0.26, stepDur * 3);
        if ([2, 6, 9, 14].indexOf(s16) >= 0 && Math.random() < 0.28) lead(pent[Math.floor(Math.random() * pent.length)], t, 0.07, stepDur * 3);
        if (Math.random() < 0.1) crackle(t + Math.random() * stepDur);
      }
      if (s16 === 15) bar++;
    }
    function scheduler() {
      while (nextT < ac.currentTime + 0.18) {
        var t = nextT + ((step % 2) ? swing * stepDur : 0);
        scheduleStep(step, t);
        step++; nextT += stepDur;
      }
    }
    this.start = function () { return ac.resume().then(function () { nextT = ac.currentTime + 0.1; timer = setInterval(scheduler, 40); }); };
    this.stop = function () { clearInterval(timer); if (vinyl) { try { vinyl.stop(); } catch (e) { /* ignore */ } } try { lfo.stop(); } catch (e) { /* ignore */ } setTimeout(function () { ac.close(); }, 100); };
    this.setVolume = function (v) { master.gain.setTargetAtTime(v, ac.currentTime, 0.02); };
    this.setMuted = function (m) { mute.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.02); };
  }
  function playSynth(st) {
    stopSynth();
    try {
      S.synth = new Synth(st.preset || 'lofi', S.volume, S.muted);
      S.synth.start().then(function () { S.playing = true; setStatus('Playing'); render(); });
    } catch (e) { setStatus('Audio is not available in this browser.'); }
  }
  function stopSynth() { if (S.synth) { S.synth.stop(); S.synth = null; } }

  /* ---------------- controls ---------------- */
  function current() { return stations[S.idx]; }
  function play() {
    var st = current(); if (!st) return;
    if (st.type === 'youtube') { stopSynth(); playYouTube(st); }
    else { stopYouTube(); els.ytBox.hidden = true; playSynth(st); }
    S.playing = true; render();
  }
  function pause() { stopYouTube(); stopSynth(); S.playing = false; setStatus('Paused'); render(); }
  function toggle() { S.playing ? pause() : play(); }
  function select(i) {
    if (i === S.idx && S.playing) return;
    var was = S.playing;
    S.idx = i; save();
    if (was) { pause(); play(); } else { els.ytBox.hidden = current().type !== 'youtube' || !S.yt; render(); }
  }
  function setMuted(m) {
    S.muted = m; save();
    if (S.yt) { try { m ? S.yt.mute() : S.yt.unMute(); } catch (e) { /* ignore */ } }
    if (S.synth) S.synth.setMuted(m);
    render();
  }
  function setVolume(v) {
    S.volume = U.clamp(v, 0, 1); save();
    if (S.yt) { try { S.yt.setVolume(Math.round(S.volume * 100)); } catch (e) { /* ignore */ } }
    if (S.synth) S.synth.setVolume(S.volume);
  }
  function setStatus(s) { S.status = s; if (els.status) els.status.textContent = s; }
  function setOpen(open) {
    S.open = open;
    els.root.classList.toggle('open', open);
    els.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function render() {
    if (!els.root) return;
    els.root.classList.toggle('playing', S.playing && !S.muted);
    els.root.classList.toggle('muted', S.muted);
    els.btn.setAttribute('aria-label', 'Music: ' + (S.playing ? 'playing' : 'paused') + (S.muted ? ', muted' : ''));
    els.btn.title = S.playing ? current().name : 'Music';
    els.play.textContent = S.playing ? 'Pause' : 'Play';
    els.mute.textContent = S.muted ? 'Unmute' : 'Mute';
    els.mute.setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    els.status.textContent = S.status;
    U.$$('.music-list button', els.root).forEach(function (b, i) { b.classList.toggle('active', i === S.idx); b.setAttribute('aria-checked', i === S.idx ? 'true' : 'false'); });
  }

  function init(config) {
    cfg = config || {};
    els.root = document.getElementById('music');
    if (!els.root) return;
    stations = (cfg.stations || []).filter(function (s) { return s && s.name && (s.type === 'synth' || (s.type === 'youtube' && s.id)); });
    if (cfg.enabled === false || !stations.length) { els.root.hidden = true; return; }
    if (typeof cfg.volume === 'number') S.volume = cfg.volume;
    load();
    els.btn = document.getElementById('music-btn');
    els.panel = document.getElementById('music-panel');
    els.panel.innerHTML =
      '<div class="music-head"><span class="eyebrow-mini">Music</span><span class="music-status" id="music-status" aria-live="polite"></span></div>' +
      '<div class="music-yt" id="music-yt-box" hidden><div id="music-yt"></div></div>' +
      '<div class="music-list" role="radiogroup" aria-label="Stations">' + stations.map(function (s, i) {
        return '<button type="button" role="radio" aria-checked="false" data-i="' + i + '"><span class="dot"></span><span class="t">' + U.esc(s.name) + '</span><span class="k">' + (s.type === 'youtube' ? 'YouTube' : 'Built-in') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="music-controls">' +
      '<button type="button" class="btn btn-sm btn-primary" id="music-play">Play</button>' +
      '<button type="button" class="btn btn-sm" id="music-mute" aria-pressed="false">Mute</button>' +
      '<label class="music-vol"><span>Vol</span><input type="range" id="music-volume" min="0" max="100" value="' + Math.round(S.volume * 100) + '" aria-label="Volume"></label>' +
      '</div>';
    els.status = document.getElementById('music-status');
    els.ytBox = document.getElementById('music-yt-box');
    els.play = document.getElementById('music-play');
    els.mute = document.getElementById('music-mute');
    els.volume = document.getElementById('music-volume');
    els.btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!S.open); });
    els.play.addEventListener('click', toggle);
    els.mute.addEventListener('click', function () { setMuted(!S.muted); });
    els.volume.addEventListener('input', function () { setVolume(els.volume.value / 100); });
    U.$$('.music-list button', els.root).forEach(function (b) { b.addEventListener('click', function () { select(+b.dataset.i); if (!S.playing) play(); }); });
    document.addEventListener('click', function (e) { if (S.open && !e.target.closest('#music')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) setOpen(false); });
    setStatus('Paused');
    render();
  }

  return { init: init, play: play, pause: pause, toggle: toggle, setMuted: setMuted, select: select };
})();
