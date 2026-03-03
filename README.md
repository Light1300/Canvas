<div align="center">

# 🎨 Canvas

### Production-Grade Real-Time Collaborative Whiteboard

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://typescriptlang.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://mongodb.com)
[![Railway](https://img.shields.io/badge/Deployed-Railway-purple)](https://railway.app)

**Live Demo:** [your-frontend.railway.app](https://your-frontend.railway.app)  
**API Docs:** [your-backend.railway.app/api-docs](https://your-backend.railway.app/api-docs)

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
flowchart TD

    Client[Client<br/>React + TypeScript<br/>Canvas · GhostCursors · useRoomSocket]

    subgraph Railway Deployment
        Express[Express<br/>HTTP API]
        WS[WebSocket Server<br/>ws]
    end

    Redis[(Redis<br/>Sets · Lists · Pub/Sub · TTL)]
    Mongo[(MongoDB<br/>users · rooms TTL index)]

    Client -->|HTTPS| Express
    Client -->|WSS| WS

    Express --> Redis
    WS --> Redis
    Express --> Mongo

### Why Modular Monolith Over Microservices?

At this scale, microservices would add network hops between auth and room services, require service discovery, distributed tracing, and separate deployment pipelines — all for zero throughput benefit. A modular monolith with clear domain boundaries gives the same code separation with none of the operational overhead. The boundary is enforced by folder structure, not by network.

### Horizontal Scaling

The backend is **stateless** — the only in-memory state is a `Map<connectionId, WebSocket>` of live socket references. Room membership, stroke history, and user counts all live in Redis.

flowchart TD

    LB[Load Balancer]

    subgraph Instance A
        A1[Express + WS]
        A2[connections Map]
    end

    subgraph Instance B
        B1[Express + WS]
        B2[connections Map]
    end

    Redis[(Redis<br/>Shared State + Pub/Sub)]

    LB --> A1
    LB --> B1

    A1 --> Redis
    B1 --> Redis

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

**Restart survivability:** Because zero application state lives in the process (only Redis and MongoDB), a restart is transparent. Clients reconnect, send `JOIN_ROOM`, receive `INITIAL_STATE` from Redis stroke history, and resume drawing.

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

Drawing requires sub-50ms round trips. HTTP polling at any sane interval feels laggy and wastes bandwidth on empty responses. SSE is unidirectional — clients can't send strokes without a separate HTTP channel, doubling connection complexity.

### WebSocket Server Initialization

```typescript
// Express HTTP server is passed to the WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Intercept the HTTP upgrade handshake
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

`noServer: true` means the WebSocket server doesn't bind its own port — it shares port 8080 with Express. The upgrade handshake is intercepted before the WebSocket connection is established, so **no unauthenticated socket ever enters the system**.

### Client Authentication Flow

sequenceDiagram
    participant Client
    participant Server
    participant JWT

    Client->>Server: Upgrade request (?token=JWT)
    Server->>JWT: verify(token)
    JWT-->>Server: decoded payload
    Server-->>Client: 101 Switching Protocols
    

`userId`, `username`, and `color` are set **server-side** from the verified JWT. Clients cannot spoof their identity by sending a crafted payload.

### Preventing Unauthorized Room Access

- JWT verified at upgrade — no socket without valid token
- Room existence validated against MongoDB on `JOIN_ROOM`
- `socket.currentRoom` tracks which room a socket is in — event handlers check this before processing
- Undo ownership: `stroke.userId === socket.userId` enforced server-side

### Handling Reconnects

`useRoomSocket.ts` implements automatic reconnection:

```typescript
// On close event, attempt reconnect after delay
ws.onclose = () => {
  setConnectionStatus("disconnected");
  setTimeout(() => connectWebSocket(), 2000); // 2s backoff
};
```

On reconnect, the client sends `JOIN_ROOM` again → server sends `INITIAL_STATE` from Redis → canvas replays all strokes. The user experience is seamless.

### Unexpected Disconnects

When a browser closes, refreshes, or the network drops, no `close` frame may be sent. The heartbeat detects this:

```
Server pings every 10 seconds
  ├── socket.isAlive = false, socket.ping()
  ├── If pong received: socket.isAlive = true ✅
  └── If no pong by next interval: socket.terminate() → 'close' event fires → cleanup runs
```

Cleanup: `SREM` from Redis user set → count recalculated → `CURSOR_LEAVE` + `USER_LEFT` + `USER_COUNT_UPDATED` broadcast to room.

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

This handles the edge case where a server crashed without cleaning up Redis — the next join sweeps stale entries.

### Memory Leak Prevention

- `connections` Map keyed by `connectionId` — entries removed in `close` handler
- `socket.on("error")` triggers same cleanup as `close` — no leaked references on error
- Heartbeat terminates unresponsive sockets — they don't accumulate
- `socket.currentRoom` set to `null` after `LEAVE_ROOM` — prevents double-cleanup on disconnect

### Flood Prevention

- Client-side: cursor events throttled to 50ms (max 20/sec) in `useRoomSocket`
- Server-side: rate limiting on HTTP endpoints via `express-rate-limit` + Redis store
- WebSocket messages are typed and validated — unrecognized event types are silently dropped
- No per-socket rate limiting currently (future: track message count per connectionId in Redis)

---

## 4. Redis Design

### Why Redis?

Redis serves four distinct roles in this system simultaneously: **ephemeral state store**, **message broker**, **rate limit counter store**, and **token store**. No other single tool does all four with sub-millisecond latency. PostgreSQL could store the data but not act as a pub/sub broker. Kafka could broker messages but adds ZooKeeper and operational complexity. Redis does everything in one.

### Data Structures Used

**Sets — Room Membership**
```
room:{roomId}:users → Set { "conn-uuid-1", "conn-uuid-2" }

SADD   room:{roomId}:users {connectionId}    // join      O(1)
SREM   room:{roomId}:users {connectionId}    // leave     O(1)
SCARD  room:{roomId}:users                   // count     O(1)
SMEMBERS room:{roomId}:users                 // sweep     O(N)
```
Sets prevent duplicate membership and provide O(1) add/remove/count. Membership keyed by `connectionId` (not `userId`) so a user with two tabs counts as two presences.

**Lists — Stroke History**
```
room:{roomId}:strokes → List [ "{stroke1}", "{stroke2}", ... ]

RPUSH  room:{roomId}:strokes {JSON}    // append stroke   O(1)
LRANGE room:{roomId}:strokes 0 -1      // full history    O(N)
LREM   room:{roomId}:strokes 0 {JSON}  // undo by value   O(N)
```
Lists preserve insertion order — critical for stroke replay. Each stroke is a JSON string containing `strokeId`, `userId`, `points[]`, `color`, `width`.

**Strings with TTL — Refresh Tokens**
```
refresh:{sha256(token)} → userId    (TTL: 30 days = 2,592,000s)

SETEX  refresh:{hash}  2592000  {userId}   // store
GET    refresh:{hash}                       // validate
DEL    refresh:{hash}                       // revoke / rotate
```
Tokens stored hashed (SHA-256) — the raw token only exists in the HTTP response, never in the database.

**Strings with TTL — Rate Limiting**
```
rl:auth:{ip}     → count    (TTL: 900s,  max: 10)
rl:room:{ip}     → count    (TTL: 3600s, max: 20)
rl:refresh:{ip}  → count    (TTL: 900s,  max: 30)
```

**Pub/Sub — Cross-Instance Broadcasting**
```
Channel: room:{roomId}
PUBLISH room:{roomId} {JSON message}
PSUBSCRIBE room:*  → receives all room channels
```

### Why Store Room Members in Redis Instead of Memory?

If stored in memory (`const rooms = new Map()`):
- Instance restart → all membership lost → ghost users everywhere
- Instance B cannot know who is connected to Instance A
- Horizontal scaling is impossible — each instance has a different view

Redis gives a **single shared view** of all room membership, visible to all instances simultaneously.

### TTL Strategy

| Key | TTL Set When | TTL Value |
|---|---|---|
| `room:{id}:users` | Room empties (`SCARD === 0`) | 24 hours |
| `room:{id}:strokes` | Room empties OR on every RPUSH | 24 hours |
| `refresh:{hash}` | Token created | 30 days |
| `rl:*` | First hit in window | Window duration |

Active rooms never expire — TTL is reset on every `CANVAS_UPDATE` via `EXPIRE room:{id}:strokes 86400`. When the MongoDB room TTL fires, the expiry watcher broadcasts `ROOM_EXPIRED` and explicitly deletes both Redis keys.

### Redis Crash Behavior

- New WebSocket connections cannot join rooms (JOIN_ROOM fails)
- Existing connections lose pub/sub — strokes no longer sync between users
- Rate limiting fails open — all requests pass through (acceptable degradation)
- Refresh token validation fails — users cannot refresh, must re-login after access token expires
- Health endpoint returns 503 — Railway restarts the instance
- On Redis recovery: all operations resume, stroke history preserved if Redis persisted to disk (RDB/AOF)

### Data Consistency in Redis

Redis is single-threaded for command execution — RPUSH and PUBLISH are atomic individually. The sequence `RPUSH → PUBLISH` is not atomic as a unit, but the worst case is a publish with no corresponding stroke (receiver does a re-fetch). This is acceptable — canvas sync is eventually consistent by design.

---

## 5. Pub/Sub Design

### Why Pub/Sub Is Necessary

Each server instance only holds WebSocket references for its **own** connected clients. Without a message bus, a stroke from User A (on Instance 1) would never reach User B (on Instance 2).

```
Without Pub/Sub:                    With Redis Pub/Sub:

Instance 1    Instance 2            Instance 1         Instance 2
User A ──►    User B                User A ──► PUBLISH ──► SUBSCRIBE ──► User B ✅
              (never notified ❌)                 Redis channel
```

### How Pub/Sub Enables Horizontal Scaling

Every instance subscribes to `room:*` via `pSubscribe` (pattern subscribe). When any instance publishes to `room:{roomId}`, every other instance receives it and forwards to its local sockets in that room.

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

### Channel Design

**One channel per room:** `room:{roomId}`

All event types share the same channel. The `type` field in the message payload routes to the correct handler on the client.

### Message Format

```typescript
{
  type: "CANVAS_UPDATE" | "USER_JOINED" | "USER_LEFT" | "CURSOR_MOVE" | 
        "CURSOR_LEAVE" | "UNDO" | "REDO" | "USER_COUNT_UPDATED" | "ROOM_EXPIRED",
  payload: {
    roomId: string,
    // event-specific fields:
    stroke?: Stroke,        // CANVAS_UPDATE, REDO
    strokeId?: string,      // UNDO
    userId?: string,        // USER_JOINED, USER_LEFT, CURSOR_LEAVE
    username?: string,      // USER_JOINED, CURSOR_MOVE
    color?: string,         // USER_JOINED, CURSOR_MOVE
    x?: number, y?: number, // CURSOR_MOVE
    count?: number,         // USER_COUNT_UPDATED
  }
}
```

### How Subscribers Know Which Room to Forward To

The channel name encodes the room: `room:{roomId}`. The subscriber extracts `roomId` from the channel name and calls `broadcastToRoom(roomId, message)` which iterates `connections` and sends only to sockets where `socket.currentRoom === roomId`.

### Avoiding Duplicate Broadcasts

Each WebSocket connection exists on **exactly one** instance. When Instance A publishes, both Instance A and Instance B receive it via their subscribers. Instance A's `broadcastToRoom` sends to its local sockets. Instance B's `broadcastToRoom` sends to its local sockets. No socket is on two instances simultaneously — no duplicates.

### What Happens If a Message Is Lost?

Redis Pub/Sub is **at-most-once** — no persistence, no acknowledgement. If the subscriber is temporarily disconnected, messages during that window are lost.

For canvas strokes: the stroke is already persisted to Redis List via `RPUSH` before publishing. A client that misses the pub/sub message will receive the stroke on their next `JOIN_ROOM` via `INITIAL_STATE`. For cursor moves: loss is invisible — the next cursor move event corrects the position. This is an acceptable tradeoff for the latency benefits.


### Why Redis Pub/Sub Over Kafka or NATS?

| | Redis Pub/Sub | Kafka | NATS |
|---|---|---|---|
| Already in stack | ✅ | ❌ | ❌ |
| Latency | <1ms | 5–15ms | <1ms |
| Persistence | ❌ (at-most-once) | ✅ | Optional |
| Operational overhead | None | ZooKeeper + brokers | Separate cluster |
| Ordering guarantee | Per-channel | Per-partition | Per-subject |
| At-scale limit | ~100k msg/s | Millions/s | Millions/s |

For this use case — ephemeral real-time events where loss of individual cursor events is invisible — Redis Pub/Sub is the right tool. Kafka would be appropriate if we needed audit logs, replay, or guaranteed delivery of every stroke.

---

## 6. Real-Time Canvas Synchronization

### How Late Joiners See Existing Strokes

On `JOIN_ROOM`:
```typescript
// Server fetches full stroke history from Redis
const raw = await redis.lRange(`room:${roomId}:strokes`, 0, -1);
const strokes = raw.map(s => JSON.parse(s));

// Sends as INITIAL_STATE to the joining socket
socket.send(JSON.stringify({ type: "INITIAL_STATE", payload: { strokes } }));
```

sequenceDiagram
    participant UserA
    participant Instance
    participant Redis
    participant UserB

    UserA->>Instance: CANVAS_UPDATE
    Instance->>Redis: RPUSH stroke
    Instance->>Redis: PUBLISH event
    Redis-->>Instance: Pub/Sub message
    Instance-->>UserB: Broadcast stroke

Client receives `INITIAL_STATE` → `canvas.__replaceStrokes(strokes)` → canvas cleared → all strokes redrawn in order. The late joiner sees the exact same canvas as everyone else.

### Why Stroke History Over Snapshot Images?

| | Stroke History | Canvas Snapshot (PNG) |
|---|---|---|
| Storage size | ~500 bytes/stroke | ~500KB–2MB per snapshot |
| Replay fidelity | Pixel-perfect | Lossy (JPEG) or large (PNG) |
| Undo support | ✅ Remove stroke from list | ❌ Cannot un-render |
| Late join latency | Replay time (fast) | Transfer time (slow for large canvases) |
| Implementation complexity | Low | High (canvas-to-base64, storage, serving) |

Strokes are the natural unit of drawing. Storing them preserves every operation and enables undo as a first-class feature.

### Performance Implications of Storing Strokes

Each stroke is ~500 bytes of JSON (array of `{x, y}` points). A heavy 2-hour session might produce 5,000 strokes = 2.5MB in Redis. `LRANGE 0 -1` fetches all in one round trip. Network transfer of 2.5MB on a fast connection takes ~25ms — acceptable for a join operation.

### Behavior With 10,000 Strokes

`LRANGE` fetches all 10,000 strokes (~5MB) in one Redis command (~10ms). Network transfer to client: ~500ms on 100Mbps, 5s on 10Mbps. Canvas replay: O(N) redraws, ~2–5 seconds for 10,000 strokes.

**Production mitigation (not yet implemented):**
1. Every N strokes (e.g., 500), render canvas to base64 PNG → store in MongoDB as snapshot
2. Reset Redis stroke list to empty
3. Late joiners receive: snapshot (render instantly) + delta strokes since last snapshot
4. Result: join latency capped regardless of session length

### Preventing Race Conditions in Drawing

Canvas drawing is **append-only** — two users drawing simultaneously each produce independent strokes. Redis `RPUSH` is atomic. Two simultaneous RPUSHes are serialized by Redis's single-threaded execution. Order may differ between instances but both strokes are preserved — no data loss, no conflict.

### Eventual Consistency vs Strong Consistency

**Eventually consistent (AP system under CAP).** 

The sequence for a stroke is: `client draws → RPUSH to Redis → PUBLISH to channel → other clients render`. The RPUSH and PUBLISH are separate operations. In the rare case where RPUSH succeeds but PUBLISH fails, the stroke is in Redis (persistent) but other clients don't see it immediately — they'll see it on their next `JOIN_ROOM`. This is eventual consistency in practice.

---

## 7. Security & Abuse Prevention

### Input Validation

WebSocket payloads are typed via TypeScript interfaces. Event handlers destructure only expected fields — unrecognized fields are ignored. No user-provided string is ever executed or rendered as HTML.

### XSS Prevention

Canvas strokes are `{x, y}` coordinate arrays and CSS color strings. They are rendered via Canvas API (`ctx.lineTo`, `ctx.stroke`) — **never injected into the DOM**. Usernames are rendered via React's JSX which escapes all HTML entities by default. No `dangerouslySetInnerHTML` anywhere.

### Room Brute Forcing Prevention

- Room IDs are UUIDs (122 bits of entropy) — guessing is computationally infeasible
- `GET /api/user/rooms/:roomId` validates room existence — returns 404 for invalid IDs
- Rate limiting on authenticated endpoints: 20 room validations per 15 minutes per IP

### Rate Limiting

`express-rate-limit` with Redis store (survives restarts, shared across instances):

| Endpoint | Window | Limit | Purpose |
|---|---|---|---|
| `/signup`, `/signin` | 15 min | 10 req | Prevent brute force |
| `POST /rooms` | 1 hour | 20 req | Prevent room spam |
| `/refresh-token` | 15 min | 30 req | Prevent token abuse |

`app.set("trust proxy", 1)` ensures real client IP is used behind Railway's reverse proxy.

### Environment Secrets

All secrets are environment variables — never committed to source. `.env.example` documents variable names with no values. Railway injects secrets at runtime. Docker Compose reads from `.env` via `${VAR}` syntax.

```
ACCESS_TOKEN_SECRET     # 64-char random hex
REFRESH_TOKEN_SECRET    # 64-char random hex
VERIFICATION_SECRET     # 64-char random hex
BREVO_API_KEY           # email provider key
MONGO_URI               # connection string with embedded credentials
REDIS_URL               # redis://user:pass@host:port
```

### WebSocket Event Validation

Every incoming event is routed through a typed handler map:

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

Server-side enforcement: `userId` and `username` are read from `socket.userId` / `socket.username` (set at auth time) — not from the client payload.

### Oversized Payload Protection

The `ws` library has a default `maxPayload` of 100MB. For this use case (strokes and cursor positions), payloads should never exceed a few KB. A hardened production deployment would set:

```typescript
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 }); // 64KB max
```

### DDoS Mitigation

Current: Railway's infrastructure provides basic DDoS protection at the network layer. Rate limiting prevents application-layer abuse.

Production hardening would add: Cloudflare in front of the backend (WAF + DDoS), connection limits per IP at the WebSocket level, and per-connection message rate limits tracked in Redis.

### Replay Attack Prevention

Refresh tokens rotate on every use — each token is single-use. If an attacker intercepts and uses a refresh token before the legitimate user, the legitimate user's next refresh will find the old token missing and receive a 401. The attack is detected. Access tokens are short-lived (15 minutes) — replay window is bounded.

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

### Behavior During Deployment Restart

1. Railway sends SIGTERM → graceful shutdown handler fires
2. Server stops accepting new connections, existing connections drain (10s window)
3. All Redis state is intact — room membership, strokes, tokens
4. New instance starts, reconnects to Redis and MongoDB
5. WebSocket clients detect disconnect → reconnect automatically
6. Clients send `JOIN_ROOM` → receive `INITIAL_STATE` → resume drawing
7. **No data lost. No user action required.**

### Eventual vs Strict Consistency

**Eventual consistency** — chosen deliberately. The RPUSH → PUBLISH sequence is two separate Redis operations. Between them, a new joiner could receive `INITIAL_STATE` without the in-flight stroke — but will receive it within milliseconds when the stroke is published. For a collaborative drawing tool, this sub-millisecond inconsistency window is imperceptible.

### Split-Brain Prevention

With Redis as the single source of truth, split-brain is prevented at the data layer. If a network partition isolates Instance A from Redis, Instance A cannot read or write room state — it effectively stops functioning. This is a partition-intolerant design at the Redis layer, trading availability for consistency of the state store. The canvas itself (what users see) is AP — instances continue broadcasting locally even if Redis is unreachable.

---

## 9. Reliability & Fault Tolerance

### Redis Goes Down

- `JOIN_ROOM` fails — new users cannot enter rooms
- `CANVAS_UPDATE` fails silently — strokes not persisted or broadcast cross-instance
- Rate limiting fails open — requests pass through
- Refresh tokens cannot be validated — logged-out users cannot refresh
- Health endpoint returns 503 → Railway restarts instance
- **Recovery:** Redis restart restores all persisted data (if RDB/AOF enabled); pub/sub channels reconnect automatically

### MongoDB Goes Down

- Signup, signin, verify-otp fail — new auth impossible
- `JOIN_ROOM` validation fails — room lookup returns error
- Existing WebSocket connections are **unaffected** — they don't query MongoDB during drawing
- Health endpoint returns 503 → Railway restarts instance

### One Instance Crashes

- Clients connected to that instance lose their WebSocket connection
- `close` event may not fire cleanly — heartbeat on remaining instances eventually cleans up Redis membership
- Clients reconnect to another instance (load balancer round-robins)
- `JOIN_ROOM` → `INITIAL_STATE` from Redis → drawing resumes
- No data lost

### WebSocket Connection Rehydration

On reconnect, `useRoomSocket` automatically:
1. Creates new WebSocket with fresh JWT
2. Sends `JOIN_ROOM` with the current `roomId`
3. Receives `INITIAL_STATE` → canvas replays
4. User is back in the room within 2–3 seconds

### Backpressure Handling

Node.js streams have built-in backpressure. The `ws` library respects `socket.bufferedAmount` — if a client's send buffer is full, messages queue. Currently no explicit backpressure handling beyond this. At high message rates, slow clients could accumulate large buffers — production hardening would drop messages for lagging clients after a threshold.

### Event Storm Prevention

- Cursor events throttled at the source: 50ms minimum interval in `useRoomSocket`
- Rate limiting prevents HTTP endpoint storms
- WebSocket message types are validated — invalid types dropped without processing
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

### Where Does Validation Live?

- **HTTP inputs:** `express-rate-limit` at route level, body destructuring in controllers
- **WebSocket inputs:** event router's handler map (unknown types dropped), TypeScript interfaces
- **Auth validation:** `verifyAccessToken` in middleware, called before any authenticated route

### Where Does Business Logic Live?

`src/api/` and `src/modules/*/service.ts` — no Redis or Express imports. Pure functions that take data and return results.

### Where Does Transport Logic Live?

`src/routes/` (HTTP) and `src/websocket/ws.router.ts` (WebSocket). These files orchestrate: validate input → call business logic → write to Redis → publish event → send response.

### Is WebSocket Logic Isolated From HTTP?

Yes. `src/websocket/` has no Express imports. `src/routes/` has no WebSocket imports. They share only utility modules (Redis client, JWT). The WebSocket server is initialized once in `index.ts` by passing the HTTP server reference.

### Is the Redis Client Abstracted?

Two dedicated Redis clients:
- `redisPublisher` — for all WRITE operations (RPUSH, PUBLISH, SADD, etc.)
- `redisSubscriber` — dedicated to PSUBSCRIBE (cannot run other commands while subscribed)

Both exported from `src/utils/redis/redisClient.ts`. No direct `ioredis` imports in business logic.

---

## 11. Infrastructure Readiness

### Can This System Scale Horizontally?

Yes. The only instance-local state is the `connections` Map. Redis handles all coordination. Add instances behind a load balancer with no configuration changes.

### Scaling to 10,000 Concurrent Users

| Bottleneck | Current Limit | Fix |
|---|---|---|
| Redis pub/sub throughput | ~100k msg/s (single instance) | Redis Cluster with channel-key affinity |
| Stroke history payload | ~5MB at 10k strokes | Canvas snapshotting every 500 strokes |
| MongoDB connections | Pool exhaustion at ~1k concurrent | Increase pool size, add read replica |
| Node.js event loop | CPU-bound at very high msg rates | Cluster mode (multiple processes per machine) |
| WebSocket connections | ~65k per instance (OS socket limit) | Multiple instances behind load balancer |

### Metrics to Monitor

| Metric | Alert Threshold | Tool |
|---|---|---|
| Redis memory usage | >80% of allocated | Railway metrics |
| Redis pub/sub lag | >100ms | Custom gauge |
| WebSocket connection count | >50k per instance | Custom gauge |
| HTTP p99 latency | >500ms | Railway / Datadog |
| `INITIAL_STATE` payload size | >10MB | Custom histogram |
| Reconnect rate | >5% per minute | Custom counter |
| Rate limit hits | >100/min | express-rate-limit counter |

### Critical Logs

```
[WS] Connected: {connectionId} ({username})
[WS] {username} joined room {roomId} — {n} online
[WS] Dead connection detected: {connectionId} — terminating
[WS] Cleaned up: {connectionId} — {n} remaining in {roomId}
[Shutdown] SIGTERM received — closing gracefully
```

### Load Balancing & Sticky Sessions

**Sticky sessions are not required** because all session state is in Redis. A round-robin load balancer works. WebSocket connections naturally stick to one instance for their duration (TCP-level stickiness), but reconnects can land on any instance without issue.

---

## 12. Performance

### Current Bottleneck

Redis pub/sub throughput on a single instance (~100k messages/second). At 50 users per room, each moving their cursor at 20 events/second = 1,000 events/room/second. At 100 concurrent active rooms = 100,000 events/second — approaching the limit.

**Second bottleneck:** `INITIAL_STATE` payload for rooms with thousands of strokes. One `LRANGE 0 -1` on 10,000 strokes is a ~5MB Redis read and ~5MB network transfer.

### Messages Per Second — One Room

50 users × 20 cursor events/s = 1,000 pub/sub messages/s per room  
50 users × 2 strokes/s = 100 additional messages/s  
**Total: ~1,100 messages/second per active room**

### Broadcasting Cost — N Users

`broadcastToRoom` iterates all local connections filtering by `currentRoom`. Cost: O(total_connections) per room event. At 10,000 total connections and 50 per room, that's 10,000 iterations to find 50 recipients. **Fix:** maintain a `roomConnections: Map<roomId, Set<connectionId>>` index for O(room_size) broadcast instead of O(total_connections).

### Memory Footprint Per Room

| Item | Size |
|---|---|
| Redis Set (50 members) | ~3KB |
| Redis List (1,000 strokes) | ~500KB |
| In-memory socket refs (50) | ~50KB |
| **Total per room** | **~553KB** |

1,000 rooms = ~553MB Redis + ~50MB Node.js heap. Well within Railway's 8GB Redis limit.

### Redis Pub/Sub Scalability

Single Redis instance: ~100k messages/s. Redis Cluster: linearly scalable by adding shards, with the constraint that all subscribers to a channel must be on the same shard (enforce via hash tags: `room:{roomId}` → hash slot determined by `roomId`).

---

## 13. Extensibility

### Adding Private Rooms

Add `isPrivate: boolean` and `password: string` (bcrypt-hashed) to room schema. `JOIN_ROOM` handler checks password before admitting. Invite links encode a signed token with `roomId` — no password required if token valid.

### Adding Persistent Rooms

1. Add `Board` model: `{ ownerId, title, createdAt }` — no `expiresAt`
2. On room creation, optionally link to Board
3. Move stroke storage: Redis List → MongoDB collection with `boardId` index
4. Keep Redis as write-through cache for active boards
5. `GET /api/user/boards` returns board list
6. This is the **premium feature** — free tier keeps 24h ephemeral rooms

### Adding File Attachments

Upload to S3/R2 via presigned URL (client → S3 directly, no server proxy). Store S3 key in stroke payload as type `IMAGE`. Canvas renders `drawImage()` from URL. Add `Content-Type` validation and file size limits at the presigned URL generation step.

### Adding Replay Functionality

Strokes already have timestamps (add `createdAt` to stroke schema). `GET /api/user/rooms/:roomId/replay` returns strokes ordered by timestamp. Frontend renders them progressively with `setTimeout` delays matching the original timing.

### Adding Room Analytics

Publish analytics events to a separate Redis stream (`XADD room:{id}:analytics`). Background worker reads the stream and writes to MongoDB analytics collection: stroke count, user count over time, session duration, peak concurrent users.

### Versioning the WebSocket Protocol

```
wss://api.example.com/ws?token=...&v=2
```

Server routes to handler sets by version:
```typescript
const router = version === "2" ? routerV2 : routerV1;
```

Maintain N-1 versions. Deprecate with 90-day notice. Clients negotiate via initial handshake message.

---

## 14. Tradeoffs & Alternatives

### Why Redis Over In-Memory Adapter?

In-memory state breaks on restart and makes horizontal scaling impossible. Redis adds ~1ms network latency per operation but provides persistence, shared state across instances, built-in TTL, pub/sub, and atomic operations. The latency is negligible compared to the WebSocket round-trip.

### Why MongoDB?

Users and room metadata need persistent storage with query capability (find user by email, find room by roomId, TTL index for auto-expiry). MongoDB's native TTL index eliminates the need for a cron job to clean expired rooms. The flexible schema accommodated the evolving room model without migrations.

### Why Not Serverless?

WebSocket connections are long-lived (minutes to hours). Serverless functions time out after 30 seconds (AWS Lambda) or 60 seconds (Vercel). There is no serverless primitive for maintaining a persistent WebSocket connection server-side. Serverless is appropriate for the REST API but not for the real-time layer.

### Why `ws` Instead of Socket.IO?

| | Socket.IO | `ws` |
|---|---|---|
| Bundle size | +30KB client | 0 (native WebSocket API) |
| Protocol | Custom framing over WS | Standard RFC 6455 |
| Reconnection | Built-in | Implemented explicitly |
| Rooms | Built-in abstraction | Redis Sets |
| Polling fallback | ✅ (legacy browser support) | ❌ |
| Visibility | Opaque | Full control |

Socket.IO's abstractions hide what's actually happening. Every feature it provides (rooms, broadcasting, reconnection) is implemented explicitly here with Redis — giving full control, visibility, and no hidden behavior.

### Why Not a Managed Pub/Sub Service?

AWS SNS, Google Pub/Sub, or Ably would add $50–200/month in costs, an external network hop on every message (~10–50ms vs <1ms for Redis), and a new dependency with its own SDK, auth, and failure modes. Redis already handles this workload at sub-millisecond latency.

### Why Not CRDTs?

CRDTs (Yjs, Automerge) are designed for text collaboration where two users editing the same character position need conflict resolution. Canvas drawing is **append-only** — two users drawing simultaneously produce two independent strokes. There is no conflict. CRDTs would add ~40KB to the bundle, a complex synchronization protocol, and significant implementation complexity for zero benefit.

---

## 15. Deep Technical Questions

### Is the System CP or AP Under CAP Theorem?

**AP (Available + Partition Tolerant)** for the canvas layer. During a Redis network partition:
- Each instance continues serving local WebSocket connections
- Drawing and broadcasting continues locally
- Cross-instance synchronization stops — instances diverge
- On partition recovery, Redis pub/sub resumes, but diverged strokes are not reconciled

**CP for Redis itself** — Redis (in default mode) prioritizes consistency within the Redis cluster. A minority-partition Redis node stops accepting writes.

### Is WebSocket Cluster State Eventually Consistent?

Yes. The sequence `RPUSH → PUBLISH` is two separate operations. A client could theoretically receive the pub/sub event before the RPUSH completes (highly unlikely — RPUSH is synchronous before PUBLISH). A late joiner between these two operations would miss the stroke in `INITIAL_STATE` but receive it via the subsequent pub/sub event. This is a sub-millisecond inconsistency window.

### How Do You Prevent Ghost Users in Redis?

Three mechanisms working in concert:

1. **Proactive sweep on JOIN_ROOM** — iterate Redis user set, remove any `connectionId` not in local `connections` Map
2. **Reactive cleanup on disconnect** — `close` event → `SREM` → recount → broadcast
3. **TTL safety net** — when room empties, both Redis keys get 24h TTL; on next join, stale key is overwritten

### Can Pub/Sub Cause Message Ordering Issues?

Within a single Redis instance, pub/sub messages on a given channel are delivered in publication order — Redis is single-threaded. Across Redis Cluster shards, ordering is per-shard. With channel-key affinity (hash tags), all messages for `room:{roomId}` land on the same shard, preserving order.

In practice at current scale (single Redis instance), ordering is always preserved.

### Idempotency Strategy

- `JOIN_ROOM`: Idempotent — SADD on a Set is idempotent (duplicate adds are ignored)
- `CANVAS_UPDATE`: Not idempotent — duplicate RPUSHes create duplicate strokes. Mitigated by `strokeId` (UUID) which allows deduplication on the client
- `UNDO`: Idempotent — LREM removes all matching strokes; second LREM on same strokeId is a no-op
- `LEAVE_ROOM`: Idempotent — SREM on non-existent member is a no-op

### Debugging a Production Real-Time Issue

```
1. Check health endpoint: GET /backend.railway.app/health
2. Check Railway logs for connection/disconnection patterns
3. Query Redis directly:
   SCARD room:{roomId}:users          → how many members Redis thinks exist
   LLEN room:{roomId}:strokes         → stroke count
   PUBSUB CHANNELS room:*             → which room channels are active
   PUBSUB NUMSUB room:{roomId}        → how many subscribers
4. Compare Redis user count vs actual client count in browser
5. Check for ghost connectionIds: SMEMBERS room:{roomId}:users vs connections Map
6. Force-test pub/sub: PUBLISH room:{roomId} '{"type":"TEST","payload":{}}'
   → should appear in server logs if subscriber is healthy
```

### What Metrics Define Success?

| Metric | Target | Meaning |
|---|---|---|
| Stroke sync latency (P95) | <100ms | Strokes appear near-instantly |
| `JOIN_ROOM` to first paint | <500ms | Late join feels fast |
| Cursor update latency | <50ms | Presence feels live |
| Ghost user rate | <0.1% | Cleanup is working |
| Reconnect success rate | >99% | Clients recover from drops |
| Redis pub/sub lag | <10ms | Cross-instance sync is healthy |

---

## 16. If This Gets 100,000 Daily Active Users Tomorrow

### What Breaks First?

**Redis pub/sub throughput.** 100k DAU → assume 10k concurrent peak → 200 active rooms × 1,100 msg/s = 220,000 messages/second. Single Redis instance handles ~100k/s. **Redis becomes the bottleneck.**

**Second:** `broadcastToRoom` is O(total_connections) — at 10k connections, iterating all of them per event is expensive. Need `roomConnections` index.

**Third:** `INITIAL_STATE` for high-stroke rooms causes Redis → Node.js → Client data transfer spikes.

### What to Redesign

1. **Redis Cluster** with hash-tag channel affinity: `{roomId}` as hash key → all room state on same shard
2. **Room connection index:** `roomConnections: Map<roomId, Set<connectionId>>` → O(N) broadcast where N is room size, not total connections
3. **Canvas snapshotting:** every 500 strokes, snapshot to S3 → reset stroke list → join fetches snapshot + delta
4. **Horizontal WebSocket scaling:** 10+ Node.js instances, Redis Cluster as coordinator

### What to Move to Managed Infrastructure

| Component | Current | At Scale |
|---|---|---|
| Redis | Railway Redis | AWS ElastiCache (Redis Cluster mode) |
| MongoDB | Atlas Free | Atlas Dedicated M30+ with read replicas |
| WebSocket servers | Railway | AWS ECS Fargate (auto-scaling) |
| Load balancer | Railway (built-in) | AWS ALB with WebSocket support |
| Static frontend | Railway Caddy | CloudFront + S3 |
| Email | Brevo | AWS SES (cost: $0.10/1000 emails) |

**Total infrastructure cost at 100k DAU:** ~$500–800/month on AWS. Recoverable from ~200 premium subscribers at $5/month.

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

# Start Redis via Docker
docker-compose up redis -d

# Install and run
npm install
npm run dev
```

### Frontend Setup

```bash
cd canvas-frontend
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:8080/api
# Set REACT_APP_WS_URL=ws://localhost:8080

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

curl http://localhost:8080/api-docs.json | jq '.paths | keys'
# Lists all documented API routes
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
  server.close(() => process.exit(0));        // stop accepting new connections
  setTimeout(() => process.exit(1), 10000);  // force exit after 10s if stuck
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
│   │       ├── otp-generation-validation.ts
│   │       └── verify-token.ts
│   ├── middleware/
│   │   └── rate-limiter.ts            # express-rate-limit + Redis store config
│   ├── modules/
│   │   └── rooms/
│   │       ├── room.controller.ts     # HTTP handlers
│   │       ├── room.service.ts        # Room creation, validation business logic
│   │       └── room.schema.ts         # Mongoose schema + TTL index
│   ├── routes/
│   │   ├── general-routes.ts          # /signup /signin /verify-otp /refresh + Swagger
│   │   ├── authenticated-routes.ts   # /rooms /me + Swagger
│   │   └── health.routes.ts           # /health /ready
│   ├── services/
│   │   └── refresh-token.service.ts  # Redis token: store/validate/revoke/rotate
│   ├── utils/
│   │   ├── auth/jwt.ts               # sign/verify access + refresh tokens
│   │   ├── mongodb/mongo-client.ts   # MongoDB connection singleton
│   │   ├── redis/redisClient.ts      # Publisher + subscriber Redis clients
│   │   ├── swagger.ts                # swagger-jsdoc config
│   │   └── user-colors.ts            # Deterministic color from userId hash
│   ├── websocket/
│   │   ├── socket.server.ts          # WS init, JWT auth on upgrade, heartbeat
│   │   ├── ws.router.ts              # Event handlers: JOIN, DRAW, UNDO, CURSOR, LEAVE
│   │   └── socket.types.ts           # SocketEvent enum, all payload TypeScript interfaces
│   └── index.ts                      # Composition root: Express + WS + graceful shutdown
├── Dockerfile                         # Multi-stage: builder (tsc) + production (dist only)
├── docker-compose.yml                 # Local dev: server + Redis
├── .env.example                       # Variable names, no values
└── .dockerignore

canvas-frontend/
├── src/
│   ├── components/
│   │   └── GhostCursors.tsx           # Remote cursor overlays (pointer-events-none)
│   ├── hooks/
│   │   └── useRoomSocket.ts           # WS lifecycle, all event send/receive, reconnect
│   ├── modules/room/canvas/
│   │   ├── Canvas.tsx                 # Drawing, undo/redo stacks, imperative DOM methods
│   │   └── canvas.types.ts            # Stroke interface (strokeId, userId, points, color, width)
│   ├── pages/
│   │   ├── room/RoomPage.tsx          # Room UI: header, canvas, cursor overlay
│   │   └── Dashboard.tsx              # Create/join room
│   ├── components/signin-singup/      # Auth pages + OTP verification
│   └── lib/api.ts                     # Axios instance + auth interceptor
├── .nvmrc                             # Node 20 pin
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
