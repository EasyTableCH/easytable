import { LoginForm } from "../../forms/login/Login"
import { useTranslation } from "../../i18n"
import WelcomeImage from "../../assets/pos_logo_welcome.webp"

export interface LoginProps {
  onSuccess?: () => void
}

export function Login({ onSuccess }: LoginProps) {
  const { t } = useTranslation("ui")

  return (
    <div className="grid min-h-svh lg:grid-cols-2 w-full">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            {t("login.brand")}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm onSuccess={onSuccess} />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src={WelcomeImage}
          alt={t("login.heroAlt")}
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

export default Login
