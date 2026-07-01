/**
 * Buyer agent: calls the paid endpoint and pays automatically.
 *
 * `wrapFetchWithPaymentFromConfig` wraps native fetch. On a 402 response it
 * reads the payment requirements, signs an EIP-3009 authorization with the
 * buyer's wallet, retries with the payment header, and returns the paid 200.
 */
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { NETWORK, requireEnv } from "./config.js";

const rawKey = requireEnv("BUYER_PRIVATE_KEY");
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);
const serverUrl = process.env.SERVER_URL ?? "http://localhost:3000";
const target = `${serverUrl.replace(/\/$/, "")}/premium`;

const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
});

console.log(`buyer:  ${account.address}`);
console.log(`paying: ${target} (network ${NETWORK})`);

const res = await payFetch(target, { method: "GET" });

console.log(`status: ${res.status}`);
console.log("body:", await res.json());

// The facilitator returns an on-chain settlement receipt in this header.
const receipt = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
if (receipt) {
  console.log("payment receipt:", decodePaymentResponseHeader(receipt));
}
