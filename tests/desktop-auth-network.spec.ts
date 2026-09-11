import {test, expect} from '@playwright/test';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {OAuth2Client} from 'google-auth-library';
import {googleFetch} from '../desktop/auth-network.mjs';

// Keep the real SDK, fetch adapter and bounded HTTPS transport in this path.
// Only replace the final socket; no user credentials or Google calls are used.
test('Google token exchange preserves Fetch form encoding at the actual HTTPS boundary', async () => {
  const original = https.request;
  const requests: {headers: Record<string,string>; body: string; path: string}[] = [];
  https.request = ((url: URL, options: any, receive: any) => {
    const call = new EventEmitter() as any;
    call.destroy = () => {};
    call.end = (body: string) => {
      requests.push({headers: options.headers, body, path: url.pathname});
      const response = new EventEmitter() as any;
      response.statusCode = 200; response.headers = {'content-type':'application/json'};
      queueMicrotask(() => {
        receive(response);
        response.emit('data', Buffer.from(JSON.stringify({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,token_type:'Bearer'})));
        response.emit('end');
      });
    };
    return call;
  }) as any;
  try {
    const client = new OAuth2Client({clientId:'123-fixture.apps.googleusercontent.com',clientSecret:'synthetic-secret',transporterOptions:{fetchImplementation:googleFetch(new AbortController().signal),retry:false}});
    const result = await client.getToken({code:'synthetic-code',codeVerifier:'synthetic-verifier',redirect_uri:'http://127.0.0.1:45000/'});
    expect(result.tokens.access_token).toBe('synthetic-access');
    expect(requests).toHaveLength(1);
    expect(requests[0].headers['content-type']).toBe('application/x-www-form-urlencoded;charset=UTF-8');
    expect(requests[0].path).toBe('/token');
    const form = new URLSearchParams(requests[0].body);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code_verifier')).toBe('synthetic-verifier');
    expect(form.get('redirect_uri')).toBe('http://127.0.0.1:45000/');
    const fetch = googleFetch(new AbortController().signal);
    await fetch('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token'})});
    expect(requests[1].headers['content-type']).toBe('application/x-www-form-urlencoded');
    const sent = requests.length;
    await expect(fetch('https://untrusted.invalid/token', {method:'POST',body:new URLSearchParams({code:'synthetic'})})).rejects.toHaveProperty('code','validation');
    expect(requests).toHaveLength(sent);
  } finally { https.request = original; }
});
