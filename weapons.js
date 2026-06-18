export class Weapon {
    constructor(name, range, damageCombo1, damageCombo2, damageCombo3) {
        this.name = name;
        this.range = range;
        this.damageCombo1 = damageCombo1;
        this.damageCombo2 = damageCombo2;
        this.damageCombo3 = damageCombo3;
    }
}

export const fistsWeapon = new Weapon("Puños", 2.5, 10, 10, 10);
export const swordWeapon = new Weapon("Espada de Hierro", 4.0, 20, 25, 45);