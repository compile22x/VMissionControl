// tcp-ws.ts — TCP→WebSocket binary relay for ArduPilot SITL MAVLink streams
// SPDX-License-Identifier: GPL-3.0-only

import { EventEmitter } from 'node:events';
import net from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TcpInstance {
  host: string;
  port: number;
  sysId: number;
}

export interface BridgeConfig {
  wsPort: number;
  tcpInstances: TcpInstance[];
}

export interface TcpConnectedEvent {
  sysId: number;
  host: string;
  port: number;
}

export interface TcpDisconnectedEvent {
  sysId: number;
}

export interface WsClientEvent {
  remoteAddress: string;
}

export interface DataEvent {
  sysId: number;
  data: Buffer;
}

export interface BridgeEvents {
  'tcp-connected': [TcpConnectedEvent];
  'tcp-disconnected': [TcpDisconnectedEvent];
  'ws-client-connected': [WsClientEvent];
  'ws-client-disconnected': [WsClientEvent];
  'data': [DataEvent];
  'error': [Error];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_RECONNECT_MS = 500;
const MAX_RECONNECT_MS = 30_000;
const BACKOFF_FACTOR = 2;

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

interface TcpHandle {
  instance: TcpInstance;
  socket: net.Socket | null;
  reconnectMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}

export class TcpWsBridge extends EventEmitter<BridgeEvents> {
  private readonly config: BridgeConfig;
  private wss: WebSocketServer | null = null;
  private readonly tcpHandles: TcpHandle[] = [];
  private closed = false;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
  }

  /** Number of currently connected WebSocket clients. */
  get wsClientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  /** Start the WebSocket server and connect to all TCP instances. */
  start(): void {
    this.wss = new WebSocketServer({ port: this.config.wsPort });

    this.wss.on('connection', (ws, req) => {
      const remoteAddress = req.socket.remoteAddress ?? 'unknown';
      this.emit('ws-client-connected', { remoteAddress });

      ws.binaryType = 'nodebuffer';

      ws.on('message', (msg: Buffer) => {
        // GCS → SITL: relay to all TCP connections
        for (const handle of this.tcpHandles) {
          if (handle.socket && !handle.socket.destroyed) {
            handle.socket.write(msg);
          }
        }
      });

      ws.on('close', () => {
        this.emit('ws-client-disconnected', { remoteAddress });
      });

      ws.on('error', (err) => {
        this.emit('error', err);
      });
    });

    this.wss.on('error', (err) => {
      this.emit('error', err);
    });

    // Initiate TCP connections
    for (const instance of this.config.tcpInstances) {
      const handle: TcpHandle = {
        instance,
        socket: null,
        reconnectMs: INITIAL_RECONNECT_MS,
        reconnectTimer: null,
        destroyed: false,
      };
      this.tcpHandles.push(handle);
      this.connectTcp(handle);
    }
  }

  /** Gracefully shut down all sockets and the WS server. */
  shutdown(): void {
    this.closed = true;

    for (const handle of this.tcpHandles) {
      handle.destroyed = true;
      if (handle.reconnectTimer) {
        clearTimeout(handle.reconnectTimer);
        handle.reconnectTimer = null;
      }
      if (handle.socket) {
        handle.socket.destroy();
        handle.socket = null;
      }
    }

    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close();
      }
      this.wss.close();
      this.wss = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private connectTcp(handle: TcpHandle): void {
    if (handle.destroyed || this.closed) return;

    const { host, port, sysId } = handle.instance;
    const socket = new net.Socket();
    handle.socket = socket;

    socket.connect(port, host, () => {
      handle.reconnectMs = INITIAL_RECONNECT_MS; // reset backoff on success
      this.emit('tcp-connected', { sysId, host, port });
    });

    socket.on('data', (data: Buffer) => {
      // SITL → GCS: broadcast to all WS clients
      this.broadcastToWs(data);
      this.emit('data', { sysId, data });
    });

    socket.on('close', () => {
      this.emit('tcp-disconnected', { sysId });
      handle.socket = null;
      this.scheduleReconnect(handle);
    });

    socket.on('error', (err) => {
      this.emit('error', err);
      // `close` event fires after `error`, so reconnect is handled there
    });
  }

  private scheduleReconnect(handle: TcpHandle): void {
    if (handle.destroyed || this.closed) return;

    handle.reconnectTimer = setTimeout(() => {
      handle.reconnectTimer = null;
      this.connectTcp(handle);
    }, handle.reconnectMs);

    // Exponential backoff with cap
    handle.reconnectMs = Math.min(
      handle.reconnectMs * BACKOFF_FACTOR,
      MAX_RECONNECT_MS,
    );
  }

  private broadcastToWs(data: Buffer): void {
    if (!this.wss) return;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
