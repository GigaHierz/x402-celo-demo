# x402-demo — end-to-end payment test on Celo

A minimal, self-contained test of [x402](https://x402.org) stablecoin payments
using the **Celo Builders hosted facilitator** (<https://x402.celobuilders.xyz>)
on **Celo Sepolia** testnet.

Two pieces:

- **Seller** (`src/server.ts`) — an Express server with a paid `GET /premium`
  endpoint ($0.01 USDC), gated by `@x402/express` middleware.
- **Buyer agent** (`src/agent.ts`) — a script that calls `/premium`, transparently
  pays the `402 Payment Required` challenge, and prints the paid response.

This uses the x402 **v2** protocol (`@x402/*` packages). The facilitator verifies
and settles payments and sponsors the settlement gas, so the buyer wallet only
needs test **USDC**, not CELO.

## 1. Prerequisites (manual, one-time)

1. **Create a facilitator API key.** Go to <https://x402.celobuilders.xyz>,
   connect an EVM wallet, and sign to create an API key. This is `X402_API_KEY`.
2. **Pick a receiving address.** Any wallet address you control becomes
   `SELLER_PAY_TO` (where the $0.01 lands).
3. **Fund a buyer wallet with Celo Sepolia test USDC.** Its private key becomes
   `BUYER_PRIVATE_KEY`.
   - Celo Sepolia USDC contract: `0x01C5C0122039549AD1493B8220cABEdD739BC44E`
     (6 decimals). Use a Celo Sepolia faucet / test-USDC source to fund it.

> The seller and buyer can be the same or different wallets — for a clean test,
> use two different addresses so you can see the balance move.

## 2. Install

```sh
cd x402-demo
npm install
cp .env.example .env    # then fill in the values
```

## 3. Run (two terminals)

**Terminal A — seller:**

```sh
npm run server
# -> seller listening on http://localhost:3000
```

**Sanity check (no payment) — expect HTTP 402:**

```sh
curl -i http://localhost:3000/premium
# HTTP/1.1 402 Payment Required  + JSON body describing payment requirements
```

**Terminal B — buyer agent:**

```sh
npm run agent
# -> status: 200
# -> body: { data: 'this response cost $0.01', ts: '...' }
# -> payment receipt: { ... on-chain settlement details ... }
```

## 4. Confirm on-chain

After a successful run, the buyer's test-USDC balance drops by ~$0.01 and
`SELLER_PAY_TO`'s balance rises. Check on a Celo Sepolia explorer, or query the
USDC contract balance directly.

## Environment variables

| Var                 | Used by | Purpose                                             |
| ------------------- | ------- | --------------------------------------------------- |
| `X402_NETWORK`      | both    | `testnet` (Celo Sepolia) or `mainnet` (Celo)        |
| `X402_ASSET`        | seller  | Token to charge in — `USDC` (default) or `USDT`      |
| `X402_API_KEY`      | seller  | Celo Builders facilitator key (`X-API-Key` header)  |
| `SELLER_PAY_TO`     | seller  | Address that receives the payment                   |
| `PORT`              | seller  | Seller listen port (default 3000)                   |
| `BUYER_PRIVATE_KEY` | buyer   | Private key of a wallet funded with the chosen token |
| `SERVER_URL`        | buyer   | Seller base URL (default `http://localhost:3000`)   |

## Mainnet & asset selection

To run on **Celo mainnet** (real funds, `eip155:42220`) set `X402_NETWORK=mainnet`.
Pick the token with `X402_ASSET`. These env vars override `.env` when exported
inline (dotenv doesn't overwrite an already-set variable), so:

```sh
# mainnet, pay in USDT
X402_NETWORK=mainnet X402_ASSET=USDT npm run server   # terminal A
X402_NETWORK=mainnet X402_ASSET=USDT npm run agent    # terminal B
```

Supported tokens (see `src/config.ts`):

| Network      | Assets       |
| ------------ | ------------ |
| Celo Sepolia | `USDC`       |
| Celo mainnet | `USDC`, `USDT` |

Only tokens with EIP-3009 (`transferWithAuthorization`) work with the `exact`
scheme. USDC and USDT qualify; **USDm does not** (no `transferWithAuthorization`),
so it isn't offered here. The seller declares each token's address, decimals, and
EIP-712 domain (`name`/`version`) explicitly, because `@x402/evm` has no default
asset table for Celo. See [`FEEDBACK.md`](./FEEDBACK.md) for the details and the
facilitator/skill feedback that came out of building this.

## Notes

- Next step beyond this test: wrap `payFetch` in a real LLM agent that decides
  *when* to call the paid endpoint.
