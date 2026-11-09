import {useTranslations} from 'next-intl';

import {ApiError} from './client';
import {errorKey} from './error-key';

/** Turns any thrown error into a translated sentence (`core.errors.<key>`), e.g. for `toast.error(...)`. */
export function useErrorMessage() {
  const t = useTranslations('core.errors');
  return (error: unknown) => t(error instanceof ApiError ? errorKey(error.status, error.httpStatus) : 'UNKNOWN');
}
