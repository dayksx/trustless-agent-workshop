import "dotenv/config";

import type { Address } from "viem";
import { createPublicClient, encodeFunctionData, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient } from "viem/account-abstraction";
import { createDelegation, Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";
import { createExecution, ExecutionMode } from "@metamask/delegation-toolkit"
import { DelegationManager } from "@metamask/delegation-toolkit/contracts"

const env = process.env;
if (!env.DELEGATOR_PRIVATE_KEY || !env.DELEGATEE_ADDRESS || !env.BUNDLER_SEPOLIA_URL || !env.DELEGATEE_PRIVATE_KEY) {
  throw new Error("Missing DELEGATOR_PRIVATE_KEY, DELEGATEE_ADDRESS, DELEGATEE_PRIVATE_KEY or BUNDLER_SEPOLIA_URL in .env");
}
const BUNDLER_URL = env.BUNDLER_SEPOLIA_URL;

// Chain mismatch causes error 0x3db6791c (function selector not recognized).
// Use Pimlico URL with chain name: https://api.pimlico.io/v2/sepolia/rpc?apikey=...
// Avoid numeric chain ID in URL (e.g. /11155111/) as it may route to a different network.

// ---------------------------------------------------------------------------
// ERC-7710 with Gator implementation
// ---------------------------------------------------------------------------

const publicClient = createPublicClient({
    chain: sepolia,
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
        type: "functionCall",
        targets: ["0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"], // USDC address on Sepolia.
        selectors: ["approve(address, uint256)"]
    },
    caveats: [],
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

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const SPENDER_ADDRESS = delegate.address; // Delegate can spend approved USDC on delegator's behalf

const execution = createExecution({
    target: USDC_ADDRESS,
    value: 0n,
    callData: encodeFunctionData({
        abi: [
            {
                name: "approve",
                type: "function",
                inputs: [
                    { name: "spender", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                outputs: [{ type: "bool" }],
            },
        ],
        functionName: "approve",
        args: [SPENDER_ADDRESS, parseUnits("100", 6)], // 100 USDC (6 decimals)
    }),
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

const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOperation });
console.log("🔍 User operation hash:", userOperation);
console.log("🔍 Transaction hash:", receipt.receipt.transactionHash);
console.log("🔍 USDC approve: delegator", delegator.address, "approved 100 USDC for spender", SPENDER_ADDRESS);