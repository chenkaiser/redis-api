output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "acr_login_server" {
  description = "ACR login server — use as image prefix in CI"
  value       = module.acr.login_server
}

output "redis_api_fqdn" {
  description = "Public FQDN of the redis-api Container App"
  value       = module.aca.redis_api_fqdn
}

output "kibana_fqdn" {
  description = "Public FQDN of the Kibana Container App"
  value       = module.aca.kibana_fqdn
}

output "postgres_fqdn" {
  description = "PostgreSQL Flexible Server hostname (private)"
  value       = module.postgres.fqdn
  sensitive   = true
}

output "app_eventhub_namespace_fqdn" {
  description = "App Kafka Event Hubs bootstrap server"
  value       = module.eventhubs.app_namespace_fqdn
}

output "log_eventhub_namespace_fqdn" {
  description = "Log Kafka Event Hubs bootstrap server"
  value       = module.eventhubs.log_namespace_fqdn
}

output "key_vault_uri" {
  description = "Key Vault URI for secret references"
  value       = module.keyvault.vault_uri
}
