# Digo - AI Black Box

Digo es una solución "caja negra" de Inteligencia Artificial local, diseñada para operar sin necesidad de configuración compleja por parte del usuario final. Integra n8n para automatización de flujos y Ollama para ejecución de modelos de lenguaje (LLMs) directamente en el dispositivo.

## Características Principales

*   **Todo en Uno**: Incluye n8n (automatización) y Ollama (IA) empaquetados en una sola aplicación.
*   **Privacidad Local**: Los modelos de IA se ejecutan localmente en tu hardware.
*   **Acceso Remoto Seguro**: Genera automáticamente un túnel seguro (Cloudflare Tunnel) para acceder a tu instancia de n8n desde cualquier lugar.
*   **Detección de Hardware**: Selecciona y descarga automáticamente el modelo de IA más adecuado para tu PC (TinyLlama para equipos básicos, Llama3 para equipos potentes).
*   **Dashboard de Estado**: Visualiza el estado de los servicios y la URL de acceso remoto en tiempo real.

## Requisitos del Sistema

*   **SO**: Windows 10/11 (x64)
*   **RAM**: Mínimo 8GB (Recomendado 16GB+)
*   **Espacio en Disco**: ~10GB libres (para modelos de IA)

## Instalación

1.  Descarga el instalador `.exe` de la sección de [Releases](https://github.com/Viicttoriius/digo/releases).
2.  Ejecuta el instalador.
3.  La aplicación instalará y configurará automáticamente todos los componentes necesarios.

## Primer Inicio

Al abrir Digo por primera vez:
1.  La aplicación verificará si **Ollama** está instalado. Si no, lo descargará e instalará silenciosamente.
2.  Analizará tu hardware (RAM y GPU) para determinar qué modelo de IA descargar.
3.  Iniciará el servidor de **n8n** y creará un túnel de acceso.
4.  En el Dashboard inferior verás la URL pública (ej: `https://random-name.trycloudflare.com`) para acceder a tu n8n.

## Licencia

Este proyecto está licenciado bajo la **Licencia Apache 2.0**. Consulta el archivo `LICENSE` para más detalles.

Copyright 2026 Victor Muñoz Lopez.
