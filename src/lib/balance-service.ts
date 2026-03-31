/**
 * Balance Service — Base Sepolia
 *
 * Fetches native ETH and USDC (ERC-20) balance for USER_SA_ADDRESS, AGENT1_SA_ADDRESS, AGENT2_SA_ADDRESS.
 */

import "dotenv/config";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC } from "./delegation";

const ADDRESSES: { key: string; label: string }[] = [
  { key: "USER_SA_ADDRESS", label: "User (SA)" },
  { key: "AGENT1_SA_ADDRESS", label: "Agent 1 (SA)" },
  { key: "AGENT2_SA_ADDRESS", label: "Agent 2 (SA)" },
];

/** USDC on Base Sepolia uses 6 decimals. */
const USDC_DECIMALS = 6;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export interface BalanceResult {
  label: string;
  address: string;
  eth: string;
  usdc: string;
}

export async function getBalances(): Promise<{
  balances: BalanceResult[];
}> {
  const balances: BalanceResult[] = [];

  for (const { key, label } of ADDRESSES) {
    const address = process.env[key] as `0x${string}` | undefined;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      balances.push({ label, address: address || "(not set)", eth: "0", usdc: "0" });
      continue;
    }
    const balanceWei = await publicClient.getBalance({ address });
    const ethStr = formatEther(balanceWei);
    const usdcRaw = await publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    const usdcStr = formatUnits(usdcRaw, USDC_DECIMALS);
    balances.push({ label, address, eth: ethStr, usdc: usdcStr });
  }

  return { balances };
}
