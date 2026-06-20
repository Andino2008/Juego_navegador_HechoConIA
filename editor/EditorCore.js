import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

let scene, camera, renderer, orbit, transformControl;
let gridHelper;
let snapValue = 2; // Default
let selectedObject = null;
const interactableObjects = [];

export function initEditorCore() {
    const container = document.getElementById('editor-viewport');
    
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    
    // Grid
    gridHelper = new THREE.GridHelper(200, 100, 0x444455, 0x222233);
    scene.add(gridHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Camera
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(10, 15, 20);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;

    // Transform Controls
    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function (event) {
        orbit.enabled = !event.value;
    });
    
    // Snapping Logic
    transformControl.addEventListener('change', () => {
        if (transformControl.object) {
            const obj = transformControl.object;
            const mode = transformControl.getMode();
            
            if (mode === 'translate') {
                obj.position.x = Math.round(obj.position.x / snapValue) * snapValue;
                obj.position.y = Math.round(obj.position.y / snapValue) * snapValue;
                obj.position.z = Math.round(obj.position.z / snapValue) * snapValue;
            } else if (mode === 'scale') {
                obj.scale.x = Math.round(obj.scale.x / snapValue) * snapValue || snapValue;
                obj.scale.y = Math.round(obj.scale.y / snapValue) * snapValue || snapValue;
                obj.scale.z = Math.round(obj.scale.z / snapValue) * snapValue || snapValue;
            } else if (mode === 'rotate') {
                // Snap rotation to 15 degrees (approx 0.26 rad) or 90 degrees? Let's use 15 deg (Math.PI / 12)
                const rotSnap = Math.PI / 12;
                obj.rotation.x = Math.round(obj.rotation.x / rotSnap) * rotSnap;
                obj.rotation.y = Math.round(obj.rotation.y / rotSnap) * rotSnap;
                obj.rotation.z = Math.round(obj.rotation.z / rotSnap) * rotSnap;
            }
        }
        render();
    });
    scene.add(transformControl);

    // Raycaster for selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return; // Only left click
        if (transformControl.dragging) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, false);

        if (intersects.length > 0) {
            selectObject(intersects[0].object);
        } else {
            selectObject(null);
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        render();
    });

    // Animation Loop
    renderer.setAnimationLoop(() => {
        orbit.update();
        renderer.render(scene, camera);
    });
}

function render() {
    renderer.render(scene, camera);
}

export function setSnapValue(value) {
    snapValue = parseFloat(value);
}

export function setTransformMode(mode) {
    transformControl.setMode(mode);
}

export function addObjectToScene(mesh) {
    scene.add(mesh);
    interactableObjects.push(mesh);
    selectObject(mesh);
}

export function removeSelectedObject() {
    if (selectedObject) {
        transformControl.detach();
        scene.remove(selectedObject);
        const idx = interactableObjects.indexOf(selectedObject);
        if (idx > -1) interactableObjects.splice(idx, 1);
        selectedObject = null;
        return true;
    }
    return false;
}

export function selectObject(obj) {
    selectedObject = obj;
    if (obj) {
        transformControl.attach(obj);
    } else {
        transformControl.detach();
    }
    // Dispatch event to UI
    window.dispatchEvent(new CustomEvent('objectSelected', { detail: obj }));
}

export function getInteractableObjects() {
    return interactableObjects;
}

export function clearSceneObjects() {
    transformControl.detach();
    selectedObject = null;
    [...interactableObjects].forEach(obj => {
        scene.remove(obj);
    });
    interactableObjects.length = 0;
}
