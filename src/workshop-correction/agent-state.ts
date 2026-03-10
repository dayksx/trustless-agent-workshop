/**
 * Workshop: Agent state annotation (LangGraph)
 *
 * State: messages + optional user-signed delegation (ERC-7710) passed at invoke time.
 * Used by: 1-agent-runtime
 */

import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/** State: messages + optional user-signed delegation (ERC-7710) passed at invoke time */
export const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  signedDelegation: Annotation<unknown>(),
});
