# Denuncias Públicas

Una plataforma web pensada para que cualquier ciudadano pueda reportar problemas de su entorno y para que los organismos públicos encargados puedan recibirlos, priorizarlos y darles seguimiento de forma ordenada y transparente.

## ¿Qué es?

Denuncias Públicas conecta a la ciudadanía con las instituciones que deben resolver los problemas cotidianos: luminarias rotas, basura acumulada, baches, situaciones de riesgo, emergencias y mucho más. En lugar de que un reclamo se pierda entre llamadas y papeles, la plataforma lo registra, le asigna un identificador de seguimiento y lo deriva automáticamente al organismo que corresponde.

El sistema está dividido en tres grandes experiencias, según quién lo use:

- **Ciudadanía:** crea denuncias y sigue su estado.
- **Entes públicos:** reciben y gestionan las denuncias de su área.
- **Administración:** supervisa todo, controla usuarios y consulta estadísticas.

## ¿Cómo funciona?

1. **El ciudadano ingresa** con su cuenta o como visitante mediante una sesión temporal.
2. **Completa el formulario** de denuncia con título, descripción y categoría.
3. **El sistema calcula una prioridad** según palabras de riesgo en el texto, y deriva la denuncia al organismo correspondiente.
4. **Recibe un identificador de seguimiento** en pantalla y, si configuró un correo, una confirmación por email.
5. **El ente público** ve la denuncia en su bandeja, la toma o la asigna a un funcionario, y la mueve entre estados: `EN_REVISION`, `RESUELTO` o `RECHAZADO`.
6. **El ciudadano puede consultar** el avance de sus denuncias en cualquier momento.
7. **La administración** revisa el historial de cambios, aprueba altas de funcionarios y consulta estadísticas por fecha, estado, tipo, prioridad y evolución mensual.

## Perfiles de usuario

### Ciudadano o visitante
- Se registra o entra como visitante.
- Crea denuncias con prioridad automática.
- Consulta el estado de sus propios reportes.
- Recibe el identificador de seguimiento y, si corresponde, confirmación por correo.
- Tiene accesos directos a emergencias, bomberos y asistencia médica.

### Ente público
- Accede con una cuenta institucional.
- Ve la bandeja de denuncias activas y filtra por estado.
- Toma denuncias o las asigna a funcionarios activos del mismo organismo.
- Actualiza el estado de cada caso.
- Su administrador puede solicitar el alta de nuevos funcionarios (sujeta a aprobación).

### Administrador
- Inicia sesión en el panel de gestión.
- Consulta estadísticas generales con distintos filtros.
- Administra denuncias, estados y usuarios.
- Revisa el historial de cambios.
- Aprueba o rechaza solicitudes de creación de funcionarios.

## Un detalle sobre la derivación

Las denuncias se envían automáticamente a los organismos configurados —por ejemplo, una municipalidad, bomberos o policía— siempre que exista una cuenta institucional activa para ese organismo. Si no la hay, la denuncia queda sin asignar y disponible para la gestión institucional. Del mismo modo, la prioridad se calcula a partir de términos de riesgo en el título y la descripción, y las denuncias anónimas reciben prioridad baja por defecto.

## Estado actual

La base del sistema ya está funcionando: autenticación, registro de denuncias, cálculo de prioridad, derivación por organismo y gestión de estados. Quedan como próximos pasos las evidencias adjuntas, los comentarios avanzados y la administración completa de categorías y usuarios.

## Sobre el proyecto

Es un proyecto en desarrollo activo, construido como una aplicación web con frontend y backend separados, base de datos relacional y despliegue previsto en servicios gratuitos. La guía de publicación y las medidas de seguridad recomendadas están documentadas en el repositorio.