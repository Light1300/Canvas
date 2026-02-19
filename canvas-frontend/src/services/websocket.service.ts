export interface WSHandlers<TMessage> {
  onOpen?: () => void;
  onMessage: (data: TMessage) => void;
  onClose?: () => void;
  onError?: () => void;
}

export class WebSocketService<TMessage> {
  private socket?: WebSocket;

  constructor(private readonly url: string) {}

  connect(handlers: WSHandlers<TMessage>) {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      handlers.onOpen?.();
    };

    this.socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as TMessage;
      handlers.onMessage(parsed);
    };

    this.socket.onclose = () => {
      handlers.onClose?.();
    };

    this.socket.onerror = () => {
      handlers.onError?.();
    };
  }

  send(data: unknown) {
    this.socket?.send(JSON.stringify(data));
  }

  disconnect() {
    this.socket?.close();
  }
}