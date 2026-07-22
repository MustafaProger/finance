import { FormEvent, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import type { AppData, SavingsGoal } from "./types";
import { accountBalance, money } from "./format";
import { CategoryGlyph } from "./icons";
import {
  applySavingsAdjustment,
  type SavingsAdjustmentMode,
} from "./savingsLogic";

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
  "bank",
  "car",
  "home",
  "vacation",
  "plane",
  "education",
  "laptop",
  "gift",
  "trophy",
];

const visibleGoalIcon = (icon?: string) =>
  icon === "savings" || !icon ? "bank" : icon;

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
  const [icon, setIcon] = useState(visibleGoalIcon(goal?.icon));
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
  data,
  goal,
  onClose,
  onApply,
}: {
  data: AppData;
  goal: SavingsGoal;
  onClose: () => void;
  onApply: (
    amount: number,
    accountId: string,
    mode: SavingsAdjustmentMode,
  ) => void;
}) {
  const [mode, setMode] = useState<SavingsAdjustmentMode>("deposit");
  const [amount, setAmount] = useState("");
  const accounts = data.accounts.filter(
    (account) => account.currency === (data.profile.currency || "RUB"),
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const numericAmount = Number(amount);
  const canSubmit =
    Boolean(accountId) &&
    numericAmount > 0 &&
    (mode === "deposit" || numericAmount <= goal.balance);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onApply(numericAmount, accountId, mode);
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
        <div className="management-field savings-account-field">
          <span>
            {mode === "deposit"
              ? "С какого счёта списать?"
              : "На какой счёт зачислить?"}
          </span>
          <div className="savings-account-list">
            {accounts.map((account) => (
              <button
                type="button"
                key={account.id}
                className={accountId === account.id ? "active" : ""}
                onClick={() => setAccountId(account.id)}
                aria-pressed={accountId === account.id}
              >
                <i
                  style={{ "--account": account.color } as React.CSSProperties}
                >
                  {account.type === "cash" ? <WalletCards /> : <CreditCard />}
                </i>
                <span>
                  <strong>{account.name}</strong>
                  <small>
                    {money(
                      accountBalance(data, account.name),
                      account.currency,
                    )}
                  </small>
                </span>
                {accountId === account.id ? <Check /> : null}
              </button>
            ))}
          </div>
          {!accounts.length ? (
            <small className="savings-account-empty">
              Нет счетов в валюте {data.profile.currency || "RUB"}
            </small>
          ) : null}
        </div>
        <button
          className="management-submit"
          type="submit"
          disabled={!canSubmit}
        >
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
  const adjust = async (
    goal: SavingsGoal,
    amount: number,
    accountId: string,
    mode: SavingsAdjustmentMode,
  ) => {
    const next = applySavingsAdjustment(data, goal.id, accountId, amount, mode);
    if (!next) return;
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
                  <CategoryGlyph name={visibleGoalIcon(goal.icon)} size={23} />
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
          data={data}
          goal={adjusting}
          onClose={() => setAdjusting(undefined)}
          onApply={(amount, accountId, mode) =>
            void adjust(adjusting, amount, accountId, mode)
          }
        />
      )}
    </div>
  );
}
