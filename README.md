# Vesotel Gestor Jornada

Sistema de gestión de jornadas laborales y registros de trabajo (Work Logs) diseñado para entornos multi-empresa. El proyecto utiliza una arquitectura moderna basada en microservicios contenerizados, con un backend robusto en Python y un frontend reactivo en Next.js.

## Arquitectura del Sistema

El sistema se compone de tres pilares fundamentales:

1.  **Backend API**: Desarrollado con FastAPI, encargado de la lógica de negocio, autenticación JWT, gestión de sesiones y comunicación con la base de datos.
2.  **Frontend**: Desarrollado con Next.js (App Router), proporcionando una interfaz de usuario moderna, responsiva y optimizada para la gestión administrativa y de usuarios.
3.  **Base de Datos**: PostgreSQL para el almacenamiento persistente, gestionado mediante SQLAlchemy (ORM) y Alembic para el control de versiones del esquema.

## Stack Tecnológico

### Backend
*   **Framework**: FastAPI (Python 3.12+)
*   **ORM**: SQLAlchemy 2.0+
*   **Migraciones**: Alembic
*   **Seguridad**: JWT (JSON Web Tokens) con firma RS256, Passlib (bcrypt), 2FA (TOTP con PyOTP y cifrado de secretos).
*   **Servidor**: Uvicorn con Gunicorn para producción.

### Frontend
*   **Framework**: Next.js 14+ (App Router)
*   **Lenguaje**: TypeScript
*   **Estilos**: Tailwind CSS & Lucide React para iconografía.
*   **Gestión de Estado**: React Context API & Hooks.

### Infraestructura
*   **Contenerización**: Docker y Docker Compose v2+.
*   **Base de Datos**: PostgreSQL 16.
*   **Caché/Sesiones**: Redis (para gestión de estados y rate limiting).
*   **CI/CD**: GitHub Actions con Self-hosted runner.

## Funcionalidades Avanzadas SaaS

### Dynamic Scoping (Contexto Ágil)
El sistema permite a los usuarios alternar entre diferentes empresas y roles sin cerrar sesión.
*   El contexto activo (`company_id` y `role`) se almacena directamente en el JWT.
*   Endpoint `/auth/switch-scope` permite cambiar de contexto de forma dinámica.
*   Los permisos en el backend se validan contra el "active scope" del token actual.

### Impersonación de Usuarios
Los administradores globales pueden auditar cuentas de usuario directamente:
*   **Backup de Sesión**: Al impersonar, se guardan "backup cookies" de la sesión de administrador.
*   **Restauración**: Al terminar la impersonación, se restauran las credenciales originales sin necesidad de re-autenticación.
*   **Auditoría**: Todas las acciones realizadas bajo impersonación quedan registradas en el sistema.

### Seguridad y 2FA
*   **TOTP**: Autenticación de doble factor mediante aplicaciones como Google Authenticator.
*   **Cifrado**: Los secretos de OTP se almacenan cifrados en la base de datos (AES).
*   **Database Readiness**: El backend incluye un sistema de reintentos inteligente al arranque para esperar la disponibilidad de la base de datos antes de iniciar los servicios.

## Estructura del Repositorio

```text
.
├── backend/              # Lógica de servidor y API
│   ├── auth.py           # Gestión de JWT, Sesiones y 2FA
│   ├── crud.py           # Operaciones de base de datos
│   ├── main.py           # Punto de entrada y endpoints FastAPI
│   ├── models.py         # Definición de modelos (SQLAlchemy)
│   ├── schemas.py        # Validación de datos (Pydantic)
│   └── migrations/       # Control de versiones DB (Alembic)
├── frontend/             # Interfaz de usuario Next.js
│   ├── src/app/          # App Router (Pages y Layouts)
│   ├── src/components/   # Componentes de UI reutilizables
│   └── src/lib/          # Utilidades y cliente de API
├── docker-compose.dev.yml  # Configuración con hot-reload para desarrollo
└── docker-compose.prod.yml # Configuración optimizada para despliegue
```

## Configuración del Entorno de Desarrollo

### Requisitos Previos
*   Docker y Docker Compose (v2 o superior).
*   Archivo `.env` configurado en la raíz del proyecto.

### Pasos para Iniciar
1. Clonar el repositorio.
2. Crear el archivo `.env` basándose en `.env.example`.
3. Levantar los servicios:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```
4. El sistema cuenta con **Hot-Reload**:
    *   Backend: Reinicio automático vía Uvicorn.
    *   Frontend: Fast Refresh de Next.js.

### Gestión de Migraciones (Alembic)
Generar nueva migración:
```bash
docker compose -f docker-compose.dev.yml exec backend python3 -m alembic revision --autogenerate -m "cambios"
```
Aplicar migraciones:
```bash
docker compose -f docker-compose.dev.yml exec backend python3 -m alembic upgrade head
```

## Despliegue CI/CD

El despliegue es automático al realizar un push a la rama `main`:
1. El Runner actualiza el código en el servidor.
2. Se reconstruyen los contenedores con `docker-compose.prod.yml`.
3. Se aplican las migraciones pendientes automáticamente.

---
*Vesotel - Gestión Eficiente de Entornos Multi-Empresa*
