(function () {
  'use strict';

  // ---------- конфигурация ----------
  if (window.wf_minimalUtmTrackerInitialized) return;
  window.wf_minimalUtmTrackerInitialized = true;

  var CONFIG = {
    STORAGE_KEY: 'wf_utm_minimal',
    STORAGE_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,
    BINOTEL_WAIT_MS: 4000,   // максимум ждать Binotel перед fallback
    BINOTEL_POLL_INTERVAL: 200 // как часто проверять состояние загрузки
  };

  // debug можно временно включить в консоли: window.__wf_debug = true;
  function dlog() { if (window.__wf_debug) try { console.log.apply(console, arguments);} catch(e){} }

  // ---------- utils ----------
  function safe(fn) { try { return fn(); } catch (e) { dlog('safe error', e); return undefined; } }

  function isStorageSupported() {
    return safe(function () {
      if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') return false;
      var k = '__wf_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    }) || false;
  }

  function parseUrlParamsFallback() {
    var map = {};
    try {
      var q = (window.location.search || '').replace(/^\?/, '');
      if (!q) return map;
      q.split('&').forEach(function (p) {
        if (!p) return;
        var idx = p.indexOf('=');
        if (idx === -1) map[decodeURIComponent(p)] = '';
        else map[decodeURIComponent(p.slice(0, idx))] = decodeURIComponent(p.slice(idx + 1) || '');
      });
    } catch (e) {}
    return map;
  }

  function getUrlParams() {
    return safe(function () { return new URLSearchParams(window.location.search || ''); }) || {
      get: function (k) { return parseUrlParamsFallback()[k] || null; }
    };
  }

  function safeCookieMatch(re) {
    return safe(function () { return document.cookie ? document.cookie.match(re) : null; }) || null;
  }

  function readGoogleClientIdFromCookie() {
    var m = safe(function () { return safeCookieMatch(/_ga=GA\d+\.\d+\.(\d+\.\d+|\d+)/); });
    return m ? (m[1] && String(m[1]).trim()) : null;
  }

  function getPageUrlWithoutParams(exclude) {
    return safe(function () {
      if (typeof URL === 'function') {
        var u = new URL(window.location.href);
        if (Array.isArray(exclude)) exclude.forEach(function (p) { u.searchParams.delete(p); });
        return (u.origin || (u.protocol + '//' + u.host)) + u.pathname + (u.search || '') + (u.hash || '');
      } else {
        // fallback простого удаления параметров
        var origin = (window.location.origin || (window.location.protocol + '//' + window.location.host));
        var pathname = window.location.pathname || '';
        var hash = window.location.hash || '';
        var search = (window.location.search || '').replace(/^\?/, '');
        if (!search) return origin + pathname + hash;
        var pairs = search.split('&').filter(Boolean);
        var out = pairs.filter(function (p) { var k = p.split('=')[0]; return !(exclude && exclude.indexOf(k) !== -1); });
        return origin + pathname + (out.length ? ('?' + out.join('&')) : '') + hash;
      }
    }) || window.location.href;
  }

  // ---------- storage ----------
  var Storage = (function () {
    function _get() {
      try {
        if (!isStorageSupported()) return null;
        var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) { localStorage.removeItem(CONFIG.STORAGE_KEY); return null; }
        if (parsed.expiry && Date.now() > parsed.expiry) { localStorage.removeItem(CONFIG.STORAGE_KEY); return null; }
        return parsed.data;
      } catch (e) { try { localStorage.removeItem(CONFIG.STORAGE_KEY);} catch(e){}; return null; }
    }
    function _set(obj) {
      try {
        if (!isStorageSupported()) return false;
        var item = { data: obj, ts: Date.now(), expiry: Date.now() + CONFIG.STORAGE_EXPIRY_MS };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(item));
        return true;
      } catch (e) { try { localStorage.removeItem(CONFIG.STORAGE_KEY);} catch(e){}; return false; }
    }
    return { get: _get, set: _set };
  })();

  // ---------- поля (как просили) ----------
  var FIELDS = {
    utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    clicks: ['gclid', 'fbclid', 'ttclid'],
    fb: ['fbp', 'fbc']
  };

  // собираем / сохраняем данные
  function initTrackingData() {
    return safe(function () {
      var urlParams = getUrlParams();
      var stored = Storage.get() || {};

      FIELDS.utm.forEach(function (k) {
        var v = (urlParams.get ? urlParams.get(k) : null);
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });
      FIELDS.clicks.forEach(function (k) {
        var v = (urlParams.get ? urlParams.get(k) : null);
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });
      FIELDS.fb.forEach(function (k) {
        var v = (urlParams.get ? urlParams.get(k) : null);
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });

      if (!stored.fbp) { var m = safeCookieMatch(/_fbp=([^;]+)/); if (m && m[1]) stored.fbp = String(m[1]).trim(); }
      if (!stored.fbc) { var m2 = safeCookieMatch(/_fbc=([^;]+)/); if (m2 && m2[1]) stored.fbc = String(m2[1]).trim(); }

      var ga = readGoogleClientIdFromCookie(); if (ga) stored.google_client_id = ga;

      var exclude = [].concat(FIELDS.utm, FIELDS.clicks, FIELDS.fb, ['epik']);
      stored.page_url = getPageUrlWithoutParams(exclude);

      Storage.set(stored);
      return stored;
    }) || (Storage.get() || {});
  }

  function getFinalData() {
    return safe(function () {
      var urlParams = getUrlParams();
      var stored = Storage.get() || {};
      var out = {};

      FIELDS.utm.forEach(function (k) {
        var uv = (urlParams.get ? urlParams.get(k) : null);
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });
      FIELDS.clicks.forEach(function (k) {
        var uv = (urlParams.get ? urlParams.get(k) : null);
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });
      FIELDS.fb.forEach(function (k) {
        var uv = (urlParams.get ? urlParams.get(k) : null);
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });

      out.google_client_id = readGoogleClientIdFromCookie() || stored.google_client_id || null;
      var exclude = [].concat(FIELDS.utm, FIELDS.clicks, FIELDS.fb, ['epik']);
      out.page_url = getPageUrlWithoutParams(exclude) || stored.page_url || window.location.href;
      out.form_name = null;
      return out;
    }) || (Storage.get() || {});
  }

  // ---------- безопасная подстановка полей в форму ----------
  function setFieldValue(form, selector, value) {
    return safe(function () {
      if (!form || typeof form.querySelectorAll !== 'function') return false;
      var nodes = form.querySelectorAll(selector);
      if (!nodes || !nodes.length) return false;
      var v = value != null ? String(value) : '';
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        try { if ('value' in el) el.value = v; else el.setAttribute && el.setAttribute('value', v); } catch (e) {}
      }
      return true;
    }) || false;
  }

  function fillHiddenFields(form) {
    safe(function () {
      if (!form || typeof form.querySelector !== 'function') return;
      var data = getFinalData();
      FIELDS.utm.forEach(function (k) { setFieldValue(form, '.' + k, data[k]); });
      FIELDS.clicks.forEach(function (k) { setFieldValue(form, '.' + k, data[k]); });
      FIELDS.fb.forEach(function (k) { setFieldValue(form, '.' + k, data[k]); });
      setFieldValue(form, '.google_client_id', data.google_client_id);
      setFieldValue(form, '.page_url', data.page_url);
      var formName = form.getAttribute('data-name') || form.getAttribute('name') || form.id || '';
      setFieldValue(form, '.form_name', formName);
      // сохраняем snapshot частично
      try {
        var stored = Storage.get() || {};
        var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','fbp','fbc','google_client_id','page_url'];
        keys.forEach(function (k) { if (data[k]) stored[k] = data[k]; });
        Storage.set(stored);
      } catch (e) {}
    });
  }

  function initForms() {
    safe(function () {
      var forms = document.querySelectorAll ? document.querySelectorAll('form') : [];
      for (var i = 0; i < forms.length; i++) try { fillHiddenFields(forms[i]); } catch (e) {}
      try {
        document.addEventListener('submit', function (ev) {
          try { if (ev && ev.target && ev.target.tagName === 'FORM') fillHiddenFields(ev.target); } catch (e) {}
        }, true);
      } catch (e) {}
    });
  }

  // ---------- ожидание Binotel (чтобы избежать race) ----------
  // ищет script[src*="widgets.binotel.com/calltracking/widgets/"]
  function findBinotelScriptTag() {
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var s = scripts[i];
        if (!s || !s.src) continue;
        if (s.src.indexOf('widgets.binotel.com/calltracking/widgets') !== -1) return s;
      }
    } catch (e) {}
    return null;
  }

  function waitForBinotelThen(cb) {
    var done = false;
    var start = Date.now();

    function finish() {
      if (done) return;
      done = true;
      try { cb(); } catch (e) {}
    }

    // Если Binotel script присутствует — ожидаем его onload (с таймаутом)
    var tag = findBinotelScriptTag();
    if (tag) {
      try {
        // Если уже загружен (readyState / complete)
        if (tag.readyState === 'complete' || tag.readyState === 'loaded' || tag.getAttribute('data-wf-binotel-loaded') === '1') {
          finish();
          return;
        }
        // подключим обработчики
        var onDone = function () { try { tag.setAttribute('data-wf-binotel-loaded','1'); } catch(e){}; finish(); };
        var onErr = function () { finish(); };
        tag.addEventListener ? tag.addEventListener('load', onDone) : (tag.onload = onDone);
        tag.addEventListener ? tag.addEventListener('error', onErr) : (tag.onerror = onErr);
        // safety timeout
        var t = setTimeout(function () { clear(); finish(); }, CONFIG.BINOTEL_WAIT_MS);
        function clear() { try { tag.removeEventListener && tag.removeEventListener('load', onDone); tag.removeEventListener && tag.removeEventListener('error', onErr); } catch(e){}; try { tag.onload = tag.onerror = null;} catch(e){}; clearTimeout(t); }
        return;
      } catch (e) { finish(); return; }
    } else {
      // Если тега нет — подождём коротко (чтобы Binotel успел динамически вставиться), но не долго
      var interval = setInterval(function () {
        if (Date.now() - start > CONFIG.BINOTEL_WAIT_MS) {
          try { clearInterval(interval); } catch (e) {}
          finish();
          return;
        }
        var t = findBinotelScriptTag();
        if (t) {
          try { clearInterval(interval); } catch (e) {}
          // снова рекурсивно — чтобы повесить onload
          waitForBinotelThen(cb);
        }
      }, CONFIG.BINOTEL_POLL_INTERVAL);
    }
  }

  // ---------- запуск (init) ----------
  try {
    initTrackingData();
  } catch (e) { dlog('initTrackingData failed', e); }

  // Ждём Binotel (макс WAIT_MS), затем инициализируем формы и наблюдатель для поздних изменений
  waitForBinotelThen(function () {
    try {
      initForms();

      // Наблюдатель — для случаев, когда Binotel динамически перерисовывает содержимое позже (особенно в WebView)
      try {
        if (typeof MutationObserver !== 'undefined') {
          var mo = new MutationObserver(function () {
            try {
              initForms(); // пере-попытка заполнить формы при изменениях DOM
            } catch (e) {}
          });
          mo.observe(document.body, { childList: true, subtree: true });
          // можно позже отключить mo.disconnect() если не нужен постоянно
        }
      } catch (e) {}
    } catch (e) { dlog('post-binotel init error', e); }
  });

  // Публичный API (не перезаписываем если уже есть)
  if (!window.wf_getUtmMinimalData) window.wf_getUtmMinimalData = function () { try { return getFinalData(); } catch (e) { return {}; } };
  if (!window.wf_fillFormWithUtm) window.wf_fillFormWithUtm = function (form) { try { fillHiddenFields(form); return true; } catch (e) { return false; } };

})();
