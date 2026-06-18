import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, Tag, Target, Trash2, X } from "lucide-react";
import type { AppData, Budget, Category } from "./types";
import { categoryOf, categoryStats, money, monthLabel } from "./format";
import { CategoryGlyph } from "./icons";

type ChangeHandler = (data: AppData) => void | Promise<void>;

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
  const [limit, setLimit] = useState(String(budget?.limit || ""));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!categoryId || Number(limit) <= 0) return;
    onSave({
      id: budget?.id || `budget-${crypto.randomUUID()}`,
      categoryId,
      limit: Number(limit),
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
            <p>Выберите категорию и месячный лимит</p>
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
        <label className="management-field">
          <span>Лимит на месяц</span>
          <div className="amount-field">
            <input
              inputMode="decimal"
              type="number"
              min="1"
              step="1"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="0"
            />
            <b>₽</b>
          </div>
        </label>
        <button className="management-submit" type="submit">
          {budget ? "Сохранить бюджет" : "Добавить бюджет"}
        </button>
      </form>
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
  const spent = new Map(
    categoryStats(data, selectedMonth).map((item) => [item.id, item.value]),
  );
  const save = async (budget: Budget) => {
    const next = structuredClone(data);
    const sameCategory = next.budgets.findIndex(
      (item) => item.categoryId === budget.categoryId && item.id !== budget.id,
    );
    const index = next.budgets.findIndex((item) => item.id === budget.id);
    if (index >= 0) next.budgets[index] = budget;
    else if (sameCategory >= 0) next.budgets[sameCategory].limit = budget.limit;
    else next.budgets.push(budget);
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
  const totalLimit = data.budgets.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = data.budgets.reduce(
    (sum, item) => sum + (spent.get(item.categoryId) || 0),
    0,
  );
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
          const value = spent.get(budget.categoryId) || 0;
          const ratio = budget.limit ? (value / budget.limit) * 100 : 0;
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
                {money(value)} <small>из {money(budget.limit)}</small>
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
                    ? `Осталось ${money(budget.limit - value)}`
                    : `Превышено ${money(value - budget.limit)}`}
                </strong>
              </footer>
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
    </div>
  );
}
