import * as THREE from 'three';
import { state, checkMapCollision, addXP, takeDamage } from './state.js';

export class Enemy {
    constructor(id, position, hp) {
        this.id = id; this.hp = hp; this.maxHp = hp;
        this.isDead = false; this.mesh = null;
        this.flashTimer = 0; this.baseColor = 0xffffff;
        this.velocity = new THREE.Vector3();
        this.xpValue = 0;
        
        // FSM & Hitbox
        this.aiState = 'idle';
        this.stateTimer = 0;
        this.hitboxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.5), new THREE.MeshBasicMaterial({visible: false}));
        this.hitboxMesh.enemyRef = this;
    }
    
    receiveDamage(amount, sourcePos = null) {
        if (this.isDead) return;
        this.hp -= amount;
        this.flashTimer = 0.1;
        
        // STAGGER INTERRUPT
        this.aiState = 'stagger';
        this.stateTimer = 0.4; // 400ms stun
        
        if (this.mesh && sourcePos) {
            const knockDir = new THREE.Vector3().subVectors(this.mesh.position, sourcePos).setY(0);
            if (knockDir.lengthSq() > 0.0001) {
                knockDir.normalize();
                const kbStrength = Math.min(8, Math.max(1, amount * 0.35));
                this.velocity.add(knockDir.multiplyScalar(kbStrength));
            }
        }

        if (this.hp <= 0) {
            this.isDead = true;
            if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
            addXP(this.xpValue);
        }
    }
    
    update(delta, time, playerPos) {
        if (this.isDead || !this.mesh) return;
        const flashColor = this.flashTimer > 0 ? 0xffffff : this.baseColor; // White flash instead of red for visibility
        if (this.flashTimer > 0) this.flashTimer -= delta;

        if (this.aiState === 'stagger') {
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.aiState = 'chase';
                this.baseColor = this.originalBaseColor || this.baseColor; // Reset telegraph color
            }
        }

        if (this.mesh.isGroup) {
            this.mesh.children.forEach(child => { if (child.material) child.material.color.setHex(flashColor); });
        } else if (this.mesh.material) {
            this.mesh.material.color.setHex(flashColor);
        }

        if (this.velocity.lengthSq() > 0.000001) {
            const moveX = this.velocity.x * delta;
            const moveZ = this.velocity.z * delta;
            if (!checkMapCollision(this.mesh.position.x + moveX, this.mesh.position.z)) this.mesh.position.x += moveX;
            if (!checkMapCollision(this.mesh.position.x, this.mesh.position.z + moveZ)) this.mesh.position.z += moveZ;
            this.velocity.multiplyScalar(Math.max(0, 1 - 6.0 * delta));
            if (this.velocity.length() < 0.01) this.velocity.set(0, 0, 0);
        }
    }
}

export class TrainingDummy extends Enemy {
    constructor(id, position) {
        super(id, position, 100);
        this.baseColor = 0x440000;
        this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshLambertMaterial({ color: this.baseColor }));
        this.mesh.add(this.hitboxMesh); // Attach hitbox
        this.mesh.position.copy(position);
        this.xpValue = 10;
        this.originY = position.y;
    }
    update(delta, time, playerPos) {
        super.update(delta, time, playerPos);
        if (this.isDead) return;
        this.mesh.position.y = this.originY + Math.sin(time / 500) * 0.2;
        this.mesh.rotation.y += delta;
    }
}

export class Zombie extends Enemy {
    constructor(id, position) {
        super(id, position, 150);
        this.baseColor = 0x3e5c32; this.originalBaseColor = 0x3e5c32; this.speed = 2.0; this.xpValue = 35;
        this.mesh = new THREE.Group();
        this.mesh.add(this.hitboxMesh); // Attach hitbox
        const mat = new THREE.MeshLambertMaterial({ color: this.baseColor });
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 8), mat); body.position.y = 1.0;
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6), mat); lArm.rotation.x = Math.PI/2; lArm.position.set(-0.7, 1.4, -0.4);
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6), mat); rArm.rotation.x = Math.PI/2; rArm.position.set(0.7, 1.4, -0.4);
        
        this.mesh.add(body, lArm, rArm);
        this.mesh.position.copy(position);
    }

    update(delta, time, playerPos) {
        super.update(delta, time, playerPos); 
        if (this.isDead || this.aiState === 'stagger') return; // Stagger congela a la IA
        
        const dist = this.mesh.position.distanceTo(playerPos);
        
        if (this.aiState === 'idle') {
            if (dist < 15.0) this.aiState = 'chase';
        } 
        else if (this.aiState === 'chase') {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
            if (dist > 1.8) {
                const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
                const newX = this.mesh.position.x + dir.x * this.speed * delta;
                const newZ = this.mesh.position.z + dir.z * this.speed * delta;
                if (!checkMapCollision(newX, this.mesh.position.z)) this.mesh.position.x = newX;
                if (!checkMapCollision(this.mesh.position.x, newZ)) this.mesh.position.z = newZ;
            } else {
                // Empezar a telegrafiar (0.6s de aviso)
                this.aiState = 'telegraph';
                this.stateTimer = 0.6; 
                this.baseColor = 0x882222; // Se enoja visualmente
            }
        }
        else if (this.aiState === 'telegraph') {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.aiState = 'attack';
                this.baseColor = this.originalBaseColor; 
                
                // Ataque real: si no esquivaste, te pega.
                if (dist < 2.5) { 
                    takeDamage(15);
                }
            }
        }
        else if (this.aiState === 'attack') {
            this.stateTimer = 1.0; // Cooldown post-ataque
            this.aiState = 'recovery';
        }
        else if (this.aiState === 'recovery') {
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.aiState = 'chase';
            }
        }
    }
}