import * as THREE from 'three';
import { state, updateInventoryUI, updateStatsUI, chestLootTable, cellSize, respawnPlayer, checkMapCollision } from './state.js';
import { tryOpenNearbyChest, tryUseNearbyPortal } from './level.js';

export function setupInputs(camera) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return; // Salvaguarda pasiva

    document.addEventListener('mousedown', (event) => {
        if (state.controls && state.controls.isLocked && event.button === 0 && !state.isDead) {
            const now = performance.now();
            state.comboStep = (now - state.lastClickTime < 500) ? (state.comboStep % 3) + 1 : 1;
            state.lastClickTime = now;
            if (state.weaponManager) {
                const hasSword = state.inventorySlots[state.activeHotbarIndex] && state.inventorySlots[state.activeHotbarIndex].name === "Espada de Hierro";
                state.weaponManager.attack(state.comboStep, hasSword);
            }
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
                        fb = 'Curado';
                    }
                    else if (cmd === 'h') {
                        state.debugHitboxes = !state.debugHitboxes;
                        fb = `Hitboxes Visuales: ${state.debugHitboxes ? 'ON' : 'OFF'}`;
                        window.dispatchEvent(new CustomEvent('toggleDebugHitboxes', { detail: state.debugHitboxes }));
                    }
                    else if (cmd === 'cam') {
                        state.freeCam = !state.freeCam;
                        fb = `Cámara Libre: ${state.freeCam ? 'ON' : 'OFF'}`;
                        window.dispatchEvent(new CustomEvent('toggleFreeCam', { detail: state.freeCam }));
                    }
                    else if (cmd === 'stamina') { state.stamina = state.maxStamina; fb = 'SP max'; }
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
                        if (freeIdx !== -1) {
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
            setTimeout(() => { state.isChatOpen = false; if (!state.isDead && state.controls) state.controls.lock(); }, 30);
        }
        event.stopPropagation();
    });

    document.addEventListener('keydown', (e) => {
        // 1. Si el chat está abierto o se está teletransportando, no hacer nada
        if (state.isChatOpen || state.isTeleporting) return;

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

        if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
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
                if (state.controls && state.controls.isLocked) {
                    // Primero intentamos interactuar con un portal (escalera)
                    if (!tryUseNearbyPortal(camera)) {
                        // Si no hay portal, alternamos la linterna
                        state.isFlashlightOn = !state.isFlashlightOn;
                        if (state.flashlight) state.flashlight.visible = state.isFlashlightOn;
                    }
                }
                break;
            case 'Space':
                if (state.canJump) {
                    state.velocity.y += 12;
                    if (state.moveRun && state.stamina > 0) state.bHopSpeedMultiplier = Math.min(1.8, state.bHopSpeedMultiplier + 0.15);
                    state.canJump = false; state.groundTimer = 0.0; state.wallJumpCount = 0; state.isWallSliding = false;
                } else {
                    // --- Lógica de Wall Kick (Salto en Pared en el aire) ---
                    const pos = state.controls.getObject().position;

                    // Vector de movimiento local (WASD)
                    const localDir = new THREE.Vector3(
                        Number(state.moveRight) - Number(state.moveLeft),
                        0,
                        Number(state.moveBackward) - Number(state.moveForward)
                    );

                    if (localDir.lengthSq() > 0) {
                        localDir.normalize();
                        // Transformar a dirección global aplicando la rotación de la cámara
                        const worldDir = localDir.clone().applyQuaternion(camera.quaternion);
                        worldDir.y = 0;
                        worldDir.normalize();

                        // Offset de testeo (0.3 unidades adelante de tu movimiento)
                        const checkX = pos.x + worldDir.x * 0.3;
                        const checkZ = pos.z + worldDir.z * 0.3;

                        const hitType = checkMapCollision(checkX, checkZ);

                        if (hitType !== 0) { // Si rozamos algo sólido
                            if (state.wallJumpCount < 2) {
                                state.velocity.y = 14; // Impulso vertical
                                // Invertir drásticamente la dirección horizontal empujándote hacia atrás
                                state.velocity.x = (Number(state.moveRight) - Number(state.moveLeft)) * 40;
                                state.velocity.z = (Number(state.moveForward) - Number(state.moveBackward)) * 40;
                                state.wallJumpCount++;
                                state.lastWallHitType = hitType;
                                state.bHopSpeedMultiplier = Math.min(1.8, state.bHopSpeedMultiplier + 0.1); // Premia encadenar saltos
                                state.isWallSliding = false;
                            } else if (state.wallJumpCount === 2) {
                                state.isWallSliding = true; // Tercer intento fallido: Caída lenta
                            }
                        }
                    }
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (state.isChatOpen || state.isTeleporting) return;
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