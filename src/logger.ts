import pino from 'pino';
import { config } from './config';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: `SYS:standard`,
    },
  },
  redact: ['config.users[*].password', 'config.users[*].secret'],
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  level: config.logLevel,
  base: undefined,
});

export default logger;
