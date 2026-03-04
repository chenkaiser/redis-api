# ── Managed Identity ───────────────────────────────────────────────────────────
# One identity shared by all Container Apps; granted:
#   - AcrPull on the registry
#   - Key Vault Secrets User on the vault

resource "azurerm_user_assigned_identity" "aca" {
  name                = "id-aca-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.acr_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.aca.principal_id
}

resource "azurerm_role_assignment" "keyvault_secrets_user" {
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.aca.principal_id
}

# ── Log Analytics workspace (required by ACA environment) ─────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# ── Container Apps Environment ─────────────────────────────────────────────────

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.name_prefix}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  infrastructure_subnet_id   = var.aca_subnet_id
  # Internal-only VNet integration — apps not reachable from internet by default
  internal_load_balancer_enabled = true
  tags                           = var.tags
}

# ── Elasticsearch ──────────────────────────────────────────────────────────────
# Single replica, internal only — accessed by Logstash indexer and Kibana

resource "azurerm_container_app" "elasticsearch" {
  name                         = "ca-elasticsearch-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "elasticsearch"
      image  = var.elasticsearch_image
      cpu    = 2.0
      memory = "4Gi"

      env {
        name  = "discovery.type"
        value = "single-node"
      }
      env {
        name  = "xpack.security.enabled"
        value = "false"
      }
      env {
        name  = "ES_JAVA_OPTS"
        value = "-Xms1g -Xmx1g"
      }
      env {
        name  = "thread_pool.write.queue_size"
        value = "1000"
      }
    }
  }

  ingress {
    external_enabled = false
    target_port      = 9200
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# ── Kibana ─────────────────────────────────────────────────────────────────────
# Public ingress — the only service exposed externally

resource "azurerm_container_app" "kibana" {
  name                         = "ca-kibana-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "kibana"
      image  = var.kibana_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "ELASTICSEARCH_HOSTS"
        value = "http://${azurerm_container_app.elasticsearch.ingress[0].fqdn}:9200"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 5601
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# ── Logstash Ingest ────────────────────────────────────────────────────────────
# Accepts logs from all app containers, pushes to log Event Hubs

resource "azurerm_container_app" "logstash_ingest" {
  name                         = "ca-ls-ingest-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  secret {
    name                = "log-eventhub-cs"
    key_vault_secret_id = var.log_eventhub_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "logstash-ingest"
      image  = var.logstash_ingest_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "LOG_KAFKA_BROKER"
        value = var.log_eventhub_fqdn
      }
      env {
        name        = "LOG_KAFKA_CONNECTION_STRING"
        secret_name = "log-eventhub-cs"
      }
      env {
        name  = "LS_JAVA_OPTS"
        value = "-Xms256m -Xmx256m"
      }
      env {
        name  = "PIPELINE_BATCH_SIZE"
        value = "125"
      }
      env {
        name  = "PIPELINE_BATCH_DELAY"
        value = "5"
      }
    }
  }

  ingress {
    external_enabled = false
    target_port      = 12201
    transport        = "udp"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# ── Logstash Indexer ───────────────────────────────────────────────────────────
# Reads from log Event Hubs, bulk-writes to Elasticsearch. Scales out.

resource "azurerm_container_app" "logstash_indexer" {
  name                         = "ca-ls-indexer-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  secret {
    name                = "log-eventhub-cs"
    key_vault_secret_id = var.log_eventhub_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  template {
    min_replicas = var.logstash_indexer_min_replicas
    max_replicas = var.logstash_indexer_max_replicas

    container {
      name   = "logstash-indexer"
      image  = var.logstash_indexer_image
      cpu    = 1.0
      memory = "2Gi"

      env {
        name  = "LOG_KAFKA_BROKER"
        value = var.log_eventhub_fqdn
      }
      env {
        name        = "LOG_KAFKA_CONNECTION_STRING"
        secret_name = "log-eventhub-cs"
      }
      env {
        name  = "ELASTICSEARCH_HOST"
        value = "http://${azurerm_container_app.elasticsearch.ingress[0].fqdn}:9200"
      }
      env {
        name  = "LS_JAVA_OPTS"
        value = "-Xms512m -Xmx512m"
      }
      env {
        name  = "PIPELINE_BATCH_SIZE"
        value = "1000"
      }
      env {
        name  = "PIPELINE_BATCH_DELAY"
        value = "50"
      }
    }

    # Scale on Event Hubs lag — add replicas when log backlog grows
    custom_scale_rule {
      name             = "eventhub-lag"
      custom_rule_type = "azure-eventhubs"
      metadata = {
        namespace          = split(".", var.log_eventhub_fqdn)[0]
        eventHubName       = "logs"
        consumerGroup      = "logstash-indexer"
        unprocessedEventThreshold = "500"
      }
      authentication {
        secret_ref        = "log-eventhub-cs"
        trigger_parameter = "connection"
      }
    }
  }
}

# ── redis-api ─────────────────────────────────────────────────────────────────

resource "azurerm_container_app" "redis_api" {
  name                         = "ca-redis-api-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  secret {
    name                = "redis-cs"
    key_vault_secret_id = var.redis_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  secret {
    name                = "kafka-cs"
    key_vault_secret_id = var.app_eventhub_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  template {
    min_replicas = var.redis_api_min_replicas
    max_replicas = var.redis_api_max_replicas

    container {
      name   = "redis-api"
      image  = var.redis_api_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "REDIS_URL"
        secret_name = "redis-cs"
      }
      env {
        name        = "KAFKA_BROKER"
        secret_name = "kafka-cs"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/ping"
        port      = 3000
        initial_delay     = 10
        period_seconds    = 15
        failure_count_threshold = 3
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/ping"
        port      = 3000
        initial_delay  = 5
        period_seconds = 10
      }
    }

    # HTTP-based autoscaling — scale out when concurrent requests exceed 50 per replica
    http_scale_rule {
      name                = "http-requests"
      concurrent_requests = "50"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# ── order-consumer ────────────────────────────────────────────────────────────

resource "azurerm_container_app" "order_consumer" {
  name                         = "ca-order-consumer-${var.name_prefix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca.id]
  }

  secret {
    name                = "kafka-cs"
    key_vault_secret_id = var.app_eventhub_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  secret {
    name                = "postgres-cs"
    key_vault_secret_id = var.postgres_connection_string_secret_uri
    identity            = azurerm_user_assigned_identity.aca.id
  }

  template {
    min_replicas = var.order_consumer_min_replicas
    max_replicas = var.order_consumer_max_replicas

    container {
      name   = "order-consumer"
      image  = var.order_consumer_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "KAFKA_BROKER"
        secret_name = "kafka-cs"
      }
      env {
        name        = "POSTGRES_URL"
        secret_name = "postgres-cs"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
    }

    # Scale on Event Hubs consumer lag — add replicas when unprocessed events pile up
    custom_scale_rule {
      name             = "eventhub-lag"
      custom_rule_type = "azure-eventhubs"
      metadata = {
        namespace          = split(".", var.app_eventhub_fqdn)[0]
        eventHubName       = "inventory.item-used"
        consumerGroup      = "order-consumer-group"
        unprocessedEventThreshold = "100"
      }
      authentication {
        secret_ref        = "kafka-cs"
        trigger_parameter = "connection"
      }
    }
  }
}
