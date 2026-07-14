/**
 * Seller Express app (no `listen`) so it can be reused by both the local server
 * (`server.ts`) and the Vercel serverless entry (`api/index.ts`).
 *
 * The x402 middleware gates `GET /premium`. Without a valid payment it returns
 * HTTP 402 with payment requirements; the Celo Builders facilitator verifies and
 * settles the signed payment, then the route runs. The response also carries the
 * app's ERC-8021 attribution tag (see attribution.ts).
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ASSET, FACILITATOR_URL, NETWORK, requireEnv, toAtomic } from "./config.js";
import { ATTRIBUTION_CODE, attribution } from "./attribution.js";

export const payTo = requireEnv("SELLER_PAY_TO") as `0x${string}`;
const apiKey = requireEnv("X402_API_KEY");

// Facilitator client carries the Celo Builders API key on every call.
const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: async () => {
    const headers = { "X-API-Key": apiKey };
    return { verify: headers, settle: headers, supported: headers };
  },
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

/**
 * Shown to anyone who might pay: this is a demo on real mainnet.
 * ASCII-only — this string is also sent as an HTTP header, which cannot hold
 * non-ASCII characters.
 */
export const WARNING =
  "TEST SITE ON CELO MAINNET - paying this endpoint sends REAL USDC for nothing. " +
  "If you pay, that is your choice and your loss.";

export const app = express();
// Behind Vercel's proxy, trust X-Forwarded-* so req.protocol/host (and thus the
// x402 resource URL) reflect the public https origin.
app.set("trust proxy", true);

// Put the warning on EVERY response — including the 402 challenge — so
// programmatic clients (agents) see it before they decide to pay.
app.use((_req, res, next) => {
  res.setHeader("X-Test-Warning", WARNING);
  next();
});

app.use(
  paymentMiddleware(
    {
      "GET /premium": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          payTo,
          // Explicit asset ($0.01). `extra` carries the EIP-712 domain the
          // buyer uses to sign the EIP-3009 transfer authorization.
          price: {
            asset: ASSET.address,
            amount: toAtomic("0.01"),
            extra: { name: ASSET.name, version: ASSET.version },
          },
        },
        description: "Premium content that costs $0.01 per request",
        // ERC-8021 attribution tag surfaced as x402 route metadata.
        serviceName: "x402-celo-demo",
        tags: [ATTRIBUTION_CODE],
      },
    },
    resourceServer,
  ),
);

app.get("/premium", (_req, res) => {
  res.setHeader("X-Attribution-Tag", ATTRIBUTION_CODE);
  res.json({
    data: "this response cost $0.01",
    ts: new Date().toISOString(),
    warning: WARNING,
    attribution,
  });
});

// Public, unpaid: lets anyone read the app's attribution tag without paying.
app.get("/attribution", (_req, res) => {
  res.json({ ...attribution, warning: WARNING });
});

// Landing page with a prominent warning banner for browser visitors.
app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>x402 Celo demo — TEST SITE (mainnet)</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         line-height: 1.5; }
  .banner { background: #b00020; color: #fff; padding: 18px 20px; font-weight: 700;
            font-size: 1.05rem; text-align: center; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 20px; }
  code { background: rgba(127,127,127,.18); padding: .15em .4em; border-radius: 4px; }
  a { color: #0a58ca; }
  .muted { opacity: .75; font-size: .9rem; }
</style>
</head>
<body>
  <div class="banner">⚠️ TEST SITE ON CELO MAINNET — paying sends REAL USDC for nothing. If you pay, that's your choice and your loss.</div>
  <main>
    <h1>x402 Celo demo</h1>
    <p>This is a demonstration of <a href="https://x402.org">x402</a> HTTP payments
       on <strong>Celo mainnet</strong> via the Celo Builders facilitator. It exists
       to show the flow working — <strong>there is nothing worth buying here.</strong></p>
    <p>The paid endpoint is <code>GET /premium</code> ($0.01 USDC). Hitting it without
       payment returns <code>402 Payment Required</code>. Any payment sends real funds
       to the demo wallet and gets you a one-line JSON response — <em>do not pay unless
       you are intentionally testing.</em></p>
    <ul>
      <li><a href="/premium">/premium</a> — paid endpoint (returns 402 unpaid)</li>
      <li><a href="/attribution">/attribution</a> — this app's ERC-8021 attribution tag</li>
    </ul>
    <p class="muted">Source &amp; details:
       <a href="https://github.com/GigaHierz/x402-celo-demo">github.com/GigaHierz/x402-celo-demo</a></p>
  </main>
</body>
</html>`);
});
