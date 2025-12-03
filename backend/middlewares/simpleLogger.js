export default function simpleLogger(req, res, next) {
  try {
    console.log(`[REQ] ${req.method} ${req.originalUrl} - authHeaderPresent: ${!!req.headers.authorization}`);
    if (req.headers.authorization) {
      console.log("[REQ] Authorization header (first 50 chars):", req.headers.authorization.slice(0, 50));
    }
  } catch (e) {}
  next();
}