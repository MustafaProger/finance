import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const out = mkdtempSync(join(tmpdir(), "finance-test-"));
try {
  execFileSync("node", [
    "node_modules/typescript/bin/tsc",
    "--ignoreConfig",
    "--outDir",
    out,
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--skipLibCheck",
    "src/format.ts",
    "src/savingsLogic.ts",
    "src/debtLogic.ts",
    "src/categoryStyles.ts",
  ]);
  writeFileSync(join(out, "package.json"), '{"type":"commonjs"}');
  const require = createRequire(import.meta.url);
  const f = require(join(out, "format.js"));
  const s = require(join(out, "savingsLogic.js"));
  const d = require(join(out, "debtLogic.js"));
  const c = require(join(out, "categoryStyles.js"));
  const base = {
    accounts: [
      {
        id: "a",
        name: "Альфа",
        currency: "RUB",
        currentBalance: 20000,
        openingBalance: 20000,
      },
      {
        id: "b",
        name: "Другой",
        currency: "RUB",
        currentBalance: 0,
        openingBalance: 0,
      },
    ],
    transactions: [],
    categories: [
      { id: "x", name: "Один", icon: "circle", color: "#718096" },
      { id: "y", name: "Два", icon: "circle", color: "#718096" },
    ],
    savingsGoals: [{ id: "g", name: "Цель", balance: 0 }],
    budgets: [],
    debts: [],
  };
  let next = s.applySavingsAdjustment(
    base,
    "g",
    "a",
    8000,
    "deposit",
    "2026-11-08T10:00:00Z",
  );
  assert.equal(next.accounts[0].currentBalance, 12000);
  assert.equal(next.savingsGoals[0].balance, 8000);
  assert.equal(f.statsFor(next, "2026-11").expense, 0);
  assert.equal(f.categoryStats(next, "2026-11").length, 0);
  next = s.applySavingsAdjustment(
    next,
    "g",
    "a",
    3000,
    "withdraw",
    "2026-11-08T11:00:00Z",
  );
  assert.equal(next.accounts[0].currentBalance, 15000);
  assert.equal(next.savingsGoals[0].balance, 5000);
  assert.equal(f.statsForRange(next, "2026-11-01", "2026-11-30").income, 0);
  const edited = structuredClone(next);
  const deposit = edited.transactions[0];
  const replacement = s.syncSavingsAdjustmentEdit(edited, deposit, {
    ...deposit,
    fromAmount: 7000,
  });
  assert.equal(edited.savingsGoals[0].balance, 4000);
  assert.equal(replacement.fromAmount, 7000);
  assert.equal(
    s.syncSavingsAdjustmentEdit(edited, replacement, {
      ...replacement,
      fromAmount: 1000,
    }),
    null,
  );
  assert.equal(s.undoSavingsAdjustment(next, next.transactions[0]), false);
  assert.equal(next.savingsGoals[0].balance, 5000);
  const tx = {
    id: "t",
    type: "income",
    date: "2026-11-08",
    createdAt: "2026-11-08T10:00:00Z",
    fromAccount: "Альфа",
    toAccount: "Альфа",
    fromAmount: 0,
    toAmount: 5000,
    fromCurrency: "RUB",
    toCurrency: "RUB",
    categoryId: "x",
  };
  for (const kind of ["gift", "entrusted", "debt"]) {
    const data = structuredClone(base);
    data.transactions = [{ ...tx, accountingKind: kind }];
    f.adjustCurrentBalances(data, data.transactions[0]);
    assert.equal(data.accounts[0].currentBalance, 25000);
    assert.equal(f.statsFor(data, "2026-11").income, 0);
  }
  assert.equal(
    f.statsFor({ ...base, transactions: [tx] }, "2026-11").income,
    5000,
  );
  for (const direction of ["owe", "owed"]) {
    const debt = {
      id: "debt",
      direction,
      amount: 10000,
      currency: "RUB",
      person: "Тест",
    };
    let data = d.debtMovement(base, debt, "a", 10000, "opening", "2026-11-08");
    assert.equal(
      data.accounts[0].currentBalance,
      direction === "owe" ? 30000 : 10000,
    );
    data = d.debtMovement(data, debt, "a", 4000, "repayment", "2026-11-08");
    assert.equal(d.debtRemaining(data, debt), 6000);
    assert.throws(() =>
      d.debtMovement(data, debt, "a", 6001, "repayment", "2026-11-08"),
    );
    data = d.debtMovement(data, debt, "a", 6000, "repayment", "2026-11-08");
    assert.equal(d.debtRemaining(data, debt), 0);
    assert.equal(data.accounts[0].currentBalance, 20000);
    assert.deepEqual(f.statsFor(data, "2026-11"), {
      income: 0,
      expense: 0,
      transfers: 0,
    });
    for (const t of data.transactions) f.adjustCurrentBalances(data, t, -1);
    assert.equal(data.accounts[0].currentBalance, 20000);
  }
  assert.throws(() =>
    d.debtMovement(
      base,
      { id: "d", currency: "USD" },
      "a",
      10,
      "opening",
      "2026-11-08",
    ),
  );
  for (const direction of ["owe", "owed"]) {
    const debt = {
      id: "edit",
      direction,
      amount: 270000,
      currency: "RUB",
      person: "Тест",
    };
    const original = { ...structuredClone(base), debts: [debt] };
    let data = d.debtMovement(
      original,
      debt,
      "a",
      35000,
      "repayment",
      "2026-11-08",
    );
    const corrected = d.updateDebtAmount(data, debt.id, 275000);
    assert.equal(d.debtRemaining(corrected, corrected.debts[0]), 240000);
    assert.deepEqual(corrected.transactions, data.transactions);
    assert.deepEqual(corrected.accounts, data.accounts);
    assert.equal(data.debts[0].amount, 270000);
    assert.throws(() => d.updateDebtAmount(data, debt.id, 34999));
    for (const invalid of [0, -1, NaN, Infinity])
      assert.throws(() => d.updateDebtAmount(data, debt.id, invalid));
    assert.equal(
      d.debtRemaining(d.updateDebtAmount(data, debt.id, 35000), {
        ...debt,
        amount: 35000,
      }),
      0,
    );
    data = d.debtMovement(
      original,
      debt,
      "a",
      debt.amount,
      "opening",
      "2026-11-08",
    );
    const changed = d.updateDebtAmount(data, debt.id, 275000);
    assert.equal(
      changed.accounts[0].currentBalance - data.accounts[0].currentBalance,
      direction === "owe" ? 5000 : -5000,
    );
    assert.equal(changed.transactions.length, 1);
    assert.deepEqual(f.statsFor(changed, "2026-11"), {
      income: 0,
      expense: 0,
      transfers: 0,
    });
  }
  const styled = c.distinguishCategories(base);
  assert.notEqual(styled.categories[0].color, styled.categories[1].color);
  assert.notEqual(styled.categories[0].icon, styled.categories[1].icon);
  assert.deepEqual(c.distinguishCategories(styled), styled);
  assert.deepEqual(styled.accounts, base.accounts);
  assert.deepEqual(styled.transactions, base.transactions);
  assert.equal(
    f.latestAccountName({
      ...base,
      transactions: [
        {
          ...tx,
          fromAccount: "Другой",
          toAccount: "Другой",
          date: "2026-11-09",
          createdAt: "2026-11-01T10:00:00Z",
        },
        { ...tx, date: "2026-10-01", createdAt: "2026-11-08T10:00:00Z" },
      ],
    }),
    "Альфа",
  );
  assert.equal(
    f.latestAccountName({ ...base, lastAccountId: "b", transactions: [tx] }),
    "Другой",
  );
  assert.equal(base.accounts[0].currentBalance, 20000);
  console.log(
    "PASS: savings, personal analytics, gifts, entrusted funds, both debt directions, partial/full repayments, overpayment, currency guard, reversals, category migration, last account, input immutability",
  );
} finally {
  rmSync(out, { recursive: true, force: true });
}
