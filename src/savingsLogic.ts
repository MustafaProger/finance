import { adjustCurrentBalances, SAVINGS_CATEGORY_ID } from "./format";
import type { AppData, Transaction } from "./types";

export type SavingsAdjustmentMode = "deposit" | "withdraw";

type SavingsAdjustmentLink = {
  goalId: string;
  mode: SavingsAdjustmentMode;
};

function savingsAdjustmentLink(
  data: AppData,
  transaction: Transaction,
): SavingsAdjustmentLink | null {
  if (
    transaction.savingsGoalId &&
    transaction.savingsAdjustment &&
    data.savingsGoals.some((goal) => goal.id === transaction.savingsGoalId)
  ) {
    return {
      goalId: transaction.savingsGoalId,
      mode: transaction.savingsAdjustment,
    };
  }

  const isLegacySavingsOperation =
    transaction.id.startsWith("saving-operation-") ||
    transaction.categoryId === SAVINGS_CATEGORY_ID;
  if (!isLegacySavingsOperation) return null;

  for (const goal of data.savingsGoals) {
    if (transaction.payee === `В накопление «${goal.name}»`)
      return { goalId: goal.id, mode: "deposit" };
    if (transaction.payee === `Из накопления «${goal.name}»`)
      return { goalId: goal.id, mode: "withdraw" };
  }
  return null;
}

function savingsAdjustmentAmount(
  transaction: Transaction,
  mode: SavingsAdjustmentMode,
) {
  return Number(
    mode === "deposit"
      ? transaction.fromAmount || transaction.toAmount || 0
      : transaction.toAmount || transaction.fromAmount || 0,
  );
}

export function undoSavingsAdjustment(data: AppData, transaction: Transaction) {
  const link = savingsAdjustmentLink(data, transaction);
  if (!link) return false;
  const goal = data.savingsGoals.find((item) => item.id === link.goalId);
  if (!goal) return false;
  const amount = savingsAdjustmentAmount(transaction, link.mode);
  if (!(amount > 0)) return false;
  goal.balance =
    link.mode === "deposit"
      ? Math.max(0, goal.balance - amount)
      : goal.balance + amount;
  return true;
}

export function syncSavingsAdjustmentEdit(
  data: AppData,
  existing: Transaction,
  replacement: Transaction,
): Transaction | null {
  const link = savingsAdjustmentLink(data, existing);
  if (!link) return replacement;
  const goal = data.savingsGoals.find((item) => item.id === link.goalId);
  if (!goal || !undoSavingsAdjustment(data, existing)) return replacement;

  const amount = savingsAdjustmentAmount(replacement, link.mode);
  if (!(amount > 0) || (link.mode === "withdraw" && amount > goal.balance))
    return null;

  goal.balance =
    link.mode === "deposit" ? goal.balance + amount : goal.balance - amount;
  const accountName =
    link.mode === "deposit"
      ? replacement.fromAccount
      : replacement.toAccount || replacement.fromAccount;
  const currency =
    link.mode === "deposit"
      ? replacement.fromCurrency
      : replacement.toCurrency || replacement.fromCurrency;

  return {
    ...replacement,
    type: link.mode === "deposit" ? "expense" : "income",
    categoryId: SAVINGS_CATEGORY_ID,
    categoryName: "Накопления",
    payee:
      link.mode === "deposit"
        ? `В накопление «${goal.name}»`
        : `Из накопления «${goal.name}»`,
    fromAccount: accountName,
    fromAmount: link.mode === "deposit" ? amount : 0,
    fromCurrency: currency,
    toAccount: accountName,
    toAmount: link.mode === "withdraw" ? amount : 0,
    toCurrency: currency,
    savingsGoalId: goal.id,
    savingsAdjustment: link.mode,
  };
}

export function applySavingsAdjustment(
  data: AppData,
  goalId: string,
  accountId: string,
  amount: number,
  mode: SavingsAdjustmentMode,
  now = new Date().toISOString(),
): AppData | null {
  const next = structuredClone(data);
  const goal = next.savingsGoals.find((item) => item.id === goalId);
  const account = next.accounts.find((item) => item.id === accountId);
  if (!goal || !account || !(amount > 0)) return null;

  const appliedAmount =
    mode === "withdraw" ? Math.min(amount, goal.balance) : amount;
  if (!(appliedAmount > 0)) return null;

  goal.balance =
    mode === "deposit"
      ? goal.balance + appliedAmount
      : goal.balance - appliedAmount;

  const transaction: Transaction = {
    id: `saving-operation-${crypto.randomUUID()}`,
    date: now.slice(0, 10),
    type: mode === "deposit" ? "expense" : "income",
    categoryId: SAVINGS_CATEGORY_ID,
    categoryName: "Накопления",
    payee:
      mode === "deposit"
        ? `В накопление «${goal.name}»`
        : `Из накопления «${goal.name}»`,
    comment: "",
    fromAccount: account.name,
    fromAmount: mode === "deposit" ? appliedAmount : 0,
    fromCurrency: account.currency,
    toAccount: account.name,
    toAmount: mode === "withdraw" ? appliedAmount : 0,
    toCurrency: account.currency,
    createdAt: now,
    updatedAt: now,
    savingsGoalId: goal.id,
    savingsAdjustment: mode,
  };

  next.transactions.push(transaction);
  adjustCurrentBalances(next, transaction);
  return next;
}
