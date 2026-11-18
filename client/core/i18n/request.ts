import {cookies} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';

import {defaultLocale, isLocale, LOCALE_COOKIE} from './config';

// No locale in the URL: the language comes from a cookie, so links are the same in vi and en.
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  // The server (Vercel) runs in UTC; without this every date and time is shown 7 hours off for users in Vietnam.
  return {locale, timeZone: 'Asia/Ho_Chi_Minh', messages: (await import(`../../messages/${locale}.json`)).default};
});
