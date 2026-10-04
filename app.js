const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory store for sessions
const sessions = {}; // { id: { state, items: [{name,price}], total, paymentToken, tokenExpiry, verificationToken, createdAt } }

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

function nowTs() {
  return Date.now();
}

// Create a new session
app.post('/sessions', (req, res) => {
  const id = genId();
  sessions[id] = {
    id,
    state: 'browsing',
    items: [],
    total: 0,
    createdAt: nowTs()
  };
  res.status(201).json({ sessionId: id, state: 'browsing' });
});

// Add item to session
app.post('/sessions/:id/items', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (!['browsing', 'items_added'].includes(s.state)) {
    return res.status(409).json({ error: 'invalid_state_for_adding_items', state: s.state });
  }
  const { name, price } = req.body || {};
  if (!name || typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'invalid_item' });
  }
  s.items.push({ name, price });
  s.total = s.items.reduce((a, b) => a + b.price, 0);
  s.state = 'items_added';
  res.status(200).json({ sessionId: id, state: s.state, total: s.total, items: s.items });
});

// Initiate checkout
app.post('/sessions/:id/checkout', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.state !== 'items_added') {
    return res.status(409).json({ error: 'invalid_state_for_checkout', state: s.state });
  }

  // Non-linear behavior based on total
  if (s.total > 200) {
    // manual review path
    s.state = 'manual_review';
    s.verificationToken = genId();
    return res.status(200).json({
      action: 'manual_review_required',
      state: s.state,
      verificationToken: s.verificationToken,
      message: 'Order flagged for manual review due to high total'
    });
  }

  if (s.total > 100) {
    // additional verification path
    s.state = 'verification_required';
    s.verificationToken = genId();
    return res.status(200).json({
      action: 'additional_verification',
      state: s.state,
      verificationToken: s.verificationToken,
      message: 'Verification required for orders above 100'
    });
  }

  // Normal checkout: generate payment token that expires
  s.paymentToken = 'pay_' + genId();
  s.tokenExpiry = nowTs() + 30 * 1000; // 30 seconds validity
  s.state = 'checkout_pending';
  res.status(200).json({ paymentToken: s.paymentToken, state: s.state, expiresInSec: 30 });
});

// Pay endpoint
app.post('/sessions/:id/pay', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  const { paymentToken, verificationCode } = req.body || {};

  // If manual review required, explicit reject unless admin approves (simulate require special code)
  if (s.state === 'manual_review') {
    if (verificationCode === 'APPROVE_MANUAL') {
      s.state = 'checkout_pending';
      s.paymentToken = 'pay_' + genId();
      s.tokenExpiry = nowTs() + 30 * 1000;
      return res.status(200).json({ message: 'manual_review_approved', paymentToken: s.paymentToken });
    }
    return res.status(423).json({ error: 'manual_review_locked', message: 'Order locked for manual review' });
  }

  if (s.state === 'verification_required') {
    if (!verificationCode || verificationCode.length < 4) {
      return res.status(400).json({ error: 'verification_failed', message: 'valid verificationCode required' });
    }
    // on correct verificationCode accept and proceed to payment generation
    // simulate: any 4+ length code accepted
    s.state = 'checkout_pending';
    s.paymentToken = 'pay_' + genId();
    s.tokenExpiry = nowTs() + 30 * 1000;
    return res.status(200).json({ message: 'verification_ok', paymentToken: s.paymentToken, state: s.state });
  }

  if (s.state !== 'checkout_pending') {
    return res.status(409).json({ error: 'invalid_state_for_pay', state: s.state });
  }

  if (!paymentToken || paymentToken !== s.paymentToken) {
    return res.status(400).json({ error: 'invalid_payment_token' });
  }

  if (nowTs() > s.tokenExpiry) {
    s.state = 'expired';
    return res.status(410).json({ error: 'payment_token_expired', state: s.state });
  }

  // Non-linear behavior: if total is odd -> simulate 3DS flow (extra redirect)
  if (Math.floor(s.total) % 2 === 1) {
    s.state = '3ds_required';
    s.threeDSToken = genId();
    return res.status(200).json({ action: '3ds_required', threeDSToken: s.threeDSToken, state: s.state });
  }

  // success
  s.state = 'paid';
  s.paidAt = nowTs();
  return res.status(200).json({ message: 'payment_success', state: s.state });
});

// Confirm 3DS
app.post('/sessions/:id/3ds/confirm', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  if (s.state !== '3ds_required') return res.status(409).json({ error: 'invalid_state_for_3ds', state: s.state });
  const { threeDSToken, result } = req.body || {};
  if (!threeDSToken || threeDSToken !== s.threeDSToken) return res.status(400).json({ error: 'invalid_3ds_token' });
  if (result === 'success') {
    s.state = 'paid';
    s.paidAt = nowTs();
    return res.status(200).json({ message: 'payment_success_after_3ds', state: s.state });
  }
  s.state = 'payment_failed';
  return res.status(402).json({ error: '3ds_failed', state: s.state });
});

// Expire session/token (simulate failure)
app.post('/sessions/:id/expire', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  s.state = 'expired';
  s.paymentToken = null;
  s.tokenExpiry = null;
  res.status(200).json({ message: 'session_expired', state: s.state });
});

// Get session status
app.get('/sessions/:id/status', (req, res) => {
  const id = req.params.id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'session_not_found' });
  const now = nowTs();
  const tokenValid = s.tokenExpiry && now < s.tokenExpiry;
  res.status(200).json({ id: s.id, state: s.state, items: s.items, total: s.total, tokenValid });
});

// List sessions (for debugging/admin)
app.get('/sessions', (req, res) => {
  res.status(200).json(Object.values(sessions).map(s => ({ id: s.id, state: s.state, total: s.total })));
});

const port = 3000;
app.listen(port, () => console.log(`API server running on port ${port}`));
