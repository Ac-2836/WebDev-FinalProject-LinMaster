import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';

import type vi from '../../messages/vi.json';

export type PageTitleKey = keyof (typeof vi)['core']['meta']['titles'];

/**
 * `generateMetadata` of a page: its own `<title>` in the interface language (QA T3), shown as "Title · LinMaster"
 * by the template of the root layout. Use: `export const generateMetadata = pageTitle('vocab');`
 */
export function pageTitle(key: PageTitleKey) {
  return async (): Promise<Metadata> => ({title: (await getTranslations('core.meta.titles'))(key)});
}
