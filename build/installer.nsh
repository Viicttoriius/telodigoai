; Telodigo AI - Custom NSIS installer hooks
; This macro runs before the installer UI is shown and enables the details log

!macro customHeader
  ShowInstDetails show
  ShowUnInstDetails show
!macroend
