import axios from 'axios';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Config } from '.';
import { loginSteam } from './steam';

export interface GcpdMatch {
  date: Date;
  url: string;
}

const parseCsgoMatchList = (html: string, earliestDateBound?: Date): GcpdMatch[] => {
  const dom = new JSDOM(html).window;
  // inspired by https://github.com/leetify/leetify-gcpd-upload/blob/main/src/offscreen/dom-parser.ts
  const cells = dom.document.querySelectorAll('td.val_left');

  const matches: GcpdMatch[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const matchCell of cells) {
    const urlElement = matchCell.querySelector(
      'table.csgo_scoreboard_inner_left tbody tr td a',
    ) as HTMLLinkElement;
    if (!urlElement) break; // when a match does not have a download url, all later matches will most likely not have one either

    const url = urlElement.getAttribute('href');
    if (!url?.match(/^https?:\/\/replay\d+\.valve\.net\/730\/\d+_\d+\.dem\.bz2$/)) break; // something is weird if this happens

    const dateElement = matchCell.querySelector(
      'table.csgo_scoreboard_inner_left tbody tr:nth-child(2) td',
    ) as HTMLTableCellElement;
    const dateText = dateElement?.innerHTML?.trim();
    if (!dateText?.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} GMT$/)) break; // something is weird if this happens
    const date = new Date(dateText);
    // if this match is older or as old as the latest match we've found previously, we don't need to upload it (or any following matches)
    if (earliestDateBound && date <= earliestDateBound) break;

    matches.push({ date, url });
  }
  return matches;
};

// eslint-disable-next-line import/prefer-default-export
export const getDemos = async () => {
  const config = JSON.parse(fs.readFileSync('config/config.json', 'utf-8')) as Config;
  const userLogin = config.users[0];
  if (!userLogin) throw new Error('No user found');

  const cookies = await loginSteam(userLogin);

  const gameId = 730;
  const initResp = await axios.get<string>(`https://steamcommunity.com/my/gcpd/${gameId}`, {
    params: {
      tab: 'matchhistorypremier',
    },
    responseType: 'document',
    headers: {
      Cookie: cookies,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
  });

  const parsedMatches = parseCsgoMatchList(initResp.data);
  console.log(parsedMatches);

  const continueTokenMatch = initResp.data.match(/g_sGcContinueToken = '([0-9]+)'/g);
  if (!continueTokenMatch) throw new Error('Could not get document continue token');
  const continueToken = continueTokenMatch.at(0);
  if (!continueToken) throw new Error('Could not get document continue token match group');

  const sessionIdMatch = initResp.data.match(/g_sessionID = "([0-9a-f]{24})"/g);
  if (!sessionIdMatch) throw new Error('Could not get document session ID');
  const sessionId = sessionIdMatch.at(0);
  if (!sessionId) throw new Error('Could not get document session ID match group');

  const continueResp = await axios.get<string>(`https://steamcommunity.com/my/gcpd/${gameId}`, {
    params: {
      tab: 'matchhistorypremier',
      continue_token: continueToken,
      sessionid: sessionId,
    },
    responseType: 'document',
    headers: {
      Cookie: cookies,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
  });

  const parsedMatches2 = parseCsgoMatchList(continueResp.data);
  console.log(parsedMatches2);
};
