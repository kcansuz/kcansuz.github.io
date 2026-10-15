/*
 * ENGILAV — arka plan müziği
 * - Açılışta otomatik başlatmayı dener; tarayıcı engellerse ilk dokunuş/tıklama/tuşta başlar.
 * - Kullanıcı durdurursa (localStorage) diğer sayfalarda ve yenilemelerde kendiliğinden açılmaz.
 * - Tek ses kaynağı: aynı sayfada iki kez yüklenmez, başka sekmede çalarken bu sekme susar.
 * - Müzik dosyası yoksa/yüklenemezse kontrol gizlenir, site etkilenmez.
 */
(function () {
  'use strict';
  if (window.__engilavMuzik) return;
  window.__engilavMuzik = true;

  var SRC = 'muzik/engilav-ambient.mp3'; // projedeki yerel dosya (özgün, telifsiz)
  var VOLUME = 0.3;                       // hedef ses seviyesi (0–1), düşük başlar
  var FADE_MS = 1800;
  var KEY_STATE = 'engilav_muzik';        // 'on' | 'off'  (off = kullanıcı durdurdu)
  var KEY_MUTE = 'engilav_muzik_sessiz';  // '1' | '0'
  var KEY_POS = 'engilav_muzik_konum';    // sayfalar arası kaldığı yer (oturum boyunca)

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  var wantOn = lsGet(KEY_STATE) !== 'off';
  var muted = lsGet(KEY_MUTE) === '1';

  /* ---------- görünüm ---------- */
  var css = '' +
    '.em-player{position:fixed;z-index:40;right:max(16px,calc(env(safe-area-inset-right) + 12px));bottom:max(16px,calc(env(safe-area-inset-bottom) + 12px));display:flex;align-items:center;gap:4px;padding:5px;border:1px solid #2d3540;border-radius:999px;background:rgba(13,17,22,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.45);font-family:Inter,system-ui,sans-serif;transition:opacity .3s,transform .3s}' +
    '.em-player[hidden]{display:none}' +
    '.em-player.em-hide{opacity:0;transform:translateY(8px);pointer-events:none}' +
    '.em-eq{display:flex;align-items:flex-end;gap:2px;height:14px;padding:0 8px 0 10px}' +
    '.em-eq i{display:block;width:3px;height:4px;border-radius:2px;background:#b6f36a;opacity:.45;transition:height .3s,opacity .3s}' +
    '.em-player.em-on .em-eq i{opacity:1;animation:em-eq 1.1s ease-in-out infinite alternate}' +
    '.em-player.em-on.em-muted .em-eq i{animation:none;height:4px;opacity:.45}' +
    '.em-eq i:nth-child(2){animation-delay:-.4s!important}.em-eq i:nth-child(3){animation-delay:-.8s!important}.em-eq i:nth-child(4){animation-delay:-.2s!important}' +
    '@keyframes em-eq{0%{height:3px}50%{height:12px}100%{height:6px}}' +
    '.em-btn{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:50%;border:1px solid transparent;background:none;color:#a9b2bf;cursor:pointer;padding:0;transition:background-color .2s,color .2s,border-color .2s}' +
    '.em-btn svg{width:18px;height:18px}' +
    '.em-btn:hover{color:#f3f5f7;background:#171d24}' +
    '.em-btn:focus-visible{outline:2px solid #b6f36a;outline-offset:2px}' +
    '.em-play{border-color:rgba(182,243,106,.6);color:#b6f36a}' +
    '.em-play:hover{background:#b6f36a;border-color:#b6f36a;color:#0b0e12}' +
    '.em-player.em-wait .em-play{animation:em-pulse 2.2s ease-out infinite}' +
    '@keyframes em-pulse{0%{box-shadow:0 0 0 0 rgba(182,243,106,.45)}70%{box-shadow:0 0 0 10px rgba(182,243,106,0)}100%{box-shadow:0 0 0 0 rgba(182,243,106,0)}}' +
    '.em-spacer{height:0}' +
    '@media (max-width:600px){.em-btn{width:36px;height:36px}.em-eq{padding:0 6px 0 8px}.em-spacer{height:72px}}' +
    '@media (prefers-reduced-motion:reduce){.em-player.em-on .em-eq i{animation:none;height:9px}.em-player.em-wait .em-play{animation:none}}';
  var style = document.createElement('style');
  style.id = 'engilav-muzik-css';
  style.textContent = css;
  document.head.appendChild(style);

  var ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>'
  };

  var box = document.createElement('div');
  box.className = 'em-player';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Arka plan müziği');
  box.hidden = true; // dosya hazır olunca görünür
  box.innerHTML = '<span class="em-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
    '<button type="button" class="em-btn em-play"></button>' +
    '<button type="button" class="em-btn em-mute"></button>';
  var btnPlay = box.querySelector('.em-play');
  var btnMute = box.querySelector('.em-mute');

  function mount() {
    document.body.appendChild(box);
    setTimeout(start, 0);
    // Oyun ve hesaplama sayfalarında telefonda alttaki içerik kontrolün altında kalmasın
    if (!document.querySelector('footer')) {
      var sp = document.createElement('div');
      sp.className = 'em-spacer'; sp.setAttribute('aria-hidden', 'true');
      document.body.appendChild(sp);
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  /* ---------- ses ---------- */
  var audio = new Audio();
  audio.loop = true;
  audio.preload = wantOn ? 'auto' : 'metadata';
  audio.muted = muted;
  audio.volume = 0;
  audio.setAttribute('playsinline', '');
  audio.src = SRC;

  var playing = false, fadeTimer = null, waiting = false;

  function render() {
    box.classList.toggle('em-on', playing);
    box.classList.toggle('em-muted', audio.muted);
    box.classList.toggle('em-wait', waiting && !playing);
    btnPlay.innerHTML = playing ? ICON.pause : ICON.play;
    btnPlay.setAttribute('aria-label', playing ? 'Müziği duraklat' : 'Müziği oynat');
    btnPlay.title = playing ? 'Duraklat' : (waiting ? 'Müziği başlat' : 'Oynat');
    btnMute.innerHTML = audio.muted ? ICON.mute : ICON.vol;
    btnMute.setAttribute('aria-label', audio.muted ? 'Sesi aç' : 'Sesi kapat');
    btnMute.setAttribute('aria-pressed', String(audio.muted));
    btnMute.title = audio.muted ? 'Sesi aç' : 'Sesi kapat';
  }

  function fadeTo(target, ms, done) {
    clearInterval(fadeTimer);
    var start = audio.volume, t0 = Date.now();
    if (ms <= 0) { setVol(target); if (done) done(); return; }
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      setVol(start + (target - start) * k);
      if (k >= 1) { clearInterval(fadeTimer); if (done) done(); }
    }, 40);
  }
  function setVol(v) { try { audio.volume = Math.max(0, Math.min(1, v)); } catch (e) {} } // iOS'ta salt okunur

  var channel = null;
  try { channel = new BroadcastChannel('engilav-muzik'); } catch (e) {}
  var tabId = Math.random().toString(36).slice(2);

  function play(fromUser) {
    if (playing) return;
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    if (p && typeof p.then === 'function') {
      p.then(onStarted, function (err) {
        if (err && err.name === 'NotAllowedError') { waitForGesture(); }
        else if (fromUser) { waitForGesture(); }
      });
    } else { onStarted(); }
  }
  function onStarted() {
    playing = true; waiting = false; removeGesture();
    fadeTo(VOLUME, FADE_MS);
    if (channel) channel.postMessage({ type: 'playing', id: tabId });
    render();
  }
  function pause(quick) {
    if (!playing) { render(); return; }
    playing = false; savePos();
    fadeTo(0, quick ? 0 : 350, function () { audio.pause(); });
    render();
  }

  // Tarayıcı otomatik oynatmayı engellediyse ilk etkileşimi bekle
  var GESTURES = ['pointerup', 'touchend', 'keydown', 'click'];
  function onGesture(e) {
    if (box.contains(e.target)) return;       // kontrolün kendi butonları ayrıca işlenir
    if (!wantOn || playing) { removeGesture(); return; }
    play(false);
  }
  function waitForGesture() {
    if (waiting) return;
    waiting = true;
    GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, true); });
    render();
  }
  function removeGesture() {
    GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
  }

  btnPlay.addEventListener('click', function () {
    if (playing) { wantOn = false; lsSet(KEY_STATE, 'off'); waiting = false; removeGesture(); pause(); }
    else { wantOn = true; lsSet(KEY_STATE, 'on'); audio.preload = 'auto'; play(true); }
  });
  btnMute.addEventListener('click', function () {
    audio.muted = !audio.muted;
    lsSet(KEY_MUTE, audio.muted ? '1' : '0');
    render();
  });

  /* ---------- sayfalar arası devamlılık ---------- */
  function savePos() { if (audio.duration && isFinite(audio.duration)) ssSet(KEY_POS, String(audio.currentTime)); }
  var lastSave = 0;
  audio.addEventListener('timeupdate', function () {
    var n = Date.now(); if (n - lastSave > 2000) { lastSave = n; savePos(); }
  });
  audio.addEventListener('loadedmetadata', function () {
    var pos = parseFloat(ssGet(KEY_POS));
    if (pos > 0 && audio.duration && isFinite(audio.duration)) {
      try { audio.currentTime = pos % audio.duration; } catch (e) {}
    }
  });

  // Kontrolü göster ve (kullanıcı kapatmadıysa) başlatmayı dene.
  // iOS dosyayı önceden yüklemediği için 'canplay' beklenmez; dosya yoksa 'error' kontrolü gizler.
  var shown = false, failed = false;
  function start() {
    if (shown || failed) return; shown = true;
    box.hidden = false; render();
    if (wantOn && !document.hidden) play(false);
  }
  audio.addEventListener('error', function () {
    failed = true; playing = false; waiting = false;
    box.hidden = true; removeGesture();
    if (window.console) console.info('[ENGILAV müzik] "' + SRC + '" yüklenemedi; müzik kontrolü gizlendi.');
  });
  audio.addEventListener('pause', function () { if (playing && !audio.ended) { playing = false; render(); } });

  // Başka sekmede müzik başlarsa bu sekme sussun (üst üste binme olmasın)
  if (channel) channel.onmessage = function (e) {
    if (e.data && e.data.type === 'playing' && e.data.id !== tabId) pause(true);
  };
  // Başka sekmede kullanıcı kapattıysa burada da kapat
  window.addEventListener('storage', function (e) {
    if (e.key === KEY_STATE && e.newValue === 'off') { wantOn = false; pause(true); }
    if (e.key === KEY_MUTE) { audio.muted = e.newValue === '1'; render(); }
  });

  // Sekme gizlenince duraklat, geri gelince (kullanıcı kapatmadıysa) devam et
  var resumeOnShow = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { resumeOnShow = playing; if (playing) pause(true); }
    else if (resumeOnShow && wantOn) { resumeOnShow = false; play(false); }
  });
  window.addEventListener('pagehide', function () { savePos(); if (playing) { audio.pause(); playing = false; } });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && wantOn && shown && !failed && !playing) play(false); // geri/ileri önbelleğinden dönüş
  });

  render();
})();
