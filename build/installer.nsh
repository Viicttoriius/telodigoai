; Telodigo AI - Custom NSIS installer hooks
; Shows file extraction progress in the details log

!macro customHeader
  ; Show and expand the details log before anything runs
  ShowInstDetails show
  ShowUnInstDetails show
  ; Print detail lines on both the log and the status text
  SetDetailsPrint both
!macroend

!macro customInstall
  ; Force details visible during the main install phase too
  SetDetailsPrint both
  DetailPrint "Configurando Telodigo AI..."
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "Eliminando Telodigo AI..."
!macroend
