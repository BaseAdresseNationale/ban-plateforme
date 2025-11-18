import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { NODE_ENV } = process.env;
const isDevMode = () => NODE_ENV !== 'production';

const transport = isDevMode()
  ? new winston.transports.Console()
  : new DailyRotateFile({
      dirname: 'logs',
      filename: 'id-fix-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    });

transport.on('error', (error: any) => {
  console.error('Logger transport error:', error);
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(
      (info: any) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [transport],
});
