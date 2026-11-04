export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';
// Same cookie name next-intl uses. P1 also saves the choice to the user profile (PLAN C0).
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}
