output "hostname"                      { value = azurerm_redis_cache.main.hostname }
output "connection_string_secret_uri" { value = azurerm_key_vault_secret.redis_connection_string.versionless_id }
