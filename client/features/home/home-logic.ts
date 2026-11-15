import type {AttemptSummary} from '@linmaster/shared';

const VN = 'Asia/Ho_Chi_Minh';

/** Vietnam calendar day (`YYYY-MM-DD`) of `now` plus `offset` days: the server counts days in Vietnam time. */
export function vnDay(now: Date, offset = 0) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: VN}).format(new Date(now.getTime() + offset * 86_400_000));
}

export function greeting(now: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone: VN, hour: 'numeric', hourCycle: 'h23'}).format(now));
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

/** The attempt still running, if any: in progress and before its deadline. */
export function runningAttempt(attempts: AttemptSummary[], now: Date) {
  return attempts.find(a => a.status === 'in_progress' && Date.parse(a.deadlineAt) > now.getTime()) ?? null;
}

/** Minutes left and the share of the time already used (0..1). */
export function timeLeft(attempt: Pick<AttemptSummary, 'startedAt' | 'deadlineAt'>, now: Date) {
  const start = Date.parse(attempt.startedAt);
  const end = Date.parse(attempt.deadlineAt);
  const left = Math.max(0, end - now.getTime());
  return {minutes: Math.ceil(left / 60_000), used: end > start ? 1 - left / (end - start) : 1};
}
