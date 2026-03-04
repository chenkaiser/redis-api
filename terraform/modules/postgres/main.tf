resource "random_password" "postgres" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${var.name_prefix}"
  location               = var.location
  resource_group_name    = var.resource_group_name
  version                = "16"
  sku_name               = var.sku_name
  storage_mb             = var.storage_mb
  administrator_login    = var.admin_user
  administrator_password = var.admin_password

  # Fully private — no public endpoint, deployed into delegated subnet
  delegated_subnet_id    = var.delegated_subnet_id
  private_dns_zone_id    = var.private_dns_zone_id
  public_network_access_enabled = false

  backup_retention_days        = 7
  geo_redundant_backup_enabled = true

  high_availability {
    mode = "ZoneRedundant"
  }

  maintenance_window {
    day_of_week  = 0   # Sunday
    start_hour   = 3
    start_minute = 0
  }

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "orders" {
  name      = "orders"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Store connection string in Key Vault
resource "azurerm_key_vault_secret" "postgres_connection_string" {
  name  = "postgres-connection-string"
  value = "postgresql://${var.admin_user}:${var.admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/orders?sslmode=require"
  key_vault_id = var.key_vault_id

  lifecycle {
    ignore_changes = [value]
  }
}
