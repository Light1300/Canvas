<div align="center">

# 🎨 Canvas

### Production-Grade Real-Time Collaborative Whiteboard

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://typescriptlang.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://mongodb.com)
[![Railway](https://img.shields.io/badge/Deployed-Railway-purple)](https://railway.app)

**Live Demo:** [canva-frontend-production.up.railway.app](https://canva-frontend-production.up.railway.app)
**API Docs:** [canvas-production-671b.up.railway.app/api-docs](https://canvas-production-671b.up.railway.app/api-docs)

</div>

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture & System Design](#2-architecture--system-design)
3. [WebSocket Architecture](#3-websocket-architecture)
4. [Redis Design](#4-redis-design)
5. [Pub/Sub Design](#5-pubsub-design)
6. [Real-Time Canvas Synchronization](#6-real-time-canvas-synchronization)
7. [Security & Abuse Prevention](#7-security--abuse-prevention)
8. [State Management & Data Integrity](#8-state-management--data-integrity)
9. [Reliability & Fault Tolerance](#9-reliability--fault-tolerance)
10. [Backend Engineering Quality](#10-backend-engineering-quality)
11. [Infrastructure Readiness](#11-infrastructure-readiness)
12. [Performance](#12-performance)
13. [Extensibility](#13-extensibility)
14. [Tradeoffs & Alternatives](#14-tradeoffs--alternatives)
15. [Deep Technical Questions](#15-deep-technical-questions)
16. [Local Development](#16-local-development)
17. [Deployment](#17-deployment)
18. [Folder Structure](#18-folder-structure)

---

## 1. Product Overview

### What exact problem does this system solve?

Real-time collaborative drawing tools require sub-50ms synchronization across multiple clients, persistent stroke history for late joiners, and distributed infrastructure that survives server restarts and horizontal scaling. Most toy implementations use in-memory `Map` objects — which break the moment you restart the server or run two instances. Canvas solves this with a fully stateless backend where **all shared state lives in Redis**.

### Core User Journeys

1. **Signup** → OTP sent via email → verify → land on dashboard
2. **Create room** → share 8-char room code → others join → draw together in real time
3. **Late join** → instantly see full drawing history replayed from Redis stroke list
4. **Cursor presence** → see teammates' cursors with names and colors, throttled to 20 events/sec
5. **Undo/Redo** → per-user stroke stacks, ownership enforced server-side, synced across all clients
6. **Leave** → explicit LEAVE_ROOM event removes cursor immediately; heartbeat cleans up silent disconnects

### Assumptions Made

- Rooms are **ephemeral by design** — 24h TTL, no persistence after expiry (persistence is a premium feature)
- One authenticated user per browser session — no anonymous collaboration
- Stroke history is the source of truth — not canvas pixel snapshots
- Access tokens expire in 15 minutes — short enough to limit stolen token risk
- Refresh tokens rotate on every use — prevents replay attacks
- Users on mobile are supported (touch events) but cursor presence is desktop-only

### Expected Scale

| Dimension | Design Target |
|---|---|
| Concurrent users per room | 50 |
| Concurrent rooms | 1,000 |
| Strokes per room per session | ~5,000 |
| Messages per second (peak) | ~50,000 |
| Refresh token lifetime | 30 days |

### Conscious Tradeoffs

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Real-time transport | WebSockets | Polling / SSE | Bidirectional, low-latency |
| State storage | Redis | In-memory Map | Survives restart, supports horizontal scale |
| Stroke history | Redis List (RPUSH) | MongoDB per-stroke writes | Latency — Redis writes are sub-millisecond |
| Auth storage | Redis (refresh tokens) | MongoDB collection | TTL built-in, no cron cleanup needed |
| Consistency model | Eventual (AP) | Strong (CP) | Drawing doesn't need linearizability |
| WS library | `ws` | Socket.IO | No abstraction overhead, full protocol control |
| Collaboration | Server-broadcast | CRDTs | Strokes are append-only, no conflict resolution needed |

---

## 2. Architecture & System Design

### Architecture Pattern

**Modular monolith with an event-driven real-time layer.**

- HTTP layer (Express) and WebSocket layer share the same Node.js process but are fully isolated
- No shared in-memory state between them — all coordination goes through Redis
- Business logic is separated by domain: auth, rooms, websocket events, rate limiting

### High-Level Diagram

```mermaid
flowchart TD
    Client["Client\nReact + TypeScript\nCanvas · GhostCursors · useRoomSocket"]

    subgraph Railway["Railway Deployment"]
        Express["Express\nHTTP API"]
        WS["WebSocket Server\nws"]
    end

    Redis[("Redis\nSets · Lists · Pub/Sub · TTL")]
    Mongo[("MongoDB\nusers · rooms TTL index")]

    Client -->|HTTPS| Express
    Client -->|WSS| WS
    Express --> Redis
    WS --> Redis
    Express --> Mongo
```

### Why Modular Monolith Over Microservices?

At this scale, microservices would add network hops between auth and room services, require service discovery, distributed tracing, and separate deployment pipelines — all for zero throughput benefit. A modular monolith with clear domain boundaries gives the same code separation with none of the operational overhead. The boundary is enforced by folder structure, not by network.

### Horizontal Scaling

The backend is **stateless** — the only in-memory state is a `Map<connectionId, WebSocket>` of live socket references. Room membership, stroke history, and user counts all live in Redis.

```mermaid
flowchart TD
    LB["Load Balancer"]

    subgraph A["Instance A"]
        A1["Express + WS"]
        A2["connections Map\nlocal only"]
    end

    subgraph B["Instance B"]
        B1["Express + WS"]
        B2["connections Map\nlocal only"]
    end

    Redis[("Redis\nShared State + Pub/Sub")]

    LB --> A1
    LB --> B1
    A1 --> Redis
    B1 --> Redis
```

No sticky sessions required. Any instance can serve any client.

### Stateful vs Stateless Components

| Component | Nature | Holds |
|---|---|---|
| Express HTTP | Stateless | Nothing |
| WebSocket server | Partially stateful | Live socket refs (local only) |
| Redis | Stateful | Room membership, strokes, pub/sub, tokens, rate limits |
| MongoDB | Stateful | Users, room metadata |

### Deployment Architecture

**Frontend:** React app compiled to static files (`npm run build`), served by Caddy on Railway. CDN-cacheable, no server required.

**Backend:** Node.js process on Railway. Single Dockerfile, multi-stage build. Railway autoscales by restarting crashed instances.

**If one instance crashes:** Railway detects the failed health check (`GET /health` returns non-200 or times out) and restarts the container. Redis retains all room state — on restart, the new instance reconnects to Redis and is immediately operational. WebSocket clients detect the disconnect via the `close` event and reconnect (handled by `useRoomSocket` reconnect logic). No data is lost.

**Restart survivability:** Because zero application state lives in the process, a restart is transparent. Clients reconnect, send `JOIN_ROOM`, receive `INITIAL_STATE` from Redis stroke history, and resume drawing.

---

## 3. WebSocket Architecture

### Why WebSockets Instead of Polling or SSE?

| | Polling | SSE | WebSockets |
|---|---|---|---|
| Direction | Client → Server only | Server → Client only | Bidirectional |
| Latency | 100ms–500ms | ~50ms | <10ms |
| Overhead | Full HTTP header per request | Low | Low after handshake |
| Drawing strokes | ❌ Needs separate POST | ❌ Needs separate POST | ✅ Same connection |
| Cursor positions | ❌ Unusable | ❌ Unusable | ✅ Native |
| Protocol | HTTP/1.1 | HTTP/1.1 | RFC 6455 |

### WebSocket Server Initialization

```typescript
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  // 1. Extract JWT from query param (?token=...)
  // 2. jwt.verify() — reject with 401 if invalid
  // 3. Check decoded.isVerified — reject with 403 if not
  // 4. Attach decoded user to request object
  // 5. Hand off to WebSocket server
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
```

`noServer: true` means the WebSocket server shares port 8080 with Express. The upgrade handshake is intercepted before the WebSocket connection is established — **no unauthenticated socket ever enters the system**.

### Client Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant JWT

    Client->>Server: GET /?token=JWT (Upgrade: websocket)
    Server->>JWT: verify(token, ACCESS_TOKEN_SECRET)

    alt invalid or not verified
        JWT-->>Server: throws error
        Server-->>Client: 401 / 403 socket.destroy()
    else valid
        JWT-->>Server: decoded payload
        Server-->>Client: 101 Switching Protocols
        Note over Server: socket.userId = decoded.userId
        Note over Server: socket.username = decoded.name
        Note over Server: socket.color = getUserColor(userId)
    end
```

`userId`, `username`, and `color` are set **server-side** from the verified JWT. Clients cannot spoof their identity by sending a crafted payload.

### Preventing Unauthorized Room Access

- JWT verified at upgrade — no socket without valid token
- Room existence validated against MongoDB on `JOIN_ROOM`
- `socket.currentRoom` tracks which room a socket is in — event handlers check this before processing
- Undo ownership: `stroke.userId === socket.userId` enforced server-side

### Handling Reconnects

```typescript
ws.onclose = () => {
  setConnectionStatus("disconnected");
  setTimeout(() => connectWebSocket(), 2000); // 2s backoff
};
```

On reconnect, the client sends `JOIN_ROOM` → server sends `INITIAL_STATE` from Redis → canvas replays all strokes. The user experience is seamless.

### Unexpected Disconnects & Heartbeat

```mermaid
sequenceDiagram
    participant Server
    participant Client

    loop Every 10 seconds
        Server->>Server: socket.isAlive = false
        Server->>Client: ping()

        alt pong received
            Client-->>Server: pong
            Server->>Server: socket.isAlive = true ✅
        else no pong (browser crashed / network drop)
            Server->>Server: socket.terminate()
            Server->>Server: close event fires
            Note over Server: SREM from Redis<br/>broadcast CURSOR_LEAVE + USER_LEFT
        end
    end
```

### Stale Connection Reconciliation

On every `JOIN_ROOM`, the server sweeps the Redis user set and removes ghost `connectionId`s:

```typescript
const members = await redis.sMembers(`room:${roomId}:users`);
for (const id of members) {
  if (!connections.has(id)) {
    await redis.sRem(`room:${roomId}:users`, id);
  }
}
```

This handles crashed instances that left stale entries in Redis — the next join always sweeps them clean.

### Memory Leak Prevention

- `connections` Map entries removed in `close` handler
- `socket.on("error")` triggers same cleanup as `close`
- Heartbeat terminates unresponsive sockets — they don't accumulate
- `socket.currentRoom` set to `null` after `LEAVE_ROOM` — prevents double-cleanup on disconnect

### Flood Prevention

- Client-side: cursor events throttled to 50ms (max 20/sec) in `useRoomSocket`
- Server-side: rate limiting on HTTP endpoints via `express-rate-limit` + Redis store
- WebSocket messages are typed and validated — unrecognized event types are silently dropped

---

## 4. Redis Design

### Why Redis?

Redis serves four distinct roles in this system simultaneously: **ephemeral state store**, **message broker**, **rate limit counter store**, and **token store**. No other single tool does all four with sub-millisecond latency.

### Data Structures Used

**Sets — Room Membership**
```
room:{roomId}:users → Set { "conn-uuid-1", "conn-uuid-2" }

SADD   room:{roomId}:users {connectionId}    // join      O(1)
SREM   room:{roomId}:users {connectionId}    // leave     O(1)
SCARD  room:{roomId}:users                   // count     O(1)
SMEMBERS room:{roomId}:users                 // sweep     O(N)
```

**Lists — Stroke History**
```
room:{roomId}:strokes → List [ "{stroke1}", "{stroke2}", ... ]

RPUSH  room:{roomId}:strokes {JSON}    // append stroke   O(1)
LRANGE room:{roomId}:strokes 0 -1      // full history    O(N)
LREM   room:{roomId}:strokes 0 {JSON}  // undo by value   O(N)
```

**Strings with TTL — Refresh Tokens**
```
refresh:{sha256(token)} → userId    (TTL: 30 days)

SETEX  refresh:{hash}  2592000  {userId}   // store
GET    refresh:{hash}                       // validate
DEL    refresh:{hash}                       // revoke / rotate
```

**Strings with TTL — Rate Limiting**
```
rl:auth:{ip}     → count    (TTL: 900s,  max: 10)
rl:room:{ip}     → count    (TTL: 3600s, max: 20)
rl:refresh:{ip}  → count    (TTL: 900s,  max: 30)
```

### Redis Key Space Overview

```mermaid
flowchart LR
    subgraph Keys["Redis Key Space"]
        U["room:X:users\nSet — connectionIds\nSADD / SREM / SCARD"]
        S["room:X:strokes\nList — ordered JSON\nRPUSH / LRANGE / LREM"]
        T["refresh:sha256hash\nString + 30d TTL\nSETEX / GET / DEL"]
        R["rl:type:ip\nString + window TTL\nINCR / EXPIRE"]
    end
```

### TTL Strategy

| Key | TTL Set When | TTL Value |
|---|---|---|
| `room:{id}:users` | Room empties (`SCARD === 0`) | 24 hours |
| `room:{id}:strokes` | Room empties OR on every RPUSH | 24 hours |
| `refresh:{hash}` | Token created | 30 days |
| `rl:*` | First hit in window | Window duration |

Active rooms never expire — TTL is reset on every `CANVAS_UPDATE` via `EXPIRE room:{id}:strokes 86400`.

### Redis Crash Behavior

- `JOIN_ROOM` fails — new users cannot enter rooms
- `CANVAS_UPDATE` fails silently — strokes not persisted or broadcast cross-instance
- Rate limiting fails open — requests pass through (acceptable degradation)
- Refresh token validation fails — users cannot refresh after access token expires
- Health endpoint returns 503 → Railway restarts the instance
- On Redis recovery: all operations resume, stroke history preserved if RDB/AOF enabled

---

## 5. Pub/Sub Design

### Why Pub/Sub Is Necessary

Each server instance only holds WebSocket references for its **own** connected clients. Without a message bus, a stroke from User A (on Instance 1) would never reach User B (on Instance 2).

```mermaid
flowchart LR
    subgraph I1["Instance 1"]
        UA["User A\ndraw stroke"]
    end

    subgraph I2["Instance 2"]
        UB["User B"]
    end

    Redis[("Redis\nroom:X channel")]

    UA -->|"RPUSH + PUBLISH"| Redis
    Redis -->|"pSubscribe room:*"| I2
    I2 -->|"broadcastToRoom"| UB
```

### How Pub/Sub Enables Horizontal Scaling

Every instance subscribes to `room:*` via `pSubscribe` at startup. When any instance publishes to `room:{roomId}`, every other instance receives it and forwards to its local sockets.

```typescript
// All instances subscribe at startup
redisSubscriber.pSubscribe("room:*", (message, channel) => {
  const roomId = channel.replace("room:", "");
  const parsed = JSON.parse(message) as SocketMessage;
  broadcastToRoom(roomId, parsed); // only sends to local sockets
});

// Any instance publishes when an event occurs
await redisPublisher.publish(`room:${roomId}`, JSON.stringify(message));
```

### Full Stroke Flow

```mermaid
sequenceDiagram
    participant UserA as User A (Instance 1)
    participant I1 as Instance 1
    participant Redis
    participant I2 as Instance 2
    participant UserB as User B (Instance 2)

    UserA->>I1: CANVAS_UPDATE (stroke)
    I1->>Redis: RPUSH room:X:strokes
    I1->>Redis: PUBLISH room:X
    Redis-->>I1: pSubscribe fires
    Redis-->>I2: pSubscribe fires
    I1-->>UserA: broadcastToRoom (local)
    I2-->>UserB: broadcastToRoom (local)
```

### Message Format

```typescript
{
  type: "CANVAS_UPDATE" | "USER_JOINED" | "USER_LEFT" | "CURSOR_MOVE" |
        "CURSOR_LEAVE" | "UNDO" | "REDO" | "USER_COUNT_UPDATED" | "ROOM_EXPIRED",
  payload: {
    roomId: string,
    stroke?: Stroke,        // CANVAS_UPDATE, REDO
    strokeId?: string,      // UNDO
    userId?: string,        // USER_JOINED, USER_LEFT, CURSOR_LEAVE
    username?: string,      // USER_JOINED, CURSOR_MOVE
    color?: string,
    x?: number, y?: number, // CURSOR_MOVE
    count?: number,         // USER_COUNT_UPDATED
  }
}
```

### Why Redis Pub/Sub Over Kafka or NATS?

| | Redis Pub/Sub | Kafka | NATS |
|---|---|---|---|
| Already in stack | ✅ | ❌ | ❌ |
| Latency | <1ms | 5–15ms | <1ms |
| Persistence | ❌ (at-most-once) | ✅ | Optional |
| Operational overhead | None | ZooKeeper + brokers | Separate cluster |
| At-scale limit | ~100k msg/s | Millions/s | Millions/s |

For ephemeral real-time events where loss of individual cursor events is invisible, Redis Pub/Sub is the right tool. Kafka would be appropriate if we needed guaranteed delivery of every stroke.

---

## 6. Real-Time Canvas Synchronization

### Late Join Flow

```mermaid
sequenceDiagram
    participant LateUser as Late Joiner
    participant Server
    participant Redis

    LateUser->>Server: JOIN_ROOM
    Server->>Redis: LRANGE room:X:strokes 0 -1
    Redis-->>Server: [stroke1, stroke2, ..., strokeN]
    Server-->>LateUser: INITIAL_STATE { strokes: [...] }
    Note over LateUser: canvas.__replaceStrokes(strokes)
    Note over LateUser: Canvas cleared → all strokes redrawn in order ✅
```

### Why Stroke History Over Snapshot Images?

| | Stroke History | Canvas Snapshot (PNG) |
|---|---|---|
| Storage size | ~500 bytes/stroke | ~500KB–2MB per snapshot |
| Replay fidelity | Pixel-perfect | Lossy (JPEG) or large (PNG) |
| Undo support | ✅ Remove stroke from list | ❌ Cannot un-render |
| Late join latency | Replay time (fast) | Transfer time (slow for large canvases) |
| Implementation complexity | Low | High (canvas-to-base64, storage, serving) |

### Preventing Race Conditions in Drawing

Canvas drawing is **append-only** — two users drawing simultaneously each produce independent strokes. Redis `RPUSH` is atomic. Two simultaneous RPUSHes are serialized by Redis's single-threaded execution. Both strokes are preserved — no data loss, no conflict.

### Eventual Consistency vs Strong Consistency

**Eventually consistent (AP system under CAP).** The sequence `client draws → RPUSH → PUBLISH → other clients render` involves two separate Redis operations. If RPUSH succeeds but PUBLISH fails, the stroke is in Redis (persistent) but other clients don't see it until their next `JOIN_ROOM`. This inconsistency window is sub-millisecond and imperceptible.

---

## 7. Security & Abuse Prevention

### Auth & Token Flow

```mermaid
flowchart TD
    A["POST /signup\nbcrypt hash password\ngenerate OTP"] --> B["verificationToken JWT\n10min TTL"]
    B --> C["POST /verify-otp\ncheck OTP"]
    C -->|valid| D["Issue accessToken 15min\nrefreshToken stored in Redis 30d"]
    D --> E["WS upgrade\njwt.verify at handshake"]
    E -->|invalid| F["401/403\nsocket.destroy()"]
    E -->|valid| G["Connection established\nidentity set server-side ✅"]
```

### Refresh Token Rotation

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Redis

    Client->>Server: POST /refresh-token { refreshToken }
    Server->>Redis: GET refresh:sha256(token)

    alt token missing (used, stolen, or expired)
        Redis-->>Server: null
        Server-->>Client: 401 — reuse attack detected
    else token valid
        Redis-->>Server: userId
        Server->>Redis: DEL refresh:sha256(oldToken)
        Server->>Redis: SETEX refresh:sha256(newToken) userId 2592000
        Server-->>Client: new accessToken + refreshToken ✅
    end
```

### Rate Limiting

`express-rate-limit` with Redis store — survives restarts, shared across instances:

| Endpoint | Window | Limit | Purpose |
|---|---|---|---|
| `/signup`, `/signin` | 15 min | 10 req | Prevent brute force |
| `POST /rooms` | 1 hour | 20 req | Prevent room spam |
| `/refresh-token` | 15 min | 30 req | Prevent token abuse |

`app.set("trust proxy", 1)` ensures real client IP is used behind Railway's reverse proxy.

### WebSocket Event Validation

```typescript
const handlers: Record<string, Handler> = {
  JOIN_ROOM: handleJoinRoom,
  CANVAS_UPDATE: handleCanvasUpdate,
  CURSOR_MOVE: handleCursorMove,
  LEAVE_ROOM: handleLeaveRoom,
  UNDO: handleUndo,
  REDO: handleRedo,
};

const handler = handlers[message.type];
if (!handler) return; // unknown event type silently dropped
```

`userId` and `username` are always read from `socket.userId` / `socket.username` (set at auth time) — never from client payload.

### XSS Prevention

Canvas strokes are `{x, y}` coordinate arrays rendered via Canvas API (`ctx.lineTo`, `ctx.stroke`) — **never injected into the DOM**. Usernames rendered via React JSX which escapes all HTML entities. No `dangerouslySetInnerHTML` anywhere.

### Replay Attack Prevention

Refresh tokens rotate on every use — each token is single-use. If a stolen token is used before the legitimate user, the legitimate user's next refresh finds the old token missing and receives 401. Access tokens are short-lived (15 minutes) — replay window is bounded.

---

## 8. State Management & Data Integrity

### What Lives Where

| State | Location | Why |
|---|---|---|
| Live socket references | In-memory (`connections` Map) | Cannot be serialized; local only |
| Room membership | Redis Set | Shared across instances, O(1) ops |
| Stroke history | Redis List | Ordered, fast append, full scan for join |
| Refresh tokens | Redis String + TTL | Built-in expiry, no cleanup cron |
| Rate limit counters | Redis String + TTL | Built-in windowing |
| Users (identity) | MongoDB | Permanent, needs query by email |
| Room metadata | MongoDB | TTL index for auto-expiry |

### Deployment Restart Flow

```mermaid
sequenceDiagram
    participant Railway
    participant Server
    participant Redis
    participant Client

    Railway->>Server: SIGTERM
    Server->>Server: stop accepting new connections
    Server->>Server: drain existing (10s window)
    Server->>Server: process.exit(0)

    Railway->>Server: start new instance
    Server->>Redis: reconnect — all state intact

    Client->>Client: detects close event
    Client->>Server: reconnect + JOIN_ROOM
    Server->>Redis: LRANGE strokes 0 -1
    Server-->>Client: INITIAL_STATE
    Note over Client: resumes drawing — no data lost ✅
```

### Eventual vs Strict Consistency

**Eventual consistency** — chosen deliberately. The `RPUSH → PUBLISH` sequence is two separate Redis operations. A new joiner between them could receive `INITIAL_STATE` without the in-flight stroke — but will receive it within milliseconds via pub/sub. For a collaborative drawing tool, this window is imperceptible.

---

## 9. Reliability & Fault Tolerance

### Failure Scenarios

```mermaid
flowchart TD
    subgraph RD["Redis Down"]
        R1["JOIN_ROOM fails"]
        R2["Strokes not persisted or broadcast"]
        R3["Rate limiting fails open"]
        R4["Health → 503 → Railway restarts"]
    end

    subgraph MD["MongoDB Down"]
        M1["Signin / Signup fails"]
        M2["JOIN_ROOM room validation fails"]
        M3["Existing WS connections unaffected ✅"]
        M4["Health → 503 → Railway restarts"]
    end

    subgraph IC["Instance Crash"]
        C1["Clients detect close event"]
        C2["Reconnect to another instance"]
        C3["JOIN_ROOM → INITIAL_STATE from Redis"]
        C4["No data lost ✅"]
        C1 --> C2 --> C3 --> C4
    end
```

### Event Storm Prevention

- Cursor events throttled at source: 50ms minimum interval in `useRoomSocket`
- Rate limiting prevents HTTP endpoint storms
- WebSocket message types validated — invalid types dropped without processing
- Redis pub/sub naturally rate-limits: PUBLISH is synchronous, slow consumers don't block producers

---

## 10. Backend Engineering Quality

### Folder Structure & Separation of Concerns

```
src/
├── api/                    # Business logic — no Express, no Redis directly
│   └── landing-page/       # Auth domain: signup, signin, OTP, refresh
├── middleware/             # Cross-cutting: rate limiting, auth verification
├── modules/
│   └── rooms/              # Room domain: schema, service, controller
├── routes/                 # Transport layer — Express routers + Swagger annotations
├── services/               # Shared services: refresh-token Redis operations
├── utils/                  # Infrastructure: Redis client, MongoDB client, JWT, colors
├── websocket/              # Real-time layer: server init, event router, types
└── index.ts                # Composition root: wire everything together
```

### Dependency Direction

```mermaid
flowchart LR
    Routes["src/routes/\nHTTP transport"] --> API
    WS["src/websocket/\nWS event router"] --> API
    API["src/api/ + modules/\nBusiness logic\nno Express · no Redis"] --> Utils
    Utils["src/utils/\nRedis client\nMongoDB client\nJWT helpers"]
```

- `src/websocket/` has zero Express imports
- `src/routes/` has zero WebSocket imports
- Business logic in `src/api/` has zero transport imports

### Redis Client Abstraction

Two dedicated Redis clients exported from `src/utils/redis/redisClient.ts`:
- `redisPublisher` — for all WRITE operations (RPUSH, PUBLISH, SADD, etc.)
- `redisSubscriber` — dedicated to PSUBSCRIBE (cannot run other commands while subscribed)

No direct `ioredis` imports in business logic.

---

## 11. Infrastructure Readiness

### Scaling to 10,000 Concurrent Users

| Bottleneck | Current Limit | Fix |
|---|---|---|
| Redis pub/sub throughput | ~100k msg/s (single instance) | Redis Cluster with channel-key affinity |
| Stroke history payload | ~5MB at 10k strokes | Canvas snapshotting every 500 strokes |
| MongoDB connections | Pool exhaustion at ~1k concurrent | Increase pool size, add read replica |
| Node.js event loop | CPU-bound at very high msg rates | Cluster mode (multiple processes per machine) |
| WebSocket connections | ~65k per instance (OS socket limit) | Multiple instances behind load balancer |

### At 100k DAU — What Breaks First

```mermaid
flowchart TD
    DAU["100k DAU → ~10k concurrent"]
    DAU --> Calc["200 active rooms × 1,100 msg/s\n= 220,000 msg/s"]
    Calc --> Limit["Single Redis instance limit\n~100k msg/s ❌ BOTTLENECK"]
    Limit --> Fix1["Redis Cluster\nhash-tag channel affinity"]
    Limit --> Fix2["roomConnections index\nO room_size broadcast"]
    Limit --> Fix3["Canvas snapshotting\nevery 500 strokes → S3"]
```

### What to Move to Managed Infrastructure

| Component | Current | At Scale |
|---|---|---|
| Redis | Railway Redis | AWS ElastiCache (Redis Cluster mode) |
| MongoDB | Atlas Free | Atlas Dedicated M30+ with read replicas |
| WebSocket servers | Railway | AWS ECS Fargate (auto-scaling) |
| Load balancer | Railway (built-in) | AWS ALB with WebSocket support |
| Static frontend | Railway Caddy | CloudFront + S3 |
| Email | Brevo | AWS SES ($0.10/1000 emails) |

**Total infrastructure cost at 100k DAU:** ~$500–800/month on AWS. Recoverable from ~200 premium subscribers at $5/month.

### Metrics to Monitor

| Metric | Alert Threshold |
|---|---|
| Redis memory usage | >80% of allocated |
| Redis pub/sub lag | >100ms |
| WebSocket connection count | >50k per instance |
| HTTP p99 latency | >500ms |
| `INITIAL_STATE` payload size | >10MB |
| Reconnect rate | >5% per minute |

---

## 12. Performance

### Messages Per Second — One Room

50 users × 20 cursor events/s = 1,000 pub/sub messages/s per room
50 users × 2 strokes/s = 100 additional messages/s
**Total: ~1,100 messages/second per active room**

### Memory Footprint Per Room

| Item | Size |
|---|---|
| Redis Set (50 members) | ~3KB |
| Redis List (1,000 strokes) | ~500KB |
| In-memory socket refs (50) | ~50KB |
| **Total per room** | **~553KB** |

1,000 rooms = ~553MB Redis + ~50MB Node.js heap. Well within Railway's 8GB Redis limit.

### Broadcasting Cost

`broadcastToRoom` currently iterates all local connections filtering by `currentRoom`. Cost: O(total_connections) per room event.

**Fix:** maintain a `roomConnections: Map<roomId, Set<connectionId>>` index → O(room_size) broadcast instead of O(total_connections).

---

## 13. Extensibility

### Adding Private Rooms

Add `isPrivate: boolean` and `password: string` (bcrypt-hashed) to room schema. `JOIN_ROOM` handler checks password before admitting. Invite links encode a signed token with `roomId` — no password required if token valid.

### Adding Persistent Rooms

1. Add `Board` model: `{ ownerId, title, createdAt }` — no `expiresAt`
2. Move stroke storage: Redis List → MongoDB collection with `boardId` index
3. Keep Redis as write-through cache for active boards
4. This is the **premium feature** — free tier keeps 24h ephemeral rooms

### Adding Replay Functionality

Strokes already have timestamps. `GET /api/user/rooms/:roomId/replay` returns strokes ordered by timestamp. Frontend renders them progressively with `setTimeout` delays matching original timing.

### Adding File Attachments

Upload to S3/R2 via presigned URL (client → S3 directly, no server proxy). Store S3 key in stroke payload as type `IMAGE`. Canvas renders `drawImage()` from URL.

### Versioning the WebSocket Protocol

```typescript
// wss://api.example.com/ws?token=...&v=2
const router = version === "2" ? routerV2 : routerV1;
```

Maintain N-1 versions. Deprecate with 90-day notice.

---

## 14. Tradeoffs & Alternatives

### Why `ws` Instead of Socket.IO?

| | Socket.IO | `ws` |
|---|---|---|
| Bundle size | +30KB client | 0 (native WebSocket API) |
| Protocol | Custom framing over WS | Standard RFC 6455 |
| Reconnection | Built-in | Implemented explicitly |
| Rooms | Built-in abstraction | Redis Sets |
| Polling fallback | ✅ (legacy browser support) | ❌ |
| Visibility | Opaque | Full control |

Socket.IO's abstractions hide what's actually happening. Every feature it provides (rooms, broadcasting, reconnection) is implemented explicitly here with Redis — giving full control and no hidden behavior.

### Why Not Serverless?

WebSocket connections are long-lived (minutes to hours). Serverless functions time out after 30 seconds (AWS Lambda) or 60 seconds (Vercel). There is no serverless primitive for a persistent WebSocket connection server-side.

### Why Not CRDTs?

CRDTs (Yjs, Automerge) are designed for text collaboration where two users editing the same character position need conflict resolution. Canvas drawing is **append-only** — two users drawing simultaneously produce two independent strokes. There is no conflict. CRDTs would add ~40KB to the bundle and significant complexity for zero benefit.

### Why Not a Managed Pub/Sub Service?

AWS SNS, Google Pub/Sub, or Ably would add $50–200/month in costs, an external network hop on every message (~10–50ms vs <1ms for Redis), and a new dependency with its own SDK, auth, and failure modes. Redis already handles this workload.

---

## 15. Deep Technical Questions

### Is the System CP or AP Under CAP Theorem?

**AP (Available + Partition Tolerant)** for the canvas layer. During a Redis network partition, each instance continues serving local WebSocket connections and broadcasting locally, but cross-instance synchronization stops. On partition recovery, pub/sub resumes but diverged strokes are not reconciled.

**CP for Redis itself** — a minority-partition Redis node stops accepting writes.

### Ghost User Prevention — Three Mechanisms

```mermaid
flowchart TD
    G1["1. Proactive sweep on JOIN_ROOM\nremove connectionId not in local Map"]
    G2["2. Reactive cleanup on disconnect\nclose event → SREM → broadcast USER_LEFT"]
    G3["3. TTL safety net\n24h TTL when room empties"]
    G1 & G2 & G3 --> Result["Zero ghost users ✅"]
```

### Idempotency Strategy

| Event | Idempotent? | Reason |
|---|---|---|
| `JOIN_ROOM` | ✅ | SADD on Set ignores duplicates |
| `CANVAS_UPDATE` | ❌ | Duplicate RPUSH = duplicate stroke (mitigated by strokeId dedup on client) |
| `UNDO` | ✅ | LREM on same strokeId is a no-op |
| `LEAVE_ROOM` | ✅ | SREM on non-existent member is a no-op |

### Debugging a Production Real-Time Issue

```bash
# 1. Check health
curl https://canvas-production-671b.up.railway.app/health

# 2. Query Redis directly
SCARD room:{roomId}:users          # members Redis thinks exist
LLEN room:{roomId}:strokes         # stroke count
PUBSUB CHANNELS room:*             # active room channels
PUBSUB NUMSUB room:{roomId}        # subscriber count

# 3. Force-test pub/sub
PUBLISH room:{roomId} '{"type":"TEST","payload":{}}'
# should appear in server logs if subscriber is healthy
```

### Success Metrics

| Metric | Target |
|---|---|
| Stroke sync latency (P95) | <100ms |
| `JOIN_ROOM` to first paint | <500ms |
| Cursor update latency | <50ms |
| Ghost user rate | <0.1% |
| Reconnect success rate | >99% |
| Redis pub/sub lag | <10ms |

---

## 16. Local Development

### Prerequisites

- Node.js 20+ (`nvm install 20 && nvm use 20`)
- Docker + Docker Compose

### Backend Setup

```bash
cd server
cp .env.example .env
# Fill in: MONGO_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
#          VERIFICATION_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL

docker-compose up redis -d
npm install
npm run dev
```

### Frontend Setup

```bash
cd canvas-frontend
cp .env.example .env
# REACT_APP_API_URL=http://localhost:8080/api
# REACT_APP_WS_URL=ws://localhost:8080

nvm use 20
npm install
npm start
```

### Full Stack via Docker

```bash
cd server
docker-compose up --build
```

### Verify

```bash
curl http://localhost:8080/health
# {"status":"ok","uptime":5,"dependencies":{"redis":"connected","mongodb":"connected"}}
```

### Environment Variables

```env
PORT=8080
CLIENT_URL=http://localhost:3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/canvas
ACCESS_TOKEN_SECRET=<64-char random hex>
REFRESH_TOKEN_SECRET=<64-char random hex>
VERIFICATION_SECRET=<64-char random hex>
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@yourdomain.com
REDIS_URL=redis://localhost:6379
```

---

## 17. Deployment

### Backend (Railway)

1. Connect GitHub repo → Railway auto-detects Node
2. Set all environment variables in Railway dashboard
3. Railway runs: `npm run build` → `node dist/index.js`
4. Health check: `GET /health` (Railway polls every 30s)
5. Redis: provision as separate Railway service → `REDIS_URL` auto-injected

### Frontend (Railway — Static)

1. Connect frontend repo to Railway
2. Set env vars: `REACT_APP_API_URL`, `REACT_APP_WS_URL`
3. Build command: `npm ci && npm run build`
4. Start command: `npx serve -s build`
5. Add `NODE_VERSION=20` to Railway environment variables

### Graceful Shutdown

```typescript
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000); // force exit after 10s
});
```

Railway sends SIGTERM before container swap — existing connections drain gracefully.

---

## 18. Folder Structure

```
server/
├── src/
│   ├── api/
│   │   └── landing-page/
│   │       ├── signin-signup.ts       # Signup, signin, OTP verify business logic
│   │       ├── refresh.ts             # Token rotation + logout handlers
│   │       └── otp-generation-validation.ts
│   ├── middleware/
│   │   └── rate-limiter.ts            # express-rate-limit + Redis store config
│   ├── modules/
│   │   └── rooms/
│   │       ├── room.controller.ts     # HTTP handlers
│   │       ├── room.service.ts        # Room creation, validation business logic
│   │       └── room.schema.ts         # Mongoose schema + TTL index
│   ├── routes/
│   │   ├── general-routes.ts          # /signup /signin /verify-otp /refresh + Swagger
│   │   ├── authenticated-routes.ts    # /rooms /me + Swagger
│   │   └── health.routes.ts           # /health /ready
│   ├── services/
│   │   └── refresh-token.service.ts   # Redis token: store/validate/revoke/rotate
│   ├── utils/
│   │   ├── auth/jwt.ts                # sign/verify access + refresh tokens
│   │   ├── mongodb/mongo-client.ts    # MongoDB connection singleton
│   │   ├── redis/redisClient.ts       # Publisher + subscriber Redis clients
│   │   ├── swagger.ts                 # swagger-jsdoc config
│   │   └── user-colors.ts             # Deterministic color from userId hash
│   ├── websocket/
│   │   ├── socket.server.ts           # WS init, JWT auth on upgrade, heartbeat
│   │   ├── ws.router.ts               # Event handlers: JOIN, DRAW, UNDO, CURSOR, LEAVE
│   │   └── socket.types.ts            # SocketEvent enum, payload TypeScript interfaces
│   └── index.ts                       # Composition root: Express + WS + graceful shutdown
├── Dockerfile                          # Multi-stage: builder (tsc) + production (dist only)
├── docker-compose.yml                  # Local dev: server + Redis
├── .env.example
└── .dockerignore

canvas-frontend/
├── src/
│   ├── components/
│   │   └── GhostCursors.tsx            # Remote cursor overlays (pointer-events-none)
│   ├── hooks/
│   │   └── useRoomSocket.ts            # WS lifecycle, all event send/receive, reconnect
│   ├── modules/room/canvas/
│   │   ├── Canvas.tsx                  # Drawing, undo/redo stacks, imperative DOM methods
│   │   └── canvas.types.ts             # Stroke interface (strokeId, userId, points, color, width)
│   ├── pages/
│   │   ├── room/RoomPage.tsx           # Room UI: header, canvas, cursor overlay
│   │   └── Dashboard.tsx               # Create/join room
│   ├── components/signin-singup/       # Auth pages + OTP verification
│   └── lib/api.ts                      # Axios instance + auth interceptor
├── .nvmrc
└── public/
```

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18 |
| Frontend language | TypeScript | 4.9 (strict) |
| Styling | Tailwind CSS | 3.x |
| HTTP client | Axios | 1.x |
| Backend runtime | Node.js | 20 LTS |
| Backend framework | Express | 4.x |
| Backend language | TypeScript | 5.x (strict) |
| WebSocket library | `ws` | 8.x |
| Database | MongoDB | Atlas |
| ODM | Mongoose | 8.x |
| Cache / Broker | Redis | 7.x |
| Redis client | ioredis | 5.x |
| Email | Brevo HTTP API | — |
| Auth | JWT (jsonwebtoken) | — |
| Password hashing | bcrypt | — |
| Rate limiting | express-rate-limit + rate-limit-redis | — |
| API documentation | swagger-jsdoc + swagger-ui-express | — |
| Containerization | Docker (multi-stage) | — |
| Deployment | Railway | — |
| Frontend serving | Caddy (via Railway) | 2.x |

---

<div align="center">

Built with TypeScript, Redis, and WebSockets.
Designed for production from day one.

</div>
