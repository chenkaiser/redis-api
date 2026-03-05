# Redis API

An inventory management system demonstrating distributed systems patterns: Redis distributed locking, leaky bucket rate limiting, Kafka event streaming with at-least-once delivery, and buffered batch writes to Postgres.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    redis-api (HTTP :3000)             │
│                                                      │
│  POST /product/use-item                              │
│    1. Acquire Redis distributed lock (SET NX PX)     │
│    2. Atomically decrement inventory (Lua script)    │
│    3. Release lock                                   │
│    4. Emit inventory.item-used → Kafka               │
│       └─ on failure: INCR rollback + 503             │
│                                                      │
│  GET/DELETE /redis/*  ── leaky bucket rate limiter   │
└───────────────────────────┬──────────────────────────┘
                            │ inventory.item-used
                            ▼
┌──────────────────────────────────────────────────────┐
│                 order-consumer (Kafka microservice)   │
│                                                      │
│  @EventPattern('inventory.item-used')                │
│    1. Buffer event in memory                         │
│    2. On BATCH_SIZE=3: flush → Postgres (with retry) │
│    3. Commit Kafka offsets only after DB save        │
│       └─ crash before save → Kafka replays           │
│       └─ @Unique(partition, offset) prevents dupes   │
└──────────────────────────────────────────────────────┘

Logging pipeline (separate Kafka cluster):
  app containers (GELF UDP :12201)
    → logstash-ingest → log-kafka
    → logstash-indexer (2 replicas, bulk flush)
    → Elasticsearch → Kibana :5601
```

## Tech Stack

| Layer | Technology |
|---|---|
| HTTP API | NestJS 11, TypeScript 5.7 |
| Cache / Lock | Redis 7 (ioredis 5) |
| Message bus | Apache Kafka (Confluent 7.6) |
| Consumer | NestJS microservice (`@nestjs/microservices`) |
| Database | PostgreSQL 16 (TypeORM 0.3) |
| Logging | nestjs-pino → Logstash → Elasticsearch → Kibana 8.13 |
| Container | Docker Compose (dev) / Kubernetes (local) / Azure Container Apps (prod) |
| IaC | Terraform → Azure |

## Key Design Decisions

### Distributed Lock
`POST /product/use-item` acquires an exclusive lock via Redis `SET NX PX` before touching inventory. A Lua script releases the lock only if the caller's token still matches — safe against processes that outlived their TTL. Exponential back-off retries up to 5 times before returning 503.

The lock covers **only** the atomic Redis decrement. It is released before the Kafka emit so the TTL never needs to account for network latency to the broker.

### Leaky Bucket Rate Limiter
Applied to all `/redis/*` routes. State (fill level + last timestamp) lives in a single Redis hash and is updated atomically via a Lua script — no race conditions across replicas. Capacity: 100 requests, drain rate: 50 req/s.

### At-Least-Once Kafka Delivery (order-consumer)
`autoCommit: false` — Kafka offsets are committed manually only after `repo.save()` succeeds. A crash before the batch is written leaves offsets uncommitted; Kafka replays from the last committed point on restart.

A `@Unique(['kafkaPartition', 'kafkaOffset'])` constraint on the `orders` table prevents duplicate rows when a partially-saved batch is replayed.

### Redis Rollback on Kafka Failure
`KafkaProducerService.emit()` is awaitable (via `lastValueFrom`). If the broker is unreachable, the controller catches the error, increments the inventory key back (`INCR`), and returns 503 — keeping Redis and Kafka consistent.

## API Endpoints

### Product
| Method | Path | Description |
|---|---|---|
| `POST` | `/product/use-item` | Decrement inventory, emit Kafka event |
| `GET` | `/product/inventory` | Get current stock |
| `DELETE` | `/product/inventory` | Reset stock to 1000 |

### Redis (rate-limited)
| Method | Path | Description |
|---|---|---|
| `POST` | `/redis` | Write a key-value pair (optional TTL) |
| `GET` | `/redis/:key` | Read a value |
| `DELETE` | `/redis/:key` | Delete a key |
| `GET` | `/redis?pattern=*` | List keys by pattern |

### Kafka
| Method | Path | Description |
|---|---|---|
| `POST` | `/kafka/publish` | Publish any message to any topic (fire-and-forget) |

Swagger UI: `http://localhost:3000/api`

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local dev without Docker)

### Run with Docker Compose

```bash
docker compose up --build
```

Services started:
- `product-api` → http://localhost:3000
- `kibana` → http://localhost:5601
- Redis → localhost:6379
- Kafka → localhost:9092
- Postgres → localhost:5432
- Elasticsearch → localhost:9200

### Run locally (without Docker)

Start Redis, Kafka, and Postgres via Docker, then:

```bash
# Terminal 1 — redis-api
npm install
npm run start:dev

# Terminal 2 — order-consumer
cd order-consumer
npm install
npm run start:dev
```

### Environment Variables

| Variable | Default | Service |
|---|---|---|
| `REDIS_HOST` | `localhost` | redis-api |
| `REDIS_PORT` | `6379` | redis-api |
| `KAFKA_BROKER` | `localhost:9092` | redis-api, order-consumer |
| `POSTGRES_HOST` | `localhost` | order-consumer |
| `POSTGRES_PORT` | `5432` | order-consumer |
| `POSTGRES_USER` | `postgres` | order-consumer |
| `POSTGRES_PASSWORD` | `postgres` | order-consumer |
| `POSTGRES_DB` | `orders` | order-consumer |
| `NODE_ENV` | `development` | both |
| `LOG_LEVEL` | `info` | both |

## Project Structure

```
redis-api/
├── src/                         # HTTP API (redis-api)
│   ├── main.ts                  # NestFactory.create, Swagger setup
│   ├── app.module.ts
│   ├── product/                 # Inventory endpoints + distributed lock logic
│   ├── redis/                   # RedisService (lock, rate limiter), RedisController
│   └── kafka/                   # KafkaProducerService, publish endpoint
│
├── order-consumer/              # Kafka microservice (NestFactory.createMicroservice)
│   └── src/orders/
│       ├── order.consumer.ts    # @EventPattern handler
│       ├── order.service.ts     # Buffer, flush, commitOffsets
│       └── order.entity.ts      # TypeORM entity with @Unique(partition, offset)
│
├── logstash/pipeline/           # Logstash configs (ingest + indexer)
├── k8s/                         # Kubernetes manifests (kubectl apply -k k8s/)
├── terraform/                   # Azure production infrastructure
└── docker-compose.yml
```

## Kubernetes

Deploy everything to a local cluster (kind, minikube, etc.):

```bash
kubectl apply -k k8s/
```

| Service | Access |
|---|---|
| product-api | NodePort 30300 → http://localhost:30300 |
| Kibana | NodePort 30601 → http://localhost:30601 |

> **Note:** Docker Compose uses GELF UDP logging driver. In Kubernetes, apps log to stdout and the GELF pipeline is not wired — use `kubectl logs` or ship stdout to your own collector.

## Production (Terraform → Azure)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in your values
terraform init
terraform plan
terraform apply
```

| Dev (docker-compose) | Azure |
|---|---|
| redis | Azure Cache for Redis (private endpoint) |
| kafka | Azure Event Hubs namespace — business events |
| log-kafka | Azure Event Hubs namespace — logs (isolated) |
| postgres | Azure PostgreSQL Flexible Server (ZoneRedundant HA) |
| containers | Azure Container Apps (KEDA autoscaling on Event Hubs lag) |
| secrets | Azure Key Vault (private endpoint, no plaintext env vars) |

Terraform remote state is stored in Azure Blob Storage. Create the storage account manually before `terraform init` (see `terraform/versions.tf` for backend config).

## Development

```bash
# Lint + format (root app)
npm run lint:fix
npm run format

# Lint + format (order-consumer)
cd order-consumer && npm run lint:fix

# Build
npm run build
cd order-consumer && npm run build
```

Both packages use ESLint v10 flat config (`eslint.config.mjs`) with `no-floating-promises` enforced.
