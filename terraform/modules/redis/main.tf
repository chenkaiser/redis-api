resource "azurerm_redis_cache" "main" {
  name                          = "redis-${var.name_prefix}"
  location                      = var.location
  resource_group_name           = var.resource_group_name
  capacity                      = var.capacity
  family                        = var.sku == "Premium" ? "P" : "C"
  sku_name                      = var.sku
  non_ssl_port_enabled          = false
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false

  redis_configuration {
    # Evict least-recently-used keys when memory is full — appropriate for
    # the rate-limiter and inventory use-case (soft state).
    maxmemory_policy = "allkeys-lru"
  }

  tags = var.tags
}

resource "azurerm_private_endpoint" "redis" {
  name                = "pe-redis-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "psc-redis"
    private_connection_resource_id = azurerm_redis_cache.main.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-redis"
    private_dns_zone_ids = var.private_dns_zone_ids
  }

  tags = var.tags
}

# Store connection string in Key Vault — apps reference it as a secret
resource "azurerm_key_vault_secret" "redis_connection_string" {
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.main.primary_connection_string
  key_vault_id = var.key_vault_id

  lifecycle {
    ignore_changes = [value]
  }
}
