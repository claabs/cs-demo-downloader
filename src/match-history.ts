// https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1?key=XXX&steamid=765XXX&steamidkey=AAAA-AAAAA-AAAA&knowncode=CSGO-ZT42K-Jxxxx-Kxxxx-5xxxx-Oixxx
import axios from 'axios';
import PQueue from 'p-queue';
import { config } from './config.js';
import L from './logger.js';

export interface MatchHistoryResponse {
  result: {
    nextcode: string;
  };
}

const getNextMatchCode = async (
  steamId: string,
  authCode: string,
  lastShareCode: string,
  shareCodeQueue: PQueue,
): Promise<string> => {
  if (!config.steamApiKey) throw new Error('Need Steam API key to fetch match history');

  const resp = await shareCodeQueue.add(
    async () => {
      L.trace({ lastShareCode }, 'Fetching next share code');
      return axios.get<MatchHistoryResponse>(
        'https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1',
        {
          params: {
            key: config.steamApiKey,
            steamid: steamId,
            steamidkey: authCode,
            knowncode: lastShareCode,
          },
        },
      );
    },
    { throwOnTimeout: true },
  );
  return resp.data.result.nextcode;
};

export const getAllNewMatchCodes = async (
  steamId: string,
  authCode: string,
  inLastShareCode: string,
  shareCodeQueue: PQueue,
): Promise<string[]> => {
  const shareCodes: string[] = [];
  let lastShareCode = await getNextMatchCode(steamId, authCode, inLastShareCode, shareCodeQueue);

  while (lastShareCode && lastShareCode !== 'n/a') {
    shareCodes.push(lastShareCode);
    // eslint-disable-next-line no-await-in-loop
    lastShareCode = await getNextMatchCode(steamId, authCode, lastShareCode, shareCodeQueue);
  }
  return shareCodes;
};
