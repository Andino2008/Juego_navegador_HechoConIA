import * as THREE from 'three';
import { state, checkMapCollision, addXP, takeDamage } from './state.js';

export class Enemy {
    constructor(id, position, hp) {
        this.id = id; this.hp = hp; this.maxHp = hp;
        this.isDead = false; this.mesh = null;
        this.flashTimer = 0; this.baseColor = 0xffffff;
        this.velocity = new THREE.Vector3();
        this.xpValue = 0;
    }
    
    receiveDamage(amount, sourcePos = null) {
        if (this.isDead) return;
        this.hp -= amount;
        this.flashTimer = 0.1;
        
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
        const flashColor = this.flashTimer > 0 ? 0xff0000 : this.baseColor;
        if (this.flashTimer > 0) this.flashTimer -= delta;

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
        this.baseColor = 0x3e5c32; this.speed = 2.0; this.attackCooldown = 0.0; this.xpValue = 35;
        this.mesh = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: this.baseColor });
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 8), mat); body.position.y = 1.0;
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6), mat); lArm.rotation.x = Math.PI/2; lArm.position.set(-0.7, 1.4, -0.4);
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6), mat); rArm.rotation.x = Math.PI/2; rArm.position.set(0.7, 1.4, -0.4);
        
        this.mesh.add(body, lArm, rArm);
        this.mesh.position.copy(position);
    }

    update(delta, time, playerPos) {
        super.update(delta, time, playerPos); 
        if (this.isDead) return;
        const dist = this.mesh.position.distanceTo(playerPos);
        
        if (dist < 15.0) {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
            if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - delta);

            if (dist > 1.8) {
                const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
                const newX = this.mesh.position.x + dir.x * this.speed * delta;
                const newZ = this.mesh.position.z + dir.z * this.speed * delta;
                if (!checkMapCollision(newX, this.mesh.position.z)) this.mesh.position.x = newX;
                if (!checkMapCollision(this.mesh.position.x, newZ)) this.mesh.position.z = newZ;
            } else if (this.attackCooldown <= 0) {
                takeDamage(15);
                this.attackCooldown = 1.5;
            }
        }
    }
}