/* Yeni oyunlar için ortak takma ad ve skor tablosu.
   Firebase'e (skor.js) ulaşılırsa herkesin skorları, ulaşılamazsa bu cihazdaki skorlar gösterilir. */
(function () {
  'use strict';
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var clean = function (v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 16); };
  var same = function (a, b) { return String(a).toLocaleLowerCase('tr') === String(b).toLocaleLowerCase('tr'); };

  var nick = clean(get('oyuncuNick')); // kaynak.html ve plc.html ile aynı takma ad
  var dlg, resolver;

  function askNick() {
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.className = 'nick-dlg'; dlg.hidden = true;
      dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
      dlg.innerHTML = '<div class="nick-box"><h2>Takma adını yaz</h2><p>Skor tablosunda bu isim görünecek.</p>' +
        '<form autocomplete="off"><input maxlength="16" placeholder="Takma adın" aria-label="Takma adın" spellcheck="false"><button class="btn" type="submit">Başla</button></form></div>';
      document.body.appendChild(dlg);
      var input = dlg.querySelector('input');
      input.addEventListener('input', function () { input.classList.remove('err'); });
      dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
      dlg.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = clean(input.value);
        if (!v) { input.classList.add('err'); input.focus(); return; }
        nick = v; set('oyuncuNick', v); dlg.hidden = true;
        document.dispatchEvent(new CustomEvent('nickchange'));
        if (resolver) { var r = resolver; resolver = null; r(v); }
      });
    }
    var inp = dlg.querySelector('input');
    inp.value = nick; dlg.hidden = false;
    setTimeout(function () { inp.focus(); inp.select(); }, 30);
    return new Promise(function (res) { resolver = res; });
  }

  function playerLine(el) {
    function draw() {
      el.innerHTML = '';
      if (!nick) return;
      var s = document.createElement('span'); s.textContent = 'Oyuncu:';
      var b = document.createElement('b'); b.textContent = nick;
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'değiştir';
      btn.addEventListener('click', askNick);
      el.append(s, b, btn);
    }
    document.addEventListener('nickchange', draw); draw();
  }

  function board(game, listEl, noteEl) {
    var KEY = 'skorlar_' + game, shown = [], online = false, loaded = false;
    function local() { try { return JSON.parse(get(KEY) || '[]'); } catch (e) { return []; } }
    function sort(l) { return l.sort(function (a, b) { return b.score - a.score; }); }
    function best() {
      var a = local().filter(function (x) { return same(x.nick, nick); })[0];
      var b = shown.filter(function (x) { return same(x.nick, nick); })[0];
      return Math.max(a ? a.score : 0, b ? b.score : 0);
    }
    function rank() { for (var i = 0; i < shown.length; i++) if (same(shown[i].nick, nick)) return i + 1; return 0; }
    function render() {
      noteEl.textContent = !loaded ? 'yükleniyor…' : (online ? 'herkes · en iyi 10' : 'bağlantı yok · bu cihaz');
      listEl.innerHTML = '';
      var list = shown.slice(0, 10);
      if (!list.length) { var e = document.createElement('li'); e.className = 'empty'; e.textContent = loaded ? 'Henüz skor yok. İlk sen ol!' : 'yükleniyor…'; listEl.appendChild(e); return; }
      list.forEach(function (x, i) {
        var li = document.createElement('li');
        if (nick && same(x.nick, nick)) li.className = 'me';
        var r = document.createElement('span'); r.className = 'r'; r.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + '.';
        var n = document.createElement('span'); n.textContent = x.nick;
        var s = document.createElement('span'); s.className = 's'; s.textContent = x.score;
        li.append(r, n, s); listEl.appendChild(li);
      });
    }
    function refresh() {
      var done = function () { loaded = true; render(); };
      if (!window.Skor) { shown = sort(local()); done(); return Promise.resolve(); }
      return Skor.top(game, 100).then(function (l) { shown = l; online = true; })
        .catch(function () { shown = sort(local()); online = false; }).then(done);
    }
    // Biten oyunu kaydeder; sadece kişisel rekor ise internete gönderir
    function submit(score) {
      var prev = best(), record = score > 0 && score > prev;
      var l = local().filter(function (x) { return !same(x.nick, nick); });
      l.push({ nick: nick, score: Math.max(score, prev), date: Date.now() });
      set(KEY, JSON.stringify(sort(l).slice(0, 50)));
      var p = (record && window.Skor) ? Skor.add(game, { nick: nick, score: score, date: Date.now() }).catch(function () {}).then(refresh) : refresh();
      return p.then(function () {
        var msg = record ? 'Kişisel rekor!' : 'Rekorun: ' + best() + '.';
        var r = rank(); if (r) msg += ' Sıralaman: ' + r + '.';
        return { record: record, best: best(), msg: msg };
      });
    }
    document.addEventListener('nickchange', render);
    render();
    return { refresh: refresh, submit: submit, best: best };
  }

  window.Oyun = {
    get nick() { return nick; },
    askNick: askNick,
    requireNick: function () { return nick ? Promise.resolve(nick) : askNick(); },
    isTyping: function () { return !!(dlg && !dlg.hidden); },
    playerLine: playerLine, board: board
  };
})();
