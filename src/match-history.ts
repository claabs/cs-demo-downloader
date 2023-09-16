// https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1?key=XXX&steamid=765XXX&steamidkey=AAAA-AAAAA-AAAA&knowncode=CSGO-ZT42K-Jxxxx-Kxxxx-5xxxx-Oixxx
import axios from 'axios';
import { config } from './config.js';

export interface MatchHistoryResponse {
  result: {
    nextcode: string;
  };
}

const apiKey = config.steamApiKey;

export const getNextMatchCode = async (
  steamId: string,
  authCode: string,
  lastShareCode: string,
): Promise<string> => {
  const resp = await axios.get<MatchHistoryResponse>(
    'https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1',
    {
      params: {
        key: apiKey,
        steamid: steamId,
        steamidkey: authCode,
        knowncode: lastShareCode,
      },
    },
  );
  return resp.data.result.nextcode;
};
