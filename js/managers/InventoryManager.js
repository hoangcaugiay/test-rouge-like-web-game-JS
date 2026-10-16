/**
 * ============================================================================
 * INVENTORYMANAGER.JS - QUẢN LÝ TÚI ĐỒ VÀ TRANG BỊ
 * Bao gồm: Mặc/tháo vũ khí, giáp, khiên và dùng bình thuốc (hồi HP, MP, SP)
 * ============================================================================
 */

import { Item } from '../models/Item.js';
import { ITEMS_DATABASE } from '../data/database.js';

export class InventoryManager {
  /**
   * @param {Player} player Thực thể người chơi
   */
  constructor(player) {
    this.player = player;
    this.backpack = []; // Mảng các đối tượng Item
    this.maxCapacity = 16;
    this.selectedItemIndex = null;
    this.onCombatItemUsed = null; // Callback báo hiệu kết thúc lượt khi dùng bình thuốc trong trận đấu

    // Trang bị đang mặc
    this.equipped = {
      weapon: new Item(ITEMS_DATABASE.iron_sword),
      armor: new Item(ITEMS_DATABASE.leather_armor),
      shield: new Item(ITEMS_DATABASE.wood_shield)
    };

    // Khởi tạo đồ đạc khởi đầu trong túi
    this.initStarterItems();
    this.syncPlayerEquipmentStats();

    // Hỗ trợ render icon chuẩn cho toàn hệ thống
    window.formatItemIconHTML = InventoryManager.formatItemIconHTML;
  }

  /**
   * Đồ đạc cơ bản khi bắt đầu hành trình
   */
  initStarterItems() {
    this.addItem(new Item(ITEMS_DATABASE.health_potion));
    this.addItem(new Item(ITEMS_DATABASE.health_potion));
    this.addItem(new Item(ITEMS_DATABASE.mana_potion));
    this.addItem(new Item(ITEMS_DATABASE.stamina_potion));
  }

  /**
   * Khôi phục túi đồ từ dữ liệu nạp từ SaveManager
   * @param {{ equipped: Object, backpack: Item[] }} inventoryData 
   */
  restoreFromData(inventoryData) {
    if (!inventoryData) return;
    if (inventoryData.equipped) {
      this.equipped = inventoryData.equipped;
    }
    if (Array.isArray(inventoryData.backpack)) {
      this.backpack = inventoryData.backpack;
    }
    this.syncPlayerEquipmentStats();
    this.renderUI();
  }

  /**
   * Đăng ký callback khi dùng item trong combat (để kết thúc lượt)
   */
  setCombatUsageCallback(callback) {
    this.onCombatItemUsed = callback;
  }

  /**
   * Thêm vật phẩm vào túi đồ
   * @param {Item} item 
   * @returns {boolean}
   */
  addItem(item) {
    if (this.backpack.length >= this.maxCapacity) {
      return false;
    }
    this.backpack.push(item);
    return true;
  }

  /**
   * Đồng bộ chỉ số chiến đấu từ trang bị vào đối tượng Player
   */
  syncPlayerEquipmentStats() {
    // 1. Vũ khí
    if (this.equipped.weapon) {
      this.player.attackMod = this.equipped.weapon.attackMod || 2;
      this.player.damageDice = this.equipped.weapon.damageDice || '1d8';
    } else {
      this.player.attackMod = 1;
      this.player.damageDice = '1d4';
    }
    // Cơ chế phản công chỉ dành cho nhân vật có nội tại passive_counter
    this.player.canCounter = typeof this.player.hasPassiveCounter === 'function'
      ? this.player.hasPassiveCounter(this)
      : false;

    // 2. Giáp và Khiên
    const baseArmorAC = this.equipped.armor ? this.equipped.armor.armorClass : 10;
    const shieldBonus = this.equipped.shield ? this.equipped.shield.bonusAC : 0;
    this.player.ac = baseArmorAC + shieldBonus;
    this.player.canBlock = !!this.equipped.shield;
  }

  /**
   * Kiểm tra điều kiện Class trước khi mặc trang bị
   * @param {Item|Object} item
   * @returns {boolean}
   */
  canEquipItem(item) {
    if (!item) return false;
    // Chỉ kiểm tra trang bị (Vũ khí, Giáp thân, Khiên)
    if (!['weapon', 'armor', 'shield'].includes(item.type)) return true;
    if (!item.classReq || item.classReq === 'all') return true;
    const playerClass = this.player ? (this.player.classId || 'warrior') : 'warrior';
    if (item.classReq === playerClass) return true;
    // Hỗ trợ knight và warrior đồng nhất
    if ((item.classReq === 'knight' || item.classReq === 'warrior') && (playerClass === 'knight' || playerClass === 'warrior')) {
      return true;
    }
    // Hỗ trợ thief và rogue đồng nhất
    if ((item.classReq === 'thief' || item.classReq === 'rogue') && (playerClass === 'thief' || playerClass === 'rogue')) {
      return true;
    }
    return false;
  }

  /**
   * Mặc một trang bị từ ba lô
   */
  equipItem(itemIndex) {
    const item = this.backpack[itemIndex];
    if (!item) return;

    // Kiểm tra khóa trang bị độc quyền theo Class
    if (!this.canEquipItem(item)) {
      alert('⚠️ Lớp nhân vật của bạn không thể sử dụng trang bị này!');
      return;
    }

    if (item.type === 'weapon') {
      const old = this.equipped.weapon;
      this.equipped.weapon = item;
      this.backpack.splice(itemIndex, 1);
      if (old) this.backpack.push(old);
    } else if (item.type === 'armor') {
      const old = this.equipped.armor;
      this.equipped.armor = item;
      this.backpack.splice(itemIndex, 1);
      if (old) this.backpack.push(old);
    } else if (item.type === 'shield') {
      const old = this.equipped.shield;
      this.equipped.shield = item;
      this.backpack.splice(itemIndex, 1);
      if (old) this.backpack.push(old);
    }

    this.syncPlayerEquipmentStats();
    this.selectedItemIndex = null;
    this.renderUI();
  }

  /**
   * Trang bị trực tiếp một món đồ mới nhặt (Quick Equip)
   * Hoán đổi trang bị an toàn: Đồ cũ được cất lại vào túi đồ để không bao giờ bị mất
   * @param {Item} newItem
   * @returns {Item|null} Trả về món đồ cũ vừa tháo ra (nếu có)
   */
  equipDirectly(newItem) {
    if (!newItem || !['weapon', 'armor', 'shield'].includes(newItem.type)) return null;

    // Kiểm tra khóa trang bị độc quyền theo Class
    if (!this.canEquipItem(newItem)) {
      alert('⚠️ Lớp nhân vật của bạn không thể sử dụng trang bị này!');
      return null;
    }

    const slot = newItem.type;
    const old = this.equipped[slot] || null;

    // Trang bị món mới lên người nhân vật
    this.equipped[slot] = newItem;

    // Cất món đồ cũ an toàn vào ba lô
    if (old) {
      this.backpack.push(old);
    }

    this.syncPlayerEquipmentStats();
    this.selectedItemIndex = null;
    this.renderUI();
    return old;
  }

  /**
   * Sử dụng một vật phẩm tiêu hao (bình máu, mana, thể lực)
   */
  useConsumable(itemIndex) {
    const item = this.backpack[itemIndex];
    if (!item || item.type !== 'consumable') return null;

    const result = item.use(this.player, this.activeEnemy);
    if (result.success) {
      // Xóa vật phẩm khỏi ba lô
      this.backpack.splice(itemIndex, 1);
      this.selectedItemIndex = null;
      this.renderUI();

      // Nếu đang trong combat và có callback, đóng modal và kích hoạt kết thúc lượt
      if (typeof this.onCombatItemUsed === 'function') {
        const modal = document.getElementById('inventory-modal');
        if (modal) modal.style.display = 'none';
        this.onCombatItemUsed(result.message);
      }
    }
    return result;
  }

  /**
   * Cập nhật toàn bộ giao diện Modal Túi Đồ
   */
  renderUI() {
    // 1. Cập nhật trang bị đang mặc
    const weaponName = document.getElementById('slot-weapon-name');
    const weaponStat = document.getElementById('slot-weapon-stat');
    const weaponIcon = document.getElementById('slot-weapon-icon');
    if (this.equipped.weapon) {
      if (weaponName) weaponName.textContent = this.equipped.weapon.name;
      if (weaponStat) weaponStat.textContent = `Dmg: ${this.equipped.weapon.damageDice} | Atk: +${this.equipped.weapon.attackMod}`;
      if (weaponIcon) weaponIcon.textContent = this.equipped.weapon.icon;
    } else {
      if (weaponName) weaponName.textContent = '(Trống - Tay không)';
      if (weaponStat) weaponStat.textContent = 'Dmg: 1d4 | Atk: +1';
      if (weaponIcon) weaponIcon.textContent = '✊';
    }

    const armorName = document.getElementById('slot-armor-name');
    const armorStat = document.getElementById('slot-armor-stat');
    const armorIcon = document.getElementById('slot-armor-icon');
    if (this.equipped.armor) {
      if (armorName) armorName.textContent = this.equipped.armor.name;
      if (armorStat) armorStat.textContent = `AC: ${this.equipped.armor.armorClass}`;
      if (armorIcon) armorIcon.textContent = this.equipped.armor.icon;
    } else {
      if (armorName) armorName.textContent = '(Không mặc giáp)';
      if (armorStat) armorStat.textContent = 'AC: 10';
      if (armorIcon) armorIcon.textContent = '👕';
    }

    const shieldName = document.getElementById('slot-shield-name');
    const shieldStat = document.getElementById('slot-shield-stat');
    const shieldIcon = document.getElementById('slot-shield-icon');
    if (this.equipped.shield) {
      if (shieldName) shieldName.textContent = this.equipped.shield.name;
      if (shieldStat) shieldStat.textContent = `Block: ${this.equipped.shield.blockDice} dmg | +${this.equipped.shield.bonusAC} AC`;
      if (shieldIcon) shieldIcon.textContent = this.equipped.shield.icon;
    } else {
      if (shieldName) shieldName.textContent = '(Không đeo khiên)';
      if (shieldStat) shieldStat.textContent = 'Không thể chủ động Đỡ Đòn';
      if (shieldIcon) shieldIcon.textContent = '❌';
    }

    // Gắn Floating Hover Tooltip cho các ô trang bị đang mặc
    const weaponCard = document.getElementById('slot-weapon-card');
    const armorCard = document.getElementById('slot-armor-card');
    const shieldCard = document.getElementById('slot-shield-card');
    if (weaponCard) this.attachItemTooltip(weaponCard, () => this.equipped.weapon);
    if (armorCard) this.attachItemTooltip(armorCard, () => this.equipped.armor);
    if (shieldCard) this.attachItemTooltip(shieldCard, () => this.equipped.shield);

    // 2. Bảng tóm tắt chỉ số
    const totalAcEl = document.getElementById('equip-total-ac');
    const totalAtkEl = document.getElementById('equip-total-atk');
    const totalDmgEl = document.getElementById('equip-total-dmg');
    const invGoldEl = document.getElementById('inv-player-gold');
    if (totalAcEl) totalAcEl.textContent = this.player.ac;
    if (totalAtkEl) totalAtkEl.textContent = `+${this.player.attackMod}`;
    if (totalDmgEl) totalDmgEl.textContent = `${this.player.damageDice} + ${this.player.attackMod}`;
    if (invGoldEl) invGoldEl.textContent = this.player.gold;

    // 3. Render lưới ô đồ trong Ba Lô
    const grid = document.getElementById('backpack-grid');
    const counter = document.getElementById('backpack-count');
    if (counter) counter.textContent = `${this.backpack.length}/${this.maxCapacity} vật phẩm`;

    if (grid) {
      grid.innerHTML = '';
      for (let i = 0; i < this.maxCapacity; i++) {
        const item = this.backpack[i];
        const slotEl = document.createElement('div');
        slotEl.className = 'item-slot';

        if (item) {
          slotEl.dataset.itemId = item.id;
          slotEl.dataset.itemIndex = i;
          if (this.selectedItemIndex === i) {
            slotEl.classList.add('selected');
          }
          slotEl.innerHTML = `
            <span class="slot-emoji">${InventoryManager.formatItemIconHTML(item.icon)}</span>
            <span class="slot-label">${item.name}</span>
          `;
          slotEl.addEventListener('click', () => {
            this.selectedItemIndex = i;
            this.renderUI();
          });

          // Gắn sự kiện Hover Tooltip nổi đi theo con trỏ chuột
          this.attachItemTooltip(slotEl, () => item);
        } else {
          slotEl.style.opacity = '0.3';
          slotEl.innerHTML = `<span class="slot-emoji" style="filter: grayscale(1);">⬛</span>`;
        }

        grid.appendChild(slotEl);
      }
    }

    // 4. Khung chi tiết vật phẩm
    const detailBox = document.getElementById('item-details-box');
    if (this.selectedItemIndex !== null && this.backpack[this.selectedItemIndex]) {
      const selectedItem = this.backpack[this.selectedItemIndex];
      if (detailBox) {
        detailBox.style.display = 'flex';
        document.getElementById('detail-icon').innerHTML = InventoryManager.formatItemIconHTML(selectedItem.icon);
        document.getElementById('detail-name').textContent = selectedItem.name;
        document.getElementById('detail-desc').textContent = selectedItem.desc;

        const typeBadge = document.getElementById('detail-type');
        const actionBtn = document.getElementById('btn-detail-action');

        if (selectedItem.type === 'consumable') {
          typeBadge.textContent = 'Vật phẩm tiêu hao';
          actionBtn.style.display = 'block';
          actionBtn.disabled = false;
          actionBtn.textContent = 'DÙNG VẬT PHẨM (MẤT LƯỢT COMBAT)';
          actionBtn.onclick = () => this.useConsumable(this.selectedItemIndex);
        } else if (selectedItem.type === 'relic') {
          typeBadge.textContent = selectedItem.rarity === 'legendary' ? '🔥 CỔ VẬT HUYỀN THOẠI' : '🟣 CỔ VẬT SỬ THI';
          actionBtn.style.display = 'block';
          actionBtn.disabled = true;
          actionBtn.textContent = '✨ NỘI TẠI TỰ ĐỘNG KÍCH HOẠT TRONG TRẬN ĐẤU';
          actionBtn.onclick = null;
        } else {
          typeBadge.textContent = selectedItem.rarity === 'legendary' ? '🔥 TRANG BỊ HUYỀN THOẠI' : (selectedItem.rarity === 'epic' ? '🟣 TRANG BỊ SỬ THI' : 'Trang bị');
          actionBtn.style.display = 'block';
          actionBtn.disabled = false;
          actionBtn.textContent = 'TRANG BỊ (KHÔNG MẤT LƯỢT)';
          actionBtn.onclick = () => this.equipItem(this.selectedItemIndex);
        }
      }
    } else {
      if (detailBox) detailBox.style.display = 'none';
    }
  }

  /**
   * Tạo cấu trúc HTML chi tiết cho Floating Tooltip
   * @param {Item} item
   * @returns {string}
   */
  /**
   * Định dạng Icon vật phẩm chuẩn (hỗ trợ combo icon 2 emoji: vũ khí chính + thuộc tính góc phải)
   * @param {string} iconStr
   * @returns {string}
   */
  static formatItemIconHTML(iconStr) {
    if (!iconStr) return '<span class="item-icon-single">🎒</span>';
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      const segments = [...segmenter.segment(iconStr)].map(s => s.segment);
      if (segments.length <= 1) {
        return `<span class="item-icon-single">${segments[0] || '🎒'}</span>`;
      }
      return `
        <div class="item-icon-combo">
          <span class="icon-base">${segments[0]}</span>
          <span class="icon-badge">${segments.slice(1).join('')}</span>
        </div>
      `;
    } catch (e) {
      return `<span class="item-icon-single">${iconStr}</span>`;
    }
  }

  /**
   * Sinh mã HTML cho một cột Tooltip (Panel)
   * @param {Item} item Vật phẩm cần hiển thị
   * @param {string|null} role 'viewing' | 'equipped' | null
   * @param {Item|null} compareWith Món đồ dùng để đối chiếu chỉ số (đang mặc)
   * @returns {string}
   */
  renderItemPanelHTML(item, role = null, compareWith = null) {
    if (!item) return '';

    const rarityColors = {
      common: '#94a3b8',
      rare: '#38bdf8',
      epic: '#c084fc',
      legendary: '#ffd166'
    };
    const rarityLabels = {
      common: 'PHỔ THÔNG',
      rare: 'QUÝ HIẾM',
      epic: 'SỬ THI',
      legendary: 'HUYỀN THOẠI'
    };
    const typeLabels = {
      weapon: 'Vũ Khí',
      armor: 'Giáp Thân',
      shield: 'Khiên Đỡ',
      consumable: 'Dược Phẩm',
      relic: 'Cổ Vật'
    };

    const rarity = item.rarity || 'common';
    const color = rarityColors[rarity] || '#94a3b8';
    const typeLabel = typeLabels[item.type] || 'Vật Phẩm';
    const rarityLabel = rarityLabels[rarity] || 'PHỔ THÔNG';

    // Tag phân định vai trò
    let roleTagHTML = '';
    if (role === 'viewing') {
      roleTagHTML = `<div class="tooltip-panel-tag">🔍 ĐANG XEM (TRONG TÚI)</div>`;
    } else if (role === 'equipped') {
      roleTagHTML = `<div class="tooltip-panel-tag">🛡️ ĐANG TRANG BỊ</div>`;
    } else if (role === 'new_loot') {
      roleTagHTML = `<div class="tooltip-panel-tag new-loot-tag">✨ TRANG BỊ MỚI NHẶT</div>`;
    } else if (role === 'shop_buy') {
      roleTagHTML = `<div class="tooltip-panel-tag shop-buy-tag">🏪 VẬT PHẨM BÀY BÁN</div>`;
    } else if (role === 'shop_sell') {
      const sellVal = Math.max(1, Math.floor((item.price || 10) * 0.5));
      roleTagHTML = `<div class="tooltip-panel-tag shop-sell-tag">💰 BÁN TỪ TÚI ĐỒ (+${sellVal} VÀNG)</div>`;
    } else if (role === 'hof_relic' || role === 'hof') {
      roleTagHTML = `<div class="tooltip-panel-tag relic-hof-tag">🏛️ CỔ VẬT DANH VỌNG</div>`;
    } else if (role === 'combat_relic' || role === 'combat') {
      roleTagHTML = `<div class="tooltip-panel-tag relic-combat-tag">⚡ CỔ VẬT ĐANG KÍCH HOẠT</div>`;
    } else if (item.type === 'relic') {
      roleTagHTML = `<div class="tooltip-panel-tag relic-tag">👑 CỔ VẬT BỊ ĐỘNG</div>`;
    }

    let statsHTML = '';
    if (item.type === 'weapon') {
      let diffHTML = '';
      if (compareWith && compareWith.type === 'weapon') {
        const diff = (item.attackMod || 0) - (compareWith.attackMod || 0);
        if (diff > 0) diffHTML = `<span class="stat-diff-better">▲ +${diff} Atk</span>`;
        else if (diff < 0) diffHTML = `<span class="stat-diff-worse">▼ ${diff} Atk</span>`;
        else diffHTML = `<span class="stat-diff-equal">(= Atk)</span>`;
      }

      const classReqLabels = {
        all: 'Tất cả các phái',
        warrior: 'Chiến Binh / Kỵ Sĩ',
        knight: 'Chiến Binh / Kỵ Sĩ',
        mage: 'Pháp Sư',
        thief: 'Đạo Tặc / Sát Thủ',
        rogue: 'Đạo Tặc / Sát Thủ'
      };
      const reqText = item.classReq ? (classReqLabels[item.classReq] || item.classReq.toUpperCase()) : 'Tất cả các phái';

      statsHTML = `
        <div class="item-tooltip-stat-line">
          <span class="stat-main">⚔️ Sát thương: <b>${item.damageDice || '1d4'}</b> (${item.attackMod >= 0 ? '+' : ''}${item.attackMod} Atk)</span>
          ${diffHTML}
        </div>
        ${item.canCounter ? '<div class="item-tooltip-trait-line">⚡ Đặc tính: Phản đòn khi né tránh</div>' : ''}
        ${item.classReq && item.classReq !== 'all' ? `<div class="item-tooltip-trait-line" style="color: #67e8f9;">🛡️ Phái yêu cầu: <b>${reqText}</b></div>` : ''}
        ${item.onHitEffect ? `<div class="item-tooltip-trait-line" style="color: #f59e0b;">✨ Đòn đánh: <b>${Math.round((item.onHitEffect.chance !== undefined ? item.onHitEffect.chance : 1) * 100)}%</b> kích hoạt [<b>${item.onHitEffect.id.toUpperCase()}</b>] (${item.onHitEffect.duration} hiệp)</div>` : ''}
      `;
    } else if (item.type === 'armor') {
      let diffHTML = '';
      if (compareWith && compareWith.type === 'armor') {
        const diff = (item.armorClass || 0) - (compareWith.armorClass || 0);
        if (diff > 0) diffHTML = `<span class="stat-diff-better">▲ +${diff} AC</span>`;
        else if (diff < 0) diffHTML = `<span class="stat-diff-worse">▼ ${diff} AC</span>`;
        else diffHTML = `<span class="stat-diff-equal">(= AC)</span>`;
      }

      const classReqLabels = {
        all: 'Tất cả các phái',
        warrior: 'Chiến Binh / Kỵ Sĩ',
        knight: 'Chiến Binh / Kỵ Sĩ',
        mage: 'Pháp Sư',
        thief: 'Đạo Tặc / Sát Thủ',
        rogue: 'Đạo Tặc / Sát Thủ'
      };
      const reqText = item.classReq ? (classReqLabels[item.classReq] || item.classReq.toUpperCase()) : 'Tất cả các phái';

      statsHTML = `
        <div class="item-tooltip-stat-line">
          <span class="stat-main">🛡️ Giáp cơ bản: <b>+${item.armorClass} AC</b></span>
          ${diffHTML}
        </div>
        ${item.classReq && item.classReq !== 'all' ? `<div class="item-tooltip-trait-line" style="color: #67e8f9;">🛡️ Phái yêu cầu: <b>${reqText}</b></div>` : ''}
      `;
    } else if (item.type === 'shield') {
      let diffHTML = '';
      if (compareWith && compareWith.type === 'shield') {
        const diff = (item.bonusAC || 0) - (compareWith.bonusAC || 0);
        if (diff > 0) diffHTML = `<span class="stat-diff-better">▲ +${diff} AC</span>`;
        else if (diff < 0) diffHTML = `<span class="stat-diff-worse">▼ ${diff} AC</span>`;
        else diffHTML = `<span class="stat-diff-equal">(= AC)</span>`;
      }

      const classReqLabels = {
        all: 'Tất cả các phái',
        warrior: 'Chiến Binh / Kỵ Sĩ',
        knight: 'Chiến Binh / Kỵ Sĩ',
        mage: 'Pháp Sư',
        thief: 'Đạo Tặc / Sát Thủ',
        rogue: 'Đạo Tặc / Sát Thủ'
      };
      const reqText = item.classReq ? (classReqLabels[item.classReq] || item.classReq.toUpperCase()) : 'Tất cả các phái';

      statsHTML = `
        <div class="item-tooltip-stat-line">
          <span class="stat-main">🔰 Khả năng đỡ: <b>${item.blockDice || '1d6'} dmg</b> (+${item.bonusAC || 0} AC)</span>
          ${diffHTML}
        </div>
        ${item.classReq && item.classReq !== 'all' ? `<div class="item-tooltip-trait-line" style="color: #67e8f9;">🛡️ Phái yêu cầu: <b>${reqText}</b></div>` : ''}
      `;
    } else if (item.type === 'consumable') {
      let effectDesc = item.desc;
      if (item.applyEffect) {
        const isEnemy = item.applyEffect.target === 'enemy';
        effectDesc = `${isEnemy ? 'Ném gây' : 'Nhận'} trạng thái <b>[${item.applyEffect.id.toUpperCase()}]</b> (${item.applyEffect.duration} hiệp)`;
      } else if (item.effectType === 'heal_hp') effectDesc = `Hồi phục <b>+${item.value} HP</b>`;
      else if (item.effectType === 'heal_mp') effectDesc = `Hồi phục <b>+${item.value} MP</b>`;
      else if (item.effectType === 'heal_sp') effectDesc = `Hồi phục <b>+${item.value} SP</b>`;
      else if (item.effectType === 'heal_all') effectDesc = `Hồi phục toàn bộ <b>+${item.hpValue} HP, +${item.mpValue} MP, +${item.spValue} SP</b>`;
      statsHTML = `
        <div class="item-tooltip-stat-line">✨ Tác dụng: ${effectDesc}</div>
      `;
    } else if (item.type === 'relic') {
      const passiveText = item.passive ? (item.passive.label || item.passive.desc || item.desc) : item.desc;

      const classReqLabels = {
        all: 'Tất cả các phái',
        warrior: 'Chiến Binh / Kỵ Sĩ',
        knight: 'Chiến Binh / Kỵ Sĩ',
        mage: 'Pháp Sư',
        thief: 'Đạo Tặc / Sát Thủ',
        rogue: 'Đạo Tặc / Sát Thủ'
      };
      const reqText = item.classReq ? (classReqLabels[item.classReq] || item.classReq.toUpperCase()) : null;

      let originBadge = '';
      if (item.isBossExclusive) {
        originBadge = `<div class="relic-origin-badge boss-origin">👑 Cổ Vật Độc Quyền Boss Cuối</div>`;
      } else if (item.isEliteExclusive) {
        originBadge = `<div class="relic-origin-badge elite-origin">💀 Cổ Vật Độc Quyền Quái Tinh Anh</div>`;
      }

      statsHTML = `
        ${originBadge}
        <div class="relic-passive-box">
          <div class="relic-passive-header">
            <span class="relic-passive-tag">⚡ NỘI TẠI KÍCH HOẠT</span>
          </div>
          <div class="relic-passive-text">${passiveText}</div>
        </div>
        ${reqText && item.classReq !== 'all' ? `<div class="item-tooltip-trait-line" style="color: #67e8f9; margin-top: 6px;">🛡️ Yêu cầu phái: <b>${reqText}</b></div>` : ''}
      `;
    }

    let hintText = '🖱️ Nhấp để chọn';
    if (role === 'viewing') hintText = '🖱️ Nhấp để trang bị / dùng';
    else if (role === 'equipped') hintText = '✅ Đang mặc trên người';
    else if (role === 'shop_buy') hintText = '🛒 Nhấp MUA trong Shop';
    else if (role === 'shop_sell') hintText = '💰 Nhấp để bán lấy Vàng';
    else if (role === 'hof_relic' || role === 'hof') hintText = '🏛️ Cổ vật lưu danh trong Sảnh Danh Vọng';
    else if (role === 'combat_relic' || role === 'combat') hintText = '⚡ Luôn kích hoạt trong trận chiến';
    else if (item.type === 'relic') hintText = '👑 Cổ vật vĩnh cửu (Không mất khi tử trận)';

    let priceTagHTML = '';
    if (role === 'shop_sell') {
      const sellVal = Math.max(1, Math.floor((item.price || 10) * 0.5));
      priceTagHTML = `<span class="item-tooltip-price-tag" style="color: #6ee7b7; border-color: rgba(16, 185, 129, 0.4);">💰 Giá bán: <b>${sellVal} Vàng</b></span>`;
    } else if (item.price && role !== 'hof' && role !== 'hof_relic' && role !== 'combat' && role !== 'combat_relic') {
      priceTagHTML = `<span class="item-tooltip-price-tag">💰 <b>${item.price} Vàng</b></span>`;
    }

    const priceHTML = `
      <div class="item-tooltip-footer-row">
        <span class="item-tooltip-hint">${hintText}</span>
        ${priceTagHTML}
      </div>
    `;

    let panelRoleClass = role ? `panel-${role}` : '';
    if (item.type === 'relic') panelRoleClass += ` panel-relic panel-relic-${rarity}`;
    const panelClass = `tooltip-panel ${panelRoleClass}`.trim();

    return `
      <div class="${panelClass}">
        ${roleTagHTML}
        <div class="item-tooltip-top">
          <div class="item-tooltip-icon-box" style="border-color: ${color}60;">${InventoryManager.formatItemIconHTML(item.icon)}</div>
          <div class="item-tooltip-titles">
            <div class="item-tooltip-name" style="color: ${color}; text-shadow: 0 0 10px ${color}80;">${item.name}</div>
            <div class="item-tooltip-sub-row">
              <span class="item-tooltip-type-tag">${typeLabel}</span>
              <span class="item-tooltip-rarity-pill" style="color: ${color}; border-color: ${color}70; background: ${color}15;">${rarityLabel}</span>
            </div>
          </div>
        </div>
        <div class="item-tooltip-divider" style="background: linear-gradient(90deg, ${color}80 0%, rgba(255, 255, 255, 0.08) 70%, transparent 100%);"></div>
        <div class="item-tooltip-body">
          <div class="item-tooltip-stats-card" style="border-left-color: ${color};">
            ${statsHTML}
          </div>
          <div class="item-tooltip-desc-text">"${item.desc}"</div>
        </div>
        ${priceHTML}
      </div>
    `;
  }

  /**
   * Sinh HTML cho Tooltip, tự động tạo 2 cột so sánh nếu hoverItem là trang bị và đã có đồ mặc
   * @param {Item} hoverItem Vật phẩm đang trỏ chuột
   * @param {string|null} customRole 'shop_buy' | 'shop_sell' | null
   * @returns {string}
   */
  getComparisonTooltipHTML(hoverItem, customRole = null) {
    if (!hoverItem) return '';

    const isEquipment = ['weapon', 'armor', 'shield'].includes(hoverItem.type);
    const equippedItem = isEquipment ? this.equipped[hoverItem.type] : null;

    // Nếu không phải trang bị, hoặc người chơi đang không mặc đồ ở slot này, hoặc đang hover chính là món đang mặc
    if (!isEquipment || !equippedItem || hoverItem === equippedItem) {
      const role = customRole || ((isEquipment && hoverItem === equippedItem) ? 'equipped' : null);
      return this.renderItemPanelHTML(hoverItem, role);
    }

    // So sánh bên cạnh nhau: Cột 1 (Đang xem / Shop) và Cột 2 (Đang trang bị)
    const viewingRole = customRole || 'viewing';
    const panelViewingHTML = this.renderItemPanelHTML(hoverItem, viewingRole, equippedItem);
    const panelEquippedHTML = this.renderItemPanelHTML(equippedItem, 'equipped', null);

    return panelViewingHTML + panelEquippedHTML;
  }

  /**
   * Phương thức tương thích ngược
   * @param {Item} item
   * @returns {string}
   */
  getItemTooltipHTML(item) {
    return this.getComparisonTooltipHTML(item);
  }

  /**
   * Căn vị trí Tooltip thông minh chống tràn mép màn hình
   * @param {HTMLElement} tooltip 
   * @param {MouseEvent} e 
   */
  static positionTooltip(tooltip, e) {
    const offsetX = 16;
    const offsetY = 16;
    let left = e.clientX + offsetX;
    let top = e.clientY + offsetY;

    const tooltipWidth = tooltip.offsetWidth || 320;
    const tooltipHeight = tooltip.offsetHeight || 220;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Xử lý chống tràn mép phải màn hình: nếu chạm mép, lật sang bên trái chuột
    if (left + tooltipWidth > windowWidth - 10) {
      left = e.clientX - tooltipWidth - 16;
    }
    if (left < 10) {
      left = 10;
    }

    // Xử lý chống tràn mép dưới màn hình: nếu chạm mép, lật lên trên chuột
    if (top + tooltipHeight > windowHeight - 10) {
      top = e.clientY - tooltipHeight - 16;
    }
    if (top < 10) {
      top = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * Gắn sự kiện Hover Floating Tooltip cho bất kỳ phần tử DOM nào (Static Helper)
   * @param {HTMLElement} el Thẻ DOM cần gắn hover
   * @param {Function|Item|Object} getItemOrFn Hàm lấy dữ liệu Item hoặc Object Item
   * @param {string|null} customRole 'hof' | 'combat' | 'shop_buy' | 'shop_sell' | 'viewing' | 'equipped' | null
   * @param {InventoryManager|null} invManager Instance quản lý túi đồ nếu có
   */
  static attachTooltip(el, getItemOrFn, customRole = null, invManager = null) {
    const tooltip = document.getElementById('item-tooltip');
    if (!tooltip || !el) return;

    // Gỡ bỏ thuộc tính title mặc định của HTML để không hiện box trắng xấu xí của trình duyệt
    el.removeAttribute('title');

    el.onmouseenter = (e) => {
      const rawItem = typeof getItemOrFn === 'function' ? getItemOrFn() : getItemOrFn;
      if (!rawItem) {
        tooltip.classList.add('hidden');
        tooltip.innerHTML = '';
        return;
      }

      // Đảm bảo là instance Item
      let item = rawItem;
      if (!(item instanceof Item) && typeof item === 'object') {
        item = new Item(item);
      }

      if (invManager && typeof invManager.getComparisonTooltipHTML === 'function') {
        tooltip.innerHTML = invManager.getComparisonTooltipHTML(item, customRole);
      } else {
        const dummyInv = new InventoryManager();
        tooltip.innerHTML = dummyInv.renderItemPanelHTML(item, customRole);
      }

      tooltip.classList.remove('hidden');
      InventoryManager.positionTooltip(tooltip, e);
    };

    el.onmousemove = (e) => {
      if (tooltip.classList.contains('hidden')) return;
      InventoryManager.positionTooltip(tooltip, e);
    };

    el.onmouseleave = () => {
      tooltip.classList.add('hidden');
      tooltip.innerHTML = '';
    };
  }

  /**
   * Gắn sự kiện Hover Floating Tooltip cho phần tử DOM của Inventory instance
   * @param {HTMLElement} el Thẻ DOM (ô đồ ba lô hoặc card trang bị)
   * @param {Function|Item} getItemFn Hàm lấy dữ liệu Item tương ứng
   * @param {string|null} customRole
   */
  attachItemTooltip(el, getItemFn, customRole = null) {
    InventoryManager.attachTooltip(el, getItemFn, customRole, this);
  }

  /**
   * Mở modal túi đồ
   */
  openModal() {
    const modal = document.getElementById('inventory-modal');
    if (modal) {
      this.renderUI();
      modal.style.display = 'flex';
    }
  }

  /**
   * Đóng modal túi đồ
   */
  closeModal() {
    const modal = document.getElementById('inventory-modal');
    if (modal) modal.style.display = 'none';
    const tooltip = document.getElementById('item-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
    if (typeof this.onModalClose === 'function') {
      this.onModalClose();
    }
  }
}
