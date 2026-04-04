#!/usr/bin/env node
/**
 * ███ NERV 审批管理工具 · manage_approvals.js ███
 *
 * 造物主 / gendo 用于管理异步审批队列
 *
 * 用法:
 *   node scripts/tools/manage_approvals.js list              # 列出待批复
 *   node scripts/tools/manage_approvals.js approve <id>      # 批准
 *   node scripts/tools/manage_approvals.js reject <id>       # 拒绝
 *   node scripts/tools/manage_approvals.js history           # 查看已处理
 */

import { getPendingApprovals, resolveApproval, closeDb } from '../db.js';

const [,, action, idArg] = process.argv;

async function main() {
  try {
    switch (action) {
      case 'list': {
        const items = await getPendingApprovals('PENDING');
        if (items.length === 0) {
          console.log(JSON.stringify({ pending: 0, message: '无待批复事项。系统清净。' }));
        } else {
          console.log(JSON.stringify({
            pending: items.length,
            items: items.map(i => ({
              id: i.id,
              type: i.approval_type,
              task_id: i.task_id,
              requested_by: i.requested_by,
              payload: JSON.parse(i.payload),
              created_at: new Date(i.created_at * 1000).toISOString()
            }))
          }, null, 2));
        }
        break;
      }

      case 'approve':
      case 'reject': {
        const id = parseInt(idArg);
        if (!id || isNaN(id)) {
          console.error(JSON.stringify({ success: false, error: '必须提供有效的审批 ID (数字)' }));
          process.exit(1);
        }
        const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const result = await resolveApproval(id, status, '造物主');
        if (result.changed === 0) {
          console.error(JSON.stringify({ success: false, error: `ID ${id} 不存在或已处理` }));
          process.exit(1);
        }
        console.log(JSON.stringify({ success: true, id, status, message: `审批 #${id} 已${action === 'approve' ? '批准' : '拒绝'}` }));
        break;
      }

      case 'history': {
        const approved = await getPendingApprovals('APPROVED');
        const rejected = await getPendingApprovals('REJECTED');
        console.log(JSON.stringify({
          approved: approved.length,
          rejected: rejected.length,
          recent: [...approved, ...rejected]
            .sort((a, b) => (b.resolved_at || 0) - (a.resolved_at || 0))
            .slice(0, 10)
            .map(i => ({
              id: i.id,
              type: i.approval_type,
              status: i.status,
              resolved_by: i.resolved_by,
              resolved_at: i.resolved_at ? new Date(i.resolved_at * 1000).toISOString() : null
            }))
        }, null, 2));
        break;
      }

      default:
        console.error(JSON.stringify({
          success: false,
          error: '未知命令',
          usage: 'node manage_approvals.js <list|approve|reject|history> [id]'
        }));
        process.exit(1);
    }
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
