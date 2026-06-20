import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, orbit, transformControl, fpsControls;
let gridHelper;
let snapValue = 2; // Default
let selectedObject = null;
const interactableObjects = [];

let isFPSMode = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
const clock = new THREE.Clock();

let objectIdCounter = 1;

export function getNextObjectId() {
    return objectIdCounter++;
}

export function setObjectIdCounter(maxId) {
    objectIdCounter = maxId + 1;
}

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

    // PointerLock Controls (FPS Mode)
    fpsControls = new PointerLockControls(camera, renderer.domElement);
    scene.add(fpsControls.getObject());

    fpsControls.addEventListener('lock', () => {
        isFPSMode = true;
        orbit.enabled = false;
        transformControl.enabled = false;
        transformControl.visible = false;
        window.dispatchEvent(new CustomEvent('cameraModeChanged', { detail: 'FPS' }));
    });

    fpsControls.addEventListener('unlock', () => {
        isFPSMode = false;
        orbit.enabled = true;
        transformControl.enabled = true;
        if(selectedObject) transformControl.visible = true;
        window.dispatchEvent(new CustomEvent('cameraModeChanged', { detail: 'Construcción' }));
        
        // Reiniciar movimiento al salir
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    });

    let isShiftDown = false;
    window.addEventListener('keydown', e => { 
        if(e.shiftKey) isShiftDown = true; 
        
        // Alternar modo de cámara con ESPACIO
        if (e.code === 'Space') {
            if (document.activeElement.tagName === 'INPUT') return;
            e.preventDefault();
            if (!isFPSMode) {
                fpsControls.lock();
            } else {
                fpsControls.unlock();
            }
        }

        if(isFPSMode) {
            switch (e.code) {
                case 'KeyW': moveForward = true; break;
                case 'KeyA': moveLeft = true; break;
                case 'KeyS': moveBackward = true; break;
                case 'KeyD': moveRight = true; break;
                // Vuelo extra con Q y E opcional
                case 'KeyE': velocity.y = 20; break;
                case 'KeyQ': velocity.y = -20; break;
            }
        }
    });
    
    window.addEventListener('keyup', e => { 
        if(!e.shiftKey) isShiftDown = false; 
        
        if(isFPSMode) {
            switch (e.code) {
                case 'KeyW': moveForward = false; break;
                case 'KeyA': moveLeft = false; break;
                case 'KeyS': moveBackward = false; break;
                case 'KeyD': moveRight = false; break;
                case 'KeyE':
                case 'KeyQ': velocity.y = 0; break;
            }
        }
    });

    // Transform Controls
    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function (event) {
        orbit.enabled = !event.value;
        if (event.value && isShiftDown && transformControl.getMode() === 'translate') {
            cloneSelectedObject();
        }
    });
    
    // Snapping Logic
    transformControl.setTranslationSnap(snapValue);
    transformControl.setScaleSnap(snapValue);
    transformControl.setRotationSnap(Math.PI / 12);
    transformControl.addEventListener('change', () => {
        // Disparar evento para actualizar UI (escala local live)
        if(selectedObject) window.dispatchEvent(new CustomEvent('objectTransformed', { detail: selectedObject }));
        render();
    });
    scene.add(transformControl);

    // Raycaster for selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return; // Only left click
        if (transformControl.dragging) return;
        if (isFPSMode) return; // Desactivar selección en modo FPS

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
        const delta = clock.getDelta();

        if (isFPSMode) {
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;
            velocity.y -= velocity.y * 10.0 * delta; // Friction for vertical flight

            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize(); // consistent movement in all directions

            const speed = 40.0;
            if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
            if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

            fpsControls.moveRight(-velocity.x * delta);
            fpsControls.moveForward(-velocity.z * delta);
            fpsControls.getObject().position.y += (velocity.y * delta);
        } else {
            orbit.update();
        }

        renderer.render(scene, camera);
    });
}

function render() {
    renderer.render(scene, camera);
}

export function setSnapValue(value) {
    snapValue = parseFloat(value);
    if (transformControl) {
        transformControl.setTranslationSnap(snapValue);
        transformControl.setScaleSnap(snapValue);
    }
}

export function setTransformMode(mode) {
    transformControl.setMode(mode);
}

export function addObjectToScene(mesh) {
    if (mesh.userData.id === undefined) {
        mesh.userData.id = getNextObjectId();
    }
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

export function cloneSelectedObject() {
    if (!selectedObject) return null;
    
    const clone = selectedObject.clone();
    clone.material = selectedObject.material.clone(); // Deep copy material
    clone.userData = JSON.parse(JSON.stringify(selectedObject.userData)); // Deep copy userData
    clone.userData.id = getNextObjectId(); // Assign new ID
    
    // Add to scene but keep the TransformControls attached to the current object
    scene.add(clone);
    interactableObjects.push(clone);
    
    // If we want Ctrl+D to select the new clone, we can do that in UIManager
    return clone;
}
