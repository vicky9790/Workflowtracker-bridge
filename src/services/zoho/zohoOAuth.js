const axios = require('axios');
const { env } = require('../../config/env');
const { badGateway } = require('../../utils/errors');

const SCOPE = [
  'ZohoCreator.form.CREATE',
  'ZohoCreator.report.READ',
  'ZohoCreator.report.UPDATE',
  'ZohoCreator.bulk.CREATE',
  'ZohoCreator.bulk.READ',
  'ZohoCreator.customapi.EXECUTE',
].join(',');

function accountsBase(dc) {
  return `https://accounts.zoho.${dc || env.ZOHO_DEFAULT_DC}`;
}

/**
 * `state` carries the organizationId through Zoho's redirect so the
 * callback knows which organization's connection to update - Zoho just
 * echoes it back unchanged, it never sees or needs to understand it.
 */
function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    scope: SCOPE,
    client_id: env.ZOHO_CLIENT_ID,
    response_type: 'code',
    access_type: 'offline', // required to receive a refresh_token
    redirect_uri: env.ZOHO_REDIRECT_URI,
    prompt: 'consent',
    state,
  });
  return `${accountsBase()}/oauth/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  try {
    const res = await axios.post(
      `${accountsBase()}/oauth/v2/token`,
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: env.ZOHO_CLIENT_ID,
          client_secret: env.ZOHO_CLIENT_SECRET,
          redirect_uri: env.ZOHO_REDIRECT_URI,
          code,
        },
        timeout: 15_000,
      }
    );
    if (res.data.error) throw new Error(res.data.error);
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresInSeconds: res.data.expires_in,
    };
  } catch (err) {
    throw badGateway(`Zoho OAuth code exchange failed: ${err.message}`);
  }
}

async function refreshAccessToken(refreshToken, dc) {
  try {
    const res = await axios.post(
      `${accountsBase(dc)}/oauth/v2/token`,
      null,
      {
        params: {
          grant_type: 'refresh_token',
          client_id: env.ZOHO_CLIENT_ID,
          client_secret: env.ZOHO_CLIENT_SECRET,
          refresh_token: refreshToken,
        },
        timeout: 15_000,
      }
    );
    if (res.data.error) throw new Error(res.data.error);
    return {
      accessToken: res.data.access_token,
      expiresInSeconds: res.data.expires_in,
    };
  } catch (err) {
    throw badGateway(`Zoho access token refresh failed: ${err.message}`);
  }
}

module.exports = { getAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken };
