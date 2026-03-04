# ── App Event Hubs Namespace (business events: inventory.item-used) ────────────

resource "azurerm_eventhub_namespace" "app" {
  name                          = "evhns-app-${var.name_prefix}"
  location                      = var.location
  resource_group_name           = var.resource_group_name
  sku                           = var.sku
  capacity                      = var.capacity
  # Kafka surface is enabled on Standard+ — no Zookeeper needed
  kafka_enabled                 = true
  auto_inflate_enabled          = true
  maximum_throughput_units      = 20
  public_network_access_enabled = false
  tags                          = var.tags
}

resource "azurerm_eventhub" "inventory_item_used" {
  name              = "inventory.item-used"
  namespace_id      = azurerm_eventhub_namespace.app.id
  partition_count   = 3
  message_retention = 7   # days
}

resource "azurerm_eventhub_namespace_authorization_rule" "app_rw" {
  name                = "app-readwrite"
  namespace_name      = azurerm_eventhub_namespace.app.name
  resource_group_name = var.resource_group_name
  listen              = true
  send                = true
  manage              = false
}

# ── Log Event Hubs Namespace (logging pipeline: logs topic) ───────────────────

resource "azurerm_eventhub_namespace" "log" {
  name                          = "evhns-log-${var.name_prefix}"
  location                      = var.location
  resource_group_name           = var.resource_group_name
  sku                           = var.sku
  capacity                      = var.capacity
  kafka_enabled                 = true
  auto_inflate_enabled          = true
  maximum_throughput_units      = 20
  public_network_access_enabled = false
  tags                          = var.tags
}

resource "azurerm_eventhub" "logs" {
  name              = "logs"
  namespace_id      = azurerm_eventhub_namespace.log.id
  partition_count   = 4
  # Short retention — Elasticsearch is the durable record
  message_retention = 1
}

resource "azurerm_eventhub_namespace_authorization_rule" "log_rw" {
  name                = "log-readwrite"
  namespace_name      = azurerm_eventhub_namespace.log.name
  resource_group_name = var.resource_group_name
  listen              = true
  send                = true
  manage              = false
}

# ── Private Endpoints ──────────────────────────────────────────────────────────

resource "azurerm_private_endpoint" "app_eventhub" {
  name                = "pe-evhns-app-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "psc-evhns-app"
    private_connection_resource_id = azurerm_eventhub_namespace.app.id
    subresource_names              = ["namespace"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-evhns-app"
    private_dns_zone_ids = var.private_dns_zone_ids
  }

  tags = var.tags
}

resource "azurerm_private_endpoint" "log_eventhub" {
  name                = "pe-evhns-log-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "psc-evhns-log"
    private_connection_resource_id = azurerm_eventhub_namespace.log.id
    subresource_names              = ["namespace"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-evhns-log"
    private_dns_zone_ids = var.private_dns_zone_ids
  }

  tags = var.tags
}

# ── Key Vault Secrets ─────────────────────────────────────────────────────────

resource "azurerm_key_vault_secret" "app_eventhub_connection_string" {
  name         = "app-eventhub-connection-string"
  # Kafka-compatible connection string format expected by kafkajs / NestJS
  value        = "${azurerm_eventhub_namespace_authorization_rule.app_rw.primary_connection_string}"
  key_vault_id = var.key_vault_id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "azurerm_key_vault_secret" "log_eventhub_connection_string" {
  name         = "log-eventhub-connection-string"
  value        = "${azurerm_eventhub_namespace_authorization_rule.log_rw.primary_connection_string}"
  key_vault_id = var.key_vault_id

  lifecycle {
    ignore_changes = [value]
  }
}
