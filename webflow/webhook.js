var Webflow = Webflow || [];
Webflow.push(function() {  
  'use strict';

  if (window.webflowFormHandlerInitialized) {
    return;
  }
  window.webflowFormHandlerInitialized = true;

  const CONFIG = {
    STORAGE_KEY: "wf_analytics_data",
    SESSION_KEY: "wf_analytics_session",
    STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000,
    DEBUG_MODE: false,
    MAX_PAGES_TRACKED: 100,
    MAX_URL_LENGTH: 2000,
    MAX_STORAGE_SIZE: 100000,
    AJAX_TIMEOUT: 30000,
    VERSION: "1.0.0"
  };

  const BrowserSupport = {
    localStorage: function() {
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
    },

    urlSearchParams: function() {
      return typeof URLSearchParams !== 'undefined';
    },

    urlConstructor: function() {
      return typeof URL !== 'undefined';
    },

    fetch: function() {
      return typeof fetch !== 'undefined';
    }
  };

  const DOM = {
    ready: function(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
      } else {
        callback();
      }
    },

    on: function(element, event, selector, handler) {
      if (typeof selector === 'function') {
        handler = selector;
        element.addEventListener(event, handler);
      } else {
        element.addEventListener(event, function(e) {
          if (e.target.matches(selector) || e.target.closest(selector)) {
            handler.call(e.target.closest(selector) || e.target, e);
          }
        });
      }
    },

    find: function(element, selector) {
      return element.querySelector(selector);
    },

    findAll: function(element, selector) {
      return Array.from(element.querySelectorAll(selector));
    },

    attr: function(element, name, value) {
      if (value === undefined) {
        return element.getAttribute(name);
      }
      element.setAttribute(name, value);
    },

    prop: function(element, name, value) {
      if (value === undefined) {
        return element[name];
      }
      element[name] = value;
    },

    text: function(element, value) {
      if (value === undefined) {
        return element.textContent || element.innerText;
      }
      element.textContent = value;
    },

    val: function(element, value) {
      if (value === undefined) {
        return element.value;
      }
      element.value = value;
    },

    show: function(element) {
      element.style.display = '';
    },

    hide: function(element) {
      element.style.display = 'none';
    },

    siblings: function(element, selector) {
      const siblings = Array.from(element.parentNode.children).filter(child => child !== element);
      return selector ? siblings.filter(sibling => sibling.matches(selector)) : siblings;
    },

    serialize: function(form) {
      const formData = new FormData(form);
      const pairs = [];
      for (const [key, value] of formData.entries()) {
        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      }
      return pairs.join('&');
    }
  };

  const Ajax = {
    request: function(options) {
      return new Promise(function(resolve, reject) {
        if (BrowserSupport.fetch()) {
          // Используем fetch если доступен
          const fetchOptions = {
            method: options.method || 'POST',
            body: options.data,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
          };

          if (options.timeout) {
            const controller = new AbortController();
            fetchOptions.signal = controller.signal;
            setTimeout(function() {
              controller.abort();
            }, options.timeout);
          }

          fetch(options.url, fetchOptions)
            .then(function(response) {
              if (response.ok) {
                resolve({ status: response.status, response: response });
              } else {
                reject({ status: response.status, statusText: response.statusText });
              }
            })
            .catch(reject);
        } else {
          // Fallback на XMLHttpRequest для старых браузеров
          const xhr = new XMLHttpRequest();
          
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ status: xhr.status, response: xhr });
              } else {
                reject({ status: xhr.status, statusText: xhr.statusText });
              }
            }
          };

          xhr.onerror = function() {
            reject({ status: 0, statusText: 'Network Error' });
          };

          if (options.timeout) {
            xhr.timeout = options.timeout;
            xhr.ontimeout = function() {
              reject({ status: 0, statusText: 'Timeout' });
            };
          }

          xhr.open(options.method || 'POST', options.url);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
          xhr.send(options.data);
        }
      });
    }
  };

  const Utils = {
    getUrlParams: function() {
      try {
        if (BrowserSupport.urlSearchParams()) {
          return new URLSearchParams(window.location.search);
        } else {
          const params = {};
          const search = window.location.search.substring(1);
          if (search) {
            search.split('&').forEach(function(pair) {
              const parts = pair.split('=');
              const key = parts[0];
              const value = parts[1];
              if (key) {
                try {
                  params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                } catch (e) {
                  params[key] = value || '';
                }
              }
            });
          }
          return {
            get: function(key) {
              return params[key] || null;
            }
          };
        }
      } catch (error) {
        return { 
          get: function() { return null; }
        };
      }
    },

    getCleanUrl: function() {
      try {
        if (BrowserSupport.urlConstructor()) {
          const url = new URL(window.location.href);
          return url.origin + url.pathname;
        } else {
          return window.location.protocol + '//' + 
                 window.location.host + 
                 window.location.pathname;
        }
      } catch (error) {
        return window.location.href.split('?')[0].split('#')[0];
      }
    },

    getFullCleanUrl: function(paramsToRemove) {
      try {
        if (!paramsToRemove || !Array.isArray(paramsToRemove) || paramsToRemove.length === 0) {
          return window.location.href;
        }

        if (BrowserSupport.urlConstructor()) {
          const url = new URL(window.location.href);
          paramsToRemove.forEach(function(param) {
            if (param && typeof param === 'string') {
              url.searchParams.delete(param);
            }
          });
          const result = url.href;
          return result.length > CONFIG.MAX_URL_LENGTH ? this.getCleanUrl() : result;
        } else {
          const baseUrl = this.getCleanUrl();
          return window.location.href.length > CONFIG.MAX_URL_LENGTH ? baseUrl : window.location.href;
        }
      } catch (error) {
        return this.getCleanUrl();
      }
    },

    getBrowserLanguage: function() {
      try {
        const lang = navigator.language || navigator.userLanguage || navigator.browserLanguage || '';
        return lang.split('-')[0] || '';
      } catch (error) {
        return '';
      }
    },

    sanitizeValue: function(value, maxLength) {
      maxLength = maxLength || 1000;
      try {
        if (value === null || value === undefined) {
          return '';
        }
        const str = String(value).substring(0, maxLength);
        return str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
      } catch (error) {
        return '';
      }
    },

    createFormDataString: function(params) {
      const pairs = [];
      Object.keys(params).forEach(function(key) {
        const value = params[key];
        if (key && value !== null && value !== undefined && value !== '') {
          try {
            const sanitizedKey = Utils.sanitizeValue(key, 100);
            const sanitizedValue = Utils.sanitizeValue(value);
            pairs.push(encodeURIComponent(sanitizedKey) + '=' + encodeURIComponent(sanitizedValue));
          } catch (error) {
            // Игнорируем ошибки обработки
          }
        }
      });
      return pairs.join('&');
    },

    getElementAttribute: function(element) {
      const attrs = Array.prototype.slice.call(arguments, 1);
      for (let i = 0; i < attrs.length; i++) {
        try {
          const value = DOM.attr(element, attrs[i]);
          if (value && value.trim()) {
            return value.trim();
          }
        } catch (e) {
          continue;
        }
      }
      return '';
    },

    isValidUrl: function(url) {
      if (!url || typeof url !== 'string') return false;
      try {
        new URL(url, window.location.origin);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  const Storage = {
    set: function(key, data, expiry) {
      if (!BrowserSupport.localStorage()) return false;
      
      try {
        const item = {
          data: data,
          timestamp: Date.now(),
          expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY),
          version: CONFIG.VERSION
        };
        
        const serialized = JSON.stringify(item);
        
        if (serialized.length > CONFIG.MAX_STORAGE_SIZE) {
          return false;
        }
        
        localStorage.setItem(key, serialized);
        return true;
      } catch (error) {
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          try {
            [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(function(ourKey) {
              try {
                localStorage.removeItem(ourKey);
              } catch (e) {}
            });
            
            const item = {
              data: data,
              timestamp: Date.now(),
              expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY),
              version: CONFIG.VERSION
            };
            localStorage.setItem(key, JSON.stringify(item));
            return true;
          } catch (secondError) {
            return false;
          }
        }
        return false;
      }
    },

    get: function(key) {
      if (!BrowserSupport.localStorage()) return null;
      
      try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const parsedItem = JSON.parse(item);
        
        if (!parsedItem || typeof parsedItem !== 'object' || !('data' in parsedItem)) {
          localStorage.removeItem(key);
          return null;
        }
        
        if (parsedItem.version && parsedItem.version !== CONFIG.VERSION) {
          localStorage.removeItem(key);
          return null;
        }
        
        if (parsedItem.expiry && Date.now() > parsedItem.expiry) {
          localStorage.removeItem(key);
          return null;
        }
        
        return parsedItem.data;
      } catch (error) {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        return null;
      }
    },

    remove: function(key) {
      if (!BrowserSupport.localStorage()) return;
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },

    clear: function() {
      try {
        [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(function(key) {
          Storage.remove(key);
        });
      } catch (e) {}
    }
  };

  const ClientIds = {
    google: function() {
      try {
        const match = document.cookie.match(/_ga=GA\d\.\d\.([\d\.]+)/);
        if (match && match[1]) return match[1];
        
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const trimmed = cookies[i].trim();
          if (trimmed.indexOf('_ga=') === 0) {
            const cookieValue = trimmed.substring(4);
            if (cookieValue) {
              const parts = cookieValue.split('.');
              if (parts.length >= 4 && parts[0].indexOf('GA') === 0) {
                return parts[2] + '.' + parts[3];
              }
            }
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    },

    yandex: function() {
      try {
        const match = document.cookie.match(/_ym_uid=(\d+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    facebook: function() {
      try {
        const match = document.cookie.match(/_fbp=([^;]+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    pinterest: function() {
      try {
        const urlParams = Utils.getUrlParams();
        const urlValue = urlParams.get('epik');
        if (urlValue && urlValue.trim()) {
          return urlValue.trim();
        }
        
        const match = document.cookie.match(/_epik=([^;]+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        return null;
      }
    },

    getAll: function() {
      return {
        google: this.google(),
        yandex: this.yandex(),
        facebook: this.facebook(),
        pinterest: this.pinterest()
      };
    }
  };

  const SessionManager = {
    init: function() {
      const currentUrl = Utils.getCleanUrl();
      const currentTime = Date.now();
      
      let sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      if (!this.isValidSession(sessionData)) {
        sessionData = null;
      }
      
      if (sessionData && sessionData.lastActivity && 
          (currentTime - sessionData.lastActivity) > CONFIG.SESSION_TIMEOUT) {
        sessionData = null;
      }

      if (!sessionData) {
        sessionData = {
          startTime: currentTime,
          pagesViewed: [currentUrl],
          lastActivity: currentTime,
          isNewSession: true
        };
      } else {
        if (sessionData.pagesViewed.indexOf(currentUrl) === -1) {
          sessionData.pagesViewed.push(currentUrl);
          
          if (sessionData.pagesViewed.length > CONFIG.MAX_PAGES_TRACKED) {
            sessionData.pagesViewed = sessionData.pagesViewed.slice(-CONFIG.MAX_PAGES_TRACKED);
          }
        }
        sessionData.lastActivity = currentTime;
        sessionData.isNewSession = false;
      }

      Storage.set(CONFIG.SESSION_KEY, sessionData, currentTime + CONFIG.SESSION_TIMEOUT);
      return sessionData;
    },

    isValidSession: function(sessionData) {
      return sessionData && 
             sessionData.startTime && 
             Array.isArray(sessionData.pagesViewed);
    },

    getMetrics: function() {
      const sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      if (!this.isValidSession(sessionData)) {
        return {
          pages_viewed: 1,
          session_duration: 0,
          is_new_session: true
        };
      }

      const sessionDuration = Math.round((Date.now() - sessionData.startTime) / 1000);
      
      return {
        pages_viewed: sessionData.pagesViewed.length,
        session_duration: Math.max(0, sessionDuration),
        is_new_session: sessionData.isNewSession || false
      };
    }
  };

  const TrackingManager = {
    utmParams: ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"],
    clickIdParams: [
      "gclid", "fbclid", "ttclid", "yclid", 
      "msclkid", "twclid", "li_fat_id", "awclid", 
      "rdt_cid", "irclickid", "dclid", "wbraid", "gbraid"
    ],
    facebookParams: ["fbp", "fbc"],
    otherParams: ["epik", "pin_id"],
    allParams: [],
    savedData: {},

    init: function() {
      this.allParams = []
        .concat(this.utmParams)
        .concat(this.clickIdParams)
        .concat(this.facebookParams)
        .concat(this.otherParams);
      
      this.savedData = Storage.get(CONFIG.STORAGE_KEY) || {};
      this.processCurrentPageParams();
      return this;
    },

    processCurrentPageParams: function() {
      const urlParams = Utils.getUrlParams();
      const newParams = {};
      let hasNewParams = false;
      
      for (let i = 0; i < this.allParams.length; i++) {
        const param = this.allParams[i];
        const value = urlParams.get(param);
        if (value && value.trim()) {
          newParams[param] = Utils.sanitizeValue(value.trim());
          hasNewParams = true;
        }
      }
      
      if (!newParams.epik) {
        const pinterestId = ClientIds.pinterest();
        if (pinterestId) {
          newParams.epik = Utils.sanitizeValue(pinterestId);
          hasNewParams = true;
        }
      }
      
      if (hasNewParams) {
        Object.keys(newParams).forEach(function(key) {
          TrackingManager.savedData[key] = newParams[key];
        });
        
        const now = new Date().toISOString();
        const pageUrl = Utils.getFullCleanUrl(this.allParams);
        
        if (!this.savedData.first_visit_timestamp) {
          this.savedData.first_visit_timestamp = now;
          this.savedData.first_visit_page = pageUrl;
        }
        
        this.savedData.last_visit_timestamp = now;
        this.savedData.last_visit_page = pageUrl;
        
        Storage.set(CONFIG.STORAGE_KEY, this.savedData);
      }
    },

    getFinalData: function() {
      const urlParams = Utils.getUrlParams();
      const finalData = {};
      
      // Копируем сохраненные данные
      Object.keys(this.savedData).forEach(function(key) {
        finalData[key] = TrackingManager.savedData[key];
      });
      
      // URL параметры имеют приоритет
      for (let i = 0; i < this.allParams.length; i++) {
        const param = this.allParams[i];
        const urlValue = urlParams.get(param);
        if (urlValue && urlValue.trim()) {
          finalData[param] = Utils.sanitizeValue(urlValue.trim());
        }
      }
      
      const pinterestId = ClientIds.pinterest();
      if (pinterestId) {
        finalData.epik = Utils.sanitizeValue(pinterestId);
      }
      
      return finalData;
    }
  };

  let trackingManager;
  let isInitialized = false;
  
  try {
    SessionManager.init();
    trackingManager = TrackingManager.init();
    isInitialized = true;
  } catch (error) {
    // Продолжаем работу даже при ошибке инициализации
  }

  DOM.ready(function() {
    DOM.on(document, 'submit', 'form', function(e) {
      e.preventDefault();
      
      const form = this;
      const submitButton = DOM.find(form, '[type="submit"]');
      
      if (!submitButton) return false;
      
      const buttonText = DOM.val(submitButton) || DOM.text(submitButton) || 'Submit';
      const buttonWaitingText = DOM.attr(submitButton, 'data-wait') || 'Please wait...';
      const formMethod = (DOM.attr(form, 'method') || 'POST').toUpperCase();
      const formAction = DOM.attr(form, 'action');
      const formRedirect = DOM.attr(form, 'data-redirect');
      const formName = Utils.getElementAttribute(form, 'data-name', 'name', 'id');
      
      if (!formAction || !Utils.isValidUrl(formAction)) {
        DOM.hide(DOM.find(form.parentNode, '.w-form-done'));
        DOM.show(DOM.find(form.parentNode, '.w-form-fail'));
        return false;
      }
      
      DOM.prop(submitButton, 'disabled', true);
      if (submitButton.tagName === 'INPUT') {
        DOM.val(submitButton, buttonWaitingText);
      } else {
        DOM.text(submitButton, buttonWaitingText);
      }
      
      let formData = DOM.serialize(form);
      
      if (isInitialized && trackingManager) {
        try {
          const trackingData = trackingManager.getFinalData();
          const sessionMetrics = SessionManager.getMetrics();
          const clientIds = ClientIds.getAll();
          const pageUrl = Utils.getFullCleanUrl(trackingManager.allParams);
          
          const additionalParams = {};
          
          // UTM параметры
          trackingManager.utmParams.forEach(function(param) {
            additionalParams[param] = trackingData[param] || '';
          });
          
          // Click ID параметры
          trackingManager.clickIdParams.forEach(function(param) {
            additionalParams[param] = trackingData[param] || '';
          });
          
          // Facebook параметры
          trackingManager.facebookParams.forEach(function(param) {
            additionalParams[param] = trackingData[param] || '';
          });
          
          // Другие параметры отслеживания
          trackingManager.otherParams.forEach(function(param) {
            additionalParams[param] = trackingData[param] || '';
          });
          
          // Client ID данные
          additionalParams.google_client_id = clientIds.google || '';
          additionalParams.yandex_client_id = clientIds.yandex || '';
          additionalParams.facebook_browser_id = clientIds.facebook || '';
          
          // Основные поля
          additionalParams.page_url = pageUrl;
          additionalParams.referer = document.referrer || '';
          additionalParams.timestamp = new Date().toISOString();
          additionalParams.browser_language = Utils.getBrowserLanguage();
          
          // Информация о форме
          additionalParams.form_name = formName;
          
          // Данные о визитах
          additionalParams.first_visit_timestamp = trackingData.first_visit_timestamp || '';
          additionalParams.last_visit_timestamp = trackingData.last_visit_timestamp || '';
          additionalParams.first_visit_page = trackingData.first_visit_page || '';
          additionalParams.last_visit_page = trackingData.last_visit_page || '';
          
          // Метрики сессии
          additionalParams.pages_viewed = sessionMetrics.pages_viewed;
          additionalParams.session_duration = sessionMetrics.session_duration;
          additionalParams.is_new_session = sessionMetrics.is_new_session;
          
          const additionalFormData = Utils.createFormDataString(additionalParams);
          if (additionalFormData) {
            formData += (formData ? '&' : '') + additionalFormData;
          }
          
        } catch (error) {
          // Продолжаем отправку формы даже при ошибке сбора данных
        }
      }
      
      Ajax.request({
        url: formAction,
        method: formMethod,
        data: formData,
        timeout: CONFIG.AJAX_TIMEOUT
      })
      .then(function(result) {
        if (formRedirect && Utils.isValidUrl(formRedirect)) {
          try {
            window.location.href = formRedirect;
            return;
          } catch (error) {
            // Игнорируем ошибку редиректа
          }
        }
        
        DOM.hide(form);
        const doneElement = DOM.find(form.parentNode, '.w-form-done');
        const failElement = DOM.find(form.parentNode, '.w-form-fail');
        if (doneElement) DOM.show(doneElement);
        if (failElement) DOM.hide(failElement);
        
        try {
          form.reset();
        } catch (error) {
          // Игнорируем ошибку сброса
        }
      })
      .catch(function(error) {
        const doneElement = DOM.find(form.parentNode, '.w-form-done');
        const failElement = DOM.find(form.parentNode, '.w-form-fail');
        if (doneElement) DOM.hide(doneElement);
        if (failElement) DOM.show(failElement);
      })
      .then(function() {
        // always
        DOM.prop(submitButton, 'disabled', false);
        
        if (submitButton.tagName === 'INPUT') {
          DOM.val(submitButton, buttonText);
        } else {
          DOM.text(submitButton, buttonText);
        }
      });
    });
  });

  // Публичные функции для отладки
  window.WebflowAnalytics = {
    getData: function() {
      try {
        if (!isInitialized || !trackingManager) {
          return { 
            error: "Компоненты не инициализированы",
            initialized: isInitialized,
            trackingManager: !!trackingManager
          };
        }
        
        const trackingData = trackingManager.getFinalData();
        const sessionMetrics = SessionManager.getMetrics();
        const clientIds = ClientIds.getAll();
        
        return {
          version: CONFIG.VERSION,
          initialized: isInitialized,
          tracking_data: trackingData,
          session_metrics: sessionMetrics,
          client_ids: clientIds,
          browser_info: {
            language: Utils.getBrowserLanguage()
          },
          page_info: {
            url: Utils.getFullCleanUrl(trackingManager.allParams),
            clean_url: Utils.getCleanUrl(),
            referer: document.referrer || '',
            title: document.title || ''
          },
          browser_support: {
            localStorage: BrowserSupport.localStorage(),
            urlSearchParams: BrowserSupport.urlSearchParams(),
            urlConstructor: BrowserSupport.urlConstructor(),
            fetch: BrowserSupport.fetch()
          }
        };
      } catch (error) {
        return { 
          error: "Ошибка получения данных: " + error.message
        };
      }
    },

    refresh: function() {
      try {
        if (isInitialized && trackingManager) {
          SessionManager.init();
          trackingManager.processCurrentPageParams();
          return { success: true, message: "Данные успешно обновлены" };
        }
        return { success: false, message: "Компоненты не инициализированы" };
      } catch (error) {
        return { success: false, message: "Ошибка обновления: " + error.message };
      }
    },

    clear: function() {
      try {
        Storage.clear();
        return { success: true, message: "Данные очищены" };
      } catch (error) {
        return { success: false, message: "Ошибка очистки: " + error.message };
      }
    },

    setDebugMode: function(enabled) {
      const prevMode = CONFIG.DEBUG_MODE;
      CONFIG.DEBUG_MODE = Boolean(enabled);
      return { 
        success: true, 
        previous: prevMode, 
        current: CONFIG.DEBUG_MODE 
      };
    },

    getStatus: function() {
      return {
        version: CONFIG.VERSION,
        initialized: isInitialized,
        tracking_manager_ready: !!trackingManager,
        jquery_available: false,
        webflow_available: typeof Webflow !== 'undefined',
        browser_support: {
          localStorage: BrowserSupport.localStorage(),
          urlSearchParams: BrowserSupport.urlSearchParams(),
          urlConstructor: BrowserSupport.urlConstructor(),
          fetch: BrowserSupport.fetch()
        },
        forms_count: document.querySelectorAll('form').length,
        config: CONFIG
      };
    }
  };

  // Алиасы для обратной совместимости
  window.getWebflowFormData = function() {
    return window.WebflowAnalytics.getData();
  };

  window.refreshWebflowTracking = function() {
    return window.WebflowAnalytics.refresh();
  };

  window.clearWebflowAnalytics = function() {
    return window.WebflowAnalytics.clear();
  };

  window.setWebflowDebugMode = function(enabled) {
    return window.WebflowAnalytics.setDebugMode(enabled);
  };

  // Отслеживание изменений в DOM для динамических форм
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function(mutations) {
      let formsAdded = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              if (node.tagName === 'FORM' || 
                  (node.querySelectorAll && node.querySelectorAll('form').length > 0)) {
                formsAdded = true;
              }
            }
          });
        }
      });
      
      if (formsAdded) {
        // Новые формы автоматически обрабатываются через делегирование событий
      }
    });

    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      // Игнорируем ошибку MutationObserver
    }
  }
});
