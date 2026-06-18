Características Actuales
Controlador en Primera Persona: Movimiento continuo con físicas pesadas de gravedad, Bunny Hop y Wall Kick integrado.
Sistema de Coordenadas Libres: Escenario mapeado mediante objetos geométricos tridimensionales en `state.js` con colisiones precisas (Círculo-Columna y AABB para paredes/cofres).
Renderizado Dual: Pantalla completa interactiva en primera persona combinada con una cámara cenital ortográfica para el Minimapa/Mapa Expandido (Tab).
Mecánicas RPG: Inventario de 36 slots, Hotbar interactiva, sistema de experiencia (XP) por bajas y ganancia de niveles.
Consola de Desarrollador (Enter): Comandos en vivo para testeo de mecánicas:
  * `/god` - Alternar Modo Dios.
  * `/heal` - Restaurar HP al 100%.
  * `/stamina` - Restaurar SP al máximo.
  * `/tp [X] [Z]` - Teletransportación por coordenadas libres.
  * `/give [Nombre]` - Inyectar un ítem al inventario.

Estructura del Proyecto
 `index.html`: Orquestador principal, inicialización gráfica de Three.js y bucle de renderizado (`animate`).
 `state.js`: Estado global mutable, constantes del motor y funciones del HUD / colisiones.
 `input.js`: Manejador exclusivo de eventos de teclado, ratón, chat y gestión segura del estado.
 `level.js`: Instanciación geométrica de los meshes del nivel, cristales de daño e ítems.
 `enemies.js`: Lógica base de entidades IA (`Enemy`, `TrainingDummy`, `Zombie`).
 `weapons.js`: Estructura de daño y combos del arsenal del jugador.
