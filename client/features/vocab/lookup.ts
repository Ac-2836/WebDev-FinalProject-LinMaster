import {LookupWordResponseSchema, type LookupWordRequest} from '@linmaster/shared';

import {api} from '@/core/api/client';

/** `POST /vocab/lookups` (C2): explains the selected text in its sentence. */
export async function lookupWord(input: LookupWordRequest) {
  return LookupWordResponseSchema.parse(await api('/vocab/lookups', {method: 'POST', body: input}));
}
