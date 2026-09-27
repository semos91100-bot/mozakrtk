const backend = require('./backend');

module.exports = async function oauthCallback(req, res) {
  req.query = { ...(req.query || {}), action: 'oauth_callback' };
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8');
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(raw));
    } else {
      try { req.body = JSON.parse(raw); } catch { req.body = {}; }
    }
  } else if (typeof req.body === 'string') {
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(req.body));
    } else {
      try { req.body = JSON.parse(req.body); } catch { req.body = {}; }
    }
  }
  return backend(req, res);
};
