import { FormEvent, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AppData, SavingsGoal } from "./types";
import { money } from "./format";
import { CategoryGlyph } from "./icons";

type ChangeHandler = (data: AppData) => void | Promise<void>;

const goalColors = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#14B8A6",
  "#F59E0B",
  "#F97316",
  "#EC4899",
  "#64748B",
];

const goalIcons = [
  "savings",
  "car",
  "home",
  "vacation",
  "plane",
  "education",
  "laptop",
  "gift",
  "trophy",
  "bank",
];

function GoalEditor({
  goal,
  onClose,
  onSave,
}: {
  goal?: SavingsGoal | null;
  onClose: () => void;
  onSave: (goal: SavingsGoal) => void;
}) {
  const [name, setName] = useState(goal?.name || "");
  const [balance, setBalance] = useState(String(goal?.balance || ""));
  const [target, setTarget] = useState(String(goal?.target || ""));
  const [color, setColor] = useState(goal?.color || goalColors[0]);
  const [icon, setIcon] = useState(goal?.icon || "savings");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || Number(balance) < 0 || Number(target) < 0) return;
    onSave({
      id: goal?.id || `saving-${crypto.randomUUID()}`,
      name: name.trim(),
      balance: Number(balance) || 0,
      target: Number(target) || 0,
      color,
      icon,
      createdAt: goal?.createdAt || new Date().toISOString(),
    });
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="management-modal savings-editor" onSubmit={submit}>
        <header>
          <div>
            <h2>{goal ? "Изменить накопление" : "Новое накопление"}</h2>
            <p>Создайте отдельный счёт для важной цели</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </header>
        <label className="management-field">
          <span>Название</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Машина"
          />
        </label>
        <div className="savings-amount-fields">
          <label className="management-field">
            <span>Уже накоплено</span>
            <div className="amount-field">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                placeholder="0"
              />
              <b>₽</b>
            </div>
          </label>
          <label className="management-field">
            <span>Цель, необязательно</span>
            <div className="amount-field">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="0"
              />
              <b>₽</b>
            </div>
          </label>
        </div>
        <div className="management-field">
          <span>Цвет</span>
          <div className="color-picker">
            {goalColors.map((value) => (
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
            {goalIcons.map((value) => (
              <button
                type="button"
                key={value}
                className={icon === value ? "active" : ""}
                style={{ "--choice": color } as React.CSSProperties}
                onClick={() => setIcon(value)}
                aria-label={`Иконка ${value}`}
              >
                <CategoryGlyph name={value} />
              </button>
            ))}
          </div>
        </div>
        <button className="management-submit" type="submit">
          {goal ? "Сохранить изменения" : "Создать накопление"}
        </button>
      </form>
    </div>
  );
}

function GoalAdjustment({
  goal,
  onClose,
  onApply,
}: {
  goal: SavingsGoal;
  onClose: () => void;
  onApply: (amount: number) => void;
}) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return;
    onApply(mode === "deposit" ? value : -Math.min(value, goal.balance));
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="management-modal savings-adjustment" onSubmit={submit}>
        <header>
          <div>
            <h2>{goal.name}</h2>
            <p>Сейчас накоплено {money(goal.balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </header>
        <div className="segmented two-options">
          <button
            type="button"
            className={mode === "deposit" ? "active" : ""}
            onClick={() => setMode("deposit")}
          >
            <ArrowDownLeft /> Пополнить
          </button>
          <button
            type="button"
            className={mode === "withdraw" ? "active" : ""}
            onClick={() => setMode("withdraw")}
          >
            <ArrowUpRight /> Снять
          </button>
        </div>
        <label className="management-field">
          <span>Сумма</span>
          <div className="amount-field">
            <input
              autoFocus
              type="number"
              min="1"
              max={mode === "withdraw" ? goal.balance : undefined}
              step="1"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
            <b>₽</b>
          </div>
        </label>
        <button className="management-submit" type="submit">
          {mode === "deposit" ? "Пополнить накопление" : "Снять из накопления"}
        </button>
      </form>
    </div>
  );
}

export function SavingsPage({
  data,
  onChange,
}: {
  data: AppData;
  onChange: ChangeHandler;
}) {
  const goals = data.savingsGoals || [];
  const [editing, setEditing] = useState<SavingsGoal | null | undefined>(
    undefined,
  );
  const [adjusting, setAdjusting] = useState<SavingsGoal | undefined>();
  const total = goals.reduce((sum, goal) => sum + goal.balance, 0);
  const save = async (goal: SavingsGoal) => {
    const next = structuredClone(data);
    next.savingsGoals ||= [];
    const index = next.savingsGoals.findIndex((item) => item.id === goal.id);
    if (index >= 0) next.savingsGoals[index] = goal;
    else next.savingsGoals.push(goal);
    await onChange(next);
    setEditing(undefined);
  };
  const adjust = async (goal: SavingsGoal, amount: number) => {
    const next = structuredClone(data);
    const current = next.savingsGoals.find((item) => item.id === goal.id);
    if (!current) return;
    current.balance = Math.max(0, current.balance + amount);
    await onChange(next);
    setAdjusting(undefined);
  };
  const remove = async (goal: SavingsGoal) => {
    if (!confirm(`Удалить накопление «${goal.name}»?`)) return;
    await onChange({
      ...data,
      savingsGoals: goals.filter((item) => item.id !== goal.id),
    });
  };
  return (
    <div className="page-stack savings-page">
      <section className="surface savings-hero">
        <div>
          <div>
            <span>Всего в накоплениях</span>
            <strong>{money(total)}</strong>
            <p>
              {goals.length
                ? `${goals.length} ${goals.length === 1 ? "цель" : "цели"}`
                : "Создайте первую цель"}
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setEditing(null)}>
          <Plus /> Накопление
        </button>
      </section>
      <div className="savings-grid">
        {goals.map((goal) => {
          const ratio = goal.target
            ? Math.min(100, (goal.balance / goal.target) * 100)
            : 0;
          return (
            <article
              className="surface savings-card"
              style={{ "--saving": goal.color } as React.CSSProperties}
              key={goal.id}
            >
              <header>
                <span>
                  <CategoryGlyph name={goal.icon} size={23} />
                </span>
                <div className="card-actions">
                  <button
                    aria-label={`Изменить ${goal.name}`}
                    onClick={() => setEditing(goal)}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="danger"
                    aria-label={`Удалить ${goal.name}`}
                    onClick={() => void remove(goal)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </header>
              <div className="savings-card-copy">
                <strong>{goal.name}</strong>
                <b>{money(goal.balance)}</b>
              </div>
              {goal.target ? (
                <div className="savings-target">
                  <div>
                    <span>Цель {money(goal.target)}</span>
                    <strong>{ratio.toFixed(0)}%</strong>
                  </div>
                  <div className="budget-progress">
                    <i style={{ width: `${ratio}%` }} />
                  </div>
                  <small>
                    {goal.balance >= goal.target
                      ? "Цель достигнута"
                      : `Осталось ${money(goal.target - goal.balance)}`}
                  </small>
                </div>
              ) : (
                <p className="savings-no-target">Без ограничения по сумме</p>
              )}
              <button
                className="savings-adjust-button"
                onClick={() => setAdjusting(goal)}
              >
                <Plus /> Изменить сумму
              </button>
            </article>
          );
        })}
        {!goals.length && (
          <section className="surface empty-management savings-empty">
            <strong>Накоплений пока нет</strong>
            <span>
              Разделите деньги по целям: машина, квартира, подушка или отпуск
            </span>
            <button className="primary-button" onClick={() => setEditing(null)}>
              <Plus /> Создать накопление
            </button>
          </section>
        )}
      </div>
      {editing !== undefined && (
        <GoalEditor
          goal={editing}
          onClose={() => setEditing(undefined)}
          onSave={(goal) => void save(goal)}
        />
      )}
      {adjusting && (
        <GoalAdjustment
          goal={adjusting}
          onClose={() => setAdjusting(undefined)}
          onApply={(amount) => void adjust(adjusting, amount)}
        />
      )}
    </div>
  );
}
