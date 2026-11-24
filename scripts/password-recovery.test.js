import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { invalidRecoveryLink, recoveryOrigin, sendRecoveryEmail, updateRecoveredPassword } from '../lib/password-recovery.js';

const origin = 'https://words.example.test';
const form = values => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

test('recovery callback uses the configured host in production and accepts loopback in development', () => {
  assert.equal(recoveryOrigin({ SITE_URL: origin }, 'https://other.example'), origin);
  assert.equal(recoveryOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'words.example.test' }), origin);
  assert.equal(recoveryOrigin({}, 'http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.throws(() => recoveryOrigin({ NODE_ENV: 'production' }, 'https://other.example'));
});

test('requests validate email, give unknown accounts the same response, and report delivery failures', async () => {
  const input = form({email: ' learner@example.test '});
  const fake = error => ({ resetPasswordForEmail: async () => ({ error }) });
  const sent = await sendRecoveryEmail(fake(null), input, origin);
  assert.deepEqual(sent, { sent: true, email: 'learner@example.test' });
  assert.deepEqual(await sendRecoveryEmail(fake({code:'user_not_found'}), input, origin), sent);
  assert.match((await sendRecoveryEmail({}, form({ email: 'invalid' }), origin)).error, /valid email/);
  assert.match((await sendRecoveryEmail(fake({status:429}), input, origin)).error, /Too many/);
  assert.match((await sendRecoveryEmail(fake({status:500}), input, origin)).error, /try again/i);
});

test('password changes require matching input and a verified recovery session', async () => {
  const data = form({password:'long enough', confirmation:'long enough'});
  assert.match((await updateRecoveredPassword({}, form({password:'short'}))).error, /8 characters/);
  assert.match((await updateRecoveredPassword({}, form({password:'long enough'}))).error, /do not match/);
  assert.deepEqual(await updateRecoveredPassword({getUser: async () => ({data:{user:null}, error:null})}, data), {error:invalidRecoveryLink});
  const auth = {getUser: async () => ({data:{user:{id:'learner'}}}), updateUser: async () => ({error:{code:'same_password'}})};
  assert.match((await updateRecoveredPassword(auth, data)).error, /different/);
});

test('Supabase SSR carries the recovery verifier between requests and updates only the recovered account', async () => {
  // Exercise the installed SDK and cookie adapter across fresh server clients.
  // Only the email service and Auth HTTP endpoints are simulated.
  const jar = new Map();
  const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'learner@example.test', aud: 'authenticated', app_metadata: {}, user_metadata: {} };
  let redirect, challenge, used = false, updated;
  const token = ['header', Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'signature'].join('.');
  const transport = async (url, options) => {
    const request = new Request(url, options);
    const path = new URL(request.url);
    const body = request.method === 'GET' ? null : await request.json();
    if (path.pathname.endsWith('/recover')) {
      challenge = body.code_challenge;
      assert.equal(body.email, user.email);
      redirect = new URL(path.searchParams.get('redirect_to'));
      return Response.json({});
    }
    if (path.pathname.endsWith('/token')) {
      assert.equal(path.searchParams.get('grant_type'), 'pkce');
      assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
      assert.equal(body.auth_code, 'one-use-code');
      if (used) return Response.json({message:'Code expired'}, {status:400});
      used = true;
      return Response.json({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});
    }
    assert.ok(path.pathname.endsWith('/user'));
    assert.equal(request.headers.get('authorization'), 'Bearer '+token);
    if (request.method === 'PUT') updated = body.password;
    return Response.json(user);
  };
  const client = (name = 'repeti-recovery', cookies = jar) => createServerClient('https://project.example.test', 'sb_publishable_fixture', {
    global:{ fetch:transport }, cookieOptions:{name, path:'/auth', httpOnly:true},
    cookies:{
      getAll:() => Array.from(cookies, ([name,value]) => ({name,value})),
      setAll:values => { for (const {name,value} of values) value ? cookies.set(name,value) : cookies.delete(name); },
    },
  }).auth;
  assert.ok((await sendRecoveryEmail(client(), form({email:user.email}), origin)).sent);
  assert.equal(redirect.origin, origin);
  assert.equal(redirect.pathname, '/auth/callback');
  assert.equal(redirect.searchParams.get('recovery'), '1');
  const flowId = redirect.searchParams.get('sb_flow_id');
  const exchange = auth => auth.exchangeCodeForSession('one-use-code', flowId ? { flowId } : undefined);
  assert.ok((await exchange(client('repeti-recovery', new Map()))).error);
  const verified = await exchange(client());
  assert.equal(verified.error, null);
  assert.equal(verified.data.redirectType, 'recovery');
  assert.equal((await client('ordinary-session').getUser()).data.user, null);
  assert.deepEqual(await updateRecoveredPassword(client(), form({password:'new test password',confirmation:'new test password'})), {updated:true});
  assert.equal(updated, 'new test password');
  assert.ok((await exchange(client())).error);
});
