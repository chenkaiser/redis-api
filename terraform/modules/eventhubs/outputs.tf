output "app_namespace_fqdn" {
  value = "${azurerm_eventhub_namespace.app.name}.servicebus.windows.net:9093"
}
output "log_namespace_fqdn" {
  value = "${azurerm_eventhub_namespace.log.name}.servicebus.windows.net:9093"
}
output "app_connection_string_secret_uri" {
  value = azurerm_key_vault_secret.app_eventhub_connection_string.versionless_id
}
output "log_connection_string_secret_uri" {
  value = azurerm_key_vault_secret.log_eventhub_connection_string.versionless_id
}
