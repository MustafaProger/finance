import type { Account, AppData, Category, Transaction } from "./types";

type Row = Record<string, string>;

const aliases: Record<string, string> = {
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

const categoryMeta: Record<string, [string, string]> = {
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
const currentBalances: Record<string, number> = {
  "Наличные|RUB": 0,
  "Плати по миру|EUR": 2.38,
  "Райфайзенбанк|RUB": -6537.75,
};

const clean = (value: unknown) => String(value || "").trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");

function parseDelimited(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i],
      next = input[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...records] = rows;
  return records.map(
    (values) =>
      Object.fromEntries(
        (headers || []).map((header, i) => [
          header.replace(/^\uFEFF/, ""),
          values[i] || "",
        ]),
      ) as Row,
  );
}

const amount = (value: string) => Number(clean(value).replace(",", ".")) || 0;
const date = (value: string) => {
  const normalized = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  throw new Error(`Не удалось распознать дату «${value}»`);
};
const dateTime = (value: string, fallback: string) => {
  const normalized = clean(value);
  if (!normalized) return `${date(fallback)}T12:00:00`;
  const [day, time = "12:00:00"] = normalized.split(/\s+/, 2);
  return `${date(day)}T${/^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time}`;
};

export function importZenCsv(
  text: string,
  _source = "transactions.csv",
): AppData {
  const rows = parseDelimited(text);
  if (!rows.length || !("date" in rows[0]))
    throw new Error("Файл не похож на экспорт операций Zen");
  const accounts = new Map<string, Account>(),
    categories = new Map<string, Category>(),
    usage = new Map<string, Set<string>>();
  const transactions: Transaction[] = rows.map((row, index) => {
    const outcome = amount(row.outcome),
      income = amount(row.income);
    const fromAccount = clean(row.outcomeAccountName),
      toAccount = clean(row.incomeAccountName);
    const fromCurrency = clean(row.outcomeCurrencyShortTitle) || "RUB",
      toCurrency = clean(row.incomeCurrencyShortTitle) || "RUB";
    const original = clean(row.categoryName),
      categoryName = aliases[original] || original || "Без категории";
    const type =
      outcome > 0 && income > 0
        ? "transfer"
        : income > 0
          ? "income"
          : "expense";
    for (const [name, currency] of [
      [fromAccount, fromCurrency],
      [toAccount, toCurrency],
    ] as const)
      if (name)
        accounts.set(`${name}|${currency}`, {
          id: `account-${accounts.size + 1}`,
          name,
          currency,
          type: name === "Наличные" ? "cash" : "card",
          color: ["#2678FF", "#7C3AED", "#10B981", "#F97316"][
            accounts.size % 4
          ],
          openingBalance: 0,
          currentBalance: currentBalances[`${name}|${currency}`] ?? 0,
        });
    if (type !== "transfer") {
      const kinds = usage.get(categoryName) || new Set<string>();
      kinds.add(type);
      usage.set(categoryName, kinds);
    }
    const categoryId = `category-${slug(categoryName)}`;
    const [icon, color] = categoryMeta[categoryName] || ["circle", "#64748B"];
    categories.set(categoryId, {
      id: categoryId,
      name: categoryName,
      type: "mixed",
      icon,
      color,
    });
    return {
      id: `zen-${String(index + 1).padStart(4, "0")}`,
      date: date(row.date),
      type,
      categoryId,
      categoryName,
      originalCategoryName: original,
      payee: clean(row.payee),
      comment: clean(row.comment),
      fromAccount,
      fromAmount: outcome,
      fromCurrency,
      toAccount,
      toAmount: income,
      toCurrency,
      createdAt: dateTime(row.createdDate, row.date),
      updatedAt: dateTime(row.changedDate, row.date),
      tags:
        original === "Подписки, Образование"
          ? ["Образование"]
          : ["Долг", "Дал в долг", "Вернул долг"].includes(original)
            ? [original]
            : [],
    };
  });
  for (const category of categories.values()) {
    const kinds = usage.get(category.name);
    if (kinds && kinds.size === 1)
      category.type = [...kinds][0] as Category["type"];
  }
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    profile: { name: "Mustafa", currency: "RUB", locale: "ru-RU" },
    accounts: [...accounts.values()],
    categories: [...categories.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    ),
    budgets: [],
    savingsGoals: [],
    transactions,
  };
}
