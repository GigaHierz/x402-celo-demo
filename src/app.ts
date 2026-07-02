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

export const app = express();
// Behind Vercel's proxy, trust X-Forwarded-* so req.protocol/host (and thus the
// x402 resource URL) reflect the public https origin.
app.set("trust proxy", true);

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
    attribution,
  });
});

// Public, unpaid: lets anyone read the app's attribution tag without paying.
app.get("/attribution", (_req, res) => {
  res.json(attribution);
});
