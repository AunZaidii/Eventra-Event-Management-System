terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State is kept locally (infra/terraform/terraform.tfstate, git-ignored).
  # For team use, move it to an S3 backend with locking.
}

provider "aws" {
  region = var.aws_region

  # Every resource gets these tags, so cost and ownership are easy to see.
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Course    = "SE-490 Cloud Computing"
    }
  }
}
