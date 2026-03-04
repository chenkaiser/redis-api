locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

data "azurerm_client_config" "current" {}

# ── Resource Group ─────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location
  tags     = local.common_tags
}

# ── Modules ────────────────────────────────────────────────────────────────────

module "networking" {
  source = "./modules/networking"

  resource_group_name          = azurerm_resource_group.main.name
  location                     = var.location
  name_prefix                  = local.name_prefix
  vnet_address_space           = var.vnet_address_space
  aca_subnet_cidr              = var.aca_subnet_cidr
  private_endpoint_subnet_cidr = var.private_endpoint_subnet_cidr
  tags                         = local.common_tags
}

module "acr" {
  source = "./modules/acr"

  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  name_prefix                = local.name_prefix
  sku                        = var.acr_sku
  private_endpoint_subnet_id = module.networking.private_endpoint_subnet_id
  private_dns_zone_ids       = module.networking.acr_private_dns_zone_ids
  tags                       = local.common_tags
}

module "keyvault" {
  source = "./modules/keyvault"

  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  name_prefix                = local.name_prefix
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  private_endpoint_subnet_id = module.networking.private_endpoint_subnet_id
  private_dns_zone_ids       = module.networking.keyvault_private_dns_zone_ids
  tags                       = local.common_tags
}

module "redis" {
  source = "./modules/redis"

  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  name_prefix                = local.name_prefix
  sku                        = var.redis_sku
  capacity                   = var.redis_capacity
  private_endpoint_subnet_id = module.networking.private_endpoint_subnet_id
  private_dns_zone_ids       = module.networking.redis_private_dns_zone_ids
  key_vault_id               = module.keyvault.vault_id
  tags                       = local.common_tags
}

module "eventhubs" {
  source = "./modules/eventhubs"

  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  name_prefix                = local.name_prefix
  sku                        = var.eventhub_sku
  capacity                   = var.eventhub_capacity
  private_endpoint_subnet_id = module.networking.private_endpoint_subnet_id
  private_dns_zone_ids       = module.networking.eventhub_private_dns_zone_ids
  key_vault_id               = module.keyvault.vault_id
  tags                       = local.common_tags
}

module "postgres" {
  source = "./modules/postgres"

  resource_group_name  = azurerm_resource_group.main.name
  location             = var.location
  name_prefix          = local.name_prefix
  sku_name             = var.postgres_sku
  storage_mb           = var.postgres_storage_mb
  admin_user           = var.postgres_admin_user
  admin_password       = var.postgres_admin_password
  delegated_subnet_id  = module.networking.postgres_delegated_subnet_id
  private_dns_zone_id  = module.networking.postgres_private_dns_zone_id
  key_vault_id         = module.keyvault.vault_id
  tags                 = local.common_tags
}

module "aca" {
  source = "./modules/aca"

  resource_group_name  = azurerm_resource_group.main.name
  location             = var.location
  name_prefix          = local.name_prefix
  aca_subnet_id        = module.networking.aca_subnet_id
  acr_login_server     = module.acr.login_server
  acr_id               = module.acr.registry_id
  key_vault_id         = module.keyvault.vault_id
  key_vault_uri        = module.keyvault.vault_uri
  tags                 = local.common_tags

  # Images
  redis_api_image        = var.redis_api_image
  order_consumer_image   = var.order_consumer_image
  logstash_ingest_image  = var.logstash_ingest_image
  logstash_indexer_image = var.logstash_indexer_image
  elasticsearch_image    = var.elasticsearch_image
  kibana_image           = var.kibana_image

  # Scale
  redis_api_min_replicas        = var.redis_api_min_replicas
  redis_api_max_replicas        = var.redis_api_max_replicas
  order_consumer_min_replicas   = var.order_consumer_min_replicas
  order_consumer_max_replicas   = var.order_consumer_max_replicas
  logstash_indexer_min_replicas = var.logstash_indexer_min_replicas
  logstash_indexer_max_replicas = var.logstash_indexer_max_replicas

  # Event Hub FQDNs for broker config and KEDA scaler metadata
  app_eventhub_fqdn = module.eventhubs.app_namespace_fqdn
  log_eventhub_fqdn = module.eventhubs.log_namespace_fqdn

  # Secret references — Key Vault secret URIs injected as env vars
  redis_connection_string_secret_uri        = module.redis.connection_string_secret_uri
  app_eventhub_connection_string_secret_uri = module.eventhubs.app_connection_string_secret_uri
  log_eventhub_connection_string_secret_uri = module.eventhubs.log_connection_string_secret_uri
  postgres_connection_string_secret_uri     = module.postgres.connection_string_secret_uri
}
