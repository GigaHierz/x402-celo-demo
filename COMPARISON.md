# x402 vs MPP on Celo — a side-by-side

This repo now has **two runnable examples of HTTP-native, pay-per-request
payments on Celo**, so you can compare the protocols directly:

| | **x402** (repo root) | **MPP** (`mpp/`) |
| --- | --- | --- |
| Standard | x402 (Coinbase) v2 | Machine Payments Protocol ([mpp.dev](https://mpp.dev)) |
| SDK | `@x402/express`, `@x402/fetch`, `@x402/evm`, `@x402/core` | `mppx` (single pkg, subpath exports) |
| Server framework | Express | Hono |
| 402 challenge transport | `PAYMENT-REQUIRED` response header (base64 JSON) | `WWW-Authenticate: Payment …` header |
| Receipt transport | `PAYMENT-RESPONSE` header | `Payment-Receipt` header (base64url JSON) |
| Credential | EIP-3009 `transferWithAuthorization` | EIP-3009 `transferWithAuthorization` |
| Facilitator | `x402.celobuilders.xyz` | `x402.celo.org` |
| Settlement backend | **same** (facilitator signer `0x0d74…fb48`) | **same** (facilitator signer `0x0d74…fb48`) |
| Token | Celo USDC (also USDT in the x402 example) | Celo USDC |
| Buyer gas | none — facilitator sponsors | none — facilitator sponsors |
| Networks | Celo Sepolia + mainnet | Celo Sepolia + mainnet |

## What's identical

Both are the same idea over the **same Celo rails**: `HTTP 402 → client signs an
EIP-3009 USDC authorization → retry → facilitator settles on-chain (sponsoring
gas) → server returns 200 + an on-chain receipt`. Crucially, **both facilitators
resolve to the same settlement backend** — `x402.celo.org` and
`x402.celobuilders.xyz` return the *same facilitator signer* (`0x0d74…fb48`) from
`/supported`, so **one `X402_API_KEY` works for both**. Same USDC contracts, same
EIP-712 domain (`name: "USDC"`, `version: "2"`).

## What differs (in code)

**Server — declaring the paid route**

```ts
// x402 (root/src/app.ts): Express middleware + explicit asset/domain
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
app.use(paymentMiddleware({
  'GET /premium': { accepts: { scheme: 'exact', network: NETWORK, payTo,
    price: { asset: USDC.address, amount: toAtomic('0.01'),
             extra: { name: 'USDC', version: '2' } } } },
}, resourceServer))
```

```ts
// MPP (mpp/src/seller.ts): Hono + a known-asset helper infers chain/decimals/domain
const mppx = Mppx.create({
  methods: [evm.charge({ currency: assets.celo.USDC, recipient: SELLER_PAY_TO,
    x402: { facilitator: CFG.facilitator, fetch: apiKeyFetch } })],
  secretKey: process.env.MPP_SECRET_KEY!,
})
app.get('/premium', async (c) => {
  const r = await mppx.charge({ amount: '0.01' })(c.req.raw)
  return r.status === 402 ? r.challenge : r.withReceipt(Response.json({ data: '…' }))
})
```

**Client — paying automatically**

```ts
// x402: wrap fetch with a scheme bound to a viem account
const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
})
```

```ts
// MPP: register the method; Mppx.create() patches global fetch
Mppx.create({ methods: [evm.charge({ account, networks: [chainId],
  currencies: [usdc], decimals: 6, authorization: { name: 'USDC', version: '2' },
  maxAmount: '1' })] })
```

## When to reach for which

- **x402** — you want the Coinbase x402 v2 ecosystem, Express, per-token control
  (the root example also demonstrates **USDT** and **ERC-8021 attribution tags**),
  or you're deploying serverless (this example ships a Vercel function).
- **MPP** — you want the smaller `mppx` surface, Hono, or MPP's `WWW-Authenticate`
  transport and multi-method abstraction (`mppx` also has Stripe/MCP methods).

Either way the money moves the same way on Celo.

## Integration notes / feedback (MPP example)

Found while wiring up `mpp/` (the `.env` item is **fixed in this PR**):

1. **The upstream example never loads `.env`.** Its README says
   `cp .env.example .env && npm run seller`, but the scripts are plain
   `tsx src/seller.ts` with no dotenv — so following the README verbatim fails
   with `Missing MPP_SECRET_KEY`. **Fixed here** by adding `dotenv` +
   `import 'dotenv/config'` (so plain `npm run` works). Upstream could instead use
   `tsx --env-file=.env` / `node --env-file=.env`.
2. **The MPP client can't infer the token from the server challenge.** The buyer
   must hardcode `decimals: 6` and `authorization: { name, version }`, even though
   the server's 402 challenge already carries `chainId` and `decimals`
   (`methodDetails`). Leaving them out throws
   `EVM charge maxAmount requires currency decimals` /
   `EVM authorization requires token name and version`. Having the client read
   these from the challenge (or from a known-asset table like the server's
   `assets.celo.USDC`) would remove a sharp edge.
3. **One facilitator, two domains.** `x402.celo.org` and `x402.celobuilders.xyz`
   are the same backend, so no separate key is needed — worth documenting.

## Verified transactions ($0.01 USDC, buyer → seller, facilitator-sponsored gas)

| Protocol | Network | Tx |
| --- | --- | --- |
| x402 | Celo Sepolia | [`0x4b44013f…`](https://celo-sepolia.blockscout.com/tx/0x4b44013fbfba707003e5ed8c7e2ada1cce68bf862a462b5ed163b6a982cf6ecf) |
| x402 | Celo mainnet | [`0x88ba75fa…`](https://celoscan.io/tx/0x88ba75fa3a6344794280d4f059bf7efef6884ae1ee1a4c5ea51b9816f73ef1e8) |
| MPP | Celo Sepolia | [`0xc16b4e7f…`](https://celo-sepolia.blockscout.com/tx/0xc16b4e7f6ccc6cb8a54f9d08570af0058e04e66ae4e5e172fcd71ee89cc63bcc) |
| MPP | Celo mainnet | [`0xa9f8f328…`](https://celoscan.io/tx/0xa9f8f328dfe1aa26e2240af33a126e3fc2fd87061412b52a23f26d6a12d18617) |
