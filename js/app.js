/**
 * ============================================================================
 * APP.JS - BO DIEU PHOI CHINH TOAN TRO CHOI ROGUELITE RPG
 * Quan ly luong tro choi: Main Menu, Class Selection, PvE Map, Combat,
 * End-Run Hall of Fame (Luu/Xoa), Arena PvP Hotseat.
 * ============================================================================
 */

import { InventoryManager } from './managers/InventoryManager.js';
import { MapManager } from './managers/MapManager.js';
import { CombatManager } from './managers/CombatManager.js';
import { SaveManager } from './managers/SaveManager.js';
import { ArenaManager } from './managers/ArenaManager.js';
import { Player, Enemy } from './models/Combatant.js';
import { Item } from './models/Item.js';
import { ENEMIES_DATABASE, CLASSES_DATABASE, SKILLS_DATABASE, ITEMS_DATABASE } from './data/database.js';

export class App {
  constructor() {
    this.player = null;
    this.inventoryManager = null;
    this.combatManager = null;
    this.mapManager = null;
    this.arenaManager = null;
    this.currentRestNode = null;
    this.selectedClassId = 'warrior';
    this.currentSkillLearnChoices = null;
    this.skillRerollsLeft = 1;

    this.initMainMenu();
    this.initCommonDOM();
    this.initEndRunModal();
    this.initClassSelectModal();
  }

  // ===========================================================================
  // MAIN MENU
  // ===========================================================================

  initMainMenu() {
    const btnContinue = document.getElementById('btn-continue-game');
    const btnNew = document.getElementById('btn-new-game');
    const btnPvP = document.getElementById('btn-pvp-arena');
    const saveBadge = document.getElementById('save-info-badge');

    const hasSave = SaveManager.hasSave();
    if (btnContinue && saveBadge) {
      if (hasSave) {
        btnContinue.disabled = false;
        saveBadge.textContent = SaveManager.getSaveSummary();
      } else {
        btnContinue.disabled = true;
        saveBadge.textContent = 'Khong tim thay ban luu';
      }
      btnContinue.onclick = () => this.handleContinueGame();
    }

    if (btnNew) btnNew.onclick = () => this.openClassSelectModal();

    // Nút Sảnh Danh Vọng: Xem danh sách các nhân vật đã lưu
    const btnHallOfFame = document.getElementById('btn-hall-of-fame');
    const rosterCount = SaveManager.getRoster().length;
    const hofRosterCountEl = document.getElementById('hof-roster-count');
    if (hofRosterCountEl) hofRosterCountEl.textContent = rosterCount;
    if (btnHallOfFame) {
      btnHallOfFame.onclick = () => this.openHallOfFame();
    }

    // Nút Đấu Trường PvP: Chỉ sáng khi có >= 2 nhân vật trong Roster
    if (btnPvP) {
      const pvpRosterCountEl = document.getElementById('pvp-roster-count');
      if (pvpRosterCountEl) pvpRosterCountEl.textContent = rosterCount;

      btnPvP.disabled = rosterCount < 2;
      btnPvP.onclick = () => this.openArenaSetup();
    }

    this.showScreen('menu-screen');
    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'none';
  }

  // ===========================================================================
  // COMMON DOM EVENTS
  // ===========================================================================

  initCommonDOM() {
    const btnOpenInv = document.getElementById('btn-open-inventory-hud');
    if (btnOpenInv) {
      btnOpenInv.addEventListener('click', () => {
        if (this.inventoryManager) this.inventoryManager.openModal();
      });
    }

    const btnCloseInv = document.getElementById('btn-close-inventory');
    if (btnCloseInv) {
      btnCloseInv.addEventListener('click', () => {
        if (this.inventoryManager) this.inventoryManager.closeModal();
        this.updateTopHUD();

        // Nếu người chơi đang ở giai đoạn kết thúc game (End Game Phase), mở lại modal tổng kết
        if (window.isEndGamePhase) {
          this.openEndRunModal(this.isLastRunVictory);
        }
      });
    }

    const btnReturnMenu = document.getElementById('btn-return-menu-hud');
    if (btnReturnMenu) {
      btnReturnMenu.addEventListener('click', () => this.handleReturnToMainMenu());
    }

    const btnOpenSkills = document.getElementById('btn-open-skills-hud');
    if (btnOpenSkills) {
      btnOpenSkills.onclick = () => this.openSkillLearnModal();
    }

    const pillSkill = document.getElementById('hud-skill-pill');
    if (pillSkill) {
      pillSkill.onclick = () => this.openSkillLearnModal();
    }

    const btnRestSleep = document.getElementById('btn-rest-sleep');
    if (btnRestSleep) {
      btnRestSleep.addEventListener('click', () => this.handleRestSleep());
    }

    const btnRestCleanse = document.getElementById('btn-rest-cleanse');
    if (btnRestCleanse) {
      btnRestCleanse.addEventListener('click', () => this.handleRestCleanse());
    }

    const btnRestLearn = document.getElementById('btn-rest-learn-skill');
    if (btnRestLearn) {
      btnRestLearn.addEventListener('click', () => this.openSkillLearnModal());
    }

    const btnCancelLearn = document.getElementById('btn-cancel-learn-skill');
    if (btnCancelLearn) {
      btnCancelLearn.addEventListener('click', () => this.closeSkillLearnModal());
    }

    const btnRerollLearn = document.getElementById('btn-reroll-learn-skill');
    if (btnRerollLearn) {
      btnRerollLearn.addEventListener('click', () => this.handleRerollLearnSkills());
    }

    // Nút Quay lại Menu từ Sảnh Danh Vọng
    const btnHofBack = document.getElementById('btn-hof-back');
    if (btnHofBack) {
      btnHofBack.addEventListener('click', () => {
        this.showScreen('menu-screen');
        this.initMainMenu();
      });
    }

    // Nút Bắt đầu chơi mới từ Empty State của Sảnh Danh Vọng
    const btnHofStartGame = document.getElementById('btn-hof-start-game');
    if (btnHofStartGame) {
      btnHofStartGame.addEventListener('click', () => {
        this.openClassSelectModal();
      });
    }
  }

  // ===========================================================================
  // CLASS SELECTION MODAL
  // ===========================================================================

  initClassSelectModal() {
    this.classModal = document.getElementById('class-select-modal');
    const btnCancel = document.getElementById('btn-cancel-class-select');
    const btnConfirm = document.getElementById('btn-confirm-class-select');

    if (btnCancel) {
      btnCancel.onclick = () => {
        this.classModal.style.display = 'none';
      };
    }

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        this.classModal.style.display = 'none';
        this.startNewGameWithClass(this.selectedClassId);
      };
    }
  }

  openClassSelectModal() {
    if (!this.classModal) {
      this.classModal = document.getElementById('class-select-modal');
    }
    if (!this.classModal) return;

    const grid = document.getElementById('class-cards-grid');
    const btnConfirm = document.getElementById('btn-confirm-class-select');
    if (!grid) return;

    this.selectedClassId = 'warrior';
    if (btnConfirm) btnConfirm.disabled = false;
    grid.innerHTML = '';

    Object.values(CLASSES_DATABASE).forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card' + (cls.id === this.selectedClassId ? ' selected' : '');
      card.id = 'card-class-' + cls.id;

      card.innerHTML = `
        <div class="class-card-avatar">${cls.avatar}</div>
        <div class="class-card-name">${cls.name}</div>
        <div class="class-card-trait">${cls.trait}</div>
        <div class="class-stats-list">
          <div class="class-stat-row"><span class="stat-name">❤️ Sinh Lực:</span><span class="stat-val">${cls.maxHp} HP</span></div>
          <div class="class-stat-row"><span class="stat-name">💧 Ma Lực:</span><span class="stat-val">${cls.maxMp} MP</span></div>
          <div class="class-stat-row"><span class="stat-name">⚡ Thể Lực:</span><span class="stat-val">${cls.maxSp} SP</span></div>
          <div class="class-stat-row"><span class="stat-name">🛡️ Giáp (AC):</span><span class="stat-val">${cls.ac}</span></div>
          <div class="class-stat-row"><span class="stat-name">⚔️ Thưởng Công:</span><span class="stat-val">+${cls.attackMod} (${cls.damageDice})</span></div>
        </div>
        <div class="class-skills-preview">
          <span class="class-skills-label">Bí Kỹ Khởi Đầu:</span>
          <div class="class-skills-chips">
            ${cls.skills.map(s => {
        const sk = SKILLS_DATABASE ? SKILLS_DATABASE[s] : null;
        return `<span class="class-skill-chip">${sk ? sk.icon + ' ' + sk.name : s.replace(/_/g, ' ')}</span>`;
      }).join('')}
          </div>
        </div>
      `;

      card.onclick = () => {
        this.selectedClassId = cls.id;
        document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      };

      grid.appendChild(card);
    });

    this.classModal.style.display = 'flex';
  }

  startNewGameWithClass(classId) {
    const cls = CLASSES_DATABASE[classId] || CLASSES_DATABASE.warrior;
    SaveManager.clearSave();

    this.currentSkillLearnChoices = null;
    this.skillRerollsLeft = 1;

    // Tao Player voi chi so va ky nang cua class da chon
    this.player = new Player(cls.name, 50);
    this.player.avatar = cls.avatar;
    this.player.hp = cls.hp; this.player.maxHp = cls.maxHp;
    this.player.mp = cls.mp; this.player.maxMp = cls.maxMp;
    this.player.sp = cls.sp; this.player.maxSp = cls.maxSp;
    this.player.ac = cls.ac;
    this.player.attackMod = cls.attackMod;
    this.player.damageDice = cls.damageDice;
    this.player.canBlock = cls.canBlock;
    this.player.canCounter = cls.canCounter;
    this.player.skills = [...cls.skills];
    this.player.classId = cls.id;
    this.player.hasReaction = true;

    this.inventoryManager = new InventoryManager(this.player);

    // Thiet lap trang bi khoi dau phu hop tung class
    if (cls.id === 'mage') {
      this.inventoryManager.equipped.weapon = new Item(ITEMS_DATABASE.apprentice_staff || ITEMS_DATABASE.iron_sword);
      this.inventoryManager.equipped.armor = new Item(ITEMS_DATABASE.mage_robe || ITEMS_DATABASE.leather_armor);
      this.inventoryManager.equipped.shield = null;
    } else if (cls.id === 'rogue' || cls.id === 'thief') {
      this.inventoryManager.equipped.weapon = new Item(ITEMS_DATABASE.rogue_dagger);
      this.inventoryManager.equipped.armor = new Item(ITEMS_DATABASE.leather_armor);
      this.inventoryManager.equipped.shield = null;
    } else {
      this.inventoryManager.equipped.weapon = new Item(ITEMS_DATABASE.iron_sword);
      this.inventoryManager.equipped.armor = new Item(ITEMS_DATABASE.chainmail);
      this.inventoryManager.equipped.shield = new Item(ITEMS_DATABASE.wood_shield);
    }
    this.inventoryManager.syncPlayerEquipmentStats();

    this._setupManagers();
    this._showGameHUD();
    this.mapManager.renderMap();
    this.showScreen('map-screen');
    this.triggerAutoSave();
  }

  // ===========================================================================
  // NEW GAME & CONTINUE
  // ===========================================================================

  handleNewGame() {
    this.openClassSelectModal();
  }

  handleContinueGame() {
    const loadedData = SaveManager.loadGame();
    if (!loadedData) {
      alert('Khong the khoi phuc ban luu! Se bat dau Game Moi.');
      this.handleNewGame();
      return;
    }

    this.player = loadedData.player;
    this.inventoryManager = new InventoryManager(this.player);
    this.inventoryManager.restoreFromData(loadedData.inventoryData);
    this._setupManagers();

    this.mapManager.restoreFromData(loadedData.mapData);
    this._showGameHUD();
    this.showScreen('map-screen');
  }

  /** Tao CombatManager & MapManager voi callbacks chinh */
  _setupManagers() {
    this.combatManager = new CombatManager(
      this.player,
      this.inventoryManager,
      (node) => this.handleCombatVictory(node),
      () => this.handleCombatDefeat()
    );

    this.mapManager = new MapManager(
      (node) => this.handleSelectNode(node),
      (enemyId, node) => this.triggerEventFight(enemyId, node)
    );
  }

  _showGameHUD() {
    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'flex';
    this.updateTopHUD();
  }

  // ===========================================================================
  // MAP NODE INTERACTIONS
  // ===========================================================================

  async handleSelectNode(node) {
    if (node.type === 'starter_reward') {
      const chosenItem = await this.mapManager.openStarterRewardModal(this.inventoryManager);
      if (chosenItem) {
        this.mapManager.completeNode(node);
        this.updateTopHUD();
        this.triggerAutoSave();
      }
      return;
    }

    if (node.type === 'treasure') {
      const claimedItem = await this.mapManager.openTreasureChestModal(this.inventoryManager);
      if (claimedItem) {
        this.mapManager.completeNode(node);
        this.updateTopHUD();
        this.triggerAutoSave();
      }
      return;
    }

    if (node.type === 'shop') {
      await this.mapManager.openShopModal(this.player, this.inventoryManager);
      this.mapManager.completeNode(node);
      this.updateTopHUD();
      this.triggerAutoSave();
      return;
    }

    if (node.type === 'secret') {
      await this.mapManager.openSecretNodeModal(this.player, this.inventoryManager);
      this.mapManager.completeNode(node);
      this.updateTopHUD();
      this.triggerAutoSave();
      return;
    }

    if (node.type === 'event') {
      let isFighting = false;
      await this.mapManager.openEventModal(this.player, this.inventoryManager, (enemyId) => {
        isFighting = true;
        this.triggerEventFight(enemyId, node);
      }, node);
      if (!isFighting) {
        this.mapManager.completeNode(node);
        this.updateTopHUD();
        this.triggerAutoSave();
      }
      return;
    }

    if (node.type === 'rest') {
      this.currentRestNode = node;
      this.updateRestScreenUI();
      this.showScreen('rest-screen');
      return;
    }

    // Combat, Elite, Boss
    this.showScreen('combat-screen');
    const enemyConfig = ENEMIES_DATABASE[node.enemyId] || ENEMIES_DATABASE.goblin;
    const enemy = new Enemy(enemyConfig);
    if (node.type === 'elite') {
      enemy.type = 'elite';
      enemy.monsterType = 'elite';
    } else if (node.type === 'boss') {
      enemy.type = 'boss';
      enemy.monsterType = 'boss';
    } else {
      enemy.type = 'normal';
      enemy.monsterType = 'normal';
    }
    this.combatManager.startCombat(enemy, node);
  }

  triggerEventFight(enemyId, node) {
    this.showScreen('combat-screen');
    const enemyConfig = ENEMIES_DATABASE[enemyId] || ENEMIES_DATABASE.shadow_stalker;
    const enemy = new Enemy(enemyConfig);
    enemy.type = 'elite';
    enemy.monsterType = 'elite';
    this.combatManager.startCombat(enemy, node);
  }

  handleRestSleep() {
    if (!this.currentRestNode) return;
    const hpRestore = Math.round(this.player.maxHp * 0.5);
    const mpRestore = Math.round(this.player.maxMp * 0.5);
    const spRestore = this.player.maxSp;

    const actualHp = this.player.healHp(hpRestore);
    const actualMp = this.player.restoreMp(mpRestore);
    const actualSp = this.player.restoreSp(spRestore);

    this.mapManager.completeNode(this.currentRestNode);
    this.currentRestNode = null;

    this.updateTopHUD();
    this.showScreen('map-screen');
    this.triggerAutoSave();
    alert('⛺ Nghỉ ngơi thành công!\n+' + actualHp + ' HP | +' + actualMp + ' MP | +' + actualSp + ' SP');
  }

  handleRestCleanse() {
    if (!this.currentRestNode) return;
    if (this.player.curses && this.player.curses.length > 0) {
      const cleansed = this.player.curses.pop();
      const curseName = (typeof cleansed === 'object' && cleansed.name) ? cleansed.name : cleansed;
      alert(`✨ Bạn đã tịnh tâm cầu nguyện bên ánh lửa trại!\nThanh tẩy thành công Lời Nguyền: [${curseName}].`);
    } else {
      alert(`✨ Ánh lửa trại ấm áp thanh lọc tâm trí bạn.\nHiện tại bạn không mang Lời Nguyền nào cần hóa giải!`);
    }

    this.mapManager.completeNode(this.currentRestNode);
    this.currentRestNode = null;

    this.updateTopHUD();
    this.showScreen('map-screen');
    this.triggerAutoSave();
  }

  updateRestScreenUI() {
    if (!this.player) return;
    const pointsEl = document.getElementById('rest-skill-points-val');
    const countEl = document.getElementById('rest-skill-count-val');
    const btnLearn = document.getElementById('btn-rest-learn-skill');

    const curPoints = this.player.skillPoints ?? 0;
    const curSkillCount = this.player.skills ? this.player.skills.length : 0;

    if (pointsEl) pointsEl.textContent = curPoints;
    if (countEl) countEl.textContent = `${curSkillCount}/4`;

    if (btnLearn) {
      const isMaxSkills = curSkillCount >= 4;
      const noPoints = curPoints <= 0;

      if (isMaxSkills) {
        btnLearn.disabled = true;
        btnLearn.textContent = '🔒 ĐÃ ĐẠT TỐI ĐA 4 KỸ NĂNG';
      } else if (noPoints) {
        btnLearn.disabled = true;
        btnLearn.textContent = '📖 HỌC KỸ NĂNG MỚI (HẾT ĐIỂM KỸ NĂNG)';
      } else {
        btnLearn.disabled = false;
        btnLearn.textContent = `📖 HỌC KỸ NĂNG MỚI (TỐN 1 ĐIỂM - CÒN ${curPoints} ĐIỂM)`;
      }
    }
  }

  openSkillLearnModal(isReroll = false) {
    if (!this.player) return;

    const modal = document.getElementById('skill-learn-modal');
    const grid = document.getElementById('skill-learn-grid');
    if (!modal || !grid) return;

    const curSkillPoints = this.player.skillPoints ?? 0;
    const curSkillCount = this.player.skills ? this.player.skills.length : 0;
    const isMaxSkills = curSkillCount >= 4;
    const noPoints = curSkillPoints <= 0;

    // Cập nhật thông tin điểm và số kỹ năng trên Header Modal
    const ptsVal = document.getElementById('modal-skill-points-val');
    const countVal = document.getElementById('modal-skill-count-val');
    const alertBox = document.getElementById('skill-learn-alert-box');
    const btnReroll = document.getElementById('btn-reroll-learn-skill');

    if (ptsVal) ptsVal.textContent = curSkillPoints;
    if (countVal) countVal.textContent = `${curSkillCount}/4`;

    if (alertBox) {
      if (isMaxSkills) {
        alertBox.style.display = 'block';
        alertBox.className = 'skill-modal-alert alert-max';
        alertBox.innerHTML = '🔒 <b>Đã đạt giới hạn tối đa 4 Kỹ Năng!</b> Bạn không thể học thêm kỹ năng mới cho chuyến thám hiểm này.';
      } else if (noPoints) {
        alertBox.style.display = 'block';
        alertBox.className = 'skill-modal-alert alert-no-pts';
        alertBox.innerHTML = '⚠️ <b>Bạn hiện có 0 Điểm Kỹ Năng (0 SP)!</b> Hãy đánh bại quái Tinh Anh (Elite) hoặc nghỉ ngơi để nhận thêm Điểm Kỹ Năng.';
      } else {
        alertBox.style.display = 'none';
      }
    }

    const ownedSkills = new Set(this.player.skills || []);
    const playerClass = this.player.classId;
    const seenNames = new Set();

    // Lọc các kỹ năng phù hợp với Class hiện tại, chưa sở hữu, không phải passive, không trùng tên
    const candidateSkills = Object.values(SKILLS_DATABASE).filter(sk => {
      if (!sk || !sk.id || !sk.name) return false;
      if (ownedSkills.has(sk.id)) return false;
      if (sk.type === 'passive' || sk.isPassive) return false;
      if (seenNames.has(sk.name)) return false;

      const req = sk.classReq;
      let matched = false;
      if (!req || req === 'all') matched = true;
      else if (req === playerClass) matched = true;
      else if (playerClass === 'thief' && (req === 'rogue' || req === 'thief')) matched = true;
      else if (playerClass === 'rogue' && (req === 'thief' || req === 'rogue')) matched = true;
      else if (playerClass === 'warrior' && (req === 'knight' || req === 'warrior')) matched = true;
      else if (playerClass === 'knight' && (req === 'warrior' || req === 'knight')) matched = true;

      if (matched) {
        seenNames.add(sk.name);
        return true;
      }
      return false;
    });

    if (candidateSkills.length === 0) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.className = 'skill-modal-alert alert-max';
        alertBox.innerHTML = '🏆 <b>Bạn đã lĩnh hội toàn bộ tất cả Bí Kỹ</b> phù hợp với lớp nhân vật này!';
      }
      grid.innerHTML = '<div class="skill-empty-message">Bạn đã học hết tất cả các kỹ năng hiện có của hệ này.</div>';
      if (btnReroll) btnReroll.style.display = 'none';
      modal.style.display = 'flex';
      return;
    }

    if (this.skillRerollsLeft === undefined) {
      this.skillRerollsLeft = 1;
    }

    // Xử lý danh sách kỹ năng & logic Reroll (chỉ cho phép 1 lần refresh duy nhất)
    if (isReroll) {
      if (this.skillRerollsLeft <= 0) return;
      this.skillRerollsLeft--;

      // Lọc các kỹ năng chưa nằm trong danh sách hiện tại để tối đa hóa lựa chọn mới
      const currentIds = new Set((this.currentSkillLearnChoices || []).map(s => s.id));
      const otherCandidates = candidateSkills.filter(s => !currentIds.has(s.id));

      let newSelected = [];
      if (otherCandidates.length >= 3) {
        const shuffledOthers = [...otherCandidates].sort(() => 0.5 - Math.random());
        newSelected = shuffledOthers.slice(0, 3);
      } else {
        const shuffledOthers = [...otherCandidates].sort(() => 0.5 - Math.random());
        const needed = 3 - shuffledOthers.length;
        const currentPool = candidateSkills.filter(s => currentIds.has(s.id)).sort(() => 0.5 - Math.random());
        newSelected = [...shuffledOthers, ...currentPool.slice(0, needed)];
      }
      this.currentSkillLearnChoices = newSelected;
    } else {
      // Giữ nguyên lựa chọn cũ nếu hợp lệ và không chứa kỹ năng trùng lặp tên
      const choiceNames = new Set();
      const hasValidChoices = Array.isArray(this.currentSkillLearnChoices) &&
        this.currentSkillLearnChoices.length > 0 &&
        this.currentSkillLearnChoices.every(sk => {
          if (!sk || !sk.id || ownedSkills.has(sk.id)) return false;
          if (choiceNames.has(sk.name)) return false;
          choiceNames.add(sk.name);
          return candidateSkills.some(c => c.id === sk.id);
        });

      if (!hasValidChoices) {
        const shuffled = [...candidateSkills].sort(() => 0.5 - Math.random());
        this.currentSkillLearnChoices = shuffled.slice(0, 3);
        this.skillRerollsLeft = 1;
      }
    }

    // Hiển thị và cập nhật trạng thái nút Đổi Lựa Chọn Khác (chỉ 1 lần)
    if (btnReroll) {
      if (candidateSkills.length > 3) {
        btnReroll.style.display = 'inline-flex';
        if (this.skillRerollsLeft > 0) {
          btnReroll.disabled = false;
          btnReroll.innerHTML = '🔄 Đổi Lựa Chọn Khác (Còn 1 lượt)';
        } else {
          btnReroll.disabled = true;
          btnReroll.innerHTML = '🔄 Hết Lượt Đổi (0/1)';
        }
      } else {
        btnReroll.style.display = 'none';
      }
    }

    const selectedThree = this.currentSkillLearnChoices || [];

    grid.innerHTML = '';
    selectedThree.forEach(skill => {
      const card = document.createElement('div');
      card.className = 'skill-learn-card';

      // Định dạng chi phí tiêu hao
      let costBadge = '0 MP';
      if (skill.requiresCombo || skill.costType === 'combo') {
        costBadge = `⚡ ${skill.comboCost || skill.cost || 1} Combo`;
      } else if (skill.requiresRage || skill.costType === 'rage') {
        costBadge = `🔥 ${skill.rageCost || skill.cost || 20} Nộ`;
      } else if (skill.spCost) {
        costBadge = `⚡ ${skill.spCost} SP`;
      } else if (skill.mpCost || skill.mp) {
        costBadge = `💧 ${skill.mpCost || skill.mp} MP`;
      } else if (skill.cost) {
        costBadge = `💧 ${skill.cost} MP`;
      }

      // Loại kỹ năng & Hiệu ứng
      let typeBadge = skill.type ? skill.type.toUpperCase() : 'BÍ KỸ';
      if (skill.applyEffect) {
        const eff = skill.applyEffect;
        typeBadge += ` • ${eff.target === 'self' ? 'Buff' : 'Debuff'} (${eff.id})`;
      }

      const canLearn = !noPoints && !isMaxSkills;
      const buttonText = isMaxSkills ? '🔒 ĐÃ ĐẠT 4 KỸ NĂNG' : (noPoints ? '🔒 HẾT ĐIỂM KỸ NĂNG' : '✨ LĨNH HỘI KỸ NĂNG (TỐN 1 SP)');

      // Icon & định dạng đa emoji để không bao giờ bị tràn khung
      const icon = skill.icon || '⚔️';
      let isMultiIcon = false;
      try {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          isMultiIcon = [...new Intl.Segmenter().segment(icon)].length > 1;
        } else {
          isMultiIcon = icon.length > 2;
        }
      } catch (e) {
        isMultiIcon = (icon.length > 2);
      }
      const iconClass = isMultiIcon ? 'skill-learn-card-icon multi-icon' : 'skill-learn-card-icon';

      card.innerHTML = `
        <div class="skill-learn-card-top">
          <span class="${iconClass}">${icon}</span>
          <div class="skill-learn-card-title">
            <span class="skill-learn-card-name">${skill.name}</span>
            <div class="skill-learn-card-badges">
              <span class="skill-badge-cost">${costBadge}</span>
              <span class="skill-badge-type">${typeBadge}</span>
            </div>
          </div>
        </div>
        <p class="skill-learn-card-desc">${skill.desc || 'Kỹ năng đặc sắc nâng cao sức mạnh chiến đấu.'}</p>
        <button class="btn-confirm-learn" data-skill-id="${skill.id}" ${canLearn ? '' : 'disabled'}>
          ${buttonText}
        </button>
      `;

      const btnChoose = card.querySelector('.btn-confirm-learn');
      if (btnChoose && canLearn) {
        btnChoose.onclick = () => {
          this.confirmLearnSkill(skill);
        };
      }

      grid.appendChild(card);
    });

    modal.style.display = 'flex';
  }

  handleRerollLearnSkills() {
    if (this.skillRerollsLeft <= 0) return;
    this.openSkillLearnModal(true);
  }

  closeSkillLearnModal() {
    const modal = document.getElementById('skill-learn-modal');
    if (modal) modal.style.display = 'none';
  }

  confirmLearnSkill(skill) {
    if (!this.player) return;
    if (this.player.skillPoints <= 0) {
      alert('Không đủ Điểm Kỹ Năng!');
      return;
    }
    if (this.player.skills && this.player.skills.length >= 4) {
      alert('Bạn đã đạt giới hạn tối đa 4 Kỹ Năng!');
      return;
    }

    // Tiêu hao 1 Điểm Kỹ Năng và lĩnh hội kỹ năng mới
    this.player.skillPoints -= 1;
    this.player.skills.push(skill.id);

    // Reset danh sách lựa chọn và hồi lại 1 lượt refresh cho lần học kế tiếp
    this.currentSkillLearnChoices = null;
    this.skillRerollsLeft = 1;

    // Cập nhật CombatManager nếu đang trong trận chiến
    if (this.combatManager && typeof this.combatManager.renderSkillsSubmenu === 'function') {
      this.combatManager.renderSkillsSubmenu();
    }

    this.closeSkillLearnModal();
    this.updateRestScreenUI();
    this.updateTopHUD();
    this.triggerAutoSave();

    alert(`🎉 Chúc mừng!\nBạn đã lĩnh hội thành công Bí Kỹ: [${skill.name}]!\nHiện tại bạn đang sở hữu ${this.player.skills.length}/4 kỹ năng.`);
  }

  // ===========================================================================
  // COMBAT CALLBACKS
  // ===========================================================================

  handleCombatVictory(node) {
    this.updateTopHUD();

    // PvP ket thuc: quay ve Menu
    if (node && node.type === 'pvp_end') {
      alert('👑 Chien thang thuoc ve: ' + node.winner + '!\n\nTran PvP ket thuc. Quay ve Main Menu.');
      this.showScreen('menu-screen');
      const topHud = document.getElementById('top-hud');
      if (topHud) topHud.style.display = 'none';
      this.initMainMenu();
      return;
    }

    // Boss cuoi: Mo End-Run Modal (Thang)
    if (node && node.type === 'boss') {
      SaveManager.clearSave();
      this.openEndRunModal(true);
      return;
    }

    // Node thuong: quay ve ban do
    this.mapManager.completeNode(node);
    this.showScreen('map-screen');
    this._showGameHUD();
    this.triggerAutoSave();
  }

  handleCombatDefeat() {
    this.updateTopHUD();
    SaveManager.clearSave();
    this.openEndRunModal(false);
  }

  // ===========================================================================
  // ===========================================================================
  // END-RUN MODAL (HALL OF FAME: LƯU / KHÔNG LƯU)
  // ===========================================================================

  initEndRunModal() {
    const btnSave = document.getElementById('btn-save-character-roster');
    const btnDiscard = document.getElementById('btn-discard-character');
    const btnCancelSave = document.getElementById('btn-cancel-save-roster');
    const btnSubmitSave = document.getElementById('btn-submit-save-roster');
    const btnGroom = document.getElementById('btn-endrun-groom-inventory');

    // Nút Mở Túi Đồ Chỉnh Trang Trước Khi Lưu Danh
    if (btnGroom) {
      btnGroom.onclick = () => {
        window.isEndGamePhase = true;
        const endRunModal = document.getElementById('end-run-modal');
        if (endRunModal) endRunModal.style.display = 'none';

        if (this.inventoryManager) {
          // Gắn callback tự động hiện lại End-Run Modal khi đóng Túi Đồ
          this.inventoryManager.onModalClose = () => {
            if (window.isEndGamePhase) {
              this.openEndRunModal(this.isLastRunVictory);
            }
          };
          this.inventoryManager.openModal();
        }
      };
    }

    if (btnSave) {
      btnSave.onclick = () => {
        document.getElementById('end-run-main-actions').style.display = 'none';
        document.getElementById('save-roster-input-wrap').style.display = 'flex';
        const nameInput = document.getElementById('roster-hero-name');
        if (nameInput) {
          nameInput.value = this.player ? this.player.name : 'Chiến Binh Bất Tử';
          nameInput.focus();
        }
      };
    }

    if (btnCancelSave) {
      btnCancelSave.onclick = () => {
        document.getElementById('save-roster-input-wrap').style.display = 'none';
        document.getElementById('end-run-main-actions').style.display = 'flex';
      };
    }

    if (btnSubmitSave) {
      btnSubmitSave.onclick = () => {
        const nameInput = document.getElementById('roster-hero-name');
        const customName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : (this.player ? this.player.name : 'Vô Danh Anh Hùng');

        if (this.player && this.inventoryManager) {
          const activeNode = (this.combatManager && this.combatManager.currentNode) ||
            (this.mapManager && this.mapManager.currentNode);
          let currentStage = 1;
          if (activeNode && typeof activeNode.column === 'number') {
            currentStage = activeNode.column + 1;
          } else if (this.mapManager && this.mapManager.columns) {
            let maxCol = 0;
            this.mapManager.columns.forEach((col, idx) => {
              if (col.some(n => n.isCompleted)) maxCol = idx + 1;
            });
            currentStage = Math.max(1, maxCol);
          }

          const saved = SaveManager.saveToRoster(this.player, this.inventoryManager, customName, currentStage);
          if (saved) {
            alert('🏆 Tuyệt vời! Nhân vật "' + customName + '" đã được khắc ghi vào Danh Vọng!\nBây giờ bạn có thể xem lại trong Sảnh Danh Vọng hoặc đưa vào Đấu Trường PvP!');
          }
        }

        window.isEndGamePhase = false;
        document.getElementById('end-run-modal').style.display = 'none';
        this.initMainMenu();
      };
    }

    if (btnDiscard) {
      btnDiscard.onclick = () => {
        const confirmed = confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA BỎ VĨNH VIỄN NHÂN VẬT NÀY?\n\nToàn bộ dữ liệu chuyến hành trình này sẽ bị xóa bỏ và không thể khôi phục lại.');
        if (confirmed) {
          window.isEndGamePhase = false;
          document.getElementById('end-run-modal').style.display = 'none';
          this.initMainMenu();
        }
      };
    }
  }

  openEndRunModal(isVictory = false) {
    if (!this.player) return;
    this.isLastRunVictory = isVictory;

    const modal = document.getElementById('end-run-modal');
    if (!modal) return;

    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'none';

    // Cập nhật header
    const iconEl = document.getElementById('end-run-icon');
    const titleEl = document.getElementById('end-run-title');
    const descEl = document.getElementById('end-run-desc');

    if (iconEl) iconEl.textContent = isVictory ? '👑' : '💀';
    if (titleEl) titleEl.textContent = isVictory ? 'ĐẠI THẮNG QUANG VINH!' : 'HÀNH TRÌNH KHÉP LẠI';
    if (descEl) descEl.textContent = isVictory
      ? 'Bạn đã hạ gục Boss cuối và giải phóng vương quốc! Một chiến công hiển hách lưu danh sử sách.'
      : 'Người anh hùng đã ngã xuống nơi sa trường, nhưng khúc tráng ca vẫn còn mãi ngân vang.';

    // Cập nhật summary
    const avatarEl = document.getElementById('summary-avatar');
    const classNameEl = document.getElementById('summary-class-name');
    const completionEl = document.getElementById('summary-completion-badge');
    const hpEl = document.getElementById('summary-hp');
    const goldEl = document.getElementById('summary-gold');
    const colEl = document.getElementById('summary-column');
    const weaponEl = document.getElementById('summary-weapon');
    const armorEl = document.getElementById('summary-armor');

    if (avatarEl) avatarEl.textContent = this.player.avatar || '🛡️';
    if (classNameEl) classNameEl.textContent = this.player.name;
    if (completionEl) {
      completionEl.textContent = isVictory ? '🏆 Phá Đảo Toàn Bộ' : '💀 Hy Sinh Dọc Đường';
      completionEl.className = isVictory ? 'summary-completion victory' : 'summary-completion defeat';
    }
    if (hpEl) hpEl.textContent = `${Math.max(0, this.player.hp)} / ${this.player.maxHp} HP`;
    if (goldEl) goldEl.textContent = '💰 ' + this.player.gold + ' Vàng';

    if (colEl) {
      const activeNode = (this.combatManager && this.combatManager.currentNode) ||
        (this.mapManager && this.mapManager.currentNode);
      let stageNum = 1;
      if (activeNode && typeof activeNode.column === 'number') {
        stageNum = activeNode.column + 1;
      } else if (this.mapManager && this.mapManager.columns) {
        let maxCol = 0;
        this.mapManager.columns.forEach((col, idx) => {
          if (col.some(n => n.isCompleted)) maxCol = idx + 1;
        });
        stageNum = Math.max(1, maxCol);
      }
      const totalStages = (this.mapManager && this.mapManager.totalStages) || 10;
      colEl.textContent = `Chặng ${stageNum} / ${totalStages}`;
    }

    if (weaponEl && this.inventoryManager) {
      weaponEl.textContent = this.inventoryManager.equipped.weapon
        ? this.inventoryManager.equipped.weapon.name
        : 'Tay Không';
    }
    if (armorEl && this.inventoryManager) {
      armorEl.textContent = this.inventoryManager.equipped.armor
        ? this.inventoryManager.equipped.armor.name
        : 'Áo Vải';
    }

    // Reset về trạng thái chính
    const mainActions = document.getElementById('end-run-main-actions');
    const saveInputWrap = document.getElementById('save-roster-input-wrap');
    if (mainActions) mainActions.style.display = 'flex';
    if (saveInputWrap) saveInputWrap.style.display = 'none';

    modal.style.display = 'flex';
  }

  // ===========================================================================
  // HALL OF FAME (SẢNH DANH VỌNG)
  // ===========================================================================

  openHallOfFame() {
    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'none';

    this.showScreen('hall-of-fame-screen');
    this.renderHallOfFame();
  }

  renderHallOfFame() {
    const roster = SaveManager.getRoster();
    const gridEl = document.getElementById('hof-roster-grid');
    const emptyEl = document.getElementById('hof-empty-state');
    const totalEl = document.getElementById('hof-total-heroes');
    const menuCountEl = document.getElementById('hof-roster-count');
    const pvpRosterCountEl = document.getElementById('pvp-roster-count');

    if (totalEl) totalEl.textContent = `${roster.length} Anh Hùng`;
    if (menuCountEl) menuCountEl.textContent = roster.length;
    if (pvpRosterCountEl) pvpRosterCountEl.textContent = roster.length;

    // Cập nhật trạng thái nút PvP ở Menu
    const btnPvP = document.getElementById('btn-pvp-arena');
    if (btnPvP) btnPvP.disabled = roster.length < 2;

    if (!gridEl || !emptyEl) return;

    if (roster.length === 0) {
      gridEl.style.display = 'none';
      gridEl.innerHTML = '';
      emptyEl.style.display = 'flex';
      return;
    }

    gridEl.style.display = 'grid';
    emptyEl.style.display = 'none';
    gridEl.innerHTML = '';

    roster.forEach(hero => {
      const card = document.createElement('div');
      card.className = 'hof-card';
      card.id = `hof-card-${hero.id}`;

      const savedDate = hero.savedAt
        ? new Date(hero.savedAt).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        : 'Không rõ';

      const stageText = hero.stage ? `Chặng ${hero.stage} / 10` : 'Hành trình';

      // Vũ khí
      let weaponText = 'Tay Không';
      if (hero.equipped && hero.equipped.weapon) {
        weaponText = `${hero.equipped.weapon.name} (${hero.equipped.weapon.damageDice || '1d4'})`;
      }
      // Giáp
      let armorText = 'Áo Vải';
      if (hero.equipped && hero.equipped.armor) {
        armorText = `${hero.equipped.armor.name} (+${hero.equipped.armor.armorClass || 0} AC)`;
      }
      // Khiên
      let shieldHTML = '';
      if (hero.equipped && hero.equipped.shield) {
        shieldHTML = `<div class="hof-equip-line"><span class="hof-equip-icon">🔰</span> <span class="hof-equip-name">${hero.equipped.shield.name}</span></div>`;
      }

      // Cổ vật
      let relicsHTML = '<span class="hof-relics-empty">(Chưa sở hữu cổ vật)</span>';
      if (hero.relics && hero.relics.length > 0) {
        relicsHTML = hero.relics.map((r, idx) => `
          <span class="hof-relic-badge rarity-${r.rarity || 'common'}" data-relic-idx="${idx}">
            <span class="hof-relic-icon">${r.icon || '👑'}</span>
            <span class="hof-relic-name">${r.name}</span>
          </span>
        `).join('');
      }

      card.innerHTML = `
        <div class="hof-card-top">
          <div class="hof-avatar-box">${hero.avatar || '🛡️'}</div>
          <div class="hof-header-info">
            <h3 class="hof-hero-name">${hero.heroName || hero.name}</h3>
            <div class="hof-badge-row">
              <span class="hof-class-tag">${hero.name || 'Chiến Binh'}</span>
              <span class="hof-stage-tag">${stageText}</span>
            </div>
          </div>
          <button class="hof-btn-delete" title="Xóa nhân vật này khỏi Sảnh Danh Vọng" data-id="${hero.id}">
            🗑️
          </button>
        </div>

        <div class="hof-divider"></div>

        <div class="hof-stats-grid">
          <div class="hof-stat-pill stat-hp">
            <span class="hof-stat-icon">❤️</span>
            <div class="hof-stat-detail">
              <span class="hof-stat-lbl">Máu Max</span>
              <span class="hof-stat-num">${hero.maxHp} HP</span>
            </div>
          </div>
          <div class="hof-stat-pill stat-ac">
            <span class="hof-stat-icon">🛡️</span>
            <div class="hof-stat-detail">
              <span class="hof-stat-lbl">Giáp AC</span>
              <span class="hof-stat-num">${hero.ac} AC</span>
            </div>
          </div>
          <div class="hof-stat-pill stat-atk">
            <span class="hof-stat-icon">⚔️</span>
            <div class="hof-stat-detail">
              <span class="hof-stat-lbl">Tấn Công</span>
              <span class="hof-stat-num">+${hero.attackMod} Atk</span>
            </div>
          </div>
          <div class="hof-stat-pill stat-gold">
            <span class="hof-stat-icon">💰</span>
            <div class="hof-stat-detail">
              <span class="hof-stat-lbl">Tài Sản</span>
              <span class="hof-stat-num">${hero.gold || 0} Vàng</span>
            </div>
          </div>
        </div>

        <div class="hof-section-title">🎒 Trang Bị Đang Mặc:</div>
        <div class="hof-equip-list">
          <div class="hof-equip-line hof-equip-weapon"><span class="hof-equip-icon">⚔️</span> <span class="hof-equip-name">${weaponText}</span></div>
          <div class="hof-equip-line hof-equip-armor"><span class="hof-equip-icon">🛡️</span> <span class="hof-equip-name">${armorText}</span></div>
          ${shieldHTML}
        </div>

        <div class="hof-section-title">🔮 Cổ Vật Đã Thu Thập:</div>
        <div class="hof-relics-list">
          ${relicsHTML}
        </div>

        <div class="hof-card-footer">
          <span class="hof-date-text">📅 ${savedDate}</span>
          <button class="hof-btn-pvp" data-id="${hero.id}">
            ⚔️ Đấu Trường PvP
          </button>
        </div>
      `;

      // Nút Xóa nhân vật
      const btnDel = card.querySelector('.hof-btn-delete');
      if (btnDel) {
        btnDel.onclick = (e) => {
          e.stopPropagation();
          const heroDisplayName = hero.heroName || hero.name;
          const confirmed = confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA NHÂN VẬT "${heroDisplayName}"?\n\nNhân vật này sẽ bị xóa vĩnh viễn khỏi Sảnh Danh Vọng và Đấu Trường PvP.`);
          if (confirmed) {
            SaveManager.deleteFromRoster(hero.id);
            this.renderHallOfFame();
          }
        };
      }

      // Nút Tham gia PvP nhanh
      const btnPvPAction = card.querySelector('.hof-btn-pvp');
      if (btnPvPAction) {
        btnPvPAction.onclick = (e) => {
          e.stopPropagation();
          this.openArenaSetup();
        };
      }

      // Gắn Rich Floating Tooltip cho từng Cổ Vật trong Card Danh Vọng
      const relicBadges = card.querySelectorAll('.hof-relic-badge');
      relicBadges.forEach(badge => {
        const idx = parseInt(badge.getAttribute('data-relic-idx'), 10);
        const relicData = (hero.relics && hero.relics[idx]) ? hero.relics[idx] : null;
        if (relicData) {
          const dbData = (ITEMS_DATABASE && ITEMS_DATABASE[relicData.id]) ? ITEMS_DATABASE[relicData.id] : {};
          const fullItem = new Item({
            type: 'relic',
            ...dbData,
            ...relicData
          });
          InventoryManager.attachTooltip(badge, fullItem, 'hof');
        }
      });

      // Gắn Rich Floating Tooltip cho Vũ khí / Giáp / Khiên nếu có
      if (hero.equipped) {
        if (hero.equipped.weapon) {
          const elWep = card.querySelector('.hof-equip-weapon');
          if (elWep) InventoryManager.attachTooltip(elWep, hero.equipped.weapon, 'viewing');
        }
        if (hero.equipped.armor) {
          const elArm = card.querySelector('.hof-equip-armor');
          if (elArm) InventoryManager.attachTooltip(elArm, hero.equipped.armor, 'viewing');
        }
        if (hero.equipped.shield) {
          const elShd = card.querySelector('.hof-equip-shield');
          if (elShd) InventoryManager.attachTooltip(elShd, hero.equipped.shield, 'viewing');
        }
      }

      gridEl.appendChild(card);
    });
  }

  // ===========================================================================
  // ARENA PvP SETUP
  // ===========================================================================

  openArenaSetup() {
    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'none';

    this.showScreen('arena-screen');

    if (!this.arenaManager) {
      this.arenaManager = new ArenaManager(
        (p1, p2) => this.startPvPCombat(p1, p2),
        () => {
          this.showScreen('menu-screen');
          this.initMainMenu();
        }
      );
    }

    this.arenaManager.open();
  }

  startPvPCombat(p1, p2) {
    // Tao CombatManager tam thoi cho PvP (khong dung inventoryManager cua PvE)
    const pvpInvDummy = p1._pvpInventory || this.inventoryManager;
    this.combatManager = new CombatManager(
      p1,
      pvpInvDummy,
      (node) => this.handleCombatVictory(node),
      () => this.handleCombatVictory({ type: 'pvp_end', winner: p2.heroName || p2.name })
    );

    this.showScreen('combat-screen');
    this.combatManager.startPvPCombat(p1, p2);
  }

  // ===========================================================================
  // NAVIGATION & HUD
  // ===========================================================================

  handleReturnToMainMenu() {
    if (this.player && this.inventoryManager && this.mapManager) {
      this.triggerAutoSave();
    }
    const topHud = document.getElementById('top-hud');
    if (topHud) topHud.style.display = 'none';
    this.initMainMenu();
  }

  triggerAutoSave() {
    if (this.player && this.inventoryManager && this.mapManager) {
      SaveManager.saveGame(this.player, this.inventoryManager, this.mapManager);
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active-screen');

    // Quản lý hiển thị app-container chứa (map-screen, combat-screen, rest-screen)
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
      const isIngameScreen = ['map-screen', 'combat-screen', 'rest-screen'].includes(screenId);
      appContainer.style.display = isIngameScreen ? 'flex' : 'none';
    }

    if (this.player) this.updateTopHUD();
    if (screenId === 'map-screen' && this.mapManager) {
      setTimeout(() => this.mapManager.drawMapLines(), 60);
    }
  }

  updateTopHUD() {
    if (!this.player) return;

    const nameEl = document.getElementById('hud-player-name');
    const avatarEl = document.getElementById('hud-player-avatar');
    const classEl = document.getElementById('hud-player-class');
    const hpText = document.getElementById('hud-hp-text');
    const hpBar = document.getElementById('hud-hp-bar');
    const mpText = document.getElementById('hud-mp-text');
    const mpBar = document.getElementById('hud-mp-bar');
    const spText = document.getElementById('hud-sp-text');
    const spBar = document.getElementById('hud-sp-bar');
    const goldEl = document.getElementById('hud-player-gold');
    const acEl = document.getElementById('hud-player-ac');
    const atkEl = document.getElementById('hud-player-atk');

    if (nameEl) nameEl.textContent = this.player.name;
    if (avatarEl) avatarEl.textContent = this.player.avatar || '👤';
    if (classEl) {
      const clsData = CLASSES_DATABASE[this.player.classId];
      const className = clsData ? clsData.name : (this.player.classId ? this.player.classId.toUpperCase() : 'Chiến Binh');
      if (this.player.name && this.player.name.trim().toLowerCase() !== className.trim().toLowerCase()) {
        classEl.style.display = 'inline-block';
        classEl.textContent = className;
      } else {
        classEl.style.display = 'none';
      }
    }
    if (hpText) hpText.textContent = this.player.hp + '/' + this.player.maxHp;
    if (hpBar) hpBar.style.width = Math.max(0, (this.player.hp / this.player.maxHp) * 100) + '%';
    if (mpText) mpText.textContent = this.player.mp + '/' + this.player.maxMp;
    if (mpBar) mpBar.style.width = Math.max(0, (this.player.mp / this.player.maxMp) * 100) + '%';
    if (spText) spText.textContent = this.player.sp + '/' + this.player.maxSp;
    if (spBar) spBar.style.width = Math.max(0, (this.player.sp / this.player.maxSp) * 100) + '%';
    if (goldEl) goldEl.textContent = this.player.gold;
    if (acEl) acEl.textContent = this.player.ac;
    if (atkEl) atkEl.textContent = '+' + this.player.attackMod;

    const curSkillPoints = this.player.skillPoints ?? 0;
    const curSkillCount = this.player.skills ? this.player.skills.length : 0;
    const canLearnSkill = (curSkillPoints > 0) && (curSkillCount < 4);

    const skillPointsEl = document.getElementById('hud-player-skill-points');
    if (skillPointsEl) skillPointsEl.textContent = curSkillPoints;

    const skillBadge = document.getElementById('hud-skill-badge');
    const btnOpenSkills = document.getElementById('btn-open-skills-hud');
    const pillSkill = document.getElementById('hud-skill-pill');

    if (skillBadge) {
      if (canLearnSkill) {
        skillBadge.style.display = 'flex';
        skillBadge.textContent = curSkillPoints;
      } else {
        skillBadge.style.display = 'none';
      }
    }

    if (btnOpenSkills) {
      btnOpenSkills.onclick = () => this.openSkillLearnModal();
      if (canLearnSkill) {
        btnOpenSkills.classList.add('has-points');
        btnOpenSkills.title = `🌟 Có ${curSkillPoints} Điểm Kỹ Năng khả dụng! Nhấn để học Bí Kỹ mới`;
      } else {
        btnOpenSkills.classList.remove('has-points');
        btnOpenSkills.title = `Kỹ Năng & Lĩnh Hội Bí Kỹ (Hiện có: ${curSkillPoints} SP)`;
      }
    }

    if (pillSkill) {
      pillSkill.onclick = () => this.openSkillLearnModal();
      if (canLearnSkill) {
        pillSkill.classList.add('has-points');
        pillSkill.title = `🌟 Có ${curSkillPoints} Điểm Kỹ Năng khả dụng! Nhấp để mở Bảng Lĩnh Hội Kỹ Năng`;
      } else {
        pillSkill.classList.remove('has-points');
        pillSkill.title = `Nhấp để mở Bảng Lĩnh Hội Kỹ Năng (Hiện có: ${curSkillPoints} SP)`;
      }
    }

    // Render danh sách Cổ Vật sở hữu trên Top HUD
    const relicListEl = document.getElementById('hud-relic-list');
    if (relicListEl && this.inventoryManager && this.inventoryManager.backpack) {
      const relics = this.inventoryManager.backpack.filter(i => i && i.type === 'relic');
      if (relics.length > 0) {
        relicListEl.innerHTML = relics.map(r => '<span class="relic-item-badge rarity-' + (r.rarity || 'common') + '" title="' + r.name + ': ' + r.desc + '">' + r.icon + '</span>').join('');
      } else {
        relicListEl.innerHTML = '<span class="relic-empty-hint">(Trống)</span>';
      }
    }
  }
}

// Khoi tao Game khi trang tai xong
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new App();
});
