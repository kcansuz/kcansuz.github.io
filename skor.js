/* Ortak skor tablosu — Firebase Firestore (REST API).
   Bu anahtar gizli değildir; erişimi Firestore güvenlik kuralları sınırlar. */
(function () {
  'use strict';
  var API_KEY = 'AIzaSyCI0scAEAIYSkRaavtKu4dIuzzUT8sb9D0';
  var BASE = 'https://firestore.googleapis.com/v1/projects/kcansuz-oyunlar/databases/(default)/documents';

  function request(url, body) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('Firestore ' + r.status);
      return r.json();
    });
  }

  function toFields(obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      f[k] = typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
    });
    return { fields: f };
  }

  function fromDoc(doc) {
    var o = {}, f = doc.fields || {};
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      if ('integerValue' in v) o[k] = Number(v.integerValue);
      else if ('doubleValue' in v) o[k] = Number(v.doubleValue);
      else o[k] = v.stringValue;
    });
    return o;
  }

  window.Skor = {
    // Yeni bir skor kaydı ekler
    add: function (game, entry) {
      return request(BASE + '/scores/' + game + '/entries?key=' + API_KEY, toFields(entry));
    },
    // En yüksek skorları getirir; her takma ad için sadece en iyisi
    top: function (game, limit) {
      return request(BASE + '/scores/' + game + ':runQuery?key=' + API_KEY, {
        structuredQuery: {
          from: [{ collectionId: 'entries' }],
          orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
          limit: 200
        }
      }).then(function (rows) {
        var seen = {}, out = [];
        (rows || []).forEach(function (r) {
          if (!r.document) return;
          var e = fromDoc(r.document);
          if (!e.nick) return;
          var key = e.nick.toLowerCase();
          if (seen[key]) return;
          seen[key] = true;
          out.push(e);
        });
        return out.slice(0, limit || 10);
      });
    }
  };
})();
