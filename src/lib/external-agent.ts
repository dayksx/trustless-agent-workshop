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
import { createPublicClient, encodeFunctionData, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createExecution, ExecutionMode } from "@metamask/delegation-toolkit";
import { DelegationManager } from "@metamask/delegation-toolkit/contracts";
import { Implementation, toMetaMaskSmartAccount } from "@metamask/smart-accounts-kit";

/** Decode hex revert reason and return human-readable hints for all known error codes. */
function decodeRedeemDelegationError(message: string): string[] {
  const hints: string[] = [];
  const hexMatch = message.match(/0x[0-9a-fA-F]+/);
  const hex = hexMatch?.[0];
  if (!hex) return hints;

  // Error(string) selector = 0x08c379a0
  if (hex.startsWith("0x08c379a0") && hex.length > 10) {
    try {
      const data = hex.slice(10); // after selector
      const lenHex = data.slice(64, 128); // bytes 32-63 = length
      const len = parseInt(lenHex, 16);
      const strHex = data.slice(128, 128 + len * 2);
      const decoded = Buffer.from(strHex, "hex").toString("utf8");
      hints.push(`Decoded: ${decoded}`);

      // Map known Error(string) reasons to hints
      const errorHints: Record<string, string> = {
        "allowance-exceeded":
          "NativeTokenTransferAmountEnforcer: Amount exceeds delegation maxAmount, or delegation already redeemed. Use a unique salt per delegation; create a fresh one if already redeemed.",
        "target-address-not-allowed":
          "AllowedTargetsEnforcer: The execution target is not in the delegation's allowedTargets caveat. Add the target address to caveats.allowedTargets.targets.",
        "target-not-allowed": "AllowedTargetsEnforcer: Target not in allowedTargets. Add the target to caveats.",
        "method-not-allowed":
          "AllowedMethodsEnforcer: The function selector is not in the delegation's allowedMethods. Add the selector to caveats.allowedMethods.selectors.",
        "cannot-redeem-too-early":
          "TimestampEnforcer: Redeem is before afterThreshold. Wait until the delegation is valid.",
        "cannot-redeem-too-late":
          "TimestampEnforcer: Redeem is after beforeThreshold. Create a new delegation with extended validity.",
        "block-too-early": "BlockNumberEnforcer: Block is before afterThreshold.",
        "block-too-late": "BlockNumberEnforcer: Block is after beforeThreshold.",
        "limit-exceeded":
          "LimitedCallsEnforcer: Max redemptions reached. Create a new delegation.",
        "redeemer-not-allowed":
          "RedeemerEnforcer: The redeemer address is not in caveats.redeemer.redeemers.",
        "value-exceeds-max":
          "ValueLteEnforcer: Native value exceeds caveat maxValue.",
        "calldata-mismatch": "ExactCalldataEnforcer / AllowedCalldataEnforcer: Calldata does not match.",
        "execution-mismatch": "ExactExecutionEnforcer: Target, value, or calldata does not match.",
      };
      for (const [key, hint] of Object.entries(errorHints)) {
        if (decoded.toLowerCase().includes(key.replace(/-/g, "")) || decoded.includes(key)) {
          hints.push(hint);
          break;
        }
      }
    } catch {
      // ignore decode errors
    }
  }

  // DelegationManager custom errors (0xb5863604 and similar)
  if (hex.includes("b5863604")) {
    hints.push(
      "DelegationManager (0xb5863604): Possible causes — InvalidDelegate (delegate ≠ redeemer), CannotUseADisabledDelegation, insufficient delegator balance, or caveat enforcer failure.",
      "→ Ensure AGENT2_SA_ADDRESS matches the smart account from AGENT2_PRIVATE_KEY (DeleGator, not EOA).",
      "→ Fund the delegator on Base Sepolia. Check caveat limits (allowedTargets, nativeTokenTransferAmount, etc.)."
    );
  }

  // EntryPoint AAxx codes (from USER-OPERATION-ERRORS.md)
  const aaMatch = message.match(/AA(\d{2})/);
  if (aaMatch) {
    const aa = aaMatch[1];
    const aaHints: Record<string, string> = {
      "10": "AA10: Sender already constructed — remove initCode for existing accounts.",
      "13": "AA13: initCode failed or OOG — check factory, increase verificationGasLimit.",
      "20": "AA20: Account not deployed — include initCode for first transaction.",
      "21": "AA21: Didn't pay prefund — fund the account or use a paymaster.",
      "22": "AA22: Expired or not due — check validUntil/validAfter timestamps.",
      "23": "AA23: Reverted (OOG) — check signature, increase verificationGasLimit.",
      "24": "AA24: Signature error — verify private key and signature format.",
      "25": "AA25: Invalid account nonce — fetch current nonce before submitting.",
      "30": "AA30: Paymaster not deployed.",
      "31": "AA31: Paymaster deposit too low.",
      "32": "AA32: Paymaster expired or not due.",
      "33": "AA33: Paymaster reverted.",
      "40": "AA40: Over verification gas limit.",
      "41": "AA41: Too little verification gas.",
      "50": "AA50: PostOp reverted.",
      "51": "AA51: prefund below actualGasCost.",
    };
    if (aaHints[aa]) hints.push(aaHints[aa]);
  }

  return hints;
}

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
  /** For redelegation chains (user > agent1 > agent2): parent signed delegation. Chain order: [signedDelegation, parentDelegation] = leaf to root. */
  parentDelegation?: unknown;
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
  const { skill } = params;

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
 * For redelegation chains (user > agent1 > agent2), pass parentDelegation so the full
 * chain [signedDelegation, parentDelegation] (leaf to root) is sent to redeemDelegations.
 */
async function redeemDelegationOnChain(opts: {
  agentId: number;
  signedDelegation: unknown;
  /** Parent signed delegation for redelegation chains. Chain = [signedDelegation, parentDelegation] leaf→root. */
  parentDelegation?: unknown;
  execution: ReturnType<typeof createExecution>;
  successMessage: string;
}): Promise<any> {
  const { agentId, signedDelegation, parentDelegation, execution, successMessage } = opts;
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
      ...(process.env.USE_PAYMASTER === "true" && { paymaster: true as const }),
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

    // Delegation chain: leaf to root. For redelegation (user>agent1>agent2): [agent1->agent2, user->agent1]
    const delegationChain = parentDelegation
      ? [signedDelegation as any, parentDelegation as any]
      : [signedDelegation as any];
    const executions = [execution as any];

    const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
      delegations: [delegationChain],
      modes: [ExecutionMode.SingleDefault],
      executions: [executions],
    });

    console.log("🔗 Sending UserOps with Delegations chain [user->agent1] from [agent2]: ", delegateSmartAccount.address);

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

    const txHash = receipt.receipt?.transactionHash;


    const essential = {
      userOpHash: receipt.userOpHash,
      txHash,
      txUrl: txHash ? `https://sepolia.basescan.org/tx/${txHash}` : undefined,
      blockNumber: receipt.receipt?.blockNumber,
      success: receipt.success,
      gasUsed: receipt.actualGasUsed,
      gasCost: receipt.actualGasCost,
    };
    console.log(`✅ ${successMessage}\n`, JSON.stringify(essential, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

    return {
      result: {
        taskId: 1,
        hash: userOperationHash,
        message: successMessage,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Redeem delegation failed:", message);

    const hints = decodeRedeemDelegationError(message);
    if (hints.length > 0) {
      console.error("\nℹ️  Possible error reasons: ");
      hints.forEach((h) => console.error("  →", h));
    }

    return { error: { message } };
  }
}

/**
 * Redeem transfer delegation on-chain.
 */
async function redeemDelegationTransfer(params: CallExternalAgentParams): Promise<any> {
  const { agentId, signedDelegation, parentDelegation, recipient, amount } = params;
  if (!recipient || !amount) throw new Error("Missing recipient or amount");

  const execution = createExecution({
    target: recipient as `0x${string}`,
    value: parseEther(amount),
    callData: "0x",
  });

  return redeemDelegationOnChain({
    agentId,
    signedDelegation,
    parentDelegation,
    execution,
    successMessage: "Transfer successfully redeemed on-chain",
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
  });
}
