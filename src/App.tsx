import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
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
  categoryStatsForRange,
  compactMoney,
  compareTransactionsNewest,
  currencyOf,
  dateLabel,
  money,
  monthKeys,
  monthLabel,
  statsFor,
  statsForRange,
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
import { SavingsPage } from "./Savings";
import {
  syncSavingsAdjustmentEdit,
  undoSavingsAdjustment,
} from "./savingsLogic";
import { importZenCsv } from "./csvImport";

const routes: { id: Route; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Обзор", icon: WalletCards },
  { id: "transactions", label: "Операции", icon: List },
  { id: "budgets", label: "Бюджеты", icon: Target },
  { id: "savings", label: "Накопления", icon: CircleDollarSign },
  { id: "categories", label: "Категории", icon: Tag },
  // Временно отключено для пользователей:
  // { id: "assistant", label: "GPT-анализ", icon: Sparkles },
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
type DateRange = { from: string; to: string };
type TransactionFilters = {
  query: string;
  type: string;
  categoryId: string;
  accountId: string;
};
type FontScale = number;

const defaultTransactionFilters: TransactionFilters = {
  query: "",
  type: "all",
  categoryId: "all",
  accountId: "all",
};

const fontScaleMin = 80;
const fontScaleMax = 150;
const fontScaleStep = 10;
const fontScaleStorageKey = "kapital-font-scale-v1";
const filtersExpandedStorageKey = "kapital-filters-expanded-v1";
const amountOperators = [
  { value: "+", label: "Прибавить" },
  { value: "−", label: "Вычесть" },
  { value: "×", label: "Умножить" },
  { value: "÷", label: "Разделить" },
] as const;

function savedFontScale(): FontScale {
  try {
    const saved = Number(localStorage.getItem(fontScaleStorageKey));
    return saved >= fontScaleMin &&
      saved <= fontScaleMax &&
      saved % fontScaleStep === 0
      ? saved
      : 100;
  } catch {
    return 100;
  }
}

function savedFiltersExpanded() {
  try {
    const saved = localStorage.getItem(filtersExpandedStorageKey);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function calculateAmount(expression: string) {
  const source = expression
    .replace(/,/g, ".")
    .replace(/[−–—]/g, "-")
    .replace(/[×хХ]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  if (!source || !/^[\d.+\-*/()]+$/.test(source)) return null;

  let position = 0;
  const number = () => {
    const match = source.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error("number");
    position += match[0].length;
    return Number(match[0]);
  };
  const primary = (): number => {
    if (source[position] === "+" || source[position] === "-") {
      const sign = source[position++];
      const value = primary();
      return sign === "-" ? -value : value;
    }
    if (source[position] === "(") {
      position += 1;
      const value = expressionValue();
      if (source[position] !== ")") throw new Error("parenthesis");
      position += 1;
      return value;
    }
    return number();
  };
  const product = () => {
    let value = primary();
    while (source[position] === "*" || source[position] === "/") {
      const operator = source[position++];
      const next = primary();
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  };
  const expressionValue = () => {
    let value = product();
    while (source[position] === "+" || source[position] === "-") {
      const operator = source[position++];
      const next = product();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  };

  try {
    const value = expressionValue();
    if (position !== source.length || !Number.isFinite(value)) return null;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  } catch {
    return null;
  }
}

function amountExpressionHasOperator(value: string) {
  return /[+*/×÷хХ]/.test(value) || /[−–—-]/.test(value.slice(1));
}

function operationsLabel(count: number) {
  const remainder100 = count % 100;
  const remainder10 = count % 10;
  const word =
    remainder100 >= 11 && remainder100 <= 14
      ? "операций"
      : remainder10 === 1
        ? "операция"
        : remainder10 >= 2 && remainder10 <= 4
          ? "операции"
          : "операций";
  return `${count} ${word}`;
}

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

function shiftMonth(value: string, step: number) {
  const [year, month] = value.split("-").map(Number);
  const next = new Date(year, month - 1 + step, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateRange(month: string): DateRange {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  const today = todayDate();
  return {
    from: `${month}-01`,
    to: month === today.slice(0, 7) ? today : monthEnd,
  };
}

function dateFromUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function todayDate() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = dateFromUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function dateRangeDays(range: DateRange) {
  return (
    Math.round(
      (dateFromUtc(range.to).getTime() - dateFromUtc(range.from).getTime()) /
        86_400_000,
    ) + 1
  );
}

function dateRangeLabel(range: DateRange) {
  if (range.from && !range.to)
    return `${dateLabel(range.from, true)} — без конечной даты`;
  if (!range.from && range.to) return `До ${dateLabel(range.to, true)}`;
  if (!range.from && !range.to) return "За всё время";
  if (range.from === range.to) return dateLabel(range.from, true);
  return `${dateLabel(range.from, true)} — ${dateLabel(range.to, true)}`;
}

function filterTransactions(
  data: AppData,
  range: DateRange,
  filters: TransactionFilters,
) {
  const selectedAccount = data.accounts.find(
    (item) => item.id === filters.accountId,
  );
  const query = filters.query.trim().toLowerCase();
  return data.transactions
    .filter(
      (item) =>
        (!range.from || item.date >= range.from) &&
        (!range.to || item.date <= range.to),
    )
    .filter(
      (item) =>
        !selectedAccount ||
        (item.fromAccount === selectedAccount.name &&
          item.fromCurrency === selectedAccount.currency) ||
        (item.toAccount === selectedAccount.name &&
          item.toCurrency === selectedAccount.currency),
    )
    .filter((item) => filters.type === "all" || item.type === filters.type)
    .filter(
      (item) =>
        filters.categoryId === "all" || item.categoryId === filters.categoryId,
    )
    .filter(
      (item) =>
        !query ||
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
            .includes(query),
        ),
    );
}

function rangeChartData(data: AppData, range: DateRange) {
  const firstMonth = range.from.slice(0, 7);
  const lastMonth = range.to.slice(0, 7);
  if (firstMonth === lastMonth) {
    return Array.from({ length: dateRangeDays(range) }, (_, index) => {
      const date = addDays(range.from, index);
      return {
        month: String(Number(date.slice(-2))),
        ...statsForRange(data, date, date),
      };
    });
  }

  const result = [];
  let cursor = firstMonth;
  while (cursor <= lastMonth) {
    const monthRange = monthDateRange(cursor);
    const from = monthRange.from < range.from ? range.from : monthRange.from;
    const to = monthRange.to > range.to ? range.to : monthRange.to;
    result.push({
      month: monthLabel(cursor, true).replace(".", ""),
      ...statsForRange(data, from, to),
    });
    cursor = shiftMonth(cursor, 1);
  }
  return result;
}

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

function DateRangeFields({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  return (
    <div className="date-range-control" role="group" aria-label="Период данных">
      <div className="date-range-field">
        <span>Начало периода</span>
        <div>
          <CalendarDays aria-hidden="true" />
          <input
            type="date"
            aria-label="Начало периода"
            value={value.from}
            max={value.to || todayDate()}
            onInput={(event) =>
              onChange({ ...value, from: event.currentTarget.value })
            }
          />
          {value.from && (
            <button
              type="button"
              aria-label="Очистить начало периода"
              onClick={() => onChange({ ...value, from: "" })}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="date-range-field">
        <span>Конец периода</span>
        <div>
          <CalendarDays aria-hidden="true" />
          <input
            type="date"
            aria-label="Конец периода"
            value={value.to}
            min={value.from || undefined}
            onInput={(event) =>
              onChange({ ...value, to: event.currentTarget.value })
            }
          />
          {value.to && (
            <button
              type="button"
              aria-label="Очистить конец периода"
              onClick={() => onChange({ ...value, to: "" })}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
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
  dateRange,
}: {
  data: AppData;
  selectedMonth: string;
  compact?: boolean;
  period?: CashflowPeriod;
  dateRange?: DateRange;
}) {
  const chartData = useMemo(
    () =>
      dateRange
        ? rangeChartData(data, dateRange)
        : period === 1
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
            })),
    [data, dateRange, period, selectedMonth],
  );
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
  dateRange,
}: {
  data: AppData;
  selectedMonth: string;
  dateRange?: DateRange;
}) {
  const categories = dateRange
    ? categoryStatsForRange(data, dateRange.from, dateRange.to)
    : categoryStats(data, selectedMonth);
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
                innerRadius="75%"
                outerRadius="92%"
                paddingAngle={visibleCategories.length ? 2 : 0}
                cornerRadius={14}
                stroke="none"
                isAnimationActive
                animationBegin={0}
                animationDuration={700}
                animationEasing="ease-in-out"
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
      <div
        className="category-breakdown"
        style={
          {
            "--category-columns": Math.max(1, Math.ceil(categories.length / 3)),
          } as React.CSSProperties
        }
      >
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
  const latestAccount = [...data.transactions]
    .filter((item) => item.type === initialType)
    .sort(compareTransactionsNewest)[0]?.fromAccount;
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(
    String(transaction ? amountOf(transaction) : ""),
  );
  const [amountError, setAmountError] = useState(false);
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ||
      data.categories.find((item) => item.type !== "income")?.id ||
      "",
  );
  const [fromAccount, setFromAccount] = useState(
    transaction?.fromAccount ||
      (data.accounts.some((item) => item.name === latestAccount)
        ? latestAccount
        : data.accounts[0]?.name) ||
      "",
  );
  const [toAccount, setToAccount] = useState(
    transaction?.toAccount || data.accounts[0]?.name || "",
  );
  const [date, setDate] = useState(
    transaction?.date || new Date().toISOString().slice(0, 10),
  );
  const [comment, setComment] = useState(transaction?.comment || "");
  const [destinationAmount, setDestinationAmount] = useState(
    transaction?.type === "transfer" ? String(transaction.toAmount) : "",
  );
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
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
  const calculatedAmount = useMemo(() => calculateAmount(amount), [amount]);
  const hasAmountExpression = amountExpressionHasOperator(amount);
  const showAmountCalculation =
    calculatedAmount !== null && hasAmountExpression;
  const applyAmountCalculation = () => {
    if (calculatedAmount === null) {
      setAmountError(true);
      return;
    }
    setAmount(String(calculatedAmount));
    setAmountError(false);
  };
  const appendAmountOperator = (operator: string) => {
    setAmount((current) => {
      const value = current.trimEnd();
      if (!value) return operator === "−" ? "−" : value;
      if (/[+−×÷*/-]$/.test(value)) return `${value.slice(0, -1)}${operator} `;
      return `${value} ${operator} `;
    });
    setAmountError(false);
  };
  const save = () => {
    const value = calculatedAmount;
    if (!value || value <= 0) {
      setAmountError(true);
      return;
    }
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
      tags: transaction?.tags,
      location: transaction?.location,
      repeat: transaction?.repeat,
    });
  };
  const pickCategory = (id: string) => {
    setCategoryId(id);
    setPickedCategoryId(id);
    window.setTimeout(() => {
      setCategoryPickerOpen(false);
      setPickedCategoryId("");
    }, 180);
  };
  const selectedCategory = categoryOf(data, categoryId);
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
        <div
          className={`amount-entry ${type} ${hasAmountExpression ? "has-expression" : ""}`}
        >
          <span>{type === "expense" ? "−" : type === "income" ? "+" : ""}</span>
          <input
            autoFocus
            inputMode="decimal"
            type="text"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "=") {
                event.preventDefault();
                applyAmountCalculation();
              }
            }}
            placeholder="0"
            aria-label="Сумма или математическое выражение"
            aria-invalid={amountError}
            aria-describedby="amount-calculation-status"
          />
          <b>{currencyMark(sourceAccount?.currency || "RUB")}</b>
        </div>
        <div className="amount-calculator">
          <div
            id="amount-calculation-status"
            className={`amount-calculation-status ${amountError ? "is-error" : ""}`}
            aria-live="polite"
          >
            {amountError
              ? "Проверьте выражение: результат должен быть больше нуля"
              : showAmountCalculation
                ? `Результат: ${money(calculatedAmount, sourceAccount?.currency || "RUB")}`
                : "Можно считать прямо здесь, например 1200 + 350 × 2"}
          </div>
          <div
            className="amount-operator-buttons"
            role="group"
            aria-label="Математические действия"
          >
            {amountOperators.map((operator) => (
              <button
                type="button"
                key={operator.value}
                aria-label={operator.label}
                onClick={() => appendAmountOperator(operator.value)}
              >
                {operator.value}
              </button>
            ))}
            <button
              type="button"
              className="amount-equals"
              onClick={applyAmountCalculation}
              disabled={calculatedAmount === null}
              aria-label="Вычислить результат"
            >
              =
            </button>
          </div>
        </div>
        {type !== "transfer" && (
          <div className="category-picker">
            <span className="field-caption">Категория</span>
            <button
              type="button"
              className="category-picker-trigger"
              aria-haspopup="dialog"
              onClick={() => setCategoryPickerOpen(true)}
            >
              <i
                style={
                  {
                    "--category": selectedCategory.color,
                  } as React.CSSProperties
                }
              >
                <CategoryGlyph name={selectedCategory.icon} />
              </i>
              <span>
                <strong>{selectedCategory.name}</strong>
                <small>Нажмите, чтобы открыть все категории</small>
              </span>
              <span className="category-picker-action">
                Все категории <MoreHorizontal size={18} />
              </span>
            </button>
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
            <MessageCircle size={20} />
            <span>Комментарий</span>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
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
      {categoryPickerOpen && (
        <div
          className="category-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setCategoryPickerOpen(false);
          }}
        >
          <section
            className="category-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-dialog-title"
          >
            <header>
              <div>
                <h2 id="category-dialog-title">Все категории</h2>
                <p>Выберите категорию операции</p>
              </div>
              <button
                type="button"
                className="sheet-icon"
                aria-label="Закрыть категории"
                onClick={() => setCategoryPickerOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="category-dialog-grid">
              {categories.map((category) => (
                <button
                  type="button"
                  className={`${category.id === categoryId ? "active" : ""} ${pickedCategoryId === category.id ? "picked" : ""}`}
                  aria-pressed={category.id === categoryId}
                  key={category.id}
                  onClick={() => pickCategory(category.id)}
                >
                  <i
                    style={
                      { "--category": category.color } as React.CSSProperties
                    }
                  >
                    <CategoryGlyph name={category.icon} />
                  </i>
                  <span>{category.name}</span>
                  <Check size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Overview({
  data,
  selectedMonth,
  onEditBalance,
  onViewTransactions,
  onChange,
}: {
  data: AppData;
  selectedMonth: string;
  onEditBalance: (account: Account) => void;
  onViewTransactions: (account: Account) => void;
  onChange: (data: AppData) => Promise<boolean>;
}) {
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>(6);
  const cashflowPeriodTitle =
    cashflowPeriods.find((item) => item.value === cashflowPeriod)?.title ||
    "6 месяцев";
  return (
    <div className="dashboard-grid">
      <OverviewAccounts
        data={data}
        selectedMonth={selectedMonth}
        onEditBalance={onEditBalance}
        onViewTransactions={onViewTransactions}
        onChange={onChange}
      />
      <section className="surface structure-card">
        <div className="section-heading">
          <div>
            <h2>Категории расходов</h2>
            <p>{monthLabel(selectedMonth)}</p>
          </div>
        </div>
        <Donut data={data} selectedMonth={selectedMonth} />
      </section>
      <section className="surface cashflow-card">
        <div className="section-heading">
          <div>
            <h2>Денежный поток</h2>
            <p>Доходы и расходы за {cashflowPeriodTitle}</p>
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
          compact
        />
      </section>
    </div>
  );
}

function Transactions({
  data,
  dateRange,
  onDateRangeChange,
  filters,
  onFiltersChange,
  edit,
  add,
  filtersExpanded,
  onFiltersExpandedChange,
  mode = "full",
}: {
  data: AppData;
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  filters: TransactionFilters;
  onFiltersChange: (value: TransactionFilters) => void;
  edit: (item: Transaction) => void;
  add: () => void;
  filtersExpanded: boolean;
  onFiltersExpandedChange: (value: boolean) => void;
  mode?: "full" | "filters" | "list";
}) {
  const [filtersExpansionSettled, setFiltersExpansionSettled] =
    useState(filtersExpanded);
  const selectedAccount = data.accounts.find(
    (item) => item.id === filters.accountId,
  );
  const items = useMemo(
    () =>
      filterTransactions(data, dateRange, filters).sort(
        compareTransactionsNewest,
      ),
    [data, dateRange, filters],
  );
  const monthlyGroups = useMemo(() => {
    const byMonth = new Map<
      string,
      {
        month: string;
        income: number;
        expense: number;
        count: number;
        dates: Map<string, Transaction[]>;
      }
    >();
    items.forEach((item) => {
      const month = item.date.slice(0, 7);
      const monthGroup = byMonth.get(month) || {
        month,
        income: 0,
        expense: 0,
        count: 0,
        dates: new Map<string, Transaction[]>(),
      };
      if (item.type === "income" && item.toCurrency === "RUB")
        monthGroup.income += Number(item.toAmount || 0);
      if (item.type === "expense" && item.fromCurrency === "RUB")
        monthGroup.expense += Number(item.fromAmount || 0);
      monthGroup.count += 1;
      const dateGroup = monthGroup.dates.get(item.date) || [];
      dateGroup.push(item);
      monthGroup.dates.set(item.date, dateGroup);
      byMonth.set(month, monthGroup);
    });
    return [...byMonth.values()].map((group) => ({
      ...group,
      dates: [...group.dates.entries()],
    }));
  }, [items]);
  return (
    <div className="page-stack">
      {mode !== "list" && (
        <section
          className={[
            "surface filters-card",
            filtersExpanded ? "is-expanded" : "",
            filtersExpansionSettled ? "is-expansion-settled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="filter-card-heading">
            <div>
              <h2>Период и фильтры</h2>
              <p>{dateRangeLabel(dateRange)}</p>
            </div>
            <div className="filter-card-actions">
              <button
                type="button"
                className="filter-toggle"
                aria-expanded={filtersExpanded}
                aria-controls="transaction-filters"
                onClick={() => {
                  setFiltersExpansionSettled(false);
                  onFiltersExpandedChange(!filtersExpanded);
                }}
              >
                <Filter size={16} />
                <span>{filtersExpanded ? "Скрыть" : "Фильтры"}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            id="transaction-filters"
            className="filter-card-collapse"
            aria-hidden={!filtersExpanded}
            onTransitionEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.propertyName === "grid-template-rows" &&
                filtersExpanded
              ) {
                setFiltersExpansionSettled(true);
              }
            }}
          >
            <div className="filter-card-collapse-inner">
              <div className="filter-fields is-compact">
                <div className="filter-toolbar">
                  <DateRangeFields
                    value={dateRange}
                    onChange={onDateRangeChange}
                  />
                </div>
                <div className="filter-selects">
                  <Select
                    label="Все категории"
                    value={filters.categoryId}
                    onChange={(categoryId) =>
                      onFiltersChange({ ...filters, categoryId })
                    }
                    options={[
                      { value: "all", label: "Все категории" },
                      ...data.categories
                        .filter((item) => item.type !== "income")
                        .map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                    ]}
                  />
                  <Select
                    label="Все счета"
                    value={filters.accountId}
                    onChange={(accountId) =>
                      onFiltersChange({ ...filters, accountId })
                    }
                    options={[
                      { value: "all", label: "Все счета и карты" },
                      ...data.accounts.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.currency}`,
                      })),
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      {mode !== "filters" && (
        <section className="surface operations-card">
          <div className="section-heading">
            <div>
              <h2>Операции за период</h2>
              <p>
                {selectedAccount
                  ? `${selectedAccount.name} · ${selectedAccount.currency}`
                  : dateRangeLabel(dateRange)}
              </p>
            </div>
            <button className="primary-button" onClick={add}>
              <Plus size={18} /> Добавить
            </button>
          </div>
          <div className="operations-list full">
            {items.length ? (
              monthlyGroups.map((monthGroup) => (
                <section
                  className="operation-month-group"
                  data-month={monthGroup.month}
                  key={monthGroup.month}
                >
                  <header
                    className="operation-month-summary"
                    aria-label={`Сводка за ${monthLabel(monthGroup.month)}`}
                  >
                    <div className="operation-month-title">
                      <span>Месяц</span>
                      <h3>{monthLabel(monthGroup.month)}</h3>
                      <small>{operationsLabel(monthGroup.count)}</small>
                    </div>
                    <div className="operation-month-metric expense">
                      <span>Потратили</span>
                      <strong>{money(monthGroup.expense)}</strong>
                    </div>
                    <div className="operation-month-metric income">
                      <span>Получили</span>
                      <strong>{money(monthGroup.income)}</strong>
                    </div>
                  </header>
                  <div className="operation-month-dates">
                    {monthGroup.dates.map(([date, dateItems]) => (
                      <section className="operation-date-group" key={date}>
                        <header>
                          <strong>{dateLabel(date, true)}</strong>
                          <span>{dateItems.length} оп.</span>
                        </header>
                        {dateItems.map((item) => (
                          <OperationRow
                            data={data}
                            item={item}
                            onClick={() => edit(item)}
                            key={item.id}
                          />
                        ))}
                      </section>
                    ))}
                  </div>
                </section>
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
      )}
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

function OverviewAccounts({
  data,
  selectedMonth,
  onEditBalance,
  onViewTransactions,
  onChange,
}: {
  data: AppData;
  selectedMonth: string;
  onEditBalance: (account: Account) => void;
  onViewTransactions: (account: Account) => void;
  onChange: (data: AppData) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [openAccountActions, setOpenAccountActions] = useState<string | null>(
    null,
  );
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
    <>
      <section className="surface overview-accounts">
        <div className="section-heading overview-accounts-heading">
          <div>
            <h2>Счета</h2>
            <p>Балансы и движения · {monthLabel(selectedMonth)}</p>
          </div>
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus /> Добавить счёт
          </button>
        </div>
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
        <div className="overview-account-rail" role="list">
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
              <article
                className="overview-account-card"
                style={{ "--account": account.color } as React.CSSProperties}
                role="listitem"
                key={account.id}
              >
                <header>
                  <span className="overview-account-icon">
                    {account.type === "cash" ? <WalletCards /> : <Landmark />}
                  </span>
                  <div className="overview-account-actions">
                    <button
                      type="button"
                      aria-label={`Изменить баланс ${account.name}`}
                      title="Изменить баланс"
                      onClick={() => onEditBalance(account)}
                    >
                      <Pencil />
                    </button>
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
                  <button
                    type="button"
                    className="overview-account-menu-trigger"
                    aria-label={`Действия со счётом ${account.name}`}
                    aria-expanded={openAccountActions === account.id}
                    aria-controls={`account-actions-${account.id}`}
                    onClick={() =>
                      setOpenAccountActions((current) =>
                        current === account.id ? null : account.id,
                      )
                    }
                  >
                    <MoreHorizontal />
                  </button>
                </header>
                <div className="overview-account-copy">
                  <strong>{account.name}</strong>
                  <span>
                    {account.type === "cash" ? "Наличные" : "Банковский счёт"}
                    {" · "}
                    {account.currency}
                  </span>
                </div>
                <b className="overview-account-balance">
                  {money(balance, account.currency, 2)}
                </b>
                <footer>
                  <span className="income">
                    +{money(income, account.currency)}
                  </span>
                  <span className="expense">
                    −{money(expense, account.currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Показать операции счёта ${account.name}`}
                    onClick={() => onViewTransactions(account)}
                  >
                    <List />
                  </button>
                </footer>
                {openAccountActions === account.id && (
                  <div
                    className="overview-account-mobile-actions"
                    id={`account-actions-${account.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenAccountActions(null);
                        onEditBalance(account);
                      }}
                    >
                      <Pencil />
                      Баланс
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenAccountActions(null);
                        onViewTransactions(account);
                      }}
                    >
                      <List />
                      Операции
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={data.accounts.length <= 1}
                      onClick={() => {
                        setOpenAccountActions(null);
                        void removeAccount(account);
                      }}
                    >
                      <Trash2 />
                      Удалить
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      {creating && (
        <AccountEditor
          data={data}
          onClose={() => setCreating(false)}
          onSave={saveAccount}
        />
      )}
    </>
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
  fontScale,
  onFontScaleChange,
}: {
  data: AppData;
  onData: (value: AppData) => void | Promise<void>;
  onLogout: () => void;
  fontScale: FontScale;
  onFontScaleChange: (value: FontScale) => void;
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
      <section className="surface settings-section appearance-settings">
        <h2>Внешний вид</h2>
        <div className="font-scale-setting">
          <div>
            <strong>Масштаб текста</strong>
            <small>
              Меняйте размер шагами по 10%. Настройка сохранится в этом
              браузере.
            </small>
          </div>
          <div
            className="font-scale-control"
            role="group"
            aria-label="Масштаб текста"
          >
            <button
              type="button"
              aria-label="Уменьшить масштаб текста"
              disabled={fontScale <= fontScaleMin}
              onClick={() =>
                onFontScaleChange(
                  Math.max(fontScaleMin, fontScale - fontScaleStep),
                )
              }
            >
              −
            </button>
            <output aria-live="polite">{fontScale}%</output>
            <button
              type="button"
              aria-label="Увеличить масштаб текста"
              disabled={fontScale >= fontScaleMax}
              onClick={() =>
                onFontScaleChange(
                  Math.min(fontScaleMax, fontScale + fontScaleStep),
                )
              }
            >
              +
            </button>
          </div>
        </div>
      </section>
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
  const [dateRange, setDateRange] = useState<{
    route: Route;
    value: DateRange;
  } | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>(savedFontScale);
  const [filtersExpanded, setFiltersExpanded] = useState(savedFiltersExpanded);
  const [transaction, setTransaction] = useState<
    Transaction | null | undefined
  >(undefined);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [balanceAccount, setBalanceAccount] = useState<Account | undefined>();
  const [transactionFilters, setTransactionFilters] =
    useState<TransactionFilters>(defaultTransactionFilters);
  useBodyScrollLock(
    transaction !== undefined || globalSearch || Boolean(balanceAccount),
  );
  useEffect(() => {
    document.documentElement.dataset.fontScale = String(fontScale);
    document.documentElement.style.setProperty(
      "--font-adjust",
      `${((fontScale - 100) / fontScaleStep) * 1.15}px`,
    );
    try {
      localStorage.setItem(fontScaleStorageKey, String(fontScale));
    } catch {
      // The setting still applies for this session when storage is restricted.
    }
  }, [fontScale]);
  useEffect(() => {
    try {
      localStorage.setItem(filtersExpandedStorageKey, String(filtersExpanded));
    } catch {
      // The setting still applies for this session when storage is restricted.
    }
  }, [filtersExpanded]);
  useEffect(() => {
    setDateRange(null);
  }, [route]);
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
      const requested = location.hash.slice(1) as Route;
      const value = [...routes.map((item) => item.id), "settings"].includes(
        requested,
      )
        ? requested
        : "overview";
      setRoute(value);
      if (value !== requested) history.replaceState(null, "", `#${value}`);
    };
    syncRoute();
    addEventListener("hashchange", syncRoute);
    return () => removeEventListener("hashchange", syncRoute);
  }, []);
  const navigate = (value: Route) => {
    setDateRange(null);
    setRoute(value);
    location.hash = value;
    setMobileMenu(false);
    setMonthOpen(false);
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
      const existing = next.transactions[index];
      adjustCurrentBalances(next, existing, -1);
      const syncedItem = syncSavingsAdjustmentEdit(next, existing, item);
      if (!syncedItem) return;
      next.transactions[index] = syncedItem;
      item = syncedItem;
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
    if (existing) {
      adjustCurrentBalances(next, existing, -1);
      undoSavingsAdjustment(next, existing);
    }
    next.transactions = next.transactions.filter((item) => item.id !== id);
    persistData(next);
    setTransaction(undefined);
  };
  const months = [
    ...new Set(data.transactions.map((item) => item.date.slice(0, 7))),
  ]
    .sort()
    .reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);
  const title = {
    overview: "Обзор",
    transactions: "Операции",
    budgets: "Бюджеты",
    savings: "Накопления",
    categories: "Категории",
    settings: "Настройки",
  }[route];
  const bottomRoutes = routes.filter((item) =>
    ["overview", "transactions", "budgets", "savings"].includes(item.id),
  );
  const saveData = (value: AppData) => {
    void persistData(value);
  };
  const effectiveDateRange =
    dateRange?.route === route
      ? dateRange.value
      : route === "transactions"
        ? { from: "", to: "" }
        : monthDateRange(selectedMonth);
  const changeDateRange = (value: DateRange) => {
    setDateRange({ route, value });
  };
  const showMonthPeriod = route === "overview" || route === "budgets";
  return (
    <div className="app">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <button className="brand" onClick={() => navigate("overview")}>
          <span>
            <img src="/icons/app-icon.svg" alt="" />
          </span>
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
              {showMonthPeriod && (
                <div className="period-control">
                  <button
                    type="button"
                    className="period-step"
                    aria-label="Предыдущий месяц"
                    onClick={() =>
                      setSelectedMonth(shiftMonth(selectedMonth, -1))
                    }
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="period-trigger"
                    aria-expanded={monthOpen}
                    onClick={() => setMonthOpen(!monthOpen)}
                  >
                    <CalendarDays />
                    {monthLabel(selectedMonth)}
                    <ChevronDown />
                  </button>
                  <button
                    type="button"
                    className="period-step"
                    aria-label="Следующий месяц"
                    onClick={() =>
                      setSelectedMonth(shiftMonth(selectedMonth, 1))
                    }
                  >
                    <ChevronRight />
                  </button>
                </div>
              )}
              {showMonthPeriod && monthOpen && (
                <div className="month-menu">
                  <label className="month-picker-field">
                    <span>Выбрать месяц</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onInput={(event) => {
                        if (!event.currentTarget.value) return;
                        setSelectedMonth(event.currentTarget.value);
                        setMonthOpen(false);
                      }}
                    />
                  </label>
                  <div className="month-menu-caption">Месяцы с операциями</div>
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
              onEditBalance={setBalanceAccount}
              onViewTransactions={(account) => {
                setTransactionFilters((current) => ({
                  ...current,
                  accountId: account.id,
                }));
                navigate("transactions");
              }}
              onChange={persistData}
            />
          )}{" "}
          {route === "transactions" && (
            <Transactions
              data={data}
              dateRange={effectiveDateRange}
              onDateRangeChange={changeDateRange}
              filters={transactionFilters}
              onFiltersChange={setTransactionFilters}
              edit={setTransaction}
              add={() => setTransaction(null)}
              filtersExpanded={filtersExpanded}
              onFiltersExpandedChange={setFiltersExpanded}
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
          {route === "savings" && (
            <SavingsPage data={data} onChange={saveData} />
          )}{" "}
          {route === "categories" && (
            <CategoriesPage data={data} onChange={saveData} />
          )}{" "}
          {route === "settings" && (
            <SettingsPage
              data={data}
              fontScale={fontScale}
              onFontScaleChange={setFontScale}
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
