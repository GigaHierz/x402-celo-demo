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

## 6. `/supported` doesn't advertise accepted assets (root cause of #3)

`GET /supported` returns the network but an empty `extra`:

```json
{"kinds":[{"x402Version":2,"scheme":"exact","network":"eip155:42220","extra":{}}], ...}
```

Because it doesn't return the accepted token addresses / decimals / EIP-712
domains, every seller has to hardcode them — which is exactly what produces the
`No default asset configured for network eip155:42220` 500 when a bare dollar
price is used. If `/supported` (or its `extra` field) advertised the asset list,
sellers could self-configure and the whole "which token, what decimals, what
domain" class of errors would disappear.

## 7. Token table lacks the EIP-712 domain fields — and for USDT they aren't on-chain

The `exact` scheme signs an EIP-3009 authorization, which needs the token's
EIP-712 `name`/`version`. The SKILL.md token table gives address + decimals but
not these. For **USDT** they can't even be read on-chain — `version()` reverts —
so the domain had to be brute-forced against the on-chain `DOMAIN_SEPARATOR`.
The table should publish `name`/`version` per token:

| Token | address | decimals | EIP-712 `name` | `version` |
| ----- | ------- | :------: | -------------- | :-------: |
| USDC (mainnet) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | `USDC` | `2` |
| USDC (Sepolia) | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` | 6 | `USDC` | `2` |
| USDT (mainnet) | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` | 6 | `Tether USD` | `1` |

## 8. USDm is listed as a payment token but can't be used with the `exact` scheme

`0x765DE816845861e75A25fCA122bb6898B8B1282a` (Mento Dollar / USDm, 18 decimals)
is listed as a supported payment token, but its `authorizationState` **reverts**
— i.e. **no EIP-3009 / `transferWithAuthorization` support** — so the
signed-authorization flow the skill documents cannot work for it. The token
table should mark EIP-3009 support explicitly, or configuring USDm leads to an
opaque settlement failure:

| Token | EIP-3009 (`exact` scheme) |
| ----- | :--: |
| USDC | ✅ |
| USDT | ✅ |
| USDm | ❌ (no `transferWithAuthorization`) |

## 9. Facilitator-submitted settlement blocks on-chain attribution (ERC-8021)

Celo's [attribution-tags](https://github.com/celo-org/attribution-tags) standard
(ERC-8021) works by appending a small *suffix* to a transaction's calldata. In
x402 the buyer only signs an EIP-3009 authorization off-chain; the **facilitator**
builds and submits the settlement tx, so a seller/buyer can't append their
attribution suffix to the payment that actually moves the funds. Result: the
payment that a builder facilitated is on-chain-indistinguishable from any other.

Suggestion: let the facilitator append a caller-supplied ERC-8021 suffix to the
settlement calldata (e.g. an `attribution` field in the payment requirements /
`extra`, or a per-API-key builder tag configured in the dashboard). That would
make x402 volume attributable to the builder who drove it — directly useful for
Proof of Ship / builder rewards. (This demo works around it by surfacing the tag
at the HTTP layer only: route metadata, a response header, and `/attribution`.)

## Verified end-to-end

Real payments for `GET /premium` settled by the facilitator (buyer signs
off-chain, facilitator sponsors gas):

| Network | Asset | Amount | Tx |
| ------- | ----- | ------ | -- |
| Celo Sepolia | USDC | $0.01 | [`0x4b44013f…f6ecf`](https://celo-sepolia.blockscout.com/tx/0x4b44013fbfba707003e5ed8c7e2ada1cce68bf862a462b5ed163b6a982cf6ecf) |
| Celo mainnet | USDC | $0.01 | [`0x88ba75fa…f1e8`](https://celoscan.io/tx/0x88ba75fa3a6344794280d4f059bf7efef6884ae1ee1a4c5ea51b9816f73ef1e8) |
| Celo mainnet | USDT | $0.01 | [`0x0c81664f…1b3d`](https://celoscan.io/tx/0x0c81664feb5dc7aa1382ac04436e9e88e40143c80a60eef722662b93f1271b3d) |
| Celo mainnet (live Vercel deploy) | USDC | $0.01 | [`0xb973e0b9…b1e6`](https://celoscan.io/tx/0xb973e0b9bb037d491d89fc0cd57e22f74496eac49a7406b3afd6b6680ccbb1e6) |

Mainnet has full parity with testnet — the same API key works on both
facilitator hosts. The last row was paid against the deployed endpoint at
<https://x402-celo-demo.vercel.app/premium>.
