import "dotenv/config";

import type { Address, Chain, Hex } from "viem";
import { createPublicClient, createWalletClient, http, parseEther, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient } from "viem/account-abstraction";
import { createDelegation, Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";
import { createExecution, ExecutionMode } from "@metamask/delegation-toolkit"
import { DelegationManager } from "@metamask/delegation-toolkit/contracts"

const env = process.env;
if (!env.DELEGATOR_PRIVATE_KEY || !env.DELEGATEE_ADDRESS || !env.BUNDLER_BASE_SEPOLIA_URL || !env.DELEGATEE_PRIVATE_KEY || !env.DELEGATEE_ADDRESS) {
  throw new Error("Missing DELEGATOR_PRIVATE_KEY, DELEGATEE_ADDRESS, DELEGATEE_PRIVATE_KEY, DELEGATEE_ADDRESS or BUNDLER_URL in .env");
}
const BUNDLER_URL = env.BUNDLER_URL;

// ---------------------------------------------------------------------------
// ERC-7710 with Gator implementation
// ---------------------------------------------------------------------------

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const bundlerClient = createBundlerClient({
    client: publicClient,
    transport: http(BUNDLER_URL),
    // Pimlico exposes pm_getPaymasterData on the same RPC; use it to sponsor gas for the delegate SA
    paymaster: true,
});

const delegatorAccount = privateKeyToAccount(env.DELEGATOR_PRIVATE_KEY as `0x${string}`);

const delegator = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: "0x",
    signer: { account: delegatorAccount }
});

console.log("🔍 Delegator EOA address:", delegatorAccount.address);
console.log("🔍 Delegator SA address:", delegator.address);

const delegateAccount = privateKeyToAccount(env.DELEGATEE_PRIVATE_KEY as `0x${string}`);

const delegate = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [delegateAccount.address, [], [], []],
    deploySalt: "0x",
    signer: { account: delegateAccount }
});

console.log("🔍 Delegate EOA address:", delegateAccount.address);
console.log("🔍 Delegate SA address:", delegate.address);

const delegation = createDelegation({
    to: delegate.address,
    from: delegator.address,
    environment: delegator.environment,
    scope: {
        type: "nativeTokenTransferAmount",
        maxAmount: parseEther("0.000001"),
    },
    caveats: [
        // afterThreshold must be in the past: block.timestamp can lag behind wall clock during simulation
        { 
            type: "timestamp", 
            afterThreshold: Math.floor(Date.now() / 1000) - 60, 
            beforeThreshold: Math.floor(Date.now() / 1000) + 3600 
        },
        {
            type: "allowedTargets",
            targets: [
              "0xA7F36973465b4C3d609961Bc72Cc2E65acE26337",
            ]
          }
    ],
});


console.log("🔍 Delegation created: ", delegation);
  
const signature = await delegator.signDelegation({
    delegation,
});


const signedDelegation = {
    ...delegation,
    signature,
};

console.log("🔍 Delegation ready:", signature);


const delegations = [signedDelegation]

const execution = createExecution({
    target: "0xA7F36973465b4C3d609961Bc72Cc2E65acE26337",
    value: parseEther("0.000000042"), // 0.01 ETH in wei
    callData: "0x",
});

const executions = [execution];
const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

// executions must be ExecutionStruct[][] - array of batches, each batch is ExecutionStruct[]
const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
    delegations: [delegations],
    modes: [ExecutionMode.SingleDefault],
    executions: [executions],
});

const userOperation = await bundlerClient.sendUserOperation({
    account: delegate,
    calls: [
        {
            to: delegate.address,
            data: redeemDelegationCalldata,
        }
    ],
    maxFeePerGas,
    maxPriorityFeePerGas,
});

bundlerClient.waitForUserOperationReceipt({ hash: userOperation });

console.log("🔍 0xA7F36973465b4C3d609961Bc72Cc2E65acE26337 received 0.000042 ETH from", delegator.address);

console.log("🔍 User operation hash:", userOperation);