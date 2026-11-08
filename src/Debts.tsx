import { useState } from "react";
import {
  Plus,
  X,
  Handshake,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  History,
  ChevronDown,
  Check,
  CalendarDays,
  Pencil,
} from "lucide-react";
import type { AppData, Debt } from "./types";
import { debtMovement, debtRemaining } from "./debtLogic";
import { adjustCurrentBalances, money, dateLabel } from "./format";
const today = () => new Date().toLocaleDateString("en-CA");
export function DebtsPage({
  data,
  onChange,
}: {
  data: AppData;
  onChange: (data: AppData) => Promise<boolean>;
}) {
  const [form, setForm] = useState<null | "new" | Debt>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [person, setPerson] = useState("");
  const [direction, setDirection] = useState<Debt["direction"]>("owed");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(
    data.lastAccountId || data.accounts[0]?.id || "",
  );
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [moveMoney, setMoveMoney] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const commit = async (next: AppData) => {
    if (!(await onChange(next)))
      throw new Error(
        "Не удалось сохранить долг. Проверьте соединение и повторите.",
      );
  };
  const debts = data.debts || [];
  const open = (value: "new" | Debt) => {
    setForm(value);
    setAmount(value === "new" ? "" : String(debtRemaining(data, value)));
    setPerson("");
    setNote("");
    setDueDate("");
    setDate(today());
    setMoveMoney(false);
    setError("");
    if (value !== "new")
      setAccountId(
        data.accounts.find((a) => a.currency === value.currency)?.id || "",
      );
  };
  const remove = (debt: Debt) => {
    if (
      !confirm(
        `Удалить долг «${debt.person}» и все его движения? Остатки счетов будут восстановлены.`,
      )
    )
      return;
    const next = structuredClone(data);
    next.transactions
      .filter((t) => t.debtId === debt.id)
      .forEach((t) => adjustCurrentBalances(next, t, -1));
    next.transactions = next.transactions.filter((t) => t.debtId !== debt.id);
    next.debts = debts.filter((d) => d.id !== debt.id);
    onChange(next);
  };
  return (
    <div className="page-stack">
      <section className="surface management-hero">
        <div>
          <span className="management-hero-icon">
            <Handshake />
          </span>
          <div>
            <h2>Долги и возвраты</h2>
            <p>
              Я должен · Мне должны · Частичные возвраты. Без влияния на
              заработок и расходы.
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => open("new")}>
          <Plus /> Добавить долг
        </button>
      </section>
      <div className="debt-summary-grid">
        {(["owed", "owe"] as const).map((dir) => {
          const active = debts.filter(
            (d) => d.direction === dir && debtRemaining(data, d) > 0,
          );
          const currencies = [...new Set(active.map((d) => d.currency))];
          return (
            <section className={`surface debt-summary ${dir}`} key={dir}>
              <span className="debt-direction-icon">
                {dir === "owed" ? <ArrowDownLeft /> : <ArrowUpRight />}
              </span>
              <div>
                <span className="debt-eyebrow">
                  {dir === "owed" ? "Мне должны" : "Я должен"}
                </span>
                <strong>
                  {currencies.length
                    ? currencies
                        .map((currency) =>
                          money(
                            active
                              .filter((d) => d.currency === currency)
                              .reduce((n, d) => n + debtRemaining(data, d), 0),
                            currency,
                          ),
                        )
                        .join(" · ")
                    : money(0)}
                </strong>
                <small>
                  {active.length
                    ? `Открытых долгов: ${active.length}`
                    : "Нет открытых долгов"}
                </small>
              </div>
            </section>
          );
        })}
      </div>
      <div className="debt-section-heading">
        <h2>
          Все долги <span>{debts.length}</span>
        </h2>
        <span>Возвраты сохраняются в истории</span>
      </div>
      <div className="savings-grid debt-grid">
        {!debts.length && (
          <section className="surface empty-management savings-empty">
            <Handshake size={32} />
            <strong>Долгов пока нет</strong>
            <span>Запишите, кому вы дали в долг или у кого заняли.</span>
            <button className="primary-button" onClick={() => open("new")}>
              <Plus /> Добавить долг
            </button>
          </section>
        )}
        {debts.map((debt) => {
          const remaining = debtRemaining(data, debt);
          const repaid = debt.amount - remaining;
          const overdue = Boolean(
            debt.dueDate && debt.dueDate < today() && remaining > 0,
          );
          const movements = data.transactions
            .filter((t) => t.debtId === debt.id)
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <article
              className="surface savings-card debt-record"
              style={
                {
                  "--saving": debt.direction === "owed" ? "#34D399" : "#FBBF24",
                } as React.CSSProperties
              }
              key={debt.id}
            >
              <header>
                <span>
                  {debt.direction === "owed" ? (
                    <ArrowDownLeft size={23} />
                  ) : (
                    <ArrowUpRight size={23} />
                  )}
                </span>
                <div className="card-actions">
                  <button
                    aria-label={`Изменить долг ${debt.person}`}
                    onClick={() => {
                      setError("");
                      setEditingDebt(debt);
                    }}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="danger"
                    aria-label={`Удалить долг ${debt.person}`}
                    onClick={() => remove(debt)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </header>
              <div className="savings-card-copy">
                <strong>{debt.person}</strong>
                <b>{money(remaining, debt.currency)}</b>
              </div>
              <span
                className={`debt-status ${remaining === 0 ? "closed" : ""}`}
              >
                {remaining === 0 ? (
                  <>
                    <Check size={12} /> Погашен
                  </>
                ) : debt.direction === "owed" ? (
                  "Мне должны"
                ) : (
                  "Я должен"
                )}
              </span>
              <div className="savings-target">
                <div>
                  <span>Возвращено {money(repaid, debt.currency)}</span>
                  <strong>из {money(debt.amount, debt.currency)}</strong>
                </div>
                <div className="budget-progress">
                  <i
                    style={{
                      width: `${Math.min(100, (repaid / debt.amount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <p className={`debt-due ${overdue ? "overdue" : ""}`}>
                <CalendarDays size={14} />
                {debt.dueDate
                  ? `${overdue ? "Просрочен · " : "До "}${dateLabel(debt.dueDate, true)}`
                  : "Без срока возврата"}
              </p>
              {debt.note && <p className="debt-note">{debt.note}</p>}
              {remaining > 0 && (
                <button
                  className="savings-adjust-button"
                  onClick={() => open(debt)}
                >
                  <Plus size={17} /> Записать возврат
                </button>
              )}
              <details className="debt-history">
                <summary>
                  <History size={15} />
                  <span>История движений</span>
                  <small>{movements.length}</small>
                  <ChevronDown size={15} />
                </summary>
                <div>
                  {!movements.length && (
                    <p>
                      Долг записан {dateLabel(debt.date, true)} без движения по
                      счёту.
                    </p>
                  )}
                  {movements.map((t) => (
                    <div className="debt-history-row" key={t.id}>
                      <div>
                        <strong>
                          {t.debtAction === "opening"
                            ? "Выдача / получение"
                            : "Возврат"}
                        </strong>
                        <small>
                          {dateLabel(t.date, true)} ·{" "}
                          {t.type === "income" ? t.toAccount : t.fromAccount}
                        </small>
                      </div>
                      <span>
                        {money(
                          t.type === "income" ? t.toAmount : t.fromAmount,
                          debt.currency,
                        )}
                      </span>
                      {t.debtAction === "repayment" && (
                        <div className="card-actions">
                          <button
                            className="danger"
                            aria-label="Отменить возврат"
                            onClick={() => {
                              if (
                                !confirm(
                                  "Отменить возврат и восстановить остаток счёта?",
                                )
                              )
                                return;
                              const next = structuredClone(data);
                              adjustCurrentBalances(next, t, -1);
                              next.transactions = next.transactions.filter(
                                (x) => x.id !== t.id,
                              );
                              void onChange(next);
                            }}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
      {editingDebt && (
        <div className="modal-backdrop">
          <form
            className="management-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Изменить долг"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              const fields = new FormData(e.currentTarget);
              const person = String(fields.get("person") || "").trim();
              if (!person) return;
              setSaving(true);
              try {
                const next = structuredClone(data);
                const debt = next.debts?.find((d) => d.id === editingDebt.id);
                if (!debt) throw new Error("Долг не найден");
                debt.person = person;
                debt.note = String(fields.get("note") || "").trim();
                debt.dueDate = String(fields.get("dueDate") || "");
                next.transactions
                  .filter((t) => t.debtId === debt.id)
                  .forEach((t) => (t.payee = person));
                await commit(next);
                setEditingDebt(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <header>
              <h2>Изменить долг</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setEditingDebt(null)}
              >
                <X />
              </button>
            </header>
            <label className="management-field">
              Кто
              <input name="person" required defaultValue={editingDebt.person} />
            </label>
            <label className="management-field">
              Срок возврата
              <input
                name="dueDate"
                type="date"
                defaultValue={editingDebt.dueDate}
              />
            </label>
            <label className="management-field">
              Комментарий
              <input name="note" defaultValue={editingDebt.note} />
            </label>
            <p>
              Первоначальная сумма:{" "}
              {money(editingDebt.amount, editingDebt.currency)}. Дополнительную
              выдачу запишите отдельным долгом.
            </p>
            {error && <p role="alert">{error}</p>}
            <button className="management-submit" disabled={saving}>
              Сохранить
            </button>
          </form>
        </div>
      )}
      {form && (
        <div className="modal-backdrop">
          <form
            className="management-modal"
            role="dialog"
            aria-modal="true"
            aria-label={form === "new" ? "Новый долг" : "Возврат долга"}
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              setSaving(true);
              setError("");
              try {
                const value = Number(amount);
                const account = data.accounts.find((a) => a.id === accountId);
                if (!Number.isFinite(value) || value <= 0 || !account)
                  throw new Error("Укажите положительную сумму и счёт");
                if (form === "new") {
                  if (!person.trim())
                    throw new Error("Укажите человека или организацию");
                  const debt: Debt = {
                    id: crypto.randomUUID(),
                    person: person.trim(),
                    direction,
                    amount: Math.round(value * 100) / 100,
                    currency: account.currency,
                    date,
                    dueDate,
                    note: note.trim(),
                    createdAt: new Date().toISOString(),
                  };
                  const next = structuredClone(data);
                  next.debts = [...debts, debt];
                  await commit(
                    moveMoney
                      ? debtMovement(
                          next,
                          debt,
                          accountId,
                          debt.amount,
                          "opening",
                          date,
                        )
                      : next,
                  );
                } else
                  await commit(
                    debtMovement(
                      data,
                      form,
                      accountId,
                      Math.round(value * 100) / 100,
                      "repayment",
                      date,
                    ),
                  );
                setForm(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <header>
              <h2>
                {form === "new" ? "Новый долг" : `Возврат · ${form.person}`}
              </h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setForm(null)}
              >
                <X />
              </button>
            </header>
            {form === "new" && (
              <>
                <label className="management-field">
                  Кто
                  <input
                    required
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                  />
                </label>
                <label className="management-field">
                  Направление
                  <select
                    value={direction}
                    onChange={(e) =>
                      setDirection(e.target.value as Debt["direction"])
                    }
                  >
                    <option value="owed">Мне должны — я дал деньги</option>
                    <option value="owe">Я должен — я взял деньги</option>
                  </select>
                </label>
              </>
            )}
            <label className="management-field">
              Сумма
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="management-field">
              {form === "new" && !moveMoney
                ? "Валюта по счёту (остаток не изменится)"
                : "Счёт движения"}
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {data.accounts
                  .filter((a) => form === "new" || a.currency === form.currency)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </label>
            <label className="management-field">
              Дата
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {form === "new" && (
              <>
                <label className="management-field">
                  Срок возврата (необязательно)
                  <input
                    type="date"
                    min={date}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
                <label className="management-field">
                  Комментарий
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={moveMoney}
                    onChange={(e) => setMoveMoney(e.target.checked)}
                  />{" "}
                  Записать движение денег по счёту сейчас
                </label>
                <p>
                  Для старого долга оставьте выключенным, чтобы не учесть деньги
                  повторно.
                </p>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className="management-submit"
              type="submit"
              disabled={saving}
            >
              Сохранить
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
