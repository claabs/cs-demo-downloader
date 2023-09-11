import { getAllGcpdDemos } from './gcpd';

export interface Config {
  authCodes: string[];
  users: User[];
}

export interface User {
  username: string;
  password: string;
  secret: string;
}

getAllGcpdDemos().catch((err) => {
  console.error(err);
});
