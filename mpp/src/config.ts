/**
 * Shared config for the MPP-on-Celo example.
 *
 * MPP (Machine Payments Protocol, https://mpp.dev) is an open standard for
 * HTTP-native machine payments. This example uses MPP's `evm/charge` method to
 * gate an API behind a one-time USDC payment, settled on Celo.
 *
 * Defaults to Celo Sepolia testnet. Set MPP_NETWORK=mainnet for Celo mainnet.
 */
export const NETWORK = (process.env.MPP_NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as
  | 'mainnet'
  | 'testnet'

export const NETWORKS = {
  testnet: {
    chainId: 11142220, // Celo Sepolia
    usdc: '0x01C5C0122039549AD1493B8220cABEdD739BC44E' as const,
    facilitator: 'https://api.x402.sepolia.celo.org',
    explorer: 'https://celo-sepolia.blockscout.com/tx/',
    label: 'Celo Sepolia',
  },
  mainnet: {
    chainId: 42220, // Celo
    usdc: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const,
    facilitator: 'https://api.x402.celo.org',
    explorer: 'https://celoscan.io/tx/',
    label: 'Celo mainnet',
  },
} as const

export const CFG = NETWORKS[NETWORK]
export const PORT = Number(process.env.PORT ?? 3402)
export const SELLER_URL = `http://localhost:${PORT}/premium`

// Price for the gated endpoint, in display units (USDC). "0.01" = one cent.
export const PRICE = '0.01'
