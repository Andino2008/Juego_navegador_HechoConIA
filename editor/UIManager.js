import * as THREE from 'three';
import { setTransformMode, setSnapValue, addObjectToScene, removeSelectedObject, clearSceneObjects, cloneSelectedObject, selectObject, getInteractableObjects } from './EditorCore.js';
import { exportMapToJSON, importMapFromJSON } from './ExportManager.js';

export const sceneGroups = {
    'Default': { visible: true }
};

export function addGroup(name, visible = true) {
    if (!sceneGroups[name]) {
        sceneGroups[name] = { visible: visible };
        renderGroups();
    }
}

export function setGroups(importedGroups) {
    // Limpiar grupos existentes (excepto Default si se quiere, pero lo reescribimos)
    for (const key in sceneGroups) {
        delete sceneGroups[key];
    }
    if (importedGroups) {
        for (const key in importedGroups) {
            sceneGroups[key] = { visible: importedGroups[key].visible };
        }
    }
    if (!sceneGroups['Default']) {
        sceneGroups['Default'] = { visible: true };
    }
    renderGroups();
}

export function renderGroups() {
    const list = document.getElementById('groups-list');
    const select = document.getElementById('object-group-select');
    if(!list || !select) return;
    
    list.innerHTML = '';
    const currentSelection = select.value;
    select.innerHTML = '';

    for (const groupName in sceneGroups) {
        const isVisible = sceneGroups[groupName].visible;
        
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '5px';
        li.style.borderBottom = '1px solid #444';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = groupName;
        
        const eyeBtn = document.createElement('button');
        eyeBtn.innerText = isVisible ? '👁' : '🚫';
        eyeBtn.style.background = 'none';
        eyeBtn.style.border = 'none';
        eyeBtn.style.cursor = 'pointer';
        eyeBtn.onclick = () => toggleGroupVisibility(groupName);
        
        li.appendChild(nameSpan);
        li.appendChild(eyeBtn);
        list.appendChild(li);

        const opt = document.createElement('option');
        opt.value = groupName;
        opt.innerText = groupName;
        select.appendChild(opt);
    }
    if (sceneGroups[currentSelection]) select.value = currentSelection;
}

export function toggleGroupVisibility(groupName) {
    if (sceneGroups[groupName]) {
        sceneGroups[groupName].visible = !sceneGroups[groupName].visible;
        const visible = sceneGroups[groupName].visible;
        
        const objects = getInteractableObjects();
        objects.forEach(obj => {
            if (obj.userData.group === groupName) {
                obj.visible = visible;
            }
        });
        renderGroups();
    }
}

let currentSelectedObject = null;

export function initUIManager() {
    renderGroups();

    document.getElementById('btn-add-group').addEventListener('click', () => {
        const input = document.getElementById('new-group-name');
        const name = input.value.trim();
        if (name) {
            addGroup(name);
            input.value = '';
        }
    });

    document.getElementById('object-group-select').addEventListener('change', (e) => {
        if (currentSelectedObject) {
            currentSelectedObject.userData.group = e.target.value;
            // Ocultarlo si se movió a un grupo oculto
            if(!sceneGroups[e.target.value].visible) {
                currentSelectedObject.visible = false;
                selectObject(null); // deseleccionar
            }
        }
    });

    const scaleInputs = ['x', 'y', 'z'].map(axis => document.getElementById(`scale-${axis}`));
    scaleInputs.forEach((input, index) => {
        const axes = ['x', 'y', 'z'];
        input.addEventListener('change', (e) => {
            if (currentSelectedObject) {
                let val = parseFloat(e.target.value);
                const snap = parseFloat(document.getElementById('snap-select').value);
                val = Math.round(val / snap) * snap || snap;
                currentSelectedObject.scale[axes[index]] = val;
                input.value = val;
            }
        });
    });

    // Modo de Transformación (Translación, Rotación, Escala)
    document.querySelectorAll('.transform-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.transform-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTransformMode(btn.dataset.mode);
        });
    });

    // Snapping Select
    const snapSelect = document.getElementById('snap-select');
    snapSelect.addEventListener('change', (e) => {
        setSnapValue(e.target.value);
    });

    // Spawning de Primitivas
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            spawnPrimitive(btn.dataset.spawn);
        });
    });

    // Borrado
    document.getElementById('btn-delete').addEventListener('click', () => {
        if (removeSelectedObject()) {
            document.getElementById('object-properties').style.display = 'none';
            currentSelectedObject = null;
        }
    });

    // Atajos de teclado
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            const clone = cloneSelectedObject();
            if (clone) selectObject(clone);
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            // No borrar si estamos escribiendo en un input
            if(document.activeElement.tagName === 'INPUT') return;
            if (removeSelectedObject()) {
                document.getElementById('object-properties').style.display = 'none';
                currentSelectedObject = null;
            }
        }
        if (e.key === 't' || e.key === 'T') {
            if(document.activeElement.tagName === 'INPUT') return;
            document.querySelector('[data-mode="translate"]').click();
        }
        if (e.key === 'r' || e.key === 'R') {
            if(document.activeElement.tagName === 'INPUT') return;
            document.querySelector('[data-mode="rotate"]').click();
        }
        if (e.key === 'e' || e.key === 'E') {
            if(document.activeElement.tagName === 'INPUT') return;
            document.querySelector('[data-mode="scale"]').click();
        }
    });

    window.addEventListener('objectTransformed', (e) => {
        const obj = e.detail;
        if (obj) {
            document.getElementById('scale-x').value = obj.scale.x;
            document.getElementById('scale-y').value = obj.scale.y;
            document.getElementById('scale-z').value = obj.scale.z;
        }
    });

    window.addEventListener('cameraModeChanged', (e) => {
        const span = document.getElementById('camera-mode-text');
        if (span) {
            span.innerText = `[${e.detail}]`;
            span.style.color = e.detail === 'FPS' ? '#ff7675' : '#55efc4';
        }
    });

    // Escuchar selección de objetos desde EditorCore
    window.addEventListener('objectSelected', (e) => {
        const obj = e.detail;
        currentSelectedObject = obj;
        const panel = document.getElementById('object-properties');
        if (obj) {
            panel.style.display = 'block';
            document.getElementById('selected-type').innerText = `${obj.userData.type.toUpperCase()} (ID: ${obj.userData.id})`;
            document.getElementById('object-group-select').value = obj.userData.group || 'Default';
            document.getElementById('scale-x').value = obj.scale.x;
            document.getElementById('scale-y').value = obj.scale.y;
            document.getElementById('scale-z').value = obj.scale.z;
        } else {
            panel.style.display = 'none';
        }
    });

    // Importar / Exportar / Limpiar
    document.getElementById('btn-export').addEventListener('click', exportMapToJSON);
    
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-import').click();
    });

    document.getElementById('file-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            importMapFromJSON(evt.target.result);
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm('¿Estás seguro de querer borrar todo el mapa?')) {
            clearSceneObjects();
        }
    });
}

function spawnPrimitive(type) {
    let geometry, material;
    let defaultScale = new THREE.Vector3(2, 2, 2);
    let properties = {};

    switch (type) {
        case 'wall':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            material = new THREE.MeshStandardMaterial({ color: 0xa29bfe });
            defaultScale.set(4, 8, 2);
            break;
        case 'column':
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
            material = new THREE.MeshStandardMaterial({ color: 0x74b9ff });
            defaultScale.set(2, 8, 2);
            properties = { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 16 };
            break;
        case 'ramp':
            // Cuña estricta (Wedge) de 6 vértices
            geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -0.5, -0.5,  0.5,  // 0: Abajo Frontal Izq
                 0.5, -0.5,  0.5,  // 1: Abajo Frontal Der
                -0.5, -0.5, -0.5,  // 2: Abajo Trasero Izq
                 0.5, -0.5, -0.5,  // 3: Abajo Trasero Der
                -0.5,  0.5, -0.5,  // 4: Arriba Trasero Izq
                 0.5,  0.5, -0.5   // 5: Arriba Trasero Der
            ]);
            // CCW winding para que las normales apunten hacia afuera
            const indices = [
                0, 1, 3,  0, 3, 2, // Base
                2, 3, 5,  2, 5, 4, // Espalda (-Z)
                0, 5, 1,  0, 4, 5, // Superficie de la rampa
                0, 2, 4,           // Lado izquierdo
                1, 5, 3            // Lado derecho
            ];
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            
            material = new THREE.MeshStandardMaterial({ color: 0x55efc4 });
            defaultScale.set(4, 4, 4);
            break;
        case 'chest':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            material = new THREE.MeshStandardMaterial({ color: 0xffeaa7 });
            defaultScale.set(2.5, 2, 1.8);
            break;
        case 'portal':
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
            material = new THREE.MeshStandardMaterial({ color: 0x00cec9, transparent: true, opacity: 0.6 });
            defaultScale.set(3, 0.2, 3);
            properties = { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32, destX: 0, destZ: 0, label: "Destino" };
            break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
        type: type,
        group: 'Default',
        properties: properties
        // El ID será autogenerado por EditorCore.js en addObjectToScene
    };

    // Si el grupo 'Default' está oculto, el objeto debería nacer oculto
    if (sceneGroups['Default'] && !sceneGroups['Default'].visible) {
        mesh.visible = false;
    }

    mesh.scale.copy(defaultScale);
    mesh.position.y = defaultScale.y / 2;
    
    addObjectToScene(mesh);
}
