/**
 * Mobile app configuration.
 *
 * API_BASE_URL should point to the Ceres API server.
 * In development, use the local dev server. In production,
 * use the Railway-deployed URL.
 */

import Constants from "expo-constants";

const DEV_API_URL = "http://localhost:5000";
const PROD_API_URL = "https://ceres.up.railway.app";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  (__DEV__ ? DEV_API_URL : PROD_API_URL);

export const BRANDING = {
  appName: "Ceres",
  appDescription: "Medicare 60-Day Visit Frequency Calculator",
  duckyIntelligence: "Ducky Intelligence",
  duckyFooter: "Powered by Ducky Intelligence.",
  parentCompany: "Cavaridge, LLC",
} as const;
