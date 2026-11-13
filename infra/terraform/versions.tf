terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # State is kept on this machine, which is fine for a short demo.
  # For a team, move it to S3 (bucket + DynamoDB lock table) with a backend "s3" block here.
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
