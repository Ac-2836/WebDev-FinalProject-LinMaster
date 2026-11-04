import {Router} from 'express';

export const healthRouter = Router();

// Used by Render health checks and UptimeRobot (PLAN part E).
healthRouter.get('/health', (_req, res) => {
  res.json({status: 'ok'});
});
