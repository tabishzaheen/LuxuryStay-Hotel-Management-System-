const express = require('express');

const router = express.Router();

const CleaningTask = require('../models/CleaningTask');
const Room = require('../models/Room');
const User = require('../models/User');

const {
  protect,
  requireRole
} = require('../middleware/auth');


const STAFF_ROLES = [
  'admin',
  'manager',
  'housekeeping'
];

const allowedTaskTypes = [
  'cleaning',
  'deep-cleaning',
  'turn-down',
  'restock',
  'inspection',
  'other'
];

const allowedPriorities = [
  'low',
  'normal',
  'high',
  'urgent'
];

const allowedStatuses = [
  'pending',
  'in-progress',
  'completed'
];


/* =========================================================
   GET HOUSEKEEPING STAFF
========================================================= */
router.get('/staff', protect, requireRole(['admin', 'manager', 'housekeeping']), async (req, res) => {
  try {
    const staff = await User.find({
      role: 'housekeeping',
      isActive: true
    }).select('name email role department');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* =========================================================
   GET ALL HOUSEKEEPING TASKS
========================================================= */

router.get(
  '/',
  protect,
  requireRole(STAFF_ROLES),
  async (req, res) => {
    try {

      const filter = {};

      if (
        req.query.status &&
        allowedStatuses.includes(req.query.status)
      ) {
        filter.status = req.query.status;
      }

      if (
        req.user.role === 'housekeeping' &&
        req.query.mine === 'true'
      ) {
        filter.assignedTo = req.user._id;
      }

      const tasks = await CleaningTask.find(filter)
        .populate(
          'room',
          'number type status'
        )
        .populate(
          'assignedTo',
          'name email role'
        )
        .populate(
          'createdBy',
          'name email role'
        )
        .sort({
          scheduledFor: 1,
          createdAt: -1
        });

      res.json(tasks);

    } catch (error) {

      console.error(
        'Get housekeeping tasks error:',
        error
      );

      res.status(500).json({
        message: error.message
      });
    }
  }
);


/* =========================================================
   CREATE HOUSEKEEPING TASK
========================================================= */

router.post(
  '/',
  protect,
  requireRole(STAFF_ROLES),
  async (req, res) => {
    try {

      const {
        room: roomId,
        taskType = 'cleaning',
        notes = '',
        priority = 'normal',
        assignedTo = null,
        scheduledFor
      } = req.body;


      if (!roomId) {
        return res.status(400).json({
          message: 'Room is required'
        });
      }


      if (!scheduledFor) {
        return res.status(400).json({
          message:
            'Scheduled date and time are required'
        });
      }


      if (!allowedTaskTypes.includes(taskType)) {
        return res.status(400).json({
          message:
            'Invalid cleaning task type'
        });
      }


      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          message:
            'Invalid cleaning priority'
        });
      }


      const room = await Room.findById(roomId);

      if (!room) {
        return res.status(404).json({
          message: 'Room not found'
        });
      }


      let assignee = null;


      if (assignedTo) {

        assignee = await User.findById(
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
            'housekeeping',
            'admin',
            'manager'
          ].includes(assignee.role)
        ) {
          return res.status(400).json({
            message:
              'Task can only be assigned to housekeeping staff or management'
          });
        }


        if (assignee.isActive === false) {
          return res.status(400).json({
            message:
              'Assigned staff member is inactive'
          });
        }
      }


      const task = await CleaningTask.create({

        room: roomId,

        taskType,

        notes: String(notes).trim(),

        priority,

        assignedTo:
          assignee
            ? assignee._id
            : null,

        scheduledFor:
          new Date(scheduledFor),

        createdBy:
          req.user._id
      });


      if (
        room.status !== 'occupied' &&
        room.status !== 'maintenance'
      ) {

        room.status = 'cleaning';

        await room.save();
      }


      const populated =
        await CleaningTask.findById(
          task._id
        )
          .populate(
            'room',
            'number type status'
          )
          .populate(
            'assignedTo',
            'name email role'
          )
          .populate(
            'createdBy',
            'name email role'
          );


      res.status(201).json(
        populated
      );

    } catch (error) {

      console.error(
        'Create housekeeping task error:',
        error
      );

      res.status(500).json({
        message: error.message
      });
    }
  }
);


/* =========================================================
   UPDATE HOUSEKEEPING TASK STATUS
========================================================= */

router.patch(
  '/:id/status',
  protect,
  requireRole(STAFF_ROLES),
  async (req, res) => {

    try {

      const { status } = req.body;


      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message:
            'Invalid housekeeping task status'
        });
      }


      const task =
        await CleaningTask.findById(
          req.params.id
        );


      if (!task) {
        return res.status(404).json({
          message:
            'Cleaning task not found'
        });
      }


      if (
        req.user.role === 'housekeeping' &&
        task.assignedTo &&
        task.assignedTo.toString() !==
          req.user._id.toString()
      ) {

        return res.status(403).json({
          message:
            'You can only update your assigned housekeeping tasks'
        });
      }


      task.status = status;


      task.completedAt =
        status === 'completed'
          ? new Date()
          : null;


      await task.save();


      /*
       * When task is completed,
       * check if another active task
       * exists for this room.
       */

      if (status === 'completed') {

        const activeTask =
          await CleaningTask.exists({

            room: task.room,

            status: {
              $in: [
                'pending',
                'in-progress'
              ]
            },

            _id: {
              $ne: task._id
            }
          });


        if (!activeTask) {

          const room =
            await Room.findById(
              task.room
            );


          if (
            room &&
            room.status === 'cleaning'
          ) {

            room.status = 'available';

            await room.save();
          }
        }

      } else {

        /*
         * Pending or In Progress
         * means room is being cleaned.
         */

        const room =
          await Room.findById(
            task.room
          );


        if (
          room &&
          room.status !== 'maintenance' &&
          room.status !== 'occupied'
        ) {

          room.status = 'cleaning';

          await room.save();
        }
      }


      const populated =
        await CleaningTask.findById(
          task._id
        )
          .populate(
            'room',
            'number type status'
          )
          .populate(
            'assignedTo',
            'name email role'
          )
          .populate(
            'createdBy',
            'name email role'
          );


      res.json(populated);

    } catch (error) {

      console.error(
        'Update housekeeping status error:',
        error
      );

      res.status(500).json({
        message: error.message
      });
    }
  }
);


module.exports = router;