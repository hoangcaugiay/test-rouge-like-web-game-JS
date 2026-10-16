/**
 * ============================================================================
 * MAPNODE.JS - MÔ HÌNH ĐIỂM (NODE) BẢN ĐỒ PHÂN NHÁNH 3 ĐƯỜNG (SLAY THE SPIRE)
 * Các đặc tính:
 * - id: Định danh duy nhất (VD: 'col-1-row-2')
 * - column: Chỉ số cột (0 đến totalStages - 1)
 * - row: Hàng ngang (1: Trên, 2: Giữa, 3: Dưới)
 * - connectedNodes: Mảng chứa ID các Node ở cột tiếp theo được nối trực tiếp
 * - nextNodes: Mảng chứa tham chiếu đối tượng MapNode kế tiếp
 * ============================================================================
 */

export class MapNode {
  /**
   * @param {Object} config Thông số khởi tạo điểm bản đồ
   */
  constructor({
    id,
    column,
    row = 2, // 1: Row trên, 2: Row giữa, 3: Row dưới
    type = 'combat', // 'starter_reward' | 'combat' | 'event' | 'elite' | 'rest' | 'shop' | 'treasure' | 'boss'
    name = 'Điểm Nguy Hiểm',
    icon = '⚔️',
    desc = 'Quái vật đang rình rập trong bóng tối',
    enemyId = 'goblin',
    eventId = null,
    isAvailable = false,
    isCompleted = false,
    connectedNodes = []
  }) {
    this.id = id;
    this.column = column;
    this.row = row;
    this.type = type;
    this.name = name;
    this.icon = icon;
    this.desc = desc;
    this.enemyId = enemyId;
    this.eventId = eventId;
    this.isAvailable = isAvailable;
    this.isCompleted = isCompleted;
    this.connectedNodes = Array.isArray(connectedNodes) ? [...connectedNodes] : [];
    this.nextNodes = []; // Mảng chứa các đối tượng MapNode ở cột tiếp theo
  }

  /**
   * Kết nối tới một node ở cột tiếp theo (lưu cả ID và Object)
   * @param {MapNode} targetNode Node mục tiêu ở cột sau
   */
  connectTo(targetNode) {
    if (!targetNode) return;
    if (!this.connectedNodes.includes(targetNode.id)) {
      this.connectedNodes.push(targetNode.id);
    }
    if (!this.nextNodes.includes(targetNode)) {
      this.nextNodes.push(targetNode);
    }
  }

  /**
   * Đánh dấu hoàn thành node hiện tại
   */
  complete() {
    this.isCompleted = true;
    this.isAvailable = false;
  }
}
