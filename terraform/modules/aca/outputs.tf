output "redis_api_fqdn" {
  value = azurerm_container_app.redis_api.ingress[0].fqdn
}

output "kibana_fqdn" {
  value = azurerm_container_app.kibana.ingress[0].fqdn
}

output "aca_environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "managed_identity_id" {
  value = azurerm_user_assigned_identity.aca.id
}

output "managed_identity_principal_id" {
  value = azurerm_user_assigned_identity.aca.principal_id
}
