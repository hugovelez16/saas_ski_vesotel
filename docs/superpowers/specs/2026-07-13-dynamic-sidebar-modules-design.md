# Especificación de Diseño: Barra Lateral Dinámica Basada en Módulos

Este documento detalla el diseño técnico para hacer que la barra lateral (Sidebar) cargue y filtre sus opciones de forma dinámica a partir de las suscripciones a módulos activas en la base de datos, eliminando la lógica condicional estática (`if`s manuales) y migrando las opciones heredadas de `settings.modules`.

---

## 1. Contexto y Objetivos

Actualmente, las opciones opcionales del menú ("Parte Diario", "Facturación", "Informes") se muestran o se ocultan en la barra lateral mediante comprobaciones de configuración estáticas en `settings.modules` de la empresa.

### Objetivos:
- **Cero Lógica Imperativa:** Evitar sentencias `if` individuales para cada módulo en el archivo `layout.tsx`.
- **Base de Datos como Fuente de Verdad:** Determinar qué elementos mostrar consultando la API de módulos activos del usuario (`getMyModules` / hook `useModules`).
- **Migración Completa:** Convertir "Facturación" (`billing`) e "Informes" (`reports`) en módulos formales de la base de datos para eliminar el fallback estático.
- **Configuración Declarativa:** Crear un registro en el frontend que asocie los códigos de módulo del backend con sus respectivas rutas, etiquetas e iconos.

---

## 2. Arquitectura de Datos y Registro Declarativo

Se definirá un registro estático en `frontend/src/app/(app)/layout.tsx` que actuará como mapa de traducción:

```typescript
interface SidebarModuleConfig {
    href: string;
    label: string;
    icon: any;
    allowedRoles: ("manager" | "worker")[];
}

const MODULE_SIDEBAR_REGISTRY: Record<string, SidebarModuleConfig> = {
    "worker_daily_report": {
        href: "/manager/daily-reports",
        label: "Parte Diario",
        icon: FileText,
        allowedRoles: ["manager", "worker"],
    },
    "billing": {
        href: "/manager/billing",
        label: "Facturación",
        icon: Banknote,
        allowedRoles: ["manager"],
    },
    "reports": {
        href: "/reports",
        label: "Informes",
        icon: FileText,
        allowedRoles: ["manager", "worker"],
    }
};
```

---

## 3. Lógica de Filtrado y Renderizado del Sidebar

En el archivo `layout.tsx`, el renderizado se simplifica de la siguiente manera:

1. Consumir el hook reactivo `useModules` que consulta los módulos activos de la base de datos basándose en el usuario e ID de la empresa activa.
2. Definir los elementos del menú base (fijos e independientes de los módulos suscritos):
   - **Manager:** Dashboard, Calendario, Usuarios, Turnos.
   - **Worker:** Dashboard, Calendario, Turnos.
3. Mapear dinámicamente los módulos activos devueltos por el backend y filtrar según el rol activo actual (`manager` o `worker`):

```typescript
const activeModuleItems = modules
    .map(mod => {
        const config = MODULE_SIDEBAR_REGISTRY[mod.codeName];
        if (!config || !config.allowedRoles.includes(activeRole as any)) return null;

        // Caso especial para trabajadores y el parte diario
        const finalHref = activeRole === "worker" && mod.codeName === "worker_daily_report"
            ? `/manager/daily-reports?companyId=${targetCompanyId}`
            : `${config.href}${querySuffix}`;

        return {
            href: finalHref,
            label: config.label,
            icon: config.icon,
        };
    })
    .filter(Boolean);

const managerItems = [...baseManagerItems, ...activeModuleItems];
```

---

## 4. Migración de Base de Datos para Módulos Heredados

Para poder eliminar el fallback estático, crearemos una migración de base de datos Alembic que realice lo siguiente:

1. Inserte los módulos `billing` y `reports` en la tabla `app_modules` si no existen:
   - `billing`: "Facturación y Cobros" (Ámbito: `company`).
   - `reports`: "Informes y Estadísticas" (Ámbito: `both`).
2. Recorra todas las empresas registradas y compruebe su campo `settings` en formato JSONB.
3. Si la empresa tiene habilitado `billing` o `reports` en su configuración heredada (o por defecto era verdadero), cree un registro de suscripción activo (`active`) en `module_subscriptions` asociado al módulo correspondiente.

---

## 5. Plan de Verificación

- **Prueba del Catálogo:** Comprobar que los nuevos módulos aparecen en la sección de administración de módulos.
- **Prueba de Suscripción:** Activar/desactivar la suscripción de una empresa a "Facturación" o "Parte Diario" y verificar que el menú aparece/desaparece de la barra lateral tras recargar o cambiar de empresa.
- **Pruebas de Compilación y Test unitarios:** Ejecutar `tsc --noEmit` y `npm run test` para asegurar que el tipado de los iconos y enlaces no cause fallos de TypeScript.
