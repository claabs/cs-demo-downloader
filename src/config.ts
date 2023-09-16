import fs from 'node:fs';

export interface Config {
  authCodes: AuthCodeUser[];
  users: User[];
  steamApiKey: string;
}

export interface AuthCodeUser {
  authCode: string;
  steamId64: string;
  oldestShareCode: string;
}

export interface User {
  username: string;
  password: string;
  secret: string;
}

export const config = JSON.parse(fs.readFileSync('config/config.json', 'utf-8')) as Config;
