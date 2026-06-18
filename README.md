# Капитал

Современное локальное PWA-приложение для личных финансов на React, TypeScript и Vite. Включает операции, бюджеты, счета, расширенную аналитику, импорт/экспорт JSON и GPT-анализ финансовых данных.

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:4173`. Данные сохраняются локально в IndexedDB и совместимы с предыдущей версией приложения.

## GPT-анализ

Подписка ChatGPT не предоставляет API-ключ автоматически. Скопируйте `.env.example` в `.env`, добавьте отдельный ключ OpenAI API и перезапустите приложение:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

Запросы идут через `server.mjs`, поэтому ключ не попадает в браузер. В GPT передаются счета, категории, бюджеты и все операции только после явного вопроса пользователя.

## Сборка

```bash
npm run build
npm start
```

## Обновление исходных данных

```bash
node scripts/import-transactions.mjs /path/to/transactions.csv data/app-data.json
```
