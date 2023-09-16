/* eslint-disable import/prefer-default-export */
import { LoginSession, EAuthTokenPlatformType } from 'steam-session';
import SteamTotp from 'steam-totp';

import { getStoreValue, setStoreValue } from './store.js';
import type { User } from './config.js';
import logger from './logger.js';

export const loginSteam = async (user: User): Promise<string[]> => {
  const L = logger.child({ username: user.username });
  L.debug('Logging user into steam');
  const session = new LoginSession(EAuthTokenPlatformType.WebBrowser);
  const refreshToken = await getStoreValue('refreshToken', user.username);

  if (refreshToken) {
    L.trace('Logging into Steam with refresh token');
    try {
      session.refreshToken = refreshToken;
      // session.renewRefreshToken() // This probably won't work, so we'll just let the refresh token expire
    } catch (err) {
      L.error({ err }, 'Error setting refresh token');
    }
  } else {
    L.trace('Getting Steam Guard auth code');
    const authCode = SteamTotp.getAuthCode(user.secret);

    const waitForAuthentication = new Promise<void>((resolve) => {
      session.once('authenticated', () => {
        resolve();
      });
    });

    L.debug('Logging into Steam with password');
    await session.startWithCredentials({
      accountName: user.username,
      password: user.password,
      steamGuardCode: authCode,
    });
    await waitForAuthentication;
  }
  const cookies = await session.getWebCookies();
  L.debug('Steam login successful');
  await setStoreValue('refreshToken', user.username, session.refreshToken);
  return cookies;
};
