output "vnet_id"                      { value = azurerm_virtual_network.main.id }
output "aca_subnet_id"               { value = azurerm_subnet.aca.id }
output "private_endpoint_subnet_id"  { value = azurerm_subnet.private_endpoints.id }
output "postgres_delegated_subnet_id" { value = azurerm_subnet.postgres.id }

output "redis_private_dns_zone_ids" {
  value = [azurerm_private_dns_zone.zones["redis"].id]
}
output "postgres_private_dns_zone_id" {
  value = azurerm_private_dns_zone.zones["postgres"].id
}
output "keyvault_private_dns_zone_ids" {
  value = [azurerm_private_dns_zone.zones["keyvault"].id]
}
output "acr_private_dns_zone_ids" {
  value = [azurerm_private_dns_zone.zones["acr"].id]
}
output "eventhub_private_dns_zone_ids" {
  value = [azurerm_private_dns_zone.zones["eventhub"].id]
}
