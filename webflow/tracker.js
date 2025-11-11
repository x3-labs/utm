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

  function safeLog() {
    // DEBUG отключён — ничего не логируем
  }

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
        // минимальный fallback
        const params = new URLSearchParams();
        try {
          const q = (window.location.search || '').replace(/^\?/, '');
          q.split('&').forEach(pair => {
            if (!pair) return;
            const idx = pair.indexOf('=');
            if (idx === -1) params.set(decodeURIComponent(pair), '');
            else params.set(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)));
          });
        } catch (ee) {}
        return params;
      }
    },

    getPageUrlWithoutParams: function (excludeParams) {
      try {
        const u = new URL(window.location.href);
        if (excludeParams && Array.isArray(excludeParams)) {
          excludeParams.forEach(p => u.searchParams.delete(p));
        }
        return u.origin + u.pathname + (u.search ? u.search : '');
      } catch (e) {
        // fallback: strip search manually
        return window.location.origin ? (window.location.origin + window.location.pathname) : (window.location.protocol + '//' + window.location.host + window.location.pathname);
      }
    },

    safeCookieMatch: function (re) {
      try {
        return document.cookie ? document.cookie.match(re) : null;
      } catch (e) {
        return null;
      }
    }
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

  // Чтение client id для Google Analytics (_ga cookie)
  function readGoogleClientIdFromCookie() {
    try {
      // ожидаем формат: _ga=GA1.2.123456789.1234567890
      const m = Utils.safeCookieMatch(/_ga=GA\d+\.\d+\.(\d+\.\d+|\d+)/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  // Какие параметры мы сохраняем (минимум, по запросу)
  const FIELDS = {
    utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    clicks: ['gclid', 'fbclid', 'ttclid'],
    fb: ['fbp', 'fbc']
  };

  // Инициализация: читаем из URL и cookies, сохраняем в localStorage
  function initTrackingData() {
    try {
      const urlParams = Utils.getUrlParams();
      const stored = Storage.get() || {};

      // считываем UTM
      FIELDS.utm.forEach(k => {
        const v = urlParams.get(k);
        if (v && v.trim()) stored[k] = v.trim();
      });

      // click IDs
      FIELDS.clicks.forEach(k => {
        const v = urlParams.get(k);
        if (v && v.trim()) stored[k] = v.trim();
      });

      // fb params (url or cookie)
      FIELDS.fb.forEach(k => {
        const v = urlParams.get(k);
        if (v && v.trim()) stored[k] = v.trim();
      });
      // если fbp/fbc не в URL — попробовать cookie
      if (!stored.fbp) {
        const m = Utils.safeCookieMatch(/_fbp=([^;]+)/);
        if (m && m[1]) stored.fbp = m[1];
      }
      if (!stored.fbc) {
        const m2 = Utils.safeCookieMatch(/_fbc=([^;]+)/);
        if (m2 && m2[1]) stored.fbc = m2[1];
      }

      // google client id из cookie
      const ga = readGoogleClientIdFromCookie();
      if (ga) stored.google_client_id = ga;

      // page_url: текущая страница без перечисленных UTM/click/fb парамет (чтобы очистить UTM)
      const exclude = [...FIELDS.utm, ...FIELDS.clicks, ...FIELDS.fb, 'epik'];
      stored.page_url = Utils.getPageUrlWithoutParams(exclude);

      // Сохраняем (подменяем старые значения только если есть)
      Storage.set(stored);

      return stored;
    } catch (e) {
      safeLog('initTrackingData error', e);
      return Storage.get() || {};
    }
  }

  // Возвращает финальные значения (учитывает URL приоритетно)
  function getFinalData() {
    try {
      const urlParams = Utils.getUrlParams();
      const stored = Storage.get() || {};
      const out = {};

      // utm
      FIELDS.utm.forEach(k => {
        const uv = urlParams.get(k);
        out[k] = (uv && uv.trim()) ? uv.trim() : (stored[k] || null);
      });

      // clicks
      FIELDS.clicks.forEach(k => {
        const uv = urlParams.get(k);
        out[k] = (uv && uv.trim()) ? uv.trim() : (stored[k] || null);
      });

      // fb
      FIELDS.fb.forEach(k => {
        const uv = urlParams.get(k);
        out[k] = (uv && uv.trim()) ? uv.trim() : (stored[k] || null);
      });

      // google client id
      out.google_client_id = readGoogleClientIdFromCookie() || stored.google_client_id || null;

      // page_url
      const exclude = [...FIELDS.utm, ...FIELDS.clicks, ...FIELDS.fb, 'epik'];
      out.page_url = Utils.getPageUrlWithoutParams(exclude) || stored.page_url || window.location.href;

      // form name will be set at fill time
      out.form_name = null;

      return out;
    } catch (e) {
      return Storage.get() || {};
    }
  }

  // Заполнение полей формы (ищем элементы по классам, как договорились)
  function fillHiddenFields(form) {
    if (!form || typeof form.querySelector !== 'function') return;
    try {
      const data = getFinalData();

      // UTM
      FIELDS.utm.forEach(k => {
        try { setFieldValue(form, '.' + k, data[k]); } catch (e) {}
      });

      // Click IDs
      FIELDS.clicks.forEach(k => {
        try { setFieldValue(form, '.' + k, data[k]); } catch (e) {}
      });

      // FB
      FIELDS.fb.forEach(k => {
        try { setFieldValue(form, '.' + k, data[k]); } catch (e) {}
      });

      // google client id
      try { setFieldValue(form, '.google_client_id', data.google_client_id); } catch (e) {}

      // page url
      try { setFieldValue(form, '.page_url', data.page_url); } catch (e) {}

      // form name / id / data-name
      try {
        const formName = form.getAttribute('data-name') || form.getAttribute('name') || form.id || '';
        setFieldValue(form, '.form_name', formName);
      } catch (e) {}

      // обновляем локально сохранённые данные (на случай, если URL содержал новые params)
      try {
        const toStore = Storage.get() || {};
        // записываем только существуютие ключи из getFinalData (чтобы не ломать)
        Object.assign(toStore, {
          utm_source: data.utm_source || toStore.utm_source,
          utm_medium: data.utm_medium || toStore.utm_medium,
          utm_campaign: data.utm_campaign || toStore.utm_campaign,
          utm_content: data.utm_content || toStore.utm_content,
          utm_term: data.utm_term || toStore.utm_term,
          gclid: data.gclid || toStore.gclid,
          fbclid: data.fbclid || toStore.fbclid,
          ttclid: data.ttclid || toStore.ttclid,
          fbp: data.fbp || toStore.fbp,
          fbc: data.fbc || toStore.fbc,
          google_client_id: data.google_client_id || toStore.google_client_id,
          page_url: data.page_url || toStore.page_url
        });
        Storage.set(toStore);
      } catch (e) {}

    } catch (e) {
      safeLog('fillHiddenFields top error', e);
    }
  }

  function setFieldValue(form, selector, value) {
    try {
      if (!form || typeof form.querySelector !== 'function') return false;
      const el = form.querySelector(selector);
      if (!el) return false;
      // если это input/textarea/select — установим value; иначе атрибут value
      try {
        if ('value' in el) el.value = value != null ? String(value) : '';
        else el.setAttribute('value', value != null ? String(value) : '');
      } catch (e) {
        try { el.setAttribute('value', value != null ? String(value) : ''); } catch (ee) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Инициализация форм: заполняем существующие и ставим слушатель submit
  function initForms() {
    try {
      const forms = document.querySelectorAll ? document.querySelectorAll('form') : [];
      Array.prototype.forEach.call(forms, function (f) {
        try { fillHiddenFields(f); } catch (e) {}
      });

      // На отправке формы ещё раз подставляем актуальные значения
      try {
        document.addEventListener('submit', function (ev) {
          try {
            if (ev && ev.target && ev.target.tagName === 'FORM') {
              fillHiddenFields(ev.target);
            }
          } catch (e) {}
        }, true);
      } catch (e) {}

    } catch (e) {
      safeLog('initForms error', e);
    }
  }

  // Публичные функции (не перезаписываем если уже есть)
  if (!window.wf_getUtmMinimalData) {
    window.wf_getUtmMinimalData = function () {
      try {
        return getFinalData();
      } catch (e) {
        return {};
      }
    };
  }

  if (!window.wf_fillFormWithUtm) {
    window.wf_fillFormWithUtm = function (form) {
      try {
        fillHiddenFields(form);
        return true;
      } catch (e) {
        return false;
      }
    };
  }

  // Запускаем сбор (читать и сохранить)
  try {
    initTrackingData();
  } catch (e) {}

  // Инициализируем формы после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }

  // небольшая дополнительная попытка после load (чтобы снизить race conditions с async виджетами)
  try {
    window.addEventListener('load', function () {
      try { setTimeout(initForms, 50); } catch (e) {}
    });
  } catch (e) {}

})();
</script>
