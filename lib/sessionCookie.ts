// Shared by proxy.ts (page gate) and the API routes. Kept free of server-only imports.
export const SESSION_COOKIE_NAME = 'kkh_session';
// Fixed 12-hour sign-in (not extended by activity); used for both the cookie and the DB session.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
