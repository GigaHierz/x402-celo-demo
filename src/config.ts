/**
 * Shared network + facilitator configuration for the x402 demo.
 *
 * The Celo Builders facilitator is x402 protocol v2, so networks are addressed
 * with CAIP-2 ids (e.g. "eip155:11142220" for Celo Sepolia).
 */

const IS_MAINNET = process.env.X402_NETWORK === "mainnet";

/** CAIP-2 network id passed to the scheme + route config. */
export const NETWORK = IS_MAINNET
  ? ("eip155:42220" as const) // Celo mainnet
  : ("eip155:11142220" as const); // Celo Sepolia testnet

/** Hosted Celo Builders facilitator base URL for the selected network. */
export const FACILITATOR_URL = IS_MAINNET
  ? "https://api.x402.celobuilders.xyz"
  : "https://api.x402.sepolia.celobuilders.xyz";

/**
 * USDC on the selected Celo network. `@x402/evm` has no default asset table for
 * Celo, so the seller declares the token explicitly. `name`/`version` are the
 * on-chain EIP-712 domain used to sign the EIP-3009 authorization — they must
 * match the deployed token exactly (verified on Celo Sepolia: name "USDC",
 * version "2", 6 decimals).
 */
export const USDC = IS_MAINNET
  ? {
      address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`,
      decimals: 6,
      name: "USDC",
      version: "2",
    }
  : {
      address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as `0x${string}`,
      decimals: 6,
      name: "USDC",
      version: "2",
    };

/** Convert a decimal USD amount (e.g. "0.01") to USDC atomic units (base-10 string). */
export function usdToAtomic(usd: string): string {
  const [whole, frac = ""] = usd.split(".");
  const fracPadded = (frac + "0".repeat(USDC.decimals)).slice(0, USDC.decimals);
  return (BigInt(whole) * 10n ** BigInt(USDC.decimals) + BigInt(fracPadded || "0")).toString();
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
