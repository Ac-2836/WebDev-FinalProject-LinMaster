// Text rules for typed answers (completion, short answer, diagram labels), shared by grading and the import validator.

const EDGE_PUNCTUATION = /^[\s.,;:!?"'()[\]]+|[\s.,;:!?"'()[\]]+$/gu;
const LEADING_ARTICLE = /^(?:a|an|the)\s+/u;
const NUMBER_TOKEN = /^[£$€]?\d+(?:[.,:/]\d+)*(?:st|nd|rd|th|%|am|pm)?$/u;

/**
 * Canonical form of a typed answer: same Unicode form, straight quotes and hyphens, lower case,
 * thousands separators dropped (`1,000` → `1000`), no leading currency sign (`£1500` = `1500`),
 * single spaces and no punctuation at the ends.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’`]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[‐‑‒–—]/gu, '-')
    .toLowerCase()
    .replace(/(\d),(?=\d{3}(?!\d))/gu, '$1')
    .replace(/\s+/gu, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .replace(/^[£$€]\s?/u, '');
}

/** An answer counts the same with or without a leading article ("the library" = "library"). */
export function withoutLeadingArticle(normalized: string): string {
  return normalized.replace(LEADING_ARTICLE, '');
}

/**
 * Words counted against "NO MORE THAN N WORDS". A hyphenated word is one word; numbers are not counted,
 * because IELTS limits are written as "N WORDS AND/OR A NUMBER".
 */
export function countWords(normalized: string): number {
  if (!normalized) return 0;
  return normalized.split(' ').filter(token => !NUMBER_TOKEN.test(token)).length;
}

/** Expands optional words in brackets: `(the) public library` → `the public library`, `public library`. */
export function expandOptionalWords(answer: string): string[] {
  const match = /\(([^()]+)\)/u.exec(answer);
  if (!match) return [answer];
  const before = answer.slice(0, match.index);
  const after = answer.slice(match.index + match[0].length);
  return [...expandOptionalWords(before + match[1] + after), ...expandOptionalWords(before + after)];
}

// A `/` separates spellings only between two words of 3+ letters, so `km/h`, `m/s`, `and/or`, `24/7` stay whole.
const WORD_BEFORE_SLASH = /\p{L}{3,}$/u;
const WORD_AFTER_SLASH = /^\p{L}{3,}/u;

function splitOnSlash(cell: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const slash of cell.matchAll(/\s*\/\s*/gu)) {
    const end = slash.index + slash[0].length;
    if (WORD_BEFORE_SLASH.test(cell.slice(start, slash.index)) && WORD_AFTER_SLASH.test(cell.slice(end))) {
      parts.push(cell.slice(start, slash.index));
      start = end;
    }
  }
  parts.push(cell.slice(start));
  return parts;
}

/**
 * Splits one answer key cell into its accepted spellings, separated by an upper-case ` OR ` or by `/`
 * between two words (`color/colour`, PLAN F).
 */
export function splitAnswerKey(cell: string): string[] {
  return cell
    .split(/\s+OR\s+/u)
    .flatMap(splitOnSlash)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/** True when the given text matches one accepted answer and stays within the word limit. */
export function matchesAcceptedText(given: string | null, accepted: readonly string[], wordLimit?: number | null) {
  if (given === null) return false;
  const answer = normalizeText(given);
  if (!answer) return false;
  if (wordLimit && countWords(answer) > wordLimit) return false;
  const target = withoutLeadingArticle(answer);
  return accepted.some(key =>
    expandOptionalWords(key).some(variant => withoutLeadingArticle(normalizeText(variant)) === target),
  );
}
