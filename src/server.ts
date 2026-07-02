/**
 * Local seller: starts the Express app (from app.ts) with `listen`.
 * On Vercel the same app is served by api/index.ts instead.
 */
import { app, payTo } from "./app.js";
import { ASSET, FACILITATOR_URL, NETWORK } from "./config.js";
import { ATTRIBUTION_CODE } from "./attribution.js";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`seller listening on http://localhost:${port}`);
  console.log(`  network:     ${NETWORK}`);
  console.log(`  facilitator: ${FACILITATOR_URL}`);
  console.log(`  asset:       ${ASSET.symbol} (${ASSET.address})`);
  console.log(`  payTo:       ${payTo}`);
  console.log(`  attribution: ${ATTRIBUTION_CODE} (ERC-8021)`);
});
