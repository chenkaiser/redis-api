resource "azurerm_container_registry" "main" {
  name                          = "acr${replace(var.name_prefix, "-", "")}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  sku                           = var.sku
  admin_enabled                 = false
  # Disable public access — Container Apps pulls via private endpoint
  public_network_access_enabled = false
  tags                          = var.tags
}

resource "azurerm_private_endpoint" "acr" {
  name                = "pe-acr-${var.name_prefix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "psc-acr"
    private_connection_resource_id = azurerm_container_registry.main.id
    subresource_names              = ["registry"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-acr"
    private_dns_zone_ids = var.private_dns_zone_ids
  }

  tags = var.tags
}
