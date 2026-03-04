variable "resource_group_name"   { type = string }
variable "location"              { type = string }
variable "name_prefix"           { type = string }
variable "sku_name"              { type = string }
variable "storage_mb"            { type = number }
variable "admin_user"            { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "delegated_subnet_id"   { type = string }
variable "private_dns_zone_id"   { type = string }
variable "key_vault_id"          { type = string }
variable "tags"                  { type = map(string) }
