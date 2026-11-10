import { Select } from "./Select";
import {
  categoryColors,
  categoryIcons,
  categoryIconLabels,
  suggestedCategoryIcon,
} from "./categoryStyles";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
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
  isPersonalFlow,
  accountBalance,
  adjustCurrentBalances,
  categoryOf,
  money,
  monthLabel,
} from "./format";
import { CategoryGlyph } from "./icons";
import { GuideLink } from "./Guide";

type ChangeHandler = (data: AppData) => void | Promise<void | boolean>;

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

const colors = categoryColors;
const iconNames = categoryIcons;

function CategoryEditor({
  category,
  existingCategories,
  onClose,
  onSave,
}: {
  category?: Category | null;
  existingCategories: Category[];
  onClose: () => void;
  onSave: (category: Category, applyHistory: boolean) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const [name, setName] = useState(category?.name || "");
  const [type, setType] = useState<Category["type"]>(
    category?.type || "expense",
  );
  const [color, setColor] = useState(
    category?.color ||
      colors.find((c) => !existingCategories.some((x) => x.color === c)) ||
      colors[0],
  );
  const [chosenIcon, setIcon] = useState(category?.icon);
  const [iconQuery, setIconQuery] = useState("");
  const [expandedIcons, setExpandedIcons] = useState(false);
  const [expandedColors, setExpandedColors] = useState(false);
  const initialKind = category?.accountingKind || "personal";
  const [accountingKind, setAccountingKind] =
    useState<NonNullable<Category["accountingKind"]>>(initialKind);
  const [applyHistory, setApplyHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const icon = chosenIcon ?? suggestedCategoryIcon(name);
  const validColor = CSS.supports("color", color);
  const query = iconQuery.trim().toLowerCase().replace(/ё/g, "е");
  const featuredIcons = [
    ...new Set([
      "circle",
      "family",
      "basket",
      "briefcase",
      "gift",
      "home",
      "transport",
      "fuel",
      "receipt",
      "restaurant",
      "health",
      icon,
    ]),
  ];
  const visibleIcons = query
    ? iconNames.filter((value) =>
        categoryIconLabels[value]
          .toLowerCase()
          .replace(/ё/g, "е")
          .includes(query),
      )
    : expandedIcons
      ? iconNames
      : featuredIcons;
  const visibleColors = expandedColors
    ? colors
    : [
        ...new Set([
          ...colors.slice(0, 12),
          ...(colors.includes(color) ? [color] : []),
        ]),
      ];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !name.trim() || !validColor) return;
    setSaving(true);
    setError(false);
    const saved = await onSave(
      {
        ...category,
        id: category?.id || `category-${crypto.randomUUID()}`,
        name: name.trim(),
        type,
        color,
        icon,
        accountingKind,
      },
      applyHistory,
    );
    if (!saved) {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="management-modal category-editor"
      aria-labelledby="category-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <header className="category-editor-header">
          <div>
            <h2 id="category-editor-title">
              {category ? "Изменить категорию" : "Новая категория"}
            </h2>
            <p>Настройте учёт и внешний вид</p>
          </div>
          <button
            className="category-editor-close"
            type="button"
            aria-label="Закрыть"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="category-editor-body">
          <section
            className="category-editor-panel"
            aria-labelledby="category-accounting"
          >
            <h3 id="category-accounting">Основное</h3>
            <label className="management-field">
              <span>Название</span>
              <input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, Семья"
              />
            </label>
            <div className="management-field">
              <span id="category-type-label">Тип операций</span>
              <div
                className="segmented"
                role="group"
                aria-labelledby="category-type-label"
              >
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
                    aria-pressed={type === value}
                    key={value}
                    onClick={() => setType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="management-field">
              <div className="field-label-row">
                <label htmlFor="category-kind">Как учитывать операции</label>
                <GuideLink />
              </div>
              <div className="category-native-select">
                <select
                  id="category-kind"
                  value={accountingKind}
                  onChange={(event) =>
                    setAccountingKind(
                      event.target.value as typeof accountingKind,
                    )
                  }
                >
                  <option value="personal">Личные доходы и расходы</option>
                  <option value="gift">Подарок / помощь (поступления)</option>
                  <option value="entrusted">Чужие деньги / поручение</option>
                  <option value="debt">Долг / возврат</option>
                </select>
                <ChevronDown size={16} aria-hidden />
              </div>
            </div>
            {category && (
              <label className="category-history">
                <input
                  type="checkbox"
                  checked={applyHistory}
                  onChange={(e) => setApplyHistory(e.target.checked)}
                />
                Применить настройку к старым операциям
              </label>
            )}
          </section>

          <section
            className="category-editor-panel category-appearance"
            aria-labelledby="category-appearance"
          >
            <h3 id="category-appearance">Оформление</h3>
            <div className="category-preview">
              <span
                className="category-badge"
                style={
                  {
                    "--category": validColor ? color : colors[0],
                  } as React.CSSProperties
                }
              >
                <CategoryGlyph name={icon} />
              </span>
              <div>
                <strong>{name.trim() || "Название категории"}</strong>
                <small>Предпросмотр</small>
              </div>
            </div>
            <div className="management-field">
              <div className="field-label-row">
                <span>Цвет</span>
                <button
                  type="button"
                  className="category-picker-toggle"
                  aria-expanded={expandedColors}
                  onClick={() => setExpandedColors(!expandedColors)}
                >
                  {expandedColors ? "Свернуть" : "Все цвета"}
                </button>
              </div>
              <div
                className="color-picker"
                role="group"
                aria-label="Готовые цвета"
              >
                {visibleColors.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={color === value ? "active" : ""}
                    aria-pressed={color === value}
                    style={{ "--choice": value } as React.CSSProperties}
                    onClick={() => setColor(value)}
                    aria-label={`Цвет ${value}`}
                  />
                ))}
              </div>
              <div className="category-custom-color">
                <input
                  aria-label="Палитра цвета"
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#3b82f6"}
                  onChange={(e) => setColor(e.target.value)}
                />
                <input
                  aria-label="Свой цвет"
                  aria-invalid={!validColor}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="HEX, RGB или RGBA"
                />
              </div>
              {!validColor && (
                <small className="category-editor-error" role="alert">
                  Введите цвет, например #60A5FA.
                </small>
              )}
            </div>
            <div className="management-field">
              <div className="field-label-row">
                <label htmlFor="category-icon-search">Иконка</label>
                <button
                  type="button"
                  className="category-picker-toggle"
                  aria-expanded={expandedIcons}
                  onClick={() => {
                    setExpandedIcons(!expandedIcons);
                    setIconQuery("");
                  }}
                >
                  {expandedIcons ? "Свернуть" : "Все иконки"}
                </button>
              </div>
              <input
                id="category-icon-search"
                type="search"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder="Поиск по названию"
              />
              <div
                className="icon-picker"
                role="group"
                aria-label="Иконки категорий"
              >
                {visibleIcons.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={categoryIconLabels[value]}
                    title={categoryIconLabels[value]}
                    aria-pressed={icon === value}
                    className={icon === value ? "active" : ""}
                    style={
                      {
                        "--choice": validColor ? color : colors[0],
                      } as React.CSSProperties
                    }
                    onClick={() => setIcon(value)}
                  >
                    <CategoryGlyph name={value} />
                  </button>
                ))}
              </div>
              {!visibleIcons.length && (
                <small role="status">Иконки не найдены.</small>
              )}
            </div>
          </section>
        </div>

        <footer className="category-editor-footer">
          {error && (
            <small className="category-editor-error" role="alert">
              Не удалось сохранить. Проверьте соединение и повторите.
            </small>
          )}
          <button
            type="button"
            className="category-editor-cancel"
            disabled={saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="management-submit"
            type="submit"
            disabled={saving || !name.trim() || !validColor}
          >
            {saving
              ? "Сохраняем…"
              : category
                ? "Сохранить"
                : "Создать категорию"}
          </button>
        </footer>
      </form>
    </dialog>
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
  const save = async (category: Category, applyHistory: boolean) => {
    const next = structuredClone(data);
    const index = next.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) {
      next.categories[index] = category;
      next.transactions
        .filter((item) => item.categoryId === category.id)
        .forEach((item) => {
          item.categoryName = category.name;
          if (
            applyHistory &&
            !item.debtId &&
            !item.savingsGoalId &&
            !item.savingsAdjustment &&
            item.categoryId !== "system-savings" &&
            !item.id.startsWith("saving-operation-") &&
            item.type !== "transfer"
          )
            item.accountingKind =
              category.accountingKind === "gift" && item.type === "expense"
                ? "personal"
                : category.accountingKind;
        });
    } else next.categories.push(category);
    if ((await onChange(next)) === false) return false;
    setEditing(undefined);
    return true;
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
          existingCategories={data.categories}
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
  const currencies = [...new Set(data.accounts.map((item) => item.currency))];
  const [currency, setCurrency] = useState(
    budget?.currency || data.profile.currency || currencies[0] || "RUB",
  );
  const [mode, setMode] = useState<"limit" | "plan">(
    budget?.items?.length ? "plan" : "limit",
  );
  const [limit, setLimit] = useState(String(budget?.limit || ""));
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
  const selectMode = (value: "limit" | "plan") => {
    setMode(value);
    if (value === "plan" && !items.length)
      setItems([
        {
          id: `budget-item-${crypto.randomUUID()}`,
          name: "",
          amount: 0,
          completed: false,
        },
      ]);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const limitValue = Number(limit);
    const validItems = items.filter(
      (item) => item.name.trim() && Number(item.amount) > 0,
    );
    if (
      !categoryId ||
      (mode === "limit" ? !limitValue || limitValue <= 0 : !validItems.length)
    )
      return;
    onSave({
      id: budget?.id || `budget-${crypto.randomUUID()}`,
      categoryId,
      currency,
      limit:
        mode === "limit"
          ? limitValue
          : validItems.reduce((sum, item) => sum + Number(item.amount), 0),
      ...(mode === "plan"
        ? {
            items: validItems.map((item) => ({
              ...item,
              name: item.name.trim(),
            })),
          }
        : {}),
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
            <p>Задайте общий лимит или составьте план покупок</p>
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
        <div className="management-field">
          <span>Формат бюджета</span>
          <div className="segmented">
            <button
              type="button"
              className={mode === "limit" ? "active" : ""}
              onClick={() => selectMode("limit")}
            >
              Общий лимит
            </button>
            <button
              type="button"
              className={mode === "plan" ? "active" : ""}
              onClick={() => selectMode("plan")}
            >
              План покупок
            </button>
          </div>
        </div>
        <div className="management-field">
          <span>Валюта</span>
          <div className="budget-currency-picker">
            {currencies.map((value) => (
              <button
                type="button"
                key={value}
                className={currency === value ? "active" : ""}
                onClick={() => setCurrency(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {mode === "limit" ? (
          <label className="management-field">
            <span>Лимит на месяц</span>
            <div className="amount-field budget-limit-field">
              <input
                autoFocus
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="0"
              />
              <b>{currency}</b>
            </div>
          </label>
        ) : (
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
                      min="0.01"
                      step="0.01"
                      value={item.amount || ""}
                      onChange={(event) =>
                        updateItem(item.id, {
                          amount: Number(event.target.value),
                        })
                      }
                      placeholder="0"
                      aria-label="Сумма траты"
                    />
                    <b>{currency}</b>
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
              <strong>{money(total, currency)}</strong>
            </div>
          </div>
        )}
        <button className="management-submit" type="submit">
          {budget ? "Сохранить бюджет" : "Добавить бюджет"}
        </button>
      </form>
    </div>
  );
}

function BudgetAccountPicker({
  data,
  budget,
  item,
  onClose,
  onSelect,
}: {
  data: AppData;
  budget: Budget;
  item: BudgetItem;
  onClose: () => void;
  onSelect: (accountId: string, currency: string) => void;
}) {
  const currencies = [...new Set(data.accounts.map((entry) => entry.currency))];
  const initialCurrency = budget.currency || data.profile.currency || "RUB";
  const [currency, setCurrency] = useState(
    currencies.includes(initialCurrency)
      ? initialCurrency
      : currencies[0] || initialCurrency,
  );
  const accounts = data.accounts.filter(
    (account) => account.currency === currency,
  );
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
              {item.name} · {money(item.amount, currency)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </header>
        <div className="management-field budget-writeoff-currency">
          <span>Валюта списания</span>
          <div className="budget-currency-picker">
            {currencies.map((value) => (
              <button
                type="button"
                key={value}
                className={currency === value ? "active" : ""}
                onClick={() => setCurrency(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="budget-account-list">
          {accounts.map((account) => (
            <button
              type="button"
              key={account.id}
              onClick={() => onSelect(account.id, currency)}
            >
              <i style={{ "--account": account.color } as React.CSSProperties}>
                {account.type === "cash" ? <WalletCards /> : <CreditCard />}
              </i>
              <span>
                <strong>{account.name}</strong>
                <small>{account.currency}</small>
              </span>
              <b>
                {money(accountBalance(data, account.name), account.currency)}
              </b>
            </button>
          ))}
        </div>
        {!accounts.length ? (
          <p className="budget-account-empty">
            Нет счетов в валюте {currency}.
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
  const budgetCurrency = (budget: Budget) =>
    budget.currency || data.profile.currency || "RUB";
  const transactionsSpent = (budget: Budget) => {
    const currency = budgetCurrency(budget);
    return data.transactions
      .filter(
        (item) =>
          item.date.startsWith(selectedMonth) &&
          item.type === "expense" &&
          isPersonalFlow(item) &&
          item.categoryId === budget.categoryId &&
          item.fromCurrency === currency,
      )
      .reduce((sum, item) => sum + Number(item.fromAmount || 0), 0);
  };
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
  const totals = [...new Set(data.budgets.map(budgetCurrency))].map(
    (currency) => {
      const budgets = data.budgets.filter(
        (budget) => budgetCurrency(budget) === currency,
      );
      return {
        currency,
        limit: budgets.reduce((sum, budget) => sum + budgetTotal(budget), 0),
        spent: budgets.reduce(
          (sum, budget) =>
            sum +
            transactionsSpent(budget) +
            completedBudgetTotal(budget, monthTransactionIds),
          0,
        ),
      };
    },
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
  const completeItem = async (accountId: string, currency: string) => {
    if (!pendingItem) return;
    const next = structuredClone(data);
    const budget = next.budgets.find(
      (entry) => entry.id === pendingItem.budgetId,
    );
    const item = budget?.items?.find(
      (entry) => entry.id === pendingItem.itemId,
    );
    const account = next.accounts.find((entry) => entry.id === accountId);
    if (!budget || !item || !account || account.currency !== currency) return;
    budget.currency = currency;
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
    next.lastAccountId = account.id;
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
              {totals.length
                ? totals
                    .map(
                      (item) =>
                        `${money(item.spent, item.currency)} потрачено из ${money(item.limit, item.currency)}`,
                    )
                    .join(" · ")
                : "Добавьте первый лимит для нужной категории"}
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
          const currency = budgetCurrency(budget);
          const transactionsTotal = transactionsSpent(budget);
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
                {money(value, currency)}{" "}
                <small>из {money(limit, currency)}</small>
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
                    ? `Осталось ${money(limit - value, currency)}`
                    : `Превышено ${money(value - limit, currency)}`}
                </strong>
              </footer>
              {budget.items?.length ? (
                <div className="budget-checklist">
                  <div className="budget-checklist-head">
                    <span>План</span>
                    <div>
                      <small>Отмечено {money(markedTotal, currency)}</small>
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
                        <b>{money(item.amount, currency)}</b>
                      </label>
                    );
                  })}
                  {transactionsTotal > 0 && (
                    <small className="budget-operations-note">
                      По операциям потрачено{" "}
                      {money(transactionsTotal, currency)}. В итог также входят
                      пункты без созданной операции.
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
          budget={data.budgets.find(
            (entry) => entry.id === pendingItem.budgetId,
          )!}
          item={pendingBudgetItem}
          onClose={() => setPendingItem(undefined)}
          onSelect={(accountId, currency) =>
            void completeItem(accountId, currency)
          }
        />
      ) : null}
    </div>
  );
}
