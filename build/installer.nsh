; Telodigo AI - Custom NSIS installer hooks
; Shows file extraction progress in the details log

!macro customHeader
  ; Estos comandos son globales, son válidos aquí
  ShowInstDetails show
  ShowUnInstDetails show
!macroend

!macro customInit
  ; Esto corre dentro de una función, es válido
  SetDetailsPrint both
!macroend

!macro customUnInit
  SetDetailsPrint both
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Finalizando instalación de Telodigo AI..."
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "Finalizando desinstalación de Telodigo AI..."
!macroend
