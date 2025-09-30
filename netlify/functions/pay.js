const axios = require('axios');

// Normalize KE phone numbers to 2547XXXXXXXX
function normalizeMsisdn(input) {
  if (!input) return null;
  let msisdn = String(input).replace(/\D/g, '');
  if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
  if (msisdn.startsWith('7')) msisdn = '254' + msisdn;
  if (msisdn.startsWith('254') && msisdn.length === 12) return msisdn;
  return null;
}

const makeOrderId = () => 'ORD-' + Date.now();

exports.handler = async (event) => {
  // CORS headers for all responses
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { phone, amount } = body;

    // Defaults for testing; can override using Netlify environment variables
    const api_user = process.env.PAYTALK_API_USER || '5583caeb55';
    const trans_key = process.env.PAYTALK_TRANS_KEY || '2a12f976680cc2c8a1164b33671058d0';
    const paytill = process.env.PAYTALK_TILL || '6290483';

    if (!api_user || !trans_key) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Missing PAYTALK credentials' }) };
    }

    const msisdn = normalizeMsisdn(phone);
    const amt = Number(amount);
    if (!msisdn) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid phone' }) };
    if (!amt || amt < 1) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid amount' }) };

    const order_id = makeOrderId();

    const url = new URL('https://developer.paytalk.co.ke/api/');
    url.searchParams.set('api_user', api_user);
    url.searchParams.set('trans_key', trans_key);
    url.searchParams.set('x_amount', String(amt));
    url.searchParams.set('mpesa_phone', msisdn);
    // omit mpesa_code for STK initiation
    url.searchParams.set('order_id', order_id);
    if (paytill) url.searchParams.set('paytill', paytill);

    const response = await axios.post(url.toString(), {}, { 
      headers: { 'Content-Type': 'application/json' }, 
      timeout: 30000,
      validateStatus: () => true // Accept any status code
    });
    const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    let status = 'unknown';
    if (raw) {
      if (/success/i.test(raw)) status = 'success';
      else if (/no_account/i.test(raw)) status = 'no_account';
      else if (/no_trans/i.test(raw)) status = 'no_trans';
      else if (/null/i.test(raw)) status = 'null';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, status, gatewayResponse: raw, order_id })
    };
  } catch (err) {
    console.error('Function error:', err);
    const msg = err.response?.data || err.message || 'Gateway error';
    const stack = err.stack || '';
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ 
        ok: false, 
        error: String(msg),
        details: stack.substring(0, 200) // First 200 chars of stack for debugging
      }) 
    };
  }
};
