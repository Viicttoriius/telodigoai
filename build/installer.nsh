; Telodigo AI - Fuerza el log de extracción de archivos

!macro customHeader
  ; Obliga a que el botón "Show details" y la caja de texto aparezcan
  ShowInstDetails show
  ShowUnInstDetails show
!macroend

!macro preInit
  ; Esto corre antes de que el instalador siquiera se dibuje
  SetDetailsPrint both
!macroend

!macro customInit
  ; Reforzamos al iniciar la UI
  SetDetailsPrint both
  DetailPrint "Iniciando instalador de Telodigo AI..."
!macroend

!macro customInstall
  ; Este es el punto crítico: justo antes de mover archivos
  ; Forzamos el modo 'both' para que cada comando 'File' se imprima
  SetDetailsPrint both
  DetailPrint "Instalando n8n y Ollama (Extrayendo componentes)..."
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "Eliminando componentes locales..."
!macroend