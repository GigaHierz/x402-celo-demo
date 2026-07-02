/**
 * Shared network + facilitator + asset configuration for the x402 demo.
 *
 * The Celo Builders facilitator is x402 protocol v2, so networks are addressed
 * with CAIP-2 ids (e.g. "eip155:11142220" for Celo Sepolia).
 */

const IS_MAINNET = process.env.X402_NETWORK === "mainnet";
const NETWORK_KEY = IS_MAINNET ? "mainnet" : "testnet";

/** CAIP-2 network id passed to the scheme + route config. */
export const NETWORK = IS_MAINNET
  ? ("eip155:42220" as const) // Celo mainnet
  : ("eip155:11142220" as const); // Celo Sepolia testnet

/** Hosted Celo Builders facilitator base URL for the selected network. */
export const FACILITATOR_URL = IS_MAINNET
  ? "https://api.x402.celobuilders.xyz"
  : "https://api.x402.sepolia.celobuilders.xyz";

/**
 * A payable ERC-20. `@x402/evm` has no default asset table for Celo, so the
 * seller declares the token explicitly. `name`/`version` are the on-chain
 * EIP-712 domain used to sign the EIP-3009 transfer authorization — they must
 * match the deployed token's DOMAIN_SEPARATOR exactly or the buyer's signature
 * won't verify. (Verified on-chain: USDC -> "USDC"/"2"; USDT -> "Tether USD"/"1".)
 */
export interface TokenConfig {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  name: string;
  version: string;
}

const TOKENS: Record<string, Record<string, TokenConfig>> = {
  mainnet: {
    USDC: {
      symbol: "USDC",
      address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      decimals: 6,
      name: "USDC",
      version: "2",
    },
    USDT: {
      symbol: "USDT",
      address: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
      decimals: 6,
      name: "Tether USD",
      version: "1",
    },
  },
  testnet: {
    USDC: {
      symbol: "USDC",
      address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
      decimals: 6,
      name: "USDC",
      version: "2",
    },
    // USDT is not configured on Celo Sepolia in this demo.
  },
};

/** Selected token, chosen via X402_ASSET (default USDC). */
export const ASSET: TokenConfig = (() => {
  const symbol = (process.env.X402_ASSET ?? "USDC").toUpperCase();
  const token = TOKENS[NETWORK_KEY][symbol];
  if (!token) {
    const available = Object.keys(TOKENS[NETWORK_KEY]).join(", ");
    throw new Error(
      `Asset ${symbol} is not configured for ${NETWORK_KEY}. Available: ${available}.`,
    );
  }
  return token;
})();

/** Convert a decimal amount (e.g. "0.01") to the selected asset's atomic units. */
export function toAtomic(amount: string): string {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(ASSET.decimals)).slice(0, ASSET.decimals);
  return (BigInt(whole) * 10n ** BigInt(ASSET.decimals) + BigInt(fracPadded || "0")).toString();
}

/** Require an env var or fail fast with a helpful message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}
