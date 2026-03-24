#!/usr/bin/env node
/**
 * Create Smart Accounts
 *
 * Creates MetaMask Hybrid smart accounts for AGENT1, AGENT2, and USER EOAs.
 * Computes deterministic addresses and deploys them on Base Sepolia if not
 * already deployed.
 *
 * Requires: AGENT1_PRIVATE_KEY, AGENT2_PRIVATE_KEY, USER_PRIVATE_KEY,
 * BUNDLER_BASE_SEPOLIA_URL
 *
 * Usage: pnpm run workshop create
 */

import "dotenv/config";
import { createPublicClient, http, getAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";

// ============================================================================
// Config
// ============================================================================

const bundlerUrl = process.env.BUNDLER_BASE_SEPOLIA_URL;
const delegatorPrivateKey = process.env.AGENT1_PRIVATE_KEY as `0x${string}` | undefined;
const delegatePrivateKey = process.env.AGENT2_PRIVATE_KEY as `0x${string}` | undefined;
const userPrivateKey = process.env.USER_PRIVATE_KEY as `0x${string}` | undefined;

if (!bundlerUrl || !delegatorPrivateKey || !delegatePrivateKey || !userPrivateKey) {
  console.error(
    "Missing required env: BUNDLER_BASE_SEPOLIA_URL, AGENT1_PRIVATE_KEY, AGENT2_PRIVATE_KEY, USER_PRIVATE_KEY"
  );
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(bundlerUrl),
  paymaster: true,
});

// ============================================================================
// Helpers
// ============================================================================

async function getOrCreateSmartAccount(label: string, privateKey: `0x${string}`): Promise<{ address: `0x${string}`; deployed: boolean }> {
  const account = privateKeyToAccount(privateKey);

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [account.address, [], [], []],
    deploySalt: "0x",
    signer: { account },
  });

  const address = getAddress(smartAccount.address) as `0x${string}`;
  const code = await publicClient.getBytecode({ address });
  const deployed = Boolean(code && code !== "0x");

  console.log(`\n${label}:`);
  console.log(`  EOA:     ${account.address}`);
  console.log(`  SA:      ${address}`);
  console.log(`  Deployed: ${deployed ? "yes" : "no"}`);

  if (!deployed) {
    console.log(`  Deploying Smart Account...`);
    const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: [{ to: address, value: 0n, data: "0x" }],
      maxFeePerGas: maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: maxPriorityFeePerGas ?? undefined,
    });
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    console.log(`  Tx hash: ${receipt.receipt.transactionHash}`);
    console.log(`  Deployed.`);
  }

  return { address, deployed };
}

// ============================================================================
// Main
// ============================================================================

export async function createSmartAccounts() {
  console.log("Creating smart accounts for DELEGATOR, DELEGATE, and USER EOAs...\n");

  const [delegator, delegate, user] = await Promise.all([
    getOrCreateSmartAccount("Delegator", delegatorPrivateKey!),
    getOrCreateSmartAccount("Delegate", delegatePrivateKey!),
    getOrCreateSmartAccount("User", userPrivateKey!),
  ]);

  console.log("\n--- Add these to your .env ---\n");
  console.log(`AGENT1_SA_ADDRESS=${delegator.address}`);
  console.log(`AGENT2_SA_ADDRESS=${delegate.address}`);
  console.log(`USER_SA_ADDRESS=${user.address}`);
  console.log("");
}
