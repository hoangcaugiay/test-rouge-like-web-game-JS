/**
 * ============================================================================
 * ARENAMANAGER.JS - QUAN LY UI CHON TUONG PvP VA LOGIC HOTSEAT COMBAT
 * Chuc nang:
 * 1. Render danh sach nhan vat da luu (Roster) de nguoi choi chon.
 * 2. Chon P1 / P2 khong trung nhau.
 * 3. Bat dau tran PvP Hotseat: 2 nguoi choi chung 1 may, lua phien nhau.
 * 4. Tran PvP KHONG anh huong du lieu goc cua Roster.
 * ============================================================================
 */

import { SaveManager } from './SaveManager.js';
import { Player } from '../models/Player.js';
import { Item } from '../models/Item.js';
import { InventoryManager } from './InventoryManager.js';

export class ArenaManager {
  /**
   * @param {Function} onStartPvP Callback khi nguoi choi bam [Bat Dau Chien Dau]
   *   Nhan 2 tham so: (pvpPlayer1: Player, pvpPlayer2: Player)
   * @param {Function} onBack Callback khi bam [Quay lai Menu]
   */
  constructor(onStartPvP, onBack) {
    this.onStartPvP = onStartPvP;
    this.onBack = onBack;

    /** ID cua Roster entry duoc chon lam P1 */
    this.selectedP1Id = null;
    /** ID cua Roster entry duoc chon lam P2 */
    this.selectedP2Id = null;

    this.btnStart = document.getElementById('btn-arena-start');
    this.btnBack = document.getElementById('btn-arena-back');
    this.rosterGrid = document.getElementById('arena-roster-list');
    this.rosterEmpty = document.getElementById('arena-roster-empty');
    this.p1Display = document.getElementById('arena-p1-display');
    this.p2Display = document.getElementById('arena-p2-display');

    this._bindEvents();
  }

  _bindEvents() {
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        if (typeof this.onBack === 'function') this.onBack();
      });
    }

    if (this.btnStart) {
      this.btnStart.addEventListener('click', () => {
        if (!this.selectedP1Id || !this.selectedP2Id) return;
        const roster = SaveManager.getRoster();
        const entry1 = roster.find(e => e.id === this.selectedP1Id);
        const entry2 = roster.find(e => e.id === this.selectedP2Id);
        if (!entry1 || !entry2) return;

        // Ep kieu thanh Player de co day du ham can thiet
        const p1 = this._rosterEntryToPlayer(entry1);
        const p2 = this._rosterEntryToPlayer(entry2);

        if (typeof this.onStartPvP === 'function') {
          this.onStartPvP(p1, p2);
        }
      });
    }
  }

  /**
   * Ep kieu mot Roster Entry thanh doi tuong Player day du
   * @param {Object} entry
   * @returns {Player}
   */
  _rosterEntryToPlayer(entry) {
    const p = new Player(entry.name, entry.gold || 0);
    p.hp = entry.hp;
    p.maxHp = entry.maxHp;
    p.mp = entry.mp;
    p.maxMp = entry.maxMp;
    p.sp = entry.sp;
    p.maxSp = entry.maxSp;
    p.ac = entry.ac;
    p.attackMod = entry.attackMod;
    p.damageDice = entry.damageDice;
    p.skills = [...(entry.skills || [])];
    p.canBlock = entry.canBlock;
    p.canCounter = entry.canCounter;
    p.hasReaction = true;
    if (entry.avatar) p.avatar = entry.avatar;

    // Gan classId và ten hieu
    p.classId = entry.classId || (entry.name && (entry.name.includes('Đạo Tặc') || entry.name.includes('Sát Thủ')) ? 'thief' : (entry.name && entry.name.includes('Pháp Sư') ? 'mage' : 'warrior'));
    p.heroName = entry.heroName || entry.name;

    // Tao InventoryManager rieng chua trang bi cua nhan vat PvP
    const inv = new InventoryManager(p);
    if (entry.equipped) {
      if (entry.equipped.weapon) {
        const w = new Item(entry.equipped.weapon);
        inv.equipped.weapon = w;
        // Ap dung chi so vu khi
        if (w.attackMod) p.attackMod = w.attackMod;
        if (w.damageDice) p.damageDice = w.damageDice;
      }
      if (entry.equipped.armor) {
        const a = new Item(entry.equipped.armor);
        inv.equipped.armor = a;
        if (a.ac) p.ac = a.ac;
      }
      if (entry.equipped.shield) {
        inv.equipped.shield = new Item(entry.equipped.shield);
        p.canBlock = true;
      }
    }
    if (entry.backpack && Array.isArray(entry.backpack)) {
      inv.backpack = entry.backpack.map(itemData => itemData ? new Item(itemData) : null);
    }
    p._pvpInventory = inv;

    return p;
  }

  /**
   * Mo man hinh Arena Setup va render Roster
   */
  open() {
    this.selectedP1Id = null;
    this.selectedP2Id = null;
    this._updateChampionDisplays();
    this._updateStartButton();
    this._renderRoster();
  }

  /**
   * Render danh sach nhan vat trong Roster
   */
  _renderRoster() {
    if (!this.rosterGrid) return;
    this.rosterGrid.innerHTML = '';

    const roster = SaveManager.getRoster();

    if (roster.length === 0) {
      if (this.rosterEmpty) this.rosterEmpty.style.display = 'block';
      return;
    }

    if (this.rosterEmpty) this.rosterEmpty.style.display = 'none';

    roster.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'arena-roster-card';
      card.id = 'roster-card-' + entry.id;

      const savedDate = new Date(entry.savedAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: '2-digit'
      });

      const weaponName = entry.equipped && entry.equipped.weapon
        ? entry.equipped.weapon.name
        : 'Tay khong';

      card.innerHTML =
        '<div class="roster-card-avatar">' + (entry.avatar || 'U+1F6E1') + '</div>' +
        '<div class="roster-card-info">' +
          '<div class="roster-card-heroname">' + entry.heroName + '</div>' +
          '<div class="roster-card-stats">' +
            'HP: ' + entry.maxHp + ' | AC: ' + entry.ac + ' | Atk: +' + entry.attackMod +
            '<br>' + weaponName + ' | ' + savedDate +
          '</div>' +
        '</div>' +
        '<button class="roster-card-delete" title="Xoa khoi Danh Vong" data-id="' + entry.id + '">🗑️</button>';

      // Click vao the card -> chon P1 hoac P2
      card.addEventListener('click', (e) => {
        // Neu bam vao nut xoa thi bo qua
        if (e.target.closest('.roster-card-delete')) return;
        this._handleRosterCardClick(entry.id);
      });

      // Nut xoa nhan vat khoi Roster
      const btnDelete = card.querySelector('.roster-card-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          const confirmed = confirm(
            'Ban co chac chan muon xoa "' + entry.heroName + '" khoi Danh Vong?\nHanh dong nay khong the hoan tac!'
          );
          if (confirmed) {
            SaveManager.deleteFromRoster(entry.id);
            // Reset neu dang chon
            if (this.selectedP1Id === entry.id) this.selectedP1Id = null;
            if (this.selectedP2Id === entry.id) this.selectedP2Id = null;
            this._renderRoster();
            this._updateChampionDisplays();
            this._updateStartButton();
          }
        });
      }

      this.rosterGrid.appendChild(card);
    });

    this._refreshCardHighlights();
  }

  /**
   * Xu ly logic click chon P1 / P2 tren the Roster
   */
  _handleRosterCardClick(entryId) {
    if (this.selectedP1Id === entryId) {
      // Bo chon P1
      this.selectedP1Id = null;
    } else if (this.selectedP2Id === entryId) {
      // Bo chon P2
      this.selectedP2Id = null;
    } else if (!this.selectedP1Id) {
      // Chua co P1, chon lam P1
      this.selectedP1Id = entryId;
    } else if (!this.selectedP2Id && entryId !== this.selectedP1Id) {
      // Da co P1, chua co P2 va khong trung -> chon lam P2
      this.selectedP2Id = entryId;
    } else if (this.selectedP1Id && this.selectedP2Id) {
      // Ca hai da chon -> click lai de thay the P1 truoc
      if (entryId !== this.selectedP2Id) {
        this.selectedP1Id = entryId;
      }
    }

    this._refreshCardHighlights();
    this._updateChampionDisplays();
    this._updateStartButton();
  }

  /**
   * Cap nhat class CSS trang thai selected-p1 / selected-p2 tren cac the
   */
  _refreshCardHighlights() {
    const roster = SaveManager.getRoster();
    roster.forEach(entry => {
      const card = document.getElementById('roster-card-' + entry.id);
      if (!card) return;

      // Xoa badge cu
      const oldBadge = card.querySelector('.roster-select-badge');
      if (oldBadge) oldBadge.remove();

      card.classList.remove('selected-p1', 'selected-p2');

      if (entry.id === this.selectedP1Id) {
        card.classList.add('selected-p1');
        const badge = document.createElement('span');
        badge.className = 'roster-select-badge badge-p1';
        badge.textContent = 'P1';
        card.appendChild(badge);
      } else if (entry.id === this.selectedP2Id) {
        card.classList.add('selected-p2');
        const badge = document.createElement('span');
        badge.className = 'roster-select-badge badge-p2';
        badge.textContent = 'P2';
        card.appendChild(badge);
      }
    });
  }

  /**
   * Cap nhat hien thi Champion da chon trong 2 o P1/P2
   */
  _updateChampionDisplays() {
    const roster = SaveManager.getRoster();
    this._renderChampionSlot(this.p1Display, roster.find(e => e.id === this.selectedP1Id) || null, 'p1');
    this._renderChampionSlot(this.p2Display, roster.find(e => e.id === this.selectedP2Id) || null, 'p2');
  }

  _renderChampionSlot(container, entry, side) {
    if (!container) return;

    if (!entry) {
      container.innerHTML = '<div class="arena-empty-slot">&#10067;<br><small>Chua chon tuyen thu</small></div>';
      return;
    }

    const weaponName = entry.equipped && entry.equipped.weapon
      ? entry.equipped.weapon.name
      : 'Tay khong';

    container.innerHTML =
      '<div class="arena-champion-preview">' +
        '<div class="arena-champion-avatar">' + (entry.avatar || '🛡️') + '</div>' +
        '<div class="arena-champion-name">' + entry.heroName + '</div>' +
        '<div class="arena-champion-stats">' +
          '<span>❤️ ' + entry.maxHp + ' HP</span>' +
          '<span>🛡️ AC ' + entry.ac + '</span>' +
          '<span>⚔️ +' + entry.attackMod + '</span>' +
        '</div>' +
        '<div class="arena-champion-stats">' +
          '<span>' + weaponName + '</span>' +
        '</div>' +
      '</div>';
  }

  /**
   * Bat/Tat nut [Bat Dau Chien Dau] tuy theo co du P1 & P2 khong
   */
  _updateStartButton() {
    if (!this.btnStart) return;
    const ready = !!(this.selectedP1Id && this.selectedP2Id && this.selectedP1Id !== this.selectedP2Id);
    this.btnStart.disabled = !ready;
  }
}
