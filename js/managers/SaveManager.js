/**
 * ============================================================================
 * SAVEMANAGER.JS - QUAN LY LUU & TAI TIEN TRINH TU LOCALSTORAGE
 * Chuc nang:
 * 1. Auto-save tien trinh: Player stats (Gold, SP), Inventory, Map route.
 * 2. Hall of Fame Roster: Luu nhan vat tuy chon vao savedRoster rieng.
 * 3. Phuc hoi va ep kieu (Re-instantiate) lai dung doi tuong Class.
 * ============================================================================
 */

import { Player } from '../models/Player.js';
import { Item } from '../models/Item.js';
import { MapNode } from '../models/MapNode.js';

export const SAVE_KEY = 'valorchronicles_save_v2';
export const ROSTER_KEY = 'valorchronicles_roster_v2';

export class SaveManager {

  // ===========================================================================
  // PHAN 1: AUTO-SAVE TIEN TRINH GAME HIEN TAI
  // ===========================================================================

  static hasSave() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      return !!data && JSON.parse(data) !== null;
    } catch (e) {
      return false;
    }
  }

  static getSaveSummary() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return 'Khong tim thay ban luu';
      const parsed = JSON.parse(raw);
      const timestamp = parsed.timestamp
        ? new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const p = parsed.player;
      const gold = p.gold !== undefined ? p.gold : 50;
      return 'Luu luc ' + timestamp + ' - HP: ' + p.hp + '/' + p.maxHp + ' | SP: ' + p.sp + '/' + p.maxSp + ' | Vang: ' + gold;
    } catch (e) {
      return 'Ban luu khong hop le';
    }
  }

  static saveGame(player, inventoryManager, mapManager) {
    try {
      const saveData = {
        timestamp: Date.now(),
        player: {
          name: player.name,
          avatar: player.avatar || '\uD83D\uDEE1\uFE0F',
          hp: player.hp,
          maxHp: player.maxHp,
          mp: player.mp,
          maxMp: player.maxMp,
          sp: player.sp,
          maxSp: player.maxSp,
          gold: player.gold !== undefined ? player.gold : 50,
          ac: player.ac,
          attackMod: player.attackMod,
          damageDice: player.damageDice,
          skills: [...(player.skills || [])],
          curses: [...(player.curses || [])],
          canBlock: player.canBlock,
          canCounter: player.canCounter,
          classId: player.classId || 'warrior',
          skillPoints: player.skillPoints !== undefined ? player.skillPoints : 1,
          earnedSkillPoints: player.earnedSkillPoints !== undefined ? player.earnedSkillPoints : 0,
          rage: player.rage || 0,
          comboPoints: player.comboPoints || 0,
          manaShieldActive: !!player.manaShieldActive
        },
        inventory: {
          equipped: {
            weapon: inventoryManager.equipped.weapon ? { ...inventoryManager.equipped.weapon } : null,
            armor: inventoryManager.equipped.armor ? { ...inventoryManager.equipped.armor } : null,
            shield: inventoryManager.equipped.shield ? { ...inventoryManager.equipped.shield } : null
          },
          backpack: inventoryManager.backpack.map(item => ({ ...item }))
        },
        map: {
          currentNodeId: mapManager.currentNode ? mapManager.currentNode.id : null,
          columns: mapManager.columns.map(col =>
            col.map(node => ({
              id: node.id,
              column: node.column,
              row: node.row,
              type: node.type,
              name: node.name,
              icon: node.icon,
              desc: node.desc,
              enemyId: node.enemyId,
              eventId: node.eventId || null,
              isAvailable: node.isAvailable,
              isCompleted: node.isCompleted,
              connectedNodes: Array.isArray(node.connectedNodes) ? [...node.connectedNodes] : []
            }))
          )
        }
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      this.triggerSaveIndicator();
      return true;
    } catch (e) {
      console.error('Khong the luu du lieu tro choi:', e);
      return false;
    }
  }

  static loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const pData = parsed.player;
      const initialGold = pData.gold !== undefined ? pData.gold : 50;
      const player = new Player(pData.name, initialGold);
      player.hp = pData.hp;
      player.maxHp = pData.maxHp;
      player.mp = pData.mp;
      player.maxMp = pData.maxMp;
      player.sp = pData.sp;
      player.maxSp = pData.maxSp;
      player.gold = initialGold;
      player.ac = pData.ac;
      player.attackMod = pData.attackMod;
      player.damageDice = pData.damageDice;
      player.skills = pData.skills || ['heavy_strike'];
      player.classId = pData.classId || 'warrior';
      player.skillPoints = pData.skillPoints !== undefined ? pData.skillPoints : 1;
      player.earnedSkillPoints = pData.earnedSkillPoints !== undefined ? pData.earnedSkillPoints : 0;
      if (pData.rage !== undefined) player.rage = pData.rage;
      if (pData.comboPoints !== undefined) player.comboPoints = pData.comboPoints;
      if (pData.manaShieldActive !== undefined) player.manaShieldActive = pData.manaShieldActive;
      player.canBlock = pData.canBlock;
      player.canCounter = pData.canCounter;
      player.curses = Array.isArray(pData.curses) ? [...pData.curses] : [];
      player.hasReaction = true;
      if (pData.avatar) player.avatar = pData.avatar;

      const invData = parsed.inventory;
      const restoredEquipped = {
        weapon: invData.equipped.weapon ? new Item(invData.equipped.weapon) : null,
        armor: invData.equipped.armor ? new Item(invData.equipped.armor) : null,
        shield: invData.equipped.shield ? new Item(invData.equipped.shield) : null
      };
      const restoredBackpack = (invData.backpack || []).map(rawItem => new Item(rawItem));

      const mapRaw = parsed.map;
      const restoredColumns = mapRaw.columns.map(col =>
        col.map(rawNode => new MapNode(rawNode))
      );

      const nodeMap = new Map();
      restoredColumns.forEach(col => col.forEach(node => nodeMap.set(node.id, node)));
      restoredColumns.forEach(col => {
        col.forEach(node => {
          node.nextNodes = [];
          (node.connectedNodes || []).forEach(targetId => {
            const target = nodeMap.get(targetId);
            if (target && !node.nextNodes.includes(target)) {
              node.nextNodes.push(target);
            }
          });
        });
      });

      let currentNode = null;
      if (mapRaw.currentNodeId) {
        for (const col of restoredColumns) {
          const match = col.find(n => n.id === mapRaw.currentNodeId);
          if (match) { currentNode = match; break; }
        }
      }

      return {
        player,
        inventoryData: { equipped: restoredEquipped, backpack: restoredBackpack },
        mapData: { columns: restoredColumns, currentNode }
      };
    } catch (e) {
      console.error('Loi khi tai du lieu Save:', e);
      return null;
    }
  }

  static clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  }

  static triggerSaveIndicator() {
    const el = document.getElementById('autosave-indicator');
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ===========================================================================
  // PHAN 2: HALL OF FAME ROSTER - LUU / XOA / DOC DANH SACH NHAN VAT
  // ===========================================================================

  static getRoster() {
    try {
      const raw = localStorage.getItem(ROSTER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static hasEnoughRosterForPvP() {
    return this.getRoster().length >= 2;
  }

  /**
   * Luu nhan vat hien tai vao Roster Danh Vong sau khi ket thuc Run.
   * Snapshot toan bo chi so, trang bi, ky nang tai thoi diem luu.
   * HP/MP/SP luu o muc toi da de PvP cong bang.
   */
  static saveToRoster(player, inventoryManager, heroName, stage = 1) {
    try {
      const roster = this.getRoster();
      const relics = (inventoryManager && inventoryManager.backpack)
        ? inventoryManager.backpack
            .filter(i => i && i.type === 'relic')
            .map(r => ({ name: r.name, icon: r.icon, desc: r.desc, rarity: r.rarity || 'common' }))
        : [];

      const rosterEntry = {
        id: 'hero_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
        savedAt: Date.now(),
        heroName: heroName || player.name,
        name: player.name,
        avatar: player.avatar || '🛡️',
        classId: player.classId || 'warrior',
        stage: stage || 1,
        relics: relics,
        // HP/MP/SP o muc toi da de PvP cong bang
        hp: player.maxHp,
        maxHp: player.maxHp,
        mp: player.maxMp,
        maxMp: player.maxMp,
        sp: player.maxSp,
        maxSp: player.maxSp,
        gold: player.gold || 0,
        ac: player.ac,
        attackMod: player.attackMod,
        damageDice: player.damageDice,
        skills: [...(player.skills || [])],
        canBlock: player.canBlock,
        canCounter: player.canCounter,
        equipped: {
          weapon: inventoryManager.equipped.weapon ? { ...inventoryManager.equipped.weapon } : null,
          armor: inventoryManager.equipped.armor ? { ...inventoryManager.equipped.armor } : null,
          shield: inventoryManager.equipped.shield ? { ...inventoryManager.equipped.shield } : null
        }
      };

      roster.push(rosterEntry);
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
      return rosterEntry;
    } catch (e) {
      console.error('Loi khi luu vao Roster:', e);
      return null;
    }
  }

  static deleteFromRoster(entryId) {
    try {
      let roster = this.getRoster();
      const before = roster.length;
      roster = roster.filter(entry => entry.id !== entryId);
      if (roster.length < before) {
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  static clearRoster() {
    try { localStorage.removeItem(ROSTER_KEY); } catch (e) { }
  }
}
