import "dotenv/config";

import type { Address, Chain, Hex } from "viem";
import { createPublicClient, createWalletClient, http, parseEther, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient } from "viem/account-abstraction";

import {
  Implementation,
  toMetaMaskSmartAccount,
  getSmartAccountsEnvironment,
  type Delegation,
} from "@metamask/smart-accounts-kit";

const env = process.env;
if (!env.DELEGATOR_PRIVATE_KEY || !env.DELEGATEE_ADDRESS || !env.BUNDLER_BASE_SEPOLIA_URL) {
  throw new Error("Missing DELEGATOR_PRIVATE_KEY, DELEGATEE_ADDRESS or BUNDLER_URL in .env");
}
const BUNDLER_URL = env.BUNDLER_URL;


// ---------------------------------------------------------------------------
// EIP-7702 with Gator implementation
// ---------------------------------------------------------------------------

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(BUNDLER_URL),
});

const account = privateKeyToAccount(env.DELEGATOR_PRIVATE_KEY as `0x${string}`);

console.log("🔍 EOA address that will be upgraded to a smart account:", account.address);

const walletClient = createWalletClient({
  account: account,
  chain: baseSepolia,
  transport: http(),
});

const environment = getSmartAccountsEnvironment(baseSepolia.id);
const contractAddress = environment.implementations.EIP7702StatelessDeleGatorImpl;

console.log("🔍 Contract Address for EIP-7702 Stateless DeleGator:", contractAddress);

// Offchain signature for set code to the EOA
const authorization = await walletClient.signAuthorization({
  account: account,
  contractAddress: contractAddress,
  executor: "self",
});

console.log("🔍 Authorization signed to set the contract code to the EOA: ", authorization);
// Authorization transaction to set code to the EOA
const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: "0x",
  to: zeroAddress,
});

console.log("🔍 Set code with transaction (type 0x04), the EOA is now a smart account:", hash);

// Usage of the smart account
const addresses = await walletClient.getAddresses();
const address = addresses[0];

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: address,
  signer: { walletClient },
});

console.log("🔍 My EOA address: ", account.address);
console.log("🔍 My smart account address: ", smartAccount.address);

// Agnostic: use chain fees (for Pimlico, bundlerClient.getUserOperationGasPrice() is bundler-specific)
const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

// Stateless7702 accounts are deployed via EIP-7702 set code, not a factory.
// Exclude 'factory' so prepareUserOperation skips getFactoryArgs (which would throw).
const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [{
    to: env.DELEGATEE_ADDRESS as Address,
    value: parseEther("0.00002"),
  }],
  parameters: ["fees", "gas", "nonce", "signature", "authorization"],
  maxFeePerGas,
  maxPriorityFeePerGas,
});

console.log("🔍 0.00002 ETH sent from my smart account to ", env.DELEGATEE_ADDRESS);
console.log("🔍 User operation hash:", userOperationHash);

// Wait for first userOp to be mined before sending the second (avoids nonce conflicts)
await bundlerClient.waitForUserOperationReceipt({ hash: userOperationHash });
console.log("🔍 First user operation confirmed on-chain");

// Fetch fresh nonce after first op is confirmed to avoid stale/cached nonce issues
const nextNonce = await smartAccount.getNonce();
const userOperationHash2 = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [{
    to: env.DELEGATEE_ADDRESS as Address,
    value: parseEther("0.00003"),
  }],
  nonce: nextNonce,
  parameters: ["fees", "gas", "nonce", "signature", "authorization"],
  maxFeePerGas,
  maxPriorityFeePerGas,
});

console.log("🔍 0.00003 ETH sent from my smart account to ", env.DELEGATEE_ADDRESS);
console.log("🔍 User operation hash (2nd):", userOperationHash2);


const receipt2 = await bundlerClient.waitForUserOperationReceipt({
  hash: userOperationHash2,
  timeout: 60_000, // 60s timeout to avoid hanging if bundler drops the userOp
});

console.log("🔍 Second user operation confirmed on-chain:", receipt2.receipt.transactionHash);
