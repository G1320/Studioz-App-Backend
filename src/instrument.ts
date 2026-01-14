import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://f42439d5ac18d7a6569541e9ecccc64f@o4510709493071872.ingest.de.sentry.io/4510709502640208",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
