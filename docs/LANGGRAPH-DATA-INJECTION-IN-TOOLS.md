# LangGraph JS: Data Injection in Tools

This document explains how to pass runtime data (e.g. user context, signed delegations) from your LangGraph state into tools that your agent calls.

---

## Context

### State vs Config

In LangGraph:

| | **State** | **Config** |
|---|-----------|------------|
| **Purpose** | What the graph is working with | How the run is configured |
| **Defined by** | State annotation (e.g. `messages`, `signedDelegation`) | Invocation options |
| **Modified by** | Nodes (return values) | Caller (invoke options) |
| **Visible to** | Graph nodes | All runnables (including tools) |

**State** holds the graph’s data (messages, user context, etc.). **Config** is the `RunnableConfig` passed through the execution (callbacks, `configurable`, etc.).

### The Problem

Tools in LangGraph are invoked by the prebuilt `ToolNode`. The tool receives:

1. **Input** – arguments from the LLM (e.g. `recipient`, `amount`, `when`).
2. **Config** – the `RunnableConfig` from the graph run.

The prebuilt `ToolNode` does **not** pass graph state into tools. So tools cannot directly access state fields like `signedDelegation` in the input.

---

## Python vs JavaScript

**Python** has `InjectedState`:

```python
from langgraph.prebuilt import InjectedState

@tool
def my_tool(query: str, state: Annotated[dict, InjectedState]) -> str:
    delegation = state.get("signedDelegation")  # injected automatically
    ...
```

**LangGraph JS** does not have `InjectedState`. The supported way is to pass data via `configurable` and read it from `config` inside tools.

---

## Solutions in LangGraph JS

### Option 1: Pass via `configurable` at invoke time

Put your data in `configurable` when invoking the graph:

```ts
const signedDelegation = await createTransferDelegation(recipient, amount, null, context);

await agent.invoke(
  {
    messages: [new HumanMessage(`Transfer ${amount} ETH to ${recipient}`)],
    signedDelegation,
  },
  { configurable: { thread_id: "demo", signedDelegation } }
);
```

In your tool:

```ts
const transferTool = tool(
  async ({ recipient, amount, when }, config?: { configurable?: { signedDelegation?: unknown } }) => {
    const signedDelegation = config?.configurable?.signedDelegation;
    // ...
  },
  { name: "transfer", schema: z.object({ ... }) }
);
```

**Pros:** Simple, no graph changes.  
**Cons:** You must pass the same value in both input and `configurable` at every invocation point.

---

### Option 2: Custom ToolNode that injects state into config

Use a custom tools node that merges state into `config.configurable` before invoking tools:

```ts
import type { RunnableConfig } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";

const baseToolNode = new ToolNode(tools);

const toolNode = async (
  state: typeof AgentStateAnnotation.State,
  config?: RunnableConfig
) => {
  const enrichedConfig: RunnableConfig = {
    ...config,
    configurable: {
      ...config?.configurable,
      signedDelegation: state.signedDelegation,
    },
  };
  return baseToolNode.invoke(state, enrichedConfig);
};

const agent = new StateGraph(AgentStateAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  // ...
```

In your tool:

```ts
const transferTool = tool(
  async ({ recipient, amount, when }, config?: { configurable?: { signedDelegation?: unknown } }) => {
    const signedDelegation =
      config?.configurable?.signedDelegation ??
      (await createTransferDelegation(recipient, amount, when));
    // ...
  },
  { name: "transfer", schema: z.object({ ... }) }
);
```

**Pros:** Single source of truth (state); no duplication at every invocation point.  
**Cons:** One-time setup in the graph.

---

## Implementation in this workshop

This workshop uses **Option 1** (configurable at invoke time):

1. **Invoke** in `index.ts` – pass `signedDelegation` in both input and `configurable` when calling `agent.invoke()`.
2. **Transfer tool** in `2-agent-tools.ts` – reads `config.configurable.signedDelegation` when present; otherwise falls back to `createTransferDelegation()`.

Flow:

```text
invoke({ messages, signedDelegation }, { configurable: { thread_id, signedDelegation } })
  → config flows through the graph
  → transferTool receives config
  → tool uses config.configurable.signedDelegation
```

---

## Tool signature

LangChain tools receive a second argument for config:

```ts
tool(
  async (input, config) => {
    const injected = config?.configurable?.signedDelegation;
    // ...
  },
  { name: "my_tool", schema: z.object({ ... }) }
);
```

`config` is `RunnableConfig` from `@langchain/core/runnables`. For injected values, use `config.configurable` and type it as needed:

```ts
config?: { configurable?: { signedDelegation?: unknown } }
```

---

## References

- [LangGraphJS issue #287](https://github.com/langchain-ai/langgraphjs/issues/287) – passing graph state to tools via `configurable`
- [LangGraph Python: Pass runtime values to tools](https://langchain-ai.github.io/langgraph/how-tos/pass-run-time-values-to-tools/) – Python `InjectedState` pattern
