# Luxx4less: move this project to a local Claude Code session on Windows.
#
# Paste the whole file into Windows PowerShell and press Enter. It:
#   1. installs Git, Node.js LTS and Claude Code (skips anything already installed)
#   2. clones the project into C:\CLIENT FILES\LUXXE4LESS\bullionedge-pro
#   3. opens the Claude extension page in Edge (for browser control)
#   4. signs in to Claude and continues the cloud session on this PC
#
# Windows may ask for permission while installing, and GitHub may ask you to
# sign in once (a browser window opens). Safe to run again.

& {
  $ErrorActionPreference = "Stop"
  $Base    = "C:\CLIENT FILES\LUXXE4LESS"
  $Repo    = Join-Path $Base "bullionedge-pro"
  $Branch  = "claude/hopeful-gates-06x3c8"
  $Session = "session_01Hv6LdS4hHpg9jnzGkDoF7v"

  function Update-SessionPath {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
                (Join-Path $env:USERPROFILE ".local\bin")
  }
  function Test-Command($Name) { [bool](Get-Command $Name -ErrorAction SilentlyContinue) }
  function Install-WithWinget($Id) {
    winget install --id $Id -e --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "Installing $Id failed (winget exit code $LASTEXITCODE)." }
  }

  Write-Host "`n[1/4] Tools" -ForegroundColor Yellow
  if (-not (Test-Command winget)) {
    throw "winget is missing. Install 'App Installer' from the Microsoft Store, then run this again."
  }
  if (-not (Test-Command git))  { Install-WithWinget "Git.Git" }
  if (-not (Test-Command node)) { Install-WithWinget "OpenJS.NodeJS.LTS" }
  Update-SessionPath
  if (-not (Test-Command claude)) {
    Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
    Update-SessionPath
  }
  foreach ($cmd in "git", "node", "claude") {
    if (-not (Test-Command $cmd)) { throw "$cmd is still not found. Close PowerShell, open a new one and run this again." }
  }

  Write-Host "`n[2/4] Project" -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $Base | Out-Null
  if (-not (Test-Path (Join-Path $Repo ".git"))) {
    git clone https://github.com/BullionEdgePro/bullionedge-pro.git $Repo
    if ($LASTEXITCODE -ne 0) { throw "Cloning failed. Check you're signed in to GitHub with access to BullionEdgePro." }
  }
  Set-Location $Repo
  git fetch origin $Branch
  git checkout $Branch
  git pull --ff-only origin $Branch

  Write-Host "`n[3/4] Edge extension (click 'Add' on the page that opens)" -ForegroundColor Yellow
  Start-Process "msedge" "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn"

  Write-Host "`n[4/4] Claude sign-in and session hand-over" -ForegroundColor Yellow
  claude auth login
  claude --teleport $Session
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Pick the Luxx4less session from the list:" -ForegroundColor Yellow
    claude --teleport
  }
}
