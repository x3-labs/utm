# Webflow Webhook Analytics Script

## Описание

Webflow Webhook Analytics Script (webhook.js) - это продвинутый JavaScript-скрипт, который **полностью заменяет стандартную отправку форм Webflow** и отправляет данные на ваш собственный вебхук с расширенными аналитическими данными. Скрипт блокирует встроенную обработку Webflow и обеспечивает сквозную аналитику с сохранением данных о всех визитах пользователя и метриках поведения.

## Ключевые отличия от стандартного Webflow

- ⚡ **Блокирует стандартную отправку Webflow** - формы не отправляются через Webflow
- 📤 **Отправляет данные на ваш вебхук** - полный контроль над обработкой данных
- 📊 **31+ параметр аналитики** - максимальный объем данных о пользователе
- 🎯 **Сохраняет UI/UX Webflow** - стандартные сообщения успеха/ошибки работают
- 🔄 **Полная совместимость** - поддержка `data-redirect`, `data-wait`, и других атрибутов

## Основные возможности

- **Расширенные UTM-параметры и Click ID** - поддержка всех основных рекламных платформ (13 Click ID)
- **Полные метрики сессии** - ID сессии, длительность, количество страниц
- **Client ID всех систем** - Google Analytics, Yandex Metrica, Facebook, Pinterest
- **Webflow UI совместимость** - сохранение всех визуальных элементов и анимаций
- **Поддержка старых браузеров** - работает в IE11+ с fallback методами
- **Динамические формы** - автоматическая обработка новых форм через MutationObserver
- **Продвинутая отладка** - WebflowAnalytics API с валидацией и тестированием

## Установка

### Способ 1: Прямое подключение (рекомендуется)

```html
<!-- Webflow Webhook Analytics Script -->
<script src="https://cdn.jsdelivr.net/gh/webflow/tracker@2.1.0/webhook.js"></script>
```

### Способ 2: Встроенный код

Скопируйте весь код скрипта и вставьте в **Project Settings > Custom Code > Before </body> tag**

## Настройка в Webflow

### 1. Настройка формы

В Webflow Designer настройте форму со следующими атрибутами:

```html
<form action="https://your-webhook.com/endpoint" method="POST" data-name="Contact Form">
  <!-- Ваши поля формы -->
  <input type="text" name="name" placeholder="Name" required>
  <input type="email" name="email" placeholder="Email" required>
  <textarea name="message" placeholder="Message"></textarea>
  
  <!-- Кнопка отправки -->
  <input type="submit" value="Send Message" data-wait="Sending...">
</form>

<!-- Стандартные сообщения Webflow (обязательно!) -->
<div class="w-form-done">
  <div>Thank you! Your submission has been received!</div>
</div>
<div class="w-form-fail">
  <div>Oops! Something went wrong while submitting the form.</div>
</div>
```

**Важные атрибуты:**
- `action="https://your-webhook.com/endpoint"` - **ОБЯЗАТЕЛЬНО!** URL вашего вебхука
- `data-name="Contact Form"` - имя формы для аналитики
- `data-wait="Sending..."` - текст кнопки во время отправки
- `data-redirect="/thank-you"` - опциональный редирект после успеха

### 2. Подключение скрипта

**Project Settings > Custom Code > Before </body> tag:**

```html
<script src="https://cdn.jsdelivr.net/gh/webflow/tracker@2.1.0/webhook.js"></script>
```

**Или для разработки (с отладкой):**

```html
<script src="https://cdn.jsdelivr.net/gh/webflow/tracker@2.1.0/webhook.js"></script>
<script>
  // Включить отладку
  WebflowAnalytics.setDebugMode(true);
</script>
```

## Конфигурация

### Основные параметры

```javascript
const CONFIG = {
  STORAGE_KEY: "wf_analytics_data",        // Ключ для основных данных
  SESSION_KEY: "wf_analytics_session",     // Ключ для данных сессии
  STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 дней хранения
  SESSION_TIMEOUT: 30 * 60 * 1000,         // 30 минут тайм-аут сессии
  DEBUG_MODE: false,                       // Режим отладки
  MAX_PAGES_TRACKED: 100,                  // Лимит отслеживаемых страниц
  MAX_URL_LENGTH: 2000,                    // Лимит длины URL
  AJAX_TIMEOUT: 30000,                     // Таймаут AJAX запросов (30 сек)
  VERSION: "2.1.0"                         // Версия скрипта
};
```

## Данные, отправляемые на вебхук

### Структура данных

Вебхук получает **application/x-www-form-urlencoded** данные с полным набором аналитики:

```javascript
// Пример данных POST запроса на ваш вебхук:
{
  // ===== ДАННЫЕ ФОРМЫ =====
  "name": "John Doe",
  "email": "john@example.com", 
  "message": "Hello world",
  
  // ===== UTM ПАРАМЕТРЫ (5) =====
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "utm_content": "headline_a",
  "utm_term": "best_product",
  
  // ===== CLICK ID ПАРАМЕТРЫ (13) =====
  "gclid": "abc123def456",                 // Google Ads Click ID
  "fbclid": "def456ghi789",                // Facebook Click ID  
  "ttclid": "ghi789jkl012",                // TikTok Click ID
  "yclid": "jkl012mno345",                 // Yandex Click ID
  "msclkid": "mno345pqr678",               // Microsoft Ads Click ID
  "twclid": "pqr678stu901",                // Twitter/X Click ID
  "li_fat_id": "stu901vwx234",             // LinkedIn Click ID
  "awclid": "vwx234yzab567",               // Amazon Ads Click ID
  "rdt_cid": "yzab567cdef890",             // Reddit Click ID
  "irclickid": "cdef890ghij123",           // Impact Radius Click ID
  "dclid": "ghij123klmn456",               // Google Display Click ID
  "wbraid": "klmn456opqr789",              // Google Ads Web Conversion ID
  "gbraid": "opqr789stuv012",              // Google Ads App Conversion ID
  
  // ===== FACEBOOK ПАРАМЕТРЫ (2) =====
  "fbp": "fb.1.1234567890.987654321",      // Facebook Browser ID
  "fbc": "fb.1.1234567890.abcdef123",      // Facebook Click ID
  
  // ===== ДРУГИЕ ПАРАМЕТРЫ (4) =====
  "epik": "dj0yJnU9abc123def456",          // Pinterest Click ID
  "pin_id": "789012345678901234",          // Pinterest ID
  "mc_cid": "campaign_123",                // MailChimp Campaign ID
  "mc_eid": "subscriber_456",              // MailChimp Email ID
  
  // ===== CLIENT ID АНАЛИТИЧЕСКИХ СИСТЕМ (4) =====
  "google_client_id": "1234567890.0987654321",        // Google Analytics Client ID
  "gaClientId": "1234567890.0987654321",               // Для совместимости
  "yandex_client_id": "1234567890123456",              // Yandex Metrica Client ID
  "facebook_browser_id": "fb.1.1234567890.987654321", // Facebook Pixel Client ID
  "pinterest_client_id": "dj0yJnU9abc123def456",      // Pinterest Client ID
  
  // ===== МЕТРИКИ СЕССИИ (6) =====
  "session_id": "abc123def456ghi789",      // Уникальный ID сессии
  "pages_viewed": 5,                       // Количество просмотренных страниц
  "session_duration": 347,                 // Длительность сессии в секундах
  "is_new_session": false,                 // Новая ли сессия
  "last_activity": "2024-01-15T10:35:00.000Z", // Время последней активности
  
  // ===== ИНФОРМАЦИЯ О ВИЗИТАХ (6) =====
  "first_visit_timestamp": "2024-01-15T10:00:00.000Z", // Время первого визита
  "last_visit_timestamp": "2024-01-15T10:30:00.000Z",  // Время последнего визита
  "first_visit_page": "https://yoursite.com/",         // Страница первого визита
  "last_visit_page": "https://yoursite.com/contact",   // Страница последнего визита
  "first_visit_referrer": "https://google.com/search", // Реферер первого визита
  "last_visit_referrer": "https://facebook.com",       // Реферер последнего визита
  
  // ===== ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ (8) =====
  "page_url": "https://yoursite.com/contact",          // URL страницы без UTM
  "pageURL": "https://yoursite.com/contact",           // Для совместимости
  "referer": "https://google.com/search",              // Текущий реферер
  "referrer": "https://google.com/search",             // Альтернативное название
  "user_agent": "Mozilla/5.0 (Windows NT 10.0...",    // User Agent браузера
  "timestamp": "2024-01-15T10:30:00.000Z",             // Время отправки формы
  "browser_language": "en",                            // Язык браузера
  "screen_resolution": "1920x1080",                    // Разрешение экрана
  "viewport_size": "1200x800",                         // Размер viewport
  
  // ===== ИНФОРМАЦИЯ О ФОРМЕ (4) =====
  "form_name": "Contact Form",             // Имя формы (data-name)
  "formName": "Contact Form",              // Для совместимости
  "form_url": "https://yoursite.com/contact", // URL страницы с формой
  "form_method": "POST"                    // Метод отправки формы
}
```

### Итого: 31+ аналитический параметр + данные формы

## Настройка вебхука

### Популярные сервисы вебхуков

**Zapier:**
```
https://hooks.zapier.com/hooks/catch/123456/abcdef/
```

**Make (Integromat):**
```
https://hook.eu1.make.com/abc123def456ghi789
```

**Webhook.site (для тестирования):**
```
https://webhook.site/your-unique-url
```

**Собственный сервер:**
```
https://yourapi.com/webhook/webflow-forms
```

### Пример обработки на сервере (Node.js)

```javascript
const express = require('express');
const app = express();

// Middleware для parsing form data
app.use(express.urlencoded({ extended: true }));

app.post('/webhook/webflow-forms', (req, res) => {
  const formData = req.body;
  
  console.log('Получены данные формы:', {
    // Основные данные
    name: formData.name,
    email: formData.email,
    message: formData.message,
    
    // Аналитика
    utm_source: formData.utm_source,
    utm_campaign: formData.utm_campaign,
    gclid: formData.gclid,
    fbclid: formData.fbclid,
    google_client_id: formData.google_client_id,
    session_duration: formData.session_duration,
    pages_viewed: formData.pages_viewed,
    
    // Техническая информация
    form_name: formData.form_name,
    timestamp: formData.timestamp,
    browser_language: formData.browser_language
  });
  
  // Обработка данных (сохранение в БД, отправка в CRM, etc.)
  
  // Возвращаем успех (важно для показа w-form-done)
  res.status(200).json({ success: true, message: 'Form submitted successfully' });
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

## API для отладки и управления

### WebflowAnalytics API

```javascript
// Получить все данные отслеживания
const data = WebflowAnalytics.getData();
console.log(data);

// Получить статус инициализации
const status = WebflowAnalytics.getStatus();
console.log(status);

// Валидировать конфигурацию
const validation = WebflowAnalytics.validate();
console.log(validation);

// Включить/выключить отладку
WebflowAnalytics.setDebugMode(true);
WebflowAnalytics.setDebugMode(false);

// Принудительно обновить данные отслеживания
WebflowAnalytics.refresh();

// Очистить все сохраненные данные
WebflowAnalytics.clear();

// Тестовая отправка данных (без реальной отправки)
const testData = WebflowAnalytics.testSubmit({ test: true });
console.log(testData);
```

### Функции для совместимости

```javascript
// Старые функции (для совместимости)
window.getWebflowFormData();         // → WebflowAnalytics.getData()
window.refreshWebflowTracking();     // → WebflowAnalytics.refresh()
window.clearWebflowAnalytics();      // → WebflowAnalytics.clear()
window.setWebflowDebugMode(true);    // → WebflowAnalytics.setDebugMode(true)
```

## Особенности работы

### Блокирование стандартной отправки Webflow

```javascript
// Скрипт полностью отключает обработку форм Webflow
$(document).off('submit', 'form');

// И добавляет свой обработчик с блокировкой
$(document).on('submit', 'form', function(e) {
  e.preventDefault(); // Блокирует стандартную отправку
  
  // Наша логика с отправкой на вебхук
  $.ajax({
    url: formAction,  // URL из атрибута action формы
    method: 'POST',
    data: formData,   // Данные формы + 31+ аналитический параметр
    // ...
  });
});
```

### Совместимость с Webflow UI

Скрипт **сохраняет все визуальные элементы Webflow**:

- ✅ `.w-form-done` - сообщение об успехе
- ✅ `.w-form-fail` - сообщение об ошибке  
- ✅ `data-wait` - текст кнопки во время отправки
- ✅ `data-redirect` - редирект после успеха
- ✅ Анимации и стили кнопок
- ✅ Валидация полей (HTML5 validation)

### Поддержка динамических форм

```javascript
// Автоматическая обработка новых форм через MutationObserver
const observer = new MutationObserver(function(mutations) {
  // Отслеживает добавление новых форм в DOM
  // Автоматически подключает их к обработчику
});

// Делегирование событий - работает для всех форм
$(document).on('submit', 'form', handler);
```

### Логика сессий

1. **Новая сессия** создается при первом визите или после 30 минут неактивности
2. **Уникальные страницы** отслеживаются по `origin + pathname`
3. **Session ID** генерируется уникальный для каждой сессии
4. **Длительность сессии** считается с момента создания до текущего момента
5. **Лимит страниц** - максимум 100 страниц на сессию

### Извлечение Client ID

- **Google Analytics**: из cookie `_ga` (формат: `GA1.2.xxxxxxxx.xxxxxxxx`)
- **Yandex Metrica**: из cookie `_ym_uid`
- **Facebook Pixel**: из cookie `_fbp`
- **Pinterest**: комбинированный подход (URL параметр `epik` + cookie `_epik`)

### Приоритеты данных

1. **URL параметры** - высший приоритет (текущий визит)
2. **Cookies** - для Client ID и Pinterest
3. **Сохраненные данные** - данные предыдущих визитов из localStorage

## Безопасность и совместимость

### Безопасность

- ✅ Все функции обернуты в try-catch блоки
- ✅ Санитизация входных данных (удаление control chars)
- ✅ Проверка валидности URL перед отправкой
- ✅ Защита от XSS через encodeURIComponent
- ✅ Безопасная очистка только собственных ключей localStorage
- ✅ Версионирование данных для совместимости при обновлениях

### Совместимость с браузерами

- ✅ **Chrome 60+, Firefox 55+, Safari 12+, Edge 79+** - полная поддержка
- ✅ **Internet Explorer 11** - поддержка с fallback методами
- ✅ **Мобильные браузеры** - iOS Safari, Chrome Mobile, Samsung Internet
- ✅ **Fallback методы** для URLSearchParams, URL constructor, localStorage

### Производительность

- ✅ Минимальное влияние на загрузку страницы
- ✅ Оптимизированные DOM операции
- ✅ Кеширование элементов формы
- ✅ Debounced обработка MutationObserver

## Отладка и тестирование

### Включение отладки

```javascript
// Через API
WebflowAnalytics.setDebugMode(true);

// Или в HTML
<script>
  WebflowAnalytics.setDebugMode(true);
</script>
```

### Консольные команды для отладки

```javascript
// 1. Проверить все данные
console.log(WebflowAnalytics.getData());

// 2. Валидировать настройки
console.log(WebflowAnalytics.validate());

// 3. Проверить статус
console.log(WebflowAnalytics.getStatus()); 

// 4. Тестовая отправка (без реальной отправки)
console.log(WebflowAnalytics.testSubmit());

// 5. Проверить localStorage
console.log(localStorage.getItem('wf_analytics_data'));
console.log(localStorage.getItem('wf_analytics_session'));
```

### Тестирование с UTM параметрами

Добавьте к URL вашего сайта:
```
?utm_source=test&utm_medium=email&utm_campaign=test&gclid=test123&fbclid=test456
```

Проверьте данные:
```javascript
const data = WebflowAnalytics.getData();
console.log(data.utm_data); // Должны появиться UTM параметры
console.log(data.click_id_data); // Должны появиться Click ID
```

### Типичные проблемы и решения

**1. Форма отправляется, но данные не приходят на вебхук**
```javascript
// Проверьте action URL
const form = document.querySelector('form');
console.log(form.getAttribute('action')); // Должен быть валидный URL

// Проверьте валидацию
console.log(WebflowAnalytics.validate());
```

**2. Не собираются аналитические данные**
```javascript
// Включите отладку
WebflowAnalytics.setDebugMode(true);

// Проверьте данные
console.log(WebflowAnalytics.getData());
```

**3. Не работают сообщения успеха/ошибки**
- Убедитесь, что элементы `.w-form-done` и `.w-form-fail` существуют рядом с формой
- Проверьте, что вебхук возвращает HTTP статус 200 для успеха

**4. Формы в CMS Collection не работают**
- Используйте делегирование событий (это уже реализовано в скрипте)
- Убедитесь, что у форм есть валидный `action` атрибут

## Мониторинг и аналитика

### Рекомендуемые поля для анализа

**Обязательные для рекламных кампаний:**
- UTM параметры (5 полей) - для атрибуции трафика
- Click ID основных платформ (gclid, fbclid, ttclid, yclid) - для точной атрибуции
- Client ID (google_client_id) - для связи с Google Analytics

**Дополнительные для глубокой аналитики:**
- Метрики сессии (session_duration, pages_viewed) - для оценки качества трафика
- Временные метки визитов - для анализа customer journey
- Техническая информация (browser_language, screen_resolution) - для сегментации

### Интеграция с популярными системами

**Google Sheets через Zapier:**
- Используйте Zapier Webhook trigger
- Настройте Google Sheets action с маппингом всех полей

**CRM системы (HubSpot, Salesforce, Pipedrive):**
- Передавайте все UTM и Click ID для полной атрибуции
- Используйте session_duration и pages_viewed для скоринга лидов

**Google Analytics через Measurement Protocol:**
- Используйте google_client_id для связи событий с пользователями
- Отправляйте custom events с UTM данными

## Changelog

### v2.1.0 (Current - Webhook Version)
- 🔄 **Блокирование стандартной отправки Webflow**
- 📤 **Отправка данных на пользовательский вебхук**
- 📊 **31+ параметр аналитики** (vs 24 в предыдущей версии)
- 🆔 **Расширенные Click ID** - добавлены dclid, wbraid, gbraid
- 🎯 **Полные метрики сессии** - session_id, is_new_session, last_activity
- 🌐 **Поддержка IE11+** с fallback методами
- 🔧 **WebflowAnalytics API** для отладки и управления
- ✅ **Автоматическая валидация** конфигурации
- 🔄 **MutationObserver** для динамических форм
- 📱 **Мобильная совместимость** улучшена

### v1.0.0 (Legacy - Form Fill Version)
- Заполнение скрытых полей в формах Webflow
- Базовое отслеживание UTM и Click ID
- Простая интеграция с Webflow Forms

## Обновление скрипта

### Подключение с версионированием

```html
<!-- Фиксированная версия (рекомендуется для production) -->
<script src="https://cdn.jsdelivr.net/gh/webflow/tracker@2.1.0/webhook.js"></script>

<!-- Последняя версия (автоматические обновления) -->
<script src="https://cdn.jsdelivr.net/gh/webflow/tracker@latest/webhook.js"></script>
```

### Миграция с предыдущих версий

**Если вы использовали скрипт заполнения полей:**

1. **Удалите все скрытые поля** из форм - они больше не нужны
2. **Настройте action URL** на ваш вебхук
3. **Обновите скрипт** на webhook.js версию
4. **Адаптируйте обработку данных** на сервере под новый формат

**Преимущества новой версии:**
- ✅ Больше данных (31+ vs 24 параметра)
- ✅ Полный контроль над данными
- ✅ Лучшая производительность (нет скрытых полей)
- ✅ Расширенная отладка
- ✅ Поддержка старых браузеров

## Поддержка и помощь

### Документация и ресурсы

- 📖 **GitHub Repository**: https://github.com/webflow/tracker
- 🐛 **Issue Tracker**: https://github.com/webflow/tracker/issues
- 📧 **Email Support**: support@webflow-tracker.com
- 💬 **Community Forum**: https://community.webflow-tracker.com

### Создание Issue

При создании issue укажите:
1. Версию скрипта
2. Браузер и его версию
3. Код формы (без конфиденциальных данных)
4. Результат `WebflowAnalytics.validate()`
5. Консольные ошибки (если есть)

### Коммерческая поддержка

Для коммерческих проектов доступна:
- ⚡ Приоритетная поддержка
- 🛠️ Кастомная настройка интеграций
- 📊 Консультации по аналитике
- 🔧 Разработка дополнительных функций

---

**Webflow Webhook Analytics Script v2.1.0** - максимально полное решение для сквозной аналитики в Webflow с полным контролем над данными формы.
