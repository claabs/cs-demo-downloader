import { downloadSaveGcpdDemos } from './download';
import { getNewGcpdMatches } from './gcpd';

export interface Config {
  authCodes: string[];
  users: User[];
}

export interface User {
  username: string;
  password: string;
  secret: string;
}

const main = async () => {
  const matches = await getNewGcpdMatches();
  await downloadSaveGcpdDemos(matches);
};

main().catch((err) => {
  console.error(err);
});
