// The reminder logic in ../../js reads wall-clock time through Date's local getters.
// To evaluate it for any user's time zone, this process runs in UTC and every
// timestamp is shifted into the user's wall clock first (see wall.js).
// Import this file before anything that touches Date.
process.env.TZ = 'UTC';
