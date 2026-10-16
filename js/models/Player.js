/**
 * ============================================================================
 * PLAYER.JS - MÔ HÌNH NHÂN VẬT NGƯỜI CHƠI (HIỆP SĨ)
 * Quản lý chỉ số sinh tồn (HP, MP, SP), Giáp AC, Tấn công & Tiền Vàng (Gold)
 * ============================================================================
 */

import { Combatant } from './Combatant.js';

export class Player extends Combatant {
  /**
   * @param {string} name Tên nhân vật
   * @param {number} gold Tiền vàng khởi đầu (mặc định 50)
   */
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
      canCounter: false
    });

    // Hệ thống Tiền Tệ
    this.gold = Math.max(0, gold);

    // Hệ thống Lời Nguyền (Curses)
    this.curses = [];

    // Hệ thống Điểm Liên Kích (Combo Points) dành cho Đạo Tặc / Sát Thủ (Thief / Rogue)
    this.comboPoints = 0;
    this.maxComboPoints = 5;

    // Hệ thống Quá Tải Ma Thuật (Arcane Overcharge) dành cho Pháp Sư (Mage)
    this.arcaneCharges = 0;
    this.maxArcaneCharges = 3;

    // Hệ thống Nộ Khí (Rage System) dành cho Chiến Binh / Kỵ Sĩ (Warrior / Knight)
    this.rage = 0;
    this.maxRage = 100;
    this.berserkTurns = 0;

    // Hệ thống Điểm Kỹ Năng (Skill Points - Khởi đầu 1 điểm, nhặt tối đa 3 điểm từ Tinh Anh)
    this.skillPoints = 1;
    this.earnedSkillPoints = 0;

    // Kỹ năng chiến đấu (Tối đa 4 kỹ năng: 1 mặc định + 3 học thêm)
    this.skills = ['heavy_strike'];
    this.attackSpCost = 2; // Chi phí Thể lực cho 1 đòn tấn công thường
    this.blockSpCost = 3;  // Chi phí Thể lực để giơ khiên Đỡ Đòn khi bị đánh trúng
    this.restSpRecovery = 3; // Lượng SP hồi lại khi bấm [Nghỉ Ngơi]
  }

  /**
   * Tăng Nộ Khí cho Chiến Binh (Warrior)
   * @param {number} amount
   * @returns {number} Điểm nộ khí hiện tại
   */
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

  /**
   * Tăng Điểm Liên Kích (Combo Points) cho Đạo Tặc / Sát Thủ
   * @param {number} amount
   * @returns {number} Số điểm combo hiện tại
   */
  addComboPoint(amount = 1) {
    if (this.classId === 'thief' || this.classId === 'rogue') {
      this.comboPoints = Math.min(this.maxComboPoints, (this.comboPoints || 0) + amount);
      return this.comboPoints;
    }
    return 0;
  }

  /**
   * Tiêu hao và reset Điểm Liên Kích
   * @returns {number} Số điểm combo đã tiêu hao
   */
  spendComboPoints() {
    const pts = this.comboPoints || 0;
    this.comboPoints = 0;
    return pts;
  }

  /**
   * Tích tụ Tinh Thể Quá Tải (Arcane Charges) cho Pháp Sư khi cast skill tiêu hao MP
   * @param {number} amount
   * @returns {number} Số tinh thể hiện tại
   */
  addArcaneCharge(amount = 1) {
    if (this.classId === 'mage') {
      this.arcaneCharges = Math.min(this.maxArcaneCharges, (this.arcaneCharges || 0) + amount);
      return this.arcaneCharges;
    }
    return 0;
  }

  /**
   * Kiểm tra Pháp sư có đang ở trạng thái Quá Tải Ma Thuật (Overcharge) không
   * @returns {boolean}
   */
  isOvercharged() {
    return this.classId === 'mage' && (this.arcaneCharges >= this.maxArcaneCharges);
  }

  /**
   * Tiêu hao trạng thái Quá Tải và reset tinh thể về 0
   * @returns {boolean} True nếu vừa tiêu hao thành công
   */
  consumeOvercharge() {
    if (this.isOvercharged()) {
      this.arcaneCharges = 0;
      return true;
    }
    return false;
  }

  /**
   * Kiểm tra người chơi có sở hữu nội tại Bậc Thầy Cận Chiến (passive_counter) hay không
   * @param {InventoryManager} inventoryManager 
   * @returns {boolean}
   */
  hasPassiveCounter(inventoryManager) {
    if (this.skills && this.skills.includes('passive_counter')) return true;
    if (this.passives && this.passives.includes('passive_counter')) return true;
    if (this.relics && this.relics.includes('passive_counter')) return true;
    if (this.classId === 'warrior' || this.classId === 'knight') return true;
    if (inventoryManager && inventoryManager.backpack && inventoryManager.backpack.some(i => i && i.id === 'passive_counter')) return true;
    return false;
  }

  /**
   * Thêm 1 Lời Nguyền vào nhân vật
   * @param {string} curseId ID lời nguyền từ CURSES_DATABASE
   * @returns {boolean} True nếu được nhận mới
   */
  addCurse(curseId) {
    if (!curseId) return false;
    if (!Array.isArray(this.curses)) this.curses = [];
    if (!this.curses.includes(curseId)) {
      this.curses.push(curseId);
      return true;
    }
    return false;
  }

  /**
   * Gỡ bỏ 1 Lời Nguyền chỉ định
   * @param {string} curseId
   * @returns {boolean}
   */
  removeCurse(curseId) {
    if (!Array.isArray(this.curses)) return false;
    const initialLen = this.curses.length;
    this.curses = this.curses.filter(c => c !== curseId);
    return this.curses.length < initialLen;
  }

  /**
   * Kiểm tra người chơi có đang dính Lời Nguyền này không
   * @param {string} curseId
   * @returns {boolean}
   */
  hasCurse(curseId) {
    return Array.isArray(this.curses) && this.curses.includes(curseId);
  }

  /**
   * Xóa ngẫu nhiên 1 Lời Nguyền (dùng cho Lửa Trại / Dịch vụ Thanh Tẩy)
   * @returns {string|null} ID của lời nguyền vừa được thanh tẩy
   */
  clearRandomCurse() {
    if (!Array.isArray(this.curses) || this.curses.length === 0) return null;
    const randIdx = Math.floor(Math.random() * this.curses.length);
    const removed = this.curses.splice(randIdx, 1)[0];
    return removed;
  }

  /**
   * Hệ số giá hàng hóa ở Shop (tăng 50% nếu dính Lời Nguyền Tham Lam)
   * @returns {number}
   */
  getShopPriceMultiplier() {
    return this.hasCurse('greed_curse') ? 1.5 : 1.0;
  }

  /**
   * Cộng tiền vàng khi nhặt được hoặc bán đồ
   * @param {number} amount Lượng vàng nhận được
   * @returns {number}
   */
  addGold(amount) {
    const val = Math.max(0, Math.floor(amount));
    this.gold += val;
    return val;
  }

  /**
   * Tiêu tiền vàng (mua đồ ở Shop, đổi đồ sự kiện)
   * @param {number} amount Lượng vàng cần tiêu
   * @returns {boolean} True nếu đủ tiền và đã trừ
   */
  spendGold(amount) {
    const val = Math.max(0, Math.floor(amount));
    if (this.gold < val) return false;
    this.gold -= val;
    return true;
  }

  /**
   * Kiểm tra người chơi có đủ tiền hay không
   * @param {number} amount
   * @returns {boolean}
   */
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
