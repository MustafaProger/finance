import type { AppData, Category, Transaction } from "./types";

export const money = (
  value: number,
  currency = "RUB",
  digits = currency === "RUB" ? 0 : 2,
) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value || 0);

export const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace(".0", "")} млн ₽`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`;
  return money(value);
};

export const monthLabel = (key: string, short = false) => {
  const [year, month] = key.split("-").map(Number);
  const value = new Intl.DateTimeFormat(
    "ru-RU",
    short ? { month: "short" } : { month: "long", year: "numeric" },
  ).format(new Date(year, month - 1));
  return value.charAt(0).toUpperCase() + value.slice(1).replace(" г.", "");
};

export const dateLabel = (value: string, withYear = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(`${value}T12:00:00`));

export const amountOf = (item: Transaction) =>
  item.type === "income"
    ? Number(item.toAmount || 0)
    : Number(item.fromAmount || 0);
export const currencyOf = (item: Transaction) =>
  item.type === "income" ? item.toCurrency : item.fromCurrency;
export const titleOf = (item: Transaction) =>
  item.type === "transfer"
    ? `${item.fromAccount} → ${item.toAccount}`
    : item.payee || item.comment || item.categoryName || "Операция";

const transactionTime = (item: Transaction) => {
  const createdAt = Date.parse(item.createdAt || "");
  if (!Number.isNaN(createdAt)) return createdAt;
  const date = Date.parse(`${item.date}T00:00:00`);
  return Number.isNaN(date) ? 0 : date;
};

// В финансовых списках календарная дата важнее момента ввода. Внутри одного
// дня более новая запись остаётся выше.
export const compareTransactionsNewest = (
  left: Transaction,
  right: Transaction,
) =>
  right.date.localeCompare(left.date) ||
  transactionTime(right) - transactionTime(left) ||
  right.id.localeCompare(left.id);

export const categoryOf = (data: AppData, id: string): Category =>
  data.categories.find((item) => item.id === id) ?? {
    id: "none",
    name: "Без категории",
    type: "mixed",
    icon: "circle",
    color: "#64748b",
  };

export const prevMonth = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const monthKeys = (selected: string, count = 6) => {
  const result: string[] = [];
  let cursor = selected;
  for (let index = 0; index < count; index += 1) {
    result.unshift(cursor);
    cursor = prevMonth(cursor);
  }
  return result;
};

export const statsFor = (data: AppData, month: string) =>
  data.transactions
    .filter((item) => item.date.startsWith(month))
    .reduce(
      (result, item) => {
        if (item.type === "income" && item.toCurrency === "RUB")
          result.income += Number(item.toAmount || 0);
        if (item.type === "expense" && item.fromCurrency === "RUB")
          result.expense += Number(item.fromAmount || 0);
        if (item.type === "transfer") result.transfers += 1;
        return result;
      },
      { income: 0, expense: 0, transfers: 0 },
    );

export const categoryStats = (
  data: AppData,
  month: string,
  type: "expense" | "income" = "expense",
) => {
  const values = new Map<string, number>();
  data.transactions
    .filter(
      (item) =>
        item.date.startsWith(month) &&
        item.type === type &&
        currencyOf(item) === "RUB",
    )
    .forEach((item) =>
      values.set(
        item.categoryId,
        (values.get(item.categoryId) || 0) + amountOf(item),
      ),
    );
  return [...values]
    .map(([id, value]) => ({ ...categoryOf(data, id), value }))
    .sort((a, b) => b.value - a.value);
};

export const accountBalance = (data: AppData, accountName: string) => {
  const account = data.accounts.find((item) => item.name === accountName);
  if (!account) return 0;
  if (account.currentBalance !== undefined)
    return Number(account.currentBalance);
  return data.transactions.reduce(
    (balance, item) => {
      let next = balance;
      if (
        item.fromAccount === account.name &&
        item.fromCurrency === account.currency
      )
        next -= Number(item.fromAmount || 0);
      if (
        item.toAccount === account.name &&
        item.toCurrency === account.currency
      )
        next += Number(item.toAmount || 0);
      return next;
    },
    Number(account.openingBalance || 0),
  );
};

export const adjustCurrentBalances = (
  data: AppData,
  transaction: Transaction,
  factor = 1,
) => {
  const change = (name: string, currency: string, value: number) => {
    const account = data.accounts.find(
      (item) => item.name === name && item.currency === currency,
    );
    if (account?.currentBalance !== undefined)
      account.currentBalance += value * factor;
  };
  if (transaction.type === "expense")
    change(
      transaction.fromAccount,
      transaction.fromCurrency,
      -Number(transaction.fromAmount || 0),
    );
  if (transaction.type === "income")
    change(
      transaction.toAccount,
      transaction.toCurrency,
      Number(transaction.toAmount || 0),
    );
  if (transaction.type === "transfer") {
    change(
      transaction.fromAccount,
      transaction.fromCurrency,
      -Number(transaction.fromAmount || 0),
    );
    change(
      transaction.toAccount,
      transaction.toCurrency,
      Number(transaction.toAmount || 0),
    );
  }
};
