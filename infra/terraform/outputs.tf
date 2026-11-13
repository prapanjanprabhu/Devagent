output "region" {
  value = var.region
}

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "ecr_repository_url" {
  description = "Where the Docker image is pushed"
  value       = aws_ecr_repository.app.repository_url
}

output "github_actions_role_arn" {
  description = "Put this in the GitHub repo variable AWS_ROLE_ARN"
  value       = aws_iam_role.github_actions.arn
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "kubeconfig_command" {
  description = "Run this once to point kubectl at the new cluster"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}
