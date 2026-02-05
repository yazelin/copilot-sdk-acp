/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * ACP (Agent Client Protocol) message types.
 * @module protocols/acp/acp-types
 */

/**
 * ACP protocol version
 */
export const ACP_PROTOCOL_VERSION = 1;

/**
 * Base ACP message structure (JSON-RPC 2.0 compatible)
 */
export interface AcpMessage {
    jsonrpc: "2.0";
    id?: string | number;
}

/**
 * ACP request message
 */
export interface AcpRequest extends AcpMessage {
    id: string | number;
    method: string;
    params?: unknown;
}

/**
 * ACP response message
 */
export interface AcpResponse extends AcpMessage {
    id: string | number;
    result?: unknown;
    error?: AcpError;
}

/**
 * ACP notification message (no id, no response expected)
 */
export interface AcpNotification extends AcpMessage {
    method: string;
    params?: unknown;
}

/**
 * ACP error object
 */
export interface AcpError {
    code: number;
    message: string;
    data?: unknown;
}

// ============================================================================
// ACP Initialize Types
// ============================================================================

/**
 * ACP initialize request params
 */
export interface AcpInitializeParams {
    protocolVersion: number;
}

/**
 * ACP initialize response
 */
export interface AcpInitializeResult {
    protocolVersion: number;
    capabilities?: AcpServerCapabilities;
}

/**
 * Server capabilities reported by ACP server
 */
export interface AcpServerCapabilities {
    streaming?: boolean;
    tools?: boolean;
}

// ============================================================================
// ACP Session Types
// ============================================================================

/**
 * ACP session/new request params
 */
export interface AcpSessionNewParams {
    cwd?: string;
    mcpServers?: Record<string, AcpMcpServerConfig>;
}

/**
 * ACP MCP server configuration
 */
export interface AcpMcpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

/**
 * ACP session/new response
 */
export interface AcpSessionNewResult {
    sessionId: string;
}

/**
 * ACP content part (for prompt messages)
 */
export interface AcpContentPart {
    type: "text";
    text: string;
}

/**
 * ACP session/prompt request params
 */
export interface AcpSessionPromptParams {
    sessionId: string;
    prompt: AcpContentPart[];
}

/**
 * ACP session/prompt response
 */
export interface AcpSessionPromptResult {
    messageId: string;
}

// ============================================================================
// ACP Update Notification Types
// ============================================================================

/**
 * ACP content structure
 */
export interface AcpTextContent {
    type: "text";
    text: string;
}

/**
 * ACP update inner structure
 */
export interface AcpUpdateInner {
    sessionUpdate: "agent_message_chunk" | "agent_thought_chunk" | "agent_message" | "end_turn" | "error";
    content?: AcpTextContent;
    message?: string;
    code?: string;
}

/**
 * ACP session/update notification params (actual Gemini format)
 */
export interface AcpSessionUpdateParams {
    sessionId: string;
    update: AcpUpdateInner;
}

/**
 * Legacy flat format types (for backwards compatibility in tests)
 */
export interface AcpAgentMessageChunkParams {
    sessionId: string;
    type: "agent_message_chunk";
    messageId: string;
    content: string;
}

export interface AcpAgentThoughtChunkParams {
    sessionId: string;
    type: "agent_thought_chunk";
    messageId: string;
    content: string;
}

export interface AcpAgentMessageParams {
    sessionId: string;
    type: "agent_message";
    messageId: string;
    content: string;
}

export interface AcpEndTurnParams {
    sessionId: string;
    type: "end_turn";
}

export interface AcpErrorParams {
    sessionId: string;
    type: "error";
    message: string;
    code?: string;
}

/**
 * Union of legacy flat update types
 */
export type AcpSessionUpdate =
    | AcpAgentMessageChunkParams
    | AcpAgentThoughtChunkParams
    | AcpAgentMessageParams
    | AcpEndTurnParams
    | AcpErrorParams;

// ============================================================================
// Method Name Mappings
// ============================================================================

/**
 * Copilot to ACP method name mapping
 */
export const COPILOT_TO_ACP_METHODS: Record<string, string> = {
    ping: "initialize",
    "session.create": "session/new",
    "session.send": "session/prompt",
};

/**
 * ACP to Copilot notification mapping
 */
export const ACP_TO_COPILOT_NOTIFICATIONS: Record<string, string> = {
    "session/update": "session.event",
};

/**
 * Methods that are not supported in ACP mode
 */
export const UNSUPPORTED_ACP_METHODS = [
    "models.list",
    "session.resume",
    "session.getMessages",
    "session.list",
    "session.getLastId",
    "session.delete",
    "session.getForeground",
    "session.setForeground",
    "status.get",
    "auth.getStatus",
    "permission.request",
    "userInput.request",
    "hooks.invoke",
    "tool.call",
] as const;

export type UnsupportedAcpMethod = (typeof UNSUPPORTED_ACP_METHODS)[number];
