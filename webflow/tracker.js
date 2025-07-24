(function() {
  'use strict';

  // Защита от повторной инициализации
  if (window.webflowAnalyticsInitialized) {
    return;
  }
  window.webflowAnalyticsInitialized = true;

  // Конфигурация
  const CONFIG = {
    STORAGE_KEY: "wf_analytics_data",
    SESSION_KEY: "wf_analytics_session",
    STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 дней
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 минут
    DEBUG_MODE: false,
    MAX_PAGES_TRACKED: 100
  };

  // Безопасное логирование
  function safeLog(message, data = null) {
    if (CONFIG.DEBUG_MODE && typeof console !== 'undefined') {
      try {
        console.log('[Webflow Analytics]', message, data || '');
      } catch (e) {
        // Игнорируем ошибки логирования
      }
    }
  }

  // Проверка поддержки localStorage
  function isStorageSupported() {
    try {
      if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
        return false;
      }
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Утилиты (объявляем первыми для использования в других модулях)
  const Utils = {
    getUrlParams: function() {
      try {
        return new URLSearchParams(window.location.search);
      } catch (error) {
        return new URLSearchParams();
      }
    },

    getCleanUrl: function() {
      try {
        const url = new URL(window.location.href);
        return url.origin + url.pathname;
      } catch (error) {
        return window.location.href;
      }
    },

    getFullCleanUrl: function(allParams) {
      try {
        const url = new URL(window.location.href);
        if (allParams && Array.isArray(allParams)) {
          allParams.forEach(param => url.searchParams.delete(param));
        }
        return url.href;
      } catch (error) {
        return window.location.href;
      }
    },

    getBrowserLanguage: function() {
      try {
        return navigator.language || navigator.userLanguage || navigator.browserLanguage || '';
      } catch (error) {
        return '';
      }
    },

    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // Безопасные операции с localStorage
  const Storage = {
    set: function(key, data, expiry = null) {
      if (!isStorageSupported()) return false;
      
      try {
        const item = {
          data: data,
          timestamp: Date.now(),
          expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY)
        };
        localStorage.setItem(key, JSON.stringify(item));
        return true;
      } catch (error) {
        safeLog("Ошибка сохранения в localStorage:", error);
        
        // Безопасная очистка только наших ключей при переполнении
        try {
          // Удаляем только наши ключи
          [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(ourKey => {
            try {
              localStorage.removeItem(ourKey);
            } catch (e) {}
          });
          
          // Пытаемся сохранить снова
          const item = {
            data: data,
            timestamp: Date.now(),
            expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY)
          };
          localStorage.setItem(key, JSON.stringify(item));
          return true;
        } catch (secondError) {
          return false;
        }
      }
    },

    get: function(key) {
      if (!isStorageSupported()) return null;
      
      try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const parsedItem = JSON.parse(item);
        
        if (!parsedItem || typeof parsedItem !== 'object' || !('data' in parsedItem)) {
          localStorage.removeItem(key);
          return null;
        }
        
        if (parsedItem.expiry && Date.now() > parsedItem.expiry) {
          localStorage.removeItem(key);
          return null;
        }
        
        return parsedItem.data;
      } catch (error) {
        safeLog("Ошибка чтения localStorage:", error);
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        return null;
      }
    },

    remove: function(key) {
      if (!isStorageSupported()) return;
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  // Получение Client ID из cookies
  const ClientIds = {
    google: function() {
      try {
        const match = document.cookie.match(/_ga=GA\d\.\d\.([\d\.]+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    yandex: function() {
      try {
        const match = document.cookie.match(/_ym_uid=(\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    facebook: function() {
      try {
        const match = document.cookie.match(/_fbp=([^;]+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    pinterest: function() {
      try {
        // Сначала URL параметры
        const urlParams = Utils.getUrlParams();
        const urlValue = urlParams.get('epik');
        if (urlValue && urlValue.trim()) {
          return urlValue.trim();
        }
        
        // Затем cookie
        const match = document.cookie.match(/_epik=([^;]+)/);
        return match ? match[1] : null;
      } catch (error) {
        return null;
      }
    }
  };

  // Управление сессией
  const SessionManager = {
    init: function() {
      const currentUrl = Utils.getCleanUrl();
      const currentTime = Date.now();
      
      let sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      // Проверяем валидность существующей сессии
      if (!sessionData || !sessionData.startTime || !Array.isArray(sessionData.pagesViewed)) {
        sessionData = null;
      }
      
      // Проверяем тайм-аут сессии
      if (sessionData && sessionData.lastActivity && 
          (currentTime - sessionData.lastActivity) > CONFIG.SESSION_TIMEOUT) {
        sessionData = null;
      }

      if (!sessionData) {
        // Новая сессия
        sessionData = {
          startTime: currentTime,
          pagesViewed: [currentUrl],
          lastActivity: currentTime
        };
        safeLog("Новая сессия создана");
      } else {
        // Обновляем существующую сессию
        if (!sessionData.pagesViewed.includes(currentUrl)) {
          sessionData.pagesViewed.push(currentUrl);
          
          // Ограничиваем количество отслеживаемых страниц
          if (sessionData.pagesViewed.length > CONFIG.MAX_PAGES_TRACKED) {
            sessionData.pagesViewed = sessionData.pagesViewed.slice(-CONFIG.MAX_PAGES_TRACKED);
          }
        }
        sessionData.lastActivity = currentTime;
        safeLog("Сессия обновлена");
      }

      // Сохраняем сессию
      Storage.set(CONFIG.SESSION_KEY, sessionData, currentTime + CONFIG.SESSION_TIMEOUT);
      return sessionData;
    },

    getMetrics: function() {
      const sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      if (!sessionData || !sessionData.startTime || !Array.isArray(sessionData.pagesViewed)) {
        return {
          pages_viewed: 1,
          session_duration: 0
        };
      }

      const sessionDuration = Math.round((Date.now() - sessionData.startTime) / 1000);
      
      return {
        pages_viewed: sessionData.pagesViewed.length,
        session_duration: Math.max(0, sessionDuration)
      };
    }
  };

  // Управление параметрами отслеживания
  const TrackingManager = {
    utmParams: ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"],
    clickIdParams: [
      "gclid", "fbclid", "ttclid", "yclid", 
      "msclkid", "twclid", "li_fat_id", "awclid", "rdt_cid", "irclickid"
    ],
    facebookParams: ["fbp", "fbc"],
    allParams: [],
    savedData: {},

    init: function() {
      const urlParams = Utils.getUrlParams();
      
      // Формируем список всех параметров
      this.allParams = [...this.utmParams, ...this.clickIdParams, ...this.facebookParams, 'epik'];
      
      // Получаем сохраненные данные
      this.savedData = Storage.get(CONFIG.STORAGE_KEY) || {};
      
      // Собираем новые параметры из URL
      const newParams = {};
      let hasNewParams = false;
      
      // Проверяем стандартные параметры
      [...this.utmParams, ...this.clickIdParams, ...this.facebookParams].forEach(param => {
        const value = urlParams.get(param);
        if (value && value.trim()) {
          newParams[param] = value.trim();
          hasNewParams = true;
        }
      });
      
      // Проверяем Pinterest Click ID (комбинированный подход)
      const pinterestId = ClientIds.pinterest();
      if (pinterestId) {
        newParams.epik = pinterestId;
        hasNewParams = true;
      }
      
      // Обновляем данные при наличии новых параметров
      if (hasNewParams) {
        Object.assign(this.savedData, newParams);
        
        const now = new Date().toISOString();
        const pageUrl = Utils.getFullCleanUrl(this.allParams);
        
        if (!this.savedData.first_visit_timestamp) {
          this.savedData.first_visit_timestamp = now;
          this.savedData.first_visit_page = pageUrl;
        }
        
        this.savedData.last_visit_timestamp = now;
        this.savedData.last_visit_page = pageUrl;
        
        Storage.set(CONFIG.STORAGE_KEY, this.savedData);
        safeLog("Параметры отслеживания обновлены:", newParams);
      }
      
      return this;
    },

    getFinalData: function() {
      const urlParams = Utils.getUrlParams();
      const finalData = Object.assign({}, this.savedData);
      
      // URL параметры имеют приоритет
      [...this.utmParams, ...this.clickIdParams, ...this.facebookParams].forEach(param => {
        const urlValue = urlParams.get(param);
        if (urlValue && urlValue.trim()) {
          finalData[param] = urlValue.trim();
        }
      });
      
      // Pinterest ID (комбинированный подход)
      const pinterestId = ClientIds.pinterest();
      if (pinterestId) {
        finalData.epik = pinterestId;
      }
      
      return finalData;
    }
  };

  // Управление формами
  const FormManager = {
    init: function() {
      this.initExistingForms();
      this.setupFormWatcher();
      this.setupSubmitHandler();
    },

    initExistingForms: function() {
      const self = this;
      
      // Инициализация существующих форм с задержкой для Webflow
      const initForms = function() {
        try {
          const forms = document.querySelectorAll('form');
          forms.forEach(form => self.fillHiddenFields(form));
          safeLog(`Инициализировано ${forms.length} форм`);
        } catch (error) {
          safeLog("Ошибка инициализации форм:", error);
        }
      };

      // Множественная инициализация для совместимости с Webflow
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initForms);
      } else {
        initForms();
      }
      
      // Дополнительная инициализация через таймауты
      setTimeout(initForms, 100);
      setTimeout(initForms, 500);
    },

    setupFormWatcher: function() {
      const self = this;
      
      // Отслеживание новых форм (для динамического контента Webflow)
      if (typeof MutationObserver !== 'undefined') {
        const debouncedCallback = Utils.debounce(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                  if (node.tagName === 'FORM') {
                    self.fillHiddenFields(node);
                  } else if (node.querySelectorAll) {
                    const forms = node.querySelectorAll('form');
                    forms.forEach(function(form) {
                      self.fillHiddenFields(form);
                    });
                  }
                }
              });
            }
          });
        }, 100);

        const observer = new MutationObserver(debouncedCallback);
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    },

    setupSubmitHandler: function() {
      const self = this;
      
      // Обработчик отправки форм
      document.addEventListener('submit', function(event) {
        if (event.target && event.target.tagName === 'FORM') {
          self.fillHiddenFields(event.target);
        }
      }, true);
    },

    fillField: function(form, selector, value) {
      try {
        const input = form.querySelector(selector);
        if (input && (input.type === 'hidden' || input.style.display === 'none')) {
          input.value = String(value || '');
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    },

    fillHiddenFields: function(form) {
      if (!form || typeof form.querySelector !== 'function') {
        return;
      }

      try {
        // Проверяем, что TrackingManager инициализирован
        if (!window.trackingManager || typeof window.trackingManager.getFinalData !== 'function') {
          safeLog("TrackingManager не инициализирован");
          return;
        }

        const trackingData = window.trackingManager.getFinalData();
        const sessionMetrics = SessionManager.getMetrics();
        const pageUrl = Utils.getFullCleanUrl(window.trackingManager.allParams);
        
        // UTM параметры
        window.trackingManager.utmParams.forEach(param => {
          this.fillField(form, `.${param}`, trackingData[param]);
        });
        
        // Click ID параметры
        window.trackingManager.clickIdParams.forEach(param => {
          this.fillField(form, `.${param}`, trackingData[param]);
        });
        
        // Facebook параметры
        window.trackingManager.facebookParams.forEach(param => {
          this.fillField(form, `.${param}`, trackingData[param]);
        });
        
        // Pinterest Click ID
        this.fillField(form, '.epik', trackingData.epik);
        
        // Основные поля
        this.fillField(form, '.page_url', pageUrl);
        this.fillField(form, '.referer', document.referrer);
        this.fillField(form, '.user_agent', navigator.userAgent);
        this.fillField(form, '.timestamp', new Date().toISOString());
        
        // Имя формы
        const formName = form.getAttribute('data-name') || 
                        form.getAttribute('name') || 
                        form.id || 
                        form.className || '';
        this.fillField(form, '.form_name', formName);
        
        // Client ID
        this.fillField(form, '.google_client_id', ClientIds.google());
        this.fillField(form, '.yandex_client_id', ClientIds.yandex());
        this.fillField(form, '.facebook_browser_id', ClientIds.facebook());
        
        // Информация о визитах
        this.fillField(form, '.first_visit_timestamp', trackingData.first_visit_timestamp);
        this.fillField(form, '.last_visit_timestamp', trackingData.last_visit_timestamp);
        this.fillField(form, '.first_visit_page', trackingData.first_visit_page);
        this.fillField(form, '.last_visit_page', trackingData.last_visit_page);
        
        // Метрики сессии
        this.fillField(form, '.pages_viewed', sessionMetrics.pages_viewed);
        this.fillField(form, '.session_duration', sessionMetrics.session_duration);
        
        // Язык браузера
        this.fillField(form, '.browser_language', Utils.getBrowserLanguage());
        
      } catch (error) {
        safeLog("Ошибка заполнения полей формы:", error);
      }
    }
  };

  // Флаг инициализации
  let initialized = false;

  // Основная инициализация
  function init() {
    if (initialized) {
      safeLog("Инициализация уже выполнена, пропускаем");
      return;
    }
    
    initialized = true;
    
    try {
      safeLog("Инициализация Webflow Analytics...");
      
      // Инициализируем сессию
      SessionManager.init();
      
      // Инициализируем отслеживание параметров (сохраняем в глобальную переменную)
      window.trackingManager = TrackingManager.init();
      
      // Инициализируем формы
      FormManager.init();
      
      safeLog("Webflow Analytics успешно инициализирован");
      
    } catch (error) {
      safeLog("Критическая ошибка инициализации:", error);
      // Сбрасываем флаг при ошибке, чтобы можно было попробовать снова
      initialized = false;
    }
  }

  // Публичные функции для отладки
  window.getWebflowAnalyticsData = function() {
    try {
      return {
        tracking_data: window.trackingManager ? window.trackingManager.getFinalData() : {},
        session_metrics: SessionManager.getMetrics(),
        client_ids: {
          google: ClientIds.google(),
          yandex: ClientIds.yandex(),
          facebook: ClientIds.facebook(),
          pinterest: ClientIds.pinterest()
        },
        browser_language: Utils.getBrowserLanguage(),
        page_url: window.trackingManager ? Utils.getFullCleanUrl(window.trackingManager.allParams) : window.location.href,
        storage_supported: isStorageSupported()
      };
    } catch (error) {
      return { error: "Ошибка получения данных" };
    }
  };

  window.initWebflowAnalyticsForForm = function(form) {
    try {
      if (form && typeof form.querySelector === 'function') {
        FormManager.fillHiddenFields(form);
        return true;
      }
      return false;
    } catch (error) {
      safeLog("Ошибка инициализации формы:", error);
      return false;
    }
  };

  // Запуск инициализации
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Webflow-совместимая инициализация
  if (typeof window.Webflow !== 'undefined') {
    window.Webflow.push(init);
  }

})();
