import type * as React from "react"

import { cn } from "@easytable/ui/lib/utils"
import { useTranslation } from "@easytable/ui/i18n"
import { Button } from "../../components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/field"
import { Input } from "../../components/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { t } = useTranslation("ui")

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("login.form.title")}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t("login.form.description")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("login.form.emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("login.form.emailPlaceholder")}
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">
              {t("login.form.passwordLabel")}
            </FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              {t("login.form.forgotPassword")}
            </a>
          </div>
          <Input id="password" type="password" required />
        </Field>
        <Field>
          <Button type="submit">{t("login.form.submit")}</Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            {t("login.form.signUpPrompt")}{" "}
            <a href="#" className="underline underline-offset-4">
              {t("login.form.signUp")}
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
