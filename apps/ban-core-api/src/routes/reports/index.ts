import express from 'express';

import exportReportRoutes from './exports.js';

const app = express.Router();

app.use('/', exportReportRoutes);

export default app;
