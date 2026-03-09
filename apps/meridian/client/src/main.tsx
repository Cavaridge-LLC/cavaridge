import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  fetch("/api/version")
    .then((r) => r.json())
    .then((v) => {
      Sentry.init({
        dsn: sentryDsn,
        release: `meridian@${v.version || "unknown"}`,
        environment: import.meta.env.MODE,
      });
    })
    .catch(() => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
      });
    });
}

createRoot(document.getElementById("root")!).render(<App />);
