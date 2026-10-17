import { createContext, useContext } from "react";
import catalogue from "./locales.json";
import type { Preferences } from "../../../packages/core/index";

export const LanguageContext = createContext<Preferences["language"]>("en");
const translations: Record<string, { de: string; vi: string }> = catalogue;
export function translate(
  language: Preferences["language"],
  text: string,
  ...values: unknown[]
) {
  const template =
    language === "en" ? text : (translations[text]?.[language] ?? text);
  return template.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : placeholder,
  );
}
export function useText() {
  const language = useContext(LanguageContext);
  return (text: string, ...values: unknown[]) =>
    translate(language, text, ...values);
}
export function useLocale() {
  return { en: "en-GB", de: "de-DE", vi: "vi-VN" }[useContext(LanguageContext)];
}
