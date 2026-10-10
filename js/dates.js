// Date and time helpers shared by the data modules and the screens.

export const pad2 = (n) => String(n).padStart(2, '0');

export const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Weeks start on Monday, like the rest of the Turkish calendar UI.
export function startOfWeek(d) {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
export const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

// "14:05" from a millisecond timestamp.
export const formatTime = (ms) => timeFmt.format(new Date(ms));
