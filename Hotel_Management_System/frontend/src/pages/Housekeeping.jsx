import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  Plus,
  Sparkles,
  X
} from 'lucide-react';

import { PageHead, Status, Notice } from '../components/UI';
import { api } from '../services/api';

const getDefaultDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);

  const offset = date.getTimezoneOffset();
  const localDate = new Date(
    date.getTime() - offset * 60000
  );

  return localDate.toISOString().slice(0, 16);
};

const getEmptyForm = () => ({
  room: '',
  taskType: 'cleaning',
  priority: 'normal',
  assignedTo: '',
  scheduledFor: getDefaultDateTime(),
  notes: ''
});

const label = (value) =>
  String(value || '')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function Housekeeping() {
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);

  const [form, setForm] = useState(getEmptyForm());

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /*
   * Load housekeeping tasks.
   *
   * IMPORTANT:
   * This is separate from rooms so one failed request
   * does not break the complete page.
   */
  const loadTasks = async () => {
    try {
      const data = await api('/housekeeping');

      setTasks(
        Array.isArray(data)
          ? data
          : []
      );

      return true;
    } catch (err) {
      console.error(
        'Housekeeping API error:',
        err
      );

      setError(
        `Housekeeping request failed: ${
          err.message || 'Unknown error'
        }`
      );

      return false;
    }
  };

  /*
   * Load rooms separately.
   */
  const loadRooms = async () => {
    try {
      const data = await api('/rooms');

      setRooms(
        Array.isArray(data)
          ? data
          : []
      );

      return true;
    } catch (err) {
      console.error(
        'Rooms API error:',
        err
      );

      setRooms([]);

      setError(
        `Room request failed: ${
          err.message || 'Unable to load rooms'
        }`
      );

      return false;
    }
  };

  /*
   * Load housekeeping staff separately.
   *
   * If staff endpoint is unavailable,
   * page will still work.
   */
  const loadStaff = async () => {
    try {
      const data = await api('/housekeeping/staff');

      setStaff(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.warn(
        'Housekeeping staff list unavailable:',
        err
      );

      setStaff([]);
    }
  };

  /*
   * Refresh all page data.
   */
  const loadData = async () => {
    setLoading(true);
    setError('');

    await Promise.allSettled([
      loadTasks(),
      loadRooms(),
      loadStaff()
    ]);

    setLoading(false);
  };

  /*
   * Initial page load.
   *
   * We intentionally do not call loadData()
   * directly inside the effect.
   */
  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      setLoading(true);
      setError('');

      const results =
        await Promise.allSettled([
          api('/housekeeping'),
          api('/rooms'),
          api('/housekeeping/staff')
        ]);

      if (cancelled) {
        return;
      }

      const [
        taskResult,
        roomResult,
        staffResult
      ] = results;

      /*
       * HOUSEKEEPING
       */
      if (
        taskResult.status === 'fulfilled'
      ) {
        setTasks(
          Array.isArray(taskResult.value)
            ? taskResult.value
            : []
        );
      } else {
        console.error(
          'Housekeeping API error:',
          taskResult.reason
        );

        setTasks([]);

        setError(
          `Housekeeping request failed: ${
            taskResult.reason?.message ||
            'Unable to load housekeeping tasks'
          }`
        );
      }

      /*
       * ROOMS
       */
      if (
        roomResult.status === 'fulfilled'
      ) {
        setRooms(
          Array.isArray(roomResult.value)
            ? roomResult.value
            : []
        );
      } else {
        console.error(
          'Rooms API error:',
          roomResult.reason
        );

        setRooms([]);

        setError(
          `Room request failed: ${
            roomResult.reason?.message ||
            'Unable to load rooms'
          }`
        );
      }

      /*
       * STAFF
       *
       * Staff failure should NOT break page.
       */
      if (
        staffResult.status === 'fulfilled'
      ) {
        setStaff(
          Array.isArray(staffResult.value)
            ? staffResult.value
            : []
        );
      } else {
        console.warn(
          'Staff API unavailable:',
          staffResult.reason
        );

        setStaff([]);
      }

      setLoading(false);
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Counts
   */
  const counts = useMemo(
    () => ({
      pending: tasks.filter(
        (task) =>
          task.status === 'pending'
      ).length,

      inProgress: tasks.filter(
        (task) =>
          task.status === 'in-progress'
      ).length,

      completed: tasks.filter(
        (task) =>
          task.status === 'completed'
      ).length
    }),
    [tasks]
  );

  /*
   * Open modal
   */
  const openTaskModal = () => {
    setError('');
    setSuccess('');

    setForm(
      getEmptyForm()
    );

    setOpen(true);
  };

  /*
   * Close modal
   */
  const closeTaskModal = () => {
    if (saving) {
      return;
    }

    setOpen(false);
    setError('');

    setForm(
      getEmptyForm()
    );
  };

  /*
   * Update task status
   */
  const updateStatus = async (
    task,
    status
  ) => {
    setError('');
    setSuccess('');

    try {
      await api(
        `/housekeeping/${task._id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status
          })
        }
      );

      setSuccess(
        `Room ${
          task.room?.number || '—'
        } task marked ${label(status)}.`
      );

      /*
       * Refresh only after successful update.
       */
      await loadData();
    } catch (err) {
      console.error(
        'Update housekeeping status error:',
        err
      );

      setError(
        err.message ||
          'Unable to update housekeeping task.'
      );
    }
  };

  /*
   * Create housekeeping task
   */
  const createTask = async (
    event
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    /*
     * Frontend validation
     */
    if (!form.room) {
      setError(
        'Please select a room.'
      );
      return;
    }

    if (!form.scheduledFor) {
      setError(
        'Please select a scheduled date and time.'
      );
      return;
    }

    setSaving(true);

    try {
      await api(
        '/housekeeping',
        {
          method: 'POST',
          body: JSON.stringify({
            room: form.room,
            taskType:
              form.taskType,
            priority:
              form.priority,
            assignedTo:
              form.assignedTo ||
              null,
            scheduledFor:
              form.scheduledFor,
            notes:
              form.notes.trim()
          })
        }
      );

      setOpen(false);

      setForm(
        getEmptyForm()
      );

      setSuccess(
        'Cleaning task scheduled successfully.'
      );

      /*
       * Reload database data
       */
      await loadData();
    } catch (err) {
      console.error(
        'Create housekeeping task error:',
        err
      );

      setError(
        err.message ||
          'Unable to create housekeeping task.'
      );
    } finally {
      setSaving(false);
    }
  };


  const columns = [
    'pending',
    'in-progress',
    'completed'
  ];

  return (
    <>
      <PageHead
        eyebrow="ROOM OPERATIONS"
        title="Housekeeping board"
        description="Coordinate cleaning, turn-downs and room readiness in real time."
        action={openTaskModal}
        actionLabel="Assign task"
      />

      {error && (
        <Notice type="error">
          {error}
        </Notice>
      )}

      {success && (
        <Notice type="success">
          {success}
        </Notice>
      )}

      {/* SUMMARY */}

      <div className="kanban-summary">

        <div>
          <Sparkles />
          <b>
            {counts.pending}
          </b>
          <span>
            Pending
          </span>
        </div>

        <div>
          <Clock3 />
          <b>
            {counts.inProgress}
          </b>
          <span>
            In progress
          </span>
        </div>

        <div>
          <Check />
          <b>
            {counts.completed}
          </b>
          <span>
            Completed
          </span>
        </div>

      </div>

      {/* TASK BOARD */}

      {loading ? (
        <div className="card">
          <p>
            Loading housekeeping tasks...
          </p>
        </div>
      ) : (
        <div className="kanban">

          {columns.map(
            (column) => {

              const columnTasks =
                tasks.filter(
                  (task) =>
                    task.status ===
                    column
                );

              return (
                <div
                  className="kanban-col"
                  key={column}
                >

                  <div className="kanban-head">

                    <b>
                      {label(column)}
                    </b>

                    <span>
                      {
                        columnTasks.length
                      }
                    </span>

                  </div>

                  {columnTasks.map(
                    (task) => (

                      <div
                        className="task-card"
                        key={task._id}
                      >

                        <div className="task-card-top">

                          <span>
                            Room{' '}
                            {
                              task.room
                                ?.number ||
                              '—'
                            }
                          </span>

                          <Status>
                            {
                              label(
                                task.priority
                              )
                            }
                          </Status>

                        </div>

                        <h3>
                          {
                            label(
                              task.taskType
                            )
                          }
                        </h3>

                        <p>

                          Scheduled{' '}

                          {task.scheduledFor
                            ? new Date(
                                task.scheduledFor
                              ).toLocaleString()
                            : '—'}

                          <br />

                          Assigned to{' '}

                          <b>
                            {
                              task
                                .assignedTo
                                ?.name ||
                              'Unassigned'
                            }
                          </b>

                        </p>

                        {task.notes && (
                          <p>
                            {task.notes}
                          </p>
                        )}

                        <div className="task-card-foot">

                          <Status>
                            {
                              label(
                                task.status
                              )
                            }
                          </Status>

                          {column ===
                            'pending' && (

                            <button
                              type="button"
                              className="btn tiny"
                              onClick={() =>
                                updateStatus(
                                  task,
                                  'in-progress'
                                )
                              }
                            >
                              Start
                            </button>

                          )}

                          {column ===
                            'in-progress' && (

                            <button
                              type="button"
                              className="btn tiny"
                              onClick={() =>
                                updateStatus(
                                  task,
                                  'completed'
                                )
                              }
                            >
                              Mark done
                            </button>

                          )}

                        </div>

                      </div>

                    )
                  )}

                  {columnTasks.length ===
                    0 && (

                    <p
                      style={{
                        color:
                          '#87918d',
                        fontSize:
                          11,
                        padding:
                          '10px 4px'
                      }}
                    >
                      No tasks.
                    </p>

                  )}

                </div>
              );
            }
          )}

        </div>
      )}

      {/* ROOM READINESS */}

      <div
        className="card"
        style={{
          marginTop: 18
        }}
      >

        <div className="card-head">

          <div>

            <h3>
              Room readiness
            </h3>

            <span>
              Live room status from the database
            </span>

          </div>

        </div>

        <div className="mini-metrics">

          {[
            'available',
            'occupied',
            'cleaning'
          ].map(
            (status) => (

              <div
                key={status}
              >

                <span>
                  {label(status)}
                </span>

                <b>
                  {
                    rooms.filter(
                      (room) =>
                        room.status ===
                        status
                    ).length
                  }
                </b>

                <small>
                  Rooms
                </small>

              </div>

            )
          )}

        </div>

      </div>

      {/* ASSIGN TASK MODAL */}

      {open && (

        <div
          className="modal-backdrop"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeTaskModal();
            }

          }}
        >

          <div className="modal-card housekeeping-modal" role="dialog" aria-modal="true" aria-labelledby="housekeeping-modal-title">

            <div className="modal-head">

              <div>

                <span
                  style={{
                    display:
                      'block',
                    fontSize:
                      11,
                    letterSpacing:
                      2,
                    color:
                      '#a2824b',
                    marginBottom:
                      5
                  }}
                >
                  ROOM OPERATIONS
                </span>

                <h3 id="housekeeping-modal-title">
                  Assign housekeeping task
                </h3>

              </div>

              <button
                type="button"
                onClick={
                  closeTaskModal
                }
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form
              className="form-grid"
              onSubmit={
                createTask
              }
            >

              {/* ROOM */}

              <label>

                Room

                <select
                  required
                  value={
                    form.room
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      room:
                        event.target
                          .value
                    })
                  }
                >

                  <option value="">
                    Select room
                  </option>

                  {rooms.map(
                    (room) => (

                      <option
                        key={
                          room._id
                        }
                        value={
                          room._id
                        }
                      >
                        Room{' '}
                        {
                          room.number
                        }{' '}
                        ·{' '}
                        {
                          room.type
                        }
                      </option>

                    )
                  )}

                </select>

              </label>

              {/* TASK TYPE */}

              <label>

                Task type

                <select
                  value={
                    form.taskType
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      taskType:
                        event.target
                          .value
                    })
                  }
                >

                  <option value="cleaning">
                    Cleaning
                  </option>

                  <option value="deep-cleaning">
                    Deep cleaning
                  </option>

                  <option value="turn-down">
                    Turn-down
                  </option>

                  <option value="restock">
                    Restock
                  </option>

                  <option value="inspection">
                    Inspection
                  </option>

                  <option value="other">
                    Other
                  </option>

                </select>

              </label>

              {/* PRIORITY */}

              <label>

                Priority

                <select
                  value={
                    form.priority
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      priority:
                        event.target
                          .value
                    })
                  }
                >

                  <option value="low">
                    Low
                  </option>

                  <option value="normal">
                    Normal
                  </option>

                  <option value="high">
                    High
                  </option>

                  <option value="urgent">
                    Urgent
                  </option>

                </select>

              </label>

              {/* DATE */}

              <label>

                Scheduled for

                <input
                  required
                  type="datetime-local"
                  value={
                    form.scheduledFor
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      scheduledFor:
                        event.target
                          .value
                    })
                  }
                />

              </label>

              {/* STAFF */}

              <label>

                Assign to

                <select
                  value={
                    form.assignedTo
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      assignedTo:
                        event.target
                          .value
                    })
                  }
                >

                  <option value="">
                    Unassigned
                  </option>

                  {staff.map(
                    (member) => (

                      <option
                        key={
                          member._id
                        }
                        value={
                          member._id
                        }
                      >
                        {
                          member.name
                        }
                      </option>

                    )
                  )}

                </select>

              </label>

              {/* NOTES */}

              <label className="wide">

                Notes

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      notes:
                        event.target
                          .value
                    })
                  }
                  placeholder="Cleaning instructions or special notes"
                />

              </label>

              {/* BUTTONS */}

              <div className="form-actions">

                <button
                  type="button"
                  className="btn secondary"
                  onClick={
                    closeTaskModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  disabled={
                    saving
                  }
                  className="btn primary"
                  type="submit"
                >

                  <Plus size={16} />

                  {saving
                    ? 'Saving...'
                    : 'Schedule task'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>
  );
}