/**
 * ============================================================================
 * COMBATANT.JS - BASE CLASS VÀ CÁC THỰC THỂ PLAYER, ENEMY
 * Bao gồm quản lý chỉ số sinh tồn (HP, MP, SP), Giáp AC, Tấn công & Bí kỹ
 * ============================================================================
 */

import { Dice, DiceRoller } from './Dice.js';
import { SKILLS_DATABASE } from '../data/database.js';

export class Combatant {
  /**
   * @param {Object} config Thông số khởi tạo nhân vật
   */
  constructor({
    name = 'Vô Danh',
    avatar = '👤',
    hp = 30,
    maxHp = 30,
    mp = 15,
    maxMp = 15,
    sp = 10,
    maxSp = 10,
    ac = 10,
    attackMod = 2,
    damageDice = '1d8',
    canBlock = false,
    canCounter = false
  }) {
    this.name = name;
    this.avatar = avatar;
    this.hp = hp;
    this.maxHp = maxHp;
    this.mp = mp;
    this.maxMp = maxMp;
    this.sp = sp;
    this.maxSp = maxSp;
    this.ac = ac;
    this.attackMod = attackMod;
    this.damageDice = damageDice;
    this.canBlock = canBlock;
    this.canCounter = canCounter;
    this.hasReaction = true; // Hồi lại vào đầu mỗi lượt của mình

    // HỆ THỐNG TRẠNG THÁI BUFF / DEBUFF
    this.activeEffects = []; // Mảng chứa: [{ id: 'burn', duration: 3, value: 5 }]
  }

  /**
   * Áp dụng trạng thái Buff hoặc Debuff lên nhân vật
   * @param {string} effectId ID từ STATUS_EFFECTS
   * @param {number} duration Số hiệp duy trì
   * @param {number} value Giá trị hiệu lực (Sát thương DoT, Lượng hồi máu, hoặc % biến đổi)
   */
  applyEffect(effectId, duration = 2, value = 0) {
    if (!effectId) return;
    if (!Array.isArray(this.activeEffects)) this.activeEffects = [];

    const existing = this.activeEffects.find(e => e.id === effectId);
    if (existing) {
      // Cộng dồn thời gian (duration) và giữ giá trị value lớn hơn
      existing.duration += duration;
      if (value > existing.value) existing.value = value;
    } else {
      this.activeEffects.push({
        id: effectId,
        duration: Math.max(1, duration),
        value: Number(value) || 0
      });
    }
  }

  /**
   * Xóa một trạng thái cụ thể
   */
  removeEffect(effectId) {
    if (!Array.isArray(this.activeEffects)) return false;
    const initialLen = this.activeEffects.length;
    this.activeEffects = this.activeEffects.filter(e => e.id !== effectId);
    return this.activeEffects.length < initialLen;
  }

  /**
   * Lấy chi tiết trạng thái đang hiệu lực
   */
  getEffect(effectId) {
    if (!Array.isArray(this.activeEffects)) return null;
    return this.activeEffects.find(e => e.id === effectId) || null;
  }

  /**
   * Kiểm tra xem nhân vật có đang mang trạng thái nào không
   */
  hasEffect(effectId) {
    return !!this.getEffect(effectId);
  }

  /**
   * Xóa toàn bộ trạng thái đang mang
   */
  clearAllEffects() {
    this.activeEffects = [];
  }

  isAlive() {
    return this.hp > 0;
  }

  /**
   * Hồi phục máu
   */
  healHp(amount) {
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - prev;
  }

  /**
   * Hồi phục Mana
   */
  restoreMp(amount) {
    const prev = this.mp;
    this.mp = Math.min(this.maxMp, this.mp + amount);
    return this.mp - prev;
  }

  /**
   * Hồi phục Thể lực (Stamina)
   */
  restoreSp(amount) {
    const prev = this.sp;
    this.sp = Math.min(this.maxSp, this.sp + amount);
    return this.sp - prev;
  }

  /**
   * Trừ Thể lực (Stamina)
   */
  spendSp(amount) {
    if (this.sp < amount) return false;
    this.sp -= amount;
    return true;
  }

  /**
   * Nhận sát thương trực tiếp
   */
  takeDamage(amount) {
    const actual = Math.max(0, amount);
    this.hp = Math.max(0, this.hp - actual);
    return actual;
  }

  /**
   * Khởi đầu hiệp mới: đặt lại lượt phản ứng (Reaction)
   */
  startTurn() {
    this.hasReaction = true;
  }

  /**
   * Đặt lại phản ứng vào đầu lượt
   */
  refreshReaction() {
    this.hasReaction = true;
  }

  /**
   * Thực hiện đòn tấn công cơ bản (kèm xúc xắc 3D)
   * @param {Combatant} target Mục tiêu
   * @returns {Promise<Object>}
   */
  async attack(target) {
    const d20 = await DiceRoller.rollWith3DAnimation(
      `ĐỔ D20 TẤN CÔNG: ${this.name.toUpperCase()}`,
      `${this.name} đang vung đòn về phía ${target.name}`
    );

    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const totalAttackRoll = d20 + this.attackMod;
    const isHit = !isFumble && (isCrit || totalAttackRoll >= target.ac);

    let rawDamage = 0;
    let notationRoll = { total: 0, rolls: [] };

    if (isHit) {
      notationRoll = Dice.rollNotation(this.damageDice);
      rawDamage = notationRoll.total + this.attackMod;
      if (isCrit) {
        // Critical nhân đôi xúc xắc sát thương theo chuẩn D&D
        const extraCrit = Dice.rollNotation(this.damageDice);
        rawDamage += extraCrit.total;
      }
    }

    return {
      attacker: this,
      target,
      d20,
      totalAttackRoll,
      isHit,
      isCrit,
      isFumble,
      rawDamage: Math.max(1, rawDamage),
      damageRolls: notationRoll.rolls
    };
  }

  /**
   * Thi triển Kỹ năng (Skill)
   * @param {string} skillId ID của kỹ năng
   * @param {Combatant} target Mục tiêu
   * @returns {Promise<Object>}
   */
  async castSkill(skillId, target) {
    const skill = SKILLS_DATABASE[skillId];
    if (!skill) throw new Error(`Không tìm thấy kỹ năng: ${skillId}`);

    const hasFreeCast = (typeof this.hasEffect === 'function') && this.hasEffect('free_cast');
    let wasFreeCast = false;

    if (!hasFreeCast) {
      if (this.mp < skill.mpCost) {
        return { success: false, reason: 'Không đủ Mana (MP)!' };
      }
      if (this.sp < skill.spCost) {
        return { success: false, reason: 'Không đủ Thể lực (SP)!' };
      }

      // Trừ tài nguyên
      this.mp -= skill.mpCost;
      if (skill.spCost > 0) {
        this.sp -= skill.spCost;
      }
    } else {
      wasFreeCast = true;
      this.removeEffect('free_cast');
    }

    // Helper áp dụng Status Effect nếu kỹ năng có cấu hình applyEffect
    const triggerSkillEffect = () => {
      if (skill.applyEffect) {
        const isSelf = skill.applyEffect.target === 'self';
        const effTarget = isSelf ? this : target;
        effTarget.applyEffect(skill.applyEffect.id, skill.applyEffect.duration, skill.applyEffect.value || 0);
        return { ...skill.applyEffect, appliedTo: isSelf ? 'self' : 'target' };
      }
      return null;
    };

    // 0.0. Kỹ năng Khai Mở Vùng Môi Trường / Địa Hình (Field / Domain)
    if (skill.type === 'field') {
      const appliedEffect = triggerSkillEffect();
      return {
        success: true,
        skill,
        type: 'field',
        setField: skill.setField,
        fieldDuration: skill.fieldDuration,
        appliedEffect,
        wasFreeCast
      };
    }

    // 0. Kỹ năng Buff Hỗ Trợ (Warcry, Berserk, Frost Armor, Smoke Bomb...)
    if (skill.type === 'buff') {
      let selfDmg = 0;
      if (skill.selfDamagePercent) {
        selfDmg = Math.max(1, Math.round(this.hp * (skill.selfDamagePercent / 100)));
        this.takeDamage(selfDmg);
      }
      if (skill.blockBonus) {
        this.block = (this.block || 0) + skill.blockBonus;
      }
      const appliedEffect = triggerSkillEffect();
      return {
        success: true,
        skill,
        type: 'buff',
        selfDamage: selfDmg,
        blockBonus: skill.blockBonus || 0,
        appliedEffect,
        wasFreeCast
      };
    }

    // 1. Kỹ năng Hồi Máu
    if (skill.type === 'heal') {
      const roll = Dice.rollNotation(skill.healDice);
      const healAmount = roll.total + (skill.healBonus || 0);
      const actualHealed = this.healHp(healAmount);
      const appliedEffect = triggerSkillEffect();
      return {
        success: true,
        skill,
        type: 'heal',
        amount: actualHealed,
        rolls: roll.rolls,
        appliedEffect,
        wasFreeCast
      };
    }

    // 2. Kỹ năng Xuyên Giáp (Không cần roll hit, trúng luôn)
    if (skill.type === 'pierce') {
      const roll = Dice.rollNotation(skill.damageDice);
      const totalDmg = roll.total + (skill.flatDamage || 0);
      const dealt = target.takeDamage(totalDmg);
      const appliedEffect = triggerSkillEffect();
      return {
        success: true,
        skill,
        type: 'pierce',
        amount: dealt,
        rolls: roll.rolls,
        appliedEffect,
        wasFreeCast
      };
    }

    // 2.5 Kỹ năng Sát thương theo Giáp Ảo (Block Scaling - Khiên Phá Kích / Shield Bash)
    if (skill.type === 'block_scaling' || skill.id === 'shield_bash') {
      const currentBlock = Math.round(this.block || 0);
      const totalDmg = Math.max(4, currentBlock);
      const dealt = target.takeDamage(totalDmg);
      const appliedEffect = triggerSkillEffect();
      return {
        success: true,
        skill,
        type: 'block_scaling',
        amount: dealt,
        blockUsed: currentBlock,
        appliedEffect,
        wasFreeCast
      };
    }

    // 3. Kỹ năng Gây Sát Thương Cao (Damage)
    const d20 = await DiceRoller.rollWith3DAnimation(
      `BÍ KỸ: ${skill.name.toUpperCase()}`,
      `${this.name} xuất chiêu tất sát nhắm vào ${target.name}!`
    );

    const bonus = (this.attackMod || 0) + (skill.bonusAtk || 0);
    const totalRoll = d20 + bonus;
    const isHit = d20 === 20 || (d20 !== 1 && totalRoll >= target.ac);

    let damage = 0;
    if (isHit) {
      const roll = Dice.rollNotation(skill.damageDice);
      damage = roll.total + this.attackMod;
      if (d20 === 20) {
        damage += Dice.rollNotation(skill.damageDice).total;
      }
      target.takeDamage(damage);
    }

    let appliedEffect = null;
    if (isHit) {
      appliedEffect = triggerSkillEffect();
    }

    return {
      success: true,
      skill,
      type: 'damage',
      d20,
      totalRoll,
      isHit,
      isCrit: d20 === 20,
      amount: damage,
      appliedEffect,
      wasFreeCast
    };
  }
}

/**
 * LỚP ĐẠI DIỆN CHO NGƯỜI CHƠI (PLAYER)
 */
export class Player extends Combatant {
  constructor(name = 'Hiệp Sĩ Dũng Cảm', gold = 50) {
    super({
      name,
      avatar: '🛡️',
      hp: 30,
      maxHp: 30,
      mp: 15,
      maxMp: 15,
      sp: 10,
      maxSp: 10,
      ac: 13,
      attackMod: 2,
      damageDice: '1d8',
      canBlock: true,
      canCounter: true
    });

    this.gold = Math.max(0, gold);
    this.curses = []; // Hệ thống Lời Nguyền
    this.comboPoints = 0; // Hệ thống Điểm Liên Kích (Thief / Rogue)
    this.maxComboPoints = 5;
    this.arcaneCharges = 0; // Hệ thống Quá Tải Ma Thuật (Mage)
    this.maxArcaneCharges = 3;
    this.rage = 0; // Hệ thống Nộ Khí (Warrior / Knight)
    this.maxRage = 100;
    this.berserkTurns = 0; // Số hiệp Điên Cuồng còn lại
    this.skillPoints = 1;  // Điểm Kỹ Năng (Khởi đầu 1 điểm, nhặt tối đa 3 từ Tinh Anh)
    this.earnedSkillPoints = 0;
    this.skills = ['heavy_strike'];
    this.attackSpCost = 2; // Chi phí Thể lực cho 1 đòn tấn công thường
    this.blockSpCost = 3;  // Chi phí Thể lực để giơ khiên Đỡ Đòn khi bị đánh trúng
    this.restSpRecovery = 3; // Lượng SP hồi lại khi bấm [Nghỉ Ngơi]
  }

  addRage(amount = 10) {
    if (this.classId === 'warrior' || this.classId === 'knight' || !this.classId) {
      if (this.berserkTurns > 0) return this.rage;
      this.rage = Math.min(this.maxRage, (this.rage || 0) + amount);
      if (this.rage >= this.maxRage) {
        this.enterBerserk();
      }
      return this.rage;
    }
    return 0;
  }

  enterBerserk(duration = 3) {
    this.berserkTurns = duration;
    this.rage = this.maxRage;
    return true;
  }

  isBerserk() {
    return (this.berserkTurns || 0) > 0;
  }

  tickBerserk() {
    if (this.berserkTurns > 0) {
      this.berserkTurns -= 1;
      if (this.berserkTurns <= 0) {
        this.berserkTurns = 0;
        this.rage = 0;
        return 'expired';
      }
      return 'active';
    }
    return 'none';
  }

  addComboPoint(amount = 1) {
    if (this.classId === 'thief' || this.classId === 'rogue') {
      this.comboPoints = Math.min(this.maxComboPoints, (this.comboPoints || 0) + amount);
      return this.comboPoints;
    }
    return 0;
  }

  spendComboPoints() {
    const pts = this.comboPoints || 0;
    this.comboPoints = 0;
    return pts;
  }

  addArcaneCharge(amount = 1) {
    if (this.classId === 'mage') {
      this.arcaneCharges = Math.min(this.maxArcaneCharges, (this.arcaneCharges || 0) + amount);
      return this.arcaneCharges;
    }
    return 0;
  }

  isOvercharged() {
    return this.classId === 'mage' && (this.arcaneCharges >= this.maxArcaneCharges);
  }

  consumeOvercharge() {
    if (this.isOvercharged()) {
      this.arcaneCharges = 0;
      return true;
    }
    return false;
  }

  addCurse(curseId) {
    if (!curseId) return false;
    if (!Array.isArray(this.curses)) this.curses = [];
    if (!this.curses.includes(curseId)) {
      this.curses.push(curseId);
      return true;
    }
    return false;
  }

  removeCurse(curseId) {
    if (!Array.isArray(this.curses)) return false;
    const initialLen = this.curses.length;
    this.curses = this.curses.filter(c => c !== curseId);
    return this.curses.length < initialLen;
  }

  hasCurse(curseId) {
    return Array.isArray(this.curses) && this.curses.includes(curseId);
  }

  clearRandomCurse() {
    if (!Array.isArray(this.curses) || this.curses.length === 0) return null;
    const randIdx = Math.floor(Math.random() * this.curses.length);
    return this.curses.splice(randIdx, 1)[0];
  }

  getShopPriceMultiplier() {
    return this.hasCurse('greed_curse') ? 1.5 : 1.0;
  }

  addGold(amount) {
    const val = Math.max(0, Math.floor(amount));
    this.gold += val;
    return val;
  }

  spendGold(amount) {
    const val = Math.max(0, Math.floor(amount));
    if (this.gold < val) return false;
    this.gold -= val;
    return true;
  }

  hasGold(amount) {
    return this.gold >= amount;
  }

  /**
   * Nghỉ ngơi trong lượt để hồi 3 SP
   */
  restTurn() {
    return this.restoreSp(this.restSpRecovery);
  }
}

/**
 * LỚP ĐẠI DIỆN CHO QUÁI VẬT (ENEMY)
 * QUY TẮC BẮT BUỘC: Quái vật canBlock = false, canCounter = false, không tốn SP.
 */
export class Enemy extends Combatant {
  constructor(config) {
    super({
      ...config,
      sp: 0,
      maxSp: 0,
      canBlock: false,
      canCounter: false
    });
    this.type = config.type || 'normal';
    this.monsterType = this.type;
    this.modifiers = []; // Danh sách các đột biến (Enemy Affixes/Modifiers)
    this.baseName = config.name || this.name;
    this.hasBeenRobbed = false; // Đã từng bị Đạo Tặc móc túi chưa
  }

  addModifier(modKey) {
    if (!modKey) return;
    if (!Array.isArray(this.modifiers)) this.modifiers = [];
    if (!this.modifiers.includes(modKey)) {
      this.modifiers.push(modKey);
    }
  }

  hasModifier(modKey) {
    return Array.isArray(this.modifiers) && this.modifiers.includes(modKey);
  }
}
