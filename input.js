import * as THREE from 'three';
import { state, updateInventoryUI, updateStatsUI, chestLootTable, cellSize, respawnPlayer } from './state.js';
import { tryOpenNearbyChest } from './level.js';

export function setupInputs(camera) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return; // Salvaguarda pasiva

    document.addEventListener('mousedown', (event) => {
        if (state.controls && state.controls.isLocked && event.button === 0 && !state.isDead) {
            const now = performance.now();
            state.comboStep = (now - state.lastClickTime < 500) ? (state.comboStep % 3) + 1 : 1;
            state.lastClickTime = now;
            state.isAttacking = true;
            state.attackTimer = 0;
            state.hasDealtDamage = false;
        }
    });

    chatInput.addEventListener('keydown', (event) => {
        if (event.code === 'Enter') {
            event.preventDefault();
            const msg = chatInput.value.trim();
            if (msg !== '') {
                const chatLog = document.getElementById('chat-log');
                let hudText = `Jugador: ${msg}`;
                
                if (msg.startsWith('/')) {
                    const args = msg.slice(1).split(' ');
                    const cmd = args[0].toLowerCase();
                    let fb = 'Comando desconocido';
                    
                    if (cmd === 'god') { state.isGodMode = !state.isGodMode; fb = `Modo Dios: ${state.isGodMode}`; }
                    else if (cmd === 'heal') { 
                        state.health = 100; 
                        const hpFill = document.getElementById('health-fill');
                        if (hpFill) hpFill.style.width='100%'; 
                        fb='Curado'; 
                    }
                    else if (cmd === 'stamina') { state.stamina = state.maxStamina; fb='SP max'; }
                    else if (cmd === 'tp' && args.length >= 3) {
                        const px = parseFloat(args[1]);
                        const pz = parseFloat(args[2]);
                        if (!isNaN(px) && !isNaN(pz)) {
                            state.controls.getObject().position.set(px, 1.6, pz); state.physicsPosition.set(px, 1.6, pz); fb = 'TP OK';
                        } else {
                            fb = 'TP Inválido';
                        }
                    }
                    else if (cmd === 'give' && args.length >= 2) {
                        const itemName = args.slice(1).join(' ');
                        const freeIdx = state.inventorySlots.indexOf(null);
                        if(freeIdx !== -1) {
                            const loot = chestLootTable.find(l => l.name.toLowerCase() === itemName.toLowerCase());
                            state.inventorySlots[freeIdx] = { name: itemName, color: loot ? loot.color : 0xffffff };
                            updateInventoryUI(); fb = `Dado: ${itemName}`;
                        }
                    }
                    if (chatLog) chatLog.innerHTML += `<div style="color: #e0e0a0;">[Consola] ${fb}</div>`;
                } else {
                    if (chatLog) chatLog.innerHTML += `<div>${hudText}</div>`;
                }
                if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
            }
            chatInput.value = '';
            const chatCont = document.getElementById('chat-container');
            if (chatCont) chatCont.style.display = 'none';
            chatInput.blur();
            setTimeout(() => { state.isChatOpen = false; if(!state.isDead && state.controls) state.controls.lock(); }, 30);
        }
        event.stopPropagation();
    });

    document.addEventListener('keydown', (e) => {
        // 1. Si el chat está abierto, no hacer nada
        if (state.isChatOpen) return;

        // 2. Control del Respawn si el jugador ESTÁ muerto
        if (state.isDead) {
            if (e.code === 'KeyR') {
                e.preventDefault();
                respawnPlayer(); // Llamamos a la función de state.js
            }
            return; // Bloquea cualquier otra acción estando muerto
        }

        // 3. Abrir chat si se presiona Enter (solo vivos)
        if (e.code === 'Enter') {
            e.preventDefault();
            state.isChatOpen = true; if (state.controls) state.controls.unlock();
            const chatCont = document.getElementById('chat-container');
            if (chatCont) chatCont.style.display = 'flex';
            setTimeout(() => chatInput.focus(), 20); return;
        }
        if (e.code === 'Tab') { 
            e.preventDefault(); 
            const minimapCont = document.getElementById('minimap-container');
            if (minimapCont) minimapCont.classList.add('expanded'); 
        }
        if (e.code === 'KeyE' && !e.repeat) {
            const invCont = document.getElementById('inventory-container');
            if (state.controls && state.controls.isLocked && !state.isInventoryOpen) {
                state.isInventoryOpen = true; updateStatsUI();
                if (invCont) invCont.style.display = 'flex'; state.controls.unlock();
            } else if (state.isInventoryOpen) {
                state.isInventoryOpen = false; if (invCont) invCont.style.display = 'none';
                if (!state.isDead && state.controls) state.controls.lock();
            }
        }
        if (state.isDead) return;
        
        if (['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'].includes(e.code)) {
            state.activeHotbarIndex = parseInt(e.key) - 1; updateInventoryUI();
        }
        
        switch (e.code) {
            case 'KeyW': state.moveForward = true; break;
            case 'KeyA': state.moveLeft = true; break;
            case 'KeyS': state.moveBackward = true; break;
            case 'KeyD': state.moveRight = true; break;
            case 'ShiftLeft': state.moveRun = true; break;
            case 'KeyR': if (state.controls && state.controls.isLocked) tryOpenNearbyChest(); break;
            case 'KeyF': 
                if (state.controls && state.controls.isLocked && !tryOpenNearbyChest()) {
                    state.isFlashlightOn = !state.isFlashlightOn;
                    if(state.flashlight) state.flashlight.visible = state.isFlashlightOn;
                }
                break;
            case 'Space':
                if (state.canJump) {
                    state.velocity.y += 12;
                    if (state.moveRun && state.stamina > 0) state.bHopSpeedMultiplier = Math.min(1.8, state.bHopSpeedMultiplier + 0.15);
                    state.canJump = false; state.groundTimer = 0.0; state.wallJumpCount = 0; state.isWallSliding = false;
                }
                break;
        }
    });

document.addEventListener('keyup', (e) => {
        if (state.isChatOpen) return;
        if (e.code === 'Tab') { 
            e.preventDefault(); 
            const minimapCont = document.getElementById('minimap-container');
            if (minimapCont) minimapCont.classList.remove('expanded'); 
        }
        if (state.isDead) return;
        switch (e.code) {
            case 'KeyW': state.moveForward = false; break;
            case 'KeyA': state.moveLeft = false; break;
            case 'KeyS': state.moveBackward = false; break;
            case 'KeyD': state.moveRight = false; break;
            case 'ShiftLeft': state.moveRun = false; break;
        }
    });
} // <--- Solo esta llave cierra la función setupInputs