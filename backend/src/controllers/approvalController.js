// backend/src/controllers/approvalController.js
// Express controllers for Approval decision endpoints

import { approvalService } from '../services/approvalService.js';

export const approvalController = {
  async list(req, res, next) {
    try {
      const { workflow_id, approver_id, status, limit = 50, offset = 0 } = req.query;

      let approverFilter = approver_id;
      if (req.user.role === 'employee' || req.user.role === 'manager') {
        if (!approverFilter) approverFilter = req.user.id;
      }

      const result = await approvalService.listApprovals({
        workflowId: workflow_id,
        approverId: approverFilter,
        status,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const approval = await approvalService.getApprovalById(id);

      if (!approval) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Approval ${id} not found.` } });
      }

      res.status(200).json({
        success: true,
        data: { approval },
      });
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const updatedApproval = await approvalService.approve(id, req.user, comments);

      res.status(200).json({
        success: true,
        data: { approval: updatedApproval },
      });
    } catch (err) {
      next(err);
    }
  },

  async reject(req, res, next) {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const updatedApproval = await approvalService.reject(id, req.user, comments);

      res.status(200).json({
        success: true,
        data: { approval: updatedApproval },
      });
    } catch (err) {
      next(err);
    }
  },
};
