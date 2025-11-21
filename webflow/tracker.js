<!-- 
  UTM & MARKETING DATA TRACKER
-->

(function() {
  'use strict';

  // ========== КОНФИГУРАЦИЯ ==========
  const CONFIG = {
    cookieExpireDays: 30,
    cookiePrefix: 'wf_',
    utmParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    clickIds: ['gclid', 'fbclid', 'ttclid', 'fbp', 'fbc']
  };

  // ========== УТИЛИТЫ ДЛЯ РАБОТЫ С COOKIES ==========
  const CookieManager = {
    set: function(name, value, days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = "expires=" + date.toUTCString();
      document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
    },

    get: function(name) {
      const nameEQ = name + "=";
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
          return decodeURIComponent(cookie.substring(nameEQ.length));
        }
      }
      return '';
    }
  };

  // ========== ИЗВЛЕЧЕНИЕ ПАРАМЕТРОВ ИЗ URL ==========
  const URLParser = {
    getParams: function() {
      const params = {};
      const urlParams = new URLSearchParams(window.location.search);
      
      CONFIG.utmParams.forEach(function(param) {
        params[param] = urlParams.get(param) || '';
      });

      CONFIG.clickIds.forEach(function(param) {
        params[param] = urlParams.get(param) || '';
      });

      return params;
    },

    getCleanURL: function() {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      
      CONFIG.utmParams.forEach(function(param) {
        params.delete(param);
      });

      const cleanURL = url.origin + url.pathname + (params.toString() ? '?' + params.toString() : '');
      return cleanURL;
    }
  };

  // ========== РАБОТА С GOOGLE ANALYTICS ==========
  const GAManager = {
    getClientID: function() {
      const gaCookie = CookieManager.get('_ga');
      if (!gaCookie) return '';

      const parts = gaCookie.split('.');
      if (parts.length >= 4) {
        return parts[2] + '.' + parts[3];
      }
      return '';
    }
  };

  // ========== УПРАВЛЕНИЕ МАРКЕТИНГОВЫМИ ДАННЫМИ ==========
  const MarketingData = {
    saveTocookies: function(params) {
      const hasData = Object.values(params).some(function(value) {
        return value !== '';
      });

      if (hasData) {
        Object.keys(params).forEach(function(key) {
          if (params[key] !== '') {
            CookieManager.set(CONFIG.cookiePrefix + key, params[key], CONFIG.cookieExpireDays);
          }
        });
      }
    },

    loadFromCookies: function() {
      const data = {};
      
      CONFIG.utmParams.forEach(function(param) {
        data[param] = CookieManager.get(CONFIG.cookiePrefix + param) || '';
      });

      CONFIG.clickIds.forEach(function(param) {
        data[param] = CookieManager.get(CONFIG.cookiePrefix + param) || '';
      });

      return data;
    },

    collectAllData: function() {
      const data = this.loadFromCookies();
      data.google_client_id = GAManager.getClientID();
      data.page_url = URLParser.getCleanURL();
      return data;
    }
  };

  // ========== РАБОТА С ФОРМАМИ ==========
  const FormManager = {
    fillForm: function(form, data) {
      const formName = form.getAttribute('data-name') || '';
      const allData = Object.assign({}, data, { form_name: formName });

      Object.keys(allData).forEach(function(fieldName) {
        const input = form.querySelector('input[name="' + fieldName + '"]');
        
        if (input) {
          input.value = allData[fieldName];
          
          if (allData[fieldName] !== '') {
            console.log('Заполнено поле:', fieldName, '=', allData[fieldName]);
          }
        }
      });
    },

    processAllForms: function(data) {
      const forms = document.querySelectorAll('form');
      
      if (forms.length === 0) {
        console.warn('UTM Tracker: Формы не найдены на странице');
        return;
      }

      forms.forEach(function(form) {
        FormManager.fillForm(form, data);
      });

      console.log('UTM Tracker: Обработано форм:', forms.length);
    }
  };

  // ========== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ==========
  const UTMTracker = {
    init: function() {
      console.log('UTM Tracker: Инициализация...');

      const urlParams = URLParser.getParams();
      MarketingData.saveTocookies(urlParams);
      const allData = MarketingData.collectAllData();

      setTimeout(function() {
        FormManager.processAllForms(allData);
      }, 100);

      if (window.MutationObserver) {
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
              mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'FORM') {
                  FormManager.fillForm(node, allData);
                } else if (node.querySelectorAll) {
                  const forms = node.querySelectorAll('form');
                  forms.forEach(function(form) {
                    FormManager.fillForm(form, allData);
                  });
                }
              });
            }
          });
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      console.log('UTM Tracker: Инициализация завершена');
    }
  };

  // ========== ЗАПУСК ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      UTMTracker.init();
    });
  } else {
    UTMTracker.init();
  }

})();
