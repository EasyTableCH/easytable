import { DeleteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@easytable/ui/lib/utils";

type TouchNumberPadProps = {
  valueInRappen: number;
  onChangeValueInRappen: (value: number) => void;
  label?: string;
  currencyLabel?: string;
  maxDigits?: number;
  disabled?: boolean;
  className?: string;
};

const keypadItems = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

export function TouchNumberPad({
  valueInRappen,
  onChangeValueInRappen,
  label,
  currencyLabel = "CHF Eingabe",
  maxDigits = 6,
  disabled = false,
  className,
}: TouchNumberPadProps) {
  const [inputText, setInputText] = useState(() =>
    valueToInputText(valueInRappen),
  );
  const lastEmittedValue = useRef(valueInRappen);

  useEffect(() => {
    if (valueInRappen === lastEmittedValue.current) {
      return;
    }

    setInputText(valueToInputText(valueInRappen));
    lastEmittedValue.current = valueInRappen;
  }, [valueInRappen]);

  function applyInput(nextInput: string) {
    const nextValue = inputTextToRappen(nextInput);

    setInputText(nextInput);
    lastEmittedValue.current = nextValue;
    onChangeValueInRappen(nextValue);
  }

  function handleKeyPress(key: string) {
    if (disabled) {
      return;
    }

    if (key === ".") {
      if (inputText.includes(".")) {
        return;
      }

      applyInput(inputText.length === 0 ? "0." : `${inputText}.`);
      return;
    }

    const [wholePart = "", fractionPart = ""] = inputText.split(".");

    if (inputText.includes(".")) {
      if (fractionPart.length >= 2) {
        return;
      }

      applyInput(`${wholePart}.${fractionPart}${key}`);
      return;
    }

    const nextWholePart = inputText === "0" ? key : `${inputText}${key}`;

    if (nextWholePart.length > maxDigits) {
      return;
    }

    applyInput(nextWholePart);
  }

  function handleBackspace() {
    if (disabled || inputText.length === 0) {
      return;
    }

    applyInput(inputText.slice(0, -1));
  }

  return (
    <section className={cn("w-full", className)}>
      <div className="mb-8 rounded-md bg-white px-6 py-7 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100">
        {label ? (
          <p className="mb-3 text-xs font-black uppercase text-slate-400">
            {label}
          </p>
        ) : null}
        <div className="flex min-h-12 items-end justify-between gap-4">
          <p className="text-5xl font-black leading-none text-slate-950">
            {displayInputText(inputText)}
          </p>
          <p className="pb-1 text-xs font-black uppercase tracking-[0.35em] text-slate-300">
            {currencyLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {keypadItems.map((key) => (
          <button
            key={key}
            className="flex h-20 items-center justify-center rounded-md bg-white text-3xl font-black text-slate-950 shadow-md shadow-slate-200/70 ring-1 ring-slate-200 transition active:scale-[0.985] active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={disabled}
            onClick={() => handleKeyPress(key)}
          >
            {key}
          </button>
        ))}
        <button
          className="flex h-20 items-center justify-center rounded-md bg-white text-slate-400 shadow-md shadow-slate-200/70 ring-1 ring-slate-200 transition active:scale-[0.985] active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          aria-label="Letzte Ziffer entfernen"
          disabled={disabled}
          onClick={handleBackspace}
        >
          <DeleteIcon className="size-7" />
        </button>
      </div>
    </section>
  );
}

function valueToInputText(valueInRappen: number) {
  if (valueInRappen <= 0) {
    return "";
  }

  return (valueInRappen / 100).toFixed(2);
}

function inputTextToRappen(inputText: string) {
  if (inputText.length === 0 || inputText === ".") {
    return 0;
  }

  const [rawWholePart = "0", rawFractionPart = ""] = inputText.split(".");
  const wholePart = Number.parseInt(rawWholePart, 10) || 0;
  const fractionPart = Number.parseInt(rawFractionPart.padEnd(2, "0"), 10) || 0;

  return wholePart * 100 + fractionPart;
}

function displayInputText(inputText: string) {
  if (inputText.length === 0) {
    return "0.00";
  }

  return inputText;
}
