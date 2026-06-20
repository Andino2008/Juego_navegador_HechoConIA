import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class WeaponManager {
    constructor(leftArmGroup) {
        this.leftArmGroup = leftArmGroup; // Referencia al brazo izquierdo para animar puñetazos
        this.rightArmGroup = new THREE.Group();
        this.swordMesh = null;
        
        this.isAttacking = false;
        this.attackTimer = 0;
        this.comboStep = 1;
        this.currentPunch = 'right';
        this.currentWeapon = 'fists';
        
        this.baseRightPosition = new THREE.Vector3(0.4, -0.5, -0.8);
        this.baseRightRotation = new THREE.Euler(0, 0, 0);
        this.baseLeftPosition = new THREE.Vector3(-0.4, -0.5, -0.8);
        
        this.buildArms();
        this.loadGLTFSword();
        
        this.rightArmGroup.position.copy(this.baseRightPosition);
    }
    
    buildArms() {
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x8c7a6b, depthTest: false, depthWrite: false });
        const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a, depthTest: false, depthWrite: false });
        
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), sleeveMat); 
        rArm.rotation.x = Math.PI / 2; rArm.renderOrder = 999;
        const rFist = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), skinMat); 
        rFist.position.z = -0.3; rFist.renderOrder = 999;
        
        this.rightArmGroup.add(rArm, rFist);
    }
    
    loadGLTFSword() {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load('./assets/15th_century_long_sword.glb', (gltf) => {
            this.swordMesh = gltf.scene;
            
            this.swordMesh.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        child.material = child.material.clone();
                        child.material.depthTest = false;
                        child.material.depthWrite = false;
                    }
                    child.renderOrder = 999;
                }
            });

            // Ajustes calibrados de la espada original
            this.swordMesh.scale.set(2.7, 2.7, 2.7); 
            // Posición relativa al brazo derecho
            this.swordMesh.position.set(0, 0.05, -0.25); 
            this.swordMesh.rotation.set(Math.PI / 2.2, Math.PI / 2 - 0.3, 0.4); 

            this.rightArmGroup.add(this.swordMesh);
            this.swordMesh.visible = false; // Oculta hasta que se equipe
        });
    }
    
    attack(comboStep, hasSword) {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackTimer = 0;
        this.comboStep = comboStep;
        this.currentWeapon = hasSword ? 'sword' : 'fists';
        if (!hasSword) {
            this.currentPunch = this.currentPunch === 'left' ? 'right' : 'left';
        }
    }
    
    update(delta, time, isMoving, hasSword) {
        // Toggle visual del arma
        if (this.swordMesh) {
            this.swordMesh.visible = hasSword;
        }

        if (this.isAttacking) {
            this.attackTimer += delta;
            const tTotal = 0.3; // Duración total del ataque
            
            if (this.attackTimer < tTotal) {
                const progress = this.attackTimer / tTotal;
                const swing = Math.sin(progress * Math.PI); // Curva de latigazo suave
                
                if (this.currentWeapon === 'sword') {
                    // ANIMACIÓN ESTILO COMBO (3 Pasos)
                    if (this.comboStep === 1) {
                        this.rightArmGroup.rotation.x = swing * 1.2;
                        this.rightArmGroup.rotation.y = swing * 0.5;
                        this.rightArmGroup.rotation.z = swing * 0.8;
                        this.rightArmGroup.position.z = this.baseRightPosition.z - swing * 0.4;
                    } else if (this.comboStep === 2) {
                        const swing2 = Math.sin(progress * Math.PI * 2); 
                        this.rightArmGroup.rotation.x = swing * 1.2;
                        this.rightArmGroup.rotation.y = -swing2 * 0.8;
                        this.rightArmGroup.position.z = this.baseRightPosition.z - swing * 0.4;
                    } else {
                        // Estocada fuerte
                        this.rightArmGroup.rotation.x = swing * 1.5;
                        this.rightArmGroup.position.z = this.baseRightPosition.z - swing * 1.5;
                        this.rightArmGroup.position.y = this.baseRightPosition.y + swing * 0.3;
                        this.rightArmGroup.position.x = this.baseRightPosition.x - swing * 0.2;
                    }
                } else {
                    // PUÑOS (Alternando brazos)
                    if (this.currentPunch === 'left') {
                        this.leftArmGroup.position.z = this.baseLeftPosition.z - swing * 0.7;
                    } else {
                        this.rightArmGroup.position.z = this.baseRightPosition.z - swing * 0.7;
                    }
                }
            } else {
                // Recuperación instantánea al terminar
                this.isAttacking = false;
                this.rightArmGroup.position.copy(this.baseRightPosition);
                this.rightArmGroup.rotation.copy(this.baseRightRotation);
                this.leftArmGroup.position.copy(this.baseLeftPosition);
                this.leftArmGroup.rotation.set(0, 0, 0);
            }
        } else {
            // IDLE SWAY (Respiración)
            const swaySpeed = isMoving ? 12 : 3;
            const swayAmountY = isMoving ? 0.04 : 0.01;
            const swayY = Math.sin(time * swaySpeed) * swayAmountY;
            
            // Suavizamos el balanceo
            this.rightArmGroup.position.y = THREE.MathUtils.lerp(this.rightArmGroup.position.y, this.baseRightPosition.y + swayY, delta * 10);
            this.leftArmGroup.position.y = THREE.MathUtils.lerp(this.leftArmGroup.position.y, this.baseLeftPosition.y + swayY, delta * 10);
            
            this.rightArmGroup.position.x = this.baseRightPosition.x;
            this.rightArmGroup.position.z = this.baseRightPosition.z;
            this.rightArmGroup.rotation.copy(this.baseRightRotation);
            
            this.leftArmGroup.position.x = this.baseLeftPosition.x;
            this.leftArmGroup.position.z = this.baseLeftPosition.z;
            this.leftArmGroup.rotation.set(0, 0, 0);
        }
    }
}
