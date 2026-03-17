import rateLimit from "express-rate-limit";

// Service-level rate limiting — generous since these are service-to-service calls
export const serviceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded" },
});

// Tighter limit for LLM calls (POST /reason)
export const reasonLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 LLM calls per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "LLM rate limit exceeded — try again shortly" },
});
