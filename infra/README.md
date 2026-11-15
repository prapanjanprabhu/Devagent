# AWS infrastructure (Terraform)

Creates everything Devagent needs on AWS in one region (default `ap-south-1`, Mumbai):

| File | What it builds |
|---|---|
| `vpc.tf` | VPC, 2 public + 2 private subnets, 1 NAT gateway |
| `eks.tf` | EKS cluster, 2 worker nodes (private subnets), EBS disk driver |
| `ecr.tf` | Private Docker registry for the app image |
| `github-oidc.tf` | Keyless login for GitHub Actions (OIDC role, main branch only) |
| `outputs.tf` | Values you copy into GitHub and kubectl |

## You need

- An AWS account and credentials on your machine (`aws configure`, or SSO). The user needs rights to create VPC, EKS, IAM and ECR resources.
- Terraform 1.6 or newer, the AWS CLI and kubectl.

## Create it

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # optional, change region or size here
terraform init
terraform plan
terraform apply                                 # takes about 15 minutes
```

If your account already has the GitHub OIDC provider, set `create_github_oidc_provider = false`.

## Connect kubectl

```bash
$(terraform output -raw kubeconfig_command)
kubectl get nodes
```

## Tell GitHub about it

In the repo, go to Settings > Secrets and variables > Actions > Variables and add:

| Variable | Value |
|---|---|
| `AWS_REGION` | `terraform output -raw region` |
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `EKS_CLUSTER` | `terraform output -raw cluster_name` |
| `ECR_REPOSITORY` | `devagent` |

Also add the GitHub **secret** `POSTGRES_PASSWORD` (16 or more letters and numbers). See [k8s/README.md](../k8s/README.md) for the optional secrets.

No AWS access keys are stored in GitHub. The role can only be used by workflows on the `main` branch of this repo.

## Deploy

Push to `main`. The `deploy` job in `.github/workflows/ci.yml` builds the image, pushes it to ECR and updates the cluster. The website address is printed in the job summary.

## Cost

Roughly 4 to 5 US dollars per day while it is running: EKS control plane about 2.4, two t3.medium nodes about 2.2, NAT gateway about 1.1, plus the load balancer. Destroy it when the demo is over.

## Destroy it

Delete the Kubernetes resources first. The website's load balancer and the database disk are created by Kubernetes, and AWS will not delete the VPC while the load balancer still exists.

```bash
kubectl delete namespace devagent --wait=true   # removes the load balancer and the database disk
kubectl delete storageclass gp3
cd infra/terraform
terraform destroy
```
