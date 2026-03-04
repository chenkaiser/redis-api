output "fqdn"                          { value = azurerm_postgresql_flexible_server.main.fqdn }
output "connection_string_secret_uri" { value = azurerm_key_vault_secret.postgres_connection_string.versionless_id }
