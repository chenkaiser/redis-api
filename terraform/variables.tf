variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Deployment environment tag (prod / staging)"
  type        = string
  default     = "prod"
}

variable "project" {
  description = "Short project name — used in all resource names"
  type        = string
  default     = "redisapi"
}

# ── Networking ─────────────────────────────────────────────────────────────────

variable "vnet_address_space" {
  description = "VNet CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aca_subnet_cidr" {
  description = "Subnet delegated to Azure Container Apps environment"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_endpoint_subnet_cidr" {
  description = "Subnet for private endpoints (Redis, Postgres, Key Vault, ACR)"
  type        = string
  default     = "10.0.2.0/24"
}

# ── Container Registry ─────────────────────────────────────────────────────────

variable "acr_sku" {
  description = "ACR SKU — Premium required for private endpoints"
  type        = string
  default     = "Premium"
}

# ── Redis ──────────────────────────────────────────────────────────────────────

variable "redis_sku" {
  description = "Redis SKU: Basic / Standard / Premium"
  type        = string
  default     = "Standard"
}

variable "redis_capacity" {
  description = "Redis cache size (0–6 for Basic/Standard, 1–4 for Premium)"
  type        = number
  default     = 1
}

# ── Event Hubs ─────────────────────────────────────────────────────────────────

variable "eventhub_sku" {
  description = "Event Hubs namespace SKU — Standard for Kafka surface"
  type        = string
  default     = "Standard"
}

variable "eventhub_capacity" {
  description = "Throughput units for each Event Hubs namespace"
  type        = number
  default     = 2
}

# ── PostgreSQL ─────────────────────────────────────────────────────────────────

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "postgres_storage_mb" {
  description = "Storage in MB"
  type        = number
  default     = 32768
}

variable "postgres_admin_user" {
  description = "Postgres admin username"
  type        = string
  default     = "psqladmin"
}

variable "postgres_admin_password" {
  description = "Postgres admin password — override via TF_VAR_ or Key Vault"
  type        = string
  sensitive   = true
}

# ── Container Apps ─────────────────────────────────────────────────────────────

variable "redis_api_image" {
  description = "Full image reference for the redis-api service (set by CI)"
  type        = string
  default     = "placeholder/redis-api:latest"
}

variable "order_consumer_image" {
  description = "Full image reference for the order-consumer service (set by CI)"
  type        = string
  default     = "placeholder/order-consumer:latest"
}

variable "logstash_ingest_image" {
  description = "Full Logstash image (elastic/logstash or custom)"
  type        = string
  default     = "docker.elastic.co/logstash/logstash:8.13.0"
}

variable "logstash_indexer_image" {
  description = "Full Logstash image (elastic/logstash or custom)"
  type        = string
  default     = "docker.elastic.co/logstash/logstash:8.13.0"
}

variable "elasticsearch_image" {
  description = "Elasticsearch image"
  type        = string
  default     = "docker.elastic.co/elasticsearch/elasticsearch:8.13.0"
}

variable "kibana_image" {
  description = "Kibana image"
  type        = string
  default     = "docker.elastic.co/kibana/kibana:8.13.0"
}

variable "redis_api_min_replicas" {
  type    = number
  default = 2
}

variable "redis_api_max_replicas" {
  type    = number
  default = 10
}

variable "order_consumer_min_replicas" {
  type    = number
  default = 2
}

variable "order_consumer_max_replicas" {
  type    = number
  default = 10
}

variable "logstash_indexer_min_replicas" {
  type    = number
  default = 2
}

variable "logstash_indexer_max_replicas" {
  type    = number
  default = 4
}
