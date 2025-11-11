<script>
(function () {
  'use strict';

  // Защита от повторной инициализации
  if (window.wf_minimalUtmTrackerInitialized) return;
  window.wf_minimalUtmTrackerInitialized = true;

  const CONFIG = {
    STORAGE_KEY: 'wf_utm_minimal',
    STORAGE_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000 // 30 дней
  };

  function noop() {} // DEBUG отключён

  function isStorageSupported() {
    try {
      if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') return false;
      const k = '__wf_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const Utils = {
    getUrlParams: function () {
      try {
        return new URLSearchParams(window.location.search || '');
      } catch (e) {
        // Простейший fallback: парсим вручную
        const params = new (function () {
          const map = {};
          this.get = function (k) { return map.hasOwnProperty(k) ? map[k] : null; };
          this.set = function (k, v) { map[k] = v; };
          this.has = function (k) { return map.hasOwnProperty(k); };
        })();

        try {
          const q = (window.location.search || '').replace(/^\?/, '');
          if (!q) return params;
          q.split('&').forEach(pair => {
            if (!pair) return;
            const idx = pair.indexOf('=');
            if (idx === -1) params.set(decodeURIComponent(pair), '');
            else params.set(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1) || ''));
          });
        } catch (ee) {}
        return params;
      }
    },

    getPageUrlWithoutParams: function (excludeParams) {
      try {
        if (typeof URL === 'function') {
          const u = new URL(window.location.href);
          if (excludeParams && Array.isArray(excludeParams)) {
            excludeParams.forEach(p => u.searchParams.delete(p));
          }
          // Возвращаем origin + pathname + (если остались другие параметры) search + hash (без utm-параметров)
          return (u.origin || (u.protocol + '//' + u.host)) + u.pathname + (u.search || '') + (u.hash || '');
        } else {
          // fallback для старых браузеров — удаляем параметры руками
          const loc = window.location;
          const origin = loc.origin || (loc.protocol + '//' + loc.host);
          const pathname = loc.pathname || '';
          const hash = loc.hash || '';
          const search = (loc.search || '').replace(/^\?/, '');
          if (!search) return origin + pathname + hash;
          try {
            const pairs = search.split('&').filter(Boolean);
            const out = pairs.filter(p => {
              const k = p.split('=')[0];
              return !(excludeParams && excludeParams.indexOf(k) !== -1);
            });
            return origin + pathname + (out.length ? ('?' + out.join('&')) : '') + hash;
          } catch (e) {
            return origin + pathname + hash;
          }
        }
      } catch (e) {
        try {
          // максимально безопасный fallback
          const loc = window.location;
          const origin = loc.origin || (loc.protocol + '//' + loc.host);
          return origin + (loc.pathname || '') + (loc.hash || '');
        } catch (ee) {
          return window.location.href;
        }
      }
    },

    safeCookieMatch: function (re) {
      try {
        return document.cookie ? document.cookie.match(re) : null;
      } catch (e) {
        return null;
      }
    },

    trim: function (v) { return typeof v === 'string' ? v.trim() : v; }
  };

  const Storage = {
    set: function (obj) {
      if (!isStorageSupported()) return false;
      try {
        const item = { data: obj, ts: Date.now(), expiry: Date.now() + CONFIG.STORAGE_EXPIRY_MS };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(item));
        return true;
      } catch (e) {
        try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (ee) {}
        try {
          const item = { data: obj, ts: Date.now(), expiry: Date.now() + CONFIG.STORAGE_EXPIRY_MS };
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(item));
          return true;
        } catch (e2) {
          return false;
        }
      }
    },
    get: function () {
      if (!isStorageSupported()) return null;
      try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
          try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (ee) {}
          return null;
        }
        if (parsed.expiry && Date.now() > parsed.expiry) {
          try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (ee) {}
          return null;
        }
        return parsed.data;
      } catch (e) {
        try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (ee) {}
        return null;
      }
    }
  };

  // чтение Google client id (_ga)
  function readGoogleClientIdFromCookie() {
    try {
      // формат _ga=GA1.2.123456789.1234567890
      const m = Utils.safeCookieMatch(/_ga=GA\d+\.\d+\.(\d+\.\d+|\d+)/);
      return m ? Utils.trim(m[1]) : null;
    } catch (e) { return null; }
  }

  const FIELDS = {
    utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    clicks: ['gclid', 'fbclid', 'ttclid'],
    fb: ['fbp', 'fbc']
  };

  function initTrackingData() {
    try {
      const urlParams = Utils.getUrlParams();
      const stored = Storage.get() || {};

      // utm
      FIELDS.utm.forEach(k => {
        const v = urlParams.get ? urlParams.get(k) : null;
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });

      // clicks
      FIELDS.clicks.forEach(k => {
        const v = urlParams.get ? urlParams.get(k) : null;
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });

      // fb via url or cookie
      FIELDS.fb.forEach(k => {
        const v = urlParams.get ? urlParams.get(k) : null;
        if (v && String(v).trim()) stored[k] = String(v).trim();
      });

      if (!stored.fbp) {
        const m = Utils.safeCookieMatch(/_fbp=([^;]+)/);
        if (m && m[1]) stored.fbp = Utils.trim(m[1]);
      }
      if (!stored.fbc) {
        const m2 = Utils.safeCookieMatch(/_fbc=([^;]+)/);
        if (m2 && m2[1]) stored.fbc = Utils.trim(m2[1]);
      }

      // google client id
      const ga = readGoogleClientIdFromCookie();
      if (ga) stored.google_client_id = ga;

      // page_url — без UTM/click/fb параметров
      const exclude = [].concat(FIELDS.utm, FIELDS.clicks, FIELDS.fb, ['epik']);
      stored.page_url = Utils.getPageUrlWithoutParams(exclude);

      Storage.set(stored);
      return stored;
    } catch (e) {
      return Storage.get() || {};
    }
  }

  function getFinalData() {
    try {
      const urlParams = Utils.getUrlParams();
      const stored = Storage.get() || {};
      const out = {};

      FIELDS.utm.forEach(k => {
        const uv = urlParams.get ? urlParams.get(k) : null;
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });

      FIELDS.clicks.forEach(k => {
        const uv = urlParams.get ? urlParams.get(k) : null;
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });

      FIELDS.fb.forEach(k => {
        const uv = urlParams.get ? urlParams.get(k) : null;
        out[k] = (uv && String(uv).trim()) ? String(uv).trim() : (stored[k] || null);
      });

      out.google_client_id = readGoogleClientIdFromCookie() || stored.google_client_id || null;

      const exclude = [].concat(FIELDS.utm, FIELDS.clicks, FIELDS.fb, ['epik']);
      out.page_url = Utils.getPageUrlWithoutParams(exclude) || stored.page_url || window.location.href;

      out.form_name = null;
      return out;
    } catch (e) {
      return Storage.get() || {};
    }
  }

  // Записывает value в все элементы, подходящие под selector внутри form
  function setFieldValue(form, selector, value) {
    try {
      if (!form || typeof form.querySelectorAll !== 'function') return false;
      const nodes = form.querySelectorAll(selector);
      if (!nodes || nodes.length === 0) return false;
      const v = value != null ? String(value) : '';
      for (var i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        try {
          if ('value' in el) el.value = v;
          else el.setAttribute && el.setAttribute('value', v);
        } catch (e) {
          try { el.setAttribute && el.setAttribute('value', v); } catch (ee) {}
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function fillHiddenFields(form) {
    if (!form || typeof form.querySelector !== 'function') return;
    try {
      const data = getFinalData();

      // utm
      FIELDS.utm.forEach(k => { try { setFieldValue(form, '.' + k, data[k]); } catch (e) {} });

      // clicks
      FIELDS.clicks.forEach(k => { try { setFieldValue(form, '.' + k, data[k]); } catch (e) {} });

      // fb
      FIELDS.fb.forEach(k => { try { setFieldValue(form, '.' + k, data[k]); } catch (e) {} });

      // google client id
      try { setFieldValue(form, '.google_client_id', data.google_client_id); } catch (e) {}

      // page_url
      try { setFieldValue(form, '.page_url', data.page_url); } catch (e) {}

      // form name
      try {
        const formName = form.getAttribute('data-name') || form.getAttribute('name') || form.id || '';
        setFieldValue(form, '.form_name', formName);
      } catch (e) {}

      // сохраняем текущий snapshot в localStorage (без перезаписи пустыми)
      try {
        const stored = Storage.get() || {};
        var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','fbp','fbc','google_client_id','page_url'];
        keys.forEach(function(k) {
          if (data[k]) stored[k] = data[k];
        });
        Storage.set(stored);
      } catch (e) {}

    } catch (e) {}
  }

  function initForms() {
    try {
      var forms = document.querySelectorAll ? document.querySelectorAll('form') : [];
      for (var i = 0; i < forms.length; i++) {
        try { fillHiddenFields(forms[i]); } catch (e) {}
      }

      try {
        document.addEventListener('submit', function (ev) {
          try {
            if (ev && ev.target && ev.target.tagName === 'FORM') {
              fillHiddenFields(ev.target);
            }
          } catch (e) {}
        }, true);
      } catch (e) {}
    } catch (e) {}
  }

  if (!window.wf_getUtmMinimalData) {
    window.wf_getUtmMinimalData = function () {
      try { return getFinalData(); } catch (e) { return {}; }
    };
  }

  if (!window.wf_fillFormWithUtm) {
    window.wf_fillFormWithUtm = function (form) {
      try { fillHiddenFields(form); return true; } catch (e) { return false; }
    };
  }

  try { initTrackingData(); } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }

  try {
    window.addEventListener('load', function () {
      try { setTimeout(initForms, 50); } catch (e) {}
    });
  } catch (e) {}

})();
</script>
