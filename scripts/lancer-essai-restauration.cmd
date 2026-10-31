@echo off
rem Essai de restauration (B16, docs/fiches-test/ESSAI_RESTAURATION.md).
rem Lance l'application installee sur la COPIE d'essai, jamais sur la vraie base de la boutique :
rem POS_DB est lu au demarrage (src/main/index.ts) et transmis au redemarrage apres une restauration.
set "POS_DB=C:\EssaiRestauration\boutique.db"

rem Sans ce fichier, l'application creerait une base vide (assistant de premier demarrage).
if not exist "%POS_DB%" (
  echo La copie d'essai est introuvable : %POS_DB%
  echo Refaire l'etape 1.3 de la procedure.
  pause
  exit /b 1
)

for /r "%LOCALAPPDATA%\Programs" %%f in ("Ma Boutique POS.exe") do (
  if exist "%%f" (
    start "" "%%f"
    exit /b 0
  )
)

echo Application introuvable dans %LOCALAPPDATA%\Programs : est-elle installee pour ce compte Windows ?
pause
exit /b 1
