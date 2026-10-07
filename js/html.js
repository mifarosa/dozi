// Escape text before it goes into an innerHTML template.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);
