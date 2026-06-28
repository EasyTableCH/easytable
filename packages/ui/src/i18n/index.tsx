import type { PropsWithChildren } from "react";
import i18n, { type i18n as I18nInstance, type Resource } from "i18next";
import {
  I18nextProvider,
  initReactI18next,
  Trans,
  useTranslation,
} from "react-i18next";

import { defaultLanguage, resources } from "./resources";

type InitEasyTableI18nOptions = {
  lng?: string;
  resources?: Resource;
  defaultNS?: string;
};

function getBrowserLanguage() {
  if (typeof navigator === "undefined") {
    return defaultLanguage;
  }

  return navigator.language || defaultLanguage;
}

export function initEasyTableI18n({
  lng = getBrowserLanguage(),
  resources: additionalResources,
  defaultNS = "ui",
}: InitEasyTableI18nOptions = {}): I18nInstance {
  if (i18n.isInitialized) {
    if (additionalResources) {
      addEasyTableResources(additionalResources);
    }

    if (lng && i18n.language !== lng) {
      void i18n.changeLanguage(lng);
    }

    return i18n;
  }

  void i18n.use(initReactI18next).init({
    resources: {
      ...resources,
      ...additionalResources,
    },
    lng,
    fallbackLng: defaultLanguage,
    supportedLngs: Object.keys(resources),
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  return i18n;
}

export function addEasyTableResources(additionalResources: Resource) {
  for (const [language, namespaces] of Object.entries(additionalResources)) {
    for (const [namespace, resource] of Object.entries(namespaces)) {
      i18n.addResourceBundle(language, namespace, resource, true, true);
    }
  }
}

export function setEasyTableLanguage(language: string) {
  return i18n.changeLanguage(language);
}

export function I18nProvider({
  children,
  lng,
  resources,
}: PropsWithChildren<InitEasyTableI18nOptions>) {
  const instance = initEasyTableI18n({ lng, resources });

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

initEasyTableI18n();

export { i18n, Trans, useTranslation };
export type { Resource };
