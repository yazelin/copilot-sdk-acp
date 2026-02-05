import { describe, expect, it, vi, beforeEach } from "vitest";
import { PassThrough } from "node:stream";
import { AcpTransport } from "../../../src/protocols/acp/acp-transport.js";

describe("AcpTransport", () => {
    let inputStream: PassThrough;
    let outputStream: PassThrough;
    let transport: AcpTransport;

    beforeEach(() => {
        inputStream = new PassThrough();
        outputStream = new PassThrough();
        transport = new AcpTransport(inputStream, outputStream);
    });

    describe("NDJSON parsing", () => {
        it("should parse a single complete JSON message", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            const message = { jsonrpc: "2.0", id: 1, method: "test" };
            inputStream.write(JSON.stringify(message) + "\n");

            // Give time for the message to be processed
            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).toHaveBeenCalledWith(message);
        });

        it("should parse multiple messages in one chunk", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            const message1 = { jsonrpc: "2.0", id: 1, method: "test1" };
            const message2 = { jsonrpc: "2.0", id: 2, method: "test2" };
            inputStream.write(JSON.stringify(message1) + "\n" + JSON.stringify(message2) + "\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler).toHaveBeenNthCalledWith(1, message1);
            expect(handler).toHaveBeenNthCalledWith(2, message2);
        });

        it("should handle partial messages across chunks", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            const message = { jsonrpc: "2.0", id: 1, method: "test", params: { data: "value" } };
            const jsonStr = JSON.stringify(message);

            // Split the message across two chunks
            const mid = Math.floor(jsonStr.length / 2);
            inputStream.write(jsonStr.slice(0, mid));

            await new Promise((resolve) => setImmediate(resolve));
            expect(handler).not.toHaveBeenCalled();

            inputStream.write(jsonStr.slice(mid) + "\n");

            await new Promise((resolve) => setImmediate(resolve));
            expect(handler).toHaveBeenCalledWith(message);
        });

        it("should handle messages split across newline", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            const message = { jsonrpc: "2.0", id: 1, method: "test" };
            inputStream.write(JSON.stringify(message));

            await new Promise((resolve) => setImmediate(resolve));
            expect(handler).not.toHaveBeenCalled();

            inputStream.write("\n");

            await new Promise((resolve) => setImmediate(resolve));
            expect(handler).toHaveBeenCalledWith(message);
        });

        it("should skip empty lines", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            const message = { jsonrpc: "2.0", id: 1, method: "test" };
            inputStream.write("\n\n" + JSON.stringify(message) + "\n\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(message);
        });

        it("should emit error for invalid JSON", async () => {
            const errorHandler = vi.fn();
            transport.onError(errorHandler);
            transport.listen();

            inputStream.write("not valid json\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(errorHandler).toHaveBeenCalled();
            expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        });
    });

    describe("sending messages", () => {
        it("should write JSON followed by newline", () => {
            const message = { jsonrpc: "2.0", id: 1, method: "test" };
            transport.send(message);

            const written = outputStream.read();
            expect(written.toString()).toBe(JSON.stringify(message) + "\n");
        });

        it("should write multiple messages", () => {
            const message1 = { jsonrpc: "2.0", id: 1, method: "test1" };
            const message2 = { jsonrpc: "2.0", id: 2, method: "test2" };

            transport.send(message1);
            transport.send(message2);

            const written = outputStream.read();
            expect(written.toString()).toBe(
                JSON.stringify(message1) + "\n" + JSON.stringify(message2) + "\n"
            );
        });
    });

    describe("request/response matching", () => {
        it("should resolve request when response arrives", async () => {
            transport.listen();

            const requestPromise = transport.sendRequest(1, "test.method", { arg: "value" });

            // Simulate response
            const response = { jsonrpc: "2.0", id: 1, result: { data: "response" } };
            inputStream.write(JSON.stringify(response) + "\n");

            const result = await requestPromise;
            expect(result).toEqual({ data: "response" });
        });

        it("should reject request when error response arrives", async () => {
            transport.listen();

            const requestPromise = transport.sendRequest(2, "test.method");

            const errorResponse = {
                jsonrpc: "2.0",
                id: 2,
                error: { code: -32600, message: "Invalid request" },
            };
            inputStream.write(JSON.stringify(errorResponse) + "\n");

            await expect(requestPromise).rejects.toThrow("Invalid request");
        });

        it("should handle multiple concurrent requests", async () => {
            transport.listen();

            const promise1 = transport.sendRequest(1, "method1");
            const promise2 = transport.sendRequest(2, "method2");
            const promise3 = transport.sendRequest(3, "method3");

            // Respond out of order
            inputStream.write(JSON.stringify({ jsonrpc: "2.0", id: 2, result: "result2" }) + "\n");
            inputStream.write(JSON.stringify({ jsonrpc: "2.0", id: 3, result: "result3" }) + "\n");
            inputStream.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "result1" }) + "\n");

            expect(await promise1).toBe("result1");
            expect(await promise2).toBe("result2");
            expect(await promise3).toBe("result3");
        });
    });

    describe("notification handling", () => {
        it("should dispatch notifications to handlers", async () => {
            const handler = vi.fn();
            transport.onNotification("session/update", handler);
            transport.listen();

            const notification = {
                jsonrpc: "2.0",
                method: "session/update",
                params: { sessionId: "123", type: "end_turn" },
            };
            inputStream.write(JSON.stringify(notification) + "\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).toHaveBeenCalledWith({ sessionId: "123", type: "end_turn" });
        });

        it("should handle multiple notification handlers for same method", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            transport.onNotification("session/update", handler1);
            transport.onNotification("session/update", handler2);
            transport.listen();

            const notification = {
                jsonrpc: "2.0",
                method: "session/update",
                params: { data: "test" },
            };
            inputStream.write(JSON.stringify(notification) + "\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler1).toHaveBeenCalledWith({ data: "test" });
            expect(handler2).toHaveBeenCalledWith({ data: "test" });
        });

        it("should not call handlers for unregistered notifications", async () => {
            const handler = vi.fn();
            transport.onNotification("session/update", handler);
            transport.listen();

            const notification = {
                jsonrpc: "2.0",
                method: "other/method",
                params: {},
            };
            inputStream.write(JSON.stringify(notification) + "\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe("close handling", () => {
        it("should emit close when input stream ends", async () => {
            const closeHandler = vi.fn();
            transport.onClose(closeHandler);
            transport.listen();

            inputStream.end();

            await new Promise((resolve) => setImmediate(resolve));

            expect(closeHandler).toHaveBeenCalled();
        });

        it("should reject pending requests when stream closes", async () => {
            transport.listen();

            const requestPromise = transport.sendRequest(1, "test.method");

            inputStream.end();

            await expect(requestPromise).rejects.toThrow(/closed|ended/i);
        });
    });

    describe("dispose", () => {
        it("should stop listening for messages", async () => {
            const handler = vi.fn();
            transport.onMessage(handler);
            transport.listen();

            transport.dispose();

            inputStream.write(JSON.stringify({ jsonrpc: "2.0", id: 1 }) + "\n");

            await new Promise((resolve) => setImmediate(resolve));

            expect(handler).not.toHaveBeenCalled();
        });
    });
});
