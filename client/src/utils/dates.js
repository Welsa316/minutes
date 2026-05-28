import * as chrono from 'chrono-node';
import { format, isToday, isTomorrow, isYesterday, isThisWeek, differenceInCalendarDays } from 'date-fns';

export function parseSmart(input, ref = new Date()) {
  if (!input) return null;
  const parsed = chrono.parseDate(input, ref, { forwardDate: true });
  return parsed || null;
}

export function toIsoLocal(d) {
  if (!d) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function fromIsoLocal(s) {
  if (!s) return null;
  return new Date(s);
}

export function humanizeDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE, h:mm a');
  const days = differenceInCalendarDays(date, new Date());
  if (days > 0 && days < 14) return format(date, 'EEE MMM d, h:mm a');
  return format(date, 'MMM d, yyyy, h:mm a');
}

export function humanizeDay(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}
