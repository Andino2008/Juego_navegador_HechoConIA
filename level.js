import * as THREE from 'three';
import { state, cellSize, chestLootTable, updateInventoryUI } from './state.js';
import { TrainingDummy, Zombie } from './enemies.js';

export function tryOpenNearbyChest() {
    for (let i = 0; i < state.mapObjects.length; i++) {
        const obj = state.mapObjects[i];
        if (obj.type !== 'chest') continue;
        
        // key string is no longer viable by row/col. Let's use position or index.
        const key = `chest_${obj.x}_${obj.z}`;
        if (state.openedChests.has(key)) continue;

        const dist = Math.hypot(state.physicsPosition.x - obj.x, state.physicsPosition.z - obj.z);
        if (dist <= 3.0) {
            const loot = chestLootTable[Math.floor(Math.random() * chestLootTable.length)];
            const freeIdx = state.inventorySlots.indexOf(null);
            if (freeIdx !== -1) {
                state.inventorySlots[freeIdx] = { name: loot.name, color: loot.color };
                updateInventoryUI();
            }
            state.openedChests.add(key);
            obj.type = 'opened_chest'; // Cambio su tipo para que no colisione y podamos ignorarlo, o podemos removerlo visualmente

            if (state.currentLevelGroup) {
                const toRemove = [];
                state.currentLevelGroup.children.forEach(child => {
                    if (child.position && Math.abs(child.position.x - obj.x) < 0.1 && Math.abs(child.position.z - obj.z) < 0.1) toRemove.push(child);
                });
                toRemove.forEach(ch => state.currentLevelGroup.remove(ch));
            }
            return true;
        }
    }
    return false;
}

export function generateLevel(scene) {
    if (state.currentLevelGroup) scene.remove(state.currentLevelGroup);
    state.currentLevelGroup = new THREE.Group();
    state.crystals = []; state.npcs = []; state.worldItems = [];
    
    state.activeEnemies.forEach(e => { if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh); });
    state.activeEnemies = []; state.openedChests.clear();

    const matWall = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const matPillar = new THREE.MeshLambertMaterial({ color: 0x353535 });
    const matHouseWall = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
    const npcMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
    const crystalGeo = new THREE.OctahedronGeometry(0.6, 0);
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // Plano del suelo para mejorar el contraste en el minimapa
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x554433 });
    const levelFloor = new THREE.Mesh(floorGeo, floorMat);
    levelFloor.rotation.x = -Math.PI / 2;
    levelFloor.position.y = 0.01; // Elevado ligeramente para evitar z-fighting con el suelo global
    state.currentLevelGroup.add(levelFloor);

    state.mapObjects.forEach(obj => {
        if (obj.type === 'wall') {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(obj.width, obj.height, obj.depth), matWall);
            mesh.position.set(obj.x, obj.height / 2, obj.z);
            if (obj.rotationY !== undefined) mesh.rotation.y = obj.rotationY;
            state.currentLevelGroup.add(mesh);
        } else if (obj.type === 'column') {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(obj.radius, obj.radius, obj.height, 16), matPillar);
            mesh.position.set(obj.x, obj.height / 2, obj.z);
            state.currentLevelGroup.add(mesh);
        } else if (obj.type === 'chest' || obj.type === 'opened_chest') {
            if (obj.type === 'chest') {
                const group = new THREE.Group();
                const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(obj.width, obj.height / 2, obj.depth), matPillar);
                baseMesh.position.y = obj.height / 4;
                const topMesh = new THREE.Mesh(new THREE.ConeGeometry(obj.width / 1.5, obj.height / 1.5, 4), matWall);
                topMesh.position.y = obj.height / 2 + obj.height / 3;
                group.add(baseMesh, topMesh);
                group.position.set(obj.x, 0, obj.z);
                if (obj.rotationY !== undefined) group.rotation.y = obj.rotationY;
                state.currentLevelGroup.add(group);
            }
        }
    });

    // Mantengo un par de cristales e items en posiciones fijas como en tu código original para no romper cosas
    const crystal1 = new THREE.Mesh(crystalGeo, crystalMat); crystal1.position.set(10, 1.2, -5);
    state.currentLevelGroup.add(crystal1); state.crystals.push({ mesh: crystal1, originY: 1.2 });

    const itemGeo = new THREE.BoxGeometry(2, 0.2, 2);
    [{name:"Cubo 1",c:0x0000ff,x:12,z:0},{name:"Cubo 2",c:0xff0000,x:-30,z:0},{name:"Cubo 3",c:0xffff00,x:0,z:-30},{name:"Objeto Extraño",c:0x800080,x:0,z:-60}].forEach(data => {
        const mesh = new THREE.Mesh(itemGeo, new THREE.MeshLambertMaterial({ color: data.c }));
        mesh.position.set(data.x, 0.1, data.z); state.currentLevelGroup.add(mesh);
        state.worldItems.push({ mesh: mesh, name: data.name, color: data.c });
    });
    
    [new TrainingDummy("Mu", new THREE.Vector3(0,1.2,-12)), new TrainingDummy("Mu2", new THREE.Vector3(6,1.2,-12)),
     new Zombie("Z1", new THREE.Vector3(0,0,-30)), new Zombie("Z2", new THREE.Vector3(-20,0,-15)), new Zombie("Z3", new THREE.Vector3(20,0,-40))
    ].forEach(enemy => { state.currentLevelGroup.add(enemy.mesh); state.activeEnemies.push(enemy); });
    
    scene.add(state.currentLevelGroup);
}