variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "name_prefix"         { type = string }
variable "vnet_address_space"  { type = string }
variable "aca_subnet_cidr"     { type = string }
variable "private_endpoint_subnet_cidr" { type = string }
variable "postgres_subnet_cidr" {
  type    = string
  default = "10.0.3.0/24"
}
variable "tags" { type = map(string) }
