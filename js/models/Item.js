/**
 * ============================================================================
 * ITEM.JS - MÔ HÌNH VẬT PHẨM (WEAPON, ARMOR, SHIELD, CONSUMABLE)
 * Bổ sung: Thuộc tính giá tiền (price) và cờ vật phẩm độc quyền Shop (isShopExclusive)
 * ============================================================================
 */

export class Item {
  /**
   * @param {Object} data Dữ liệu vật phẩm từ database
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type; // 'weapon' | 'armor' | 'shield' | 'consumable' | 'relic'
    this.icon = data.icon || '📦';
    this.desc = data.desc || '';
    this.rarity = data.rarity || 'common'; // 'common' | 'rare' | 'epic' | 'legendary'

    // Giá tiền & Cờ độc quyền
    this.price = data.price || 0;
    this.isShopExclusive = !!data.isShopExclusive;
    this.isEliteExclusive = !!data.isEliteExclusive;
    this.isBossExclusive = !!data.isBossExclusive;

    // Thuộc tính Cổ vật (Relic Passive)
    this.passive = data.passive || null;

    // Chỉ số trang bị
    this.attackMod = data.attackMod || 0;
    this.damageDice = data.damageDice || null;
    this.armorClass = data.armorClass || null;
    this.bonusAC = data.bonusAC || 0;
    this.blockDice = data.blockDice || null;
    this.canCounter = !!data.canCounter;

    // Phân loại lớp nhân vật & Hiệu ứng đặc biệt
    this.classReq = data.classReq || 'all'; // 'warrior' | 'mage' | 'rogue' | 'all'
    this.onHitEffect = data.onHitEffect || null; // { id, duration, value, chance }
    this.applyEffect = data.applyEffect || null; // { id, duration, value, target }

    // Thuộc tính Build chuyên dụng
    this.critThreshold = data.critThreshold || 20;
    this.counterDamageBonus = data.counterDamageBonus || 0;
    this.combatStartEffect = data.combatStartEffect || null;
    this.onHitRestoreMp = data.onHitRestoreMp || 0;
    this.bonusDmgVsPoison = data.bonusDmgVsPoison || 0;
    this.onCritGainDodge = !!data.onCritGainDodge;

    // Chỉ số vật phẩm tiêu hao
    this.effectType = data.effectType || null; // 'heal_hp' | 'heal_mp' | 'heal_sp' | 'heal_all'
    this.value = data.value || 0;
    this.hpValue = data.hpValue || 0;
    this.mpValue = data.mpValue || 0;
    this.spValue = data.spValue || 0;
  }

  /**
   * Sử dụng bình thuốc / vật phẩm tiêu hao lên mục tiêu (Player hoặc ném vào Quái)
   * @param {Combatant} target Đối tượng kích hoạt
   * @param {Combatant|null} enemy Kẻ địch (dành cho bình ném)
   * @returns {{ success: boolean, message: string, appliedEffect?: Object, targetType?: string }}
   */
  use(target, enemy = null) {
    if (this.type !== 'consumable') {
      return { success: false, message: 'Vật phẩm này không thể uống hay sử dụng trực tiếp!' };
    }

    // 0. Xử lý vật phẩm áp dụng Trạng thái Buff / Debuff (Potions & Throwables)
    if (this.applyEffect) {
      const isTargetEnemy = this.applyEffect.target === 'enemy';
      const actualTarget = isTargetEnemy ? (enemy || target) : target;
      if (actualTarget && typeof actualTarget.applyEffect === 'function') {
        actualTarget.applyEffect(this.applyEffect.id, this.applyEffect.duration, this.applyEffect.value || 0);
        const actionVerb = isTargetEnemy ? 'ném' : 'dùng';
        const targetLabel = isTargetEnemy ? (actualTarget.name || 'kẻ địch') : 'bản thân';
        return {
          success: true,
          appliedEffect: this.applyEffect,
          targetType: isTargetEnemy ? 'enemy' : 'player',
          message: `${target.name} đã ${actionVerb} [${this.name}] lên ${targetLabel}, kích hoạt trạng thái [${this.applyEffect.id}] (${this.applyEffect.duration} hiệp)!`
        };
      }
    }

    if (this.effectType === 'heal_hp') {
      const healed = target.healHp(this.value);
      return {
        success: true,
        message: `${target.name} đã uống ${this.name}, hồi phục +${healed} HP!`
      };
    }

    if (this.effectType === 'heal_mp') {
      const restored = target.restoreMp(this.value);
      return {
        success: true,
        message: `${target.name} đã uống ${this.name}, hồi phục +${restored} MP!`
      };
    }

    if (this.effectType === 'heal_sp') {
      const restored = target.restoreSp(this.value);
      return {
        success: true,
        message: `${target.name} đã uống ${this.name}, hồi phục +${restored} Thể Lực (SP)!`
      };
    }

    if (this.effectType === 'heal_all') {
      const hHp = target.healHp(this.hpValue);
      const hMp = target.restoreMp(this.mpValue);
      const hSp = target.restoreSp(this.spValue);
      return {
        success: true,
        message: `${target.name} dùng ${this.name}, đại hồi phục +${hHp} HP, +${hMp} MP, +${hSp} SP!`
      };
    }

    return { success: false, message: 'Không thể kích hoạt hiệu ứng!' };
  }
}
