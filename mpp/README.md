# mpp/ — MPP payments on Celo

A minimal, runnable example of **[Machine Payments Protocol (MPP)](https://mpp.dev)**
on Celo — a seller that charges $0.01 USDC for an API endpoint, and a buyer that
pays automatically. No gas for the buyer; settlement is on Celo via the hosted
facilitator. Companion to the **x402** example in the repo root — see
[../COMPARISON.md](../COMPARISON.md).

## Setup

```sh
cd mpp
npm install
cp .env.example .env    # then fill it in
```

Fill `.env`:
- `MPP_SECRET_KEY` — `openssl rand -base64 32`
- `X402_API_KEY` — from <https://x402.celo.org> (an existing `x402.celobuilders.xyz`
  key also works — same backend)
- `SELLER_PAY_TO` — the wallet that receives the USDC
- `BUYER_PRIVATE_KEY` — a throwaway wallet funded with a little Celo Sepolia USDC
  ([faucet.circle.com](https://faucet.circle.com), select Celo Sepolia); needs no CELO

## Run

```sh
npm run seller      # terminal A → MPP API on :3402
npm run buyer       # terminal B → pays and prints the tx hash
# mainnet: prefix both with  MPP_NETWORK=mainnet
```

Manual 402 check:
```sh
curl -i http://localhost:3402/premium   # → 402 with a WWW-Authenticate: Payment challenge
```

## Note vs upstream

This copy adds `dotenv` + `import 'dotenv/config'` so plain `npm run seller` loads
`.env`. The upstream [`celo-org/mpp-celo-example`](https://github.com/celo-org/mpp-celo-example)
omits this, so following its README verbatim fails with `Missing MPP_SECRET_KEY`
(see COMPARISON.md → Integration notes).
