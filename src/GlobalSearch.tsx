import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { AppData, Transaction } from "./types";
import {
  amountOf,
  categoryOf,
  currencyOf,
  dateLabel,
  money,
  titleOf,
} from "./format";
import { CategoryGlyph } from "./icons";

export function GlobalSearch({
  data,
  onClose,
  onPick,
}: {
  data: AppData;
  onClose: () => void;
  onPick: (transaction: Transaction) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return [...data.transactions]
      .filter((item) =>
        [
          item.payee,
          item.comment,
          item.categoryName,
          item.fromAccount,
          item.toAccount,
          item.location,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalized),
        ),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [data, query]);
  return (
    <div
      className="modal-backdrop global-search-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по операциям"
      >
        <header>
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Категория, комментарий, счёт или место"
          />
          <button aria-label="Закрыть поиск" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="global-search-results">
          {query.trim() &&
            results.map((item) => {
              const category = categoryOf(data, item.categoryId);
              return (
                <button key={item.id} onClick={() => onPick(item)}>
                  <span
                    className="category-badge"
                    style={
                      { "--category": category.color } as React.CSSProperties
                    }
                  >
                    <CategoryGlyph
                      name={item.type === "transfer" ? "arrows" : category.icon}
                    />
                  </span>
                  <span>
                    <strong>{titleOf(item)}</strong>
                    <small>
                      {category.name} · {dateLabel(item.date, true)}
                    </small>
                  </span>
                  <b className={item.type}>
                    {item.type === "income"
                      ? "+"
                      : item.type === "expense"
                        ? "−"
                        : ""}
                    {money(amountOf(item), currencyOf(item))}
                  </b>
                </button>
              );
            })}
          {query.trim() && !results.length && (
            <div className="search-empty">
              <Search />
              <strong>Ничего не найдено</strong>
              <span>Попробуйте категорию, комментарий или название счёта</span>
            </div>
          )}
          {!query.trim() && (
            <div className="search-empty">
              <Search />
              <strong>Поиск по всей истории</strong>
              <span>Введите несколько букв — результаты появятся сразу</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
