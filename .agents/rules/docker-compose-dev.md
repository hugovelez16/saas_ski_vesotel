---
trigger: always_on
---

Instrucción: Siempre que realices o sugieras operaciones con contenedores de Docker (up, down, build, logs, etc.), utiliza obligatoriamente el archivo de configuración docker-compose.dev.yml mediante el flag -f.

Razón técnica: El entorno de desarrollo depende de volúmenes locales para el hot-reload y de un target: deps específico en el Dockerfile que no están presentes en el archivo estándar de producción.