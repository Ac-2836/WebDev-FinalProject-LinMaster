/**
 * Text for a Prisma `contains` filter that matches the characters as typed: `%` and `_` are LIKE wildcards and `\\` is
 * its escape character, so each gets a backslash (PostgreSQL's default escape).
 */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');
