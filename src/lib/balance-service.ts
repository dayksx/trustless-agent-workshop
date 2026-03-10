/**
 * Balance Service — Base Sepolia
 *
 * Fetches ETH balance and USD value for USER_SA_ADDRESS, AGENT1_SA_ADDRESS, AGENT2_SA_ADDRESS.
 */

import "dotenv/config";
import { createPublicClient, formatEther, http } from "viem";
import { baseSepolia } from "viem/chains";
import axios from "axios";

const ADDRESSES: { key: string; label: string }[] = [
  { key: "USER_SA_ADDRESS", label: "User (SA)" },
  { key: "AGENT1_SA_ADDRESS", label: "Agent 1 (SA)" },
  { key: "AGENT2_SA_ADDRESS", label: "Agent 2 (SA)" },
];

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices/ETH-USD/spot";

export interface BalanceResult {
  label: string;
  address: string;
  eth: string;
  usd: string;
}

async function getEthUsdPrice(): Promise<number> {
  const res = await axios.get<{ data: { amount: string } }>(COINBASE_SPOT_URL, {
    timeout: 5000,
  });
  const amount = res.data?.data?.amount;
  if (!amount) throw new Error("Invalid ETH-USD price response");
  return parseFloat(amount);
}

export async function getBalances(): Promise<{
  ethUsdPrice: number;
  balances: BalanceResult[];
}> {
  const ethUsdPrice = await getEthUsdPrice();
  const balances: BalanceResult[] = [];

  for (const { key, label } of ADDRESSES) {
    const address = process.env[key] as `0x${string}` | undefined;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      balances.push({ label, address: address || "(not set)", eth: "0", usd: "0.00" });
      continue;
    }
    const balanceWei = await publicClient.getBalance({ address });
    const ethStr = formatEther(balanceWei);
    const usdNum = parseFloat(ethStr) * ethUsdPrice;
    balances.push({ label, address, eth: ethStr, usd: usdNum.toFixed(2) });
  }

  return { ethUsdPrice, balances };
}
