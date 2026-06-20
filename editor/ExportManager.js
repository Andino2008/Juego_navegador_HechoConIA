import * as THREE from 'three';
import { getInteractableObjects, clearSceneObjects, addObjectToScene } from './EditorCore.js';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export function exportMapToJSON() {
    const objects = getInteractableObjects();
    const mapData = [];

    objects.forEach(obj => {
        // Redondear para evitar basura matemática flotante (ej: 0.00000000000001)
        const round = (val) => Math.round(val * 1000) / 1000;

        const data = {
            id: obj.userData.id,
            type: obj.userData.type,
            pos: [round(obj.position.x), round(obj.position.y), round(obj.position.z)],
            rot: [
                round(obj.rotation.x * RAD2DEG), 
                round(obj.rotation.y * RAD2DEG), 
                round(obj.rotation.z * RAD2DEG)
            ],
            scale: [round(obj.scale.x), round(obj.scale.y), round(obj.scale.z)],
            properties: obj.userData.properties || {}
        };
        mapData.push(data);
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mapa.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export function importMapFromJSON(jsonString) {
    try {
        const mapData = JSON.parse(jsonString);
        clearSceneObjects();

        // Encontrar el ID máximo para que los nuevos objetos no repitan ID
        let maxId = 0;

        mapData.forEach(data => {
            if (data.id > maxId) maxId = data.id;

            let geometry, material;
            
            switch (data.type) {
                case 'wall':
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    material = new THREE.MeshStandardMaterial({ color: 0xa29bfe });
                    break;
                case 'column':
                    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
                    material = new THREE.MeshStandardMaterial({ color: 0x74b9ff });
                    break;
                case 'ramp':
                    geometry = new THREE.CylinderGeometry(1, 1, 1, 3);
                    material = new THREE.MeshStandardMaterial({ color: 0x55efc4 });
                    // Replicar rotación base de la rampa
                    geometry.rotateX(Math.PI / 2);
                    geometry.rotateZ(Math.PI / 6);
                    break;
                case 'chest':
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    material = new THREE.MeshStandardMaterial({ color: 0xffeaa7 });
                    break;
                case 'portal':
                    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                    material = new THREE.MeshStandardMaterial({ color: 0x00cec9, transparent: true, opacity: 0.6 });
                    break;
                default:
                    console.warn("Tipo desconocido importado:", data.type);
                    return;
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData = {
                id: data.id,
                type: data.type,
                properties: data.properties || {}
            };

            mesh.position.set(data.pos[0], data.pos[1], data.pos[2]);
            mesh.rotation.set(data.rot[0] * DEG2RAD, data.rot[1] * DEG2RAD, data.rot[2] * DEG2RAD);
            mesh.scale.set(data.scale[0], data.scale[1], data.scale[2]);

            addObjectToScene(mesh);
        });

        console.log(`Mapa importado: ${mapData.length} objetos.`);
        
        // Un hack pequeño para actualizar el objectIdCounter del UIManager,
        // pero por simplicidad modular asume que se exporta un maxId o el UIManager confía en IDs grandes aleatorios.
        
    } catch (e) {
        console.error("Error al parsear JSON importado:", e);
        alert("El archivo JSON es inválido o está corrupto.");
    }
}
