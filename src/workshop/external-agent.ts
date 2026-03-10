/**
 * Workshop: Redeem Delegation from External Agent
 *
 * callExternalAgent - Redeems a delegation locally without calling an external A2A agent.
 *
 * Used by workshop step 3 when EXTERNAL_SWAP_AGENT_URL is not needed:
 * instead of delegating to an external swap agent, this directly redeems the
 * signed delegation on-chain.
 *
 * Requires: AGENT2_PRIVATE_KEY, BUNDLER_BASE_SEPOLIA_URL
 */

import "dotenv/config";
import { createPublicClient, encodeFunctionData, formatEther, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createExecution, ExecutionMode } from "@metamask/delegation-toolkit";
import { DelegationManager } from "@metamask/delegation-toolkit/contracts";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";

const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006" as const;
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const SWAP_ROUTER_02_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface CallExternalAgentParams {
  agentId: number;
  skill: "transfer" | "swap";
  signedDelegation: unknown;
  when?: string | null;
  // transfer-specific
  recipient?: string;
  amount?: string;
  // swap-specific
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
}

/**
 * Redeems a delegation on-chain without calling an external agent (MOCKED).
 * Routes to different redeeming logic based on skill.
 */
export async function callExternalAgent(params: CallExternalAgentParams): Promise<any> {
  const { agentId, skill, signedDelegation } = params;

  switch (skill) {
    case "transfer":
      return redeemDelegationTransfer(params);
    case "swap":
      return redeemDelegationSwap(params);
    default:
      return { error: { message: `Unknown skill: ${skill}` } };
  }
}

/**
 * Shared logic: redeem a delegation on-chain with the given execution.
 */
async function redeemDelegationOnChain(opts: {
  agentId: number;
  signedDelegation: unknown;
  execution: ReturnType<typeof createExecution>;
  successMessage: string;
  amountForError?: string;
}): Promise<any> {
  const { agentId, signedDelegation, execution, successMessage, amountForError } = opts;
  const env = process.env;
  const delegatePrivateKey = env.AGENT2_PRIVATE_KEY as `0x${string}` | undefined;
  const bundlerBaseSepoliaUrl = env.BUNDLER_BASE_SEPOLIA_URL as string | undefined;

  if (!delegatePrivateKey || !bundlerBaseSepoliaUrl) throw new Error("Missing AGENT2_PRIVATE_KEY or BUNDLER_BASE_SEPOLIA_URL in environment");
  if (!signedDelegation) throw new Error("Delegation missing signedDelegation");

  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const bundlerClient = createBundlerClient({
      client: publicClient,
      transport: http(bundlerBaseSepoliaUrl),
      paymaster: process.env.USE_PAYMASTER === "true",
    });

    const delegateAccount = privateKeyToAccount(delegatePrivateKey as `0x${string}`);

    const delegateSmartAccount = await toMetaMaskSmartAccount({
      client: publicClient as any,
      implementation: Implementation.Hybrid,
      deployParams: [delegateAccount.address, [], [], []],
      deploySalt: "0x",
      signer: { account: delegateAccount },
    });

    const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

    const delegations = [signedDelegation as any];
    const executions = [execution as any];

    const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
      delegations: [delegations],
      modes: [ExecutionMode.SingleDefault],
      executions: [executions],
    });

    console.log(`[mock agentId=${agentId}] delegate address:`, delegateSmartAccount.address);
    const userOperationHash = await bundlerClient.sendUserOperation({
      account: delegateSmartAccount,
      calls: [
        {
          to: delegateSmartAccount.address,
          data: redeemDelegationCalldata,
        },
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOperationHash,
    });

    console.log(
      ` ${successMessage} \n`,
      JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );

    return {
      result: {
        taskId: 1,
        hash: userOperationHash,
        message: successMessage,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Redeem delegation failed:", message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    // Decode allowance-exceeded (0x08c379a0 = Error(string))
    if (message.includes("allowance-exceeded") || message.includes("616c6c6f77616e63652d6578636565646564")) {
      console.error(
        `\n--- NativeTokenTransferAmountEnforcer: allowance-exceeded ---\n` +
          `  The transfer amount exceeds the delegation's maxAmount (caveat).\n` +
          `  Each delegation has a one-time allowance. If you already redeemed this delegation,\n` +
          `  create a fresh one. Ensure the amount in the tool matches the delegation's maxAmount.\n`
      );
    }
    // Decode common simulation revert: 0xb5863604 (may be balance, caveat, or other delegation issue)
    else if (message.includes("0xb5863604")) {
      const delegatorAddr = (signedDelegation as { delegator?: string })?.delegator;
      const amountNeededStr = amountForError ?? env.REDEEM_VALUE_ETH ?? "0";
      const amountNeededWei = parseEther(amountNeededStr);

      if (delegatorAddr) {
        try {
          const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(),
          });
          const balance = await publicClient.getBalance({ address: delegatorAddr as `0x${string}` });
          const isSufficientForTransfer = balance >= amountNeededWei;

          console.error(
            `\n--- Delegator account (0xb5863604) ---\n` +
              `  Smart account:   ${delegatorAddr}\n` +
              `  Current balance: ${formatEther(balance)} ETH\n` +
              `  Transfer amount: ${amountNeededStr} ETH\n`
          );
          if (isSufficientForTransfer) {
            console.error(
              `  Balance is sufficient. 0xb5863604 is likely InvalidDelegate:\n` +
                `  - The delegate in the delegation must match the redeemer (msg.sender).\n` +
                `  - Ensure AGENT2_PRIVATE_KEY is set when creating delegations (2-agent-tools)\n` +
                `    so the delegator uses the correct DeleGator address, not AGENT2_EOA_ADDRESS (EOA).\n` +
                `  - Or: AGENT2_SA_ADDRESS must be the DeleGator address, not the EOA.\n`
            );
          } else {
            console.error(
              `  Insufficient: need at least ${amountNeededStr} ETH (+ gas if not using paymaster).\n` +
                `  Fund: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n`
            );
          }
        } catch (balanceErr) {
          console.error(
            `\n--- Delegator account ---\n` +
              `  Smart account: ${delegatorAddr}\n` +
              `  Amount needed: ${amountNeededStr} ETH\n`
          );
        }
      } else {
        console.error(
          "\nTroubleshooting 0xb5863604: Check delegator balance, caveat enforcers, and delegation status."
        );
      }
    }
    return {
      error: {
        message,
      },
    };
  }
}

/**
 * Redeem transfer delegation on-chain.
 */
async function redeemDelegationTransfer(params: CallExternalAgentParams): Promise<any> {
  const { agentId, signedDelegation, recipient, amount } = params;
  if (!recipient || !amount) throw new Error("Missing recipient or amount");

  const execution = createExecution({
    target: recipient as `0x${string}`,
    value: parseEther(amount),
    callData: "0x",
  });

  return redeemDelegationOnChain({
    agentId,
    signedDelegation,
    execution,
    successMessage: "Transfer successfully redeemed on-chain",
    amountForError: amount,
  });
}

/**
 * Redeem swap delegation on-chain.
 * ETH→USDC: Uses WETH as tokenIn and sends native ETH as value (router wraps internally).
 * WETH→USDC: Uses WETH as tokenIn, value=0 (delegator must hold WETH).
 */
async function redeemDelegationSwap(params: CallExternalAgentParams): Promise<any> {
  const { agentId, signedDelegation, tokenIn, tokenOut, amountIn } = params;
  if (!tokenIn || !tokenOut || !amountIn) throw new Error("Missing tokenIn, tokenOut or amountIn");

  const delegatorAddr =
    (signedDelegation as { delegator?: string })?.delegator ??
    (signedDelegation as { from?: string })?.from;
  if (!delegatorAddr) throw new Error("Delegation missing delegator/from address");

  const uniswapSwapRouter02 =
    (process.env.UNISWAP_SWAP_ROUTER_02 as `0x${string}`) ??
    ("0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as `0x${string}`); // Base Sepolia

  // ETH or WETH → USDC: Uniswap V3 pools trade ERC20s only, so we use WETH.
  // Native ETH: send value, router wraps and swaps. WETH: value=0, delegator must hold WETH.
  const isNativeEth =
    tokenIn.toLowerCase() === "eth" ||
    tokenIn.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  const tokenInAddr = isNativeEth ? (WETH_BASE_SEPOLIA as `0x${string}`) : (tokenIn as `0x${string}`);
  const tokenOutAddr =
    tokenOut.toLowerCase() === "usdc"
      ? (USDC_BASE_SEPOLIA as `0x${string}`)
      : (tokenOut as `0x${string}`);

  const amountInWei = parseEther(amountIn);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

  const callData = encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        fee: 3000, // 0.3% pool (common for WETH/USDC)
        recipient: delegatorAddr as `0x${string}`,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: 0n, // TODO: add slippage protection via QuoterV2
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const execution = createExecution({
    target: uniswapSwapRouter02,
    value: isNativeEth ? amountInWei : 0n,
    callData,
  });

  return redeemDelegationOnChain({
    agentId,
    signedDelegation,
    execution,
    successMessage: "Swap successfully redeemed on-chain",
    amountForError: amountIn,
  });
}
