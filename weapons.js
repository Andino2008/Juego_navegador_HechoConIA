export class Weapon {
    constructor(name, range, hitRadius, tAnticipation, tImpact, tRecovery, damageCombo1, damageCombo2, damageCombo3) {
        this.name = name;
        this.range = range;
        this.hitRadius = hitRadius; // Para ataques melee generosos (SphereCast/Cone)
        this.tAnticipation = tAnticipation;
        this.tImpact = tImpact;
        this.tRecovery = tRecovery;
        this.damageCombo1 = damageCombo1;
        this.damageCombo2 = damageCombo2;
        this.damageCombo3 = damageCombo3;
    }
}

// Fists: Rápido, poco daño, rango corto
export const fistsWeapon = new Weapon("Puños", 2.2, 0.8, 0.08, 0.12, 0.35, 10, 10, 10);
// Espada: Lenta, buen daño, barrido amplio (rango y radius grandes)
export const swordWeapon = new Weapon("Espada de Hierro", 4.0, 1.5, 0.12, 0.18, 0.50, 20, 25, 45);