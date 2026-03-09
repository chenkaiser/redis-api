#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy redis-api stack to a local Minikube cluster.

.DESCRIPTION
    Full deployment pipeline:
      1. Start Minikube (if not already running)
      2. Install Istio service mesh
      3. Build Docker images into Minikube's daemon
      4. Apply all k8s manifests via kustomize
      5. Wait for all pods to be Ready
      6. Print the API endpoint URL

    Run from the repo root:  .\scripts\minikube-deploy.ps1

.PARAMETER SkipIstio
    Skip Istio installation (use if Istio is already installed).

.PARAMETER SkipBuild
    Skip Docker image builds (use if images are already in Minikube's daemon).

.PARAMETER Cpus
    Number of CPUs to allocate to Minikube (default: 4).

.PARAMETER Memory
    Memory in MB to allocate to Minikube (default: 8192).
#>
param(
    [switch]$SkipIstio,
    [switch]$SkipBuild,
    [int]$Cpus = 4,
    [int]$Memory = 8192
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ──────────────────────────────────────────────────────────────────

function Write-Step([string]$msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "    WARN: $msg" -ForegroundColor Yellow
}

function Require-Command([string]$cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$cmd' not found in PATH. Please install it first." -ForegroundColor Red
        exit 1
    }
}

# ── Prerequisite checks ───────────────────────────────────────────────────────

Write-Step "Checking prerequisites"
Require-Command minikube
Require-Command kubectl
Require-Command docker
if (-not $SkipIstio) { Require-Command istioctl }
Write-Ok "All required tools found"

# ── 1. Start Minikube ─────────────────────────────────────────────────────────

Write-Step "Starting Minikube"

$status = minikube status --format='{{.Host}}' 2>$null
if ($status -eq 'Running') {
    Write-Ok "Minikube already running — skipping start"
} else {
    Write-Host "    Starting Minikube with $Cpus CPUs, ${Memory}MB RAM..."
    minikube start --cpus=$Cpus --memory=$Memory --disk-size=30g
    Write-Ok "Minikube started"
}

# ── 2. Install Istio ──────────────────────────────────────────────────────────

if (-not $SkipIstio) {
    Write-Step "Installing Istio (default profile)"
    istioctl install --set profile=default -y
    Write-Ok "Istio installed"
} else {
    Write-Warn "Skipping Istio install (-SkipIstio flag set)"
}

# ── 3. Build Docker images into Minikube's daemon ─────────────────────────────

if (-not $SkipBuild) {
    Write-Step "Pointing Docker CLI to Minikube's daemon"
    # minikube docker-env outputs PowerShell export statements
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression
    Write-Ok "Docker env configured"

    Write-Step "Building product-api image"
    docker build -t product-api:latest .
    Write-Ok "product-api:latest built"

    Write-Step "Building order-consumer image"
    docker build -t order-consumer:latest ./order-consumer
    Write-Ok "order-consumer:latest built"
} else {
    Write-Warn "Skipping image builds (-SkipBuild flag set)"
}

# ── 4. Apply manifests ────────────────────────────────────────────────────────

Write-Step "Applying Kubernetes manifests (kubectl apply -k k8s/)"
kubectl apply -k k8s/
Write-Ok "Manifests applied"

# ── 5. Wait for pods ──────────────────────────────────────────────────────────

Write-Step "Waiting for all pods to be Ready (infra / logging / app namespaces)"
Write-Host "    (this can take several minutes — Keycloak, Elasticsearch, and Kafka are slow to start)"
Write-Host ""

$namespaces = @('redis-api-infra', 'redis-api-logging', 'redis-api-app')

# Poll until all pods are Running/Completed (not Pending/Init/Error)
$timeoutSeconds = 600
$pollInterval = 10
$elapsed = 0

while ($elapsed -lt $timeoutSeconds) {
    $notReady = @()
    foreach ($ns in $namespaces) {
        $notReady += kubectl get pods -n $ns --no-headers 2>$null |
            Where-Object { $_ -notmatch '\s+(Running|Completed)\s+' -and $_.Trim() -ne '' }
    }

    if ($notReady.Count -eq 0) {
        Write-Ok "All pods are Ready"
        break
    }

    $count = $notReady.Count
    Write-Host "    [$elapsed s] $count pod(s) not yet ready — waiting ${pollInterval}s..."
    Start-Sleep -Seconds $pollInterval
    $elapsed += $pollInterval
}

if ($elapsed -ge $timeoutSeconds) {
    Write-Warn "Timed out waiting for pods."
    foreach ($ns in $namespaces) {
        Write-Host "  --- $ns ---"
        kubectl get pods -n $ns
    }
}

# ── 6. Print endpoint ─────────────────────────────────────────────────────────

Write-Step "Getting API endpoint"

$minikubeIp = minikube ip
$apiUrl = "http://${minikubeIp}:30300"

Write-Host ""
Write-Host "  Stack is up!" -ForegroundColor Green
Write-Host ""
Write-Host "  product-api  : $apiUrl" -ForegroundColor White
Write-Host "  Keycloak     : $(minikube service keycloak -n redis-api-infra --url 2>$null)" -ForegroundColor White
Write-Host "  Kibana       : $(minikube service kibana   -n redis-api-logging --url 2>$null)" -ForegroundColor White
Write-Host ""
Write-Host "  Quick health check:" -ForegroundColor Gray
Write-Host "    curl $apiUrl/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Gray
Write-Host "    kubectl get pods -n redis-api-infra" -ForegroundColor Gray
Write-Host "    kubectl get pods -n redis-api-logging" -ForegroundColor Gray
Write-Host "    kubectl get pods -n redis-api-app" -ForegroundColor Gray
Write-Host "    kubectl logs -n redis-api-app deploy/product-api -f" -ForegroundColor Gray
Write-Host "    kubectl logs -n redis-api-app deploy/order-consumer -f" -ForegroundColor Gray
Write-Host "    minikube dashboard" -ForegroundColor Gray
Write-Host ""
