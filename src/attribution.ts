/**
 * ERC-8021 attribution tags (@celo/attribution-tags).
 *
 * An attribution tag is a small calldata *suffix* that marks a transaction as
 * having come through your app. In this x402 demo the on-chain settlement tx is
 * submitted by the *facilitator*, so the suffix can't ride the payment tx today
 * (see FEEDBACK.md). We still: (1) derive the app's attribution code from its
 * hostname, (2) surface it on the endpoint + x402 route metadata so it's
 * discoverable/checkable, and (3) expose the raw ERC-8021 suffix + an on-chain
 * beacon helper for when you control a transaction directly.
 */
import { codeFromHostname, toDataSuffix, ERC_8021_MARKER } from "@celo/attribution-tags";

/**
 * The app's attribution code. Precedence:
 *   1. ATTRIBUTION_CODE (explicit override)
 *   2. codeFromHostname(ATTRIBUTION_HOSTNAME)
 *   3. codeFromHostname(Vercel's production domain)
 *   4. codeFromHostname("x402-celo-demo.vercel.app") as a last resort
 */
function resolveCode(): string {
  const explicit = process.env.ATTRIBUTION_CODE;
  if (explicit) return explicit;
  const hostname =
    process.env.ATTRIBUTION_HOSTNAME ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "x402-celo-demo.vercel.app";
  return codeFromHostname(hostname);
}

export const ATTRIBUTION_CODE = resolveCode();

/** Raw ERC-8021 data suffix (hex) for this app's code — append to calldata you control. */
export const ATTRIBUTION_SUFFIX = toDataSuffix(ATTRIBUTION_CODE);

/** Compact attribution descriptor surfaced on the endpoint. */
export const attribution = {
  standard: "ERC-8021",
  code: ATTRIBUTION_CODE,
  suffix: ATTRIBUTION_SUFFIX,
  marker: ERC_8021_MARKER,
} as const;
