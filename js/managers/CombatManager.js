/**
 * ============================================================================
 * COMBATMANAGER.JS - VONG LAP CHIEN DAU TURN-BASED (PvE & PvP HOTSEAT)
 * Co che:
 * 1. PvE: Player vs Enemy (Qua vat) - Chi so hoat dong nhu cu.
 * 2. PvP Hotseat: Player1 vs Player2 - Ca 2 deu await chon hanh dong.
 *    - isPvP = true: Thay doi Banner, Command Menu hien thi phien cho P1/P2.
 *    - Block & Counter hoat dong cho ca 2 ben.
 * 3. Het tran PvP -> Khong anh huong du lieu goc Roster.
 * ============================================================================
 */

import { Dice, DiceRoller } from '../models/Dice.js';
import { CLASSES_DATABASE, SKILLS_DATABASE, rollLootByEnemyType, rollEnemyLoot, rollEnemyGold, STATUS_EFFECTS, ITEMS_DATABASE } from '../data/database.js';
import { Item } from '../models/Item.js';
import { InventoryManager } from './InventoryManager.js';

export class CombatManager {
  /**
   * @param {Player} player Nhan vat nguoi choi (PvE) hoac P1 (PvP)
   * @param {InventoryManager} inventoryManager Tui do cua player chinh
   * @param {Function} onVictory Callback(node) khi thang (PvE) hoac ket thuc tran (PvP)
   * @param {Function} onDefeat  Callback() khi thua (PvE)
   */
  constructor(player, inventoryManager, onVictory, onDefeat) {
    this.player = player;
    this.inventoryManager = inventoryManager;
    this.onVictory = onVictory;
    this.onDefeat = onDefeat;

    this.enemy = null;
    this.currentNode = null;
    this.turnCount = 1;
    this.isCombatRunning = false;
    this.isPlayerTurn = true;

    /** PvP mode */
    this.isPvP = false;
    this.pvpP1 = null;
    this.pvpP2 = null;
    this.pvpInv1 = null;
    this.pvpInv2 = null;

    /** Bo giai quyet Promise cho action cua nguoi choi */
    this.playerActionResolver = null;
    /** Bien biet dang la luot cua P1 hay P2 (de hien thi dung UI) */
    this.currentPvPSide = 'p1';

    /** Hệ thống Môi Trường / Địa Hình Chiến Trường (Field / Domain) */
    this.currentField = null;
    this.fieldDuration = 0;
    this._fieldOwnerSide = 'player';

    this.bindDomEvents();
  }

  /**
   * Dang ky su kien Click cho Command Menu
   */
  bindDomEvents() {
    const btnAttack = document.getElementById('btn-cmd-attack');
    if (btnAttack) {
      btnAttack.addEventListener('click', () => {
        if (!this.isPlayerTurn || !this.playerActionResolver) return;
        const actor = this._getActivePlayer();
        if (actor.sp < actor.attackSpCost) {
          this.log('⚠️ Khong du The luc de tan cong! Hay chon [Nghi Ngoi].', 'system-msg');
          return;
        }
        this.resolvePlayerAction({ type: 'attack' });
      });
    }

    const btnSkills = document.getElementById('btn-cmd-skills');
    const skillsSub = document.getElementById('skills-menu-sub');
    const cmdMain = document.getElementById('command-menu-main');
    const btnSkillsBack = document.getElementById('btn-skills-back');

    if (btnSkills && skillsSub && cmdMain) {
      btnSkills.addEventListener('click', () => {
        if (!this.isPlayerTurn) return;
        this.renderSkillsSubmenu();
        cmdMain.style.display = 'none';
        skillsSub.style.display = 'flex';
      });
    }

    if (btnSkillsBack && skillsSub && cmdMain) {
      btnSkillsBack.addEventListener('click', () => {
        skillsSub.style.display = 'none';
        cmdMain.style.display = 'grid';
      });
    }

    const btnRest = document.getElementById('btn-cmd-rest');
    if (btnRest) {
      btnRest.addEventListener('click', () => {
        if (!this.isPlayerTurn || !this.playerActionResolver) return;
        this.resolvePlayerAction({ type: 'rest' });
      });
    }

    const btnInventory = document.getElementById('btn-cmd-inventory');
    if (btnInventory) {
      btnInventory.addEventListener('click', () => {
        if (!this.isPvP) {
          this.inventoryManager.openModal();
        }
      });
    }

    this.inventoryManager.setCombatUsageCallback((msg) => {
      if (this.isCombatRunning && this.isPlayerTurn && this.playerActionResolver && !this.isPvP) {
        this.log('🎒 ' + msg, 'player-msg');
        this.updateArenaUI();
        this.resolvePlayerAction({ type: 'item_used' });
      }
    });

    const btnClearLog = document.getElementById('btn-clear-log');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        const body = document.getElementById('combat-log-body');
        if (body) body.innerHTML = '';
      });
    }
  }

  // ===========================================================================
  // PHAN 1: KHOI DONG TRAN DANH
  // ===========================================================================

  /**
   * Bat dau tran PvE (Player vs Enemy)
   */
  async startCombat(enemy, mapNode) {
    this.isPvP = false;
    this.enemy = enemy;
    this.currentNode = mapNode;
    this.turnCount = 1;
    this.isCombatRunning = true;
    if (this.inventoryManager) this.inventoryManager.activeEnemy = this.enemy;

    // Reset trạng thái Môi Trường
    this.currentField = null;
    this.fieldDuration = 0;
    this._fieldOwnerSide = 'player';
    this.updateBattlefieldUI();

    if (typeof this.player.startTurn === 'function') this.player.startTurn();
    this.player.hasReaction = true;
    this.log('⚔️ BAT DAU TRAN DAU: ' + this.player.name + ' VS ' + this.enemy.name + '!', 'system-msg');
    
    // Kích hoạt hiệu ứng đầu trận đấu từ Trang bị (VD: Khiên Gai Pháo Đài tự nhận Thorns)
    if (this.inventoryManager && this.inventoryManager.equipped) {
      const shield = this.inventoryManager.equipped.shield;
      const weapon = this.inventoryManager.equipped.weapon;
      if (shield && shield.combatStartEffect) {
        this.player.applyEffect(shield.combatStartEffect.id, shield.combatStartEffect.duration, shield.combatStartEffect.value);
        this.showFloatingNumber('player', '🌵 PHÒNG THỦ GAI', 'heal-regen');
        this.log(`🌵 [${shield.name}] kích hoạt: Tự nhận trạng thái Gai Góc (Thorns ${shield.combatStartEffect.duration} hiệp)!`, 'crit-msg');
      }
      if (weapon && weapon.combatStartEffect) {
        this.player.applyEffect(weapon.combatStartEffect.id, weapon.combatStartEffect.duration, weapon.combatStartEffect.value);
        this.log(`✨ [${weapon.name}] kích hoạt hiệu ứng nhập trận!`, 'crit-msg');
      }
      this.updateStatusBars();
    }

    this.updateArenaUI();

    while (this.isCombatRunning && this.player.isAlive() && this.enemy.isAlive()) {
      if (typeof this.player.startTurn === 'function') this.player.startTurn();
      this.player.hasReaction = true;

      // Kích hoạt cổ vật đầu hiệp (VD: Trái Tim Pha Lê hồi 10 HP)
      this._applyPlayerTurnStartRelics(this.player);

      // Luot Player
      this.isPlayerTurn = true;
      await this.handlePlayerTurn(this.player, this.enemy, this.inventoryManager);
      if (!this.enemy.isAlive()) break;

      // Luot Enemy
      this.isPlayerTurn = false;
      await this.handleEnemyTurn();
      if (!this.player.isAlive()) break;

      this.turnCount++;
    }

    this.finishCombat();
  }

  /**
   * Helper sleep voi Promise
   * @param {number} ms So miligiay cho
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * An / hien UI dieu khien thu cong khi vao / ra che do PvP Auto-Battle
   * @param {boolean} isAuto
   */
  _togglePvPAutoUI(isAuto) {
    const cmdMain = document.getElementById('command-menu-main');
    const skillsSub = document.getElementById('skills-menu-sub');
    let autoOverlay = document.getElementById('pvp-auto-overlay');

    if (isAuto) {
      if (cmdMain) cmdMain.style.display = 'none';
      if (skillsSub) skillsSub.style.display = 'none';

      const cmdPanel = document.getElementById('command-panel');
      if (cmdPanel) {
        if (!autoOverlay) {
          autoOverlay = document.createElement('div');
          autoOverlay.id = 'pvp-auto-overlay';
          autoOverlay.className = 'pvp-auto-panel';
          autoOverlay.innerHTML = `
            <div class="auto-battle-badge">
              <span class="auto-battle-icon">⚔️🤖⚔️</span>
              <div class="auto-battle-info">
                <span class="auto-battle-title">CHẾ ĐỘ AUTO-BATTLE ĐANG KÍCH HOẠT</span>
                <span class="auto-battle-desc">Đang tự động giao chiến • Người chơi không cần can thiệp</span>
              </div>
            </div>
          `;
          cmdPanel.appendChild(autoOverlay);
        } else {
          autoOverlay.style.display = 'flex';
        }
      }
    } else {
      if (autoOverlay) autoOverlay.style.display = 'none';
      if (cmdMain) cmdMain.style.display = 'grid';
      if (skillsSub) skillsSub.style.display = 'none';
    }
  }

  /**
   * Bat dau tran PvP Auto-Battle (P1 vs P2)
   * Nguoi choi chon 2 anh hung tu Danh Vong va ngoi xem tu dong chien dau.
   * @param {Player} p1 Nhan vat P1 (da ep kieu tu Roster)
   * @param {Player} p2 Nhan vat P2 (da ep kieu tu Roster)
   */
  async startPvPCombat(p1, p2) {
    this.isPvP = true;
    this.pvpP1 = p1;
    this.pvpP2 = p2;
    this.pvpInv1 = p1._pvpInventory || this.inventoryManager;
    this.pvpInv2 = p2._pvpInventory || this.inventoryManager;
    this.currentNode = null;
    this.turnCount = 1;
    this.isCombatRunning = true;

    p1.hasReaction = true;
    p2.hasReaction = true;

    this.player = p1;
    this.enemy = p2;

    this.log('⚔️ [PvP AUTO-BATTLE] ' + p1.heroName + ' VS ' + p2.heroName + ' - BẮT ĐẦU ĐẠI CHIẾN TỰ ĐỘNG!', 'system-msg');
    this.log('🤖 Hai anh hùng sẽ tự động thi triển chiêu thức và chiến thuật cho đến khi phân định thắng bại.', 'player-msg');
    this.updateArenaUI();

    // 1. Vo hieu hoa va an hoan toan UI dieu khien thu cong
    this._togglePvPAutoUI(true);

    // 2. Delay khoi dong de nguoi choi quan sat
    await this.sleep(1000);

    // 3. Vong lap PvP tu dong (Auto Combat Loop)
    while (this.isCombatRunning && p1.isAlive() && p2.isAlive()) {
      p1.hasReaction = true;
      p2.hasReaction = true;

      // ---- LUOT CUA P1 ----
      this.currentPvPSide = 'p1';
      this.player = p1;
      this.enemy = p2;
      this.updateArenaUI();
      await this.handlePvPAutoTurn(p1, p2);
      if (!p2.isAlive()) break;

      // ---- LUOT CUA P2 ----
      this.currentPvPSide = 'p2';
      this.player = p2;
      this.enemy = p1;
      this.updateArenaUI();
      await this.handlePvPAutoTurn(p2, p1);
      if (!p1.isAlive()) break;

      this.turnCount++;
    }

    await this.finishPvPCombat();
  }

  /**
   * Kết thúc trận đấu PvP Auto-Battle
   * Vinh danh người chiến thắng, hiển thị bảng kết quả PvP và các nút điều hướng (Đấu lại, Về Arena, Về Menu)
   */
  async finishPvPCombat() {
    this.isCombatRunning = false;
    this.currentPvPSide = null;

    const p1 = this.pvpP1;
    const p2 = this.pvpP2;
    const p1Won = p1.isAlive() && !p2.isAlive();
    const p2Won = p2.isAlive() && !p1.isAlive();

    const winner = p1Won ? p1 : (p2Won ? p2 : null);
    const loser = p1Won ? p2 : (p2Won ? p1 : null);

    this.updateArenaUI();

    // 1. Cập nhật Banner
    if (winner) {
      const winnerName = (winner.heroName || winner.name).toUpperCase();
      this.updateBanner('player', `🏆 CHIẾN THẮNG! ${winnerName} ĐÃ GIÀNH CHIẾN THẮNG OANH LIỆT!`);
      this.showFloatingNumber(p1Won ? 'player' : 'enemy', '🏆 CHIẾN THẮNG!', 'crit-msg');
      this.showFloatingNumber(p1Won ? 'enemy' : 'player', '💀 ĐÃ TỬ TRẬN', 'dmg-physical');
    } else {
      this.updateBanner('player', `⚖️ BẤT PHÂN THẮNG BẠI! CẢ HAI ANH HÙNG ĐÃ CHIẾN ĐẤU KIÊN CƯỜNG!`);
    }

    // 2. Ghi nhật ký kết thúc
    this.log('══════════════════════════════════════════════════════════', 'crit-msg');
    if (winner) {
      this.log(`🏆 [KẾT QUẢ ĐẠI CHIẾN] Sau ${this.turnCount} hiệp giao tranh nghẹt thở, ${winner.heroName || winner.name} đã đánh bại ${loser.heroName || loser.name} để bước lên đỉnh vinh quang!`, 'crit-msg');
    } else {
      this.log(`⚖️ [KẾT QUẢ ĐẠI CHIẾN] Trận đấu khép lại với kết quả HÒA sau ${this.turnCount} hiệp!`, 'system-msg');
    }

    // 3. Ẩn Auto Overlay và hiện Bảng Kết Quả PvP với đầy đủ nút bấm điều hướng
    const autoOverlay = document.getElementById('pvp-auto-overlay');
    if (autoOverlay) autoOverlay.style.display = 'none';

    const cmdPanel = document.getElementById('command-panel');
    if (cmdPanel) {
      let resultOverlay = document.getElementById('pvp-result-overlay');
      if (!resultOverlay) {
        resultOverlay = document.createElement('div');
        resultOverlay.id = 'pvp-result-overlay';
        cmdPanel.appendChild(resultOverlay);
      }
      resultOverlay.className = 'pvp-result-panel';
      resultOverlay.style.display = 'flex';

      const winnerTitle = winner ? (winner.heroName || winner.name) : 'Hòa Nhau';
      const winnerHpDesc = winner ? `Máu còn lại: ${winner.hp}/${winner.maxHp} HP` : 'Cả 2 chiến binh đã kiệt sức';

      resultOverlay.innerHTML = `
        <div class="pvp-result-header">
          <div class="pvp-result-crown">👑</div>
          <div class="pvp-result-title">${winner ? 'CHIẾN THẮNG THUỘC VỀ' : 'KẾT QUẢ TRẬN ĐẤU'}</div>
          <div class="pvp-result-winner-name">${winnerTitle}</div>
          <div class="pvp-result-sub">${winnerHpDesc} • Thời lượng: ${this.turnCount} hiệp</div>
        </div>
        <div class="pvp-result-actions">
          <button id="btn-pvp-rematch" class="btn-pvp-action btn-rematch">
            🔄 ĐẤU LẠI (REMATCH)
          </button>
          <button id="btn-pvp-back-arena" class="btn-pvp-action btn-arena-back">
            ⚔️ CHỌN TƯỚNG KHÁC (VỀ ĐẤU TRƯỜNG)
          </button>
          <button id="btn-pvp-back-menu" class="btn-pvp-action btn-menu-back">
            🏠 VỀ MENU CHÍNH
          </button>
        </div>
      `;

      // Gắn sự kiện các nút
      const btnRematch = document.getElementById('btn-pvp-rematch');
      if (btnRematch) {
        btnRematch.onclick = () => {
          resultOverlay.style.display = 'none';
          this._togglePvPAutoUI(false);
          // Khôi phục chỉ số ban đầu cho 2 tuyển thủ
          if (p1) {
            p1.hp = p1.maxHp;
            p1.mp = p1.maxMp;
            p1.sp = p1.maxSp;
            p1.block = 0;
            p1.comboPoints = 0;
            p1.rage = 0;
            p1.statusEffects = [];
          }
          if (p2) {
            p2.hp = p2.maxHp;
            p2.mp = p2.maxMp;
            p2.sp = p2.maxSp;
            p2.block = 0;
            p2.comboPoints = 0;
            p2.rage = 0;
            p2.statusEffects = [];
          }
          if (window.gameApp && typeof window.gameApp.startPvPCombat === 'function') {
            window.gameApp.startPvPCombat(p1, p2);
          } else {
            this.startPvPCombat(p1, p2);
          }
        };
      }

      const btnBackArena = document.getElementById('btn-pvp-back-arena');
      if (btnBackArena) {
        btnBackArena.onclick = () => {
          resultOverlay.style.display = 'none';
          this._togglePvPAutoUI(false);
          this.isPvP = false;
          if (window.gameApp) {
            if (typeof window.gameApp.openArenaSetup === 'function') {
              window.gameApp.openArenaSetup();
            } else {
              window.gameApp.showScreen('arena-screen');
              if (window.gameApp.arenaManager) window.gameApp.arenaManager.open();
            }
          }
        };
      }

      const btnBackMenu = document.getElementById('btn-pvp-back-menu');
      if (btnBackMenu) {
        btnBackMenu.onclick = () => {
          resultOverlay.style.display = 'none';
          this._togglePvPAutoUI(false);
          this.isPvP = false;
          if (window.gameApp) {
            window.gameApp.showScreen('menu-screen');
            window.gameApp.initMainMenu();
          }
        };
      }
    }
  }

  /**
   * Xu ly mot luot PvP tu dong
   * @param {Player} actor Nguoi dang toi luot
   * @param {Combatant} target Doi thu
   */
  async handlePvPAutoTurn(actor, target) {
    const sideLabel = actor === this.pvpP1 ? '[P1 - ' + actor.heroName + ']' : '[P2 - ' + actor.heroName + ']';
    const bannerType = actor === this.pvpP1 ? 'p1' : 'p2';

    this.updateBanner(bannerType, '⚡ [AUTO] LƯỢT CỦA ' + (actor.heroName || actor.name).toUpperCase() + ' (HIỆP ' + this.turnCount + ')');
    this.updateArenaUI();

    // 1. Kich hoat sat thuong / hieu ung Buff / Debuff dau hiep (DoT / HoT / Choang)
    const canAct = await this.processTurnStartEffects(actor, this.currentPvPSide);
    if (!canAct || !actor.isAlive()) {
      this.updateArenaUI();
      await this.sleep(1000);
      return;
    }

    // 2. Cho 1 giay giua cac luot de kip xem hieu ung va nhip tran
    await this.sleep(1000);

    // 3. Goi "Bo Nao AI" quyet dinh hanh dong
    const action = this.determineAutoAction(actor, target);

    // 4. Thuc thi hanh dong
    await this.executePvPAutoAction(actor, target, action, sideLabel);

    // 5. Cho 1.5 giay de hien hieu ung / so sat thuong truoc khi doi luot
    await this.sleep(1500);
  }

  /**
   * "Bo Nao AI" Quyet Dinh Hanh Dong Cho Nhan Vat Dang Toi Luot
   * @param {Player} attacker Nhan vat dang toi luot
   * @param {Combatant} defender Doi thu
   * @returns {{ type: 'skill'|'attack'|'rest'|'block', skillId?: string }}
   */
  determineAutoAction(attacker, defender) {
    const hpRatio = attacker.hp / Math.max(1, attacker.maxHp);
    const blockCost = attacker.blockSpCost || 2;

    // Tuy chon nang cao: Neu HP < 20% va du SP de Do Don, co ty le 30% chon lenh Do Don (Block)
    if (hpRatio < 0.2 && attacker.sp >= blockCost && Math.random() < 0.3) {
      return { type: 'block' };
    }

    // Buoc 1: Quet danh sach Ky nang (attacker.skills)
    // Loc skill du MP, SP va da hoi chieu (cooldown <= 0)
    const usableSkills = (attacker.skills || []).map(id => SKILLS_DATABASE[id]).filter(skill => {
      if (!skill) return false;
      const mpOk = attacker.mp >= (skill.mpCost || 0);
      const spOk = attacker.sp >= (skill.spCost || 0);
      const cdOk = !attacker.skillCooldowns || (attacker.skillCooldowns[skill.id] || 0) <= 0;
      return mpOk && spOk && cdOk;
    });

    if (usableSkills.length > 0) {
      // 1.1. Uu tien Hoi Mau (Heal) neu HP < 70%
      const healSkill = usableSkills.find(s => s.type === 'heal');
      if (healSkill && hpRatio < 0.7) {
        return { type: 'skill', skillId: healSkill.id };
      }

      // 1.2. Uu tien Buff (Hoi mau/Tang sat thuong ma dang KHONG co buff do)
      const buffSkills = usableSkills.filter(s => s.type === 'buff');
      for (const bSkill of buffSkills) {
        // Tranh tu sat: Neu skill ton % HP (nhu Berserk) ma HP <= 25% thi bo qua
        if (bSkill.selfDamagePercent && hpRatio <= 0.25) continue;

        const effectId = bSkill.applyEffect?.id;
        const alreadyHasEffect = effectId ? attacker.hasEffect(effectId) : false;
        if (!alreadyHasEffect) {
          return { type: 'skill', skillId: bSkill.id };
        }
      }

      // 1.3. Uu tien Ky nang Sat Thuong / Xuyen Giap co sat thuong lon nhat
      const dmgSkills = usableSkills.filter(s => s.type === 'damage' || s.type === 'pierce');
      if (dmgSkills.length > 0) {
        const calcDamageScore = (s) => {
          let score = 0;
          if (s.damageDice) {
            const parts = s.damageDice.toLowerCase().split('d');
            const count = parseInt(parts[0], 10) || 1;
            const sides = parseInt(parts[1], 10) || 6;
            score = count * ((sides + 1) / 2);
          }
          if (s.flatDamage) score += s.flatDamage;
          if (s.bonusAtk) score += s.bonusAtk;
          if (s.type === 'pierce') score += 4;
          if (s.applyEffect && s.applyEffect.target === 'enemy' && !defender.hasEffect(s.applyEffect.id)) {
            score += 5; // Uu tien gay debuff moi
          }
          return score;
        };

        dmgSkills.sort((a, b) => calcDamageScore(b) - calcDamageScore(a));
        return { type: 'skill', skillId: dmgSkills[0].id };
      }

      // Neu con skill hoi mau ma HP chua day
      if (healSkill && hpRatio < 0.95) {
        return { type: 'skill', skillId: healSkill.id };
      }
    }

    // Buoc 2: Danh thuong (Basic Attack) neu du SP
    if (attacker.sp >= (attacker.attackSpCost || 2)) {
      return { type: 'attack' };
    }

    // Neu khong du SP de danh thuong -> Mac dinh Nghi Ngoi
    return { type: 'rest' };
  }

  /**
   * Thuc thi hanh dong PvP duoc AI quyet dinh
   * @param {Player} actor Nguoi thuc thi
   * @param {Combatant} target Muc tieu
   * @param {Object} action Hanh dong
   * @param {string} sideLabel Nhan P1 hoac P2
   */
  async executePvPAutoAction(actor, target, action, sideLabel) {
    const actorCardSide = actor === this.pvpP1 ? 'player' : 'enemy';
    const targetCardSide = target === this.pvpP1 ? 'player' : 'enemy';

    // Giảm thời gian hiệu lực trạng thái Điên Cuồng (Berserk) nếu có
    if (actor.isBerserk && actor.isBerserk()) {
      const bStatus = actor.tickBerserk();
      if (bStatus === 'expired') {
        this.showFloatingNumber(actorCardSide, 'HẾT CUỒNG NỘ 💨', 'status-stun');
        this.log('💨 [Cuồng Nộ] Cơn điên cuồng đã kết thúc! Nộ khí trở về 0.', 'system-msg');
      } else {
        this.log(`🔥 [Cuồng Nộ] Đang trong trạng thái Điên Cuồng (Còn ${actor.berserkTurns} hiệp)!`, 'crit-msg');
      }
    }

    // 1. TAN CONG THUONG
    if (action.type === 'attack') {
      actor.spendSp(actor.attackSpCost);
      this.log('🗡️ ' + sideLabel + ' tiêu hao ' + actor.attackSpCost + ' SP và vung đòn tấn công!', 'player-msg');
      this.updateArenaUI();

      // Kiem tra Ne Tranh (Dodge)
      if (target.hasEffect('dodge')) {
        target.removeEffect('dodge');
        this.updateStatusBars();
        this.showFloatingNumber(targetCardSide, 'NÉ ĐÒN! 💨', 'heal-regen');
        this.log('💨 [Né Tránh] ' + (target.heroName || target.name) + ' thi triển thân pháp ảo ảnh, né tránh hoàn toàn đòn đánh của ' + sideLabel + '!', 'crit-msg');
      } else {
        const currentWeapon = actor.equipment ? actor.equipment.weapon : null;
        const res = await actor.attack(target);

        // Build Vu Khi: critThreshold
        if (currentWeapon && currentWeapon.critThreshold && res.d20 >= currentWeapon.critThreshold) {
          res.isCrit = true;
        }

        if (res.isHit) {
          const hitModStr = actor.attackMod ? (actor.attackMod >= 0 ? ` + ${actor.attackMod}` : ` - ${Math.abs(actor.attackMod)}`) : '';
          const rollDetail = `(d20: ${res.d20}${hitModStr} = ${res.totalAttackRoll} vs AC: ${target.ac})`;
          if (res.isCrit) {
            this.log(`💥👑 ${sideLabel} ĐÒN CHÍ MẠNG! ${rollDetail}`, 'crit-msg');
          } else {
            this.log(`⚔️🎯 ${sideLabel} ĐÁNH TRÚNG! ${rollDetail}`, 'player-msg');
          }
          let finalDamage = res.rawDamage;

          // Tích điểm liên kích (Combo Points) cho Đạo Tặc / Sát Thủ khi đòn đánh thường trúng đích
          if (actor.classId === 'thief' || actor.classId === 'rogue') {
            const curCombo = actor.addComboPoint ? actor.addComboPoint(1) : 0;
            this.showFloatingNumber(actorCardSide, `+1 COMBO ⚡`, 'heal-regen');
            this.log('⚡ [Điểm Liên Kích] Đòn đánh trúng đích! Tích lũy +1 Combo (' + curCombo + '/' + (actor.maxComboPoints || 5) + ')', 'player-msg');
          }

          // Tích nộ khí (Rage) cho Chiến Binh / Kỵ Sĩ khi đòn đánh thường trúng đích (+10)
          if (actor.classId === 'warrior' || actor.classId === 'knight') {
            this._handleWarriorRageGain(actor, 10, actorCardSide, 'Đòn đánh thường dũng mãnh');
          }

          // Build Vu Khi: onCritGainDodge
          if (res.isCrit && currentWeapon && currentWeapon.onCritGainDodge) {
            actor.applyEffect('dodge', 1, 0);
            this.showFloatingNumber(actorCardSide, 'NÉ TRÁNH! 💨', 'heal-regen');
            this.log('💨 [' + currentWeapon.name + '] Đòn CHÍ MẠNG xuất thần! Tự nhận buff [Né Tránh]!', 'crit-msg');
            this.updateStatusBars();
          }

          // Build Vu Khi: onHitRestoreMp
          if (currentWeapon && currentWeapon.onHitRestoreMp) {
            const mpRestored = actor.restoreMp(currentWeapon.onHitRestoreMp);
            this.showFloatingNumber(actorCardSide, `+${mpRestored} 💧`, 'heal-regen');
            this.log('💧 [' + currentWeapon.name + '] Hút linh lực: Hồi phục +' + mpRestored + ' MP!', 'player-msg');
          }

          // Buff / Debuff sat thuong
          if (actor.hasEffect('strength')) {
            const strBonus = actor.getEffect('strength').value || 3;
            finalDamage += strBonus;
            this.log('⚔️ [Cường Hóa] Sức mạnh dâng trào: +' + strBonus + ' sát thương!', 'player-msg');
          }
          if (actor.hasEffect('weak')) {
            const reduced = Math.round(finalDamage * 0.25);
            finalDamage = Math.max(1, finalDamage - reduced);
            this.log('⚔️⬇️ [Suy Nhược] Đòn đánh suy yếu (-25%): -' + reduced + ' sát thương.', 'system-msg');
          }
          if (actor.hasEffect('chill')) {
            const chillReduced = Math.round(finalDamage * 0.10);
            finalDamage = Math.max(1, finalDamage - chillReduced);
            this.log('❄️ [Lạnh Buốt] Khí lạnh làm chậm (-10%): -' + chillReduced + ' sát thương.', 'system-msg');
          }
          if (target.hasEffect('vulnerable')) {
            const vulnBonus = Math.round(finalDamage * 0.5);
            finalDamage += vulnBonus;
            this.log('🛡️⬇️ [Phá Giáp] Đối thủ bị vỡ giáp, nhận thêm +50% (+' + vulnBonus + ') sát thương!', 'crit-msg');
          }
          if (target.hasEffect('mark')) {
            const markBonus = Math.round(finalDamage * 0.30);
            finalDamage += markBonus;
            this.log('🎯 [Ám Sát] Đòn đánh trúng Dấu Ấn (+30%): +' + markBonus + ' sát thương!', 'crit-msg');
          }
          if (currentWeapon && currentWeapon.bonusDmgVsPoison && target.hasEffect('poison')) {
            const poisonExtra = Math.round(finalDamage * currentWeapon.bonusDmgVsPoison);
            finalDamage += poisonExtra;
            this.log('💚 [' + currentWeapon.name + '] Mục tiêu đang trúng độc! Cường hóa +20% (+' + poisonExtra + ') sát thương!', 'crit-msg');
          }

          // Hiệu ứng Berserk (Điên Cuồng) của Warrior: Tăng 30% Sát thương vật lý
          if (actor.isBerserk && actor.isBerserk()) {
            const berserkBonus = Math.round(finalDamage * 0.30);
            finalDamage += berserkBonus;
            this.log(`🔥 [Điên Cuồng] Sát thương cuồng bạo (+30%): +${berserkBonus} sát thương!`, 'crit-msg');
          }

          // onHitEffect cua vu khi
          if (currentWeapon && currentWeapon.onHitEffect) {
            const onHit = currentWeapon.onHitEffect;
            const chance = onHit.chance !== undefined ? onHit.chance : 1.0;
            if (Math.random() <= chance) {
              target.applyEffect(onHit.id, onHit.duration, onHit.value || 0);
              const effDef = STATUS_EFFECTS[onHit.id];
              const effName = effDef ? `${effDef.icon} ${effDef.name}` : onHit.id;
              this.showFloatingNumber(targetCardSide, `${effName}`, effDef && effDef.type === 'buff' ? 'heal-regen' : 'dmg-burn');
              this.log('✨ [' + currentWeapon.name + '] Kích hoạt hiệu ứng đòn đánh: Áp dụng [' + effName + '] lên ' + (target.heroName || target.name) + '!', 'crit-msg');
              this.updateStatusBars();
            }
          }

          // Hiệu ứng Berserk (Điên Cuồng): Hút máu bằng 15% sát thương gây ra (Lifesteal)
          if (actor.isBerserk && actor.isBerserk()) {
            const lifesteal = Math.max(1, Math.round(finalDamage * 0.15));
            const healed = actor.healHp(lifesteal);
            this.showFloatingNumber(actorCardSide, `+${healed} 🩸`, 'heal-regen');
            this.log(`🩸 [Hút Máu Cuồng Bạo] Đòn đánh cuồng loạn hồi phục +${healed} HP!`, 'player-msg');
          }

          // Xu ly Do Don (Block) tu dong cho target
          await this._handlePvPBlockReactionAuto(target, res, sideLabel, finalDamage);
        } else {
          const hitModStr = actor.attackMod ? (actor.attackMod >= 0 ? ` + ${actor.attackMod}` : ` - ${Math.abs(actor.attackMod)}`) : '';
          this.log('💨 ' + sideLabel + ' ĐÁNH TRƯỢT (d20: ' + res.d20 + hitModStr + ' = ' + res.totalAttackRoll + ' vs AC: ' + target.ac + ').', 'system-msg');
          // Phan cong (Counter) tu dong neu target co phan xa
          if (target.hasReaction && target.canCounter) {
            await this._handlePvPCounterAttack(target, actor);
          }
        }
      }
    }

    // 2. SU DUNG KY NANG
    else if (action.type === 'skill') {
      const isMage = actor.classId === 'mage';
      const isOvercharged = isMage && actor.isOvercharged && actor.isOvercharged();
      const currentSkillDef = SKILLS_DATABASE[action.skillId];
      let savedMpCost = null;

      // Xử lý Quá Tải Ma Thuật (Mage Overcharge): Chiêu thức miễn phí MP
      if (isOvercharged && currentSkillDef) {
        savedMpCost = currentSkillDef.mpCost;
        currentSkillDef.mpCost = 0;
        this.showFloatingNumber(actorCardSide, 'QUÁ TẢI x2! 🔮', 'crit-msg');
        this.log('💥🔮 [QUÁ TẢI MA THUẬT] Bùng nổ ma lực tối thượng! Kỹ năng x2 Sát thương và miễn phí toàn bộ MP!', 'crit-msg');
      }

      // Xử lý kỹ năng Móc Túi (Pickpocket)
      if (action.skillId === 'pickpocket' || action.skillId === 'thief_pickpocket' || (currentSkillDef && currentSkillDef.isPickpocket)) {
        if (target.hasBeenRobbed) {
          this.showFloatingNumber(targetCardSide, 'KHÔNG CÒN GÌ! 🚫', 'status-stun');
          this.log('⚠️ [Móc Túi] ' + (target.heroName || target.name) + ' không còn gì để trộm!', 'enemy-msg');
        } else {
          target.hasBeenRobbed = true;
          if (Math.random() < 0.20 && this.inventoryManager && ITEMS_DATABASE && ITEMS_DATABASE.health_potion) {
            this.inventoryManager.addItem(new Item(ITEMS_DATABASE.health_potion));
            this.showFloatingNumber(actorCardSide, '+1 BÌNH MÁU! 🧪', 'heal-regen');
            this.log('🧤🧪 [Móc Túi] Xuất thần thó được 1 Bình Máu từ ' + (target.heroName || target.name) + '!', 'crit-msg');
          } else {
            const stolen = Math.floor(Math.random() * 16) + 10;
            actor.addGold(stolen);
            this.showFloatingNumber(actorCardSide, `+${stolen} VÀNG 💰`, 'heal-regen');
            this.log('🧤💰 [Móc Túi] Lẹ tay trộm được ' + stolen + ' Vàng từ ' + (target.heroName || target.name) + '!', 'player-msg');
          }
        }
      }

      const res = await actor.castSkill(action.skillId, target);

      // Khôi phục mpCost và tiêu hao trạng thái Quá tải
      if (isOvercharged && currentSkillDef && savedMpCost !== null) {
        currentSkillDef.mpCost = savedMpCost;
        actor.consumeOvercharge();
        if (res.amount) {
          const oldAmt = res.amount;
          res.amount = Math.round(res.amount * 2);
          const bonusDmg = res.amount - oldAmt;
          if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        }
      } else if (isMage && currentSkillDef && currentSkillDef.mpCost > 0 && res.success) {
        actor.addArcaneCharge && actor.addArcaneCharge(1);
        if (actor.isOvercharged && actor.isOvercharged()) {
          this.showFloatingNumber(actorCardSide, 'QUÁ TẢI SẴN SÀNG! 🔮', 'crit-msg');
          this.log('🔮 [Quá Tải Ma Thuật] Đã tích lũy đủ 3/3 Tinh Thể! Chiêu kế tiếp sẽ x2 Sát thương & MIỄN PHÍ MP!', 'crit-msg');
        }
      }

      // Tích lũy Combo Points từ Kỹ năng (generatesCombo: 1)
      if (res.success && currentSkillDef && currentSkillDef.generatesCombo && typeof actor.addComboPoint === 'function') {
        const pts = actor.addComboPoint(currentSkillDef.generatesCombo);
        this.showFloatingNumber(actorCardSide, `+${currentSkillDef.generatesCombo} COMBO (${pts}/5) 🟡`, 'heal-regen');
        this.log(`🟡 [Liên Kích] [${currentSkillDef.name}] trúng huyệt đạo! Tích lũy +${currentSkillDef.generatesCombo} Điểm Liên Kích (${pts}/5)!`, 'player-msg');
      }

      // Xử lý đòn Kết Liễu (Finisher: Rupture / Eviscerate)
      if (res.success && (action.skillId === 'rupture' || (currentSkillDef && currentSkillDef.id === 'rupture'))) {
        const comboPts = (actor.spendComboPoints ? actor.spendComboPoints() : 0) || 1;
        const multiplier = Math.max(1, comboPts);
        const oldAmt = res.amount || 10;
        res.amount = Math.round(oldAmt * multiplier);
        const bonusDmg = res.amount - oldAmt;
        if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        this.showFloatingNumber(targetCardSide, `BỨC TỬ x${multiplier}! 🩸`, 'dmg-burn');
        this.log(`🩸💥 [Bức Tử] Tiêu hao ${comboPts} Điểm Liên Kích! Sát thương nhân x${multiplier} thành ${res.amount}!`, 'crit-msg');
      } else if (res.success && (action.skillId === 'eviscerate' || action.skillId === 'thief_finisher' || (currentSkillDef && currentSkillDef.type === 'finisher'))) {
        const comboPts = (actor.spendComboPoints ? actor.spendComboPoints() : 0) || 1;
        const multiplier = Math.max(1, comboPts);
        const oldAmt = res.amount || 10;
        res.amount = Math.round(oldAmt * multiplier);
        const bonusDmg = res.amount - oldAmt;
        if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        this.showFloatingNumber(targetCardSide, `CẮT CỔ x${multiplier}! 🩸`, 'dmg-burn');
        this.log('🗡️🩸 [Cắt Cổ (Eviscerate)] Tiêu hao ' + comboPts + ' Điểm Liên Kích! Sát thương nhân x' + multiplier + ' thành ' + res.amount + '!', 'crit-msg');
      }

      // Xử lý Chuỗi Combo Kỹ Năng (Synergy)
      if (res.success) {
        this.handleSkillSynergy(action.skillId, actor, target, res, actorCardSide, targetCardSide, sideLabel);
      }

      // Thông báo Miễn Phí (Free Cast)
      if (res.wasFreeCast) {
        this.showFloatingNumber(actorCardSide, 'MIỄN PHÍ! ✨', 'heal-regen');
        this.log('✨ [Niệm Miễn Phí] Kỹ năng được sử dụng hoàn toàn Miễn Phí (0 MP / 0 SP)!', 'crit-msg');
      }

      // Xử lý Thêm Lượt (Extra Turn)
      if (res.success && currentSkillDef && currentSkillDef.grantExtraTurn) {
        this.hasExtraTurn = true;
        actor.hasExtraTurn = true;
      }

      // Xử lý Thiết Lập Vùng Môi Trường (Field / Domain)
      if (res.success && currentSkillDef && currentSkillDef.setField) {
        const ownerSide = this.isPvP ? this.currentPvPSide : 'player';
        this.setField(currentSkillDef.setField, currentSkillDef.fieldDuration || 3, ownerSide);
      }

      // Xử lý Kỹ năng Chuỗi Tự Động Kích Hoạt (Auto-Cast / Follow-up)
      if (res.success && currentSkillDef && currentSkillDef.autoCastSkill) {
        const followSkill = SKILLS_DATABASE[currentSkillDef.autoCastSkill];
        if (followSkill && target.isAlive()) {
          await new Promise(r => setTimeout(r, 500));
          this.log(`⚔️💥 [LIÊN KÍCH!] [${followSkill.name}] tự động kích hoạt!`, 'crit-msg');
          this.showFloatingNumber(actorCardSide, `LIÊN KÍCH! ⚔️`, 'heal-regen');

          const followRes = await actor.castSkill(followSkill.id, target);
          if (followRes.success) {
            this.handleSkillSynergy(followSkill.id, actor, target, followRes, actorCardSide, targetCardSide, sideLabel);
            if (followRes.amount && followRes.amount > 0) {
              this.shakeCard(targetCardSide);
              this.showFloatingNumber(targetCardSide, `-${followRes.amount} 🩸`, 'dmg-burn');
              this.log(`💥 [${followSkill.name}] bồi thêm ${followRes.amount} sát thương!`, 'crit-msg');
            }
            this.updateArenaUI();
          }
        }
      }

      if (res.success) {
        if (res.appliedEffect) {
          const def = STATUS_EFFECTS[res.appliedEffect.id];
          if (def) {
            const effSide = res.appliedEffect.appliedTo === 'self' ? actorCardSide : targetCardSide;
            this.showFloatingNumber(effSide, `${def.icon} ${def.name}`, def.type === 'buff' ? 'heal-regen' : 'dmg-burn');
            this.log('✨ [' + res.skill.name + '] Áp dụng trạng thái [' + def.name + '] (' + res.appliedEffect.duration + ' hiệp)!', 'crit-msg');
          }
        }

        if (res.type === 'buff') {
          if (res.selfDamage > 0) {
            this.shakeCard(actorCardSide);
            this.showFloatingNumber(actorCardSide, `-${res.selfDamage} 🩸`, 'dmg-burn');
            this.log('🩸 [' + res.skill.name + '] ' + sideLabel + ' hiến tế ' + res.selfDamage + ' HP kích hoạt cuồng nộ!', 'player-msg');
          }
          if (res.blockBonus > 0) {
            this.showFloatingNumber(actorCardSide, `+${res.blockBonus} 🛡️`, 'heal-regen');
            this.log('🛡️ [' + res.skill.name + '] ' + sideLabel + ' dựng lá chắn, nhận +' + res.blockBonus + ' Giáp Ảo!', 'player-msg');
          }
          this.log('✨ ' + sideLabel + ' thi triển bí kỹ [' + res.skill.name + '] cường hóa trạng thái!', 'player-msg');
        } else if (res.type === 'heal') {
          this.showFloatingNumber(actorCardSide, `+${res.amount} 💚`, 'heal-regen');
          this.log('✨ ' + sideLabel + ' trị liệu [' + res.skill.name + '], hồi phục +' + res.amount + ' HP!', 'player-msg');
        } else if (res.type === 'pierce') {
          this.shakeCard(targetCardSide);
          this.showFloatingNumber(targetCardSide, `-${res.amount}`, 'dmg-physical');
          this.log('🗡️ [' + res.skill.name + '] đâm xuyên giáp! Gây ' + res.amount + ' sát thương lên ' + (target.heroName || target.name) + '.', 'player-msg');
        } else if (res.type === 'block_scaling') {
          this.shakeCard(targetCardSide);
          this.showFloatingNumber(targetCardSide, `-${res.amount} 🛡️`, 'dmg-physical');
          this.log('🛡️💥 [' + res.skill.name + '] Tung cú đập khiên bộc phá ' + res.amount + ' sát thương (100% Giáp Ảo) lên ' + (target.heroName || target.name) + '!', 'crit-msg');
        } else if (res.type === 'damage') {
          const bonus = (actor.attackMod || 0) + (res.skill.bonusAtk || 0);
          const bonusStr = bonus !== 0 ? (bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`) : '';
          const rollDetail = res.d20 !== undefined ? ` (d20: ${res.d20}${bonusStr} = ${res.totalRoll || (res.d20 + bonus)} vs AC: ${target.ac})` : '';
          if (res.isHit) {
            this.shakeCard(targetCardSide);
            this.showFloatingNumber(targetCardSide, `-${res.amount}`, res.isCrit ? 'dmg-burn' : 'dmg-physical');
            this.log(`💥 [${res.skill.name}] OANH TẠC TRÚNG ĐÍCH!${rollDetail} Gây ${res.amount} sát thương lên ${target.heroName || target.name}!`, 'crit-msg');
          } else {
            this.log(`💨 [${res.skill.name}] ĐÃ ĐÁNH TRƯỢT!${rollDetail}`, 'system-msg');
          }
        }

        this.updateStatusBars();
      }
    }

    // 3. NGHI NGOI HOI SP
    else if (action.type === 'rest') {
      const restored = actor.restTurn();
      this.showFloatingNumber(actorCardSide, `+${restored} ⚡`, 'heal-regen');
      this.log('🧘 ' + sideLabel + ' lùi lại nghỉ ngơi, hồi phục +' + restored + ' Thể Lực (SP)!', 'player-msg');
    }

    // 4. CHU DONG THU THE (BLOCK)
    else if (action.type === 'block') {
      const blockCost = actor.blockSpCost || 2;
      actor.spendSp(blockCost);
      actor.hasReaction = true;
      this.showFloatingNumber(actorCardSide, 'THỦ THẾ! 🛡️', 'heal-regen');
      this.log('🛡️ ' + sideLabel + ' chủ động thủ thế phòng ngự, giữ khiên sẵn sàng Đỡ Đòn!', 'player-msg');
    }

    this.updateArenaUI();
  }

  /**
   * Tích tụ Nộ Khí (Rage) cho Chiến Binh (Warrior / Knight)
   * Khi đạt 100 nộ khí, tự động kích hoạt trạng thái Điên Cuồng (Berserk) trong 3 hiệp
   * @param {Combatant} combatant
   * @param {number} amount
   * @param {'player'|'enemy'|'p1'|'p2'} side
   * @param {string} reason
   */
  _handleWarriorRageGain(combatant, amount, side, reason = 'Chiến ý dâng trào') {
    if (!combatant || (combatant.classId !== 'warrior' && combatant.classId !== 'knight')) return;
    if (typeof combatant.addRage !== 'function') return;

    const wasBerserk = combatant.isBerserk && combatant.isBerserk();
    const newRage = combatant.addRage(amount);
    const isNowBerserk = combatant.isBerserk && combatant.isBerserk();
    const cardSide = (side === 'player' || side === 'p1') ? 'player' : 'enemy';

    if (!wasBerserk && isNowBerserk) {
      this.showFloatingNumber(cardSide, '🔥 ĐIÊN CUỒNG!', 'dmg-burn');
      this.log(`🔥⚡ [ĐIÊN CUỒNG] Nộ khí bùng nổ 100/100! ${combatant.heroName || combatant.name} bước vào trạng thái Điên Cuồng trong 3 hiệp (+30% Sát thương, 15% Hút máu)!`, 'crit-msg');
    } else if (!wasBerserk) {
      this.showFloatingNumber(cardSide, `+${amount} RAGE 🔥`, 'dmg-burn');
      this.log(`🔥 [Nộ Khí] ${reason}: +${amount} Nộ Khí (${newRage}/100)!`, 'player-msg');
    }
    this.updateArenaUI();
  }

  /**
   * Nội tại Khiên Năng Lượng (Mana Shield) của Pháp Sư:
   * Chuyển hóa 30% sát thương nhận vào thành tiêu hao MP thay vì HP (1 Dmg = 1 MP).
   * @param {Combatant} combatant Nhân vật nhận sát thương
   * @param {number} incomingDmg Lượng sát thương sắp nhận
   * @param {'player'|'enemy'|'p1'|'p2'} side Thẻ giao diện cần hiển thị số nảy
   * @returns {number} Sát thương còn lại tác động vào HP
   */
  _applyManaShield(combatant, incomingDmg, side = 'player') {
    if (!combatant || incomingDmg <= 0) return incomingDmg;
    if (combatant.classId === 'mage' && (combatant.mp || 0) > 0) {
      const wantedAbsorb = Math.max(1, Math.round(incomingDmg * 0.30));
      const actualAbsorb = Math.min(combatant.mp, wantedAbsorb);
      if (actualAbsorb > 0) {
        combatant.mp -= actualAbsorb;
        const remainingDmg = incomingDmg - actualAbsorb;
        const targetSide = (side === 'player' || side === 'p1') ? 'player' : 'enemy';
        this.showFloatingNumber(targetSide, `HẤP THỤ -${actualAbsorb} 🔮`, 'heal-regen');
        this.log(`🔮 [Khiên Năng Lượng] Khiên Ma Thuật đã hấp thụ ${actualAbsorb} sát thương (tiêu hao ${actualAbsorb} MP)!`, 'crit-msg');
        return remainingDmg;
      }
    }
    return incomingDmg;
  }

  /**
   * Xu ly Do Don (Block Reaction) tu dong trong PvP ma khong hien modal hoi
   * @param {Combatant} target Muc tieu bi danh
   * @param {Object} atkResult Ket qua don danh
   * @param {string} attackerLabel Nhan ke tan cong
   * @param {number} incomingDmg Sat thuong sap nhan
   */
  async _handlePvPBlockReactionAuto(target, atkResult, attackerLabel, incomingDmg) {
    let finalDamage = incomingDmg !== undefined ? incomingDmg : atkResult.rawDamage;
    const isTargetP1 = (target === this.pvpP1);
    const targetCardSide = isTargetP1 ? 'player' : 'enemy';
    const targetName = target.heroName || target.name;
    const targetSideInv = isTargetP1 ? this.pvpInv1 : this.pvpInv2;

    // AI quyet dinh Do Don neu co Reaction, co khien va du SP
    if (target.hasReaction && target.canBlock && target.sp >= target.blockSpCost) {
      const hpRatio = target.hp / Math.max(1, target.maxHp);
      const blockChance = hpRatio < 0.4 ? 0.85 : 0.55;

      if (Math.random() < blockChance) {
        target.spendSp(target.blockSpCost);
        target.hasReaction = false;
        this.updateArenaUI();
        this.log('🛡️ [Auto Block] ' + targetName + ' tiêu hao ' + target.blockSpCost + ' SP, giương khiên Đỡ Đòn!', 'player-msg');

        const blockRoll = await DiceRoller.rollWith3DAnimation(
          'ĐỔ D20 ĐỠ ĐÒN: ' + targetName.toUpperCase(),
          targetName + ' gồng mình chặn đứng đòn đánh của ' + attackerLabel
        );

        if (blockRoll + target.ac >= (atkResult.totalAttackRoll || 12) || blockRoll >= 10) {
          const shieldItem = targetSideInv && targetSideInv.equipped ? targetSideInv.equipped.shield : null;
          const blockDiceStr = (shieldItem && shieldItem.blockDice) ? shieldItem.blockDice : '1d6';
          const reduceRoll = Dice.rollNotation(blockDiceStr);
          finalDamage = Math.max(0, finalDamage - reduceRoll.total);
          this.showFloatingNumber(targetCardSide, `CHẶN -${reduceRoll.total} 🛡️`, 'heal-regen');
          this.log('🛡️ ĐỠ ĐÒN THÀNH CÔNG! Khiên giảm ' + reduceRoll.total + ' sát thương (Còn nhận: ' + finalDamage + ').', 'crit-msg');
        } else {
          this.log('💔 Đỡ đòn thất bại (d20: ' + blockRoll + ')! Đòn công kích quá mạnh mẽ.', 'enemy-msg');
        }
      }
    }

    // Khiên Năng Lượng (Mana Shield) của Mage hấp thụ 30% sát thương vào MP
    finalDamage = this._applyManaShield(target, finalDamage, targetCardSide);

    target.takeDamage(finalDamage);
    this.shakeCard(targetCardSide);
    this.showFloatingNumber(targetCardSide, `-${finalDamage}`, atkResult.isCrit ? 'dmg-burn' : 'dmg-physical');
    const critText = atkResult.isCrit ? ' [CHÍ MẠNG!]' : '';
    this.log('🩸 ' + targetName + ' nhận ' + finalDamage + ' sát thương.' + critText, 'enemy-msg');

    // Warrior tích nộ khi mất HP từ đòn đánh (+15)
    if (finalDamage > 0 && (target.classId === 'warrior' || target.classId === 'knight')) {
      this._handleWarriorRageGain(target, 15, targetCardSide, 'Đau đớn kích thích chiến ý');
    }

    // Phan don Gai Goc (Thorns)
    if (target.hasEffect('thorns')) {
      const thornsDmg = target.getEffect('thorns').value || 4;
      const attacker = target === this.pvpP1 ? this.pvpP2 : this.pvpP1;
      attacker.takeDamage(thornsDmg);
      const attackerCardSide = isTargetP1 ? 'enemy' : 'player';
      this.shakeCard(attackerCardSide);
      this.showFloatingNumber(attackerCardSide, `-${thornsDmg} 🌵`, 'dmg-physical');
      this.log('🌵 [Gai Góc] Giáp gai phản đòn, gây ' + thornsDmg + ' sát thương lên ' + (attacker.heroName || attacker.name) + '!', 'player-msg');
    }

    this.updateArenaUI();
  }

  // ===========================================================================
  // PHAN 2: XU LY LUOT DANH
  // ===========================================================================

  /**
   * Xu ly luot cua mot "actor" danh vao "target" - Dung chung cho PvE & PvP
   * @param {Player} actor  Ben dang hanh dong
   * @param {Combatant} target Ben nhan chieu
   * @param {InventoryManager} actorInv Tui do cua actor
   */
  async handlePlayerTurn(actor, target, actorInv) {
    this._extraTurnActive = false;

    while (this.isCombatRunning && actor.isAlive() && target.isAlive()) {
      const sideLabel = this.isPvP
        ? (actor === this.pvpP1 ? '[P1 - ' + actor.heroName + ']' : '[P2 - ' + actor.heroName + ']')
        : actor.name;
      const bannerType = this.isPvP ? (actor === this.pvpP1 ? 'p1' : 'p2') : 'player';

      this.updateBanner(bannerType, 'LƯỢT CỦA ' + (actor.heroName || actor.name).toUpperCase() + ' (HIỆP ' + this.turnCount + ') - CHỌN HÀNH ĐỘNG');
      this.updateArenaUI();
      this.enableCommandMenu(true, actor);

      const action = await this.waitForPlayerAction();
      this.enableCommandMenu(false, actor);

      // Kích hoạt xử lý DoT / HoT / Choáng đầu hiệp đấu (chỉ chạy ở lượt khởi đầu, không lặp lại khi có Extra Turn)
      if (!this._extraTurnActive) {
        const canAct = await this.processTurnStartEffects(actor, this.isPvP ? this.currentPvPSide : 'player');
        if (!canAct || !actor.isAlive()) {
          this.updateArenaUI();
          return;
        }

        // Giảm thời gian hiệu lực trạng thái Điên Cuồng (Berserk) nếu có
        if (actor.isBerserk && actor.isBerserk()) {
          const bStatus = actor.tickBerserk();
          const bSide = this.isPvP ? this.currentPvPSide : 'player';
          if (bStatus === 'expired') {
            this.showFloatingNumber(bSide, 'HẾT CUỒNG NỘ 💨', 'status-stun');
            this.log('💨 [Cuồng Nộ] Cơn điên cuồng đã kết thúc! Nộ khí trở về 0.', 'system-msg');
          } else {
            this.log(`🔥 [Cuồng Nộ] Đang trong trạng thái Điên Cuồng (Còn ${actor.berserkTurns} hiệp)!`, 'crit-msg');
          }
        }
      }
      this._extraTurnActive = false;

    // 1. Tan Cong Thuong
    if (action.type === 'attack') {
      actor.spendSp(actor.attackSpCost);
      this.log('🗡️ ' + sideLabel + ' tieu hao ' + actor.attackSpCost + ' SP va vung don tan cong!', 'player-msg');
      this.updateArenaUI();

      // Kiểm tra Né Tránh (Dodge) của mục tiêu
      if (target.hasEffect('dodge')) {
        target.removeEffect('dodge');
        this.updateStatusBars();
        const dodgeSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
        this.showFloatingNumber(dodgeSide, 'NÉ ĐÒN! 💨', 'heal-regen');
        this.log('💨 [Né Tránh] ' + target.name + ' thi triển thân pháp ảo ảnh, né tránh hoàn toàn đòn đánh của ' + sideLabel + '!', 'crit-msg');
      } else {
        const currentWeapon = this.isPvP
          ? (actor.equipment ? actor.equipment.weapon : null)
          : (this.inventoryManager && this.inventoryManager.equipped ? this.inventoryManager.equipped.weapon : null);

        const res = await actor.attack(target);

        // Build Vũ Khí: critThreshold (Ví dụ: Rìu Huyết Thạch crit 19-20, Bóng Tối Trí Trá crit 17-20)
        if (currentWeapon && currentWeapon.critThreshold && res.d20 >= currentWeapon.critThreshold) {
          res.isCrit = true;
        }

        if (res.isHit) {
          let finalDamage = res.rawDamage;

          // Cơ chế Độc Quyền Thief: Tích lũy Điểm Liên Kích (Combo Points) khi Đánh Thường trúng đích
          if (actor.classId === 'thief' || actor.classId === 'rogue') {
            if (typeof actor.addComboPoint === 'function') {
              const pts = actor.addComboPoint(1);
              const comboSide = this.isPvP ? this.currentPvPSide : 'player';
              this.showFloatingNumber(comboSide, `+1 COMBO (${pts}/5) 🟡`, 'heal-regen');
              this.log(`🟡 [Liên Kích] Đòn đánh chuẩn xác! Tích lũy +1 Điểm Liên Kích (${pts}/5).`, 'player-msg');
            }
          }

          // Cơ chế Độc Quyền Warrior: Tích lũy 10 Nộ Khí (Rage) khi tung đòn Tấn Công Cơ Bản
          if (actor.classId === 'warrior' || actor.classId === 'knight') {
            const actorSide = this.isPvP ? this.currentPvPSide : 'player';
            this._handleWarriorRageGain(actor, 10, actorSide, 'Đòn đánh thường dũng mãnh');
          }

          // Build Vũ Khí: onCritGainDodge (Bóng Tối Trí Trá khi Crit tự nhận Dodge)
          if (res.isCrit && currentWeapon && currentWeapon.onCritGainDodge) {
            actor.applyEffect('dodge', 1, 0);
            const critSide = this.isPvP ? this.currentPvPSide : 'player';
            this.showFloatingNumber(critSide, 'NÉ TRÁNH! 💨', 'heal-regen');
            this.log('💨 [' + currentWeapon.name + '] Đòn CHÍ MẠNG xuất thần! Tự nhận buff [Né Tránh]!', 'crit-msg');
            this.updateStatusBars();
          }

          // Build Vũ Khí: onHitRestoreMp (Quả Cầu Hư Không hồi 2 MP mỗi đòn trúng)
          if (currentWeapon && currentWeapon.onHitRestoreMp) {
            const mpRestored = actor.restoreMp(currentWeapon.onHitRestoreMp);
            const mpSide = this.isPvP ? this.currentPvPSide : 'player';
            this.showFloatingNumber(mpSide, `+${mpRestored} 💧`, 'heal-regen');
            this.log('💧 [' + currentWeapon.name + '] Hút linh lực kẻ thù: Hồi phục +' + mpRestored + ' MP!', 'player-msg');
          }

          // Kích hoạt Cổ vật bị động trong PvE
          if (!this.isPvP && this.inventoryManager && this.inventoryManager.backpack) {
            // 1. Cổ vật Elite: Găng Tay Đồ Tể (+4 Sát thương chuẩn)
            const gauntlet = this.inventoryManager.backpack.find(i => i && i.id === 'butchers_gauntlets');
            if (gauntlet) {
              finalDamage += 4;
              this.log('🥊 [Găng Tay Đồ Tể] Cường hóa đòn đánh: +4 Sát thương chuẩn!', 'crit-msg');
            }

            // 2. Cổ vật Boss: Vương Miện Vua Điên (Chí mạng x3 Sát thương thay vì x2)
            if (res.isCrit) {
              const crown = this.inventoryManager.backpack.find(i => i && i.id === 'mad_king_crown');
              if (crown) {
                const extraCritDmg = Math.floor(res.rawDamage * 0.5);
                finalDamage += extraCritDmg;
                this.log('👑 [Vương Miện Vua Điên] Bạo kích hoàng gia! Đòn CHÍ MẠNG nhân x3 Sát thương (+' + extraCritDmg + ')!', 'crit-msg');
              }
            }

            // 3. Cổ vật Elite: Huyết Nhẫn Hấp Huyết (Hồi 3 HP mỗi đòn trúng)
            const bloodRing = this.inventoryManager.backpack.find(i => i && i.id === 'vampiric_blood_ring');
            if (bloodRing && actor.hp < actor.maxHp) {
              const healed = actor.healHp(3);
              this.log('💍 [Huyết Nhẫn Hấp Huyết] Hút sinh lực địch: Hồi +' + healed + ' HP!', 'player-msg');
            }
          }

          // 1. Áp dụng các hiệu ứng Buff/Debuff lên sát thương gây ra
          if (actor.hasEffect('strength')) {
            const strBonus = actor.getEffect('strength').value || 3;
            finalDamage += strBonus;
            this.log('⚔️ [Cường Hóa] Sức mạnh dâng trào: +' + strBonus + ' sát thương!', 'player-msg');
          }
          if (actor.hasEffect('weak')) {
            const reduced = Math.round(finalDamage * 0.25);
            finalDamage = Math.max(1, finalDamage - reduced);
            this.log('⚔️⬇️ [Suy Nhược] Đòn đánh suy yếu (-25%): -' + reduced + ' sát thương.', 'system-msg');
          }
          if (actor.hasEffect('chill')) {
            const chillReduced = Math.round(finalDamage * 0.10);
            finalDamage = Math.max(1, finalDamage - chillReduced);
            this.log('❄️ [Lạnh Buốt] Khí lạnh làm chậm (-10%): -' + chillReduced + ' sát thương.', 'system-msg');
          }
          if (target.hasEffect('vulnerable')) {
            const vulnBonus = Math.round(finalDamage * 0.5);
            finalDamage += vulnBonus;
            this.log('🛡️⬇️ [Phá Giáp] Mục tiêu bị vỡ giáp, nhận thêm +50% (+' + vulnBonus + ') sát thương!', 'crit-msg');
          }
          if (target.hasEffect('mark')) {
            const markBonus = Math.round(finalDamage * 0.30);
            finalDamage += markBonus;
            this.log('🎯 [Ám Sát] Đòn đánh trúng Dấu Ấn (+30%): +' + markBonus + ' sát thương!', 'crit-msg');
          }

          // Build Vũ Khí: bonusDmgVsPoison (Lưỡi Dao Lục Bảo tăng 20% sát thương nếu mục tiêu trúng độc)
          if (currentWeapon && currentWeapon.bonusDmgVsPoison && target.hasEffect('poison')) {
            const poisonExtra = Math.round(finalDamage * currentWeapon.bonusDmgVsPoison);
            finalDamage += poisonExtra;
            this.log('💚 [' + currentWeapon.name + '] Mục tiêu đang trúng độc! Cường hóa +20% (+' + poisonExtra + ') sát thương!', 'crit-msg');
          }

          // Hiệu ứng Berserk (Điên Cuồng) của Warrior: Tăng 30% Sát thương vật lý
          if (actor.isBerserk && actor.isBerserk()) {
            const berserkBonus = Math.round(finalDamage * 0.30);
            finalDamage += berserkBonus;
            this.log(`🔥 [Điên Cuồng] Sát thương cuồng bạo (+30%): +${berserkBonus} sát thương!`, 'crit-msg');
          }

          // 2. Kích hoạt Hiệu ứng đòn đánh (onHitEffect) của Vũ khí đang trang bị
          if (currentWeapon && currentWeapon.onHitEffect) {
            const onHit = currentWeapon.onHitEffect;
            const chance = onHit.chance !== undefined ? onHit.chance : 1.0;
            if (Math.random() <= chance) {
              target.applyEffect(onHit.id, onHit.duration, onHit.value || 0);
              const effDef = STATUS_EFFECTS[onHit.id];
              const effName = effDef ? `${effDef.icon} ${effDef.name}` : onHit.id;
              const targetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
              this.showFloatingNumber(targetSide, `${effName}`, effDef && effDef.type === 'buff' ? 'heal-regen' : 'dmg-burn');
              this.log('✨ [' + currentWeapon.name + '] kích hoạt hiệu ứng đòn đánh: Áp dụng [' + effName + '] (' + onHit.duration + ' hiệp) lên ' + target.name + '!', 'crit-msg');
              this.updateStatusBars();
            }
          }

          // Hiệu ứng Berserk (Điên Cuồng): Hút máu bằng 15% sát thương gây ra (Lifesteal)
          if (actor.isBerserk && actor.isBerserk()) {
            const lifesteal = Math.max(1, Math.round(finalDamage * 0.15));
            const healed = actor.healHp(lifesteal);
            const lifestealSide = this.isPvP ? this.currentPvPSide : 'player';
            this.showFloatingNumber(lifestealSide, `+${healed} 🩸`, 'heal-regen');
            this.log(`🩸 [Hút Máu Cuồng Bạo] Đòn đánh cuồng loạn hồi phục +${healed} HP!`, 'player-msg');
          }

          // PvP: Hoi Block cho target neu du dieu kien
          if (this.isPvP) {
            await this._handlePvPBlockReaction(target, res, sideLabel);
          } else {
            // Khiên Năng Lượng (Mana Shield) của Mage hấp thụ 30% sát thương vào MP
            finalDamage = this._applyManaShield(target, finalDamage, 'enemy');
            target.takeDamage(finalDamage);
            this.shakeCard('enemy');
            this.showFloatingNumber('enemy', `-${finalDamage}`, res.isCrit ? 'dmg-burn' : 'dmg-physical');
            const critText = res.isCrit ? ' [CHÍ MẠNG!]' : '';
            this.log('💥 ' + sideLabel + ' ĐÁNH TRÚNG! Gây ' + finalDamage + ' sát thương.' + critText, res.isCrit ? 'crit-msg' : 'player-msg');

            // Phản đòn Gai Góc (Thorns) của mục tiêu
            if (target.hasEffect('thorns')) {
              const thornsDmg = target.getEffect('thorns').value || 4;
              actor.takeDamage(thornsDmg);
              this.shakeCard('player');
              this.showFloatingNumber('player', `-${thornsDmg} 🌵`, 'dmg-physical');
              this.log('🌵 [Gai Góc] Lớp giáp gai phản lại ' + thornsDmg + ' sát thương cho ' + sideLabel + '!', 'enemy-msg');
            }
          }
        } else {
          this.log('💨 ' + sideLabel + ' DANH TRUOT (d20: ' + res.d20 + ' + ' + actor.attackMod + ' vs AC: ' + target.ac + ').', 'system-msg');
          // PvP: Khi danh truot -> target co co hoi Phan Cong
          if (this.isPvP && target.hasReaction && target.canCounter) {
            await this._handlePvPCounterAttack(target, actor);
          }
        }
      }
    }

    // 2. Su Dung Ky Nang
    else if (action.type === 'skill') {
      const currentSkillDef = SKILLS_DATABASE[action.skillId];
      const isMage = actor.classId === 'mage';
      const isOvercharged = isMage && actor.isOvercharged && actor.isOvercharged();
      let savedMpCost = null;

      // Mage Overcharge: Nếu đã tích đủ 3 charges, chiêu kế tiếp x2 sát thương và miễn phí toàn bộ MP
      if (isOvercharged && currentSkillDef) {
        savedMpCost = currentSkillDef.mpCost;
        currentSkillDef.mpCost = 0;
        const skillSide = this.isPvP ? this.currentPvPSide : 'player';
        this.showFloatingNumber(skillSide, 'QUÁ TẢI x2! 🔮', 'crit-msg');
        this.log('💥🔮 [QUÁ TẢI MA THUẬT] Bùng nổ ma lực tối thượng! Kỹ năng x2 Sát thương và miễn phí toàn bộ MP!', 'crit-msg');
      }

      // Xử lý kỹ năng Móc Túi (Pickpocket)
      if (action.skillId === 'pickpocket' || action.skillId === 'thief_pickpocket' || (currentSkillDef && currentSkillDef.isPickpocket)) {
        const actorSide = this.isPvP ? this.currentPvPSide : 'player';
        const targetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
        if (target.hasBeenRobbed) {
          this.showFloatingNumber(targetSide, 'KHÔNG CÒN GÌ! 🚫', 'status-stun');
          this.log('⚠️ [Móc Túi] ' + (target.heroName || target.name) + ' không còn gì để trộm!', 'enemy-msg');
        } else {
          target.hasBeenRobbed = true;
          if (Math.random() < 0.20 && this.inventoryManager && ITEMS_DATABASE && ITEMS_DATABASE.health_potion) {
            this.inventoryManager.addItem(new Item(ITEMS_DATABASE.health_potion));
            this.showFloatingNumber(actorSide, '+1 BÌNH MÁU! 🧪', 'heal-regen');
            this.log('🧤🧪 [Móc Túi] Xuất thần thó được 1 Bình Máu từ ' + (target.heroName || target.name) + '!', 'crit-msg');
          } else {
            const stolen = Math.floor(Math.random() * 16) + 10;
            actor.addGold(stolen);
            this.showFloatingNumber(actorSide, `+${stolen} VÀNG 💰`, 'heal-regen');
            this.log('🧤💰 [Móc Túi] Lẹ tay trộm được ' + stolen + ' Vàng từ ' + (target.heroName || target.name) + '!', 'player-msg');
          }
        }
      }

      const res = await actor.castSkill(action.skillId, target);

      // Khôi phục mpCost và tiêu hao trạng thái Quá tải
      if (isOvercharged && currentSkillDef && savedMpCost !== null) {
        currentSkillDef.mpCost = savedMpCost;
        actor.consumeOvercharge();
        if (res.amount) {
          const oldAmt = res.amount;
          res.amount = Math.round(res.amount * 2);
          const bonusDmg = res.amount - oldAmt;
          if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        }
      } else if (isMage && currentSkillDef && currentSkillDef.mpCost > 0 && res.success) {
        actor.addArcaneCharge && actor.addArcaneCharge(1);
        if (actor.isOvercharged && actor.isOvercharged()) {
          const skillSide = this.isPvP ? this.currentPvPSide : 'player';
          this.showFloatingNumber(skillSide, 'QUÁ TẢI SẴN SÀNG! 🔮', 'crit-msg');
          this.log('🔮 [Quá Tải Ma Thuật] Đã tích lũy đủ 3/3 Tinh Thể! Chiêu kế tiếp sẽ x2 Sát thương & MIỄN PHÍ MP!', 'crit-msg');
        }
      }

      // Tích lũy Combo Points từ Kỹ năng (generatesCombo: 1)
      if (res.success && currentSkillDef && currentSkillDef.generatesCombo && typeof actor.addComboPoint === 'function') {
        const pts = actor.addComboPoint(currentSkillDef.generatesCombo);
        const comboSide = this.isPvP ? this.currentPvPSide : 'player';
        this.showFloatingNumber(comboSide, `+${currentSkillDef.generatesCombo} COMBO (${pts}/5) 🟡`, 'heal-regen');
        this.log(`🟡 [Liên Kích] [${currentSkillDef.name}] xuất chiêu trúng huyệt! Tích lũy +${currentSkillDef.generatesCombo} Điểm Liên Kích (${pts}/5).`, 'player-msg');
      }

      // Xử lý đòn Kết Liễu (Finisher: Rupture / Eviscerate)
      if (res.success && (action.skillId === 'rupture' || (currentSkillDef && currentSkillDef.id === 'rupture'))) {
        const comboPts = (actor.spendComboPoints ? actor.spendComboPoints() : 0) || 1;
        const multiplier = Math.max(1, comboPts);
        const oldAmt = res.amount || 10;
        res.amount = Math.round(oldAmt * multiplier);
        const bonusDmg = res.amount - oldAmt;
        if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        const targetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
        this.showFloatingNumber(targetSide, `BỨC TỬ x${multiplier}! 🩸`, 'dmg-burn');
        this.log(`🩸💥 [Bức Tử] Tiêu hao ${comboPts} Điểm Liên Kích! Sát thương nhân x${multiplier} thành ${res.amount}!`, 'crit-msg');
      } else if (res.success && (action.skillId === 'eviscerate' || action.skillId === 'thief_finisher' || (currentSkillDef && currentSkillDef.type === 'finisher'))) {
        const comboPts = (actor.spendComboPoints ? actor.spendComboPoints() : 0) || 1;
        const multiplier = Math.max(1, comboPts);
        const oldAmt = res.amount || 10;
        res.amount = Math.round(oldAmt * multiplier);
        const bonusDmg = res.amount - oldAmt;
        if (bonusDmg > 0 && res.isHit !== false) target.takeDamage(bonusDmg);
        const targetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
        this.showFloatingNumber(targetSide, `CẮT CỔ x${multiplier}! 🩸`, 'dmg-burn');
        this.log('🗡️🩸 [Cắt Cổ (Eviscerate)] Tiêu hao ' + comboPts + ' Điểm Liên Kích! Sát thương nhân x' + multiplier + ' thành ' + res.amount + '!', 'crit-msg');
      }

      // Xử lý Chuỗi Combo Kỹ Năng trong PvP (Synergy)
      if (res.success) {
        const pvpActorSide = this.isPvP ? this.currentPvPSide : 'player';
        const pvpTargetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
        this.handleSkillSynergy(action.skillId, actor, target, res, pvpActorSide, pvpTargetSide, sideLabel);
      }

      // Thông báo Miễn Phí (Free Cast)
      if (res.wasFreeCast) {
        const freeSide = this.isPvP ? this.currentPvPSide : 'player';
        this.showFloatingNumber(freeSide, 'MIỄN PHÍ! ✨', 'heal-regen');
        this.log('✨ [Niệm Miễn Phí] Kỹ năng được sử dụng hoàn toàn Miễn Phí (0 MP / 0 SP)!', 'crit-msg');
      }

      // Xử lý Thêm Lượt (Extra Turn)
      if (res.success && currentSkillDef && currentSkillDef.grantExtraTurn) {
        this.hasExtraTurn = true;
        actor.hasExtraTurn = true;
      }

      // Xử lý Thiết Lập Vùng Môi Trường (Field / Domain)
      if (res.success && currentSkillDef && currentSkillDef.setField) {
        const ownerSide = this.isPvP ? this.currentPvPSide : 'player';
        this.setField(currentSkillDef.setField, currentSkillDef.fieldDuration || 3, ownerSide);
      }

      // Xử lý Kỹ năng Chuỗi Tự Động Kích Hoạt (Auto-Cast / Follow-up)
      if (res.success && currentSkillDef && currentSkillDef.autoCastSkill) {
        const followSkill = SKILLS_DATABASE[currentSkillDef.autoCastSkill];
        if (followSkill && target.isAlive()) {
          const pvpActorSide = this.isPvP ? this.currentPvPSide : 'player';
          const pvpTargetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
          await new Promise(r => setTimeout(r, 500));
          this.log(`⚔️💥 [LIÊN KÍCH!] [${followSkill.name}] tự động kích hoạt!`, 'crit-msg');
          this.showFloatingNumber(pvpActorSide, `LIÊN KÍCH! ⚔️`, 'heal-regen');

          const followRes = await actor.castSkill(followSkill.id, target);
          if (followRes.success) {
            this.handleSkillSynergy(followSkill.id, actor, target, followRes, pvpActorSide, pvpTargetSide, sideLabel);
            if (followRes.amount && followRes.amount > 0) {
              this.shakeCard(pvpTargetSide);
              this.showFloatingNumber(pvpTargetSide, `-${followRes.amount} 🩸`, 'dmg-burn');
              this.log(`💥 [${followSkill.name}] bồi thêm ${followRes.amount} sát thương!`, 'crit-msg');
            }
            this.updateArenaUI();
          }
        }
      }

      if (res.success) {
        if (res.appliedEffect) {
          const def = STATUS_EFFECTS[res.appliedEffect.id];
          if (def) {
            const effSide = res.appliedEffect.appliedTo === 'self' ? (this.isPvP ? this.currentPvPSide : 'player') : (this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy');
            this.showFloatingNumber(effSide, `${def.icon} ${def.name}`, def.type === 'buff' ? 'heal-regen' : 'dmg-burn');
            this.log('✨ [' + res.skill.name + '] Áp dụng trạng thái [' + def.name + '] (' + res.appliedEffect.duration + ' hiệp)!', 'crit-msg');
          }
        }

        if (res.type === 'buff') {
          const buffSide = this.isPvP ? this.currentPvPSide : 'player';
          if (res.selfDamage > 0) {
            this.shakeCard(buffSide);
            this.showFloatingNumber(buffSide, `-${res.selfDamage} 🩸`, 'dmg-burn');
            this.log('🩸 [' + res.skill.name + '] ' + sideLabel + ' hiến tế ' + res.selfDamage + ' HP kích hoạt cơn cuồng nộ!', 'player-msg');
          }
          if (res.blockBonus > 0) {
            this.showFloatingNumber(buffSide, `+${res.blockBonus} 🛡️`, 'heal-regen');
            this.log('🛡️ [' + res.skill.name + '] ' + sideLabel + ' dựng lá chắn, nhận +' + res.blockBonus + ' Giáp Ảo!', 'player-msg');
          }
          this.log('✨ ' + sideLabel + ' thi triển bí kỹ [' + res.skill.name + '] cường hóa trạng thái!', 'player-msg');
        } else if (res.type === 'heal') {
          this.showFloatingNumber(this.isPvP ? this.currentPvPSide : 'player', `+${res.amount} 💚`, 'heal-regen');
          this.log('✨ ' + sideLabel + ' tri lieu [' + res.skill.name + '], hoi phuc +' + res.amount + ' HP!', 'player-msg');
        } else if (res.type === 'pierce') {
          this.shakeCard(this.isPvP && actor === this.pvpP1 ? 'enemy' : 'enemy');
          this.showFloatingNumber(this.isPvP && actor === this.pvpP1 ? 'enemy' : 'enemy', `-${res.amount}`, 'dmg-physical');
          this.log('🗡️ [' + res.skill.name + '] dam xuyen giap! Gay ' + res.amount + ' sat thuong.', 'player-msg');
        } else if (res.type === 'block_scaling') {
          const targetSide = this.isPvP ? (this.currentPvPSide === 'p1' ? 'p2' : 'p1') : 'enemy';
          this.shakeCard(targetSide);
          this.showFloatingNumber(targetSide, `-${res.amount} 🛡️`, 'dmg-physical');
          this.log('🛡️💥 [' + res.skill.name + '] Tung cú đập khiên bộc phá ' + res.amount + ' sát thương (100% Giáp Ảo) lên ' + target.name + '!', 'crit-msg');
        } else if (res.type === 'damage') {
          if (res.isHit) {
            this.shakeCard('enemy');
            this.showFloatingNumber('enemy', `-${res.amount}`, res.isCrit ? 'dmg-burn' : 'dmg-physical');
            this.log('💥 [' + res.skill.name + '] OANH TA, gay ' + res.amount + ' sat thuong uy luc!', 'crit-msg');
          } else {
            this.log('💨 [' + res.skill.name + '] da danh truot!', 'system-msg');
          }
        }

        this.updateStatusBars();
      }
    }

    // 3. Nghi Ngoi hoi SP
    else if (action.type === 'rest') {
      const restored = actor.restTurn();
      this.log('🧘 ' + sideLabel + ' nghi ngoi, hoi phuc +' + restored + ' The Luc (SP)!', 'player-msg');
    }

    // 4. Dung vat pham (PvE only)
    else if (action.type === 'item_used') {
      // Da xu ly qua callback
    }

    this.updateArenaUI();
    await new Promise(r => setTimeout(r, 600));

    // Kiểm tra Thêm Lượt (Extra Turn)
    if (this.hasExtraTurn || actor.hasExtraTurn) {
      this.hasExtraTurn = false;
      actor.hasExtraTurn = false;
      this._extraTurnActive = true;
      this.showFloatingNumber(this.isPvP ? this.currentPvPSide : 'player', 'THÊM LƯỢT! ⚡', 'heal-regen');
      this.log('⚡👑 [THÊM LƯỢT] Bạn nhận thêm 1 Lượt Hành Động ngay lập tức!', 'crit-msg');
      this.updateArenaUI();
      await new Promise(r => setTimeout(r, 600));
      continue;
    }

    break;
  }
}

  /**
   * Xu ly luot Enemy (PvE only) - Quai vat tu dong danh
   * Phan biet ro ret giua Don Danh Thuong (Basic Attack) va Ky Nang / Phep Thuat (Skill / Magic)
   */
  async handleEnemyTurn() {
    this.updateBanner('enemy', 'LUOT CUA ' + this.enemy.name.toUpperCase() + ' DANG HANH DONG...');
    this.updateArenaUI();

    // Xử lý DoT / HoT / Choáng đầu hiệp của quái vật
    const canAct = await this.processTurnStartEffects(this.enemy, 'enemy');
    if (!canAct || !this.enemy.isAlive()) {
      this.updateArenaUI();
      return;
    }

    await new Promise(r => setTimeout(r, 800));

    // 1. Phân loại đòn tấn công của quái: 'skill' (Kỹ năng/Phép thuật) hay 'basic' (Đánh thường)
    let attackType = 'basic';
    let chosenSkill = null;

    if (this.enemy.skills && this.enemy.skills.length > 0) {
      const skillChance = (this.enemy.type === 'boss' || this.enemy.monsterType === 'boss') ? 0.45 : 0.35;
      if (Math.random() < skillChance) {
        const skillId = this.enemy.skills[Math.floor(Math.random() * this.enemy.skills.length)];
        const sk = SKILLS_DATABASE[skillId];
        if (sk) {
          attackType = 'skill';
          chosenSkill = sk;
        }
      }
    }

    // =========================================================================
    // TRƯỜNG HỢP 1: QUÁI DÙNG KỸ NĂNG / PHÉP THUẬT (SKILL / MAGIC)
    // Đánh thẳng vào Player, bỏ qua mọi cơ chế Counter (Tuyệt đối không được phản đòn phép)
    // =========================================================================
    if (attackType === 'skill' && chosenSkill) {
      this.log('🔮 [KỸ NĂNG / PHÉP THUẬT] ' + this.enemy.name + ' vận ma lực niệm chú bí thuật [' + chosenSkill.name + '] nhắm thẳng vào ' + this.player.name + '!', 'crit-msg');

      // Kiểm tra Né Tránh (Dodge)
      if (this.player.hasEffect('dodge')) {
        this.player.removeEffect('dodge');
        this.updateStatusBars();
        this.showFloatingNumber('player', 'NÉ ĐÒN! 💨', 'heal-regen');
        this.log('💨 [Né Tránh] Bạn thi triển thân pháp ảo ảnh, né tránh hoàn toàn phép thuật của ' + this.enemy.name + '!', 'crit-msg');
      } else {
        // Tính sát thương phép thuật
        let magicDamage = 0;
        if (chosenSkill.damageDice) {
          magicDamage = Dice.rollNotation(chosenSkill.damageDice).total;
        }
        if (chosenSkill.flatDamage) magicDamage += chosenSkill.flatDamage;
        if (magicDamage <= 0) magicDamage = 6;
        magicDamage += (this.enemy.attackMod || 2);

        // Áp dụng Cường hóa / Suy nhược của quái & Phá giáp của Player
        if (this.enemy.hasEffect('strength')) {
          magicDamage += this.enemy.getEffect('strength').value || 3;
        }
        if (this.enemy.hasEffect('weak')) {
          magicDamage = Math.max(1, Math.round(magicDamage * 0.75));
        }
        if (this.player.hasEffect('vulnerable')) {
          const extraVuln = Math.round(magicDamage * 0.5);
          magicDamage += extraVuln;
          this.log('🛡️⬇️ [Phá Giáp] Bạn đang bị phá giáp, nhận thêm +50% (+' + extraVuln + ') sát thương phép!', 'enemy-msg');
        }

        this.player.takeDamage(magicDamage);
        this.shakeCard('player');
        this.showFloatingNumber('player', `-${magicDamage} 🔮`, 'dmg-burn');
        this.log('💥 Phép thuật [' + chosenSkill.name + '] giáng thẳng vào người! Gây ' + magicDamage + ' sát thương (Tuyệt đối không thể phản đòn).', 'enemy-msg');

        // Warrior tích nộ khi mất HP từ đòn đánh phép (+15)
        if (magicDamage > 0 && (this.player.classId === 'warrior' || this.player.classId === 'knight')) {
          this._handleWarriorRageGain(this.player, 15, 'player', 'Đau đớn kích thích chiến ý');
        }

        // Áp dụng hiệu ứng nếu skill có cấu hình
        if (chosenSkill.applyEffect) {
          this.player.applyEffect(chosenSkill.applyEffect.id, chosenSkill.applyEffect.duration, chosenSkill.applyEffect.value || 0);
          this.updateStatusBars();
        }
      }
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: QUÁI DÙNG ĐÁNH THƯỜNG (BASIC ATTACK)
    // Có thể kích hoạt phản đòn NẾU Player sở hữu nội tại passive_counter
    // =========================================================================
    else {
      this.log('👹 ' + this.enemy.name + ' vung vuốt lao vào tấn công thường nhắm vào ' + this.player.name + '!', 'enemy-msg');

      // Kiểm tra Né Tránh (Dodge)
      if (this.player.hasEffect('dodge')) {
        this.player.removeEffect('dodge');
        this.updateStatusBars();
        this.showFloatingNumber('player', 'NÉ ĐÒN! 💨', 'heal-regen');
        this.log('💨 [Né Tránh] Bạn thi triển thân pháp ảo ảnh, né tránh hoàn toàn đòn đánh của ' + this.enemy.name + '!', 'crit-msg');
        this.updateArenaUI();
        return;
      }

      const atkResult = await this.enemy.attack(this.player);
      const hasCounterPassive = typeof this.player.hasPassiveCounter === 'function'
        ? this.player.hasPassiveCounter(this.inventoryManager)
        : (this.player.classId === 'warrior' || this.player.classId === 'knight');

      if (atkResult.isHit) {
        let finalDamage = atkResult.rawDamage;

        // Áp dụng Cường hóa / Suy nhược của quái & Phá giáp của Player
        if (this.enemy.hasEffect('strength')) {
          finalDamage += this.enemy.getEffect('strength').value || 3;
        }
        if (this.enemy.hasEffect('weak')) {
          finalDamage = Math.max(1, Math.round(finalDamage * 0.75));
        }
        if (this.player.hasEffect('vulnerable')) {
          const extraVuln = Math.round(finalDamage * 0.5);
          finalDamage += extraVuln;
          this.log('🛡️⬇️ [Phá Giáp] Bạn đang bị phá giáp, nhận thêm +50% (+' + extraVuln + ') sát thương!', 'enemy-msg');
        }

        // ĐIỀU KIỆN PHẢN ĐÒN (COUNTER):
        // Nếu Quái dùng Đánh Thường (Basic Attack) VÀ Player sở hữu nội tại passive_counter
        if (hasCounterPassive) {
          // 1. Kỵ Sĩ gạt đòn (block một phần hoặc toàn bộ sát thương)
          const shieldItem = this.inventoryManager && this.inventoryManager.equipped ? this.inventoryManager.equipped.shield : null;
          const blockDiceStr = (shieldItem && shieldItem.blockDice) ? shieldItem.blockDice : '1d8';
          const reduceRoll = Dice.rollNotation(blockDiceStr);
          const blockedAmount = reduceRoll.total + Math.max(1, Math.floor((this.player.ac - 10) / 2));
          const actualDamage = Math.max(0, finalDamage - blockedAmount);

          this.log('🛡️⚔️ [Nội Tại Bậc Thầy Cận Chiến] Kỵ Sĩ đã gạt đòn và phản công chớp nhoáng!', 'crit-msg');
          this.showFloatingNumber('player', `GẠT ĐÒN -${blockedAmount} 🛡️`, 'heal-regen');

          if (actualDamage > 0) {
            this.player.takeDamage(actualDamage);
            this.shakeCard('player');
            this.showFloatingNumber('player', `-${actualDamage}`, atkResult.isCrit ? 'dmg-burn' : 'dmg-physical');
            this.log('🩸 ' + this.player.name + ' gạt đỡ bớt uy lực, nhận ' + actualDamage + ' sát thương còn lại.', 'player-msg');
            // Warrior tích nộ khi mất HP từ đòn đánh (+15)
            if (this.player.classId === 'warrior' || this.player.classId === 'knight') {
              this._handleWarriorRageGain(this.player, 15, 'player', 'Đòn đánh xuyên qua khiên');
            }
          } else {
            this.showFloatingNumber('player', 'CHẶN ĐỨNG! 🛡️', 'heal-regen');
            this.log('🛡️ Kỵ Sĩ hóa giải triệt để toàn bộ đòn đánh của quái vật!', 'crit-msg');
          }

          // 2. Tự động phản đòn gây sát thương vật lý lên quái
          const dmgRoll = Dice.rollNotation(this.player.damageDice || '1d8');
          let counterDmg = dmgRoll.total + (this.player.attackMod || 3);
          const equippedWeapon = this.inventoryManager && this.inventoryManager.equipped ? this.inventoryManager.equipped.weapon : null;
          if (equippedWeapon && equippedWeapon.counterDamageBonus) {
            const extraCounter = Math.round(counterDmg * equippedWeapon.counterDamageBonus);
            counterDmg += extraCounter;
            this.log('🔱 [' + equippedWeapon.name + '] Cường hóa phản đòn +50% (+' + extraCounter + ') sát thương!', 'crit-msg');
          }

          this.enemy.takeDamage(counterDmg);
          this.shakeCard('enemy');
          this.showFloatingNumber('enemy', `-${counterDmg} ⚡`, 'dmg-physical');
          this.log('⚔️ Kỵ Sĩ chém phản kích chớp nhoáng! Gây ' + counterDmg + ' sát thương vật lý lên ' + this.enemy.name + '!', 'player-msg');

          // Warrior kích hoạt phản đòn (Counter) thành công: +20 Rage
          if (this.player.classId === 'warrior' || this.player.classId === 'knight') {
            this._handleWarriorRageGain(this.player, 20, 'player', 'Phản đòn xuất thần');
          }
        } else {
          // Player KHÔNG có passive_counter: Cơ chế Đỡ Đòn (Active Block) thủ công
          if (this.player.hasReaction && this.player.canBlock && this.player.sp >= this.player.blockSpCost) {
            const wantToBlock = await this.promptPlayerActiveBlock(this.player);
            if (wantToBlock) {
              this.player.spendSp(this.player.blockSpCost);
              this.player.hasReaction = false;
              this.updateArenaUI();
              this.log('🛡️ ' + this.player.name + ' tiêu hao ' + this.player.blockSpCost + ' SP, giơ khiên Đỡ Đòn!', 'player-msg');

              const blockRoll = await DiceRoller.rollWith3DAnimation(
                'ĐỔ D20 ĐỠ ĐÒN (BLOCK)',
                this.player.name + ' dồn sức chống đỡ cú giáng của ' + this.enemy.name
              );
              if (blockRoll + this.player.ac >= atkResult.totalAttackRoll || blockRoll >= 10) {
                const shieldItem = this.inventoryManager.equipped.shield;
                const blockDiceStr = (shieldItem && shieldItem.blockDice) ? shieldItem.blockDice : '1d6';
                const reduceRoll = Dice.rollNotation(blockDiceStr);
                finalDamage = Math.max(0, finalDamage - reduceRoll.total);
                this.log('🛡️ ĐỠ ĐÒN THÀNH CÔNG! Khiên chặn ' + reduceRoll.total + ' sát thương (Còn lại: ' + finalDamage + ').', 'crit-msg');
              } else {
                this.log('💔 ĐỠ ĐÒN THẤT BẠI (d20: ' + blockRoll + '). Đòn đánh quá mạnh!', 'enemy-msg');
              }
            } else {
              this.log('💔 ' + this.player.name + ' không đỡ đòn.', 'system-msg');
            }
          }

          // Khiên Năng Lượng (Mana Shield) của Mage hấp thụ 30% sát thương vào MP
          finalDamage = this._applyManaShield(this.player, finalDamage, 'player');

          this.player.takeDamage(finalDamage);
          this.shakeCard('player');
          this.showFloatingNumber('player', `-${finalDamage}`, atkResult.isCrit ? 'dmg-burn' : 'dmg-physical');
          const critNote = atkResult.isCrit ? ' [CHÍ MẠNG]!' : '';
          this.log('🩸 ' + this.enemy.name + ' gây ' + finalDamage + ' sát thương.' + critNote, 'enemy-msg');

          // Warrior tích nộ khi mất HP từ đòn đánh thường (+15)
          if (finalDamage > 0 && (this.player.classId === 'warrior' || this.player.classId === 'knight')) {
            this._handleWarriorRageGain(this.player, 15, 'player', 'Hứng chịu đòn đánh trực diện');
          }
        }

        // Phản đòn Gai Góc (Thorns) của người chơi
        if (this.player.hasEffect('thorns')) {
          const thornsDmg = this.player.getEffect('thorns').value || 4;
          this.enemy.takeDamage(thornsDmg);
          this.shakeCard('enemy');
          this.showFloatingNumber('enemy', `-${thornsDmg} 🌵`, 'dmg-physical');
          this.log('🌵 [Gai Góc] Lớp giáp gai phản đòn, gây ' + thornsDmg + ' sát thương cho ' + this.enemy.name + '!', 'player-msg');
        }
      } else {
        // Quái đánh trượt
        this.log('💨 ' + this.enemy.name + ' đánh trượt! (d20: ' + atkResult.d20 + ' vs AC: ' + this.player.ac + ')', 'system-msg');

        // Chỉ phản công khi có nội tại Bậc Thầy Cận Chiến
        if (hasCounterPassive) {
          this.log('🛡️⚔️ [Nội Tại Bậc Thầy Cận Chiến] Kỵ Sĩ đã gạt đòn và phản công chớp nhoáng!', 'crit-msg');
          const dmgRoll = Dice.rollNotation(this.player.damageDice || '1d8');
          let counterDmg = dmgRoll.total + (this.player.attackMod || 3);
          const equippedWeapon = this.inventoryManager && this.inventoryManager.equipped ? this.inventoryManager.equipped.weapon : null;
          if (equippedWeapon && equippedWeapon.counterDamageBonus) {
            counterDmg += Math.round(counterDmg * equippedWeapon.counterDamageBonus);
          }
          this.enemy.takeDamage(counterDmg);
          this.shakeCard('enemy');
          this.showFloatingNumber('enemy', `-${counterDmg} ⚡`, 'dmg-physical');
          this.log('⚔️ Kỵ Sĩ phản công trúng đích! Gây ' + counterDmg + ' sát thương lên ' + this.enemy.name + '!', 'player-msg');

          // Warrior kích hoạt phản đòn (Counter) thành công: +20 Rage
          if (this.player.classId === 'warrior' || this.player.classId === 'knight') {
            this._handleWarriorRageGain(this.player, 20, 'player', 'Phản đòn xuất thần');
          }
        }
      }
    }

    this.updateArenaUI();
    await new Promise(r => setTimeout(r, 600));
  }

  // ===========================================================================
  // PHAN 3: CO CHE BLOCK & COUNTER TRONG PvP
  // ===========================================================================

  /**
   * Khi actor danh trung target trong PvP -> Hoi target co muon Block khong
   */
  async _handlePvPBlockReaction(target, atkResult, attackerLabel) {
    let finalDamage = atkResult.rawDamage;
    const targetSideInv = target === this.pvpP1 ? this.pvpInv1 : this.pvpInv2;

    if (target.hasReaction && target.canBlock && target.sp >= target.blockSpCost) {
      const wantToBlock = await this.promptPlayerActiveBlock(target);
      if (wantToBlock) {
        target.spendSp(target.blockSpCost);
        target.hasReaction = false;
        this.updateArenaUI();
        this.log('🛡️ ' + (target.heroName || target.name) + ' tieu hao ' + target.blockSpCost + ' SP, Do Don!', 'player-msg');

        const blockRoll = await DiceRoller.rollWith3DAnimation(
          'DO D20 DO DON: ' + (target.heroName || target.name).toUpperCase(),
          (target.heroName || target.name) + ' giu khien chong do!'
        );
        if (blockRoll + target.ac >= atkResult.totalAttackRoll || blockRoll >= 10) {
          const shieldItem = targetSideInv.equipped.shield;
          const blockDiceStr = (shieldItem && shieldItem.blockDice) ? shieldItem.blockDice : '1d6';
          const reduceRoll = Dice.rollNotation(blockDiceStr);
          finalDamage = Math.max(0, finalDamage - reduceRoll.total);
          this.log('🛡️ DO DON THANH CONG! Giam ' + reduceRoll.total + ' sat thuong. Con lai: ' + finalDamage + '.', 'crit-msg');
        } else {
          this.log('💔 Do Don that bai! Don danh qua manh.', 'enemy-msg');
        }
      }
    }

    const isTargetP1 = (target === this.pvpP1);
    finalDamage = this._applyManaShield(target, finalDamage, isTargetP1 ? 'player' : 'enemy');

    target.takeDamage(finalDamage);
    // Lay dung card de rung
    this.shakeCard(isTargetP1 ? 'player' : 'enemy');
    const critText = atkResult.isCrit ? ' [CHI MANG!]' : '';
    this.log('🩸 ' + (target.heroName || target.name) + ' nhan ' + finalDamage + ' sat thuong.' + critText, 'enemy-msg');

    // Warrior tích nộ khi mất HP từ đòn đánh (+15)
    if (finalDamage > 0 && (target.classId === 'warrior' || target.classId === 'knight')) {
      this._handleWarriorRageGain(target, 15, isTargetP1 ? 'player' : 'enemy', 'Đau đớn kích thích chiến ý');
    }

    this.updateArenaUI();
  }

  /**
   * Khi actor danh truot target trong PvP -> Target co co hoi Phan Cong
   */
  async _handlePvPCounterAttack(counterAttacker, victim) {
    counterAttacker.hasReaction = false;
    this.updateArenaUI();
    this.log('⚡ [PHAN UNG - PvP]: ' + (counterAttacker.heroName || counterAttacker.name) + ' phan cong!', 'crit-msg');

    const counterRoll = await DiceRoller.rollWith3DAnimation(
      'DO D20 PHAN CONG: ' + (counterAttacker.heroName || counterAttacker.name).toUpperCase(),
      (counterAttacker.heroName || counterAttacker.name) + ' chop thoi co chem tra!'
    );
    const counterBonus = counterAttacker.attackMod || 0;
    const counterBonusStr = counterBonus >= 0 ? ` + ${counterBonus}` : ` - ${Math.abs(counterBonus)}`;
    const counterTotal = counterRoll + counterBonus;
    const isCounterHit = counterTotal >= victim.ac || counterRoll === 20;

    if (isCounterHit) {
      const dmgRoll = Dice.rollNotation(counterAttacker.damageDice);
      let counterDmg = dmgRoll.total + counterAttacker.attackMod;
      const counterWeapon = counterAttacker.equipment ? counterAttacker.equipment.weapon : null;
      if (counterWeapon && counterWeapon.counterDamageBonus) {
        const extraCounter = Math.round(counterDmg * counterWeapon.counterDamageBonus);
        counterDmg += extraCounter;
        this.log('🔱 [' + counterWeapon.name + '] Cường hóa phản đòn +50% (+' + extraCounter + ') sát thương!', 'crit-msg');
      }
      victim.takeDamage(counterDmg);
      const isVictimP1 = (victim === this.pvpP1);
      this.shakeCard(isVictimP1 ? 'player' : 'enemy');
      this.log('⚔️ PHẢN CÔNG TRÚNG! (d20: ' + counterRoll + counterBonusStr + ' = ' + counterTotal + ' vs AC: ' + victim.ac + ') Gây ' + counterDmg + ' sát thương!', 'player-msg');

      // Warrior kích hoạt phản đòn (Counter) thành công: +20 Rage
      if (counterAttacker.classId === 'warrior' || counterAttacker.classId === 'knight') {
        const counterSide = isVictimP1 ? 'enemy' : 'player';
        this._handleWarriorRageGain(counterAttacker, 20, counterSide, 'Phản đòn thần tốc');
      }
    } else {
      this.log('💨 Phản công bị né tránh (d20: ' + counterRoll + counterBonusStr + ' = ' + counterTotal + ' vs AC: ' + victim.ac + ').', 'system-msg');
    }

    this.updateArenaUI();
  }

  // ===========================================================================
  // PHAN 4: KET THUC TRAN DANH
  // ===========================================================================

  async finishCombat() {
    this.isCombatRunning = false;
    this.enableCommandMenu(false, this.player);
    if (this.inventoryManager) this.inventoryManager.activeEnemy = null;

    // Reset trạng thái Môi Trường khi kết thúc trận
    this.currentField = null;
    this.fieldDuration = 0;
    this.updateBattlefieldUI();

    if (!this.player.isAlive()) {
      this.log('💀 BAN DA TU TRAN!', 'enemy-msg');
      if (typeof this.onDefeat === 'function') this.onDefeat();
      return;
    }

    this.log('🏆 CHIEN THANG! ' + this.enemy.name + ' da bi danh bai!', 'crit-msg');

    // Hoi 30% SP sau khi thang tran
    const spRecovered = Math.round(this.player.maxSp * 0.3);
    const actualSp = this.player.restoreSp(spRecovered);
    this.log('⚡ Thang tran! Hoi phuc +' + actualSp + ' The Luc (SP).', 'system-msg');

    // 1. Phân loại kẻ thù: normal | elite | boss
    let enemyType = 'normal';
    if (this.enemy) {
      if (this.enemy.type === 'boss' || this.enemy.monsterType === 'boss') enemyType = 'boss';
      else if (this.enemy.type === 'elite' || this.enemy.monsterType === 'elite') enemyType = 'elite';
    }
    if (this.currentNode) {
      if (this.currentNode.type === 'boss') enemyType = 'boss';
      else if (this.currentNode.type === 'elite') enemyType = 'elite';
    }

    // 2. Roll phần thưởng theo cấp bậc (Smart Drop Logic: Chỉ rớt trang bị phù hợp với Class hiện tại)
    const playerClassId = this.player ? (this.player.classId || 'warrior') : 'warrior';
    const lootResult = rollLootByEnemyType(enemyType, playerClassId);
    const goldDrop = lootResult.gold;
    const droppedItemData = lootResult.item;

    this.player.addGold(goldDrop);
    const goldTag = enemyType === 'boss' ? '💰 [ĐẠI PHÚ BOSS] Nhặt được +' : (enemyType === 'elite' ? '💰 [PHÁT TÀI ELITE] Nhặt được +' : '💰 Nhặt được +');
    this.log(goldTag + goldDrop + ' Vàng! (Tổng: ' + this.player.gold + ' Vàng)', 'system-msg');

    // 2.5 Thưởng Điểm Kỹ Năng (Skill Point) khi đánh bại Quái Tinh Anh (Elite) - Tối đa 3 điểm / 1 Run
    const isElite = (enemyType === 'elite' || (this.enemy && (this.enemy.type === 'elite' || this.enemy.monsterType === 'elite' || this.enemy.isElite)));
    if (isElite && this.player) {
      if ((this.player.earnedSkillPoints || 0) < 3) {
        this.player.skillPoints = (this.player.skillPoints || 0) + 1;
        this.player.earnedSkillPoints = (this.player.earnedSkillPoints || 0) + 1;
        this.showFloatingNumber('player', '+1 ĐIỂM KỸ NĂNG! 📖', 'heal-regen');
        this.log('📖✨ [SÁCH KỸ NĂNG] Đánh bại Tinh Anh! Bạn nhận được 1 Điểm Kỹ Năng (Đã nhận ' + this.player.earnedSkillPoints + '/3 trong Run này)!', 'crit-msg');
      } else {
        this.log('📖 [Điểm Kỹ Năng] Đã thu thập tối đa 3 Điểm Kỹ Năng từ Quái Tinh Anh trong chuyến thám hiểm này.', 'system-msg');
      }
    }

    // 3. Xử lý rớt đồ & Trang bị nhanh / Cất vào túi
    if (droppedItemData) {
      const itemInstance = new Item(droppedItemData);
      const isEquipment = ['weapon', 'armor', 'shield'].includes(itemInstance.type);

      let rarityLabel = '';
      if (itemInstance.rarity === 'legendary') rarityLabel = '🔥 [HUYỀN THOẠI TRÙM CUỐI] ';
      else if (itemInstance.rarity === 'epic') rarityLabel = '🟣 [SỬ THI TINH ANH] ';
      else if (itemInstance.rarity === 'rare') rarityLabel = '🔷 [QUÝ HIẾM] ';

      if (isEquipment) {
        // Hiện thông báo loot rớt
        this.showLootNotification(itemInstance);

        // Mở Modal Trang Bị Nhanh và Await lựa chọn của người chơi
        const choice = await this.promptQuickEquip(itemInstance);

        if (choice === 'equip') {
          const oldEquipped = this.inventoryManager.equipDirectly(itemInstance);
          if (oldEquipped) {
            this.log(`⚡ Đã lập tức trang bị [${itemInstance.name}]! Đồ cũ [${oldEquipped.name}] đã cất an toàn vào ba lô.`, 'crit-msg');
          } else {
            this.log(`⚡ Đã lập tức trang bị [${itemInstance.name}] lên người!`, 'crit-msg');
          }
        } else {
          // Người chơi chọn [Cất vào túi]
          const isAdded = this.inventoryManager.addItem(itemInstance);
          if (isAdded) {
            this.log('🎁 Chiến lợi phẩm ' + rarityLabel + '[' + itemInstance.name + '] đã vào túi đồ!', 'crit-msg');
          } else {
            this.log('⚠️ Túi đồ đầy (' + this.inventoryManager.maxCapacity + ' món)! Không thể nhặt thêm [' + itemInstance.name + '].', 'enemy-msg');
          }
        }
      } else {
        // Vật phẩm tiêu hao hoặc Cổ vật -> Cất vào túi như bình thường
        const isAdded = this.inventoryManager.addItem(itemInstance);
        this.showLootNotification(itemInstance);

        if (isAdded) {
          this.log('🎁 Chiến lợi phẩm ' + rarityLabel + '[' + itemInstance.name + '] đã vào túi đồ!', 'crit-msg');
        } else {
          this.log('⚠️ Túi đồ đầy (' + this.inventoryManager.maxCapacity + ' món)! Không thể nhặt thêm [' + itemInstance.name + '].', 'enemy-msg');
        }
      }
    } else {
      this.log('💨 Quái vật nghèo nàn, không rớt thêm trang bị hay cổ vật nào (Tỷ lệ không rớt 20%).', 'system-msg');
    }

    this.updateArenaUI();
    await new Promise(r => setTimeout(r, 1500));

    if (typeof this.onVictory === 'function') this.onVictory(this.currentNode);
  }

  /**
   * Hiển thị Modal Trang Bị Nhanh (Quick Equip) và trả về Promise chờ người chơi chọn
   * @param {Item} item Món đồ vừa nhặt
   * @returns {Promise<'equip'|'stash'>}
   */
  promptQuickEquip(item) {
    return new Promise((resolve) => {
      const modal = document.getElementById('quick-equip-modal');
      if (!modal) {
        resolve('stash');
        return;
      }

      const titleEl = document.getElementById('quick-equip-title');
      const subtitleEl = document.getElementById('quick-equip-subtitle');
      const newCol = document.getElementById('quick-equip-new-col');
      const curCol = document.getElementById('quick-equip-cur-col');
      const btnEquip = document.getElementById('btn-quick-equip-now');
      const btnStash = document.getElementById('btn-quick-equip-stash');

      const typeLabels = {
        weapon: 'Vũ Khí',
        armor: 'Giáp Thân',
        shield: 'Khiên Đỡ'
      };

      if (titleEl) {
        const rarityColors = {
          common: '#94a3b8',
          rare: '#38bdf8',
          epic: '#c084fc',
          legendary: '#ffd166'
        };
        const itemColor = rarityColors[item.rarity] || '#ffd166';
        titleEl.innerHTML = `BẠN VỪA NHẬN ĐƯỢC <span class="highlight-loot-name" style="color: ${itemColor}; text-shadow: 0 0 16px ${itemColor}80;">[${item.name.toUpperCase()}]</span>!`;
      }
      if (subtitleEl) {
        subtitleEl.textContent = `Chiến lợi phẩm thuộc loại: ${typeLabels[item.type] || 'Trang Bị'}. Hãy so sánh trước khi quyết định!`;
      }

      // Lấy món đồ đang trang bị cùng loại
      const currentEquipped = (this.inventoryManager && this.inventoryManager.equipped)
        ? this.inventoryManager.equipped[item.type]
        : null;

      // Render cột Đồ mới (có đối chiếu chỉ số với món đang mặc)
      if (newCol) {
        if (this.inventoryManager && typeof this.inventoryManager.renderItemPanelHTML === 'function') {
          newCol.innerHTML = this.inventoryManager.renderItemPanelHTML(item, 'new_loot', currentEquipped);
        } else {
          newCol.innerHTML = `<div class="tooltip-panel-tag new-loot-tag">✨ MỚI NHẶT</div><h3>${item.name}</h3>`;
        }
      }

      // Render cột Đang mặc
      if (curCol) {
        if (currentEquipped && this.inventoryManager && typeof this.inventoryManager.renderItemPanelHTML === 'function') {
          curCol.innerHTML = this.inventoryManager.renderItemPanelHTML(currentEquipped, 'equipped', null);
        } else {
          curCol.innerHTML = `
            <div class="tooltip-panel panel-equipped">
              <div class="tooltip-panel-tag">🛡️ ĐANG TRANG BỊ HIỆN TẠI</div>
              <div class="quick-equip-empty-slot">
                <span class="empty-slot-icon">🛡️</span>
                <span class="empty-slot-text">Hiện đang để trống ô ${typeLabels[item.type] || 'trang bị'}</span>
                <span class="empty-slot-hint">Trang bị ngay để nhận trọn vẹn chỉ số tăng cường!</span>
              </div>
            </div>
          `;
        }
      }

      modal.style.display = 'flex';

      const handleChoice = (choice) => {
        modal.style.display = 'none';
        if (btnEquip) btnEquip.onclick = null;
        if (btnStash) btnStash.onclick = null;
        resolve(choice);
      };

      if (btnEquip) {
        btnEquip.onclick = () => handleChoice('equip');
      }
      if (btnStash) {
        btnStash.onclick = () => handleChoice('stash');
      }
    });
  }

  /**
   * Kích hoạt nội tại các Cổ vật khi bắt đầu hiệp mới (PvE)
   * @param {Player} player
   */
  _applyPlayerTurnStartRelics(player) {
    if (this.isPvP || !this.inventoryManager || !this.inventoryManager.backpack) return;
    // Cổ vật Trái Tim Pha Lê: Hồi 10 HP mỗi đầu hiệp đấu
    const crystalHeart = this.inventoryManager.backpack.find(i => i && i.id === 'crystal_heart');
    if (crystalHeart && player.hp < player.maxHp) {
      const healAmount = (crystalHeart.passive && crystalHeart.passive.value) || 10;
      const actual = player.healHp(healAmount);
      this.log('💎 [Trái Tim Pha Lê] Tự động hồi +' + actual + ' HP đầu hiệp đấu! (' + player.hp + '/' + player.maxHp + ')', 'player-msg');
      this.updateArenaUI();
    }
  }

  /**
   * Hien thi modal hoi Block cho actor cu the
   * @param {Player} actor Nguoi duoc hoi
   * @returns {Promise<boolean>}
   */
  promptPlayerActiveBlock(actor) {
    return new Promise((resolve) => {
      const modal = document.getElementById('reaction-prompt-modal');
      const btnConfirm = document.getElementById('btn-reaction-block');
      const btnCancel = document.getElementById('btn-reaction-skip');
      const currentSpEl = document.getElementById('prompt-current-sp');

      if (currentSpEl) currentSpEl.textContent = actor.sp;

      if (!modal || !btnConfirm || !btnCancel) { resolve(false); return; }

      const cleanup = () => {
        modal.style.display = 'none';
        btnConfirm.removeEventListener('click', handleConfirm);
        btnCancel.removeEventListener('click', handleCancel);
      };

      const handleConfirm = () => { cleanup(); resolve(true); };
      const handleCancel = () => { cleanup(); resolve(false); };

      btnConfirm.addEventListener('click', handleConfirm);
      btnCancel.addEventListener('click', handleCancel);
      modal.style.display = 'flex';
    });
  }

  waitForPlayerAction() {
    return new Promise((resolve) => {
      this.playerActionResolver = resolve;
    });
  }

  resolvePlayerAction(action) {
    if (this.playerActionResolver) {
      const resolver = this.playerActionResolver;
      this.playerActionResolver = null;
      resolver(action);
    }
  }

  /** Tra ve actor dang hanh dong (P1 trong PvP hoac player trong PvE) */
  _getActivePlayer() {
    if (this.isPvP) {
      return this.currentPvPSide === 'p1' ? this.pvpP1 : this.pvpP2;
    }
    return this.player;
  }

  /**
   * Bat/Tat Command Menu, kiem tra tai nguyen kha dung
   */
  enableCommandMenu(enabled, actor) {
    const btnAttack = document.getElementById('btn-cmd-attack');
    const btnSkills = document.getElementById('btn-cmd-skills');
    const btnRest = document.getElementById('btn-cmd-rest');
    const btnInventory = document.getElementById('btn-cmd-inventory');
    const cmdMain = document.getElementById('command-menu-main');
    const skillsSub = document.getElementById('skills-menu-sub');

    if (cmdMain && skillsSub) {
      cmdMain.style.display = 'grid';
      skillsSub.style.display = 'none';
    }

    if (!enabled) {
      if (btnAttack) btnAttack.disabled = true;
      if (btnSkills) btnSkills.disabled = true;
      if (btnRest) btnRest.disabled = true;
      if (btnInventory) btnInventory.disabled = true;
      return;
    }

    const a = actor || this.player;
    const isFree = (typeof a.hasEffect === 'function') && a.hasEffect('free_cast');
    if (btnAttack) btnAttack.disabled = a.sp < a.attackSpCost;
    if (btnSkills) {
      const hasAffordable = isFree || (a.skills && a.skills.some(id => {
        const sk = SKILLS_DATABASE[id];
        return sk && !sk.isHidden && (isFree || (a.mp >= sk.mpCost && a.sp >= sk.spCost));
      }));
      btnSkills.disabled = !hasAffordable;
    }
    if (btnRest) btnRest.disabled = false;
    // Trong PvP, an nut Tui Do (khong dung item trong PvP)
    if (btnInventory) btnInventory.disabled = this.isPvP;
  }

  /**
   * Render danh sach ky nang cho actor dang hanh dong
   */
  renderSkillsSubmenu() {
    const container = document.getElementById('skills-list-container');
    if (!container) return;
    container.innerHTML = '';

    const actor = this._getActivePlayer();
    const isFree = (typeof actor.hasEffect === 'function') && actor.hasEffect('free_cast');

    (actor.skills || []).forEach(skillId => {
      const skill = SKILLS_DATABASE[skillId];
      if (!skill || skill.isHidden) return;
      const canCast = isFree || (actor.mp >= skill.mpCost && actor.sp >= skill.spCost);
      const btn = document.createElement('button');
      btn.className = 'skill-card-btn';
      btn.disabled = !canCast;
      const costText = isFree ? '✨ MIỄN PHÍ' : (skill.mpCost + ' MP' + (skill.spCost > 0 ? ' + ' + skill.spCost + ' SP' : ''));
      btn.innerHTML =
        '<div class="skill-info-col"><b>' + skill.icon + ' ' + skill.name + '</b><span>' + skill.desc + '</span></div>' +
        '<div class="skill-cost-badge">' + costText + '</div>';
      btn.addEventListener('click', () => this.resolvePlayerAction({ type: 'skill', skillId }));
      container.appendChild(btn);
    });
  }

  // ===========================================================================
  // PHAN 6: CAP NHAT UI
  // ===========================================================================

  showLootNotification(item) {
    const toast = document.getElementById('loot-notification-toast');
    const text = document.getElementById('loot-toast-text');
    if (!toast || !text) return;

    // Reset các class rarity cũ
    toast.className = 'loot-toast';
    const rarity = item.rarity || 'common';
    toast.classList.add('loot-rarity-' + rarity);

    const titleEl = toast.querySelector('.loot-toast-title');
    const iconEl = toast.querySelector('.loot-toast-icon');

    if (iconEl) iconEl.textContent = item.icon || '🎁';

    if (titleEl) {
      if (rarity === 'legendary') {
        titleEl.textContent = '👑 CỔ VẬT HUYỀN THOẠI (BOSS DROP)!';
      } else if (rarity === 'epic') {
        titleEl.textContent = '💀 PHẦN THƯỞNG TINH ANH (ELITE DROP)!';
      } else if (rarity === 'rare') {
        titleEl.textContent = '🔷 TRANG BỊ QUÝ HIẾM!';
      } else {
        titleEl.textContent = 'NHẶT ĐƯỢC CHIẾN LỢI PHẨM!';
      }
    }

    const descText = item.desc ? ' - ' + item.desc : '';
    text.innerHTML = '<span class="loot-item-name-highlight rarity-' + rarity + '">' + item.name + '</span> <span class="loot-item-desc-text">' + descText + '</span>';
    toast.style.display = 'flex';
    setTimeout(() => { toast.style.display = 'none'; }, 3800);
  }

  shakeCard(target) {
    const cardId = target === 'player' ? 'player-combat-card' : 'enemy-combat-card';
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 400);
    }
  }

  updateBanner(type, text) {
    const banner = document.getElementById('turn-banner');
    const bannerText = document.getElementById('turn-banner-text');
    if (!banner || !bannerText) return;
    banner.className = 'turn-banner turn-' + type;
    bannerText.textContent = text;
  }

  log(message, type = 'system-msg') {
    const logBody = document.getElementById('combat-log-body');
    if (!logBody) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = message;
    logBody.appendChild(entry);
    logBody.scrollTop = logBody.scrollHeight;
  }

  /**
   * Thiết lập Vùng Môi Trường / Địa Hình Chiến Trường (Field / Domain)
   * @param {string} fieldId ID môi trường ('chaos_swamp', 'electric_net', v.v.)
   * @param {number} duration Số hiệp duy trì
   * @param {'player'|'enemy'|'p1'|'p2'} ownerSide Phe kích hoạt môi trường
   */
  setField(fieldId, duration = 3, ownerSide = 'player') {
    this.currentField = fieldId;
    this.fieldDuration = duration;
    this._fieldOwnerSide = ownerSide;

    let fieldName = 'Đầm Lầy Hỗn Mang';
    let fieldIcon = '☣️🌫️';
    if (fieldId === 'chaos_swamp') {
      fieldName = 'Đầm Lầy Hỗn Mang';
      fieldIcon = '☣️🌫️';
    } else if (fieldId === 'electric_net') {
      fieldName = 'Lưới Điện Cao Thế';
      fieldIcon = '⚡🕸️';
    }

    this.log(`🌌🌪️ [MÔI TRƯỜNG KÍCH HOẠT] Khai mở cảnh giới [${fieldName}] trong ${duration} hiệp!`, 'crit-msg');
    const targetCardSide = this.isPvP ? (ownerSide === 'p1' ? 'p2' : 'p1') : 'enemy';
    this.showFloatingNumber(targetCardSide, `${fieldIcon} ${fieldName.toUpperCase()}!`, 'dmg-burn');
    this.updateBattlefieldUI();
  }

  /**
   * Cập nhật UI hiển thị Môi Trường (Field / Domain)
   */
  updateBattlefieldUI() {
    const statusEl = document.getElementById('battlefield-status');
    const arenaEl = document.querySelector('.combat-arena');
    const combatScreen = document.getElementById('combat-screen');

    if (!this.currentField || this.fieldDuration <= 0) {
      if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.innerHTML = '';
      }
      if (arenaEl) {
        arenaEl.classList.remove('field-chaos_swamp', 'field-electric_net');
      }
      if (combatScreen) {
        combatScreen.classList.remove('field-active-chaos_swamp', 'field-active-electric_net');
      }
      return;
    }

    if (arenaEl) {
      arenaEl.classList.remove('field-chaos_swamp', 'field-electric_net');
      arenaEl.classList.add(`field-${this.currentField}`);
    }
    if (combatScreen) {
      combatScreen.classList.remove('field-active-chaos_swamp', 'field-active-electric_net');
      combatScreen.classList.add(`field-active-${this.currentField}`);
    }

    if (statusEl) {
      statusEl.style.display = 'flex';
      let title = 'Môi Trường: ';
      let icon = '☣️';
      if (this.currentField === 'chaos_swamp') {
        title = '☣️ Đầm Lầy Hỗn Mang';
        icon = '☣️🌫️';
      } else {
        title = `⚡ ${this.currentField}`;
        icon = '⚡';
      }
      statusEl.innerHTML = `
        <div class="field-badge ${this.currentField}">
          <span class="field-icon-anim">${icon}</span>
          <span class="field-title">${title}</span>
          <span class="field-turns">Còn ${this.fieldDuration} hiệp</span>
        </div>
      `;
    }
  }

  updateArenaUI() {
    this.updateBattlefieldUI();
    // Trong PvP, P1 luôn cố định ở Thẻ Trái (player-combat-card), P2 luôn cố định ở Thẻ Phải (enemy-combat-card)
    const displayPlayer = this.isPvP ? this.pvpP1 : this.player;
    const displayEnemy  = this.isPvP ? this.pvpP2 : this.enemy;
    const displayInv    = this.isPvP ? this.pvpInv1 : this.inventoryManager;
    const displayEnemyInv = this.isPvP ? this.pvpInv2 : null;

    // Hiển thị hiệu ứng viền phát sáng (Glow) cho bên đang đến lượt hành động
    const p1Card = document.getElementById('player-combat-card');
    const p2Card = document.getElementById('enemy-combat-card');
    if (this.isPvP) {
      if (p1Card) p1Card.classList.toggle('active-turn', this.currentPvPSide === 'p1');
      if (p2Card) p2Card.classList.toggle('active-turn', this.currentPvPSide === 'p2');
    } else {
      if (p1Card) p1Card.classList.toggle('active-turn', this.isPlayerTurn);
      if (p2Card) p2Card.classList.toggle('active-turn', !this.isPlayerTurn);
    }

    // =========================================================================
    // 1. CẬP NHẬT THẺ BÊN TRÁI (PLAYER / P1)
    // =========================================================================
    if (displayPlayer) {
      const pName = document.getElementById('combat-player-name');
      const pAvatar = document.getElementById('combat-player-avatar');
      const pHpText = document.getElementById('combat-player-hp-text');
      const pHpBar = document.getElementById('combat-player-hp-bar');
      const pMpText = document.getElementById('combat-player-mp-text');
      const pMpBar = document.getElementById('combat-player-mp-bar');
      const pSpText = document.getElementById('combat-player-sp-text');
      const pSpBar = document.getElementById('combat-player-sp-bar');
      const pAc = document.getElementById('combat-player-ac');
      const pGold = document.getElementById('combat-player-gold');
      const pWeapon = document.getElementById('combat-player-weapon');
      const pReactBadge = document.getElementById('player-reaction-badge');
      const pClassBadge = document.getElementById('combat-player-class-badge');

      if (pName) {
        let cleanName = this.isPvP ? (displayPlayer.heroName || displayPlayer.name) : (displayPlayer.heroName || displayPlayer.name);
        if (cleanName === 'Đạo Tặc / Sát Thủ') cleanName = 'Đạo Tặc';
        pName.textContent = cleanName;
      }
      if (pAvatar) pAvatar.textContent = displayPlayer.avatar || '🛡️';
      if (pClassBadge) {
        let badgeText = '🛡️ CHIẾN BINH';
        if (displayPlayer.classId === 'thief') badgeText = '🗡️ SÁT THỦ';
        else if (displayPlayer.classId === 'mage') badgeText = '🧙 PHÁP SƯ';
        else if (CLASSES_DATABASE && CLASSES_DATABASE[displayPlayer.classId]?.name) {
          badgeText = CLASSES_DATABASE[displayPlayer.classId].name.toUpperCase();
        }
        pClassBadge.textContent = badgeText;
      }
      if (pHpText) pHpText.textContent = displayPlayer.hp + '/' + displayPlayer.maxHp;
      if (pHpBar) pHpBar.style.width = Math.max(0, (displayPlayer.hp / displayPlayer.maxHp) * 100) + '%';
      if (pMpText) pMpText.textContent = displayPlayer.mp + '/' + displayPlayer.maxMp;
      if (pMpBar) pMpBar.style.width = Math.max(0, (displayPlayer.mp / displayPlayer.maxMp) * 100) + '%';
      if (pSpText) pSpText.textContent = displayPlayer.sp + '/' + displayPlayer.maxSp;
      if (pSpBar) pSpBar.style.width = Math.max(0, (displayPlayer.sp / displayPlayer.maxSp) * 100) + '%';
      if (pAc) pAc.textContent = displayPlayer.ac;
      if (pGold) pGold.textContent = displayPlayer.gold || 0;
      if (pWeapon && displayInv) {
        const wep = displayInv.equipped ? displayInv.equipped.weapon : null;
        pWeapon.textContent = wep ? wep.name + ' (' + wep.damageDice + '+' + displayPlayer.attackMod + ')' : 'Tay không (1d4+1)';
      }
      if (pReactBadge) {
        if (displayPlayer.hasReaction) {
          pReactBadge.className = 'reaction-tag';
          pReactBadge.textContent = '⚡ Reaction: Có Sẵn';
        } else {
          pReactBadge.className = 'reaction-tag exhausted';
          pReactBadge.textContent = '💤 Reaction: Đã Dùng';
        }
      }

      // Render danh sách Cổ Vật của Player trong Combat
      const pRelics = document.getElementById('combat-player-relics');
      if (pRelics && displayInv && displayInv.backpack) {
        const relicItems = displayInv.backpack.filter(i => i && i.type === 'relic');
        if (relicItems.length > 0) {
          pRelics.innerHTML = relicItems.map((r, idx) => '<span class="combat-relic-badge rarity-' + (r.rarity || 'common') + '" data-p-relic-idx="' + idx + '">' + r.icon + ' ' + r.name + '</span>').join('');
          pRelics.querySelectorAll('.combat-relic-badge').forEach(badge => {
            const idx = parseInt(badge.getAttribute('data-p-relic-idx'), 10);
            const rItem = relicItems[idx];
            if (rItem) InventoryManager.attachTooltip(badge, rItem, 'combat');
          });
        } else {
          pRelics.innerHTML = '<span class="relic-empty-text">Chưa sở hữu cổ vật</span>';
        }
      }

      // Render Điểm Liên Kích (Thief) hoặc Tinh Thể Quá Tải (Mage)
      this._updateClassSpecificResourceUI(displayPlayer, 'combat-player');
    }

    // =========================================================================
    // 2. CẬP NHẬT THẺ BÊN PHẢI (ENEMY TRONG PVE HOẶC P2 TRONG PVP)
    // =========================================================================
    if (displayEnemy) {
      const eName = document.getElementById('combat-enemy-name');
      const eAvatar = document.getElementById('combat-enemy-avatar');
      const eClassBadge = document.getElementById('combat-enemy-class-badge');
      const eReactBadge = document.getElementById('enemy-reaction-badge');
      const eTypeBadge = document.getElementById('combat-enemy-type-badge');
      const eHpText = document.getElementById('combat-enemy-hp-text');
      const eHpBar = document.getElementById('combat-enemy-hp-bar');
      const eMpGroup = document.getElementById('combat-enemy-mp-group');
      const eMpText = document.getElementById('combat-enemy-mp-text');
      const eMpBar = document.getElementById('combat-enemy-mp-bar');
      const eSpGroup = document.getElementById('combat-enemy-sp-group');
      const eSpText = document.getElementById('combat-enemy-sp-text');
      const eSpBar = document.getElementById('combat-enemy-sp-bar');
      const eAc = document.getElementById('combat-enemy-ac');
      const eWeaponWrap = document.getElementById('combat-enemy-weapon-wrap');
      const eWeapon = document.getElementById('combat-enemy-weapon');
      const eAtkWrap = document.getElementById('combat-enemy-atk-wrap');
      const eAtk = document.getElementById('combat-enemy-atk');
      const eGoldWrap = document.getElementById('combat-enemy-gold-wrap');
      const eGoldLabel = document.getElementById('combat-enemy-gold-label');
      const eGold = document.getElementById('combat-enemy-gold');
      const eRelicContainer = document.getElementById('combat-enemy-relic-container');
      const eRelics = document.getElementById('combat-enemy-relics');

      if (eName) {
        let cleanName = this.isPvP ? (displayEnemy.heroName || displayEnemy.name) : displayEnemy.name;
        if (cleanName === 'Đạo Tặc / Sát Thủ') cleanName = 'Đạo Tặc';
        eName.textContent = cleanName;
      }
      if (eAvatar) eAvatar.textContent = displayEnemy.avatar || (this.isPvP ? '⚔️' : '👹');
      if (eHpText) eHpText.textContent = displayEnemy.hp + '/' + displayEnemy.maxHp;
      if (eHpBar) eHpBar.style.width = Math.max(0, (displayEnemy.hp / displayEnemy.maxHp) * 100) + '%';
      if (eAc) eAc.textContent = displayEnemy.ac;

      if (this.isPvP) {
        // --- CHẾ ĐỘ PVP: HIỂN THỊ ĐẦY ĐỦ THÔNG TIN ĐỐI XỨNG TUYỂN THỦ 2 ---
        if (eTypeBadge) eTypeBadge.style.display = 'none';

        if (eReactBadge) {
          eReactBadge.style.display = 'inline-block';
          if (displayEnemy.hasReaction) {
            eReactBadge.className = 'reaction-tag';
            eReactBadge.textContent = '⚡ Reaction: Có Sẵn';
          } else {
            eReactBadge.className = 'reaction-tag exhausted';
            eReactBadge.textContent = '💤 Reaction: Đã Dùng';
          }
        }

        if (eClassBadge) {
          eClassBadge.style.display = 'inline-block';
          let badgeText = '🛡️ CHIẾN BINH';
          if (displayEnemy.classId === 'thief' || displayEnemy.classId === 'rogue') badgeText = '🗡️ SÁT THỦ';
          else if (displayEnemy.classId === 'mage') badgeText = '🧙 PHÁP SƯ';
          else if (CLASSES_DATABASE && CLASSES_DATABASE[displayEnemy.classId]?.name) {
            badgeText = CLASSES_DATABASE[displayEnemy.classId].name.toUpperCase();
          }
          eClassBadge.textContent = badgeText;
        }

        if (eMpGroup) eMpGroup.style.display = '';
        if (eMpText) eMpText.textContent = (displayEnemy.mp ?? 0) + '/' + (displayEnemy.maxMp ?? 10);
        if (eMpBar) eMpBar.style.width = Math.max(0, ((displayEnemy.mp ?? 0) / (displayEnemy.maxMp ?? 10)) * 100) + '%';

        if (eSpGroup) eSpGroup.style.display = '';
        if (eSpText) eSpText.textContent = (displayEnemy.sp ?? 0) + '/' + (displayEnemy.maxSp ?? 10);
        if (eSpBar) eSpBar.style.width = Math.max(0, ((displayEnemy.sp ?? 0) / (displayEnemy.maxSp ?? 10)) * 100) + '%';

        if (eWeaponWrap) eWeaponWrap.style.display = '';
        if (eWeapon && displayEnemyInv) {
          const wep = displayEnemyInv.equipped ? displayEnemyInv.equipped.weapon : null;
          eWeapon.textContent = wep ? wep.name + ' (' + wep.damageDice + '+' + (displayEnemy.attackMod || 0) + ')' : 'Tay không (1d4+1)';
        } else if (eWeapon) {
          eWeapon.textContent = 'Tay không (1d4+1)';
        }

        if (eAtkWrap) eAtkWrap.style.display = 'none';
        if (eGoldLabel) eGoldLabel.textContent = '💰 Vàng: ';
        if (eGold) eGold.textContent = displayEnemy.gold || 0;

        if (eRelicContainer) eRelicContainer.style.display = '';
        if (eRelics && displayEnemyInv && displayEnemyInv.backpack) {
          const relicItems = displayEnemyInv.backpack.filter(i => i && i.type === 'relic');
          if (relicItems.length > 0) {
            eRelics.innerHTML = relicItems.map((r, idx) => '<span class="combat-relic-badge rarity-' + (r.rarity || 'common') + '" data-e-relic-idx="' + idx + '">' + r.icon + ' ' + r.name + '</span>').join('');
            eRelics.querySelectorAll('.combat-relic-badge').forEach(badge => {
              const idx = parseInt(badge.getAttribute('data-e-relic-idx'), 10);
              const rItem = relicItems[idx];
              if (rItem) InventoryManager.attachTooltip(badge, rItem, 'combat');
            });
          } else {
            eRelics.innerHTML = '<span class="relic-empty-text">Chưa sở hữu cổ vật</span>';
          }
        } else if (eRelics) {
          eRelics.innerHTML = '<span class="relic-empty-text">Chưa sở hữu cổ vật</span>';
        }

      } else {
        // --- CHẾ ĐỘ PVE: QUÁI VẬT THƯỜNG / TINH ANH / TRÙM ---
        if (eClassBadge) eClassBadge.style.display = 'none';
        if (eReactBadge) eReactBadge.style.display = 'none';
        if (eMpGroup) eMpGroup.style.display = 'none';
        if (eSpGroup) eSpGroup.style.display = 'none';
        if (eWeaponWrap) eWeaponWrap.style.display = 'none';
        if (eRelicContainer) eRelicContainer.style.display = 'none';

        if (eTypeBadge) {
          eTypeBadge.style.display = '';
          const type = displayEnemy.type || displayEnemy.monsterType;
          if (type === 'boss') {
            eTypeBadge.textContent = '👿 TRÙM CUỐI (BOSS)';
          } else if (type === 'elite') {
            eTypeBadge.textContent = '💀 TINH ANH (ELITE)';
          } else {
            eTypeBadge.textContent = '⚔️ QUÁI THƯỜNG (NORMAL)';
          }
        }

        if (eAtkWrap) eAtkWrap.style.display = '';
        if (eAtk) eAtk.textContent = (displayEnemy.damageDice || '1d6') + ' + ' + (displayEnemy.attackMod || 0);

        if (eGoldLabel) eGoldLabel.textContent = '💰 Vàng rớt: ';
        if (eGold) {
          const minG = displayEnemy.goldDrop ? displayEnemy.goldDrop[0] : 10;
          const maxG = displayEnemy.goldDrop ? displayEnemy.goldDrop[1] : 20;
          eGold.textContent = minG + '-' + maxG + ' Vàng';
        }
      }

      // Render Điểm Liên Kích (Thief), Tinh Thể Quá Tải (Mage) hoặc Nộ Khí (Warrior) cho P2 trong PvP, ẩn trong PvE
      if (this.isPvP) {
        this._updateClassSpecificResourceUI(displayEnemy, 'combat-enemy');
      } else {
        const eCombo = document.getElementById('combat-enemy-combo-group');
        const eMage = document.getElementById('combat-enemy-mage-group');
        const eRage = document.getElementById('combat-enemy-rage-group');
        if (eCombo) eCombo.style.display = 'none';
        if (eMage) eMage.style.display = 'none';
        if (eRage) eRage.style.display = 'none';
      }
    }

    // Cập nhật thanh trạng thái Buff / Debuff cho 2 bên
    this.updateStatusBars(displayPlayer, displayEnemy);
  }

  /**
   * Cập nhật UI cơ chế độc quyền theo Class: Combo Points (Thief), Arcane Overcharge (Mage), hoặc Rage (Warrior)
   * @param {Combatant} combatant
   * @param {'combat-player'|'combat-enemy'} prefix
   */
  _updateClassSpecificResourceUI(combatant, prefix) {
    const comboGroup = document.getElementById(`${prefix}-combo-group`);
    const mageGroup = document.getElementById(`${prefix}-mage-group`);
    const rageGroup = document.getElementById(`${prefix}-rage-group`);

    const isThief = combatant && (combatant.classId === 'thief' || combatant.classId === 'rogue');
    const isMage = combatant && (combatant.classId === 'mage');
    const isWarrior = combatant && (combatant.classId === 'warrior' || combatant.classId === 'knight' || !combatant.classId);

    // 1. THANH NỘ KHÍ & ĐIÊN CUỒNG CHO WARRIOR
    if (rageGroup) {
      if (isWarrior) {
        rageGroup.style.display = 'block';
        const rageVal = Math.min(100, Math.max(0, combatant.rage || 0));
        const textEl = document.getElementById(`${prefix}-rage-text`);
        const barEl = document.getElementById(`${prefix}-rage-bar`);
        const badgeEl = document.getElementById(`${prefix}-berserk-badge`);
        const isBerserk = combatant.isBerserk ? combatant.isBerserk() : false;

        if (textEl) textEl.textContent = isBerserk ? '100/100 (ĐIÊN CUỒNG!)' : `${rageVal}/100`;
        if (barEl) {
          barEl.style.width = `${rageVal}%`;
          barEl.classList.toggle('berserk', isBerserk);
        }
        if (badgeEl) {
          if (isBerserk) {
            badgeEl.classList.remove('hidden');
            badgeEl.textContent = `🔥 ĐIÊN CUỒNG! (${combatant.berserkTurns || 3} hiệp)`;
          } else {
            badgeEl.classList.add('hidden');
          }
        }
      } else {
        rageGroup.style.display = 'none';
      }
    }

    // 2. LIÊN KÍCH CHO THIEF
    if (comboGroup) {
      if (isThief) {
        comboGroup.style.display = 'flex';
        const pts = combatant.comboPoints || 0;
        const textEl = document.getElementById(`${prefix}-combo-text`);
        if (textEl) textEl.textContent = `${pts}/5`;
        const orbs = comboGroup.querySelectorAll('.combo-orb');
        orbs.forEach((orb, idx) => {
          orb.classList.toggle('active', idx < pts);
          orb.classList.toggle('max', pts === 5);
        });
      } else {
        comboGroup.style.display = 'none';
      }
    }

    // 3. TINH THỂ QUÁ TẢI CHO MAGE
    if (mageGroup) {
      if (isMage) {
        mageGroup.style.display = 'flex';
        const charges = combatant.arcaneCharges || 0;
        const isOver = combatant.isOvercharged ? combatant.isOvercharged() : charges >= 3;
        const textEl = document.getElementById(`${prefix}-mage-text`);
        if (textEl) textEl.textContent = isOver ? 'MAX (QUÁ TẢI!)' : `${charges}/3`;
        const track = document.getElementById(`${prefix}-mage-crystals`);
        if (track) track.classList.toggle('overcharged', isOver);
        const crystals = mageGroup.querySelectorAll('.mana-crystal');
        crystals.forEach((crystal, idx) => {
          crystal.classList.toggle('active', idx < charges);
          crystal.classList.toggle('max', isOver);
        });
      } else {
        mageGroup.style.display = 'none';
      }
    }
  }

  /**
   * Hiển thị số nảy trên màn hình (Floating Numbers)
   * @param {'player'|'enemy'|'p1'|'p2'} side
   * @param {string} text
   * @param {string} type 'dmg-burn' | 'dmg-poison' | 'dmg-physical' | 'heal-regen' | 'status-stun'
   */
  showFloatingNumber(side, text, type = 'dmg-physical') {
    const cardId = (side === 'player' || side === 'p1') ? 'player-combat-card' : 'enemy-combat-card';
    const card = document.getElementById(cardId);
    if (!card) return;

    if (!this._floatingCounters) this._floatingCounters = {};
    const count = (this._floatingCounters[cardId] || 0);
    this._floatingCounters[cardId] = count + 1;

    clearTimeout(this._floatingTimers?.[cardId]);
    if (!this._floatingTimers) this._floatingTimers = {};
    this._floatingTimers[cardId] = setTimeout(() => {
      if (this._floatingCounters) this._floatingCounters[cardId] = 0;
    }, 500);

    const staggerDelay = count * 180;
    const horizontalOffset = (count === 0 ? 0 : (count % 2 === 1 ? -28 : 28));
    const verticalOffset = (count === 0 ? 0 : (count * -16));

    setTimeout(() => {
      if (!card.isConnected) return;
      const el = document.createElement('div');
      el.className = `floating-number ${type}`;
      el.textContent = text;
      if (horizontalOffset !== 0 || verticalOffset !== 0) {
        el.style.transform = `translate(calc(-50% + ${horizontalOffset}px), calc(-50% + ${verticalOffset}px))`;
      }
      card.appendChild(el);

      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1000);
    }, staggerDelay);
  }

  /**
   * =========================================================================
   * HỆ THỐNG COMBO (SYNERGY) KỸ NĂNG CHO TOÀN BỘ CÁC LỚP NHÂN VẬT
   * =========================================================================
   */
  handleSkillSynergy(skillId, actor, target, res, actorSide, targetSide, sideLabel) {
    if (!res || !res.success) return;

    // --- 1. WARRIOR COMBOS (CHIẾN BINH) ---
    // Combo 1: Khát Máu (Bloodthirst) kích hoạt trên mục tiêu đang bị Bleed
    if (skillId === 'bloodthirst') {
      if (target && target.hasEffect('bleed')) {
        const healAmt = Math.max(1, Math.round((res.amount || 10) * 0.5));
        const actual = actor.healHp(healAmt);
        this.showFloatingNumber(actorSide, `+${actual} 🩸 HÚT MÁU`, 'heal-regen');
        this.log(`💥👑 COMBO: [Khát Máu] Bùng Nổ! Mục tiêu đang Chảy Máu! ${sideLabel} hút sinh lực hồi phục +${actual} HP!`, 'crit-msg');
      }
    }

    // Combo 2: Trảm Quyết (Execute) kích hoạt trên mục tiêu đang bị Phá Giáp (Vulnerable)
    if (skillId === 'execute') {
      if (target && target.hasEffect('vulnerable')) {
        const bonusDmg = Math.round((res.amount || 10) * 0.5); // x1.5 Sát thương (+50%)
        if (bonusDmg > 0 && res.isHit !== false) {
          target.takeDamage(bonusDmg);
          res.amount = (res.amount || 0) + bonusDmg;
        }
        this.showFloatingNumber(targetSide, `TRẢM QUYẾT x1.5! ⚡`, 'dmg-burn');
        this.log(`💥👑 COMBO: [Trảm Quyết] Bùng Nổ! Mục tiêu bị Phá Giáp! Sát thương bộc phá x1.5 thành ${res.amount}!`, 'crit-msg');
      }
    }

    // Combo 3: Thành Lũy (Bulwark) + Khiên Phá Kích (Shield Bash)
    if (skillId === 'shield_bash') {
      this.log(`💥👑 COMBO: [Khiên Phá Kích] Bùng Nổ! Chuyển hóa toàn bộ Giáp Ảo thành cú đập ${res.amount} sát thương uy lực!`, 'crit-msg');
    }

    // --- 2. MAGE COMBOS (PHÁP SƯ) ---
    // Combo 1: Cầu Lửa (Fireball) kích nổ trên mục tiêu dính Dầu (Oil)
    if (skillId === 'fireball' && target && target.hasEffect('oil')) {
      target.removeEffect('oil');
      const bonusBurn = Math.round((res.amount || 10) * 1.0); // x2 Sát thương
      target.takeDamage(bonusBurn);
      res.amount = (res.amount || 0) + bonusBurn;
      target.applyEffect('burn', 3, 8);
      this.showFloatingNumber(targetSide, `KÍCH NỔ DẦU x2! 🔥💥`, 'dmg-burn');
      this.log(`💥👑 COMBO: [Cầu Lửa] Bùng Nổ! Dầu bắt lửa phát nổ dữ dội! Gây x2 sát thương (${res.amount}) và Thiêu Đốt cực mạnh!`, 'crit-msg');
    }

    // Combo 2: Phá Vỡ (Shatter) kích hoạt trên mục tiêu Lạnh Buốt (Chill)
    if (skillId === 'shatter' && target && target.hasEffect('chill')) {
      target.removeEffect('chill');
      const bonusShatter = Math.round((res.amount || 8) * 2.0); // x3 Sát thương
      target.takeDamage(bonusShatter);
      res.amount = (res.amount || 0) + bonusShatter;
      this.showFloatingNumber(targetSide, `VỠ VỤN BĂNG x3! ❄️💥`, 'dmg-burn');
      this.log(`💥👑 COMBO: [Phá Vỡ] Bùng Nổ! Khối băng đóng chặt vỡ vụn! Sát thương nhân x3 thành ${res.amount}!`, 'crit-msg');
    }

    // Combo 3: Bão Phép Thuật (Arcane Barrage) xả toàn bộ MP
    if (skillId === 'arcane_barrage') {
      const drainedMp = actor.mp || 0;
      actor.mp = 0;
      const barrageBonus = drainedMp * 6;
      if (barrageBonus > 0) {
        target.takeDamage(barrageBonus);
        res.amount = (res.amount || 0) + barrageBonus;
        this.showFloatingNumber(targetSide, `BÃO PHÉP (${drainedMp} MP)! 🔮`, 'dmg-burn');
        this.log(`💥👑 COMBO: [Bão Phép Thuật] Bùng Nổ! Rút cạn ${drainedMp} MP giải phóng bão đạn ma thuật, tổng sát thương ${res.amount}!`, 'crit-msg');
      }
    }

    // --- 3. THIEF COMBOS (ĐẠO TẶC) ---
    // Combo 1: Từ Trong Bóng Tối (Shadow Strike) kích hoạt khi có buff Dodge
    if (skillId === 'shadow_strike') {
      if (actor.hasEffect('dodge')) {
        const critBonus = Math.round((res.amount || 10) * 1.0); // Bạo kích 100%
        target.takeDamage(critBonus);
        res.amount = (res.amount || 0) + critBonus;
        this.showFloatingNumber(targetSide, `BẠO KÍCH BÓNG TỐI 100%! 🌑⚡`, 'crit-msg');
        this.log(`💥👑 COMBO: [Từ Trong Bóng Tối] Bùng Nổ! Đột kích chí mạng từ làn khói! Sát thương bạo kích thành ${res.amount}!`, 'crit-msg');
      }
    }

    // Combo 2: Lưỡi Dao Độc (Venom Blade) kích hoạt trên mục tiêu Chảy Máu (Bleed)
    if (skillId === 'venom_blade' && target && target.hasEffect('bleed')) {
      const poisonEff = target.getEffect('poison');
      if (poisonEff) {
        poisonEff.duration += 3;
        poisonEff.value = (poisonEff.value || 5) * 2;
      } else {
        target.applyEffect('poison', 4, 10);
      }
      this.showFloatingNumber(targetSide, `ĐỘC MÁU x2! 🧪🩸`, 'dmg-poison');
      this.log(`💥👑 COMBO: [Lưỡi Dao Độc] Bùng Nổ! Độc tố ngấm sâu vết thương hở! Nhân đôi hiệu lực Trúng Độc!`, 'crit-msg');
    }

    // Combo 3: Chuẩn Bị (Preparation) hồi phục max Combo Points
    if (skillId === 'preparation') {
      actor.comboPoints = actor.maxComboPoints || 5;
      this.showFloatingNumber(actorSide, `MAX 5 COMBO! ⚡⚡`, 'heal-regen');
      this.log(`💥👑 COMBO: [Chuẩn Bị] Bùng Nổ! Tích tụ trọn vẹn 5 Điểm Liên Kích! Sẵn sàng tung đòn kết liễu!`, 'crit-msg');
    }

    // Combo 4: Xé Rách Vết Thương (Tear Open) - Khuếch đại Chảy Máu (Bleed)
    if (skillId === 'tear_open' && target && target.hasEffect && target.hasEffect('bleed')) {
      const bleedEff = target.getEffect('bleed');
      if (bleedEff) {
        bleedEff.duration += 2;
        bleedEff.value = (bleedEff.value || 3) + 2; // Tăng thêm 2% Max HP mỗi hiệp
        this.showFloatingNumber(targetSide, `VẾT THƯƠNG SÂU HOẮM! 🩸⬆️`, 'dmg-burn');
        this.log(`🩸💥 [Xé Rách Vết Thương] Vết thương sâu hoắm! Tăng thời gian Chảy Máu (+2 hiệp, còn ${bleedEff.duration} hiệp) và tăng thêm +2% Max HP (thành ${bleedEff.value}% Max HP/hiệp)!`, 'crit-msg');
      }
    }

    // Combo 5: Bức Tử (Rupture / Exsanguinate) - Kích nổ toàn bộ DoT Chảy Máu (% Max HP có Damage Cap)
    if (skillId === 'rupture' && target && target.hasEffect && target.hasEffect('bleed')) {
      const bleedEff = target.getEffect('bleed');
      if (bleedEff) {
        const percent = Math.max(1, bleedEff.value || 3);
        const maxHp = target.maxHp || 50;
        let perTurnDmg = Math.max(2, Math.floor(maxHp * (percent / 100)));

        // Áp dụng Damage Cap theo cấp bậc kẻ thù
        const isBoss = target.type === 'boss' || target.monsterType === 'boss' || target.isBoss;
        const isElite = target.type === 'elite' || target.monsterType === 'elite' || target.isElite;
        if (isBoss) {
          perTurnDmg = Math.min(perTurnDmg, 25);
        } else if (isElite) {
          perTurnDmg = Math.min(perTurnDmg, 20);
        } else {
          perTurnDmg = Math.min(perTurnDmg, 15);
        }

        const remainingTurns = Math.max(1, bleedEff.duration || 1);
        const bleedBurstDmg = perTurnDmg * remainingTurns;

        target.removeEffect('bleed');
        target.takeDamage(bleedBurstDmg);
        res.amount = (res.amount || 0) + bleedBurstDmg;
        this.shakeCard(targetSide);
        this.showFloatingNumber(targetSide, `-${bleedBurstDmg} 🩸💥 HUYẾT DỊCH BÙNG NỔ!`, 'dmg-burn');
        this.log(`🩸💥👑 [Huyết Dịch Bùng Nổ!] Kích nổ toàn bộ độc huyết! Rút cạn ${remainingTurns} hiệp Chảy Máu (${perTurnDmg} Dmg/hiệp, ${percent}% Max HP) gây ${bleedBurstDmg} sát thương tức thì và xóa tan vết thương!`, 'crit-msg');
      }
    }
  }

  /**
   * Xử lý DoT, HoT và kiểm tra Choáng ở đầu hiệp đấu
   * @param {Combatant} combatant
   * @param {'player'|'enemy'|'p1'|'p2'} side
   * @returns {Promise<boolean>} True nếu được phép hành động, False nếu bị choáng hoặc chết
   */
  async processTurnStartEffects(combatant, side) {
    if (!combatant) return true;

    // 0. Xử lý Môi Trường Địa Hình (Field / Domain) Đầu Hiệp
    const isTargetEnemy = (side === 'enemy') || (this.isPvP && side !== this._fieldOwnerSide);
    if (this.currentField === 'chaos_swamp' && this.fieldDuration > 0 && isTargetEnemy) {
      this.log('☣️🌫️ [MÔI TRƯỜNG: ĐẦM LẦY HỖN MANG] Độc khí và axit bủa vây mù mịt kẻ địch!', 'crit-msg');
      this.showFloatingNumber(side, '☣️ ĐẦM LẦY BỦA VÂY! 🧪🔥💧', 'dmg-poison');

      // Lập tức áp dụng (hoặc làm mới duration) các effect poison, burn, và acid (mỗi cái ít nhất 1 hiệp)
      ['poison', 'burn', 'acid'].forEach(effId => {
        const existing = combatant.getEffect ? combatant.getEffect(effId) : (combatant.activeEffects || []).find(e => e.id === effId);
        if (existing) {
          existing.duration = Math.max(existing.duration, 1);
        } else {
          const val = effId === 'acid' ? 8 : (effId === 'burn' ? 6 : 5);
          combatant.applyEffect(effId, 1, val);
        }
      });

      this.fieldDuration -= 1;
      if (this.fieldDuration <= 0) {
        this.currentField = null;
        this.log('🌫️ [Đầm Lầy Hỗn Mang] Màn sương độc địa đã tan biến, môi trường trở lại bình thường.', 'system-msg');
      }
      this.updateBattlefieldUI();
      this.updateArenaUI();
      await new Promise(r => setTimeout(r, 600));
      if (!combatant.isAlive()) return false;
    }

    if (!Array.isArray(combatant.activeEffects) || combatant.activeEffects.length === 0) {
      return true;
    }

    let hasStun = false;

    // Duyệt qua các hiệu ứng đầu hiệp
    for (const eff of [...combatant.activeEffects]) {
      // 1. Thiêu đốt (Burn DoT)
      if (eff.id === 'burn') {
        const dmg = Math.max(1, eff.value || 5);
        combatant.takeDamage(dmg);
        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        this.showFloatingNumber(side, `-${dmg} 🔥`, 'dmg-burn');
        this.log(`🔥 [Thiêu Đốt] ${combatant.name} bị ngọn lửa thiêu rụi, nhận ${dmg} sát thương!`, 'crit-msg');
        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 1.5. Chảy máu (Bleed DoT - Sát thương vật lý theo % Max HP)
      else if (eff.id === 'bleed') {
        const percent = Math.max(1, eff.value || 3);
        const maxHp = combatant.maxHp || 50;
        let bleedDmg = Math.max(2, Math.floor(maxHp * (percent / 100)));

        // Logic Damage Cap (Cân bằng game)
        const isBoss = combatant.type === 'boss' || combatant.monsterType === 'boss' || combatant.isBoss;
        const isElite = combatant.type === 'elite' || combatant.monsterType === 'elite' || combatant.isElite;

        if (isBoss) {
          bleedDmg = Math.min(bleedDmg, 25); // Giới hạn tối đa 25 sát thương/hiệp lên Boss
        } else if (isElite) {
          bleedDmg = Math.min(bleedDmg, 20); // Giới hạn tối đa 20 sát thương/hiệp lên Elite
        } else {
          bleedDmg = Math.min(bleedDmg, 15); // Quái thường giới hạn 15 sát thương/hiệp
        }

        combatant.takeDamage(bleedDmg);
        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        this.showFloatingNumber(side, `-${bleedDmg} 🩸`, 'dmg-burn');
        this.log(`🩸 [Chảy Máu] Vết thương xé toạc! ${combatant.name} mất ${bleedDmg} HP (${percent}% Max HP)!`, 'crit-msg');

        // Nội tại Vũ khí Huyền Thoại (Huyết Đao Kẻ Lưu Đày - lifestealOnBleed): Hồi phục HP bằng 50% sát thương Bleed
        const opponent = (side === 'enemy') ? this.player : (side === 'p2' ? this.pvpP1 : (side === 'p1' ? this.pvpP2 : null));
        if (opponent && opponent.isAlive()) {
          const equippedWeapon = (this.isPvP && opponent.equipment) ? opponent.equipment.weapon : (this.inventoryManager && this.inventoryManager.equipped ? this.inventoryManager.equipped.weapon : null);
          const hasLifestealOnBleed = equippedWeapon && (equippedWeapon.lifestealOnBleed || (equippedWeapon.passiveEffects && equippedWeapon.passiveEffects.lifestealOnBleed));
          if (hasLifestealOnBleed) {
            const healAmt = Math.max(1, Math.round(bleedDmg * 0.5));
            const actualHealed = opponent.healHp(healAmt);
            const opponentSide = (side === 'enemy') ? 'player' : (side === 'p2' ? 'p1' : 'p2');
            this.showFloatingNumber(opponentSide, `+${actualHealed} 🩸💚`, 'heal-regen');
            this.log(`🩸🗡️ [Huyết Đao Kẻ Lưu Đày] Hút lấy huyết khí từ vết thương đang chảy máu! Hồi phục +${actualHealed} HP!`, 'player-msg');
          }
        }

        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 2. Trúng độc (Poison DoT)
      else if (eff.id === 'poison') {
        const dmg = Math.max(1, eff.value || 5);
        combatant.takeDamage(dmg);
        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        this.showFloatingNumber(side, `-${dmg} 🧪`, 'dmg-poison');
        this.log(`🧪 [Trúng Độc] Độc tố phát tác, ${combatant.name} mất ${dmg} máu!`, 'enemy-msg');
        eff.value = Math.max(1, eff.value - 1); // Độc tố suy giảm dần
        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 3. Tráng kiện (Regen HoT)
      else if (eff.id === 'regen') {
        const healAmt = Math.max(1, eff.value || 5);
        const actual = combatant.healHp(healAmt);
        if (actual > 0) {
          this.showFloatingNumber(side, `+${actual} 💚`, 'heal-regen');
          this.log(`💚 [Tráng Kiện] Khí huyết lưu thông, ${combatant.name} hồi phục +${actual} HP!`, 'player-msg');
          this.updateArenaUI();
          await new Promise(r => setTimeout(r, 600));
        }
      }

      // 4. Choáng váng (Stun)
      else if (eff.id === 'stun') {
        hasStun = true;
      }

      // 5. Giật Điện (Shock DoT - Sát thương + Thiêu đốt 1 SP/MP)
      else if (eff.id === 'shock') {
        const dmg = Math.max(1, eff.value || 4);
        combatant.takeDamage(dmg);
        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        this.showFloatingNumber(side, `-${dmg} ⚡`, 'dmg-burn');

        let burnedResource = '';
        if (typeof combatant.sp === 'number' && combatant.sp > 0) {
          combatant.sp -= 1;
          burnedResource = ' (Đốt -1 SP)';
        } else if (typeof combatant.mp === 'number' && combatant.mp > 0) {
          combatant.mp -= 1;
          burnedResource = ' (Đốt -1 MP)';
        }

        this.log(`⚡ [Giật Điện] Dòng điện chạy rần rần! ${combatant.name} nhận ${dmg} sát thương${burnedResource}!`, 'crit-msg');
        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 6. Axit Ăn Mòn (Acid DoT - Bào mòn Giáp Ảo trước, dư trừ vào HP)
      else if (eff.id === 'acid') {
        const totalAcidDmg = Math.max(1, eff.value || 8);
        let blockDmg = 0;
        let hpDmg = 0;

        if (combatant.block && combatant.block > 0) {
          if (combatant.block >= totalAcidDmg) {
            combatant.block -= totalAcidDmg;
            blockDmg = totalAcidDmg;
          } else {
            blockDmg = combatant.block;
            hpDmg = totalAcidDmg - combatant.block;
            combatant.block = 0;
            combatant.takeDamage(hpDmg);
          }
        } else {
          hpDmg = totalAcidDmg;
          combatant.takeDamage(hpDmg);
        }

        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        const floatText = blockDmg > 0 ? (hpDmg > 0 ? `-${blockDmg}🛡️ -${hpDmg}🧪` : `-${blockDmg} 🛡️`) : `-${hpDmg} 🧪`;
        this.showFloatingNumber(side, floatText, 'dmg-poison');
        this.log(`🧪💧 [Axit Ăn Mòn] Axit ăn mòn trang bị! Bào mòn ${blockDmg} Giáp Ảo và ${hpDmg} HP của ${combatant.name}!`, 'enemy-msg');
        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 7. Ngạt Thở (Suffocate DoT - Gây 5% Max HP mỗi hiệp, tối đa 30)
      else if (eff.id === 'suffocate') {
        const rawPercentDmg = Math.floor((combatant.maxHp || 50) * 0.05);
        const dmg = Math.min(30, Math.max(3, rawPercentDmg));
        combatant.takeDamage(dmg);
        this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
        this.showFloatingNumber(side, `-${dmg} 🫁`, 'dmg-burn');
        this.log(`💨🫁 [Ngạt Thở] Mất dưỡng khí! ${combatant.name} mất ${dmg} HP (5% Max HP)!`, 'crit-msg');
        this.updateArenaUI();
        await new Promise(r => setTimeout(r, 600));
        if (!combatant.isAlive()) return false;
      }

      // 8. Bản Án Tử (Doom DoT - Không gây sát thương mỗi hiệp, CHỈ NỔ khi duration === 1)
      else if (eff.id === 'doom') {
        if (eff.duration === 1) {
          const doomDmg = Math.max(25, eff.value || 50);
          combatant.takeDamage(doomDmg);
          this.shakeCard(side === 'player' || side === 'p1' ? 'player' : 'enemy');
          this.showFloatingNumber(side, `-${doomDmg} 💀 BẢN ÁN TỬ!`, 'dmg-burn');
          this.log(`💀💥👑 [BẢN ÁN TỬ NỔ TUNG] Thời khắc phán quyết đã điểm! Ám khí bộc phá khủng khiếp, gây ${doomDmg} sát thương chuẩn lên ${combatant.name}!`, 'crit-msg');
          this.updateArenaUI();
          await new Promise(r => setTimeout(r, 700));
          if (!combatant.isAlive()) return false;
        } else {
          const remaining = eff.duration - 1;
          this.showFloatingNumber(side, `⏳ ${remaining}`, 'status-stun');
          this.log(`⏳ [Bản Án Tử] Ám khí đếm ngược trên ${combatant.name}... Còn ${remaining} hiệp trước khi bộc phát!`, 'system-msg');
        }
      }
    }

    // Giảm thời gian duy trì của toàn bộ hiệu ứng
    combatant.activeEffects.forEach(eff => {
      eff.duration -= 1;
    });

    // Lọc bỏ các hiệu ứng hết hạn
    const expired = combatant.activeEffects.filter(eff => eff.duration <= 0);
    expired.forEach(eff => {
      const def = STATUS_EFFECTS[eff.id];
      if (def) {
        this.log(`⏳ Hiệu ứng [${def.name}] trên ${combatant.name} đã kết thúc.`, 'system-msg');
      }
    });

    combatant.activeEffects = combatant.activeEffects.filter(eff => eff.duration > 0);
    this.updateArenaUI();

    // Nếu bị Choáng, thông báo và bỏ qua lượt hành động
    if (hasStun) {
      this.showFloatingNumber(side, 'CHOÁNG 💫', 'status-stun');
      this.log(`💫 [Choáng Váng] ${combatant.name} bị choáng ngất và mất hoàn toàn lượt hành động!`, 'system-msg');
      await new Promise(r => setTimeout(r, 900));
      return false; // Mất lượt
    }

    return true; // Được phép hành động
  }

  /**
   * Cập nhật danh sách Icon trạng thái Buff / Debuff trên UI
   */
  updateStatusBars(displayPlayer, displayEnemy) {
    this._renderStatusBarForCombatant(displayPlayer, 'combat-player-status-bar');
    this._renderStatusBarForCombatant(displayEnemy, 'combat-enemy-status-bar');
  }

  _renderStatusBarForCombatant(combatant, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!combatant || !Array.isArray(combatant.activeEffects) || combatant.activeEffects.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    combatant.activeEffects.forEach(eff => {
      const def = STATUS_EFFECTS[eff.id];
      if (!def) return;

      const badge = document.createElement('div');
      badge.className = `status-badge ${def.type}`;
      badge.innerHTML = `
        <span class="status-badge-icon">${def.icon}</span>
        <span class="status-badge-duration">${eff.duration}</span>
      `;

      const titleDesc = `${def.name} (${def.type === 'buff' ? 'Buff' : 'Debuff'}): ${def.desc} (Còn ${eff.duration} hiệp${eff.value ? `, giá trị: ${eff.value}` : ''})`;
      badge.setAttribute('title', titleDesc);

      // Tooltip nổi khi hover
      const tooltip = document.getElementById('item-tooltip');
      if (tooltip) {
        badge.onmouseenter = () => {
          tooltip.innerHTML = `
            <div class="tooltip-panel" style="border-color: ${def.color}; box-shadow: 0 0 15px ${def.color}40;">
              <div class="tooltip-panel-tag" style="background: ${def.color}20; color: ${def.color}; border: 1px solid ${def.color}60;">
                ${def.type === 'buff' ? '✨ HIỆU ỨNG CÓ LỢI (BUFF)' : '⚠️ HIỆU ỨNG BẤT LỢI (DEBUFF)'}
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin: 6px 0 4px;">
                <span style="font-size: 1.5rem;">${def.icon}</span>
                <span style="font-family: var(--font-title); font-size: 1.1rem; font-weight: 800; color: ${def.color}; text-shadow: 0 0 10px ${def.color}80;">${def.name}</span>
              </div>
              <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.4; margin-bottom: 8px;">
                "${def.desc}"
              </div>
              <div style="font-size: 0.8rem; color: #ffd166; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
                ⏳ Thời gian hiệu lực: <b>${eff.duration} hiệp</b> ${eff.value ? `(Chỉ số: ${eff.value})` : ''}
              </div>
            </div>
          `;
          tooltip.classList.remove('hidden');
        };

        badge.onmousemove = (e) => {
          if (tooltip.classList.contains('hidden')) return;
          let left = e.clientX + 16;
          let top = e.clientY + 16;
          const w = tooltip.offsetWidth || 260;
          if (left + w > window.innerWidth - 10) left = e.clientX - w - 16;
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        };

        badge.onmouseleave = () => {
          tooltip.classList.add('hidden');
          tooltip.innerHTML = '';
        };
      }

      container.appendChild(badge);
    });
  }
}

