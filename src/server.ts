/**
 * Seller: an Express server with one paid endpoint, `GET /premium` ($0.01).
 *
 * The x402 middleware gates the route. When a request arrives without a valid
 * payment it returns HTTP 402 with payment requirements; the Celo Builders
 * facilitator verifies and settles the signed payment, then the route runs.
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { FACILITATOR_URL, NETWORK, USDC, requireEnv, usdToAtomic } from "./config.js";

const payTo = requireEnv("SELLER_PAY_TO") as `0x${string}`;
const apiKey = requireEnv("X402_API_KEY");
const port = Number(process.env.PORT ?? 3000);

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

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /premium": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          payTo,
          // Explicit USDC asset ($0.01). `extra` carries the EIP-712 domain the
          // buyer uses to sign the EIP-3009 transfer authorization.
          price: {
            asset: USDC.address,
            amount: usdToAtomic("0.01"),
            extra: { name: USDC.name, version: USDC.version },
          },
        },
        description: "Premium content that costs $0.01 per request",
      },
    },
    resourceServer,
  ),
);

app.get("/premium", (_req, res) => {
  res.json({
    data: "this response cost $0.01",
    ts: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`seller listening on http://localhost:${port}`);
  console.log(`  network:     ${NETWORK}`);
  console.log(`  facilitator: ${FACILITATOR_URL}`);
  console.log(`  payTo:       ${payTo}`);
});
