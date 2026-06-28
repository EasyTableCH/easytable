export const defaultLanguage = "en";

export const resources = {
  en: {
    ui: {
      login: {
        brand: "easyTable",
        heroAlt: "Restaurant table service",
        form: {
          title: "Login to your account",
          description: "Enter your email below to login to your account",
          emailLabel: "Email",
          emailPlaceholder: "m@example.com",
          passwordLabel: "Password",
          forgotPassword: "Forgot your password?",
          submit: "Login",
          github: "Login with GitHub",
          signUpPrompt: "Don't have an account?",
          signUp: "Sign up",
        },
      },
    },
  },
  de: {
    ui: {
      login: {
        brand: "easyTable",
        heroAlt: "Restaurant-Tischservice",
        form: {
          title: "Bei deinem Konto anmelden",
          description: "Gib unten deine E-Mail-Adresse ein, um dich anzumelden",
          emailLabel: "E-Mail",
          emailPlaceholder: "m@example.com",
          passwordLabel: "Passwort",
          forgotPassword: "Passwort vergessen?",
          submit: "Anmelden",
          github: "Mit GitHub anmelden",
          signUpPrompt: "Du hast noch kein Konto?",
          signUp: "Registrieren",
        },
      },
    },
  },
} as const;

export type EasyTableResources = typeof resources;
export type EasyTableLanguage = keyof EasyTableResources;
