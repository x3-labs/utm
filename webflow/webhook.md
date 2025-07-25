# Webflow UTM & Tracking Script Documentation

## 📖 Обзор

Скрипт для автоматического сбора и передачи параметров отслеживания через Webflow формы. Поддерживает UTM-метки, идентификаторы кликов, Google Analytics Client ID и Facebook Pixel данные.

**CDN ссылка:**
```
https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/webhook.min.js
```

## 🚀 Быстрый старт

### 1. Подключение скрипта

Добавьте скрипт в `<head>` или перед закрывающим тегом `</body>` на вашем Webflow сайте:

```html
<script src="https://cdn.jsdelivr.net/gh/x3-labs/utm/webflow/webhook.min.js"></script>
```

### 2. Настройка формы в Webflow

1. **Настройте action формы** - укажите URL вашего webhook
2. **Добавьте атрибут `data-name`** к форме для идентификации:
   ```html
   <form data-name="contact-form" action="https://your-webhook-url.com">
   ```
   
   **Подробно про `data-name`:**
   
   - **Назначение**: Уникальный идентификатор формы для аналитики и отслеживания
   - **Обязательность**: Рекомендуется, но не обязательно (если отсутствует - передается пустая строка)
   - **Формат**: Строка без пробелов, рекомендуется kebab-case
   - **Передача**: Значение автоматически добавляется в webhook как параметр `formName`
   
   **Примеры использования:**
   ```html
   <!-- Форма обратной связи -->
   <form data-name="contact-form" action="...">
   
   <!-- Форма заказа -->
   <form data-name="order-form" action="...">
   
   <!-- Форма подписки на рассылку -->
   <form data-name="newsletter-signup" action="...">
   
   <!-- Форма записи на консультацию -->
   <form data-name="consultation-booking" action="...">
   
   <!-- Форма скачивания материалов -->
   <form data-name="download-lead-magnet" action="...">
   ```
   
   **В webhook придет:**
   ```
   formName=contact-form
   formName=order-form
   formName=newsletter-signup
   // и т.д.
   ```
   
   **Рекомендации по именованию:**
   - ✅ `contact-form` - хорошо
   - ✅ `lead-generation` - хорошо  
   - ✅ `product-demo-request` - хорошо
   - ❌ `Contact Form` - плохо (пробелы)
   - ❌ `form1` - плохо (неинформативно)
   - ❌ `контакт-форма` - плохо (кириллица)
3. **Создайте элементы успеха/ошибки** с классами:
   - `.w-form-done` - сообщение об успешной отправке
   - `.w-form-fail` - сообщение об ошибке

### 3. Готово!

Скрипт автоматически начнет собирать и передавать данные отслеживания с каждой отправкой формы.

## 📊 Собираемые параметры

### UTM-параметры
- `utm_source` - источник трафика
- `utm_medium` - канал привлечения  
- `utm_campaign` - название кампании
- `utm_content` - вариант объявления
- `utm_term` - ключевое слово

### Идентификаторы кликов
- `gclid` - Google Ads Click ID
- `fbclid` - Facebook Click ID
- `ttclid` - TikTok Click ID

### Системные параметры
- `formName` - название формы (из атрибута `data-name`)
- `pageURL` - URL страницы без параметров
- `gaClientId` - Google Analytics Client ID

### Facebook Pixel
- `fbp` - Facebook Browser ID
- `fbc` - Facebook Click ID (из cookie)

## 🔧 Особенности работы

### Автоматический сбор данных
- ✅ **Все параметры передаются всегда** - даже если пустые
- ✅ **URL-кодирование** всех значений для безопасности
- ✅ **Поддержка GA4 и Universal Analytics**
- ✅ **Graceful degradation** - форма работает даже при ошибках

### Безопасность
- ✅ Try-catch блоки для всех операций
- ✅ Валидация обязательных атрибутов
- ✅ Безопасный парсинг cookies
- ✅ Предотвращение двойной отправки

## 📡 Формат данных webhook

### Пример body запроса:
```
name=John+Smith&
email=john%40example.com&
phone=%2B1234567890&
utm_source=google&
utm_medium=cpc&
utm_campaign=spring_sale&
utm_content=&
utm_term=&
gclid=TeSter-123&
fbclid=&
ttclid=&
formName=contact-form&
pageURL=https%3A//yoursite.com/contact&
gaClientId=123.456&
fbp=fb.1.123456789&
fbc=
```

### Структура данных:
```json
{
  "name": "John Smith",
  "email": "john@example.com", 
  "phone": "+1234567890",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "spring_sale",
  "utm_content": "",
  "utm_term": "",
  "gclid": "TeSter-123",
  "fbclid": "",
  "ttclid": "",
  "formName": "contact-form",
  "pageURL": "https://yoursite.com/contact",
  "gaClientId": "123.456",
  "fbp": "fb.1.123456789",
  "fbc": ""
}
```

## ⚙️ Настройки Webflow формы

### Обязательные атрибуты
- `action` - URL webhook для отправки данных
- `method` - метод отправки (GET/POST)

### Дополнительные атрибуты
- `data-name` - уникальное имя формы
- `data-redirect` - URL для редиректа после успешной отправки
- `data-wait` - текст кнопки во время отправки

### Пример настройки:
```html
<form action="https://webhook.site/your-id" 
      method="POST"
      data-name="lead-form"
      data-redirect="/thank-you">
  
  <!-- Поля формы -->
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  
  <!-- Кнопка отправки -->
  <input type="submit" value="Отправить" data-wait="Отправка...">
  
  <!-- Сообщения (скрыты по умолчанию) -->
  <div class="w-form-done">Спасибо! Ваша заявка отправлена.</div>
  <div class="w-form-fail">Ошибка отправки. Попробуйте еще раз.</div>
</form>
```

## 🛠️ Совместимость

### Поддерживаемые браузеры
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

### Зависимости
- ✅ **jQuery** (уже включен в Webflow)
- ✅ **Webflow.js** (стандартно загружается)

### Системы аналитики
- ✅ **Google Analytics 4 (GA4)**
- ✅ **Universal Analytics**
- ✅ **Facebook Pixel**
- ✅ **Google Ads**
- ✅ **TikTok Pixel**

## 🔍 Отладка

### Консоль браузера
Откройте Developer Tools (F12) для просмотра логов:

```javascript
// Успешная отправка
Form submitted successfully: {message: "Workflow was started"}

// Извлеченные параметры  
Tracking parameters extracted: {utm_source: "google", gclid: "123"}

// Ошибки
Error extracting tracking parameters: TypeError...
```

### Проверка webhook
Используйте сервисы для тестирования webhook:
- [webhook.site](https://webhook.site)
- [requestbin.com](https://requestbin.com)
- [ngrok.com](https://ngrok.com)

## ❓ Часто задаваемые вопросы

### Q: Скрипт не собирает UTM-параметры
**A:** Убедитесь что:
- UTM-параметры присутствуют в URL страницы
- Скрипт загружается после jQuery
- Нет JavaScript ошибок в консоли

### Q: Форма не показывает сообщение об успехе
**A:** Проверьте:
- Наличие элементов с классами `.w-form-done` и `.w-form-fail`
- Корректность URL webhook (должен возвращать HTTP 200)
- Настройки CORS на стороне webhook

### Q: Google Analytics Client ID не передается
**A:** Возможные причины:
- GA не установлен на сайте
- Используется GA4 с нестандартными настройками
- Пользователь заблокировал cookies

### Q: Можно ли отключить сбор определенных параметров?
**A:** Да, можно модифицировать скрипт, удалив ненужные строки с параметрами.

## 🔐 Безопасность и приватность

### Обработка данных
- ✅ Все данные передаются через HTTPS
- ✅ URL-кодирование предотвращает инъекции
- ✅ Нет сохранения данных в localStorage/sessionStorage

### Соответствие GDPR
- ⚠️ Скрипт собирает tracking данные
- ⚠️ Требуется согласие пользователя в ЕС
- ⚠️ Рекомендуется уведомление о cookies

### Рекомендации
1. Добавьте Cookie Notice на сайт
2. Получайте согласие перед загрузкой скрипта
3. Предоставьте возможность отказа от отслеживания

## 📞 Поддержка

### Документация
- [Webflow Forms Guide](https://webflow.com/feature/forms)
- [UTM Parameters Guide](https://support.google.com/analytics/answer/1033863)

### Техническая поддержка
- GitHub Issues: [репозиторий проекта]
- Email: [контактная информация]

### Версия скрипта
**Текущая версия:** 1.0.0  
**Последнее обновление:** 2025-07-25  
**CDN:** jsdelivr.net

---

## 📝 Changelog

### v1.0.0 (2025-07-25)
- ✅ Первый релиз
- ✅ Поддержка всех основных tracking параметров
- ✅ Совместимость с GA4 и Universal Analytics
- ✅ Полная интеграция с Webflow
- ✅ Обработка ошибок и graceful degradation
