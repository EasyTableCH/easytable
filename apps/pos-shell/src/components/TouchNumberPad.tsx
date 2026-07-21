import { DeleteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@easytable/ui/components/button";
import { Card, CardContent } from "@easytable/ui/components/card";
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
      <Card className="mb-4 gap-0 py-0 shadow-sm">
        <CardContent className="p-5">
          {label ? (
            <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
          ) : null}
          <div className="flex min-h-12 items-end justify-between gap-4">
            <p className="min-w-0 truncate text-4xl font-semibold leading-none tabular-nums text-foreground">
              {displayInputText(inputText)}
            </p>
            <p className="shrink-0 pb-0.5 text-xs font-medium text-muted-foreground">
              {currencyLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        {keypadItems.map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-16 bg-background text-2xl font-semibold tabular-nums shadow-sm active:scale-[0.975] active:bg-muted"
            type="button"
            disabled={disabled}
            aria-label={key === "." ? "Dezimaltrennzeichen" : key}
            onClick={() => handleKeyPress(key)}
          >
            {key}
          </Button>
        ))}
        <Button
          variant="secondary"
          className="h-16 text-muted-foreground shadow-sm active:scale-[0.975]"
          type="button"
          aria-label="Letzte Ziffer entfernen"
          disabled={disabled}
          onClick={handleBackspace}
        >
          <DeleteIcon className="size-6" />
        </Button>
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
