import {pageTitle} from '@/core/i18n/page-title';
import {Suspense} from 'react';

import {LibraryPage} from '@/features/library';

export const generateMetadata = pageTitle('library');

export default function Library() {
  // useSearchParams needs a Suspense boundary for the static shell.
  return (
    <Suspense>
      <LibraryPage />
    </Suspense>
  );
}
