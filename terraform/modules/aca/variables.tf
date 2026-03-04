variable "resource_group_name"  { type = string }
variable "location"             { type = string }
variable "name_prefix"          { type = string }
variable "aca_subnet_id"        { type = string }
variable "acr_login_server"     { type = string }
variable "acr_id"               { type = string }
variable "key_vault_id"         { type = string }
variable "key_vault_uri"        { type = string }
variable "tags"                 { type = map(string) }

# Images
variable "redis_api_image"        { type = string }
variable "order_consumer_image"   { type = string }
variable "logstash_ingest_image"  { type = string }
variable "logstash_indexer_image" { type = string }
variable "elasticsearch_image"    { type = string }
variable "kibana_image"           { type = string }

# Scale
variable "redis_api_min_replicas"        { type = number }
variable "redis_api_max_replicas"        { type = number }
variable "order_consumer_min_replicas"   { type = number }
variable "order_consumer_max_replicas"   { type = number }
variable "logstash_indexer_min_replicas" { type = number }
variable "logstash_indexer_max_replicas" { type = number }

# Secret URIs (Key Vault versionless IDs)
variable "redis_connection_string_secret_uri"        { type = string }
variable "app_eventhub_connection_string_secret_uri" { type = string }
variable "log_eventhub_connection_string_secret_uri" { type = string }
variable "postgres_connection_string_secret_uri"     { type = string }

# Derived FQDNs (passed from eventhubs module outputs)
variable "app_eventhub_fqdn" { type = string }
variable "log_eventhub_fqdn" { type = string }
