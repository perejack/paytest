require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Serve checkout page
app.get(['/','/pay'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

// Normalize KE phone numbers to 2547XXXXXXXX
function normalizeMsisdn(input) {
  if (!input) return null;
  let msisdn = String(input).replace(/\D/g, '');
  if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
  if (msisdn.startsWith('7')) msisdn = '254' + msisdn;
  if (msisdn.startsWith('254') && msisdn.length === 12) return msisdn;
  return null;
}

// Create a simple order id
const makeOrderId = () => 'ORD-' + Date.now();

// Initiate STK via Paytalk
app.post('/api/pay', async (req, res) => {
  try {
    const { phone, amount } = req.body || {};
    // Use hardcoded defaults for testing; still overridable by environment variables
    const api_user = process.env.PAYTALK_API_USER || '5583caeb55';
    const trans_key = process.env.PAYTALK_TRANS_KEY || '2a12f976680cc2c8a1164b33671058d0';
    const paytill = process.env.PAYTALK_TILL || '6290483'; // optional per docs, but we keep it

    if (!api_user || !trans_key) {
      return res.status(500).json({ ok: false, error: 'Server missing PAYTALK credentials. Set PAYTALK_API_USER and PAYTALK_TRANS_KEY in .env.' });
    }

    const msisdn = normalizeMsisdn(phone);
    const amt = Number(amount);
    if (!msisdn) return res.status(400).json({ ok: false, error: 'Invalid phone. Use formats like 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX' });
    if (!amt || amt < 1) return res.status(400).json({ ok: false, error: 'Invalid amount. Must be >= 1' });

    const order_id = makeOrderId();

    // Per Paytalk docs: POST to https://developer.paytalk.co.ke/apis/ with query params
    const url = new URL('https://developer.paytalk.co.ke/apis/');
    url.searchParams.set('api_user', api_user);
    url.searchParams.set('trans_key', trans_key);
    url.searchParams.set('x_amount', String(amt));
    url.searchParams.set('mpesa_phone', msisdn);
    // mpesa_code is a Transaction ID (not available before STK). Omit for STK initiation.
    url.searchParams.set('order_id', order_id);
    if (paytill) url.searchParams.set('paytill', paytill);

    const headers = { 'Content-Type': 'application/json' };

    const response = await axios.post(url.toString(), {}, { headers, timeout: 30000 });

    // API may return plain text like "Success" or codes; normalize
    const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    let status = 'unknown';
    if (raw) {
      if (/success/i.test(raw)) status = 'success';
      else if (/no_account/i.test(raw)) status = 'no_account';
      else if (/no_trans/i.test(raw)) status = 'no_trans';
      else if (/null/i.test(raw)) status = 'null';
    }

    return res.json({ ok: true, status, gatewayResponse: raw, order_id });
  } catch (err) {
    const msg = err.response?.data || err.message || 'Gateway error';
    return res.status(500).json({ ok: false, error: String(msg) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
