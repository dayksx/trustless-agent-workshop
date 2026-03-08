# LangGraph: Conditional Edges, Routing, and Agent Handoffs

This document covers patterns for routing and handoffs in LangGraph agents: conditional edges, routing to different nodes (tools vs. specialist LLM), and best practices.

---

## 1. Conditional Edges: One Function, Multiple Branches

You put **all conditions in a single** routing function. It inspects the state and returns the name of the target node. The third argument `["tools", END]` is the list of possible destinations.

### Example with Multiple Branches

```typescript
.addConditionalEdges(
  "llm",
  (state: { messages: BaseMessage[] }) => {
    const last = state.messages[state.messages.length - 1];

    // Condition 1: tool calls → tools node
    if (last instanceof AIMessage && last.tool_calls?.length) {
      return "tools";
    }

    // Condition 2: handoff tool → specialist node
    const handoff = last.tool_calls?.find(tc => tc.name === "route_to_specialist");
    if (handoff) return "llm_specialist";

    // Condition 3: otherwise → end
    return END;
  },
  ["tools", "llm_specialist", END]
);
```

### Other Routing Ideas

| Condition | Destination | Use case |
|-----------|-------------|----------|
| `tool_calls?.length` | `tools` | LLM wants to call tools |
| `handoff tool call` | `llm_specialist` | Delegate to specialist agent |
| `iteration count > N` | `END` | Prevent infinite loops |
| Explicit request | `human_review` | Human approval before execution |
| Request type | `transfer` / `swap` / `general` | Route to specialized nodes |

---

## 2. Handing Off to Another LLM

### Option A: Tool-Based Handoff (Recommended)

The agent decides by **calling a tool** instead of writing text. Routing is based on the presence of a tool call, not on parsing message content.

**Official pattern**: LangChain/OpenAI document this as the "handoffs" pattern.

**How it works**:

1. Add a handoff tool to the model's tool list (e.g. `route_to_specialist`).
2. The agent calls it when it wants to delegate.
3. The conditional edge checks for this tool call and routes to `llm_specialist` instead of the ToolNode.

The handoff tool is a **real tool** — the agent sees it in its available tools and can call it. The "trick" is that when the agent calls it, we route to another node instead of sending it to the ToolNode.

### Option B: State Field + Structured Output

Enrich the state with a `next_node` field that the LLM fills via structured output.

**Mechanism**: Use `withStructuredOutput()` so the model returns JSON with `content` and `next_node`:

```typescript
const LLMOutputSchema = z.object({
  content: z.string().describe("Your response to the user"),
  next_node: z.enum(["tools", "llm_specialist", "end"])
    .describe("Where to route next: tools for tool calls, llm_specialist to delegate, end to finish"),
});

const modelWithStructuredOutput = model.withStructuredOutput(LLMOutputSchema);
```

**When**: On every LLM invocation, the model outputs both its content and `next_node`.

**When**: The schema forces the model to always include `next_node` in its response.

**Limitation**: Structured output typically conflicts with native tool calls. You may need two separate calls or a schema that includes tool calls (if supported).

---

## 3. Is the Handoff Tool a "Fake" Tool?

### Short Answer

Yes — it's a **routing tool**: its only purpose is to signal a decision, not to perform business logic.

### Official Pattern

LangChain documents this as the **official handoff pattern** (term coined by OpenAI).

There are two variants:

1. **Official pattern**: The tool **executes** and returns a `Command` for routing. It updates state and specifies the next node. The tool does real work (updating routing state).
2. **Simplified variant**: Intercept at the conditional edge before the ToolNode runs. The tool never executes; we use the tool call as a routing signal.

### Implementation Options

**Option 1 — Tool executes and returns `Command`**

```typescript
const transferToSpecialist = tool(
  async (_, runtime: ToolRuntime<typeof State>) => {
    const transferMessage = new ToolMessage({
      content: "Transferred to specialist",
      tool_call_id: runtime.toolCallId,
    });
    return new Command({
      goto: "llm_specialist",
      update: {
        activeAgent: "llm_specialist",
        messages: [lastAiMessage, transferMessage],
      },
      graph: Command.PARENT,
    });
  },
  {
    name: "transfer_to_specialist",
    description: "Transfer to the specialist agent.",
    schema: z.object({}),
  }
);
```

**Option 2 — Minimal tool + conditional edge interception**

```typescript
const routeToSpecialistTool = tool(
  async () => ({ handoff: true }),  // no-op, we never reach here
  {
    name: "route_to_specialist",
    description: "Call this tool to hand off to the specialist agent.",
    schema: z.object({
      task_instructions: z.string(),
    }),
  }
);
```

---

## 4. Why `tool_calls` Contains Node Names

The agent does **not** put node names in `tool_calls`. It calls a **tool** named `route_to_specialist`.

- `route_to_specialist` is a real tool in the model's tool list.
- The agent sees it and can call it.
- When the agent calls it, we intercept at the conditional edge and route to `llm_specialist` instead of the ToolNode.

So `tool_calls` always contains tool names. The routing tool is a special tool whose purpose is to drive control flow.

---

## 5. Approach Comparison

| Approach | How the LLM decides | Explicit decision | No parsing | Complexity |
|----------|--------------------|-------------------|------------|------------|
| **Routing tool** | Calls a tool | ✅ | ✅ | Low |
| **State + structured output** | Fills `next_node` in JSON | ✅ | ✅ | Medium |
| **Router LLM** | Separate small model for routing | ✅ | ✅ | Medium |
| **String parsing** | Content analysis | ❌ | ❌ | Low |

---

## 6. References

- [LangChain Handoffs — Docs](https://docs.langchain.com/oss/javascript/langchain/multi-agent/handoffs)
- [LangGraph create_handoff_tool](https://reference.langchain.com/python/langgraph-swarm/handoff/create_handoff_tool)
- [OpenAI Agents — Handoffs](https://openai.github.io/openai-agents-python/handoffs/)
