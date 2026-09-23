# ============================================================================
# configurer-dev.ps1 — À lancer UNE FOIS par développeur, sur sa machine.
# Crée CLAUDE.local.md (personnel, non versionné) qui fait charger
# automatiquement par Claude Code le brief et le carnet du bon développeur.
#
# Usage, depuis la racine du dépôt :
#   powershell -ExecutionPolicy Bypass -File scripts\configurer-dev.ps1 A
#   powershell -ExecutionPolicy Bypass -File scripts\configurer-dev.ps1 B
# ============================================================================
param(
  [Parameter(Mandatory = $true)][ValidateSet('A', 'B')][string]$Dev
)

$racine = Split-Path -Parent $PSScriptRoot
$cible = Join-Path $racine 'CLAUDE.local.md'
$role = if ($Dev -eq 'A') { 'comptoir et matériel' } else { 'back-office et données' }

$contenu = @"
# Poste de travail de Dev $Dev ($role)

Sur cette machine, tu accompagnes **Dev $Dev**. Ton brief de passation et ton carnet de bord
sont chargés ci-dessous : applique la routine de session du brief (section 1).

@docs/claude/BRIEF_DEV_$Dev.md
@docs/claude/CARNET_DEV_$Dev.md
"@

Set-Content -Path $cible -Value $contenu -Encoding UTF8
Write-Output "CLAUDE.local.md créé pour Dev $Dev."
Write-Output "Dans Claude Code, tapez /memory pour vérifier que le brief est bien chargé, puis /reprendre."
