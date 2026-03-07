# x402 Payment Protocol – Technical Guide

This document explains the x402 payment protocol technically and how to send HTTP requests with x402 payment included.

## What is x402?

x402 is an open, HTTP-native payment protocol that revives the [HTTP 402 Payment Required](https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.2) status code. It enables:

- **Micropayments** without accounts, KYC, or traditional payment rails
- **Pay-per-use APIs** (e.g. $0.01 per request)
- **Machine-to-machine payments** (AI agents paying for services)

Payments are settled on-chain (e.g. USDC on Base Sepolia) and verified via a facilitator service.

---

## Payment Flow (High Level)

```
┌─────────┐                    ┌─────────┐                    ┌──────────────┐
│ Client  │                    │ Server  │                    │ Facilitator  │
│ (Buyer) │                    │ (Seller)│                    │ (CDP/x402)   │
└────┬────┘                    └────┬────┘                    └──────┬───────┘
     │                              │                                │
     │  1. HTTP Request (no payment)│                                │
     │ ───────────────────────────►│                                │
     │                              │                                │
     │  2. 402 Payment Required      │                                │
     │     + payment requirements   │                                │
     │ ◄───────────────────────────│                                │
     │                              │                                │
     │  3. Create payment on-chain  │                                │
     │     (USDC transfer)          │                                │
     │ ─────────────────────────────────────────────────────────────►│
     │                              │                                │
     │  4. Retry request with       │                                │
     │     X-PAYMENT header         │                                │
     │ ───────────────────────────►│                                │
     │                              │  5. Verify + settle             │
     │                              │ ─────────────────────────────►│
     │                              │ ◄─────────────────────────────│
     │  6. 200 OK + resource        │                                │
     │ ◄───────────────────────────│                                │
     │                              │                                │
```

1. **Client** sends a normal HTTP request (GET or POST).
2. **Server** responds with **HTTP 402** and payment requirements in the response body.
3. **Client** creates a payment on-chain (e.g. USDC transfer to `payTo`).
4. **Client** retries the same request with the **X-PAYMENT** header (base64-encoded signed payload).
5. **Server** verifies the payment via the facilitator and settles.
6. **Server** returns **200 OK** with the resource.

---

## HTTP Headers (x402 v1 – used by this workshop)

This workshop uses `x402-express` v0.7.x, which follows **x402 v1**:

| Header | Direction | Purpose |
|--------|-----------|---------|
| **X-PAYMENT** | Client → Server | Base64-encoded signed payment payload. Sent when retrying after 402. |
| **X-PAYMENT-RESPONSE** | Server → Client | Base64-encoded settlement confirmation. Returned on successful 200. |
| **PAYMENT-REQUIRED** | Server → Client | Base64-encoded payment requirements. Often in 402 response **body** instead of header. |

> **Note:** x402 v2 uses `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE` instead of `X-PAYMENT` and `X-PAYMENT-RESPONSE`. The v2 packages (`@x402/*`) use the new header names.

---

## 402 Response Structure

When you call a paid endpoint without payment, the server returns **HTTP 402** with a JSON body like:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10000",
      "resource": "http://localhost:3000/paid-service",
      "description": "Paid chat with Workshop Swap Coordinator",
      "mimeType": "",
      "payTo": "0x224b11F0747c7688a10aCC15F785354aA6493ED6",
      "maxTimeoutSeconds": 60,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "outputSchema": { "input": { "type": "http", "method": "POST", "discoverable": true } },
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `x402Version` | Protocol version (1 for this workshop). |
| `error` | Human-readable error (e.g. "X-PAYMENT header is required"). |
| `accepts` | Array of payment options the server accepts. |
| `accepts[].scheme` | Payment scheme (e.g. `"exact"` for fixed-amount USDC). |
| `accepts[].network` | Chain (e.g. `"base-sepolia"`). |
| `accepts[].maxAmountRequired` | Amount in smallest units (e.g. 10000 = $0.01 USDC, 6 decimals). |
| `accepts[].payTo` | Address to send payment to. |
| `accepts[].asset` | Token contract (e.g. USDC on Base Sepolia). |
| `accepts[].resource` | URL of the paid resource. |

---

## How to Send a Request with x402 Payment

You have two main options: **automatic** (recommended) or **manual**.

### Option A: Automatic – Use x402-axios or @x402/fetch

The x402 client packages handle the 402 flow for you: they detect 402, create the payment, sign it, and retry with the correct header.

**Workshop CLI (x402-axios):** This project already uses `x402-axios` for the `paid` command:

```bash
# Requires EVM_PRIVATE_KEY in .env (EOA with USDC on Base Sepolia)
pnpm run call-services paid --message "Swap 0.001 ETH to USDC"
```

**1. Example with `x402-axios` (v1, matches x402-express server):**

```typescript
import { withPaymentInterceptor, createSigner } from "x402-axios";
import axios from "axios";

const signer = await createSigner("base-sepolia", process.env.EVM_PRIVATE_KEY as `0x${string}`);
const api = withPaymentInterceptor(axios.create({ baseURL: "http://localhost:3000" }), signer);

const response = await api.post("/paid-service", { message: "Swap 0.001 ETH to USDC" });
console.log(response.data);
```

**2. Example with `@x402/fetch` (v2):**

```typescript
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Signer must hold USDC on Base Sepolia
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Payment is handled automatically (402 → pay → retry)
const response = await fetchWithPayment("http://localhost:3000/paid-service", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Swap 0.001 ETH to USDC" }),
});

const data = await response.json();
console.log(data);
```

**3. Example with `@x402/axios`:**

```typescript
import { x402Client, withPaymentInterceptor, x402HTTPClient } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const api = withPaymentInterceptor(
  axios.create({ baseURL: "http://localhost:3000" }),
  client,
);

const { data } = await api.post("/paid-service", {
  message: "Swap 0.001 ETH to USDC",
});
console.log(data);
```

**Prerequisites:**

- `EVM_PRIVATE_KEY` for an EOA that holds USDC on Base Sepolia
- USDC on Base Sepolia (e.g. from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))

---

### Option B: Manual – Parse 402, Pay, Retry with X-PAYMENT

If you implement the flow yourself:

**Step 1: Initial request (no payment)**

```bash
curl -i -X POST http://localhost:3000/paid-service \
  -H "Content-Type: application/json" \
  -d '{"message":"Swap 0.001 ETH to USDC"}'
```

**Step 2: Parse the 402 response**

- Status: `402 Payment Required`
- Body: JSON with `accepts` array
- Pick one `accept` (e.g. `scheme: "exact"`, `network: "base-sepolia"`)

**Step 3: Create payment on-chain**

- Send USDC from your wallet to `payTo` for the required amount
- Use the `asset` contract address (USDC)
- Amount: `maxAmountRequired` in token decimals (USDC = 6)

**Step 4: Build the X-PAYMENT payload**

The `X-PAYMENT` header must be a **base64-encoded JSON** object. The exact schema depends on the scheme and x402 version. For the `exact` scheme on EVM, it typically includes:

- `x402Version`
- `scheme`, `network`
- `payload`: transaction hash and related data
- Signature over the payment authorization

Implementing this manually is complex; use the x402 client SDKs instead.

**Step 5: Retry with X-PAYMENT header**

```bash
curl -X POST http://localhost:3000/paid-service \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64-encoded-payment-payload>" \
  -d '{"message":"Swap 0.001 ETH to USDC"}'
```

---

## Workshop Configuration

The paid endpoint in this workshop is configured in `3-agent-services.ts`:

```typescript
app.use(
  paymentMiddleware(payTo, {
    "/paid-service": {
      price: "$0.01",
      network: "base-sepolia",
      config: { description: "Paid chat with Workshop Swap Coordinator" },
    },
  })
);
```

- **Price:** $0.01 USDC
- **Network:** Base Sepolia
- **PayTo:** From `PAY_TO_ADDRESS` or default `0x224b11F0747c7688a10aCC15F785354aA6493ED6`

---

## Facilitator

The server verifies and settles payments via an x402 **facilitator**:

- **CDP (production):** `https://api.cdp.coinbase.com/platform/v2/x402` (requires API keys)
- **x402.org (testnet):** `https://x402.org/facilitator` (Base Sepolia, no auth)

The `x402-express` middleware uses a default facilitator; you can override it in the middleware config.

---

## References

- [x402 Protocol](https://x402.org)
- [Learn x402](https://learnx402.dev)
- [Coinbase CDP x402 Docs](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 GitBook](https://x402.gitbook.io/x402)
- [x402 GitHub](https://github.com/coinbase/x402)
