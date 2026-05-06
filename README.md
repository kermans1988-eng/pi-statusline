# pi-statusline

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/kermans1988-eng/pi-statusline?style=flat-square)](https://github.com/kermans1988-eng/pi-statusline/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Расширение (extension) для [Pi Coding Agent](https://pi.dev), которое заменяет стандартный статус-бар на информативный футер с подробной статистикой сессии.

![Statusline Screenshot](https://via.placeholder.com/800x100?text=Statusline+Preview)

> 📸 **Скриншот:** Добавь ссылку на реальное изображение или видео с YouTube, когда будет готово.

---

## Возможности

- **Текущий контекст:** отображает рабочую директорию (cwd), модель и уровень размышления (thinking).
- **Статистика токенов:** показывает входящие (↑) и исходящие (↓) токены за текущий запрос и сессию.
- **Время и стоимость:** время ответа, общая сумма затрат за сессию ($cost).
- **Прогресс контекста:** визуальный бар (`█░`) и процент заполнения окна контекста.
- **Часы:** текущее время в формате `HH:MM`.

---

## Установка

1. Скачай файл расширения или клонируй репозиторий:
   ```bash
   git clone https://github.com/kermans1988-eng/pi-statusline.git
   ```

2. Скопируй `pi-statusline.ts` в папку extensions Pi:
   ```bash
   cp pi-statusline/pi-statusline.ts ~/.pi/agent/extensions/
   ```
   *На Windows:* скопируй в `C:\Users\YourUser\.pi\agent\extensions\`

3. Перезагрузи Pi:
   ```
   /reload
   ```

---

## Команды

В чате Pi доступны следующие команды:

| Команда | Описание |
|---------|----------|
| `/statusline` | Переключить (вкл/выкл) |
| `/statusline on` | Принудительно включить |
| `/statusline off` | Принудительно выключить |
| `/statusline reset` | Сбросить счётчики сессии |

---

## Компоновка (Layout)

Футер состоит из 3 строк:

**Строка 1 (Контекст):**
```
~/project   model: claude-sonnet-4   thinking: high
```

**Строка 2 (Пустая):**
*(отступ)*

**Строка 3 (Метрики):**
```
↑12.4k   ↓3.2k   5 сек   $0.15    ctx ██████░░░░░░ 45%   12:30
```

---

## Требования

- Pi Coding Agent версии 0.70+
- Node.js (для сборки, если требуется ручная установка расширений)

---

## Ссылки

- **GitHub:** [kermans1988-eng/pi-statusline](https://github.com/kermans1988-eng/pi-statusline)
- **Pi Agent:** [pi.dev](https://pi.dev)

## Лицензия

[MIT License](LICENSE) — свободное использование, модификация и распространение.
