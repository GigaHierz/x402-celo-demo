/**
 * MPP buyer — pays for the seller's gated endpoint automatically.
 *
 * Registers the EVM charge method with a funded account; the mppx client then
 * transparently answers any 402 challenge (sign EIP-3009 credential → retry).
 * The buyer needs Celo USDC and NO native gas (facilitator sponsors it).
 *
 * Start the seller first, then:  npm run buyer
 */
import 'dotenv/config' // load .env before reading process.env (see PR note)
import { privateKeyToAccount } from 'viem/accounts'
import { Mppx } from 'mppx/client'
import { evm } from 'mppx/evm/client'
import { CFG, SELLER_URL } from './config.js'

if (!process.env.BUYER_PRIVATE_KEY) {
  console.error('Missing BUYER_PRIVATE_KEY (a testnet wallet funded with USDC).')
  process.exit(1)
}

const account = privateKeyToAccount(
  (process.env.BUYER_PRIVATE_KEY.startsWith('0x')
    ? process.env.BUYER_PRIVATE_KEY
    : `0x${process.env.BUYER_PRIVATE_KEY}`) as `0x${string}`,
)

// Register the EVM charge method with the buyer's account. Mppx.create patches
// the global fetch to handle MPP 402 challenges automatically.
//
// NOTE: on the buyer side you must supply the token `decimals` and its EIP-712
// `authorization` domain ({ name, version }) yourself. The mppx client builds the
// payment credential locally and does NOT infer these from the server's
// challenge, so leaving them out throws:
//   - "EVM charge maxAmount requires currency decimals."
//   - "EVM authorization requires token name and version."
// For Celo USDC the domain is name "USDC", version "2".
Mppx.create({
  methods: [
    evm.charge({
      account,
      // Client-side policy: only pay this network + currency, capped in amount.
      // The actual price is read from the server's MPP challenge at pay time.
      networks: [CFG.chainId],
      currencies: [CFG.usdc],
      decimals: 6,
      authorization: { name: 'USDC', version: '2' },
      maxAmount: '1', // never pay more than 1 USDC for a single request
    }),
  ],
})

console.log(`Paying ${SELLER_URL} as ${account.address} on ${CFG.label}…`)
const res = await fetch(SELLER_URL)
console.log('status:', res.status)
console.log('body:', await res.json())

// The settlement reference (tx hash) comes back on the MPP Payment-Receipt
// header — base64url-encoded JSON whose `reference` field is the on-chain tx.
const receiptHdr = res.headers.get('payment-receipt')
if (receiptHdr) {
  try {
    const receipt = JSON.parse(Buffer.from(receiptHdr, 'base64url').toString('utf8'))
    console.log('receipt:', receipt)
    const ref: unknown = receipt?.reference
    if (typeof ref === 'string' && /^0x[a-fA-F0-9]{64}$/.test(ref)) {
      console.log('explorer:', `${CFG.explorer}${ref}`)
    }
  } catch {
    console.log('receipt (raw):', receiptHdr)
  }
}
