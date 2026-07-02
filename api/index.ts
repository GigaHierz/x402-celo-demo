/**
 * Vercel serverless entry: serves the seller Express app as a function.
 * A vercel.json rewrite sends every path here, so `GET /premium` and
 * `GET /attribution` are handled by the same app used locally.
 */
import { app } from "../src/app.js";

export default app;
