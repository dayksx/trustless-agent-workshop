# Delegation Scopes, Caveats, and Caveat Enforcer Clients

Reference for the MetaMask Delegation Framework (ERC-7710) used in this project. Scopes define the initial authority of a delegation; caveats add restrictions; caveat enforcer clients let you query state.

**Sources:** [MetaMask Smart Accounts Kit](https://docs.metamask.io/smart-accounts-kit/), [Delegation Framework](https://github.com/MetaMask/delegation-framework)

---

## 1. Delegation Scopes

Scopes define **what** the delegate is allowed to do. They are set in `createDelegation({ scope: { ... } })`.

| Scope Type | Key Parameters | Description |
|------------|----------------|-------------|
| **nativeTokenTransferAmount** | `maxAmount` (bigint) | Max native token (ETH) the delegate can transfer. Simple fixed limit. |
| **nativeTokenPeriodTransfer** | `periodAmount`, `periodDuration`, `startDate` | Per-period native token limit. Allowance resets each period. |
| **nativeTokenStreaming** | `initialAmount`, `maxAmount`, `amountPerSecond`, `startTime` | Linear streaming: initial amount + accrual rate, capped by max. |
| **erc20TransferAmount** | `tokenAddress`, `maxAmount` | Max ERC-20 the delegate can transfer. |
| **erc20PeriodTransfer** | `tokenAddress`, `periodAmount`, `periodDuration`, `startDate` | Per-period ERC-20 limit. |
| **erc20Streaming** | `tokenAddress`, `initialAmount`, `maxAmount`, `amountPerSecond`, `startTime` | Linear streaming for ERC-20. |
| **erc721Transfer** | `tokenAddress`, `tokenId` | Allows transfer of a specific ERC-721 token. |
| **functionCall** | `targets`, `selectors` (+ optional `allowedCalldata`, `exactCalldata`, `valueLte`) | Restricts to specific contract addresses and function selectors. |
| **ownershipTransfer** | `contractAddress` | Restricts to `transferOwnership(address)` on a given contract. |

> **Note:** `tokenSwapAmount` appears in `2-agent-tools.ts` but is **not** a supported MetaMask scope. There is no `TokenSwapAmountEnforcer` in the delegation framework. For swaps, use `nativeTokenTransferAmount` or `functionCall` with swap router targets/selectors instead.

### Scope Example (from `2-agent-tools.ts`)

```typescript
// Native token transfer
scope: {
  type: "nativeTokenTransferAmount",
  maxAmount: parseEther(amount),
}

// Function call (e.g. USDC approve)
scope: {
  type: "functionCall",
  targets: ["0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"],
  selectors: ["approve(address, uint256)"]
}
```

---

## 2. Caveats

Caveats add **restrictions** on top of the scope. They are passed in `createDelegation({ caveats: [...] })`. Each caveat maps to a caveat enforcer contract.

| Caveat Type | Enforcer Contract | Key Parameters | Description |
|-------------|-------------------|-----------------|-------------|
| **allowedTargets** | AllowedTargetsEnforcer | `targets` (Address[]) | Only these addresses can be called. |
| **allowedMethods** | AllowedMethodsEnforcer | `selectors` (MethodSelector[]) | Only these function selectors allowed. |
| **allowedCalldata** | AllowedCalldataEnforcer | `startIndex`, `value` | Calldata must match at given index. |
| **timestamp** | TimestampEnforcer | `afterThreshold`, `beforeThreshold` | Valid only within this time window (seconds). |
| **blockNumber** | BlockNumberEnforcer | `afterThreshold`, `beforeThreshold` | Valid only within this block range. |
| **limitedCalls** | LimitedCallsEnforcer | `limit` (number) | Max number of redemptions. |
| **id** | IdEnforcer | `id` | One-time use: redeeming one revokes others with same ID. |
| **nonce** | NonceEnforcer | `nonce` (Hex) | Bulk revocation via `incrementNonce()`. |
| **redeemer** | RedeemerEnforcer | `redeemers` (Address[]) | Only these addresses can redeem. |
| **valueLte** | ValueLteEnforcer | `maxValue` (bigint) | Max native token value per redemption. |
| **argsEqualityCheck** | ArgsEqualityCheckEnforcer | `args` (Hex) | Redeemer `args` must match exactly. |
| **exactCalldata** | ExactCalldataEnforcer | `calldata` | Calldata must match exactly. |
| **exactCalldataBatch** | ExactCalldataBatchEnforcer | `executions` | Batch calldata must match. |
| **exactExecution** | ExactExecutionEnforcer | `execution` | Target, value, calldata must match. |
| **exactExecutionBatch** | ExactExecutionBatchEnforcer | `executions` | Batch execution must match. |
| **nativeTokenTransferAmount** | NativeTokenTransferAmountEnforcer | `maxAmount` | Max native token transfer. |
| **nativeTokenPeriodTransfer** | NativeTokenPeriodTransferEnforcer | `periodAmount`, `periodDuration`, `startDate` | Per-period native limit. |
| **nativeTokenStreaming** | NativeTokenStreamingEnforcer | `initialAmount`, `maxAmount`, `amountPerSecond`, `startTime` | Streaming native limit. |
| **nativeTokenPayment** | NativeTokenPaymentEnforcer | `recipient`, `amount` | Redeemer must pay this amount to recipient. |
| **nativeBalanceChange** | NativeBalanceChangeEnforcer | `recipient`, `balance`, `changeType` | Recipient balance must change by amount. |
| **erc20TransferAmount** | ERC20TransferAmountEnforcer | `tokenAddress`, `maxAmount` | Max ERC-20 transfer. |
| **erc20PeriodTransfer** | ERC20PeriodTransferEnforcer | `tokenAddress`, `periodAmount`, `periodDuration`, `startDate` | Per-period ERC-20. |
| **erc20Streaming** | ERC20StreamingEnforcer | `tokenAddress`, `initialAmount`, `maxAmount`, `amountPerSecond`, `startTime` | Streaming ERC-20. |
| **erc20BalanceChange** | ERC20BalanceChangeEnforcer | `tokenAddress`, `recipient`, `balance`, `changeType` | ERC-20 balance change check. |
| **erc721Transfer** | ERC721TransferEnforcer | `tokenAddress`, `tokenId` | Specific ERC-721 transfer. |
| **erc721BalanceChange** | ERC721BalanceChangeEnforcer | `tokenAddress`, `recipient`, `balance`, `changeType` | ERC-721 balance change. |
| **erc1155BalanceChange** | ERC1155BalanceChangeEnforcer | `tokenAddress`, `recipient`, `tokenId`, `balance`, `changeType` | ERC-1155 balance change. |
| **multiTokenPeriod** | MultiTokenPeriodEnforcer | `tokenPeriodConfigs` | Multiple tokens with per-period limits. |
| **ownershipTransfer** | OwnershipTransferEnforcer | `contractAddress` | Only `transferOwnership` on contract. |
| **deployed** | DeployedEnforcer | `contractAddress`, `salt`, `bytecode` | Ensures contract is deployed; deploys if not. |
| **specificActionERC20TransferBatch** | SpecificActionERC20TransferBatchEnforcer | `tokenAddress`, `recipient`, `amount`, `target`, `calldata` | Batch: specific call + ERC-20 transfer. |

### Caveat Example (from `erc-7710-with-nativeTokenTransfer.ts`)

```typescript
caveats: [
  {
    type: "timestamp",
    afterThreshold: Math.floor(Date.now() / 1000) - 60,
    beforeThreshold: Math.floor(Date.now() / 1000) + 3600,
  },
  {
    type: "allowedTargets",
    targets: ["0xA7F36973465b4C3d609961Bc72Cc2E65acE26337"],
  },
],
```

---

## 3. Caveat Enforcer Client

`createCaveatEnforcerClient` extends a Viem client with methods to **read state** from caveat enforcers (e.g. remaining allowance).

### Creation

```typescript
import { createCaveatEnforcerClient } from "@metamask/smart-accounts-kit";

const caveatEnforcerClient = createCaveatEnforcerClient({
  client: publicClient,
  environment: delegator.environment,
});
```

### Client Methods

| Method | Caveat/Scope | Returns |
|--------|--------------|---------|
| `getNativeTokenPeriodTransferEnforcerAvailableAmount` | nativeTokenPeriodTransfer | `{ availableAmount }` for current period |
| `getNativeTokenStreamingEnforcerAvailableAmount` | nativeTokenStreaming | `{ availableAmount }` |
| `getErc20PeriodTransferEnforcerAvailableAmount` | erc20PeriodTransfer | `{ availableAmount }` for current period |
| `getErc20StreamingEnforcerAvailableAmount` | erc20Streaming | `{ availableAmount }` |
| `getMultiTokenPeriodEnforcerAvailableAmount` | multiTokenPeriod | `{ availableAmount }` (requires `args` with token index) |

### Example (from `erc-7710-with-nativeTokenPeriod.ts`)

```typescript
const { availableAmount } = await caveatEnforcerClient.getNativeTokenPeriodTransferEnforcerAvailableAmount({
  delegation,
});
console.log("Available native token transfer amount (remaining this period):", availableAmount);
```

---

## 4. Creating Custom Caveat Enforcers

### 4.1 Implement the Interface

Caveat enforcers implement `ICaveatEnforcer` with hooks:

- `beforeAllHook` – before any actions in a batch
- `beforeHook` – before execution for a specific delegation
- `afterHook` – after execution for a specific delegation
- `afterAllHook` – after all actions in a batch

Each hook receives: `_terms`, `_args`, `_mode`, `_executionCalldata`, `_delegationHash`, `_delegator`, `_redeemer`. Revert to block execution.

### 4.2 Example: After-Timestamp Enforcer

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { CaveatEnforcer } from "@delegator/src/enforcers/CaveatEnforcer.sol";
import { ModeCode } from "/smart-accounts-kit/utils/Types.sol";

contract AfterTimestampEnforcer is CaveatEnforcer {
  function beforeHook(
    bytes calldata _terms,
    bytes calldata,
    ModeCode,
    bytes calldata,
    bytes32,
    address,
    address
  ) public override {
    uint256 validAfter = uint256(bytes32(_terms));
    require(block.timestamp > validAfter, "AfterTimestampEnforcer:cannot-redeem-too-early");
  }
}
```

### 4.3 Deploy

```bash
forge create src/AfterTimestampEnforcer.sol:AfterTimestampEnforcer \
  --rpc-url https://sepolia.infura.io/v3/<API-KEY> \
  --private-key <PRIVATE-KEY> \
  --broadcast
```

### 4.4 Use in Delegation

```typescript
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import { toHex } from "viem";

const afterTimestampEnforcer = "0x22Ae4c4919C3aB4B5FC309713Bf707569B74876F"; // deployed address

const caveatBuilder = createCaveatBuilder(environment);
const validTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

const caveats = caveatBuilder
  .addCaveat("nativeTokenTransferAmount", parseEther("0.01"))
  .addCaveat({
    enforcer: afterTimestampEnforcer,
    terms: toHex(validTimestamp),
  })
  .build();

const delegation = {
  delegate: "AGENT2_SA_ADDRESS",
  delegator: delegatorSmartAccount.address,
  authority: ROOT_AUTHORITY,
  caveats,
  salt: "0x",
};
```

---

## 5. Best Practices

1. **Combine caveats** – Use multiple caveats for stronger restrictions (e.g. `timestamp` + `allowedTargets` + `nativeTokenTransferAmount`).
2. **Order matters** – For caveats that modify external state, order can affect validation (e.g. `nativeTokenPayment` before `nativeBalanceChange`).
3. **Avoid unbounded delegations** – Always add caveats to limit what the delegate can do.
4. **`startDate` in the past** – For period-based scopes, set `startDate` slightly in the past (e.g. `- 60` seconds) so the first period is active when you query.
5. **Redelegation** – Caveats stack; new caveats can only narrow, not widen, authority.

---

## 6. References

- [MetaMask Delegation Concepts](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/)
- [Caveat Enforcers](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/caveat-enforcers/)
- [Delegation Scopes Reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/)
- [Caveats Reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/)
- [Caveat Enforcer Client](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/)
- [Create Custom Caveat Enforcer Tutorial](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)
- [Delegation Framework (GitHub)](https://github.com/MetaMask/delegation-framework)
