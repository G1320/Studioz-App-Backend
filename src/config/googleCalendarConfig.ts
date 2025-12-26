import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from './index.js';

export const GOOGLE_CALENDAR_CONFIG = {
  clientId: GOOGLE_CLIENT_ID!,
  clientSecret: GOOGLE_CLIENT_SECRET!,
  redirectUri: GOOGLE_REDIRECT_URI!,
  scopes: [
    'https://www.googleapis.com/auth/calendar.events' // Only need to manage events, not calendars themselves
  ]
};

