# Feedback: Celo Builders x402 skill & facilitator

Notes from building this demo against the Celo Builders hosted facilitator
(<https://x402.celobuilders.xyz>) and its
[`SKILL.md`](https://x402.celobuilders.xyz/SKILL.md), on Celo Sepolia.

**Bottom line:** the hosted facilitator works great — one funded wallet, no gas
for the buyer, sub-second settlement, a clean `402 → sign → 200` flow. The
friction was entirely in the **SKILL.md code examples**, which don't match the
actual published `@x402/*` packages. The real API had to be reverse-engineered
from the type definitions. Issues below, in priority order.

## 1. Code snippets are v1-shaped, but the facilitator is v2 (biggest issue)

The SKILL.md shows:

```ts
paymentMiddleware(payToAddress, { "GET /premium": {...} }, facilitator)   // seller
wrapFetchWithPayment(fetch, account)                                       // buyer
```

Neither matches `@x402/express` / `@x402/fetch` v2.17 (the versions on npm). The
real v2 API is:

```ts
// seller
const facilitatorClient = new HTTPFacilitatorClient({ url, createAuthHeaders });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:11142220", new ExactEvmScheme());   // from @x402/evm/exact/server
app.use(paymentMiddleware(routes, resourceServer));       // routes FIRST, then server

// buyer
const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:11142220", client: new ExactEvmScheme(account) }], // @x402/evm
});
```

The snippets look like the **Coinbase x402 v1** packages
(`x402-express` / `x402-fetch`) — but those don't support Celo at all (their
network enum has no Celo entry), so copy-pasting them fails twice: wrong
signature *and* wrong package. Recommend rewriting the examples against the
actual v2 packages the doc tells people to install.

## 2. Route config shape is different

The doc shows `{ "GET /premium": { price, network } }`. Real v2 wants:

```ts
{ "GET /premium": { accepts: { scheme, network, payTo, price }, description } }
```

`payTo` moved *inside* `accepts` (not a top-level middleware arg), and there's a
required `accepts` wrapper.

## 3. Celo assets aren't in the default asset table → `$0.01` throws

With `price: "$0.01"`, the server throws at request time:

```
Error: No default asset configured for network eip155:11142220
```

`@x402/evm` has no default asset map for Celo (mainnet or Sepolia), so a bare
dollar price can't resolve to a token. USDC must be declared explicitly:

```ts
price: {
  asset: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", // Celo Sepolia USDC
  amount: "10000",                                      // $0.01 at 6 decimals
  extra: { name: "USDC", version: "2" },                // EIP-712 domain for EIP-3009
}
```

This is the single biggest "it compiles but 500s at runtime" gotcha. Two fixes
worth considering: (a) ship a Celo default-asset entry in the recommended setup,
and (b) document the required `extra: { name, version }` — the token had to be
read on-chain to confirm `name="USDC"`, `version="2"` before signatures
verified.

## 4. `createAuthHeaders` return shape

The doc shows `{ verify, settle, supported }` (and mentions `list`). The v2
`HTTPFacilitatorClient` type is `{ verify, settle, supported, bazaar? }` —
`list` is v1. Minor, but worth aligning with the shipped version.

## 5. Small doc nits

- The **Celo Sepolia** USDC contract
  (`0x01C5C0122039549AD1493B8220cABEdD739BC44E`) isn't in the SKILL.md token
  table — only mainnet tokens are listed. Testnet-first users need the Sepolia
  address.
- "New accounts start with free credits" — a link to a faucet / how to actually
  get test USDC would save a step.

## What was genuinely good

- The facilitator auth model (`X-API-Key` via `createAuthHeaders`) is clean and
  worked first try.
- Gas sponsorship on settlement is great DX — the buyer needed **zero CELO**.
- The `PAYMENT-REQUIRED` challenge header was complete and correct (network,
  asset, atomic amount, `payTo`, EIP-712 domain), so once the seller was
  configured right, the buyer side "just worked" with the standard
  `wrapFetchWithPaymentFromConfig`.

## Verified end-to-end

A real `$0.01` USDC payment for `GET /premium` settled by the facilitator on
Celo Sepolia:

- **Tx:** [`0x4b44013fbfba707003e5ed8c7e2ada1cce68bf862a462b5ed163b6a982cf6ecf`](https://celo-sepolia.blockscout.com/tx/0x4b44013fbfba707003e5ed8c7e2ada1cce68bf862a462b5ed163b6a982cf6ecf)
- Status **success**, block `29617650` — buyer → seller, facilitator-sponsored gas.
