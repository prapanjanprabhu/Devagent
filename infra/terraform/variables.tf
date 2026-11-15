variable "region" {
  description = "AWS region for everything"
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Name prefix used for all resources"
  type        = string
  default     = "devagent"
}

variable "vpc_cidr" {
  description = "IP range of the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "How many availability zones to use (EKS needs at least 2)"
  type        = number
  default     = 2
}

variable "cluster_version" {
  description = "Kubernetes version of the EKS cluster. Use a version in standard support: older ones cost about 6x more for the control plane"
  type        = string
  default     = "1.35"
}

variable "node_instance_type" {
  description = "EC2 size of the worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  description = "Number of worker nodes (2 so the 2 app replicas can sit on different nodes)"
  type        = number
  default     = 2
}

variable "github_repo" {
  description = "GitHub repo allowed to push images and deploy, as owner/name"
  type        = string
  default     = "prapanjanprabhu/Devagent"
}

variable "create_github_oidc_provider" {
  description = "Set to false if your AWS account already has the GitHub OIDC provider (only one is allowed per account)"
  type        = bool
  default     = true
}
