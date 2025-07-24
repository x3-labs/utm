# Webflow Analytics Script

## Описание

Webflow Analytics Script - это продвинутый JavaScript-скрипт для автоматического отслеживания и сохранения UTM-параметров, Click ID, метрик сессии и других данных аналитики в веб-формах Webflow. Скрипт обеспечивает сквозную аналитику с сохранением данных о всех визитах пользователя и метриках поведения.

## Основные возможности

- **Расширенные UTM-параметры и Click ID** - поддержка всех основных рекламных платформ
- **Метрики сессии** - отслеживание количества просмотренных страниц и длительности сессии  
- **Комбинированный подход** для Pinterest Click ID (URL + cookie)
- **Webflow-оптимизация** - специальная совместимость с динамическим контентом
- **Множественная инициализация** - защита от повторных запусков
- **Автоматическое заполнение форм** - включая динамически добавляемые
- **Безопасная работа** с продвинутой обработкой ошибок

## Установка

```html
<!-- Webflow Analytics Script -->
<script src="https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/tracker.min.js"></script>
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
  MAX_PAGES_TRACKED: 100                   // Лимит отслеживаемых страниц
};
```

### Отслеживаемые параметры

#### UTM-параметры
- `utm_source` - источник трафика
- `utm_medium` - канал трафика  
- `utm_campaign` - название кампании
- `utm_content` - содержание объявления
- `utm_term` - ключевые слова

#### Click ID параметры (расширенный список)
- `gclid` - Google Ads Click ID
- `fbclid` - Facebook Click ID
- `ttclid` - TikTok Click ID
- `yclid` - Yandex Click ID
- `msclkid` - Microsoft Ads (Bing) Click ID
- `twclid` - Twitter/X Click ID
- `li_fat_id` - LinkedIn Click ID
- `awclid` - Amazon Ads Click ID
- `rdt_cid` - Reddit Click ID
- `irclickid` - Impact Radius Click ID
- `epik` - Pinterest Click ID (комбинированный подход: URL + cookie)

#### Facebook параметры
- `fbp` - Facebook Browser ID
- `fbc` - Facebook Click ID

#### Client ID аналитических систем
- `google_client_id` - из куки Google Analytics (_ga)
- `yandex_client_id` - из куки Яндекс.Метрики (_ym_uid)
- `facebook_browser_id` - из куки Facebook Pixel (_fbp)

#### Метрики сессии
- `pages_viewed` - количество уникальных просмотренных страниц
- `session_duration` - длительность сессии в секундах (с начала сессии)

#### Дополнительные данные
- `browser_language` - язык браузера пользователя
- `page_url` - URL страницы без UTM-параметров
- `form_name` - имя/идентификатор формы
- `referer` - реферер (откуда пришел пользователь)
- `user_agent` - информация о браузере
- `timestamp` - время заполнения формы

#### Данные о визитах
- `first_visit_timestamp` - время первого визита
- `last_visit_timestamp` - время последнего визита
- `first_visit_page` - страница первого визита  
- `last_visit_page` - страница последнего визита

## Использование в Webflow

### Подготовка форм в Webflow

Добавьте скрытые поля (Hidden Fields) в ваши формы через Webflow Designer с соответствующими CSS-классами:

```html
<!-- UTM параметры -->
<input type="hidden" class="utm_source" name="utm_source" />
<input type="hidden" class="utm_medium" name="utm_medium" />
<input type="hidden" class="utm_campaign" name="utm_campaign" />
<input type="hidden" class="utm_content" name="utm_content" />
<input type="hidden" class="utm_term" name="utm_term" />

<!-- Click ID параметры -->
<input type="hidden" class="gclid" name="gclid" />
<input type="hidden" class="fbclid" name="fbclid" />
<input type="hidden" class="ttclid" name="ttclid" />
<input type="hidden" class="yclid" name="yclid" />
<input type="hidden" class="msclkid" name="msclkid" />
<input type="hidden" class="twclid" name="twclid" />
<input type="hidden" class="li_fat_id" name="li_fat_id" />
<input type="hidden" class="awclid" name="awclid" />
<input type="hidden" class="rdt_cid" name="rdt_cid" />
<input type="hidden" class="irclickid" name="irclickid" />
<input type="hidden" class="epik" name="epik" />

<!-- Facebook параметры -->
<input type="hidden" class="fbp" name="fbp" />
<input type="hidden" class="fbc" name="fbc" />

<!-- Client ID -->
<input type="hidden" class="google_client_id" name="google_client_id" />
<input type="hidden" class="yandex_client_id" name="yandex_client_id" />
<input type="hidden" class="facebook_browser_id" name="facebook_browser_id" />

<!-- Метрики сессии -->
<input type="hidden" class="pages_viewed" name="pages_viewed" />
<input type="hidden" class="session_duration" name="session_duration" />

<!-- Дополнительные поля -->
<input type="hidden" class="browser_language" name="browser_language" />
<input type="hidden" class="page_url" name="page_url" />
<input type="hidden" class="form_name" name="form_name" />
<input type="hidden" class="referer" name="referer" />
<input type="hidden" class="user_agent" name="user_agent" />
<input type="hidden" class="timestamp" name="timestamp" />

<!-- Информация о визитах -->
<input type="hidden" class="first_visit_timestamp" name="first_visit_timestamp" />
<input type="hidden" class="last_visit_timestamp" name="last_visit_timestamp" />
<input type="hidden" class="first_visit_page" name="first_visit_page" />
<input type="hidden" class="last_visit_page" name="last_visit_page" />
```

### Подключение в Webflow

1. **Откройте Webflow Designer**
2. **Перейдите в Project Settings > Custom Code**
3. **Добавьте код в Head Code или Before </body> tag:**

```html
<!-- Webflow Analytics Script -->
<script src="https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/tracker.min.js"></script>
```

### Работа с динамическими формами

Для форм в CMS или добавляемых через кастомный код:

```javascript
// Инициализация для конкретной формы
const form = document.querySelector('#my-dynamic-form');
window.initWebflowAnalyticsForForm(form);
```

## API

### Глобальные функции

#### `window.getWebflowAnalyticsData()`

Возвращает объект с текущими данными аналитики:

```javascript
const data = window.getWebflowAnalyticsData();
console.log(data);
```

**Возвращаемые данные:**
```javascript
{
  tracking_data: {...},           // Итоговые данные отслеживания
  session_metrics: {              // Метрики сессии
    pages_viewed: 3,
    session_duration: 245
  },
  client_ids: {                   // Client ID от разных сервисов
    google: "...",
    yandex: "...",
    facebook: "...",
    pinterest: "..."
  },
  browser_language: "ru-RU",      // Язык браузера
  page_url: "...",                // Чистый URL страницы
  storage_supported: true         // Поддержка localStorage
}
```

#### `window.initWebflowAnalyticsForForm(form)`

Инициализирует аналитику для конкретной формы:

```javascript
const success = window.initWebflowAnalyticsForForm(formElement);
```

**Параметры:**
- `form` - DOM-элемент формы

**Возвращает:**
- `true` - успешная инициализация
- `false` - ошибка инициализации

## Особенности работы

### Webflow-специфичная оптимизация

- **Множественная инициализация** - совместимость с Webflow CMS и динамическим контентом
- **MutationObserver** - автоматическое отслеживание новых форм
- **Webflow.push()** - интеграция с системой инициализации Webflow
- **Debounced обработка** - оптимизированная производительность

### Логика сессий

1. **Новая сессия** создается при первом визите или после 30 минут неактивности
2. **Уникальные страницы** отслеживаются по `origin + pathname` (без query параметров)
3. **Длительность сессии** считается с момента создания сессии до текущего момента
4. **Лимит страниц** - максимум 100 страниц на сессию для производительности

### Pinterest Click ID (комбинированный подход)

```javascript
// 1. Сначала проверяется URL параметр epik
const urlValue = searchParams.get('epik');

// 2. Если нет в URL, проверяется cookie _epik  
const cookieMatch = document.cookie.match(/_epik=([^;]+)/);
```

### Извлечение Client ID

- **Google Analytics**: из куки `_ga` (формат: `GA1.2.xxxxxxxx.xxxxxxxx`)
- **Yandex Metrica**: из куки `_ym_uid`
- **Facebook**: из куки `_fbp`

### Приоритеты данных

1. **URL параметры** - высший приоритет (текущий визит)
2. **Комбинированные источники** - Pinterest (URL + cookie)
3. **Сохраненные данные** - данные предыдущих визитов

## Безопасность и совместимость

### Безопасность

- Все функции обернуты в try-catch блоки
- Проверка существования объектов перед использованием
- Безопасная очистка только собственных ключей localStorage
- Graceful degradation при недоступности localStorage
- Защита от повторной инициализации на двух уровнях

### Совместимость

- **Webflow** - полная совместимость с CMS и динамическим контентом
- **Браузеры** - Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Зависимости** - работает без внешних библиотек
- **Производительность** - минимальное влияние на загрузку страницы

## Отладка

### Включение режима отладки

Измените в начале скрипта:

```javascript
DEBUG_MODE: true
```

### Консольные команды

```javascript
// Получить все данные аналитики
window.getWebflowAnalyticsData();

// Инициализировать форму вручную
window.initWebflowAnalyticsForForm(document.querySelector('form'));

// Проверить localStorage
localStorage.getItem('wf_analytics_data');
localStorage.getItem('wf_analytics_session');
```

### Типичные проблемы в Webflow

1. **Не заполняются поля**: 
   - Проверьте CSS-классы скрытых полей
   - Убедитесь, что поля имеют тип `hidden`

2. **Формы в CMS не инициализируются**:
   - Добавьте таймаут или используйте `initWebflowAnalyticsForForm()`

3. **Дублирование данных**:
   - Скрипт защищен от повторной инициализации

## Мониторинг и аналитика

### Рекомендуемые поля для CRM/аналитики

**Обязательные для рекламных кампаний:**
- UTM параметры (5 полей)
- Click ID основных платформ (gclid, fbclid, ttclid, yclid)
- Client ID для атрибуции

**Дополнительные для глубокой аналитики:**
- Метрики сессии (pages_viewed, session_duration)
- Временные метки визитов
- Язык браузера для сегментации

### Интеграция с популярными сервисами

**Webflow Forms** → встроенная интеграция с Zapier, Mailchimp, HubSpot
**Google Sheets** → через Zapier или прямую интеграцию
**CRM системы** → передача всех UTM и Click ID данных

## Changelog

### v1.0.0 (Initial Release)
- Webflow-оптимизированный скрипт аналитики
- Поддержка 11 Click ID параметров
- Метрики сессии (pages_viewed, session_duration)
- Pinterest комбинированный подход (URL + cookie)
- Множественная защита от дублирования
- Специальная совместимость с Webflow CMS

---

## Обновление скрипта

### Подключение с версионированием (рекомендуется)

```html
<!-- Фиксированная версия (рекомендуется для production) -->
<script src="https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/tracker.min.js"></script>

<!-- Последняя версия (автоматические обновления) -->
<script src="https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/tracker.min.js"></script>
```

### Процесс обновления

1. **Загрузите обновленный файл** в GitHub репозиторий `webflow/tracker`
2. **Создайте новый релиз (тег)** в GitHub с версией (например, v1.1.0)
3. **Обновите версию в коде** проекта на новую
4. **Очистите кеш jsDelivr** по URL: https://purge.jsdelivr.net/gh/webflow/tracker@1.0.0/tracker.min.js

### Преимущества версионирования

- ✅ **Стабильность** - фиксированная версия не изменится неожиданно
- ✅ **Контроль обновлений** - обновляйтесь только когда готовы
- ✅ **Откат** - легко вернуться к предыдущей версии
- ✅ **Тестирование** - проверяйте новые версии перед внедрением

## Поддержка

Для вопросов и поддержки создавайте Issues в GitHub репозитории или обращайтесь к документации Webflow для настройки Custom Code и форм.
