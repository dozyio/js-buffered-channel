var h = Object.defineProperty;
var u = (i, e, s) => e in i ? h(i, e, { enumerable: !0, configurable: !0, writable: !0, value: s }) : i[e] = s;
var t = (i, e, s) => u(i, typeof e != "symbol" ? e + "" : e, s);
class l {
  constructor(e, s = 4) {
    t(this, "port");
    t(this, "bufferSize");
    t(this, "receiveQueue", []);
    t(this, "receiveResolvers", []);
    t(this, "sendQueue", []);
    t(this, "sendResolvers", []);
    t(this, "inFlight", 0);
    this.port = e, this.bufferSize = s, this.port.onmessage = (r) => {
      if (this.enqueueReceive(r.data), this.sendResolvers.length > 0) {
        const n = this.sendResolvers.shift();
        n !== void 0 && (n(), this.inFlight--);
      }
      this.trySendQueued();
    };
  }
  // Internal method to enqueue received messages
  enqueueReceive(e) {
    if (this.receiveResolvers.length > 0) {
      const s = this.receiveResolvers.shift();
      s !== void 0 && s({ value: e, done: !1 });
    } else
      this.receiveQueue.push(e);
  }
  // Async iterator for receiving messages
  get receive() {
    const e = this;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        if (e.receiveQueue.length > 0) {
          const s = e.receiveQueue.shift();
          return Promise.resolve({ value: s, done: !1 });
        }
        return new Promise((s) => {
          e.receiveResolvers.push(s);
        });
      }
    };
  }
  // Method to send messages with backpressure
  async send(e) {
    return this.sendResolvers.length < this.bufferSize ? (this.inFlight++, this.port.postMessage(e), new Promise((s, r) => {
      this.sendResolvers.push(s);
    })) : new Promise((s, r) => {
      this.sendQueue.push({ message: e, resolve: s, reject: r });
    });
  }
  // Method to handle sending queued messages when space is available
  trySendQueued() {
    for (; this.sendResolvers.length < this.bufferSize && this.sendQueue.length > 0; ) {
      const e = this.sendQueue.shift();
      if (e === void 0)
        return;
      try {
        this.port.postMessage(e.message), this.inFlight++, this.sendResolvers.push(e.resolve);
      } catch (s) {
        e.reject(s);
      }
    }
  }
  // Initiate flow control by attempting to send any queued messages
  initSendFlow() {
    this.trySendQueued();
  }
}
export {
  l as BufferedChannel
};
//# sourceMappingURL=buffered-channel.js.map
