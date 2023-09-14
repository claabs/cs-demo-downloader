import PQueue from 'p-queue';
import fs from 'node:fs';
import { downloadSaveGcpdDemos } from './download';
import { getMatches } from './gcpd';

export interface Config {
  authCodes: string[];
  users: User[];
}

export interface User {
  username: string;
  password: string;
  secret: string;
}

const handleGcpdUser = async (user: User, gcpdQueue: PQueue, downloadQueue: PQueue) => {
  const matches = await gcpdQueue.add(() => getMatches(user), { throwOnTimeout: true });
  await downloadQueue.add(() => downloadSaveGcpdDemos(matches), { throwOnTimeout: true });
};

const main = async () => {
  const config = JSON.parse(fs.readFileSync('config/config.json', 'utf-8')) as Config;
  const gcpdQueue = new PQueue({ concurrency: 1, throwOnTimeout: true });
  const downloadQueue = new PQueue({ concurrency: 5, throwOnTimeout: true });

  return Promise.all(config.users.map((user) => handleGcpdUser(user, gcpdQueue, downloadQueue)));
};

main().catch((err) => {
  console.error(err);
});
