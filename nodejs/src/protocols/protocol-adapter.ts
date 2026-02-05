/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Protocol adapter interfaces for supporting multiple CLI protocols.
 * @module protocols/protocol-adapter
 */

/**
 * Abstract connection interface for protocol adapters.
 * Provides a unified API for sending requests and notifications regardless of the underlying protocol.
 */
export interface ProtocolConnection {
    /**
     * Sends a request and waits for a response.
     * @param method - The method name
     * @param params - Optional parameters
     * @returns A promise resolving to the response
     */
    sendRequest<T>(method: string, params?: unknown): Promise<T>;

    /**
     * Sends a notification (no response expected).
     * @param method - The method name
     * @param params - Optional parameters
     */
    sendNotification(method: string, params?: unknown): void;

    /**
     * Registers a handler for incoming notifications.
     * @param method - The method name to handle
     * @param handler - The handler function
     */
    onNotification(method: string, handler: (params: unknown) => void): void;

    /**
     * Registers a handler for incoming requests.
     * @param method - The method name to handle
     * @param handler - The handler function returning a response
     */
    onRequest(method: string, handler: (params: unknown) => Promise<unknown>): void;

    /**
     * Registers a handler for connection close events.
     * @param handler - The handler function
     */
    onClose(handler: () => void): void;

    /**
     * Registers a handler for connection errors.
     * @param handler - The handler function
     */
    onError(handler: (error: Error) => void): void;

    /**
     * Disposes of the connection and releases resources.
     */
    dispose(): void;

    /**
     * Starts listening for incoming messages.
     */
    listen(): void;
}

/**
 * Protocol adapter interface for managing CLI server lifecycle and connection.
 * Implementations handle protocol-specific details like message framing and method translation.
 */
export interface ProtocolAdapter {
    /**
     * Starts the CLI server process (if not connecting to external server).
     * @returns A promise that resolves when the server is ready
     */
    start(): Promise<void>;

    /**
     * Gracefully stops the CLI server and closes all resources.
     * @returns A promise resolving to an array of errors encountered during cleanup
     */
    stop(): Promise<Error[]>;

    /**
     * Forcefully stops the CLI server without graceful cleanup.
     * @returns A promise that resolves when the force stop is complete
     */
    forceStop(): Promise<void>;

    /**
     * Gets the protocol connection for sending requests and handling notifications.
     * @returns The protocol connection
     */
    getConnection(): ProtocolConnection;

    /**
     * Verifies that the server's protocol version is compatible with the SDK.
     * @returns A promise that resolves if compatible, rejects otherwise
     */
    verifyProtocolVersion(): Promise<void>;
}
