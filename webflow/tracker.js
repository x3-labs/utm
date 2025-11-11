(function () {
  'use strict';

  // Защита от повторной инициализации
  if (window.wf_webflowAnalyticsInitialized) {
    return;
  }
  window.wf_webflowAnalyticsInitialized = true;

  // Конфигурация
  const CONFIG = {
    STORAGE_KEY: 'wf_analytics_data',
    SESSION_KEY: 'wf_analytics_session',
    STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 дней
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 минут
    DEBUG_MODE: false,
    MAX_PAGES_TRACKED: 100,
    INIT_LOAD_DELAY_MS: 50 // задержка дополнительной инициализации после load
  };

  // Безопасное логирование (DEBUG_MODE=false по умолчанию)
  function safeLog(message, data) {
    if (CONFIG.DEBUG_MODE && typeof console !== 'undefined') {
      try {
        console.log('[wf-analytics]', message, data || '');
      } catch (e) {}
    }
  }

  // Проверка поддержки localStorage (без выбрасывания исключений)
  function isStorageSupported() {
    try {
      if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') return false;
      const testKey = '__wf_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Утилиты
  const Utils = {
    getUrlParams: function () {
      try {
        return new URLSearchParams(window.location.search || '');
      } catch (e) {
        // Фолбэк на ручный парсинг (очень старые браузеры)
        const params = new URLSearchParams();
        try {
          const q = (window.location.search || '').replace(/^\?/, '');
          q.split('&').forEach(pair => {
            if (!pair) return;
            const [k, v] = pair.split('=').map(decodeURIComponent);
            params.set(k, v || '');
          });
        } catch (ee) {}
        return params;
      }
    },

    getCleanUrl: function () {
      try {
        const u = new URL(window.location.href);
        return u.origin + u.pathname;
      } catch (e) {
        return window.location.href;
      }
    },

    getFullCleanUrl: function (excludeParams) {
      try {
        const u = new URL(window.location.href);
        if (excludeParams && Array.isArray(excludeParams)) {
          excludeParams.forEach(p => u.searchParams.delete(p));
        }
        return u.href;
      } catch (e) {
        return window.location.href;
      }
    },

    getBrowserLanguage: function () {
      try {
        return navigator.language || navigator.userLanguage || '';
      } catch (e) {
        return '';
      }
    },

    debounce: function (fn, wait) {
      let t;
      return function () {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    safeMatchCookie: function (pattern) {
      try {
        return document.cookie ? document.cookie.match(pattern) : null;
      } catch (e) {
        return null;
      }
    }
  };

  // Безопасные операции с localStorage (все операции — no-throw)
  const Storage = {
    set: function (key, data, expiry) {
      if (!isStorageSupported()) return false;
      try {
        const item = {
          data: data,
          timestamp: Date.now(),
          expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY)
        };
        localStorage.setItem(key, JSON.stringify(item));
        return true;
      } catch (e) {
        safeLog('Storage.set error:', e);
        // Пытаемся аккуратно освободить только наши ключи и повторить
        try {
          [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(k => {
            try { localStorage.removeItem(k); } catch (ee) {}
          });
          const item = {
            data: data,
            timestamp: Date.now(),
            expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY)
          };
          localStorage.setItem(key, JSON.stringify(item));
          return true;
        } catch (e2) {
          return false;
        }
      }
    },

    get: function (key) {
      if (!isStorageSupported()) return null;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
          try { localStorage.removeItem(key); } catch (ee) {}
          return null;
        }
        if (parsed.expiry && Date.now() > parsed.expiry) {
          try { localStorage.removeItem(key); } catch (ee) {}
          return null;
        }
        return parsed.data;
      } catch (e) {
        safeLog('Storage.get error:', e);
        try { localStorage.removeItem(key); } catch (ee) {}
        return null;
      }
    },

    remove: function (key) {
      if (!isStorageSupported()) return;
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  // Получение Client ID из cookies (всё в try/catch)
  const ClientIds = {
    google: function () {
      try {
        const m = Utils.safeMatchCookie(/_ga=GA\d+\.\d+\.(\d+\.\d+|\d+)/);
        return m ? m[1] : null;
      } catch (e) { return null; }
    },
    yandex: function () {
      try {
        const m = Utils.safeMatchCookie(/_ym_uid=(\d+)/);
        return m ? m[1] : null;
      } catch (e) { return null; }
    },
    facebook: function () {
      try {
        const m = Utils.safeMatchCookie(/_fbp=([^;]+)/);
        return m ? m[1] : null;
      } catch (e) { return null; }
    },
    pinterest: function () {
      try {
        const params = Utils.getUrlParams();
        const urlValue = params.get('epik');
        if (urlValue && urlValue.trim()) return urlValue.trim();
        const m = Utils.safeMatchCookie(/_epik=([^;]+)/);
        return m ? m[1] : null;
      } catch (e) { return null; }
    }
  };

  // Менеджер сессии
  const SessionManager = {
    init: function () {
      const currentUrl = Utils.getCleanUrl();
      const now = Date.now();

      let sessionData = Storage.get(CONFIG.SESSION_KEY);

      try {
        if (!sessionData || !sessionData.startTime || !Array.isArray(sessionData.pagesViewed)) {
          sessionData = null;
        } else if (sessionData.lastActivity && (now - sessionData.lastActivity) > CONFIG.SESSION_TIMEOUT) {
          sessionData = null;
        }
      } catch (e) {
        sessionData = null;
      }

      if (!sessionData) {
        sessionData = {
          startTime: now,
          pagesViewed: [currentUrl],
          lastActivity: now
        };
        safeLog('New session created');
      } else {
        if (!sessionData.pagesViewed.includes(currentUrl)) {
          sessionData.pagesViewed.push(currentUrl);
          if (sessionData.pagesViewed.length > CONFIG.MAX_PAGES_TRACKED) {
            sessionData.pagesViewed = sessionData.pagesViewed.slice(-CONFIG.MAX_PAGES_TRACKED);
          }
        }
        sessionData.lastActivity = now;
        safeLog('Session updated');
      }

      Storage.set(CONFIG.SESSION_KEY, sessionData, now + CONFIG.SESSION_TIMEOUT);
      return sessionData;
    },

    getMetrics: function () {
      try {
        const sessionData = Storage.get(CONFIG.SESSION_KEY);
        if (!sessionData || !sessionData.startTime || !Array.isArray(sessionData.pagesViewed)) {
          return { pages_viewed: 1, session_duration: 0 };
        }
        const duration = Math.round((Date.now() - sessionData.startTime) / 1000);
        return { pages_viewed: sessionData.pagesViewed.length, session_duration: Math.max(0, duration) };
      } catch (e) {
        return { pages_viewed: 1, session_duration: 0 };
      }
    }
  };

  // TrackingManager (сохранение UTM + click IDs)
  const TrackingManager = {
    utmParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    clickIdParams: ['gclid', 'fbclid', 'ttclid', 'yclid', 'msclkid', 'twclid', 'li_fat_id', 'awclid', 'rdt_cid', 'irclickid'],
    facebookParams: ['fbp', 'fbc'],
    allParams: [],
    savedData: {},

    init: function () {
      try {
        this.allParams = [...this.utmParams, ...this.clickIdParams, ...this.facebookParams, 'epik'];
        this.savedData = Storage.get(CONFIG.STORAGE_KEY) || {};

        const params = Utils.getUrlParams();
        const newParams = {};
        let hasNew = false;

        [...this.utmParams, ...this.clickIdParams, ...this.facebookParams].forEach(p => {
          const v = params.get(p);
          if (v && v.trim()) {
            newParams[p] = v.trim();
            hasNew = true;
          }
        });

        const pinterestId = ClientIds.pinterest();
        if (pinterestId) {
          newParams.epik = pinterestId;
          hasNew = true;
        }

        if (hasNew) {
          Object.assign(this.savedData, newParams);
          const nowIso = new Date().toISOString();
          const pageUrl = Utils.getFullCleanUrl(this.allParams);

          if (!this.savedData.first_visit_timestamp) {
            this.savedData.first_visit_timestamp = nowIso;
            this.savedData.first_visit_page = pageUrl;
          }
          this.savedData.last_visit_timestamp = nowIso;
          this.savedData.last_visit_page = pageUrl;

          Storage.set(CONFIG.STORAGE_KEY, this.savedData);
          safeLog('Tracking params updated', newParams);
        }
      } catch (e) {
        safeLog('TrackingManager.init error', e);
      }
      return this;
    },

    getFinalData: function () {
      try {
        const params = Utils.getUrlParams();
        const finalData = Object.assign({}, this.savedData || {});

        [...this.utmParams, ...this.clickIdParams, ...this.facebookParams].forEach(p => {
          const v = params.get(p);
          if (v && v.trim()) finalData[p] = v.trim();
        });

        const pinterestId = ClientIds.pinterest();
        if (pinterestId) finalData.epik = pinterestId;

        return finalData;
      } catch (e) {
        safeLog('TrackingManager.getFinalData error', e);
        return this.savedData || {};
      }
    }
  };

  // FormManager — безопасное заполнение скрытых полей
  const FormManager = {
    init: function () {
      this.initExistingForms();
      this.setupFormWatcher();
      this.setupSubmitHandler();
    },

    initExistingForms: function () {
      const self = this;
      const initForms = function () {
        try {
          const forms = document.querySelectorAll && document.querySelectorAll('form') || [];
          forms.forEach(f => {
            try { self.fillHiddenFields(f); } catch (e) { safeLog('fillHiddenFields error', e); }
          });
          safeLog(`Initialized ${forms.length} forms`);
        } catch (e) {
          safeLog('initExistingForms error', e);
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initForms);
      } else {
        initForms();
      }
      // Дополнительные попытки (совместимость с Webflow)
      setTimeout(initForms, 100);
      setTimeout(initForms, 500);
    },

    setupFormWatcher: function () {
      const self = this;
      if (typeof MutationObserver === 'undefined') return;
      try {
        const debounced = Utils.debounce(function (mutations) {
          try {
            mutations.forEach(function (m) {
              if (m.type === 'childList') {
                m.addedNodes.forEach(function (node) {
                  if (!node || node.nodeType !== 1) return;
                  if (node.tagName === 'FORM') {
                    try { self.fillHiddenFields(node); } catch (e) { safeLog('fillHiddenFields error', e); }
                  } else if (node.querySelectorAll) {
                    const forms = node.querySelectorAll('form');
                    forms.forEach(function (f) {
                      try { self.fillHiddenFields(f); } catch (e) { safeLog('fillHiddenFields error', e); }
                    });
                  }
                });
              }
            });
          } catch (e) { safeLog('MutationObserver callback error', e); }
        }, 150);

        const observer = new MutationObserver(debounced);
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        safeLog('setupFormWatcher error', e);
      }
    },

    setupSubmitHandler: function () {
      const self = this;
      try {
        document.addEventListener('submit', function (ev) {
          try {
            if (ev && ev.target && ev.target.tagName === 'FORM') {
              self.fillHiddenFields(ev.target);
            }
          } catch (e) {}
        }, true);
      } catch (e) {
        safeLog('setupSubmitHandler error', e);
      }
    },

    fillField: function (form, selector, value) {
      try {
        if (!form || typeof form.querySelector !== 'function') return false;
        const input = form.querySelector(selector);
        if (input) {
          try {
            // Если это input/textarea/select — устанавливаем value; если стоит атрибут value он будет корректно передан
            if ('value' in input) {
              input.value = value != null ? String(value) : '';
            } else {
              // fallback для произвольных элементов
              input.setAttribute('value', value != null ? String(value) : '');
            }
            return true;
          } catch (e) {
            return false;
          }
        }
        return false;
      } catch (e) {
        return false;
      }
    },

    fillHiddenFields: function (form) {
      if (!form || typeof form.querySelector !== 'function') return;
      try {
        // используем wf_trackingManager если есть, иначе — fallback на глобал старого имени (не перезаписываем)
        const tm = (window.wf_trackingManager && typeof window.wf_trackingManager.getFinalData === 'function')
          ? window.wf_trackingManager
          : (window.trackingManager && typeof window.trackingManager.getFinalData === 'function' ? window.trackingManager : null);

        if (!tm) {
          safeLog('No tracking manager available, skipping form fill');
          return;
        }

        const trackingData = tm.getFinalData();
        const sessionMetrics = SessionManager.getMetrics();
        const pageUrl = Utils.getFullCleanUrl((tm.allParams) ? tm.allParams : []);

        // UTM
        (tm.utmParams || []).forEach(p => this.fillField(form, `.${p}`, trackingData[p]));
        // Click IDs
        (tm.clickIdParams || []).forEach(p => this.fillField(form, `.${p}`, trackingData[p]));
        // Facebook
        (tm.facebookParams || []).forEach(p => this.fillField(form, `.${p}`, trackingData[p]));
        // Pinterest
        this.fillField(form, '.epik', trackingData.epik);

        // Основные поля
        this.fillField(form, '.page_url', pageUrl);
        this.fillField(form, '.referer', document.referrer || '');
        this.fillField(form, '.user_agent', navigator.userAgent || '');
        this.fillField(form, '.timestamp', new Date().toISOString());

        // Форм-название / идентификатор
        const formName = form.getAttribute('data-name') || form.getAttribute('name') || form.id || form.className || '';
        this.fillField(form, '.form_name', formName);

        // Client IDs
        this.fillField(form, '.google_client_id', ClientIds.google());
        this.fillField(form, '.yandex_client_id', ClientIds.yandex());
        this.fillField(form, '.facebook_browser_id', ClientIds.facebook());

        // Посещения
        this.fillField(form, '.first_visit_timestamp', trackingData.first_visit_timestamp);
        this.fillField(form, '.last_visit_timestamp', trackingData.last_visit_timestamp);
        this.fillField(form, '.first_visit_page', trackingData.first_visit_page);
        this.fillField(form, '.last_visit_page', trackingData.last_visit_page);

        // Сессия
        this.fillField(form, '.pages_viewed', sessionMetrics.pages_viewed);
        this.fillField(form, '.session_duration', sessionMetrics.session_duration);

        // Язык
        this.fillField(form, '.browser_language', Utils.getBrowserLanguage());
      } catch (e) {
        safeLog('fillHiddenFields top error', e);
      }
    }
  };

  // Флаг инициализации
  let initialized = false;

  // Основная инициализация (защищённая)
  function init() {
    if (initialized) {
      safeLog('Already initialized, skipping');
      return;
    }
    initialized = true;

    try {
      safeLog('Initializing wf Webflow Analytics...');
      // Сессия
      SessionManager.init();

      // Инициализируем trackingManager, не перезаписывая чужие глобалы
      try {
        if (!window.wf_trackingManager) {
          // Если есть сторонний trackingManager с совместимым API — используем его как fallback, но не перезаписываем
          if (window.trackingManager && typeof window.trackingManager.getFinalData === 'function') {
            window.wf_trackingManager = window.trackingManager;
          } else {
            window.wf_trackingManager = TrackingManager.init();
          }
        } else {
          // Если wf_trackingManager уже есть — попытка инициализировать внутреннее состояние
          try { window.wf_trackingManager = Object.assign(window.wf_trackingManager, TrackingManager.init()); } catch (e) {}
        }
      } catch (e) {
        safeLog('trackingManager init error (swallowed)', e);
        try { window.wf_trackingManager = TrackingManager.init(); } catch (ee) {}
      }

      // Инициализируем формы
      FormManager.init();

      safeLog('wf Webflow Analytics initialized');
    } catch (e) {
      safeLog('Critical init error (swallowed):', e);
      initialized = false; // позволим попытке повториться
    }
  }

  // Публичные функции — назначаем только если не присутствуют (чтобы не перезаписывать Binotel или другие)
  if (!window.getWebflowAnalyticsData && !window.getWfAnalyticsData) {
    window.getWfAnalyticsData = function () {
      try {
        const tm = (window.wf_trackingManager && typeof window.wf_trackingManager.getFinalData === 'function')
          ? window.wf_trackingManager
          : (window.trackingManager && typeof window.trackingManager.getFinalData === 'function' ? window.trackingManager : null);

        return {
          tracking_data: tm ? tm.getFinalData() : {},
          session_metrics: SessionManager.getMetrics(),
          client_ids: {
            google: ClientIds.google(),
            yandex: ClientIds.yandex(),
            facebook: ClientIds.facebook(),
            pinterest: ClientIds.pinterest()
          },
          browser_language: Utils.getBrowserLanguage(),
          page_url: tm ? Utils.getFullCleanUrl(tm.allParams) : window.location.href,
          storage_supported: isStorageSupported()
        };
      } catch (e) {
        return { error: 'Ошибка получения данных' };
      }
    };
  } else {
    // Если есть getWebflowAnalyticsData — оставляем его, но создаём наш алиас
    if (!window.getWfAnalyticsData) {
      window.getWfAnalyticsData = window.getWebflowAnalyticsData || function () { return { error: 'No data' }; };
    }
  }

  if (!window.initWebflowAnalyticsForForm && !window.initWfAnalyticsForForm) {
    window.initWfAnalyticsForForm = function (form) {
      try {
        if (form && typeof form.querySelector === 'function') {
          FormManager.fillHiddenFields(form);
          return true;
        }
        return false;
      } catch (e) {
        safeLog('initWebflowAnalyticsForForm error', e);
        return false;
      }
    };
  }

  // Безопасный старт: DOMContentLoaded (как раньше)
  function safeInitWrapper() {
    try { init(); } catch (e) { safeLog('safeInitWrapper error', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitWrapper);
  } else {
    safeInitWrapper();
  }

  // Дополнительная попытка после полной загрузки, с небольшой задержкой — это снижает race conditions с async виджетами (например Binotel)
  try {
    window.addEventListener('load', function () {
      try {
        if (!initialized) {
          setTimeout(safeInitWrapper, CONFIG.INIT_LOAD_DELAY_MS);
        }
      } catch (e) { safeLog('load listener error', e); }
    });
  } catch (e) {}

  // Webflow-совместимая интеграция (если Webflow предоставляет push)
  try {
    if (typeof window.Webflow !== 'undefined' && Array.isArray(window.Webflow.push)) {
      // Не перезаписываем Webflow API, просто пушим инициализацию
      window.Webflow.push(safeInitWrapper);
    }
  } catch (e) {}

})();
