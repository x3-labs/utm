var Webflow = Webflow || [];
Webflow.push(function() {  
  'use strict';

  // Проверяем наличие jQuery
  if (typeof $ === 'undefined' || typeof jQuery === 'undefined') {
    console.error('[Webflow Form Handler] jQuery не найдена. Скрипт не может работать.');
    return;
  }

  // Защита от повторной инициализации
  if (window.webflowFormHandlerInitialized) {
    return;
  }
  window.webflowFormHandlerInitialized = true;

  // Конфигурация
  const CONFIG = {
    STORAGE_KEY: "wf_analytics_data",
    SESSION_KEY: "wf_analytics_session",
    STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 дней
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 минут
    DEBUG_MODE: false,
    MAX_PAGES_TRACKED: 100,
    MAX_URL_LENGTH: 2000,
    MAX_STORAGE_SIZE: 100000, // ~100KB
    AJAX_TIMEOUT: 30000, // 30 секунд
    VERSION: "2.1.0"
  };

  // Безопасное логирование
  function safeLog(message, data = null) {
    if (CONFIG.DEBUG_MODE && typeof console !== 'undefined') {
      try {
        console.log('[Webflow Form Handler]', message, data || '');
      } catch (e) {
        // Игнорируем ошибки логирования
      }
    }
  }

  // Проверка поддержки современных API с fallback
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

    // Проверка поддержки современных методов
    isModernBrowser: function() {
      return this.urlSearchParams() && this.urlConstructor() && this.localStorage();
    }
  };

  // Утилиты с fallback для старых браузеров
  const Utils = {
    getUrlParams: function() {
      try {
        if (BrowserSupport.urlSearchParams()) {
          return new URLSearchParams(window.location.search);
        } else {
          // Fallback для старых браузеров
          const params = {};
          const search = window.location.search.substring(1);
          if (search) {
            search.split('&').forEach(pair => {
              const [key, value] = pair.split('=');
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
            },
            has: function(key) {
              return key in params;
            }
          };
        }
      } catch (error) {
        safeLog("Ошибка парсинга URL параметров:", error);
        return { 
          get: function() { return null; },
          has: function() { return false; }
        };
      }
    },

    getCleanUrl: function() {
      try {
        if (BrowserSupport.urlConstructor()) {
          const url = new URL(window.location.href);
          return url.origin + url.pathname;
        } else {
          // Fallback
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
          paramsToRemove.forEach(param => {
            if (param && typeof param === 'string') {
              url.searchParams.delete(param);
            }
          });
          const result = url.href;
          return result.length > CONFIG.MAX_URL_LENGTH ? this.getCleanUrl() : result;
        } else {
          // Fallback: если URL слишком длинный, возвращаем базовый
          const baseUrl = this.getCleanUrl();
          return window.location.href.length > CONFIG.MAX_URL_LENGTH ? baseUrl : window.location.href;
        }
      } catch (error) {
        safeLog("Ошибка в getFullCleanUrl:", error);
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

    sanitizeValue: function(value, maxLength = 1000) {
      try {
        if (value === null || value === undefined) {
          return '';
        }
        const str = String(value).substring(0, maxLength);
        // Базовая защита от потенциально опасных символов
        return str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
      } catch (error) {
        return '';
      }
    },

    createFormDataString: function(params) {
      const pairs = [];
      Object.entries(params).forEach(([key, value]) => {
        if (key && value !== null && value !== undefined && value !== '') {
          try {
            const sanitizedKey = this.sanitizeValue(key, 100);
            const sanitizedValue = this.sanitizeValue(value);
            pairs.push(`${encodeURIComponent(sanitizedKey)}=${encodeURIComponent(sanitizedValue)}`);
          } catch (error) {
            safeLog(`Ошибка обработки параметра ${key}:`, error);
          }
        }
      });
      return pairs.join('&');
    },

    // Безопасное получение атрибутов элемента
    getElementAttribute: function($element, ...attrs) {
      for (const attr of attrs) {
        try {
          const value = $element.attr(attr);
          if (value && value.trim()) {
            return value.trim();
          }
        } catch (e) {
          continue;
        }
      }
      return '';
    },

    // Проверка валидности URL
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

  // Безопасные операции с localStorage
  const Storage = {
    set: function(key, data, expiry = null) {
      if (!BrowserSupport.localStorage()) return false;
      
      try {
        const item = {
          data: data,
          timestamp: Date.now(),
          expiry: expiry || (Date.now() + CONFIG.STORAGE_EXPIRY),
          version: CONFIG.VERSION
        };
        
        const serialized = JSON.stringify(item);
        
        // Проверяем размер данных
        if (serialized.length > CONFIG.MAX_STORAGE_SIZE) {
          safeLog("Данные слишком большие для сохранения", { size: serialized.length });
          return false;
        }
        
        localStorage.setItem(key, serialized);
        return true;
      } catch (error) {
        safeLog("Ошибка сохранения в localStorage:", error);
        
        // Безопасная очистка при переполнении
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          try {
            // Очищаем только наши ключи
            [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(ourKey => {
              try {
                localStorage.removeItem(ourKey);
              } catch (e) {}
            });
            
            // Повторная попытка
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
        
        // Проверяем структуру данных
        if (!parsedItem || typeof parsedItem !== 'object' || !('data' in parsedItem)) {
          localStorage.removeItem(key);
          return null;
        }
        
        // Проверяем версию (для совместимости)
        if (parsedItem.version && parsedItem.version !== CONFIG.VERSION) {
          safeLog("Версия данных устарела, очищаем:", parsedItem.version);
          localStorage.removeItem(key);
          return null;
        }
        
        // Проверяем истечение срока
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
      if (!BrowserSupport.localStorage()) return;
      try {
        localStorage.removeItem(key);
      } catch (e) {
        safeLog("Ошибка удаления из localStorage:", e);
      }
    },

    clear: function() {
      try {
        [CONFIG.STORAGE_KEY, CONFIG.SESSION_KEY].forEach(key => {
          this.remove(key);
        });
      } catch (e) {
        safeLog("Ошибка очистки localStorage:", e);
      }
    }
  };

  // Получение Client ID из cookies с улучшенной обработкой
  const ClientIds = {
    google: function() {
      try {
        // Основной метод: ищем через regex
        const match = document.cookie.match(/_ga=GA\d\.\d\.([\d\.]+)/);
        if (match && match[1]) return match[1];
        
        // Fallback: парсим cookie более аккуратно
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const trimmed = cookie.trim();
          if (trimmed.startsWith('_ga=')) {
            const cookieValue = trimmed.substring(4); // Убираем '_ga='
            if (cookieValue) {
              const parts = cookieValue.split('.');
              if (parts.length >= 4 && parts[0].startsWith('GA')) {
                return parts[2] + '.' + parts[3];
              }
            }
          }
        }
        return null;
      } catch (error) {
        safeLog("Ошибка получения Google Client ID:", error);
        return null;
      }
    },

    yandex: function() {
      try {
        const match = document.cookie.match(/_ym_uid=(\d+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        safeLog("Ошибка получения Yandex Client ID:", error);
        return null;
      }
    },

    facebook: function() {
      try {
        const match = document.cookie.match(/_fbp=([^;]+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        safeLog("Ошибка получения Facebook Client ID:", error);
        return null;
      }
    },

    pinterest: function() {
      try {
        // URL параметры имеют приоритет
        const urlParams = Utils.getUrlParams();
        const urlValue = urlParams.get('epik');
        if (urlValue && urlValue.trim()) {
          return urlValue.trim();
        }
        
        // Затем cookie
        const match = document.cookie.match(/_epik=([^;]+)/);
        return match && match[1] ? match[1] : null;
      } catch (error) {
        safeLog("Ошибка получения Pinterest Client ID:", error);
        return null;
      }
    },

    // Получить все Client ID одним вызовом
    getAll: function() {
      return {
        google: this.google(),
        yandex: this.yandex(),
        facebook: this.facebook(),
        pinterest: this.pinterest()
      };
    }
  };

  // Управление сессией с улучшенным отслеживанием
  const SessionManager = {
    init: function() {
      const currentUrl = Utils.getCleanUrl();
      const currentTime = Date.now();
      
      let sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      // Проверяем валидность существующей сессии
      if (!this.isValidSession(sessionData)) {
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
          id: this.generateSessionId(),
          startTime: currentTime,
          pagesViewed: [currentUrl],
          lastActivity: currentTime,
          isNewSession: true
        };
        safeLog("Новая сессия создана", { id: sessionData.id });
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
        sessionData.isNewSession = false;
        safeLog("Сессия обновлена", { id: sessionData.id, pages: sessionData.pagesViewed.length });
      }

      // Сохраняем сессию
      Storage.set(CONFIG.SESSION_KEY, sessionData, currentTime + CONFIG.SESSION_TIMEOUT);
      return sessionData;
    },

    isValidSession: function(sessionData) {
      return sessionData && 
             sessionData.startTime && 
             Array.isArray(sessionData.pagesViewed) &&
             sessionData.id;
    },

    generateSessionId: function() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    getMetrics: function() {
      const sessionData = Storage.get(CONFIG.SESSION_KEY);
      
      if (!this.isValidSession(sessionData)) {
        return {
          session_id: 'unknown',
          pages_viewed: 1,
          session_duration: 0,
          is_new_session: true
        };
      }

      const sessionDuration = Math.round((Date.now() - sessionData.startTime) / 1000);
      
      return {
        session_id: sessionData.id,
        pages_viewed: sessionData.pagesViewed.length,
        session_duration: Math.max(0, sessionDuration),
        is_new_session: sessionData.isNewSession || false,
        last_activity: new Date(sessionData.lastActivity).toISOString()
      };
    }
  };

  // Управление параметрами отслеживания с расширенным набором
  const TrackingManager = {
    utmParams: ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"],
    clickIdParams: [
      "gclid", "fbclid", "ttclid", "yclid", 
      "msclkid", "twclid", "li_fat_id", "awclid", 
      "rdt_cid", "irclickid", "dclid", "wbraid", "gbraid"
    ],
    facebookParams: ["fbp", "fbc"],
    otherParams: ["epik", "pin_id", "mc_cid", "mc_eid"], // Pinterest, MailChimp
    allParams: [],
    savedData: {},

    init: function() {
      // Формируем полный список параметров
      this.allParams = [
        ...this.utmParams, 
        ...this.clickIdParams, 
        ...this.facebookParams, 
        ...this.otherParams
      ];
      
      // Получаем сохраненные данные
      this.savedData = Storage.get(CONFIG.STORAGE_KEY) || {};
      
      // Обрабатываем текущие URL параметры
      this.processCurrentPageParams();
      
      return this;
    },

    processCurrentPageParams: function() {
      const urlParams = Utils.getUrlParams();
      const newParams = {};
      let hasNewParams = false;
      
      // Проверяем все параметры отслеживания
      this.allParams.forEach(param => {
        const value = urlParams.get(param);
        if (value && value.trim()) {
          newParams[param] = Utils.sanitizeValue(value.trim());
          hasNewParams = true;
        }
      });
      
      // Добавляем Pinterest Click ID из cookies если нет в URL
      if (!newParams.epik) {
        const pinterestId = ClientIds.pinterest();
        if (pinterestId) {
          newParams.epik = Utils.sanitizeValue(pinterestId);
          hasNewParams = true;
        }
      }
      
      // Обновляем данные при наличии новых параметров
      if (hasNewParams) {
        // Объединяем с существующими данными
        Object.assign(this.savedData, newParams);
        
        const now = new Date().toISOString();
        const pageUrl = Utils.getFullCleanUrl(this.allParams);
        
        // Сохраняем информацию о первом визите
        if (!this.savedData.first_visit_timestamp) {
          this.savedData.first_visit_timestamp = now;
          this.savedData.first_visit_page = pageUrl;
          this.savedData.first_visit_referrer = document.referrer || '';
        }
        
        // Обновляем информацию о последнем визите
        this.savedData.last_visit_timestamp = now;
        this.savedData.last_visit_page = pageUrl;
        this.savedData.last_visit_referrer = document.referrer || '';
        
        // Сохраняем в localStorage
        Storage.set(CONFIG.STORAGE_KEY, this.savedData);
        safeLog("Параметры отслеживания обновлены:", Object.keys(newParams));
      }
    },

    getFinalData: function() {
      const urlParams = Utils.getUrlParams();
      const finalData = Object.assign({}, this.savedData);
      
      // URL параметры имеют приоритет над сохраненными
      this.allParams.forEach(param => {
        const urlValue = urlParams.get(param);
        if (urlValue && urlValue.trim()) {
          finalData[param] = Utils.sanitizeValue(urlValue.trim());
        }
      });
      
      // Pinterest ID (комбинированный подход)
      const pinterestId = ClientIds.pinterest();
      if (pinterestId) {
        finalData.epik = Utils.sanitizeValue(pinterestId);
      }
      
      return finalData;
    },

    // Получить только UTM параметры
    getUtmData: function() {
      const finalData = this.getFinalData();
      const utmData = {};
      this.utmParams.forEach(param => {
        if (finalData[param]) {
          utmData[param] = finalData[param];
        }
      });
      return utmData;
    },

    // Получить только Click ID параметры
    getClickIdData: function() {
      const finalData = this.getFinalData();
      const clickIdData = {};
      this.clickIdParams.forEach(param => {
        if (finalData[param]) {
          clickIdData[param] = finalData[param];
        }
      });
      return clickIdData;
    }
  };

  // Инициализируем все компоненты с обработкой ошибок
  let trackingManager;
  let isInitialized = false;
  
  try {
    SessionManager.init();
    trackingManager = TrackingManager.init();
    isInitialized = true;
    safeLog("Компоненты аналитики инициализированы успешно", {
      version: CONFIG.VERSION,
      browserSupport: {
        isModern: BrowserSupport.isModernBrowser(),
        localStorage: BrowserSupport.localStorage(),
        urlSearchParams: BrowserSupport.urlSearchParams(),
        urlConstructor: BrowserSupport.urlConstructor()
      }
    });
  } catch (error) {
    safeLog("Критическая ошибка инициализации компонентов:", error);
    // Не прерываем выполнение, позволяем базовой отправке форм работать
  }

  // Отключаем стандартную обработку форм Webflow
  try {
    $(document).off('submit', 'form');
    safeLog("Стандартная обработка форм Webflow отключена");
  } catch (error) {
    safeLog("Ошибка отключения обработки форм Webflow:", error);
  }
  
  // Обработчик отправки форм с полной поддержкой Webflow
  $(document).on('submit', 'form', function(e) {
    e.preventDefault();
    
    const $form = $(this);
    const $submit = $form.find('[type="submit"]').first();
    
    // Получаем атрибуты формы
    const buttonText = $submit.val() || $submit.text() || 'Submit';
    const buttonWaitingText = $submit.attr('data-wait') || 'Please wait...';
    const formMethod = ($form.attr('method') || 'POST').toUpperCase();
    const formAction = $form.attr('action');
    const formRedirect = $form.attr('data-redirect');
    const formName = Utils.getElementAttribute($form, 'data-name', 'name', 'id');
    
    // Проверяем обязательные параметры
    if (!formAction || !Utils.isValidUrl(formAction)) {
      safeLog("Ошибка: некорректный или отсутствующий action у формы", { action: formAction });
      $form.siblings('.w-form-done').hide().siblings('.w-form-fail').show();
      return false;
    }
    
    // Устанавливаем состояние загрузки
    $submit.prop('disabled', true);
    if ($submit.is('input[type="submit"]') || $submit.is('input[type="button"]')) {
      $submit.val(buttonWaitingText);
    } else {
      $submit.text(buttonWaitingText);
    }
    
    // Собираем базовые данные формы
    let formData = $form.serialize();
    
    // Добавляем аналитические данные если инициализированы
    if (isInitialized && trackingManager) {
      try {
        // Получаем все данные отслеживания
        const trackingData = trackingManager.getFinalData();
        const sessionMetrics = SessionManager.getMetrics();
        const clientIds = ClientIds.getAll();
        const pageUrl = Utils.getFullCleanUrl(trackingManager.allParams);
        
        // Формируем дополнительные параметры
        const additionalParams = {};
        
        // UTM параметры
        trackingManager.utmParams.forEach(param => {
          additionalParams[param] = trackingData[param] || '';
        });
        
        // Click ID параметры
        trackingManager.clickIdParams.forEach(param => {
          additionalParams[param] = trackingData[param] || '';
        });
        
        // Facebook параметры
        trackingManager.facebookParams.forEach(param => {
          additionalParams[param] = trackingData[param] || '';
        });
        
        // Другие параметры отслеживания
        trackingManager.otherParams.forEach(param => {
          additionalParams[param] = trackingData[param] || '';
        });
        
        // Client ID данные с обратной совместимостью
        Object.assign(additionalParams, {
          google_client_id: clientIds.google || '',
          gaClientId: clientIds.google || '', // Для совместимости
          yandex_client_id: clientIds.yandex || '',
          facebook_browser_id: clientIds.facebook || '',
          pinterest_client_id: clientIds.pinterest || ''
        });
        
        // Основные поля
        Object.assign(additionalParams, {
          page_url: pageUrl,
          pageURL: pageUrl, // Для совместимости
          referer: document.referrer || '',
          referrer: document.referrer || '', // Альтернативное название
          user_agent: Utils.sanitizeValue(navigator.userAgent || ''),
          timestamp: new Date().toISOString(),
          browser_language: Utils.getBrowserLanguage(),
          screen_resolution: screen.width + 'x' + screen.height,
          viewport_size: window.innerWidth + 'x' + window.innerHeight
        });
        
        // Информация о форме
        Object.assign(additionalParams, {
          form_name: formName,
          formName: formName, // Для совместимости
          form_url: window.location.href,
          form_method: formMethod
        });
        
        // Данные о визитах
        Object.assign(additionalParams, {
          first_visit_timestamp: trackingData.first_visit_timestamp || '',
          last_visit_timestamp: trackingData.last_visit_timestamp || '',
          first_visit_page: trackingData.first_visit_page || '',
          last_visit_page: trackingData.last_visit_page || '',
          first_visit_referrer: trackingData.first_visit_referrer || '',
          last_visit_referrer: trackingData.last_visit_referrer || ''
        });
        
        // Метрики сессии
        Object.assign(additionalParams, {
          session_id: sessionMetrics.session_id,
          pages_viewed: sessionMetrics.pages_viewed,
          session_duration: sessionMetrics.session_duration,
          is_new_session: sessionMetrics.is_new_session,
          last_activity: sessionMetrics.last_activity
        });
        
        // Преобразуем в строку и добавляем к данным формы
        const additionalFormData = Utils.createFormDataString(additionalParams);
        if (additionalFormData) {
          formData += (formData ? '&' : '') + additionalFormData;
        }
        
        safeLog("Отправка формы с расширенными данными", {
          formName: formName,
          trackingParams: Object.keys(trackingData).length,
          sessionMetrics: sessionMetrics,
          clientIds: Object.entries(clientIds).filter(([k,v]) => v).length
        });
        
      } catch (error) {
        safeLog("Ошибка при сборе аналитических данных:", error);
        // Продолжаем отправку формы даже при ошибке сбора данных
      }
    } else {
      safeLog("Аналитические компоненты не инициализированы, отправляем базовую форму");
    }
    
    // Отправляем форму через jQuery AJAX
    $.ajax({
      url: formAction,
      method: formMethod,
      data: formData,
      timeout: CONFIG.AJAX_TIMEOUT,
      cache: false,
      processData: false,
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    })
    .done(function(response, textStatus, jqXHR) {
      safeLog("Форма успешно отправлена", { 
        status: jqXHR.status, 
        formName: formName,
        redirect: formRedirect 
      });
      
      // Обработка редиректа
      if (formRedirect && Utils.isValidUrl(formRedirect)) {
        try {
          window.location.href = formRedirect;
          return;
        } catch (error) {
          safeLog("Ошибка редиректа:", error);
        }
      }
      
      // Показываем стандартное сообщение успеха Webflow
      $form.hide()
           .siblings('.w-form-done').show()
           .siblings('.w-form-fail').hide();
      
      // Сбрасываем форму после успешной отправки
      try {
        $form[0].reset();
      } catch (error) {
        safeLog("Ошибка сброса формы:", error);
      }
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      safeLog("Ошибка отправки формы:", { 
        status: jqXHR.status, 
        statusText: textStatus, 
        error: errorThrown,
        formName: formName
      });
      
      // Показываем стандартное сообщение об ошибке Webflow
      $form.siblings('.w-form-done').hide()
           .siblings('.w-form-fail').show();
    })
    .always(function() {
      // Восстанавливаем исходное состояние кнопки
      $submit.prop('disabled', false);
      
      if ($submit.is('input[type="submit"]') || $submit.is('input[type="button"]')) {
        $submit.val(buttonText);
      } else {
        $submit.text(buttonText);
      }
    });
  });

  // Публичные функции для отладки и управления
  window.WebflowAnalytics = {
    // Получить все данные отслеживания
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
          utm_data: trackingManager.getUtmData(),
          click_id_data: trackingManager.getClickIdData(),
          browser_info: {
            language: Utils.getBrowserLanguage(),
            user_agent: navigator.userAgent,
            screen_resolution: screen.width + 'x' + screen.height,
            viewport_size: window.innerWidth + 'x' + window.innerHeight
          },
          page_info: {
            url: Utils.getFullCleanUrl(trackingManager.allParams),
            clean_url: Utils.getCleanUrl(),
            referrer: document.referrer || '',
            title: document.title || ''
          },
          browser_support: {
            is_modern: BrowserSupport.isModernBrowser(),
            localStorage: BrowserSupport.localStorage(),
            urlSearchParams: BrowserSupport.urlSearchParams(),
            urlConstructor: BrowserSupport.urlConstructor()
          },
          config: {
            debug_mode: CONFIG.DEBUG_MODE,
            storage_expiry_days: CONFIG.STORAGE_EXPIRY / (24 * 60 * 60 * 1000),
            session_timeout_minutes: CONFIG.SESSION_TIMEOUT / (60 * 1000),
            max_url_length: CONFIG.MAX_URL_LENGTH,
            ajax_timeout: CONFIG.AJAX_TIMEOUT
          }
        };
      } catch (error) {
        return { 
          error: "Ошибка получения данных: " + error.message,
          stack: error.stack
        };
      }
    },

    // Принудительно обновить данные отслеживания
    refresh: function() {
      try {
        if (isInitialized && trackingManager) {
          SessionManager.init();
          trackingManager.processCurrentPageParams();
          safeLog("Данные отслеживания обновлены вручную");
          return { success: true, message: "Данные успешно обновлены" };
        }
        return { success: false, message: "Компоненты не инициализированы" };
      } catch (error) {
        return { success: false, message: "Ошибка обновления: " + error.message };
      }
    },

    // Очистить все сохраненные данные
    clear: function() {
      try {
        Storage.clear();
        safeLog("Все данные аналитики очищены");
        return { success: true, message: "Данные очищены" };
      } catch (error) {
        return { success: false, message: "Ошибка очистки: " + error.message };
      }
    },

    // Управление режимом отладки
    setDebugMode: function(enabled) {
      const prevMode = CONFIG.DEBUG_MODE;
      CONFIG.DEBUG_MODE = Boolean(enabled);
      safeLog(`Режим отладки ${enabled ? 'включен' : 'выключен'}`);
      return { 
        success: true, 
        previous: prevMode, 
        current: CONFIG.DEBUG_MODE 
      };
    },

    // Получить статус инициализации
    getStatus: function() {
      return {
        version: CONFIG.VERSION,
        initialized: isInitialized,
        tracking_manager_ready: !!trackingManager,
        jquery_available: typeof $ !== 'undefined',
        webflow_available: typeof Webflow !== 'undefined',
        browser_support: BrowserSupport.isModernBrowser(),
        forms_count: $('form').length,
        config: CONFIG
      };
    },

    // Тестовая отправка данных (для отладки)
    testSubmit: function(testData = {}) {
      if (!isInitialized || !trackingManager) {
        return { success: false, message: "Компоненты не инициализированы" };
      }
      
      try {
        const trackingData = trackingManager.getFinalData();
        const sessionMetrics = SessionManager.getMetrics();
        const clientIds = ClientIds.getAll();
        
        const testPayload = {
          ...testData,
          ...trackingData,
          ...sessionMetrics,
          client_ids: clientIds,
          test_mode: true,
          timestamp: new Date().toISOString()
        };
        
        safeLog("Тестовые данные для отправки:", testPayload);
        return { 
          success: true, 
          data: testPayload,
          data_string: Utils.createFormDataString(testPayload)
        };
      } catch (error) {
        return { success: false, message: "Ошибка подготовки тестовых данных: " + error.message };
      }
    },

    // Валидация текущей конфигурации
    validate: function() {
      const issues = [];
      const warnings = [];
      
      // Проверяем критические зависимости
      if (typeof $ === 'undefined') {
        issues.push("jQuery не найдена");
      }
      
      if (!BrowserSupport.localStorage()) {
        warnings.push("localStorage не поддерживается");
      }
      
      if (!BrowserSupport.isModernBrowser()) {
        warnings.push("Браузер не поддерживает современные API, используются fallback методы");
      }
      
      // Проверяем формы на странице
      const $forms = $('form');
      if ($forms.length === 0) {
        warnings.push("На странице не найдено форм");
      } else {
        $forms.each(function(index) {
          const $form = $(this);
          const action = $form.attr('action');
          if (!action) {
            issues.push(`Форма ${index + 1} не имеет атрибута action`);
          } else if (!Utils.isValidUrl(action)) {
            issues.push(`Форма ${index + 1} имеет некорректный action: ${action}`);
          }
        });
      }
      
      // Проверяем размер сохраненных данных
      if (BrowserSupport.localStorage()) {
        try {
          const storageData = localStorage.getItem(CONFIG.STORAGE_KEY);
          if (storageData && storageData.length > CONFIG.MAX_STORAGE_SIZE * 0.8) {
            warnings.push("Размер сохраненных данных приближается к лимиту");
          }
        } catch (e) {
          warnings.push("Ошибка проверки размера данных в localStorage");
        }
      }
      
      return {
        valid: issues.length === 0,
        issues: issues,
        warnings: warnings,
        forms_count: $forms.length,
        browser_support: BrowserSupport.isModernBrowser(),
        initialization_status: isInitialized
      };
    }
  };

  // Алиас для обратной совместимости
  window.getWebflowFormData = function() {
    return window.WebflowAnalytics.getData();
  };

  // Дополнительные алиасы
  window.refreshWebflowTracking = function() {
    return window.WebflowAnalytics.refresh();
  };

  window.clearWebflowAnalytics = function() {
    return window.WebflowAnalytics.clear();
  };

  window.setWebflowDebugMode = function(enabled) {
    return window.WebflowAnalytics.setDebugMode(enabled);
  };

  // Автоматическая валидация при инициализации в debug режиме
  if (CONFIG.DEBUG_MODE) {
    setTimeout(function() {
      const validation = window.WebflowAnalytics.validate();
      if (!validation.valid) {
        safeLog("Найдены критические проблемы:", validation.issues);
      }
      if (validation.warnings.length > 0) {
        safeLog("Предупреждения:", validation.warnings);
      }
    }, 1000);
  }

  // Отслеживание изменений в DOM для динамических форм
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function(mutations) {
      let formsAdded = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'FORM' || 
                  (node.querySelectorAll && node.querySelectorAll('form').length > 0)) {
                formsAdded = true;
              }
            }
          });
        }
      });
      
      if (formsAdded) {
        safeLog("Обнаружены новые формы в DOM");
        // Формы автоматически обрабатываются через делегирование событий
      }
    });

    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      safeLog("MutationObserver для отслеживания динамических форм активирован");
    } catch (error) {
      safeLog("Ошибка активации MutationObserver:", error);
    }
  }

  // Финальное логирование инициализации
  safeLog("Webflow Form Handler с расширенной аналитикой инициализирован", {
    version: CONFIG.VERSION,
    status: isInitialized ? 'success' : 'partial',
    features: [
      "Полная совместимость с Webflow",
      "Расширенное отслеживание параметров (31+ параметр)",
      "Поддержка старых браузеров с fallback",
      "Отслеживание метрик сессий",
      "Client ID для всех основных аналитических систем",
      "Обработка динамических форм",
      "Продвинутые инструменты отладки",
      "Автоматическая валидация конфигурации",
      "Защита от переполнения localStorage",
      "Graceful degradation при ошибках"
    ],
    forms_found: $('form').length,
    browser_support: BrowserSupport.isModernBrowser()
  });

  // Экспорт для использования в других скриптах
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.WebflowAnalytics;
  }
});
