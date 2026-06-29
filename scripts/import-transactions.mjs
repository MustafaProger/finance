import fs from "node:fs/promises";
import path from "node:path";

const source = process.argv[2];
const destination = process.argv[3] || "data/app-data.json";

if (!source) {
  throw new Error(
    "Usage: node scripts/import-transactions.mjs <source.csv> [destination.json]",
  );
}

const text = await fs.readFile(source, "utf8");

function parseDelimited(input, delimiter = ";") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header.replace(/^\uFEFF/, ""),
        values[index] || "",
      ]),
    ),
  );
}

const CATEGORY_ALIASES = {
  "": "Без категории",
  другое: "Другое",
  Кэшбек: "Кэшбэк",
  "Еда вне дома": "Кафе и рестораны",
  Колледж: "Образование",
  "Ненужная покупка": "Импульсивные покупки",
  Долг: "Долги",
  "Дал в долг": "Долги",
  "Вернул долг": "Долги",
  "Подписки, Образование": "Подписки",
};

const CATEGORY_META = {
  Подписки: ["repeat", "#8B5CF6"],
  Продукты: ["basket", "#FFB020"],
  "Кафе и рестораны": ["coffee", "#FF7A1A"],
  Транспорт: ["car", "#3B82F6"],
  "Без категории": ["circle", "#718096"],
  Работа: ["briefcase", "#22C55E"],
  Подарки: ["gift", "#EC4899"],
  "Импульсивные покупки": ["sparkles", "#F97316"],
  "Забота о себе": ["heart", "#F472B6"],
  Кэшбэк: ["coins", "#10B981"],
  Здоровье: ["health", "#EF4444"],
  Благотворительность: ["hand-heart", "#A78BFA"],
  Зарплата: ["trend-up", "#16C784"],
  Образование: ["book", "#6366F1"],
  Другое: ["more", "#64748B"],
  Покупки: ["bag", "#06B6D4"],
  Долги: ["handshake", "#EAB308"],
  "Деньги от родителей": ["family", "#14B8A6"],
};

const clean = (value) => String(value || "").trim();
const slug = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");

const MONTH_NUMBERS = {
  янв: 1,
  февр: 2,
  мар: 3,
  апр: 4,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сент: 9,
  окт: 10,
  нояб: 11,
  дек: 12,
};

function parseAmount(value) {
  const normalized = clean(value).replace(",", ".");
  if (!normalized) return 0;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric;

  // Некоторые небольшие десятичные суммы после табличного экспорта выглядят
  // как даты: «февр.85» вместо 2.85. Восстанавливаем исходное число.
  const dateLike = normalized.toLowerCase().match(/^([а-яё]+)\.(\d+)$/i);
  const month = dateLike ? MONTH_NUMBERS[dateLike[1]] : undefined;
  if (month !== undefined) return Number(`${month}.${dateLike[2]}`);
  throw new Error(`Не удалось распознать сумму «${value}»`);
}

function normalizeDate(value) {
  const normalized = clean(value);
  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  throw new Error(`Не удалось распознать дату «${value}»`);
}

function normalizeDateTime(value, fallbackDate) {
  const normalized = clean(value);
  if (!normalized) return `${normalizeDate(fallbackDate)}T12:00:00`;
  const [date, time = "12:00:00"] = normalized.split(/\s+/, 2);
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return `${normalizeDate(date)}T${normalizedTime}`;
}

const CURRENT_BALANCES = {
  "Наличные|RUB": 0,
  "Плати по миру|EUR": 2.38,
  "Райфайзенбанк|RUB": -6537.75,
};

const sourceRows = parseDelimited(text);
const accountNames = new Set();
const categoryUsage = new Map();

const transactions = sourceRows.map((row, index) => {
  const outcome = parseAmount(row.outcome);
  const income = parseAmount(row.income);
  const outcomeAccount = clean(row.outcomeAccountName);
  const incomeAccount = clean(row.incomeAccountName);
  const originalCategory = clean(row.categoryName);
  const categoryName =
    CATEGORY_ALIASES[originalCategory] || originalCategory || "Без категории";
  const transfer = outcome > 0 && income > 0;
  const type = transfer ? "transfer" : income > 0 ? "income" : "expense";

  if (outcomeAccount)
    accountNames.add(
      `${outcomeAccount}|${row.outcomeCurrencyShortTitle || "RUB"}`,
    );
  if (incomeAccount)
    accountNames.add(
      `${incomeAccount}|${row.incomeCurrencyShortTitle || "RUB"}`,
    );

  if (!transfer) {
    const kinds = categoryUsage.get(categoryName) || new Set();
    kinds.add(type);
    categoryUsage.set(categoryName, kinds);
  }

  const tags = [];
  if (originalCategory === "Подписки, Образование") tags.push("Образование");
  if (["Долг", "Дал в долг", "Вернул долг"].includes(originalCategory))
    tags.push(originalCategory);

  return {
    id: `zen-${String(index + 1).padStart(4, "0")}`,
    date: normalizeDate(row.date),
    type,
    categoryId: `category-${slug(categoryName)}`,
    categoryName,
    originalCategoryName: originalCategory,
    payee: clean(row.payee),
    comment: clean(row.comment),
    fromAccount: outcomeAccount,
    fromAmount: outcome,
    fromCurrency: row.outcomeCurrencyShortTitle || "RUB",
    toAccount: incomeAccount,
    toAmount: income,
    toCurrency: row.incomeCurrencyShortTitle || "RUB",
    createdAt: normalizeDateTime(row.createdDate, row.date),
    updatedAt: normalizeDateTime(row.changedDate, row.date),
    tags,
  };
});

const categories = [
  ...new Set(
    transactions
      .filter((item) => item.type !== "transfer")
      .map((item) => item.categoryName),
  ),
]
  .sort((a, b) => a.localeCompare(b, "ru"))
  .map((name) => {
    const kinds = [...(categoryUsage.get(name) || ["expense"])];
    const [icon, color] = CATEGORY_META[name] || ["circle", "#64748B"];
    return {
      id: `category-${slug(name)}`,
      name,
      type: kinds.length > 1 ? "mixed" : kinds[0],
      icon,
      color,
    };
  });

const accounts = [...accountNames]
  .sort((a, b) => a.localeCompare(b, "ru"))
  .map((key, index) => {
    const [name, currency] = key.split("|");
    return {
      id: `account-${index + 1}`,
      name,
      currency,
      type: name === "Наличные" ? "cash" : "card",
      color: ["#2678FF", "#7C3AED", "#10B981", "#F97316"][index % 4],
      openingBalance: 0,
      currentBalance: CURRENT_BALANCES[key],
    };
  });

const result = {
  version: 2,
  generatedAt: new Date().toISOString(),
  source: path.basename(source),
  profile: {
    name: "Mustafa",
    currency: "RUB",
    locale: "ru-RU",
  },
  accounts,
  categories,
  budgets: [
    { id: "budget-products", categoryId: "category-продукты", limit: 15000 },
    { id: "budget-cafe", categoryId: "category-кафе-и-рестораны", limit: 8000 },
    { id: "budget-transport", categoryId: "category-транспорт", limit: 5000 },
    {
      id: "budget-subscriptions",
      categoryId: "category-подписки",
      limit: 6000,
    },
  ],
  transactions,
};

await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `Imported ${transactions.length} transactions, ${categories.length} categories and ${accounts.length} accounts to ${destination}`,
);
