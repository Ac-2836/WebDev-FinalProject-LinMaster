import {Suspense} from 'react';

import {LibraryPage} from '@/features/library';

export default function Library() {
  // useSearchParams needs a Suspense boundary for the static shell.
  return (
    <Suspense>
      <LibraryPage />
    </Suspense>
  );
}
