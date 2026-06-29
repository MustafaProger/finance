# Капитал

PWA-приложение для личных финансов на React, TypeScript, Vite и Firebase.
Операции, счета, категории и бюджеты синхронизируются между устройствами через
Cloud Firestore. Firebase Authentication закрывает данные отдельным аккаунтом,
а локальный кэш Firestore позволяет продолжать работу при временном отсутствии
интернета.

## Первичная настройка Firebase

1. Создайте бесплатный проект в [Firebase Console](https://console.firebase.google.com/).
2. В **Project settings → Your apps** добавьте Web app и скопируйте параметры
   `firebaseConfig`.
3. Скопируйте `.env.example` в `.env` и заполните все переменные
   `VITE_FIREBASE_*`. Это публичные идентификаторы приложения, а не секретный
   серверный ключ.
4. В **Authentication → Sign-in method** включите **Email/Password**, затем в
   **Authentication → Users** создайте свой аккаунт.
5. В **Firestore Database** создайте базу. На первом этапе достаточно бесплатного
   тарифа Spark.
6. Опубликуйте правила из `firestore.rules` через вкладку **Firestore → Rules**
   или через Firebase CLI, как показано ниже.

## Перенос существующих операций

Первый вход выполните именно на компьютере, где уже использовалась старая
локальная версия:

```bash
npm install
npm run dev
```

Откройте `http://localhost:4173` и войдите созданными в Firebase почтой и
паролем. При первом входе приложение автоматически перенесёт существующую базу
из IndexedDB в Firestore. Если IndexedDB пуст, локальный dev-режим возьмёт
исходные данные из `data/app-data.json`.

После появления статуса **«Данные синхронизированы»** можно входить с телефона.
На телефоне будут загружены те же данные, а последующие изменения будут
приходить на оба устройства автоматически.

## Публикация приложения

Firebase Hosting уже настроен в `firebase.json`:

```bash
npx firebase-tools login
npx firebase-tools use --add
npm run deploy
```

Команда `use --add` предложит выбрать созданный проект. После deploy CLI покажет
HTTPS-адрес, который можно открыть на телефоне и установить как PWA.

Личный файл `data/app-data.json` намеренно не попадает в production-сборку.
Доступ к пути `users/{uid}/...` в Firestore Rules разрешён только владельцу с
тем же Firebase UID.

## Локальная сборка

```bash
npm run build
npm start
```

## GPT-анализ

Подписка ChatGPT не предоставляет API-ключ автоматически. Для локального
запуска GPT-анализа добавьте отдельный ключ в `.env` и перезапустите приложение:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

Запросы идут через `server.mjs`, поэтому ключ не попадает в браузер. Статический
Firebase Hosting не запускает этот Node.js endpoint; сейчас раздел GPT в
интерфейсе отключён.

## Обновление исходных данных

```bash
node scripts/import-transactions.mjs /path/to/transactions.csv data/app-data.json
```
