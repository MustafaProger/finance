import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
export function Select({
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
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="select-trigger"
        aria-label={label}
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
