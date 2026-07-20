import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Filter,
  Landmark,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Account,
  AppData,
  Route,
  Transaction,
  TransactionType,
} from "./types";
import {
  accountBalance,
  adjustCurrentBalances,
  amountOf,
  categoryOf,
  categoryStats,
  compactMoney,
  compareTransactionsNewest,
  currencyOf,
  dateLabel,
  money,
  monthKeys,
  monthLabel,
  prevMonth,
  statsFor,
  titleOf,
} from "./format";
import { CategoryGlyph } from "./icons";
import {
  connectData,
  dataErrorMessage,
  resetData,
  writeData,
  type SyncState,
} from "./storage";
import {
  authErrorMessage,
  firebaseConfigured,
  login as firebaseLogin,
  logout as firebaseLogout,
  observeAuth,
  type User,
} from "./firebase";
import { BudgetsPage, CategoriesPage } from "./Management";
import { GlobalSearch } from "./GlobalSearch";
import { importZenCsv } from "./csvImport";

const routes: { id: Route; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Обзор", icon: WalletCards },
  { id: "transactions", label: "Операции", icon: List },
  { id: "budgets", label: "Бюджеты", icon: Target },
  { id: "categories", label: "Категории", icon: Tag },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  // Временно отключено для пользователей:
  // { id: "assistant", label: "GPT-анализ", icon: Sparkles },
  { id: "accounts", label: "Счета", icon: Landmark },
];

function routeFromHash(): Route {
  const requested = location.hash.slice(1) as Route;
  return [...routes.map((item) => item.id), "settings"].includes(requested)
    ? requested
    : "overview";
}

const tooltipStyle = {
  background: "#111b2d",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 14,
  color: "#f8fafc",
  boxShadow: "0 18px 50px rgba(0,0,0,.3)",
};

type CashflowPeriod = 1 | 3 | 6 | 12 | "all";

const cashflowPeriods: {
  value: CashflowPeriod;
  label: string;
  title: string;
}[] = [
  { value: 1, label: "1 мес.", title: "1 месяц" },
  { value: 3, label: "3 мес.", title: "3 месяца" },
  { value: 6, label: "6 мес.", title: "6 месяцев" },
  { value: 12, label: "1 год", title: "1 год" },
  { value: "all", label: "Всё", title: "всё время" },
];

const accountColors = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F97316",
  "#EC4899",
  "#14B8A6",
];

const accountCurrencies = ["RUB", "EUR", "USD", "GBP", "AED", "TRY"];

function currencyMark(currency: string) {
  if (currency === "RUB") return "₽";
  if (currency === "EUR") return "€";
  if (currency === "USD") return "$";
  if (currency === "GBP") return "£";
  return currency;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [locked]);
}

function cashflowMonthCount(
  data: AppData,
  selectedMonth: string,
  period: CashflowPeriod,
) {
  if (period !== "all") return period;
  const earliest = data.transactions
    .map((item) => item.date.slice(0, 7))
    .filter((month) => month <= selectedMonth)
    .sort()[0];
  if (!earliest) return 1;
  const [startYear, startMonth] = earliest.split("-").map(Number);
  const [endYear, endMonth] = selectedMonth.split("-").map(Number);
  return Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + 1);
}

function cashflowDailyKeys(selectedMonth: string) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const current = new Date();
  const currentMonth = `${current.getFullYear()}-${String(
    current.getMonth() + 1,
  ).padStart(2, "0")}`;
  const days =
    selectedMonth === currentMonth
      ? current.getDate()
      : new Date(year, month, 0).getDate();
  return Array.from(
    { length: days },
    (_, index) => `${selectedMonth}-${String(index + 1).padStart(2, "0")}`,
  );
}

function CashflowPeriodControl({
  value,
  onChange,
}: {
  value: CashflowPeriod;
  onChange: (value: CashflowPeriod) => void;
}) {
  return (
    <div
      className="chart-period-control"
      role="group"
      aria-label="Период графика"
    >
      {cashflowPeriods.map((item) => (
        <button
          type="button"
          key={item.label}
          className={value === item.value ? "active" : ""}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.value === value)?.label || label;
  return (
    <div
      className={`select-control ${open ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((item) => !item)}
      >
        <span>{current}</span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="select-menu" role="listbox">
          {options.map((item) => (
            <button
              type="button"
              role="option"
              aria-selected={item.value === value}
              key={item.value}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              <span>{item.label}</span>
              {item.value === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBadge({
  data,
  transaction,
  size = "normal",
}: {
  data: AppData;
  transaction: Transaction;
  size?: "normal" | "large";
}) {
  const category =
    transaction.type === "transfer"
      ? { color: "#60a5fa", icon: "arrows" }
      : categoryOf(data, transaction.categoryId);
  return (
    <span
      className={`category-badge ${size}`}
      style={{ "--category": category.color } as React.CSSProperties}
    >
      <CategoryGlyph name={category.icon} size={size === "large" ? 23 : 19} />
    </span>
  );
}

function CashflowChart({
  data,
  selectedMonth,
  compact = false,
  period = 6,
}: {
  data: AppData;
  selectedMonth: string;
  compact?: boolean;
  period?: CashflowPeriod;
}) {
  const chartData =
    period === 1
      ? cashflowDailyKeys(selectedMonth).map((key) => ({
          month: String(Number(key.slice(-2))),
          ...statsFor(data, key),
        }))
      : monthKeys(
          selectedMonth,
          cashflowMonthCount(data, selectedMonth, period),
        ).map((key) => ({
          month:
            period === "all"
              ? `${monthLabel(key, true).replace(".", "")} ’${key.slice(2, 4)}`
              : monthLabel(key, true).replace(".", ""),
          ...statsFor(data, key),
        }));
  return (
    <div className={`chart-shell ${compact ? "compact" : ""}`}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
        initialDimension={{ width: 720, height: compact ? 245 : 300 }}
      >
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 10, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34d399" stopOpacity={0.28} />
              <stop offset="1" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fb7185" stopOpacity={0.25} />
              <stop offset="1" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(148,163,184,.1)" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#77839a", fontSize: 11 }}
            dy={8}
            minTickGap={28}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#77839a", fontSize: 10 }}
            tickFormatter={(value) => compactMoney(value)}
            width={65}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => money(Number(value))}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Доходы"
            stroke="#34d399"
            strokeWidth={3}
            fill="url(#incomeFill)"
            strokeLinecap="round"
            strokeLinejoin="round"
            activeDot={{ r: 5, strokeWidth: 3 }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Расходы"
            stroke="#fb7185"
            strokeWidth={3}
            fill="url(#expenseFill)"
            strokeLinecap="round"
            strokeLinejoin="round"
            activeDot={{ r: 5, strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({
  data,
  selectedMonth,
}: {
  data: AppData;
  selectedMonth: string;
}) {
  const categories = categoryStats(data, selectedMonth);
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([]);
  const excludedIds = new Set(excludedCategoryIds);
  const visibleCategories = categories.filter(
    (item) => !excludedIds.has(item.id),
  );
  const total = visibleCategories.reduce((sum, item) => sum + item.value, 0);
  const excludedTotal = categories
    .filter((item) => excludedIds.has(item.id))
    .reduce((sum, item) => sum + item.value, 0);
  const chartCategories = visibleCategories.length
    ? visibleCategories
    : [{ id: "empty", color: "#334155", value: 1 }];
  const toggleCategory = (id: string) => {
    setExcludedCategoryIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };
  return (
    <div className="donut-layout">
      <div className="donut-visual">
        <div className="donut-chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 210, height: 210 }}
          >
            <PieChart>
              <Pie
                data={chartCategories}
                dataKey="value"
                innerRadius="68%"
                outerRadius="91%"
                paddingAngle={visibleCategories.length ? 2 : 0}
                cornerRadius={8}
                stroke="none"
                isAnimationActive={false}
              >
                {chartCategories.map((item) => (
                  <Cell key={item.id} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong aria-live="polite">{compactMoney(total)}</strong>
            <span>
              {visibleCategories.length
                ? "учтено в расходах"
                : "нет учтённых расходов"}
            </span>
          </div>
        </div>
        {excludedTotal > 0 && (
          <p className="donut-filter-note" aria-live="polite">
            <Filter size={14} /> Не учитывается {money(excludedTotal)}
          </p>
        )}
      </div>
      <div className="category-breakdown">
        {categories.map((item) => {
          const excluded = excludedIds.has(item.id);
          return (
            <button
              className={`category-toggle ${excluded ? "is-excluded" : ""}`}
              type="button"
              key={item.id}
              aria-pressed={!excluded}
              aria-label={`${excluded ? "Включить" : "Исключить"} ${item.name} в расчёте`}
              onClick={() => toggleCategory(item.id)}
            >
              <span
                className="category-toggle-radio"
                style={{ "--category": item.color } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className="category-toggle-copy">
                <span>{item.name}</span>
                <small>
                  {money(item.value)}
                  {excluded && " · исключено"}
                </small>
              </span>
              <strong>
                {excluded || !total
                  ? "—"
                  : `${Math.round((item.value / total) * 100)}%`}
              </strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OperationRow({
  data,
  item,
  onClick,
}: {
  data: AppData;
  item: Transaction;
  onClick: () => void;
}) {
  const category =
    item.type === "transfer"
      ? "Перевод"
      : categoryOf(data, item.categoryId).name;
  const sign =
    item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔ ";
  return (
    <button className="operation-row" type="button" onClick={onClick}>
      <CategoryBadge data={data} transaction={item} />
      <span className="operation-copy">
        <strong>{titleOf(item)}</strong>
        <span>
          {category}
          <i>·</i>
          {item.type === "income" ? item.toAccount : item.fromAccount}
          {item.tags?.length
            ? ` · ${item.tags
                .slice(0, 2)
                .map((tag) => `#${tag}`)
                .join(" ")}`
            : ""}
        </span>
      </span>
      <span className={`operation-amount ${item.type}`}>
        <strong>
          {sign}
          {money(amountOf(item), currencyOf(item))}
        </strong>
        <span>{dateLabel(item.date)}</span>
      </span>
    </button>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const remember = true;
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!firebaseConfigured) {
      setError("Сначала добавьте настройки Firebase в файл .env");
      return;
    }
    setSubmitting(true);
    try {
      await firebaseLogin(email, password, remember);
    } catch (loginError) {
      setError(authErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-art" aria-hidden="true">
        <div className="login-logo">К</div>
        <div>
          <h2>Финансы без лишнего шума</h2>
          <p>
            Все счета, бюджеты и аналитика — в одном приватном пространстве.
          </p>
        </div>
        <div className="login-preview">
          <span>
            <BarChart3 size={18} /> Умная аналитика
          </span>
          <strong>+23 480 ₽</strong>
          <small>результат этого месяца</small>
        </div>
      </div>
      <section className="login-panel">
        <div className="mobile-brand">
          <span>К</span>
          <strong>Капитал</strong>
        </div>
        <div className="login-heading">
          <span>
            <ShieldCheck size={16} /> Приватное пространство
          </span>
          <h1>С возвращением</h1>
          <p>Войдите, чтобы продолжить управлять личными финансами.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Электронная почта</span>
            <div className="login-input">
              <UserRound size={20} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
              />
            </div>
          </label>
          <label>
            <span>Пароль</span>
            <div className="login-input">
              <LockKeyhole size={20} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          <p className="remember-note">Вход сохранится на этом устройстве</p>
          <p className="login-error">{error}</p>
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "Подключаем…" : "Войти"} <ArrowRight size={19} />
          </button>
        </form>
        <p className="login-note">
          <Cloud size={16} /> Данные зашифрованно передаются в Firebase и
          доступны только вашему аккаунту.
        </p>
      </section>
    </main>
  );
}

interface TransactionModalProps {
  data: AppData;
  transaction?: Transaction | null;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

function TransactionModal({
  data,
  transaction,
  onClose,
  onSave,
  onDelete,
}: TransactionModalProps) {
  const initialType = transaction?.type || "expense";
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(
    String(transaction ? amountOf(transaction) : ""),
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ||
      data.categories.find((item) => item.type !== "income")?.id ||
      "",
  );
  const [fromAccount, setFromAccount] = useState(
    transaction?.fromAccount || data.accounts[0]?.name || "",
  );
  const [toAccount, setToAccount] = useState(
    transaction?.toAccount || data.accounts[0]?.name || "",
  );
  const [date, setDate] = useState(
    transaction?.date || new Date().toISOString().slice(0, 10),
  );
  const [location, setLocation] = useState(transaction?.location || "");
  const [comment, setComment] = useState(transaction?.comment || "");
  const [tagsText, setTagsText] = useState(
    transaction?.tags?.map((item) => `#${item}`).join(" ") || "",
  );
  const [destinationAmount, setDestinationAmount] = useState(
    transaction?.type === "transfer" ? String(transaction.toAmount) : "",
  );
  const [repeat, setRepeat] = useState(Boolean(transaction?.repeat));
  const sourceAccount =
    data.accounts.find((item) => item.name === fromAccount) || data.accounts[0];
  const transferAccounts = data.accounts
    .filter((item) => item.id !== sourceAccount?.id)
    .sort(
      (left, right) =>
        Number(right.currency === sourceAccount?.currency) -
        Number(left.currency === sourceAccount?.currency),
    );
  const destinationAccount = transferAccounts.find(
    (item) => item.name === toAccount,
  );
  const categories = data.categories.filter(
    (item) =>
      item.type === "mixed" ||
      item.type === type ||
      (type === "expense" && item.type !== "income"),
  );
  useEffect(() => {
    if (
      type !== "transfer" &&
      !categories.some((item) => item.id === categoryId)
    )
      setCategoryId(categories[0]?.id || "");
  }, [type]);
  useEffect(() => {
    if (type !== "transfer") return;
    if (!transferAccounts.some((item) => item.name === toAccount))
      setToAccount(transferAccounts[0]?.name || "");
  }, [type, fromAccount, toAccount]);
  const save = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const source =
      data.accounts.find((item) => item.name === fromAccount) ||
      data.accounts[0];
    if (!source) return;
    const destination = data.accounts.find(
      (item) => item.name === toAccount && item.id !== source.id,
    );
    if (type === "transfer" && !destination) return;
    const receivedValue =
      type === "transfer" && destination!.currency !== source.currency
        ? Number(destinationAmount)
        : value;
    if (type === "transfer" && (!receivedValue || receivedValue <= 0)) return;
    const category = categoryOf(data, categoryId);
    const tags = [
      ...new Set(
        tagsText
          .split(/[#,;\s]+/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    onSave({
      id: transaction?.id || `local-${crypto.randomUUID()}`,
      type,
      date,
      categoryId: type === "transfer" ? "category-без-категории" : category.id,
      categoryName: type === "transfer" ? "Без категории" : category.name,
      payee: transaction?.payee || "",
      comment: comment.trim(),
      fromAccount: source.name,
      fromAmount: type === "income" ? 0 : value,
      fromCurrency: source.currency,
      toAccount: type === "transfer" ? destination!.name : source.name,
      toAmount:
        type === "expense" ? 0 : type === "transfer" ? receivedValue : value,
      toCurrency: type === "transfer" ? destination!.currency : source.currency,
      createdAt: transaction?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
      location: location.trim(),
      repeat,
    });
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="transaction-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={transaction ? "Изменение операции" : "Добавление операции"}
      >
        <header>
          <button
            className="sheet-icon"
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={21} />
          </button>
          <Select
            label="Тип операции"
            value={type}
            onChange={(value) => setType(value as TransactionType)}
            options={[
              { value: "expense", label: "Расход" },
              { value: "income", label: "Доход" },
              { value: "transfer", label: "Перевод" },
            ]}
          />
          <button className="save-link" type="button" onClick={save}>
            Сохранить
          </button>
        </header>
        <div className={`amount-entry ${type}`}>
          <span>{type === "expense" ? "−" : type === "income" ? "+" : ""}</span>
          <input
            autoFocus
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
          <b>{currencyMark(sourceAccount?.currency || "RUB")}</b>
        </div>
        {type !== "transfer" && (
          <div className="category-picker">
            <span className="field-caption">Категория</span>
            <div className="category-scroll">
              {categories.map((category) => (
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
        )}
        <div className="sheet-fields">
          <div className="sheet-row">
            <WalletCards size={20} />
            <span>{type === "income" ? "На счёт" : "Со счёта"}</span>
            <Select
              label="Счёт"
              value={fromAccount}
              onChange={setFromAccount}
              options={data.accounts.map((item) => ({
                value: item.name,
                label: item.name,
              }))}
            />
          </div>
          {type === "transfer" && (
            <>
              <div className="sheet-row">
                <ArrowLeft size={20} />
                <span>На счёт</span>
                <Select
                  label="Счёт"
                  value={toAccount}
                  onChange={setToAccount}
                  options={transferAccounts.map((item) => ({
                    value: item.name,
                    label: `${item.name} · ${item.currency}`,
                  }))}
                />
              </div>
              {destinationAccount &&
                destinationAccount.currency !== sourceAccount.currency && (
                  <label className="sheet-row">
                    <ArrowRight size={20} />
                    <span>Зачислится</span>
                    <div className="transfer-received-field">
                      <input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={destinationAmount}
                        onChange={(event) =>
                          setDestinationAmount(event.target.value)
                        }
                        placeholder="0"
                        aria-label="Сумма зачисления"
                      />
                      <b>{currencyMark(destinationAccount.currency)}</b>
                    </div>
                  </label>
                )}
            </>
          )}
          <label className="sheet-row">
            <CalendarDays size={20} />
            <span>Дата</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="sheet-row">
            <MapPin size={20} />
            <span>Место</span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Необязательно"
            />
          </label>
          <label className="sheet-row">
            <MessageCircle size={20} />
            <span>Комментарий</span>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
            />
          </label>
          <label className="sheet-row">
            <Tag size={20} />
            <span>Метки</span>
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="#работа #подписки"
            />
          </label>
          <label className="sheet-row">
            <Clock3 size={20} />
            <span>Повторять операцию</span>
            <input
              className="switch"
              type="checkbox"
              checked={repeat}
              onChange={(event) => setRepeat(event.target.checked)}
            />
          </label>
        </div>
        {transaction && (
          <button
            className="delete-operation"
            type="button"
            onClick={() => onDelete(transaction.id)}
          >
            <Trash2 size={18} /> Удалить операцию
          </button>
        )}
        <button className="mobile-save" type="button" onClick={save}>
          Сохранить операцию
        </button>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon: ReactNode;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <i>{icon}</i>
    </div>
  );
}

function Overview({
  data,
  selectedMonth,
  edit,
  add,
}: {
  data: AppData;
  selectedMonth: string;
  edit: (item: Transaction) => void;
  add: () => void;
}) {
  const stats = statsFor(data, selectedMonth);
  const net = stats.income - stats.expense;
  const recent = [...data.transactions]
    .sort(compareTransactionsNewest)
    .slice(0, 6);
  const totalBalance = data.accounts
    .filter((item) => item.currency === "RUB")
    .reduce((sum, item) => sum + accountBalance(data, item.name), 0);
  return (
    <div className="dashboard-grid">
      <section className="hero-balance">
        <div>
          <span>Общий баланс</span>
          <strong>{money(totalBalance, "RUB", 2)}</strong>
          <small>по всем рублёвым счетам</small>
        </div>
        <button className="quick-add" onClick={add}>
          <Plus size={20} /> Добавить операцию
        </button>
        <div className="hero-stats">
          <span>
            <ArrowUpRight />
            Доходы <b>{money(stats.income)}</b>
          </span>
          <span>
            <ArrowDownRight />
            Расходы <b>{money(stats.expense)}</b>
          </span>
          <span>
            <CircleDollarSign />
            Результат <b>{money(net)}</b>
          </span>
        </div>
      </section>
      <section className="surface cashflow-card">
        <div className="section-heading">
          <div>
            <h2>Денежный поток</h2>
            <p>Доходы и расходы за 6 месяцев</p>
          </div>
          <div className="legend">
            <span className="income">Доходы</span>
            <span className="expense">Расходы</span>
          </div>
        </div>
        <CashflowChart data={data} selectedMonth={selectedMonth} compact />
      </section>
      <section className="surface structure-card">
        <div className="section-heading">
          <div>
            <h2>Структура расходов</h2>
            <p>{monthLabel(selectedMonth)}</p>
          </div>
        </div>
        <Donut data={data} selectedMonth={selectedMonth} />
      </section>
      <section className="surface recent-card">
        <div className="section-heading">
          <div>
            <h2>Последние операции</h2>
            <p>Недавняя активность по счетам</p>
          </div>
        </div>
        <div className="operations-list">
          {recent.map((item) => (
            <OperationRow
              data={data}
              item={item}
              onClick={() => edit(item)}
              key={item.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Transactions({
  data,
  selectedMonth,
  edit,
  add,
}: {
  data: AppData;
  selectedMonth: string;
  edit: (item: Transaction) => void;
  add: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const items = useMemo(
    () =>
      [...data.transactions]
        .filter((item) => item.date.startsWith(selectedMonth))
        .filter((item) => type === "all" || item.type === type)
        .filter((item) => category === "all" || item.categoryId === category)
        .filter(
          (item) =>
            !query.trim() ||
            [
              item.comment,
              item.payee,
              item.categoryName,
              item.fromAccount,
              item.toAccount,
              ...(item.tags || []),
              ...(item.tags || []).map((tag) => `#${tag}`),
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query.toLowerCase()),
            ),
        )
        .sort(compareTransactionsNewest),
    [data, selectedMonth, query, type, category],
  );
  const totals = items.reduce(
    (value, item) => {
      if (item.type === "income" && item.toCurrency === "RUB")
        value.income += item.toAmount;
      if (item.type === "expense" && item.fromCurrency === "RUB")
        value.expense += item.fromAmount;
      return value;
    },
    { income: 0, expense: 0 },
  );
  return (
    <div className="page-stack">
      <section className="surface filters-card">
        <div className="filter-row">
          <label className="search-box">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по операциям"
            />
          </label>
          <Select
            label="Все типы"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "Все типы" },
              { value: "expense", label: "Расходы" },
              { value: "income", label: "Доходы" },
              { value: "transfer", label: "Переводы" },
            ]}
          />
          <Select
            label="Все категории"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "Все категории" },
              ...data.categories
                .filter((item) => item.type !== "income")
                .map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </div>
        <div className="stats-row">
          <StatCard
            label="Найдено"
            value={String(items.length)}
            icon={<List />}
          />
          <StatCard
            label="Доходы"
            value={money(totals.income)}
            tone="income"
            icon={<ArrowUpRight />}
          />
          <StatCard
            label="Расходы"
            value={money(totals.expense)}
            tone="expense"
            icon={<ArrowDownRight />}
          />
        </div>
      </section>
      <section className="surface operations-card">
        <div className="section-heading">
          <div>
            <h2>{monthLabel(selectedMonth)}</h2>
            <p>Откройте операцию, чтобы изменить данные</p>
          </div>
          <button className="primary-button" onClick={add}>
            <Plus size={18} /> Добавить
          </button>
        </div>
        <div className="operations-list full">
          {items.length ? (
            items.map((item) => (
              <OperationRow
                data={data}
                item={item}
                onClick={() => edit(item)}
                key={item.id}
              />
            ))
          ) : (
            <div className="empty">
              <Search />
              <strong>Ничего не найдено</strong>
              <span>Измените фильтры или добавьте операцию</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Analytics({
  data,
  selectedMonth,
  edit,
}: {
  data: AppData;
  selectedMonth: string;
  edit: (item: Transaction) => void;
}) {
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>(6);
  const stats = statsFor(data, selectedMonth);
  const previous = statsFor(data, prevMonth(selectedMonth));
  const net = stats.income - stats.expense;
  const savingsRate = stats.income ? (net / stats.income) * 100 : 0;
  const expenses = data.transactions.filter(
    (item) =>
      item.date.startsWith(selectedMonth) &&
      item.type === "expense" &&
      item.fromCurrency === "RUB",
  );
  const daily = [...new Map(expenses.map((item) => [item.date, 0])).keys()]
    .sort()
    .map((date) => ({
      date: dateLabel(date),
      value: expenses
        .filter((item) => item.date === date)
        .reduce((sum, item) => sum + item.fromAmount, 0),
    }));
  const weekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map(
    (day, index) => ({
      day,
      value: expenses
        .filter((item) => new Date(`${item.date}T12:00:00`).getDay() === index)
        .reduce((sum, item) => sum + item.fromAmount, 0),
    }),
  );
  const incomeCategories = categoryStats(data, selectedMonth, "income");
  const expenseCategories = categoryStats(data, selectedMonth);
  const top = expenseCategories[0];
  const largest = [...expenses]
    .sort((a, b) => b.fromAmount - a.fromAmount)
    .slice(0, 5);
  const change = previous.expense
    ? ((stats.expense - previous.expense) / previous.expense) * 100
    : 0;
  const cashflowPeriodTitle =
    cashflowPeriods.find((item) => item.value === cashflowPeriod)?.title ||
    "6 месяцев";
  return (
    <div className="analytics-page">
      <div className="analytics-kpis">
        <StatCard
          label="Доходы"
          value={money(stats.income)}
          tone="income"
          icon={<ArrowUpRight />}
        />
        <StatCard
          label="Расходы"
          value={money(stats.expense)}
          tone="expense"
          icon={<ArrowDownRight />}
        />
        <StatCard
          label="Результат"
          value={money(net)}
          tone={net >= 0 ? "income" : "expense"}
          icon={<CircleDollarSign />}
        />
        <StatCard
          label="Норма сбережений"
          value={`${savingsRate.toFixed(0)}%`}
          tone="blue"
          icon={<Target />}
        />
      </div>
      <section className="surface analytics-wide">
        <div className="section-heading">
          <div>
            <h2>Динамика денежных потоков</h2>
            <p>Полная картина за {cashflowPeriodTitle}</p>
          </div>
          <div className="chart-heading-tools">
            <CashflowPeriodControl
              value={cashflowPeriod}
              onChange={setCashflowPeriod}
            />
            <div className="legend">
              <span className="income">Доходы</span>
              <span className="expense">Расходы</span>
            </div>
          </div>
        </div>
        <CashflowChart
          data={data}
          selectedMonth={selectedMonth}
          period={cashflowPeriod}
        />
      </section>
      <section className="surface">
        <div className="section-heading">
          <div>
            <h2>Расходы по дням</h2>
            <p>Когда траты были максимальными</p>
          </div>
        </div>
        <div className="small-chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 500, height: 210 }}
          >
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="1" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,.1)" />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => money(Number(value))}
              />
              <Area
                dataKey="value"
                name="Расходы"
                type="monotone"
                stroke="#60a5fa"
                strokeWidth={3}
                fill="url(#dailyFill)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="surface">
        <div className="section-heading">
          <div>
            <h2>Расходы по дням недели</h2>
            <p>Поведенческий ритм месяца</p>
          </div>
        </div>
        <div className="small-chart">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
            initialDimension={{ width: 500, height: 210 }}
          >
            <BarChart data={weekdays}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8490a5" }}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => money(Number(value))}
                cursor={{ fill: "rgba(139, 92, 246, 0.16)" }}
              />
              <Bar
                dataKey="value"
                name="Расходы"
                fill="#8b5cf6"
                radius={[8, 8, 8, 8]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="surface analytics-structure">
        <div className="section-heading">
          <div>
            <h2>Категории расходов</h2>
            <p>{monthLabel(selectedMonth)}</p>
          </div>
        </div>
        <Donut data={data} selectedMonth={selectedMonth} />
      </section>
      <section className="surface insights-card">
        <div className="section-heading">
          <div>
            <h2>Финансовые наблюдения</h2>
            <p>Расчёт на основе ваших операций</p>
          </div>
          <Sparkles size={21} />
        </div>
        <div className="insights">
          <article>
            <Target />
            <div>
              <strong>
                {savingsRate >= 20
                  ? "Здоровый запас"
                  : "Запас требует внимания"}
              </strong>
              <span>
                Норма сбережений {savingsRate.toFixed(0)}%. Ориентир 20% полезен
                как отправная точка, но зависит от ваших целей.
              </span>
            </div>
          </article>
          <article>
            <BarChart3 />
            <div>
              <strong>
                Расходы {change > 0 ? "выросли" : "снизились"} на{" "}
                {Math.abs(change).toFixed(0)}%
              </strong>
              <span>
                Сравнение с {monthLabel(prevMonth(selectedMonth)).toLowerCase()}
                .
              </span>
            </div>
          </article>
          <article>
            <Sparkles />
            <div>
              <strong>
                {top
                  ? `Главная категория — ${top.name}`
                  : "Недостаточно данных"}
              </strong>
              <span>
                {top
                  ? `${money(top.value)} · ${stats.expense ? Math.round((top.value / stats.expense) * 100) : 0}% всех расходов.`
                  : "Добавьте операции, чтобы получить наблюдения."}
              </span>
            </div>
          </article>
          <article>
            <CircleDollarSign />
            <div>
              <strong>
                Средняя покупка —{" "}
                {money(expenses.length ? stats.expense / expenses.length : 0)}
              </strong>
              <span>На основе {expenses.length} расходных операций.</span>
            </div>
          </article>
        </div>
      </section>
      <section className="surface top-expenses">
        <div className="section-heading">
          <div>
            <h2>Крупнейшие расходы</h2>
            <p>Операции, сильнее всего повлиявшие на месяц</p>
          </div>
        </div>
        <div className="operations-list">
          {largest.map((item) => (
            <OperationRow
              key={item.id}
              data={data}
              item={item}
              onClick={() => edit(item)}
            />
          ))}
        </div>
      </section>
      <section className="surface income-sources">
        <div className="section-heading">
          <div>
            <h2>Источники дохода</h2>
            <p>Распределение поступлений</p>
          </div>
        </div>
        <div className="rank-list">
          {incomeCategories.length ? (
            incomeCategories.map((item) => (
              <div key={item.id}>
                <i style={{ background: item.color }} />
                <span>{item.name}</span>
                <b>{money(item.value)}</b>
              </div>
            ))
          ) : (
            <span className="muted">Доходов в этом месяце нет</span>
          )}
        </div>
      </section>
    </div>
  );
}

function Assistant({
  data,
  selectedMonth,
}: {
  data: AppData;
  selectedMonth: string;
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Я вижу ваши счета, категории, бюджеты и операции. Спросите, куда уходят деньги, что изменилось за месяц или где есть запас для цели.",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(
    () => end.current?.scrollIntoView({ behavior: "smooth" }),
    [messages, loading],
  );
  const ask = async (text = question) => {
    if (!text.trim() || loading) return;
    setMessages((items) => [...items, { role: "user", text }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, selectedMonth, data }),
      });
      const payload = await response.json();
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: response.ok ? payload.answer : payload.error,
        },
      ]);
    } catch {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: "Не удалось связаться с GPT. Проверьте, что приложение запущено через npm run dev и API-ключ добавлен в .env.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const suggestions = [
    "На что я потратил больше всего?",
    "Сравни этот месяц с предыдущим",
    "Где можно сократить расходы?",
    "Составь краткий финансовый отчёт",
  ];
  return (
    <section className="assistant-page">
      <div className="assistant-info">
        <span>
          <Bot size={25} />
        </span>
        <div>
          <h2>Финансовый помощник</h2>
          <p>
            GPT получает полный набор локальных данных только в момент вашего
            вопроса. Ключ API хранится на сервере, а не в браузере.
          </p>
        </div>
        <i>GPT</i>
      </div>
      <div className="chat-suggestions">
        {suggestions.map((item) => (
          <button key={item} onClick={() => ask(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="chat-window">
        {messages.map((message, index) => (
          <div
            className={`chat-message ${message.role}`}
            key={`${message.role}-${index}`}
          >
            <span>
              {message.role === "assistant" ? (
                <Sparkles size={17} />
              ) : (
                <UserRound size={17} />
              )}
            </span>
            <p>{message.text}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <span>
              <LoaderCircle className="spin" size={17} />
            </span>
            <p>Анализирую операции…</p>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: почему расходы выросли и что на это повлияло?"
          rows={2}
        />
        <button disabled={loading || !question.trim()}>
          <Send size={19} />
        </button>
      </form>
      <p className="assistant-footnote">
        <ShieldCheck size={14} /> Финансовые ответы носят информационный
        характер.
      </p>
    </section>
  );
}

function Budgets({
  data,
  selectedMonth,
}: {
  data: AppData;
  selectedMonth: string;
}) {
  const spent = new Map(
    categoryStats(data, selectedMonth).map((item) => [item.id, item.value]),
  );
  return (
    <div className="budget-grid">
      {data.budgets.map((budget) => {
        const category = categoryOf(data, budget.categoryId);
        const value = spent.get(budget.categoryId) || 0;
        const ratio = budget.limit ? (value / budget.limit) * 100 : 0;
        return (
          <section className="surface budget-card" key={budget.id}>
            <div>
              <span
                className="category-badge large"
                style={{ "--category": category.color } as React.CSSProperties}
              >
                <CategoryGlyph name={category.icon} />
              </span>
              <span>
                <strong>{category.name}</strong>
                <small>{monthLabel(selectedMonth)}</small>
              </span>
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
    </div>
  );
}

function AccountEditor({
  data,
  onClose,
  onSave,
}: {
  data: AppData;
  onClose: () => void;
  onSave: (account: Account) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("card");
  const [currency, setCurrency] = useState("RUB");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState(accountColors[0]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(true);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const normalizedName = name.trim();
    const normalizedBalance = Number(balance.replace(",", "."));
    if (!normalizedName) {
      setError("Введите название счёта");
      return;
    }
    if (
      data.accounts.some(
        (item) =>
          item.name.trim().toLocaleLowerCase("ru") ===
          normalizedName.toLocaleLowerCase("ru"),
      )
    ) {
      setError("Счёт с таким названием уже существует");
      return;
    }
    if (!Number.isFinite(normalizedBalance)) {
      setError("Введите корректный начальный баланс");
      return;
    }
    setSaving(true);
    const saved = await onSave({
      id: `account-${crypto.randomUUID()}`,
      name: normalizedName,
      currency,
      type,
      color,
      openingBalance: normalizedBalance,
      currentBalance: normalizedBalance,
    });
    if (!saved) {
      setError("Не удалось сохранить счёт. Проверьте подключение и повторите.");
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="management-modal account-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-account-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <h2 id="new-account-title">Новый счёт</h2>
            <p>Название, валюта и начальный остаток</p>
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
            placeholder="Например, Накопительный"
          />
        </label>
        <div className="management-field">
          <span>Тип счёта</span>
          <div className="segmented two-options">
            {(
              [
                ["card", "Банковский счёт"],
                ["cash", "Наличные"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={type === value ? "active" : ""}
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="management-field">
          <span>Валюта</span>
          <Select
            label="Валюта"
            value={currency}
            onChange={setCurrency}
            options={accountCurrencies.map((value) => ({
              value,
              label: value,
            }))}
          />
        </div>
        <label className="management-field">
          <span>Начальный баланс</span>
          <div className="amount-field account-opening-balance">
            <input
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              aria-label="Начальный баланс"
            />
            <b>{currencyMark(currency)}</b>
          </div>
        </label>
        <div className="management-field">
          <span>Цвет</span>
          <div className="color-picker">
            {accountColors.map((value) => (
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
        </div>
        <p className="management-error" role="alert">
          {error}
        </p>
        <button className="management-submit" type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : "Добавить счёт"}
        </button>
      </form>
    </div>
  );
}

function Accounts({
  data,
  selectedMonth,
  onEditBalance,
  onChange,
}: {
  data: AppData;
  selectedMonth: string;
  onEditBalance: (account: Account) => void;
  onChange: (data: AppData) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const monthItems = data.transactions.filter((item) =>
    item.date.startsWith(selectedMonth),
  );
  const saveAccount = async (account: Account) => {
    const next = structuredClone(data);
    next.accounts.push(account);
    const saved = await onChange(next);
    if (!saved) return false;
    setCreating(false);
    setNotice(`Счёт «${account.name}» добавлен`);
    return true;
  };
  const removeAccount = async (account: Account) => {
    if (data.accounts.length <= 1) {
      setNotice("Последний счёт удалить нельзя");
      return;
    }
    const related = data.transactions.filter(
      (item) =>
        (item.fromAccount === account.name &&
          item.fromCurrency === account.currency) ||
        (item.toAccount === account.name &&
          item.toCurrency === account.currency),
    ).length;
    if (related) {
      setNotice(
        `Счёт «${account.name}» связан с ${related} операциями. Сначала перенесите или удалите эти операции.`,
      );
      return;
    }
    if (!confirm(`Удалить пустой счёт «${account.name}»?`)) return;
    const next = structuredClone(data);
    next.accounts = next.accounts.filter((item) => item.id !== account.id);
    const saved = await onChange(next);
    if (!saved) {
      setNotice("Не удалось удалить счёт. Проверьте подключение и повторите.");
      return;
    }
    setNotice(`Счёт «${account.name}» удалён`);
  };
  return (
    <div className="page-stack">
      <section className="surface management-hero">
        <div>
          <span className="management-hero-icon">
            <WalletCards />
          </span>
          <div>
            <h2>Ваши счета</h2>
            <p>Управляйте наличными, картами и валютными счетами</p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> Счёт
        </button>
      </section>
      {notice && (
        <p className="account-management-notice" role="status">
          {notice}
          <button
            aria-label="Закрыть уведомление"
            onClick={() => setNotice("")}
          >
            <X />
          </button>
        </p>
      )}
      <div className="accounts-grid">
        {data.accounts.map((account) => {
          const income = monthItems
            .filter(
              (item) =>
                item.toAccount === account.name &&
                item.toCurrency === account.currency,
            )
            .reduce((sum, item) => sum + item.toAmount, 0);
          const expense = monthItems
            .filter(
              (item) =>
                item.fromAccount === account.name &&
                item.fromCurrency === account.currency,
            )
            .reduce((sum, item) => sum + item.fromAmount, 0);
          const balance = accountBalance(data, account.name);
          return (
            <section
              className="account-card"
              style={{ "--account": account.color } as React.CSSProperties}
              key={account.id}
            >
              <header>
                <span>
                  <Landmark />
                </span>
                <div className="account-card-header-actions">
                  <i>Активен</i>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Удалить счёт ${account.name}`}
                    title={
                      data.accounts.length <= 1
                        ? "Последний счёт удалить нельзя"
                        : "Удалить счёт"
                    }
                    disabled={data.accounts.length <= 1}
                    onClick={() => void removeAccount(account)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </header>
              <p>
                {account.name}
                <small>
                  {account.type === "cash" ? "Наличные" : "Банковский счёт"} ·{" "}
                  {account.currency}
                </small>
              </p>
              <div className="account-balance-row">
                <strong>{money(balance, account.currency, 2)}</strong>
                <button
                  aria-label={`Изменить баланс ${account.name}`}
                  onClick={() => onEditBalance(account)}
                >
                  <Pencil />
                </button>
              </div>
              <footer>
                <span className="income">
                  +{money(income, account.currency)}
                </span>
                <span className="expense">
                  −{money(expense, account.currency)}
                </span>
              </footer>
            </section>
          );
        })}
      </div>
      {creating && (
        <AccountEditor
          data={data}
          onClose={() => setCreating(false)}
          onSave={saveAccount}
        />
      )}
    </div>
  );
}

function BalanceEditor({
  account,
  onClose,
  onSave,
}: {
  account: Account;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(
    String(account.currentBalance ?? account.openingBalance ?? 0),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(value.replace(",", "."));
    if (!Number.isFinite(amount)) return;
    onSave(amount);
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="management-modal balance-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-editor-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <h2 id="balance-editor-title">Изменить баланс</h2>
            <p>
              {account.name} · {account.currency}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </header>
        <label className="management-field">
          <span>Текущий остаток</span>
          <div className="amount-field balance-amount-field">
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-label="Текущий остаток"
            />
            <b>{account.currency === "RUB" ? "₽" : account.currency}</b>
          </div>
        </label>
        <p className="balance-editor-note">
          Значение станет новым фактическим балансом счёта. Следующие операции
          будут изменять его автоматически.
        </p>
        <button className="management-submit" type="submit">
          Сохранить баланс
        </button>
      </form>
    </div>
  );
}

function SettingsPage({
  data,
  onData,
  onLogout,
}: {
  data: AppData;
  onData: (value: AppData) => void | Promise<void>;
  onLogout: () => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `kapital-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="settings-grid">
      <section className="surface settings-section">
        <h2>Данные и резервные копии</h2>
        <button onClick={exportData}>
          <span>
            <Download />
            <i>
              <strong>Экспорт данных</strong>
              <small>Операции, счета, категории и бюджеты в JSON</small>
            </i>
          </span>
          <ArrowRight />
        </button>
        <button onClick={() => importRef.current?.click()}>
          <span>
            <FileUp />
            <i>
              <strong>Импорт резервной копии</strong>
              <small>Заменить данные на всех устройствах из JSON-файла</small>
            </i>
          </span>
          <ArrowRight />
        </button>
        <button onClick={() => csvImportRef.current?.click()}>
          <span>
            <FileUp />
            <i>
              <strong>Импорт операций из Zen CSV</strong>
              <small>Заменить операции актуальным экспортом Zen</small>
            </i>
          </span>
          <ArrowRight />
        </button>
        <button
          onClick={async () => {
            if (confirm("Вернуть исходные данные?"))
              await onData(await resetData(data.profile.name));
          }}
        >
          <span>
            <Trash2 />
            <i>
              <strong>Восстановить исходные данные</strong>
              <small>Добавленные операции будут удалены</small>
            </i>
          </span>
          <ArrowRight />
        </button>
        <input
          ref={importRef}
          hidden
          type="file"
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (
              !confirm(
                "Заменить облачные операции, счета, категории и бюджеты данными из выбранного файла?",
              )
            ) {
              event.target.value = "";
              return;
            }
            const value = JSON.parse(await file.text()) as AppData;
            await onData(value);
            event.target.value = "";
          }}
        />
        <input
          ref={csvImportRef}
          hidden
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const imported = importZenCsv(await file.text(), file.name);
              if (
                confirm(
                  `Импортировать ${imported.transactions.length} операций из ${file.name}? Текущие операции будут заменены.`,
                )
              )
                await onData({
                  ...imported,
                  budgets: data.budgets,
                  profile: data.profile,
                });
            } catch (error) {
              alert(
                error instanceof Error
                  ? error.message
                  : "Не удалось импортировать CSV",
              );
            } finally {
              event.target.value = "";
            }
          }}
        />
      </section>
      <section className="surface profile-card">
        <div className="profile-avatar">M</div>
        <h2>{data.profile.name}</h2>
        <p>Личный профиль</p>
        <div>
          <span>
            <strong>{data.transactions.length}</strong>
            <small>операций</small>
          </span>
          <span>
            <strong>{data.categories.length}</strong>
            <small>категорий</small>
          </span>
        </div>
      </section>
      <section className="surface settings-section">
        <h2>Безопасность</h2>
        <button onClick={onLogout}>
          <span>
            <LogOut />
            <i>
              <strong>Завершить сессию</strong>
              <small>При следующем запуске потребуется пароль</small>
            </i>
          </span>
          <ArrowRight />
        </button>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [loadError, setLoadError] = useState("");
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [monthOpen, setMonthOpen] = useState(false);
  const [transaction, setTransaction] = useState<
    Transaction | null | undefined
  >(undefined);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [balanceAccount, setBalanceAccount] = useState<Account | undefined>();
  useBodyScrollLock(
    transaction !== undefined || globalSearch || Boolean(balanceAccount),
  );
  useEffect(() => {
    return observeAuth((currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setData(null);
        setSelectedMonth("");
      }
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    setLoadError("");
    setSyncState("syncing");
    connectData(
      user.uid,
      user.displayName || user.email?.split("@")[0] || "Пользователь",
      (value) => {
        if (cancelled) return;
        setData(value);
        setSelectedMonth((current) =>
          current
            ? current
            : [...value.transactions.map((item) => item.date.slice(0, 7))]
                .sort()
                .at(-1) || new Date().toISOString().slice(0, 7),
        );
      },
      setSyncState,
      (error) => setLoadError(dataErrorMessage(error)),
    )
      .then((dispose) => {
        if (cancelled) dispose();
        else unsubscribe = dispose;
      })
      .catch((error: unknown) => {
        setSyncState("error");
        setLoadError(dataErrorMessage(error));
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);
  useEffect(() => {
    const syncRoute = () => {
      const value = location.hash.slice(1) as Route;
      if ([...routes.map((item) => item.id), "settings"].includes(value))
        setRoute(value);
    };
    addEventListener("hashchange", syncRoute);
    return () => removeEventListener("hashchange", syncRoute);
  }, []);
  const navigate = (value: Route) => {
    setRoute(value);
    location.hash = value;
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!authReady)
    return (
      <div className="app-loading">
        <LoaderCircle className="spin" />
        <span>Проверяем сессию</span>
      </div>
    );
  if (!user) return <Login />;
  if (loadError && !data)
    return (
      <div className="app-loading load-error">
        <CloudOff />
        <strong>Не удалось подключиться к облаку</strong>
        <span>{loadError}</span>
        <button onClick={() => location.reload()}>Повторить</button>
      </div>
    );
  if (!data || !selectedMonth)
    return (
      <div className="app-loading">
        <LoaderCircle className="spin" />
        <span>Загружаем финансы</span>
      </div>
    );
  const persistData = (value: AppData, previous: AppData = data) => {
    setSyncState("syncing");
    const pendingWrite = writeData(user.uid, value, previous);
    setData(value);
    return pendingWrite
      .then(() => true)
      .catch((error: unknown) => {
        setSyncState("error");
        setLoadError(dataErrorMessage(error));
        setData(previous);
        return false;
      });
  };
  const saveTransaction = (item: Transaction) => {
    const next = structuredClone(data);
    const index = next.transactions.findIndex(
      (current) => current.id === item.id,
    );
    if (index >= 0) {
      adjustCurrentBalances(next, next.transactions[index], -1);
      next.transactions[index] = item;
    } else next.transactions.push(item);
    adjustCurrentBalances(next, item, 1);
    persistData(next);
    setSelectedMonth(item.date.slice(0, 7));
    setTransaction(undefined);
  };
  const deleteTransaction = (id: string) => {
    if (!confirm("Удалить операцию?")) return;
    const next = structuredClone(data);
    const existing = next.transactions.find((item) => item.id === id);
    if (existing) adjustCurrentBalances(next, existing, -1);
    next.transactions = next.transactions.filter((item) => item.id !== id);
    persistData(next);
    setTransaction(undefined);
  };
  const months = [
    ...new Set(data.transactions.map((item) => item.date.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const title = {
    overview: "Обзор",
    transactions: "Операции",
    budgets: "Бюджеты",
    categories: "Категории",
    analytics: "Аналитика",
    accounts: "Счета",
    settings: "Настройки",
  }[route];
  const bottomRoutes = routes.filter((item) =>
    ["overview", "transactions", "analytics", "accounts"].includes(item.id),
  );
  const saveData = (value: AppData) => {
    void persistData(value);
  };
  return (
    <div className="app">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <button className="brand" onClick={() => navigate("overview")}>
          <span>К</span>
          <i>
            <strong>Капитал</strong>
            <small>личные финансы</small>
          </i>
        </button>
        <nav>
          {routes.map((item) => (
            <button
              key={item.id}
              className={route === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`local-status ${syncState}`}>
            {syncState === "offline" || syncState === "error" ? (
              <CloudOff />
            ) : (
              <Cloud />
            )}
            <span>
              <strong>
                {syncState === "synced"
                  ? "Данные синхронизированы"
                  : syncState === "syncing"
                    ? "Синхронизация…"
                    : syncState === "offline"
                      ? "Офлайн-режим"
                      : "Ошибка синхронизации"}
              </strong>
              <small>{user.email}</small>
            </span>
            <i />
          </div>
          <button
            className={route === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings size={20} />
            <span>Настройки</span>
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <button className="mobile-menu" onClick={() => setMobileMenu(true)}>
              <Menu />
            </button>
            <div className="period-wrap">
              <button
                className="period-trigger"
                onClick={() => setMonthOpen(!monthOpen)}
              >
                {monthLabel(selectedMonth)}
                <ChevronDown size={15} />
              </button>
              {monthOpen && (
                <div className="month-menu">
                  {months.map((month) => (
                    <button
                      key={month}
                      className={month === selectedMonth ? "active" : ""}
                      onClick={() => {
                        setSelectedMonth(month);
                        setMonthOpen(false);
                      }}
                    >
                      {monthLabel(month)}
                      {month === selectedMonth && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
              <h1>{title}</h1>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Поиск по операциям"
              onClick={() => setGlobalSearch(true)}
            >
              <Search />
            </button>
            <button
              className="primary-button"
              onClick={() => setTransaction(null)}
            >
              <Plus /> Операция
            </button>
          </div>
        </header>
        <div className="content">
          {route === "overview" && (
            <Overview
              data={data}
              selectedMonth={selectedMonth}
              edit={setTransaction}
              add={() => setTransaction(null)}
            />
          )}{" "}
          {route === "transactions" && (
            <Transactions
              data={data}
              selectedMonth={selectedMonth}
              edit={setTransaction}
              add={() => setTransaction(null)}
            />
          )}{" "}
          {route === "analytics" && (
            <Analytics
              data={data}
              selectedMonth={selectedMonth}
              edit={setTransaction}
            />
          )}{" "}
          {/* Страница GPT временно отключена для пользователей. */}
          {route === "budgets" && (
            <BudgetsPage
              data={data}
              selectedMonth={selectedMonth}
              onChange={saveData}
            />
          )}{" "}
          {route === "categories" && (
            <CategoriesPage data={data} onChange={saveData} />
          )}{" "}
          {route === "accounts" && (
            <Accounts
              data={data}
              selectedMonth={selectedMonth}
              onEditBalance={setBalanceAccount}
              onChange={persistData}
            />
          )}{" "}
          {route === "settings" && (
            <SettingsPage
              data={data}
              onData={(value) => {
                const saving = saveData(value);
                setSelectedMonth(
                  [...value.transactions.map((item) => item.date.slice(0, 7))]
                    .sort()
                    .at(-1) || selectedMonth,
                );
                return saving;
              }}
              onLogout={() => void firebaseLogout()}
            />
          )}
        </div>
      </main>
      <nav className="bottom-nav">
        {bottomRoutes.slice(0, 2).map((item) => (
          <button
            key={item.id}
            className={route === item.id ? "active" : ""}
            onClick={() => navigate(item.id)}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="bottom-add" onClick={() => setTransaction(null)}>
          <Plus />
        </button>
        {bottomRoutes.slice(2, 4).map((item) => (
          <button
            key={item.id}
            className={route === item.id ? "active" : ""}
            onClick={() => navigate(item.id)}
          >
            <item.icon />
            <span>{item.label.replace("GPT-", "GPT ")}</span>
          </button>
        ))}
      </nav>
      {transaction !== undefined && (
        <TransactionModal
          data={data}
          transaction={transaction}
          onClose={() => setTransaction(undefined)}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
        />
      )}
      {globalSearch && (
        <GlobalSearch
          data={data}
          onClose={() => setGlobalSearch(false)}
          onPick={(item) => {
            setGlobalSearch(false);
            setSelectedMonth(item.date.slice(0, 7));
            setTransaction(item);
          }}
        />
      )}
      {balanceAccount && (
        <BalanceEditor
          account={balanceAccount}
          onClose={() => setBalanceAccount(undefined)}
          onSave={(value) => {
            const next = structuredClone(data);
            const account = next.accounts.find(
              (item) => item.id === balanceAccount.id,
            );
            if (account) account.currentBalance = value;
            persistData(next);
            setBalanceAccount(undefined);
          }}
        />
      )}
    </div>
  );
}
