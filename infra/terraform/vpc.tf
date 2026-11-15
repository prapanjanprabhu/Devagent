data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = var.project
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

# VPC with one public subnet per availability zone. The worker nodes and the load balancer both use them.
# There is no NAT gateway (it costs about 33 US dollars a month): the nodes get public IPs to reach the internet.
# For real production, add private subnets and a NAT gateway and move the nodes there.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.16"

  name = "${local.name}-vpc"
  cidr = var.vpc_cidr
  azs  = local.azs

  public_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i)]

  enable_nat_gateway      = false
  map_public_ip_on_launch = true # servers started in these subnets get a public IP

  enable_dns_hostnames = true
  enable_dns_support   = true

  # Tag that tells Kubernetes which subnets to use for the public load balancer
  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
}
