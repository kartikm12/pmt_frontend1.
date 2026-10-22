// Repeat rules in plain words. Rules are a small part of the iCalendar RRULE format; the server
// (pmt_backend/src/utils/repeatRule.ts) owns the date maths and checks every rule; this only reads and writes them.
export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type RepeatRule = { freq: Freq; interval: number; byDay?: string[]; nth?: number; byMonthDay?: number; byMonth?: number; count?: number; until?: string };

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const WEEKDAY_NAMES: Record<string, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORDINAL: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };
export const WORKWEEK = ["MO", "TU", "WE", "TH", "FR"];

export const dayth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function parseRepeat(text: string | null | undefined): RepeatRule | null {
  if (!text) return null;
  const legacy: Record<string, string> = { DAILY: "FREQ=DAILY", WEEKLY: "FREQ=WEEKLY", MONTHLY: "FREQ=MONTHLY" };
  const parts = Object.fromEntries((legacy[text] ?? text).split(";").filter(Boolean).map((p) => p.split("=") as [string, string]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ)) return null;
  const r: RepeatRule = { freq: parts.FREQ as Freq, interval: Number(parts.INTERVAL || 1) };
  if (parts.BYDAY) {
    const m = /^(-1|[1-4])([A-Z]{2})$/.exec(parts.BYDAY);
    if (m) { r.nth = Number(m[1]); r.byDay = [m[2]]; } else r.byDay = parts.BYDAY.split(",");
  }
  if (parts.BYMONTHDAY) r.byMonthDay = Number(parts.BYMONTHDAY);
  if (parts.BYMONTH) r.byMonth = Number(parts.BYMONTH);
  if (parts.COUNT) r.count = Number(parts.COUNT);
  if (parts.UNTIL) r.until = parts.UNTIL;
  return r;
}

export function formatRepeat(r: RepeatRule): string {
  const out = [`FREQ=${r.freq}`];
  if (r.interval > 1) out.push(`INTERVAL=${r.interval}`);
  if (r.byDay?.length) out.push(`BYDAY=${r.nth ? `${r.nth}${r.byDay[0]}` : WEEKDAYS.filter((d) => r.byDay!.includes(d)).join(",")}`);
  if (r.byMonth !== undefined) out.push(`BYMONTH=${r.byMonth}`);
  if (r.byMonthDay !== undefined) out.push(`BYMONTHDAY=${r.byMonthDay}`);
  if (r.count !== undefined) out.push(`COUNT=${r.count}`);
  if (r.until) out.push(`UNTIL=${r.until}`);
  return out.join(";");
}

// "Every 2 weeks on Monday and Thursday, 6 times"
export function describeRepeat(text: string | null | undefined): string {
  const r = parseRepeat(text);
  if (!r) return "Doesn't repeat";
  const every = (unit: string) => (r.interval > 1 ? `Every ${r.interval} ${unit}s` : `Every ${unit}`);
  let s: string;
  if (r.freq === "DAILY") s = every("day");
  else if (r.freq === "WEEKLY") {
    const days = r.byDay ?? [];
    if (r.interval === 1 && days.length === 5 && WORKWEEK.every((d) => days.includes(d))) s = "Every weekday (Mon–Fri)";
    else s = days.length ? `${every("week")} on ${list(WEEKDAYS.filter((d) => days.includes(d)).map((d) => WEEKDAY_NAMES[d]))}` : every("week");
  } else if (r.freq === "MONTHLY") {
    if (r.nth && r.byDay) s = `${every("month")} on the ${ORDINAL[r.nth]} ${WEEKDAY_NAMES[r.byDay[0]]}`;
    else if (r.byMonthDay === -1) s = `${every("month")} on the last day`;
    else if (r.byMonthDay) s = `${every("month")} on the ${dayth(r.byMonthDay)}${r.byMonthDay >= 29 ? " (or the last day)" : ""}`;
    else s = every("month");
  } else s = `${every("year")}${r.byMonth && r.byMonthDay ? ` on ${r.byMonthDay === -1 ? "the last day of" : r.byMonthDay} ${MONTHS[r.byMonth - 1]}` : ""}`;
  if (r.count) s += r.count === 1 ? ", this is the last one" : `, ${r.count} times`;
  if (r.until) s += `, until ${Number(r.until.slice(6))} ${MONTHS[Number(r.until.slice(4, 6)) - 1].slice(0, 3)} ${r.until.slice(0, 4)}`;
  return s;
}

// Short tag for cards and list rows
export function repeatTag(text: string | null | undefined): string {
  const r = parseRepeat(text);
  if (!r) return "";
  if (r.freq === "WEEKLY" && r.interval === 1 && r.byDay?.length === 5 && WORKWEEK.every((d) => r.byDay!.includes(d))) return "Weekdays";
  if (r.interval > 1) return `Every ${r.interval} ${{ DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" }[r.freq]}`;
  return { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" }[r.freq];
}

// The quick choices, worked out from the deadline (yyyy-MM-dd): "Every week on Wednesday", "Every month on the 29th"
export function repeatPresets(due: string) {
  const d = due ? new Date(`${due}T00:00:00Z`) : new Date();
  const wd = WEEKDAYS[(d.getUTCDay() + 6) % 7];
  const day = d.getUTCDate();
  const rules = [
    "FREQ=DAILY",
    `FREQ=WEEKLY;BYDAY=${WORKWEEK.join(",")}`,
    `FREQ=WEEKLY;BYDAY=${wd}`,
    `FREQ=WEEKLY;INTERVAL=2;BYDAY=${wd}`,
    `FREQ=MONTHLY;BYMONTHDAY=${day}`
  ];
  return rules.map((id) => ({ id, name: describeRepeat(id) }));
}

// The same rule spelled the way presets are (so an older "WEEKLY" on a Wednesday task shows as that preset)
export function canonicalRepeat(text: string | null | undefined, due: string): string {
  const r = parseRepeat(text);
  if (!r) return "";
  const d = due ? new Date(`${due}T00:00:00Z`) : new Date();
  if (r.freq === "WEEKLY" && !r.byDay) r.byDay = [WEEKDAYS[(d.getUTCDay() + 6) % 7]];
  if (r.freq === "MONTHLY" && !r.byDay && r.byMonthDay === undefined) r.byMonthDay = d.getUTCDate();
  if (r.freq === "YEARLY") { r.byMonth ??= d.getUTCMonth() + 1; r.byMonthDay ??= d.getUTCDate(); }
  return formatRepeat(r);
}
