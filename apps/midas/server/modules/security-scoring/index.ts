// Security Scoring Module — public API

export { seedCatalog, findCatalogMatchesForControl } from "./catalog";
export { matchCompensatingControls, type DetectedSignal } from "./matcher";
export {
  calculateAdjustedScore,
  generateScoreReport,
  calculateWhatIfScore,
} from "./adjusted-score";
export { getScoreTrend, detectTrendDirection } from "./trend";
