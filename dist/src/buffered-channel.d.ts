export default class BufferedChannel {
    private readonly port;
    private readonly bufferSize;
    private readonly receiveQueue;
    private readonly receiveResolvers;
    private readonly sendQueue;
    private readonly sendResolvers;
    private inFlight;
    constructor(port: MessagePort, bufferSize?: number);
    private enqueueReceive;
    get receive(): AsyncIterableIterator<any>;
    send(message: any): Promise<void>;
    private trySendQueued;
    initSendFlow(): void;
}
//# sourceMappingURL=buffered-channel.d.ts.map