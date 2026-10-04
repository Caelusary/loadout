import { ActivityLog } from '../../models/index.js';
import { ACTIVITY_TARGETS } from '../../models/ActivityLog.js';
import { pageParams, paginate } from '../../lib/request.js';
import { undoEntry } from './service.js';

// Every admin can read the log, newest first; `kind` narrows it to one kind of target.
export async function listActivity(req, res) {
  const filter = {};
  if (ACTIVITY_TARGETS.includes(req.query.kind)) filter['target.kind'] = req.query.kind;
  res.json(await paginate(ActivityLog, filter, pageParams(req.query), (q) => q.sort({ createdAt: -1, _id: -1 })));
}

export async function undoActivity(req, res) {
  res.json({ entry: await undoEntry(req.params.id, req.user) });
}
