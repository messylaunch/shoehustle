// Generates the key pair push notifications need. Run once, paste the output
// into .env, restart. The private key never leaves your server.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Paste these two lines into your .env file, then restart the app:

NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"
VAPID_PRIVATE_KEY="${privateKey}"

Keep the private key private — anyone holding it can send notifications to
everyone who installed your app. If you ever change these, every shopper has
to turn notifications on again, so generate them once and leave them alone.
`);
