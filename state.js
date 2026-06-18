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

export const mapObjects = [
    // Muros Perimetrales Exteriores (Delimitan el mapa de ~40x40 centrado en 0,0)
    { type: 'wall', x: 0, z: -20, width: 40, depth: 2, height: 8 }, // Norte
    { type: 'wall', x: 0, z: 20, width: 40, depth: 2, height: 8 },  // Sur
    { type: 'wall', x: -20, z: 0, width: 2, depth: 40, height: 8 }, // Oeste
    { type: 'wall', x: 20, z: 0, width: 2, depth: 40, height: 8 },  // Este

    // Habitación Inicial (Esquinas y columnas decorativas)
    { type: 'column', x: -6, z: -6, radius: 1.0, height: 8 },
    { type: 'column', x: 6, z: -6, radius: 1.0, height: 8 },
    { type: 'column', x: -6, z: 6, radius: 1.0, height: 8 },
    { type: 'column', x: 6, z: 6, radius: 1.0, height: 8 },

    // Pasillos y Paredes Divisorias (Ala Norte)
    { type: 'wall', x: -10, z: -8, width: 12, depth: 1.5, height: 8 },
    { type: 'wall', x: 10, z: -8, width: 12, depth: 1.5, height: 8 },
    // Pasillo hacia el este
    { type: 'wall', x: 4, z: -14, width: 1.5, depth: 10, height: 8 },

    // Ala Este (Zona de Columnas Cruzadas)
    { type: 'column', x: 12, z: -14, radius: 0.8, height: 8 },
    { type: 'column', x: 16, z: -14, radius: 0.8, height: 8 },
    { type: 'column', x: 12, z: -10, radius: 0.8, height: 8 },
    { type: 'column', x: 16, z: -10, radius: 0.8, height: 8 },

    // Ala Oeste (Cuarto Cerrado del Tesoro)
    { type: 'wall', x: -12, z: 0, width: 1.5, depth: 14, height: 8 },
    { type: 'wall', x: -16, z: 7, width: 8, depth: 1.5, height: 8 },

    // Entidades interactivas (Cofres estratégicos)
    { type: 'chest', x: -16, z: -15, width: 2.5, depth: 1.8, height: 2 }, // Cofre oculto norte
    { type: 'chest', x: -16, z: 4, width: 2.5, depth: 1.8, height: 2 }    // Oculto en cuarto oeste
];

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
    crystals: [], npcs: [], worldItems: [], activeEnemies: [], openedChests: new Set(), currentLevelGroup: null
};

// Item inicial
state.inventorySlots[0] = { name: "Espada de Hierro", color: 0x999999 };

// --- LÓGICA DE UTILIDAD GLOBAL ---
export function checkMapCollision(x, z) {
    for (const obj of state.mapObjects) {
        if (obj.type === 'column') {
            const dist = Math.hypot(x - obj.x, z - obj.z);
            if (dist < playerRadius + obj.radius) return obj.type;
        } else if (obj.type === 'wall' || obj.type === 'chest') {
            const hw = obj.width / 2;
            const hd = obj.depth / 2;
            const minX = obj.x - hw - playerRadius;
            const maxX = obj.x + hw + playerRadius;
            const minZ = obj.z - hd - playerRadius;
            const maxZ = obj.z + hd + playerRadius;
            if (x > minX && x < maxX && z > minZ && z < maxZ) return obj.type;
        }
    }
    return 0;
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
        
        const hpFill = document.getElementById('health-fill');
        const hpText = document.getElementById('hp-text');
        const diagBox = document.getElementById('dialogue-box');
        
        if (hpFill) hpFill.style.width = state.health + '%';
        if (hpText) hpText.innerText = `HP: ${Math.ceil(state.health)} / 100`;
        if (diagBox) diagBox.innerText = `¡Subiste al nivel ${state.playerLevel}!`;
        state.levelUpMessageTimer = 3.0;
    }
}

export function takeDamage(amount) {
    if (state.isDead || state.isGodMode) return;
    state.health = Math.max(0, state.health - amount);
    
    const hpFill = document.getElementById('health-fill');
    const hpText = document.getElementById('hp-text');
    if (hpFill) hpFill.style.width = state.health + '%';
    if (hpText) hpText.innerText = `HP: ${Math.ceil(state.health)} / 100`;

    if (state.health <= 0) {
        state.isDead = true;
        if(state.controls) state.controls.unlock();
        const deathScreen = document.getElementById('death-screen');
        const blocker = document.getElementById('blocker');
        if (deathScreen) deathScreen.style.display = 'flex';
        if (blocker) blocker.style.display = 'none';
    }
}