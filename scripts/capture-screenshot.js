import fs from 'node:fs';
import path from 'node:path';

async function capture() {
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page' && p.url.includes('3000')) || pages.find((p) => p.type === 'page');

  if (!page) {
    throw new Error('No browser page found on port 9222');
  }

  console.log(`Connecting to page ${page.id} (${page.title})...`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  };

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++msgId;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  console.log('Navigating to http://127.0.0.1:3000/?tab=scale-test ...');
  await sendCommand('Page.enable');
  await sendCommand('Page.navigate', { url: 'http://127.0.0.1:3000/?tab=scale-test' });

  // Wait 3 seconds for DOM to render and fetch scale test results
  console.log('Waiting 3.5s for dashboard rendering...');
  await new Promise((r) => setTimeout(r, 3500));

  console.log('Capturing screenshot...');
  const res = await sendCommand('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });

  if (res.error) {
    throw new Error(`CDP Screenshot Error: ${JSON.stringify(res.error)}`);
  }

  const base64Data = res.result.data;
  const buffer = Buffer.from(base64Data, 'base64');
  const targetPath = path.resolve('artifacts/scale-test/VERDICT_500_REGION_SCALE_TEST.png');
  fs.writeFileSync(targetPath, buffer);

  console.log(`SUCCESS! Screenshot saved to ${targetPath} (${buffer.length} bytes).`);
  ws.close();
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
