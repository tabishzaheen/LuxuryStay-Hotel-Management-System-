const express = require('express');
const router = express.Router();

const Maintenance = require('../models/Maintenance');
const Room = require('../models/Room');
const User = require('../models/User');
const { createNotification } = require('../utils/notifications');

const {
  protect,
  requireRole
} = require('../middleware/auth');

const MANAGEMENT_ROLES = [
  'admin',
  'manager'
];

const WORKER_ROLES = [
  'maintenance'
];

const REPORT_ROLES = [
  'admin',
  'manager',
  'housekeeping',
  'receptionist',
  'maintenance',
  'guest'
];

const allowedCategories = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'internet',
  'furniture',
  'other'
];

const allowedPriorities = [
  'low',
  'normal',
  'high',
  'urgent'
];

const allowedStatuses = [
  'reported',
  'in-progress',
  'resolved'
];

/*
  REPORT MAINTENANCE ISSUE
  Staff + Guest can report
*/
router.post(
  '/',
  protect,
  requireRole(REPORT_ROLES),
  async (req, res) => {
    try {
      const {
        room: roomId = null,
        location = '',
        description = '',
        category = 'other',
        priority = 'normal',
        assignedTo = null
      } = req.body;

      const cleanDescription =
        String(description).trim();

      const cleanLocation =
        String(location).trim();

      if (!cleanDescription) {
        return res.status(400).json({
          message:
            'Description is required'
        });
      }

      if (
        !roomId &&
        !cleanLocation
      ) {
        return res.status(400).json({
          message:
            'Room or location is required'
        });
      }

      if (
        !allowedCategories.includes(category)
      ) {
        return res.status(400).json({
          message:
            'Invalid maintenance category'
        });
      }

      if (
        !allowedPriorities.includes(priority)
      ) {
        return res.status(400).json({
          message:
            'Invalid maintenance priority'
        });
      }

      let room = null;

      if (roomId) {
        room =
          await Room.findById(roomId);

        if (!room) {
          return res.status(404).json({
            message: 'Room not found'
          });
        }
      }

      let assignee = null;

      if (assignedTo) {
        /* Only management can assign maintenance work. */
        if (
          !['admin', 'manager'].includes(req.user.role)
        ) {
          return res.status(403).json({
            message:
              'You are not allowed to assign maintenance staff'
          });
        }

        assignee =
          await User.findById(
            assignedTo
          ).select(
            'name email role isActive'
          );

        if (!assignee) {
          return res.status(404).json({
            message:
              'Assigned staff member not found'
          });
        }

        if (
          ![
            'maintenance',
            'admin',
            'manager'
          ].includes(assignee.role)
        ) {
          return res.status(400).json({
            message:
              'Issue can only be assigned to maintenance staff or management'
          });
        }

        if (
          assignee.isActive === false
        ) {
          return res.status(400).json({
            message:
              'Assigned staff member is inactive'
          });
        }
      }

      const report =
        await Maintenance.create({
          room: room
            ? room._id
            : null,

          location:
            cleanLocation,

          reportedBy:
            req.user._id,

          assignedTo:
            assignee
              ? assignee._id
              : null,

          description:
            cleanDescription,

          category,

          priority
        });

      /*
        Room becomes maintenance.
      */
      if (room) {
        room.status =
          'maintenance';

        await room.save();
      }

      await createNotification({
        audienceRoles: ['admin', 'manager', 'maintenance'],
        type: 'maintenance',
        title: 'New maintenance issue',
        message: `${category} issue reported${room ? ` for Room ${room.number}` : ''}.`,
        link: '/maintenance',
        settingKey: 'maintenanceIssue'
      });

      const populated =
        await Maintenance.findById(
          report._id
        )
          .populate(
            'room',
            'number type status'
          )
          .populate(
            'reportedBy',
            'name email role'
          )
          .populate(
            'assignedTo',
            'name email role'
          );

      res.status(201).json(
        populated
      );
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);

/*
  GET MAINTENANCE STAFF
*/
router.get(
  '/staff',
  protect,
  requireRole([...REPORT_ROLES, 'maintenance']),
  async (req, res) => {
    try {
      const staff = await User.find({
        role: 'maintenance',
        isActive: true
      }).select('name email role department');
      res.json(staff);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/*
  GET GUEST'S OWN MAINTENANCE REPORTS
*/
router.get(
  '/mine',
  protect,
  requireRole('guest'),
  async (req, res) => {
    try {
      const reports = await Maintenance.find({ reportedBy: req.user._id })
        .populate('room', 'number type status')
        .populate('assignedTo', 'name email role')
        .sort({ createdAt: -1 });

      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/*
  GET MAINTENANCE REPORTS
*/
router.get(
  '/',
  protect,
  requireRole(REPORT_ROLES),
  async (req, res) => {
    try {
      const filter = {};

      if (MANAGEMENT_ROLES.includes(req.user.role)) {
        // Management can see all maintenance work.
      } else if (WORKER_ROLES.includes(req.user.role)) {
        // Maintenance staff see the work assigned to them, not
        // issues they happened to report themselves.
        filter.assignedTo = req.user._id;
      } else {
        filter.reportedBy = req.user._id;
      }

      if (
        req.query.status &&
        allowedStatuses.includes(
          req.query.status
        )
      ) {
        filter.status =
          req.query.status;
      }

      if (
        req.query.priority &&
        allowedPriorities.includes(
          req.query.priority
        )
      ) {
        filter.priority =
          req.query.priority;
      }

      const reports =
        await Maintenance.find(filter)
          .populate(
            'room',
            'number type status'
          )
          .populate(
            'reportedBy',
            'name email role'
          )
          .populate(
            'assignedTo',
            'name email role'
          )
          .sort({
            createdAt: -1
          });

      res.json(reports);
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);

/*
  UPDATE MAINTENANCE
*/
router.put(
  '/:id',
  protect,
  requireRole([...MANAGEMENT_ROLES, ...WORKER_ROLES]),
  async (req, res) => {
    try {
      const report =
        await Maintenance.findById(
          req.params.id
        );

      if (!report) {
        return res.status(404).json({
          message:
            'Maintenance report not found'
        });
      }

      const {
        status,
        priority,
        assignedTo
      } = req.body;

      // Maintenance staff can update the status of work assigned
      // to them, but cannot reassign jobs or change priorities.
      if (req.user.role === 'maintenance') {
        if (!report.assignedTo || report.assignedTo.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            message: 'You can only update maintenance issues assigned to you'
          });
        }

        if (priority !== undefined || assignedTo !== undefined) {
          return res.status(403).json({
            message: 'Maintenance staff can only update the issue status'
          });
        }
      }

      /*
        STATUS
      */
      if (status !== undefined) {
        if (
          !allowedStatuses.includes(status)
        ) {
          return res.status(400).json({
            message:
              'Invalid maintenance status'
          });
        }

        report.status =
          status;

        report.resolvedAt =
          status === 'resolved'
            ? new Date()
            : null;
      }

      /*
        PRIORITY
      */
      if (priority !== undefined) {
        if (
          !allowedPriorities.includes(
            priority
          )
        ) {
          return res.status(400).json({
            message:
              'Invalid maintenance priority'
          });
        }

        report.priority =
          priority;
      }

      /*
        ASSIGN STAFF
      */
      if (assignedTo !== undefined) {
        if (
          assignedTo === null ||
          assignedTo === ''
        ) {
          report.assignedTo =
            null;
        } else {
          const assignee =
            await User.findById(
              assignedTo
            ).select(
              'role isActive'
            );

          if (!assignee) {
            return res.status(404).json({
              message:
                'Assigned staff member not found'
            });
          }

          if (
            ![
              'maintenance',
              'admin',
              'manager'
            ].includes(
              assignee.role
            )
          ) {
            return res.status(400).json({
              message:
                'Issue can only be assigned to maintenance staff or management'
            });
          }

          if (
            assignee.isActive === false
          ) {
            return res.status(400).json({
              message:
                'Assigned staff member is inactive'
            });
          }

          report.assignedTo =
            assignee._id;
        }
      }

      await report.save();

      /*
        Synchronize room status.
      */
      if (report.room) {
        const room =
          await Room.findById(
            report.room
          );

        if (room) {
          if (
            report.status !==
            'resolved'
          ) {
            room.status =
              'maintenance';
          } else {
            const otherOpenIssue =
              await Maintenance.exists({
                room: room._id,
                status: {
                  $in: [
                    'reported',
                    'in-progress'
                  ]
                },
                _id: {
                  $ne:
                    report._id
                }
              });

            if (
              !otherOpenIssue &&
              room.status ===
                'maintenance'
            ) {
              room.status =
                'available';
            }
          }

          await room.save();
        }
      }

      const populated =
        await Maintenance.findById(
          report._id
        )
          .populate(
            'room',
            'number type status'
          )
          .populate(
            'reportedBy',
            'name email role'
          )
          .populate(
            'assignedTo',
            'name email role'
          );

      res.json(populated);
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  }
);

module.exports = router;