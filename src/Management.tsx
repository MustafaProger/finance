import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  Pencil,
  Plus,
  Tag,
  Target,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import type { AppData, Budget, BudgetItem, Category } from "./types";
import {
  accountBalance,
  adjustCurrentBalances,
  categoryOf,
  categoryStats,
  money,
  monthLabel,
} from "./format";
import { CategoryGlyph } from "./icons";

type ChangeHandler = (data: AppData) => void | Promise<void>;

const budgetTotal = (budget: Budget) =>
  budget.items?.reduce((sum, item) => sum + Number(item.amount || 0), 0) ||
  Number(budget.limit || 0);

const noTransactionIds = new Set<string>();

const completedBudgetTotal = (
  budget: Budget,
  transactionIds: Set<string> = noTransactionIds,
) =>
  budget.items?.reduce(
    (sum, item) =>
      sum +
      (item.completed &&
      (!item.transactionId || !transactionIds.has(item.transactionId))
        ? Number(item.amount || 0)
        : 0),
    0,
  ) || 0;

const colors = [
  "#718096",
  "#A78BFA",
  "#F472B6",
  "#EF4444",
  "#F97316",
  "#FFB020",
  "#10B981",
  "#14B8A6",
  "#3B82F6",
  "#6366F1",
];
const iconNames = [
  "circle",
  "hand-heart",
  "handshake",
  "more",
  "heart",
  "health",
  "sparkles",
  "coffee",
  "book",
  "gift",
  "basket",
  "briefcase",
  "car",
  "repeat",
  "coins",
  "trend-up",
  "plane",
  "train",
  "bike",
  "fuel",
  "phone",
  "smartphone",
  "laptop",
  "wifi",
  "receipt",
  "store",
  "pizza",
  "cake",
  "hotel",
  "camera",
  "music",
  "movie",
  "game",
  "gym",
  "trophy",
  "education",
  "clothes",
  "pet",
  "baby",
  "repair",
  "appliances",
  "utilities",
  "vacation",
  "nature",
];

function CategoryEditor({
  category,
  onClose,
  onSave,
}: {
  category?: Category | null;
  onClose: () => void;
  onSave: (category: Category) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [type, setType] = useState<Category["type"]>(
    category?.type || "expense",
  );
  const [color, setColor] = useState(category?.color || colors[6]);
  const [icon, setIcon] = useState(category?.icon || "circle");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: category?.id || `category-${crypto.randomUUID()}`,
      name: name.trim(),
      type,
      color,
      icon,
    });
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="management-modal" onSubmit={submit}>
        <header>
          <div>
            <h2>{category ? "Изменить категорию" : "Новая категория"}</h2>
            <p>Название, назначение и визуальный стиль</p>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <label className="management-field">
          <span>Название</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Дом"
          />
        </label>
        <div className="management-field">
          <span>Тип операций</span>
          <div className="segmented">
            {(
              [
                ["expense", "Расходы"],
                ["income", "Доходы"],
                ["mixed", "Оба типа"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                className={type === value ? "active" : ""}
                key={value}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="management-field">
          <span>Цвет</span>
          <div className="color-picker">
            {colors.map((value) => (
              <button
                type="button"
                key={value}
                className={color === value ? "active" : ""}
                style={{ "--choice": value } as React.CSSProperties}
                onClick={() => setColor(value)}
                aria-label={`Цвет ${value}`}
              />
            ))}
          </div>
        </div>
        <div className="management-field">
          <span>Иконка</span>
          <div className="icon-picker">
            {iconNames.map((value) => (
              <button
                type="button"
                key={value}
                className={icon === value ? "active" : ""}
                style={{ "--choice": color } as React.CSSProperties}
                onClick={() => setIcon(value)}
              >
                <CategoryGlyph name={value} />
              </button>
            ))}
          </div>
        </div>
        <button className="management-submit" type="submit">
          {category ? "Сохранить изменения" : "Добавить категорию"}
        </button>
      </form>
    </div>
  );
}

export function CategoriesPage({
  data,
  onChange,
}: {
  data: AppData;
  onChange: ChangeHandler;
}) {
  const [editing, setEditing] = useState<Category | null | undefined>(
    undefined,
  );
  const usage = useMemo(
    () =>
      new Map(
        data.categories.map((category) => [
          category.id,
          data.transactions.filter((item) => item.categoryId === category.id)
            .length,
        ]),
      ),
    [data],
  );
  const save = async (category: Category) => {
    const next = structuredClone(data);
    const index = next.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) {
      next.categories[index] = category;
      next.transactions
        .filter((item) => item.categoryId === category.id)
        .forEach((item) => {
          item.categoryName = category.name;
        });
    } else next.categories.push(category);
    await onChange(next);
    setEditing(undefined);
  };
  const remove = async (category: Category) => {
    if (category.id === "category-без-категории") return;
    if (
      !confirm(
        `Удалить категорию «${category.name}»? Операции будут перенесены в «Без категории».`,
      )
    )
      return;
    const next = structuredClone(data);
    const fallback =
      next.categories.find((item) => item.id === "category-без-категории") ||
      next.categories[0];
    next.transactions
      .filter((item) => item.categoryId === category.id)
      .forEach((item) => {
        item.categoryId = fallback.id;
        item.categoryName = fallback.name;
      });
    next.budgets = next.budgets.filter(
      (item) => item.categoryId !== category.id,
    );
    next.categories = next.categories.filter((item) => item.id !== category.id);
    await onChange(next);
  };
  return (
    <div className="page-stack">
      <section className="surface management-hero">
        <div>
          <span className="management-hero-icon">
            <Tag />
          </span>
          <div>
            <h2>Ваши категории</h2>
            <p>Создавайте собственную структуру доходов и расходов</p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          <Plus /> Категория
        </button>
      </section>
      <div className="category-grid">
        {data.categories.map((category) => (
          <article className="category-card" key={category.id}>
            <span
              className="category-badge large"
              style={{ "--category": category.color } as React.CSSProperties}
            >
              <CategoryGlyph name={category.icon} />
            </span>
            <div>
              <strong>{category.name}</strong>
              <small>
                {category.type === "expense"
                  ? "Расходы"
                  : category.type === "income"
                    ? "Доходы"
                    : "Доходы и расходы"}{" "}
                · {usage.get(category.id) || 0} операций
              </small>
            </div>
            <div className="card-actions">
              <button
                aria-label={`Изменить ${category.name}`}
                onClick={() => setEditing(category)}
              >
                <Pencil />
              </button>
              {category.id !== "category-без-категории" && (
                <button
                  className="danger"
                  aria-label={`Удалить ${category.name}`}
                  onClick={() => remove(category)}
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {editing !== undefined && (
        <CategoryEditor
          category={editing}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}
    </div>
  );
}

function BudgetEditor({
  data,
  budget,
  onClose,
  onSave,
}: {
  data: AppData;
  budget?: Budget | null;
  onClose: () => void;
  onSave: (budget: Budget) => void;
}) {
  const available = data.categories.filter((item) => item.type !== "income");
  const [categoryId, setCategoryId] = useState(
    budget?.categoryId || available[0]?.id || "",
  );
  const [items, setItems] = useState<BudgetItem[]>(() =>
    budget?.items?.length
      ? budget.items
      : budget
        ? [
            {
              id: `budget-item-${crypto.randomUUID()}`,
              name: "Общий лимит",
              amount: budget.limit,
              completed: false,
            },
          ]
        : [],
  );
  const total = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const updateItem = (id: string, patch: Partial<BudgetItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const addItem = () =>
    setItems((current) => {
      // Не создаём стопку пустых строк, если пользователь ещё заполняет
      // предыдущую позицию.
      if (current.some((item) => !item.name.trim() || !Number(item.amount)))
        return current;
      return [
        ...current,
        {
          id: `budget-item-${crypto.randomUUID()}`,
          name: "",
          amount: 0,
          completed: false,
        },
      ];
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validItems = items.filter(
      (item) => item.name.trim() && Number(item.amount) > 0,
    );
    if (!categoryId || !validItems.length) return;
    onSave({
      id: budget?.id || `budget-${crypto.randomUUID()}`,
      categoryId,
      limit: validItems.reduce((sum, item) => sum + Number(item.amount), 0),
      items: validItems.map((item) => ({ ...item, name: item.name.trim() })),
    });
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="management-modal budget-editor" onSubmit={submit}>
        <header>
          <div>
            <h2>{budget ? "Изменить бюджет" : "Новый бюджет"}</h2>
            <p>Соберите список трат — сумма посчитается сама</p>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="management-field">
          <span>Категория</span>
          <div className="budget-category-picker">
            {available.map((category) => (
              <button
                type="button"
                className={category.id === categoryId ? "active" : ""}
                key={category.id}
                onClick={() => setCategoryId(category.id)}
              >
                <i
                  style={
                    { "--category": category.color } as React.CSSProperties
                  }
                >
                  <CategoryGlyph name={category.icon} />
                </i>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="management-field budget-items-field">
          <span>Плановые траты</span>
          <div className="budget-item-editor-list">
            {items.map((item) => (
              <div className="budget-item-editor" key={item.id}>
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateItem(item.id, { name: event.target.value })
                  }
                  placeholder="Например, ChatGPT"
                  aria-label="Название траты"
                />
                <div className="amount-field">
                  <input
                    inputMode="decimal"
                    type="number"
                    min="1"
                    step="1"
                    value={item.amount || ""}
                    onChange={(event) =>
                      updateItem(item.id, {
                        amount: Number(event.target.value),
                      })
                    }
                    placeholder="0"
                    aria-label="Сумма траты"
                  />
                  <b>₽</b>
                </div>
                <button
                  type="button"
                  className="danger budget-item-remove"
                  aria-label={`Удалить ${item.name || "трату"}`}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="budget-item-add" onClick={addItem}>
            <Plus /> Добавить трату
          </button>
          <div className="budget-plan-total">
            <span>Бюджет на месяц</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
        <button className="management-submit" type="submit">
          {budget ? "Сохранить бюджет" : "Добавить бюджет"}
        </button>
      </form>
    </div>
  );
}

function BudgetAccountPicker({
  data,
  item,
  onClose,
  onSelect,
}: {
  data: AppData;
  item: BudgetItem;
  onClose: () => void;
  onSelect: (accountId: string) => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="management-modal budget-account-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-account-title"
      >
        <header>
          <div>
            <h2 id="budget-account-title">Откуда списались деньги?</h2>
            <p>
              {item.name} · {money(item.amount)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </header>
        <div className="budget-account-list">
          {data.accounts.map((account) => (
            <button
              type="button"
              key={account.id}
              onClick={() => onSelect(account.id)}
            >
              <i style={{ "--account": account.color } as React.CSSProperties}>
                {account.type === "cash" ? <WalletCards /> : <CreditCard />}
              </i>
              <span>
                <strong>{account.name}</strong>
                <small>{account.currency}</small>
              </span>
              <b>{money(accountBalance(data, account.name))}</b>
            </button>
          ))}
        </div>
        {!data.accounts.length ? (
          <p className="budget-account-empty">
            Сначала добавьте хотя бы один счёт.
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function BudgetsPage({
  data,
  selectedMonth,
  onChange,
}: {
  data: AppData;
  selectedMonth: string;
  onChange: ChangeHandler;
}) {
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined);
  const [pendingItem, setPendingItem] = useState<{
    budgetId: string;
    itemId: string;
  }>();
  const spent = new Map(
    categoryStats(data, selectedMonth).map((item) => [item.id, item.value]),
  );
  const monthTransactionIds = new Set(
    data.transactions
      .filter((item) => item.date.startsWith(selectedMonth))
      .map((item) => item.id),
  );
  const save = async (budget: Budget) => {
    const next = structuredClone(data);
    const index = next.budgets.findIndex((item) => item.id === budget.id);
    if (index >= 0) next.budgets[index] = budget;
    else {
      const sameCategory = next.budgets.findIndex(
        (item) => item.categoryId === budget.categoryId,
      );
      if (sameCategory >= 0)
        next.budgets[sameCategory] = {
          ...budget,
          id: next.budgets[sameCategory].id,
        };
      else next.budgets.push(budget);
    }
    await onChange(next);
    setEditing(undefined);
  };
  const remove = async (budget: Budget) => {
    const category = categoryOf(data, budget.categoryId);
    if (!confirm(`Удалить бюджет «${category.name}»?`)) return;
    await onChange({
      ...data,
      budgets: data.budgets.filter((item) => item.id !== budget.id),
    });
  };
  const totalLimit = data.budgets.reduce(
    (sum, item) => sum + budgetTotal(item),
    0,
  );
  const totalSpent = data.budgets.reduce(
    (sum, item) =>
      sum +
      (spent.get(item.categoryId) || 0) +
      completedBudgetTotal(item, monthTransactionIds),
    0,
  );
  const requestToggleItem = async (budgetId: string, itemId: string) => {
    const budget = data.budgets.find((entry) => entry.id === budgetId);
    const item = budget?.items?.find((entry) => entry.id === itemId);
    if (!item) return;
    if (!item.completed) {
      setPendingItem({ budgetId, itemId });
      return;
    }
    const next = structuredClone(data);
    const nextBudget = next.budgets.find((entry) => entry.id === budgetId);
    const nextItem = nextBudget?.items?.find((entry) => entry.id === itemId);
    if (!nextItem) return;
    if (nextItem.transactionId) {
      const transaction = next.transactions.find(
        (entry) => entry.id === nextItem.transactionId,
      );
      if (transaction) adjustCurrentBalances(next, transaction, -1);
      next.transactions = next.transactions.filter(
        (entry) => entry.id !== nextItem.transactionId,
      );
    }
    nextItem.completed = false;
    delete nextItem.transactionId;
    await onChange(next);
  };
  const completeItem = async (accountId: string) => {
    if (!pendingItem) return;
    const next = structuredClone(data);
    const budget = next.budgets.find(
      (entry) => entry.id === pendingItem.budgetId,
    );
    const item = budget?.items?.find(
      (entry) => entry.id === pendingItem.itemId,
    );
    const account = next.accounts.find((entry) => entry.id === accountId);
    if (!budget || !item || !account) return;
    const category = categoryOf(next, budget.categoryId);
    const transactionId = `budget-operation-${crypto.randomUUID()}`;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const transaction = {
      id: transactionId,
      date:
        selectedMonth === currentMonth
          ? new Date().toISOString().slice(0, 10)
          : `${selectedMonth}-01`,
      type: "expense" as const,
      categoryId: category.id,
      categoryName: category.name,
      payee: "",
      comment: item.name,
      fromAccount: account.name,
      fromAmount: Number(item.amount),
      fromCurrency: account.currency,
      toAccount: account.name,
      toAmount: 0,
      toCurrency: account.currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    next.transactions.push(transaction);
    adjustCurrentBalances(next, transaction, 1);
    item.completed = true;
    item.transactionId = transactionId;
    await onChange(next);
    setPendingItem(undefined);
  };
  const resetItems = async (budgetId: string) => {
    const next = structuredClone(data);
    const budget = next.budgets.find((item) => item.id === budgetId);
    if (!budget?.items) return;
    budget.items.forEach((item) => {
      if (item.transactionId) {
        const transaction = next.transactions.find(
          (entry) => entry.id === item.transactionId,
        );
        if (transaction) adjustCurrentBalances(next, transaction, -1);
        next.transactions = next.transactions.filter(
          (entry) => entry.id !== item.transactionId,
        );
        delete item.transactionId;
      }
      item.completed = false;
    });
    await onChange(next);
  };
  const pendingBudgetItem = pendingItem
    ? data.budgets
        .find((entry) => entry.id === pendingItem.budgetId)
        ?.items?.find((entry) => entry.id === pendingItem.itemId)
    : undefined;
  return (
    <div className="page-stack">
      <section className="surface management-hero">
        <div>
          <span className="management-hero-icon">
            <Target />
          </span>
          <div>
            <h2>Бюджеты на {monthLabel(selectedMonth).toLowerCase()}</h2>
            <p>
              {money(totalSpent)} потрачено из {money(totalLimit)}
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          <Plus /> Бюджет
        </button>
      </section>
      <div className="budget-grid">
        {data.budgets.map((budget) => {
          const category = categoryOf(data, budget.categoryId);
          const transactionsTotal = spent.get(budget.categoryId) || 0;
          const completedTotal = completedBudgetTotal(
            budget,
            monthTransactionIds,
          );
          const markedTotal =
            budget.items?.reduce(
              (sum, item) =>
                sum + (item.completed ? Number(item.amount || 0) : 0),
              0,
            ) || 0;
          const value = transactionsTotal + completedTotal;
          const limit = budgetTotal(budget);
          const ratio = limit ? (value / limit) * 100 : 0;
          return (
            <section className="surface budget-card" key={budget.id}>
              <div className="budget-card-head">
                <div>
                  <span
                    className="category-badge large"
                    style={
                      { "--category": category.color } as React.CSSProperties
                    }
                  >
                    <CategoryGlyph name={category.icon} />
                  </span>
                  <span>
                    <strong>{category.name}</strong>
                    <small>{monthLabel(selectedMonth)}</small>
                  </span>
                </div>
                <div className="card-actions">
                  <button
                    aria-label={`Изменить бюджет ${category.name}`}
                    onClick={() => setEditing(budget)}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="danger"
                    aria-label={`Удалить бюджет ${category.name}`}
                    onClick={() => remove(budget)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
              <b>
                {money(value)} <small>из {money(limit)}</small>
              </b>
              <div className="budget-progress">
                <i
                  style={{
                    width: `${Math.min(100, ratio)}%`,
                    background: ratio > 100 ? "#fb7185" : category.color,
                  }}
                />
              </div>
              <footer>
                <span>{ratio.toFixed(0)}% использовано</span>
                <strong>
                  {ratio <= 100
                    ? `Осталось ${money(limit - value)}`
                    : `Превышено ${money(value - limit)}`}
                </strong>
              </footer>
              {budget.items?.length ? (
                <div className="budget-checklist">
                  <div className="budget-checklist-head">
                    <span>План</span>
                    <div>
                      <small>Отмечено {money(markedTotal)}</small>
                      {markedTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => void resetItems(budget.id)}
                        >
                          Сбросить
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {budget.items.map((item) => {
                    const checked = item.completed;
                    return (
                      <label className={checked ? "checked" : ""} key={item.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            void requestToggleItem(budget.id, item.id)
                          }
                        />
                        <i>
                          <Check />
                        </i>
                        <span>{item.name}</span>
                        <b>{money(item.amount)}</b>
                      </label>
                    );
                  })}
                  {transactionsTotal > 0 && (
                    <small className="budget-operations-note">
                      По операциям потрачено {money(transactionsTotal)}. В итог
                      также входят пункты без созданной операции.
                    </small>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
        {!data.budgets.length && (
          <section className="surface empty-management">
            <Target />
            <strong>Бюджетов пока нет</strong>
            <span>Добавьте первый лимит для нужной категории</span>
          </section>
        )}
      </div>
      {editing !== undefined && (
        <BudgetEditor
          data={data}
          budget={editing}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}
      {pendingItem && pendingBudgetItem ? (
        <BudgetAccountPicker
          data={data}
          item={pendingBudgetItem}
          onClose={() => setPendingItem(undefined)}
          onSelect={(accountId) => void completeItem(accountId)}
        />
      ) : null}
    </div>
  );
}
