# Paytalk STK Netlify Demo

This is a minimal Paytalk Lipa na M-Pesa checkout that runs fully on Netlify:

- Static frontend: `public/pay.html`
- Serverless endpoint: `netlify/functions/pay.js`
- Routing: `netlify.toml` maps `/api/pay` to the function

## Local quick start (Node server)
```bash
npm install
npm run dev
# open http://localhost:3000/pay
```

## Netlify deploy
No build step required.

1. Push this folder to a GitHub repo.
2. In Netlify, create a new site from that repo.
3. Configure:
   - Build command: (leave empty)
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Environment variables (optional; they override hardcoded defaults used for testing):
   - `PAYTALK_API_USER`
   - `PAYTALK_TRANS_KEY`
   - `PAYTALK_TILL`
5. Deploy.

Open: `https://<your-site>.netlify.app/pay`

## API
`POST /api/pay`
```json
{
  "phone": "07XXXXXXXX | 2547XXXXXXXX",
  "amount": 100
}
```
Returns gateway status and raw response.

## Notes
- Phone normalization converts to `2547XXXXXXXX`.
- `mpesa_code` is omitted for STK initiation (per common practice). If Paytalk requires it, we can adjust.
- For production, set the env vars in Netlify and remove hardcoded defaults.
