# Container registry: one private ECR repository per tier.

locals {
  repositories = {
    app = "${local.name}-app"
    web = "${local.name}-web"
  }
}

resource "aws_ecr_repository" "this" {
  for_each             = local.repositories
  name                 = each.value
  image_tag_mutability = "MUTABLE" # "latest" is moved on every deploy; commit-SHA tags never change
  force_delete         = true      # lets `terraform destroy` remove repos that still contain images

  image_scanning_configuration {
    scan_on_push = true # basic vulnerability scan of every pushed image
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Cost optimization: keep only the 10 most recent images per repository.
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
