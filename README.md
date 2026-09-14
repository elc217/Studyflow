# StudyFlow

Organizador visual de estudio con agenda semanal por horas, temporizador flexible, importacion de planificaciones y cuaderno de errores.

## Funcionalidades

- Agenda semanal con bloques de estudio posicionados por hora.
- Importacion de planificaciones en Markdown, TXT, DOCX y PDF.
- Reconocimiento de tablas diarias con cuatro bloques de trabajo:
  - Teoria o clase: 3 h 30 min.
  - Tests: 1 h 30 min.
  - Supuestos practicos: 1 h 30 min.
  - Repaso espaciado: 1 h 30 min.
- Creacion, edicion y eliminacion de tareas.
- Temporizador con duracion predefinida o personalizada.
- Cuaderno de errores enlazable con tareas y busqueda.
- Priorizacion visual de repasos segun dificultad, fallos y errores repetidos.
- Exportacion y restauracion de copias de seguridad.
- Persistencia local mediante `localStorage`.
- Sincronizacion multiusuario con Supabase y autenticacion por email.

## Ejecutar localmente

No requiere Node.js ni dependencias locales. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8080
```

Abre [http://localhost:8080](http://localhost:8080).

Tambien puedes abrir `index.html` directamente, aunque el servidor local es recomendable para probar todas las funciones del navegador.

## Importar una planificacion

Puedes seleccionar un fichero desde **Importar plan** o pegar su contenido en el cuadro de texto.

El formato de tabla esperado es:

```markdown
| Dia | Enfoque Teorico | Practica Test | Supuestos / Casos | Repaso Espaciado |
| :--- | :--- | :--- | :--- | :--- |
| **Mar 15 Sep** | Tema 1 | Test 50 preguntas | Caso practico | Flashcards |
```

Cada fila genera cuatro bloques de calendario. La aplicacion interpreta las fechas desde septiembre de 2026 y avanza de ano al pasar de diciembre a enero.

Tambien acepta lineas simples con este formato:

```text
- [ ] Matematicas | Algebra | 45 | 2026-09-15 | 09:00 | Alta
```

## Publicar en GitHub

1. Crea un repositorio vacio en GitHub.
2. En esta carpeta, inicializa Git y crea el primer commit:

```bash
git init
git add .
git commit -m "Initial StudyFlow application"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Sustituye la URL del remoto por la de tu repositorio.

## Publicar con GitHub Pages

El proyecto es estatico y puede publicarse directamente con GitHub Pages:

1. Abre `Settings > Pages` en el repositorio.
2. En **Build and deployment**, selecciona `Deploy from a branch`.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Guarda la configuracion.

GitHub generara una URL publica para la aplicacion.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, crea una consulta nueva y ejecuta el contenido de `supabase-schema.sql`.
3. Comprueba que aparecen las tablas `tasks`, `tests` y `notes`.
4. La aplicacion usa la clave publica `publishable` en el navegador. No introduzcas nunca una clave `service_role` en el frontend.
5. Activa la confirmacion por email en **Authentication > Providers > Email** si quieres verificar las cuentas antes del primer acceso.

La aplicacion identifica los datos mediante `auth.uid()` y las politicas RLS impiden que un usuario consulte o modifique los datos de otro.

## Datos y privacidad

Las tareas, notas, resultados y preferencias se guardan en el `localStorage` del navegador. No se incluyen datos personales ni planificaciones en este repositorio. Los datos guardados en un navegador no se sincronizan automaticamente entre dispositivos.

## Dependencias externas

La lectura de PDF y DOCX usa las versiones distribuidas por CDN de PDF.js y Mammoth.js, cargadas desde `index.html`.
