import * as THREE from 'three';
import { setTransformMode, setSnapValue, addObjectToScene, removeSelectedObject, clearSceneObjects } from './EditorCore.js';
import { exportMapToJSON, importMapFromJSON } from './ExportManager.js';

let objectIdCounter = 1;

export function initUIManager() {
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
        }
    });

    // Atajos de teclado
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (removeSelectedObject()) {
                document.getElementById('object-properties').style.display = 'none';
            }
        }
        if (e.key === 't' || e.key === 'T') {
            document.querySelector('[data-mode="translate"]').click();
        }
        if (e.key === 'r' || e.key === 'R') {
            document.querySelector('[data-mode="rotate"]').click();
        }
        if (e.key === 'e' || e.key === 'E') {
            document.querySelector('[data-mode="scale"]').click();
        }
    });

    // Escuchar selección de objetos desde EditorCore
    window.addEventListener('objectSelected', (e) => {
        const obj = e.detail;
        const panel = document.getElementById('object-properties');
        if (obj) {
            panel.style.display = 'block';
            document.getElementById('selected-type').innerText = `${obj.userData.type.toUpperCase()} (ID: ${obj.userData.id})`;
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
            break;
        case 'ramp':
            // Prisma triangular
            geometry = new THREE.CylinderGeometry(1, 1, 1, 3);
            material = new THREE.MeshStandardMaterial({ color: 0x55efc4 });
            // Rotar la geometría para que repose sobre una cara plana
            geometry.rotateX(Math.PI / 2);
            geometry.rotateZ(Math.PI / 6);
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
            break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
        id: objectIdCounter++,
        type: type,
        properties: {}
    };
    
    // Si es portal, añadir properties por defecto
    if(type === 'portal') {
        mesh.userData.properties = { destX: 0, destZ: 0, label: "Destino" };
    }

    mesh.scale.copy(defaultScale);
    mesh.position.y = defaultScale.y / 2; // Reposar sobre el suelo
    
    addObjectToScene(mesh);
}
