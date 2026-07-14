/**
 * MPP seller — a payment-gated API on Celo.
 *
 * Uses the Machine Payments Protocol (mppx SDK). A request with no payment gets
 * a 402 carrying an MPP **Challenge** (via `WWW-Authenticate: Payment`); the
 * buyer pays and retries with a **Credential**; the server settles the USDC on
 * Celo and returns a **Receipt** (via `Payment-Receipt`).
 *
 * Run:  npm run seller
 */
import 'dotenv/config' // load .env before reading process.env (see PR note)
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Mppx } from 'mppx/server'
import { evm, assets } from 'mppx/evm/server'
import { CFG, NETWORK, PORT, PRICE } from './config.js'

if (!process.env.MPP_SECRET_KEY) {
  console.error('Missing MPP_SECRET_KEY. Generate one: openssl rand -base64 32')
  process.exit(1)
}
if (!process.env.SELLER_PAY_TO) {
  console.error('Missing SELLER_PAY_TO (the wallet that receives the USDC).')
  process.exit(1)
}
if (!process.env.X402_API_KEY) {
  console.error('Missing X402_API_KEY (facilitator credits). Get one at https://x402.celo.org')
  process.exit(1)
}

// The facilitator is metered — attach the API key to every facilitator RPC.
const apiKeyFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers)
  headers.set('X-API-Key', process.env.X402_API_KEY!)
  return fetch(input, { ...init, headers })
}

// Known Celo USDC asset for the active network. Passing the known asset lets
// mppx infer the chain id, decimals, and EIP-712 domain for you.
const usdc = NETWORK === 'mainnet' ? assets.celo.USDC : assets.celoSepolia.USDC

// One payment method: a one-time EVM charge on Celo, settled through the
// Celo x402-compatible facilitator (which pays the on-chain gas).
const mppx = Mppx.create({
  methods: [
    evm.charge({
      currency: usdc,
      recipient: process.env.SELLER_PAY_TO as `0x${string}`,
      x402: { facilitator: CFG.facilitator, fetch: apiKeyFetch },
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY!,
})

const app = new Hono()
app.get('/premium', async (c) => {
  // Charge $0.01 for this route. Returns a 402 challenge until paid.
  const result = await mppx.charge({ amount: PRICE })(c.req.raw)
  if (result.status === 402) return result.challenge
  // Paid → attach the MPP receipt to your real response.
  return result.withReceipt(Response.json({ data: 'this response cost $0.01 🎉' }))
})

serve({ fetch: app.fetch, port: PORT })
console.log(`MPP seller listening on http://localhost:${PORT}  (${CFG.label})`)
console.log(`  protocol: MPP (mppx) · SDK: mppx@0.8.7 · facilitator: ${CFG.facilitator}`)
console.log(`Try:  curl -i http://localhost:${PORT}/premium   → 402 with an MPP challenge`)
