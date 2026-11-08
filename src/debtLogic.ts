import type { AppData, Debt, Transaction } from "./types";
import { adjustCurrentBalances } from "./format";
export const debtRemaining = (data: AppData, debt: Debt) =>
  Math.round(
    (debt.amount -
      data.transactions
        .filter((t) => t.debtId === debt.id && t.debtAction === "repayment")
        .reduce(
          (n, t) => n + (t.type === "income" ? t.toAmount : t.fromAmount),
          0,
        )) *
      100,
  ) / 100;
export function debtMovement(
  data: AppData,
  debt: Debt,
  accountId: string,
  amount: number,
  action: "opening" | "repayment",
  date: string,
): AppData {
  if (debt.date && date < debt.date)
    throw new Error("Дата возврата не может быть раньше даты долга");
  const next = structuredClone(data);
  const account = next.accounts.find((a) => a.id === accountId);
  if (
    !account ||
    account.currency !== debt.currency ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    throw new Error("Проверьте сумму и валюту счёта");
  if (action === "repayment" && amount > debtRemaining(data, debt))
    throw new Error("Возврат превышает остаток долга");
  const income =
    action === "opening" ? debt.direction === "owe" : debt.direction === "owed";
  const transaction: Transaction = {
    id: `debt-${crypto.randomUUID()}`,
    date,
    createdAt: new Date().toISOString(),
    type: income ? "income" : "expense",
    accountingKind: "debt",
    debtId: debt.id,
    debtAction: action,
    categoryId: "system-debt",
    categoryName: "Долги",
    payee: debt.person,
    comment:
      action === "opening" ? "Выдача / получение долга" : "Возврат долга",
    fromAccount: account.name,
    toAccount: account.name,
    fromCurrency: account.currency,
    toCurrency: account.currency,
    fromAmount: income ? 0 : amount,
    toAmount: income ? amount : 0,
  };
  next.transactions.push(transaction);
  adjustCurrentBalances(next, transaction);
  next.lastAccountId = account.id;
  return next;
}
