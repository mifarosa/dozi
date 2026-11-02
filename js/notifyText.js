// Reminders that fall on the same time go out as ONE notification. Shared by the notification
// server and the app (on-device reminders), so both word and group them the same way.
// An item is { medId, name, dose, time, repeat }; repeat is 0 for the reminder itself and
// 1, 2, ... for its hourly repeats.
import { translate, pillsText } from './i18n.js';

const MAX_LINES = 6; // a notification only has room for a few lines

// Items due at the same time (and at the same repeat) become one group; groups are in time order.
export function groupReminders(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.time}|${item.repeat || 0}`;
    if (!groups.has(key)) groups.set(key, { time: item.time, repeat: item.repeat || 0, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.repeat - b.repeat);
}

// The notification for one group, in a language. One medicine keeps the familiar text; several get
// a count in the title and one line each ("Vitamin D · 1 pill").
export function groupMessage(lang, group) {
  const { items, time, repeat } = group;
  if (items.length === 1) {
    const [only] = items;
    return {
      title: translate(lang, 'notify.title', { name: only.name }),
      body: translate(lang, repeat ? 'notify.again' : 'notify.amount', { amount: pillsText(only.dose, lang), time }),
      tag: `dozi-${only.medId}-${time}`,
    };
  }
  const lines = items.slice(0, MAX_LINES).map((it) => `${it.name} · ${pillsText(it.dose, lang)}`);
  if (items.length > MAX_LINES) lines.push(translate(lang, 'notify.more', { n: items.length - MAX_LINES }));
  return {
    title: translate(lang, repeat ? 'notify.groupAgainTitle' : 'notify.groupTitle', { n: items.length }),
    body: lines.join('\n'),
    tag: `dozi-group-${time}`,
  };
}
