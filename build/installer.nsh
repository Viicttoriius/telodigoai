; Telodigo AI - Custom NSIS installer hooks
; Shows install/uninstall details log during extraction

!macro customHeader
  ShowInstDetails show
  ShowUnInstDetails show
!macroend

!macro customInstall
  SetDetailsPrint both
!macroend

!macro customUnInstall
  SetDetailsPrint both
!macroend
