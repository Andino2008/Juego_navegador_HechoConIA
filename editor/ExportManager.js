import * as THREE from 'three';
import { getInteractableObjects, clearSceneObjects, addObjectToScene, setObjectIdCounter } from './EditorCore.js';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

import { sceneGroups, setGroups } from './UIManager.js';

export function exportMapToJSON() {
    const objects = getInteractableObjects();
    const mapData = [];

    objects.forEach(obj => {
        // Redondear para evitar basura matemática flotante (ej: 0.00000000000001)
        const round = (val) => Math.round(val * 1000) / 1000;

        const data = {
            id: obj.userData.id,
            type: obj.userData.type,
            group: obj.userData.group || 'Default',
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

    const exportObject = {
        metadata: {
            groups: sceneGroups
        },
        objects: mapData
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mapa.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export function importMapFromJSON(jsonString) {
    try {
        const rawData = JSON.parse(jsonString);
        clearSceneObjects();

        let mapData = [];
        let importedGroups = null;

        if (Array.isArray(rawData)) {
            // Legacy format
            mapData = rawData;
        } else if (rawData.objects) {
            // New format
            mapData = rawData.objects;
            importedGroups = rawData.metadata ? rawData.metadata.groups : null;
        }

        // Restablecer grupos en UIManager
        setGroups(importedGroups);

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
                    const cProps = data.properties || { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 16 };
                    geometry = new THREE.CylinderGeometry(cProps.radiusTop || 0.5, cProps.radiusBottom || 0.5, cProps.height || 1, cProps.radialSegments || 16);
                    material = new THREE.MeshStandardMaterial({ color: 0x74b9ff });
                    break;
                case 'ramp':
                    geometry = new THREE.BufferGeometry();
                    const vertices = new Float32Array([
                        -0.5, -0.5,  0.5,
                         0.5, -0.5,  0.5,
                        -0.5, -0.5, -0.5,
                         0.5, -0.5, -0.5,
                        -0.5,  0.5, -0.5,
                         0.5,  0.5, -0.5
                    ]);
                    const indices = [
                        0, 1, 3,  0, 3, 2,
                        2, 3, 5,  2, 5, 4,
                        0, 5, 1,  0, 4, 5,
                        0, 2, 4,
                        1, 5, 3
                    ];
                    geometry.setIndex(indices);
                    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                    geometry.computeVertexNormals();
                    material = new THREE.MeshStandardMaterial({ color: 0x55efc4 });
                    break;
                case 'chest':
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    material = new THREE.MeshStandardMaterial({ color: 0xffeaa7 });
                    break;
                case 'portal':
                    const pProps = data.properties || { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 };
                    geometry = new THREE.CylinderGeometry(pProps.radiusTop || 0.5, pProps.radiusBottom || 0.5, pProps.height || 1, pProps.radialSegments || 32);
                    material = new THREE.MeshStandardMaterial({ color: 0x00cec9, transparent: true, opacity: 0.6 });
                    break;
                default:
                    console.warn("Tipo desconocido importado:", data.type);
                    return;
            }

            const mesh = new THREE.Mesh(geometry, material);
            const groupName = data.group || 'Default';
            mesh.userData = {
                id: data.id,
                type: data.type,
                group: groupName,
                properties: data.properties || {}
            };

            mesh.position.set(data.pos[0], data.pos[1], data.pos[2]);
            mesh.rotation.set(data.rot[0] * DEG2RAD, data.rot[1] * DEG2RAD, data.rot[2] * DEG2RAD);
            mesh.scale.set(data.scale[0], data.scale[1], data.scale[2]);

            // Aplicar visibilidad inicial basada en el grupo
            if (sceneGroups[groupName] && !sceneGroups[groupName].visible) {
                mesh.visible = false;
            }

            addObjectToScene(mesh);
        });

        console.log(`Mapa importado: ${mapData.length} objetos.`);
        setObjectIdCounter(maxId);
    } catch (e) {
        console.error("Error al parsear JSON importado:", e);
        alert("El archivo JSON es inválido o está corrupto.");
    }
}
