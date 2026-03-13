# Vesotel Gestor Jornada

Sistema de gestión de jornadas laborales y registros de trabajo (Work Logs) diseñado para entornos multi-empresa. El proyecto utiliza una arquitectura moderna basada en microservicios contenerizados, con un backend robusto en Python y un frontend reactivo en Next.js.

## Arquitectura del Sistema

El sistema se compone de tres pilares fundamentales:

1.  **Backend API**: Desarrollado con FastAPI, encargado de la lógica de negocio, autenticación JWT, gestión de sesiones y comunicación con la base de datos.
2.  **Frontend**: Desarrollado con Next.js (App Router), proporcionando una interfaz de usuario moderna, responsiva y optimizada para la gestión administrativa y de usuarios.
3.  **Base de Datos**: PostgreSQL para el almacenamiento persistente, gestionado mediante SQLAlchemy (ORM) y Alembic para el control de versiones del esquema.

## Networking y Acceso

El acceso a los servicios está diseñado para trabajar detrás de un **Reverse Proxy** (como Nginx o Traefik), con configuraciones específicas según el entorno:

### Entorno de Desarrollo
*   **Red**: Los contenedores están conectados a una red externa llamada `proxy_network`.
*   **Acceso**: El Reverse Proxy y los contenedores comparten esta red, permitiendo la comunicación directa sin necesidad de mapear puertos al host.
*   **Descubrimiento**: El proxy redirige el tráfico usando los nombres de servicio (`frontend`, `backend`) y sus puertos internos (3000, 8000).

### Entorno de Producción
*   **Mapeo de Puertos**: A diferencia de desarrollo, se realizan mapeos de puertos explícitos al host (3000, 8000, 5050).
*   **Acceso**: Aunque los puertos están mapeados, el acceso principal se realiza a través del Reverse Proxy del servidor para gestionar SSL/TLS y cabeceras de seguridad.
*   **Red**: Utiliza redes internas aisladas para separar el tráfico de la aplicación y el de la base de datos.

## Stack Tecnológico

### Backend
*   **Framework**: FastAPI
*   **ORM**: SQLAlchemy
*   **Migraciones**: Alembic
*   **Seguridad**: JWT (JSON Web Tokens), Passlib (bcrypt), 2FA (TOTP con PyOTP)
*   **Servidor**: Uvicorn

### Frontend
*   **Framework**: Next.js 14+
*   **Lenguaje**: TypeScript
*   **Estilos**: Tailwind CSS (si aplica) / Vanilla CSS
*   **Gestión de Estado**: Hooks nativos y API de Fetch

### Infraestructura
*   **Contenerización**: Docker y Docker Compose
*   **CI/CD**: GitHub Actions (Self-hosted runner)
*   **Base de Datos**: PostgreSQL 16
*   **Gestión DB**: pgAdmin 4 (incluido en el entorno de desarrollo)

## Estructura del Repositorio

```text
.
├── .github/workflows/    # Definiciones de CI/CD para GitHub Actions
├── backend/              # Código fuente del servidor API
│   ├── migrations/       # Scripts de migración de base de datos (Alembic)
│   ├── models.py         # Definición de modelos SQLAlchemy
│   ├── schemas.py        # Esquemas de validación Pydantic
│   └── main.py           # Punto de entrada de la aplicación FastAPI
├── frontend/             # Código fuente de la interfaz de usuario Next.js
├── docker-compose.dev.yml  # Configuración para entorno de desarrollo local
└── docker-compose.prod.yml # Configuración optimizada para producción
```

### Puertos por Defecto
*   **Frontend**: 3000
*   **Backend API**: 8000
*   **pgAdmin (Gestión DB)**: 5050 (Solo en producción o si se exponen los puertos)

## Configuración del Entorno de Desarrollo

### Requisitos Previos
*   Docker y Docker Compose (versión v2 o superior) instalados.
*   Archivo .env configurado en la raíz del proyecto.

### Pasos para Iniciar
1. Clonar el repositorio.
2. Crear el archivo `.env` basándose en `.env.example`.
3. Levantar los servicios en modo desarrollo:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```
4. El sistema cuenta con **Hot-Reload**:
    *   Los cambios en el código del `backend/` reiniciarán automáticamente el servidor Uvicorn.
    *   Los cambios en el `frontend/` se reflejarán instantáneamente gracias al modo dev de Next.js.
5. Para detener los servicios:
   ```bash
   docker compose -f docker-compose.dev.yml down
   ```

## Gestión de Base de Datos (Alembic)

El esquema de la base de datos se gestiona mediante migraciones. No se deben realizar cambios manuales en la base de datos de producción.

### Generar una nueva migración
Tras modificar los modelos en `backend/models.py`, ejecuta:
```bash
docker compose -f docker-compose.dev.yml exec backend python3 -m alembic revision --autogenerate -m "Descripción del cambio"
```

### Aplicar cambios
Las migraciones se aplican automáticamente en el flujo de CI/CD, pero para aplicarlas manualmente en desarrollo:
```bash
docker compose -f docker-compose.dev.yml exec backend python3 -m alembic upgrade head
```

## Flujo de CI/CD y Despliegue

El proyecto implementa un flujo de despliegue continuo mediante GitHub Actions utilizando un runner propio (self-hosted).

### Proceso de Despliegue
1. Al realizar un push a la rama `main`, se dispara el workflow definido en `.github/workflows/main.yml`.
2. El runner descarga el código en el servidor de producción.
3. Se genera el archivo `.env` de producción a partir de los GitHub Secrets.
4. Se reconstruyen e inician los contenedores usando `docker-compose.prod.yml`.
5. Se ejecutan automáticamente las migraciones pendientes con Alembic.

### Variables de Entorno Críticas
Es necesario configurar los siguientes secretos en GitHub:
*   `ENV_PROD`: Contenido completo del archivo .env para producción.

## Seguridad

*   **Autenticación**: Doble factor (2FA) opcional configurable por usuario.
*   **CORS**: Configuración dinámica mediante la variable `ALLOWED_ORIGINS`. Debe ser una lista separada por comas (ejemplo: `https://app.com,https://api.app.com`). Si no se define, el sistema permitirá el acceso desde los entornos de desarrollo locales definidos en `main.py`.
*   **Impersonación**: Capacidad para administradores globales de auditar cuentas de usuario sin necesidad de sus credenciales originales, manteniendo un registro de quién realizó la acción.

### Bonus: Runner como Servicio (Auto-inicio)
Para que el runner se inicie solo si el servidor se reinicia, ejecuta esto dentro de la carpeta del runner:
```bash
sudo ./svc.sh install $USER
sudo ./svc.sh start
sudo ./svc.sh status
```
