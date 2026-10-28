# Sistema de Nómina — Paso 3

Backend (Express + SQLite) y frontend (React + Vite). Requiere Node.js 20 o superior.

## Forma rápida (Windows)

Haz doble clic en **INICIAR.bat**. Instala lo necesario la primera vez, crea los datos de ejemplo,
arranca backend y frontend, y abre el navegador. Las siguientes veces solo arranca.

## Forma manual

Abre **dos terminales** en VS Code.

**Terminal 1 — backend**

    cd backend
    npm install
    npm run seed      # base de datos con 4 usuarios
    npm run dev      

**Terminal 2 — frontend**

    cd frontend
    npm install
    npm run dev       

## Usuarios de ejemplo

| Rol          | Correo               | Contraseña  |
|--------------|----------------------|-------------|
| Gerente      | gerente@empresa.com  | Gerente123  |
| Contador     | contador@empresa.com | Contador123 |
| Jefe directo | jefe@empresa.com     | Jefe12345   |
| Empleado     | empleado@empresa.com | Empleado123 |

Los empleados que crees desde la pantalla del gerente reciben una contraseña
temporal y deben cambiarla en su primer ingreso.

## Notas

- La sesión se guarda solo en memoria: al recargar la página hay que ingresar de nuevo.
- `backend/.env` es de desarrollo. Cambia `JWT_SECRET` antes de usarlo en producción.
- Para reiniciar los datos, borra la carpeta `backend/data` y ejecuta `npm run seed`.

## Pruebas del motor de cálculo

    cd backend
    npm test

## Parámetros de nómina

Los valores iniciales (SMMLV, auxilio de transporte, recargos, aportes, exoneración) se basan en la
normativa colombiana de 2026. Son editables en la pantalla **Parámetros** (rol Contador).
**Valídalos con tu contador antes de usarlos en una nómina real.**
