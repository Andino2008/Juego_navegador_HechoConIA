import * as THREE from 'three';
import { fistsWeapon, swordWeapon } from './weapons.js';

// --- CONFIGURACIÓN Y CONSTANTES ---
export const cellSize = 6;
export const playerRadius = 1.0;
export const chestLootTable = [
    { name: "Poción de Vida", color: 0xff4444 },
    { name: "Espada de Runas", color: 0x9999ff },
    { name: "Escudo Viejo", color: 0x888888 }
];

export let mapObjects = [];

export async function loadMap() {
    try {
        // Añadimos cache: 'no-store' para que en desarrollo siempre baje la última versión del mapa sin cache
        const response = await fetch('mapa.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Error al cargar mapa.json');
        const data = await response.json();
        
        // Reemplazar el array conservando la referencia para evitar romper imports si existieran
        mapObjects.length = 0; 
        
        // Retrocompatibilidad con el array viejo vs nuevo objeto con metadata
        const objectsToLoad = Array.isArray(data) ? data : (data.objects || []);
        
        objectsToLoad.forEach(obj => mapObjects.push(obj));
        
        // Asegurar que el estado apunte al mismo array
        state.mapObjects = mapObjects;
        console.log('Mapa cargado exitosamente', mapObjects.length, 'objetos');
    } catch (error) {
        console.error('No se pudo cargar el mapa. Asegúrate de estar usando un servidor local (Live Server).', error);
    }
}

// --- ESTADO GLOBAL MUTABLE ---
export const state = {
    mapObjects: mapObjects,
    health: 100,
    maxStamina: 200,
    stamina: 200,
    playerXP: 0,
    playerLevel: 1,
    levelUpMessageTimer: 0,
    isDead: false,
    isGodMode: false,
    isFlashlightOn: true,
    isTeleporting: false,
    lastDamageTime: 0,
    bloodOpacity: 0,
    hurtWobbleIntensity: 0,
    hurtWobbleX: 0,
    hurtWobbleY: 0,
    hurtWobbleZoom: 0,

    // Movimiento e inputs
    moveForward: false, moveBackward: false, moveLeft: false, moveRight: false, moveRun: false, canJump: false,
    bHopSpeedMultiplier: 1.0, groundTimer: 0.0, wallJumpCount: 0, lastWallHitType: 0, isWallSliding: false,

    // Combate
    isAttacking: false, attackTimer: 0, comboStep: 0, lastClickTime: 0, currentPunch: 'left', hasDealtDamage: false,
    
    // UI y Entorno
    isInventoryOpen: false, isChatOpen: false, chatFadeTimer: null,
    inventorySlots: new Array(36).fill(null),
    activeHotbarIndex: 0,
    physicsPosition: new THREE.Vector3(0, 1.6, 0),
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    prevTime: performance.now(),

    // Referencias a la escena
    controls: null, swordGroup: null, rFist: null, leftArmGroup: null, rightArmGroup: null, flashlight: null,
    crystals: [], npcs: [], worldItems: [], activeEnemies: [], openedChests: new Set(), currentLevelGroup: null,
    
    // Debug
    debugHitboxes: false, debugMeshes: [], playerDebugMesh: null, freeCam: false
};

// Item inicial
state.inventorySlots[0] = { name: "Espada de Hierro", color: 0x999999 };

// --- LÓGICA DE UTILIDAD GLOBAL ---
export function getFloorHeight(x, z) {
    let maxFloor = 0; // Suelo base
    const floorRadius = 0.3; // Radio más estricto para no subirse a paredes al rozarlas

    for (const obj of state.mapObjects) {
        const pos = obj.pos || [obj.x || 0, (obj.height/2) || 0, obj.z || 0];
        const scale = obj.scale || [
            obj.width || (obj.radius ? obj.radius * 2 : 2),
            obj.height || 8,
            obj.depth || (obj.radius ? obj.radius * 2 : 2)
        ];

        const hw = scale[0] / 2;
        const hd = scale[2] / 2;
        const rotY = obj.rot ? (obj.rot[1] * Math.PI / 180) : ((obj.rotationY || 0));

        const dx = x - pos[0];
        const dz = z - pos[2];
        const cosRot = Math.cos(-rotY);
        const sinRot = Math.sin(-rotY);
        const localX = dx * cosRot - dz * sinRot;
        const localZ = dx * sinRot + dz * cosRot;

        let objMaxY = pos[1] + scale[1] / 2;

        if (obj.type === 'column') {
            const dist = Math.hypot(dx, dz);
            if (dist < (scale[0] / 2) + floorRadius) {
                if (objMaxY > maxFloor) maxFloor = objMaxY;
            }
        } else if (obj.type === 'wall' || obj.type === 'chest') {
            if (Math.abs(localX) < (hw + floorRadius) && Math.abs(localZ) < (hd + floorRadius)) {
                if (objMaxY > maxFloor) maxFloor = objMaxY;
            }
        } else if (obj.type === 'ramp') {
            if (Math.abs(localX) < (hw + floorRadius) && Math.abs(localZ) < (hd + floorRadius)) {
                // Cálculo lineal de altura para la rampa
                // Base de la rampa en Z local = hd (Frontal)
                // Cima de la rampa en Z local = -hd (Trasero)
                let clampedZ = Math.max(-hd, Math.min(hd, localZ));
                let t = 0.5 - (clampedZ / scale[2]); // Va de 0 a 1
                let rampY = (pos[1] - scale[1] / 2) + (t * scale[1]);
                if (rampY > maxFloor) maxFloor = rampY;
            }
        }
    }
    return maxFloor;
}

export function checkMapCollision(x, y, z) {
    for (const obj of state.mapObjects) {
        const pos = obj.pos || [obj.x || 0, (obj.height/2) || 0, obj.z || 0];
        const scale = obj.scale || [
            obj.width || (obj.radius ? obj.radius * 2 : 2),
            obj.height || 8,
            obj.depth || (obj.radius ? obj.radius * 2 : 2)
        ];

        const halfH = scale[1] / 2;
        const minY = pos[1] - halfH;
        const maxY = pos[1] + halfH;
        
        const feetY = y - 1.6;
        const headY = y + 0.2;
        
        // Si los pies están por encima (o casi) del techo del objeto, no colisionamos horizontalmente.
        // Tolerancia de 0.1 para que la gravedad dinámica lo asiente sin atascarlo.
        if (headY > minY && feetY < maxY - 0.1) {
            if (obj.type === 'column') {
                const dist = Math.hypot(x - pos[0], z - pos[2]);
                if (dist < playerRadius + (scale[0] / 2)) return obj.type;
            } else if (obj.type === 'wall' || obj.type === 'chest' || obj.type === 'ramp') {
                const hw = scale[0] / 2;
                const hd = scale[2] / 2;
                
                const rotY = obj.rot ? (obj.rot[1] * Math.PI / 180) : ((obj.rotationY || 0));
                
                const dx = x - pos[0];
                const dz = z - pos[2];
                
                // Rotación inversa correcta hacia el espacio local
                const cosRot = Math.cos(-rotY);
                const sinRot = Math.sin(-rotY);
                const localX = dx * cosRot - dz * sinRot;
                const localZ = dx * sinRot + dz * cosRot;
                
                if (Math.abs(localX) < (hw + playerRadius) && Math.abs(localZ) < (hd + playerRadius)) {
                    return obj.type;
                }
            }
        }
    }
    return 0;
}

export function resolveMapCollisions(x, y, z) {
    let resX = x;
    let resZ = z;
    const feetY = y - 1.6;
    const headY = y + 0.2;

    // Ejecutamos varias iteraciones para resolver esquinas o rebotes en cadena
    for (let iter = 0; iter < 3; iter++) {
        let hasCollision = false;
        
        for (const obj of state.mapObjects) {
            const pos = obj.pos || [obj.x || 0, (obj.height/2) || 0, obj.z || 0];
            const scale = obj.scale || [
                obj.width || (obj.radius ? obj.radius * 2 : 2),
                obj.height || 8,
                obj.depth || (obj.radius ? obj.radius * 2 : 2)
            ];

            const halfH = scale[1] / 2;
            const minY = pos[1] - halfH;
            const maxY = pos[1] + halfH;
            
            if (headY > minY && feetY < maxY - 0.1) {
                if (obj.type === 'column') {
                    const dist = Math.hypot(resX - pos[0], resZ - pos[2]);
                    const minDist = playerRadius + (scale[0] / 2);
                    if (dist < minDist && dist > 0) {
                        const overlap = minDist - dist;
                        const nx = (resX - pos[0]) / dist;
                        const nz = (resZ - pos[2]) / dist;
                        resX += nx * overlap;
                        resZ += nz * overlap;
                        hasCollision = true;
                    }
                } else if (obj.type === 'wall' || obj.type === 'chest' || obj.type === 'ramp') {
                    const hw = scale[0] / 2;
                    const hd = scale[2] / 2;
                    
                    const rotY = obj.rot ? (obj.rot[1] * Math.PI / 180) : ((obj.rotationY || 0));
                    
                    const dx = resX - pos[0];
                    const dz = resZ - pos[2];
                    
                    const cosRot = Math.cos(-rotY);
                    const sinRot = Math.sin(-rotY);
                    const localX = dx * cosRot - dz * sinRot;
                    const localZ = dx * sinRot + dz * cosRot;
                    
                    if (Math.abs(localX) < (hw + playerRadius) && Math.abs(localZ) < (hd + playerRadius)) {
                        const overlapX = (hw + playerRadius) - Math.abs(localX);
                        const overlapZ = (hd + playerRadius) - Math.abs(localZ);
                        
                        let pushLocalX = 0;
                        let pushLocalZ = 0;
                        
                        // Empujamos en la dirección de menor penetración
                        if (overlapX < overlapZ) {
                            pushLocalX = Math.sign(localX) * overlapX;
                        } else {
                            pushLocalZ = Math.sign(localZ) * overlapZ;
                        }
                        
                        // Rotar el empuje de vuelta al espacio global (rotación inversa a -rotY es rotY)
                        const cosRotGlobal = Math.cos(rotY);
                        const sinRotGlobal = Math.sin(rotY);
                        const globalPushX = pushLocalX * cosRotGlobal - pushLocalZ * sinRotGlobal;
                        const globalPushZ = pushLocalX * sinRotGlobal + pushLocalZ * cosRotGlobal;
                        
                        resX += globalPushX;
                        resZ += globalPushZ;
                        hasCollision = true;
                    }
                }
            }
        }
        if (!hasCollision) break;
    }
    return { x: resX, z: resZ };
}

export function updateInventoryUI() {
    const grid = document.getElementById('inventory-grid');
    const hotbar = document.getElementById('hotbar-container');
    if (!grid || !hotbar) return; // Evita el crash si el DOM no cargó todavía
    
    grid.innerHTML = ''; hotbar.innerHTML = '';
    
    for (let i = 0; i < 36; i++) {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'inv-slot';
        const item = state.inventorySlots[i];
        
        if (item) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inv-item';
            itemDiv.style.backgroundColor = '#' + item.color.toString(16).padStart(6, '0');
            itemDiv.innerText = item.name === "Objeto Extraño" ? "Obj Ext" : item.name;
            slotDiv.addEventListener('mousedown', (e) => {
                const tooltip = document.getElementById('inv-tooltip');
                if (e.shiftKey && tooltip) tooltip.innerText = item.name === 'Objeto Extraño' ? "objeto olvidado por un extraño. Posiblemente basura." : item.name;
            });
            slotDiv.appendChild(itemDiv);
        }
        grid.appendChild(slotDiv);
        
        if (i < 6) {
            const hbSlotDiv = document.createElement('div');
            hbSlotDiv.className = 'hotbar-slot';
            if (i === state.activeHotbarIndex) hbSlotDiv.classList.add('active');
            
            const slotNum = document.createElement('div');
            slotNum.style.cssText = 'position:absolute; top:2px; left:2px; font-size:10px; color:#fff; text-shadow:1px 1px 0px #000;';
            slotNum.innerText = (i + 1).toString();
            hbSlotDiv.appendChild(slotNum);

            if (item) {
                const hbItemDiv = document.createElement('div');
                hbItemDiv.className = 'inv-item';
                hbItemDiv.style.backgroundColor = '#' + item.color.toString(16).padStart(6, '0');
                hbItemDiv.innerText = item.name === "Objeto Extraño" ? "Obj Ext" : item.name;
                hbSlotDiv.appendChild(hbItemDiv);
            }
            hotbar.appendChild(hbSlotDiv);
        }
    }
    
    if (state.swordGroup && state.rFist) {
        const activeItem = state.inventorySlots[state.activeHotbarIndex];
        if (activeItem && activeItem.name === "Espada de Hierro") {
            state.swordGroup.visible = true; state.rFist.visible = false;
        } else {
            state.swordGroup.visible = false; state.rFist.visible = true;
        }
    }
}

export function updateStatsUI() {
    const lvlVal = document.getElementById('level-value');
    const xpVal = document.getElementById('xp-value');
    const dmgVal = document.getElementById('weapon-damage-value');
    if (!lvlVal || !xpVal || !dmgVal) return;

    const activeItem = state.inventorySlots[state.activeHotbarIndex];
    let weaponDamage = fistsWeapon.damageCombo1;
    if (activeItem && activeItem.name === 'Espada de Hierro') weaponDamage = swordWeapon.damageCombo1;

    lvlVal.innerText = String(state.playerLevel);
    xpVal.innerText = String(state.playerXP);
    dmgVal.innerText = String(weaponDamage);
}

export function addXP(amount) {
    state.playerXP += amount;
    let xpNeeded = state.playerLevel * 100;
    while (state.playerXP >= xpNeeded) {
        state.playerXP -= xpNeeded;
        state.playerLevel++;
        xpNeeded = state.playerLevel * 100;
        state.health = 100;
        
        const diagBox = document.getElementById('dialogue-box');
        if (diagBox) diagBox.innerText = `¡Subiste al nivel ${state.playerLevel}!`;
        state.levelUpMessageTimer = 3.0;
    }
}

export function takeDamage(amount) {
    if (state.isDead || state.isGodMode) return;
    state.health = Math.max(0, state.health - amount);
    state.lastDamageTime = performance.now(); // Registrar tiempo del golpe
    


    // Gestionar imágenes de sangre
    const img1 = document.getElementById('blood-img1');
    const img2 = document.getElementById('blood-img2');
    if (img1 && img2) {
        if (state.health <= 40) {
            // Mostrar ambas imágenes en estado crítico
            img1.style.display = 'block';
            img2.style.display = 'block';
        } else {
            // Elegir una imagen aleatoria si no se muestra ninguna todavía
            if (img1.style.display !== 'block' && img2.style.display !== 'block') {
                if (Math.random() < 0.5) {
                    img1.style.display = 'block';
                    img2.style.display = 'none';
                } else {
                    img1.style.display = 'none';
                    img2.style.display = 'block';
                }
            }
        }
    }

    // Activar tambaleo de pantalla (hurtWobble) en golpes fuertes (>= 15 dmg) o HP bajo (< 45)
    if (amount >= 15 || state.health <= 45) {
        state.hurtWobbleIntensity = Math.min(0.08, state.hurtWobbleIntensity + amount * 0.003);
    }

    if (state.health <= 0) {
        state.isDead = true;
        if(state.controls) state.controls.unlock();
        const deathScreen = document.getElementById('death-screen');
        const blocker = document.getElementById('blocker');
        if (deathScreen) deathScreen.style.display = 'flex';
        if (blocker) blocker.style.display = 'none';

    // Ocultar la sangre en la pantalla de muerte
    const bloodOverlay = document.getElementById('blood-overlay');
    if (bloodOverlay) bloodOverlay.style.opacity = '0';
    state.bloodOpacity = 0;
    state.hurtWobbleIntensity = 0;
    state.hurtWobbleX = 0;
    state.hurtWobbleY = 0;
    state.hurtWobbleZoom = 0;
    }
}

export function respawnPlayer() {
    state.isDead = false;
    state.health = 100;
    state.velocity.set(0, 0, 0);
    if (state.controls) {
        state.controls.getObject().position.set(0, 1.6, 0);
        state.controls.lock();
    }
    state.physicsPosition.set(0, 1.6, 0);
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) deathScreen.style.display = 'none';
    


    // Limpiar sangre en respawn
    state.bloodOpacity = 0;
    state.hurtWobbleIntensity = 0;
    state.hurtWobbleX = 0;
    state.hurtWobbleY = 0;
    state.hurtWobbleZoom = 0;
    const bloodOverlay = document.getElementById('blood-overlay');
    if (bloodOverlay) bloodOverlay.style.opacity = '0';
    const img1 = document.getElementById('blood-img1');
    const img2 = document.getElementById('blood-img2');
    if (img1) img1.style.display = 'none';
    if (img2) img2.style.display = 'none';
}