const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3000;

app.get('/scan', async (req, res) => {
  const targetUrl = req.query.url;
  const filename = req.query.filename || 'playlist'; // שם ברירת מחדל

  if (!targetUrl) return res.status(400).send('❌ Missing url param');

  try {
    const result = await scanForM3U8(targetUrl, filename);
    res.send(result);
  } catch (err) {
    res.status(500).send('❌ Error: ' + err.message);
  }
});

async function scanForM3U8(targetUrl, filename) {
  return new Promise(async (resolve, reject) => {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    let done = false;

    page.on('request', request => {
      const url = request.url();

      console.log('📡', url);

      if (url.includes('.m3u8') && !done) {
        done = true;
        console.log('🎯 Found m3u8:', url);
        handleM3U8(url, filename)
          .then(() => {
            browser.close();
            resolve(`✅ ${filename}.m3u8 saved successfully`);
          })
          .catch(err => {
            browser.close();
            reject(err);
          });
      }
    });

    console.log('🌐 Going to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // אם לא נמצא תוך 15 שניות
    setTimeout(() => {
      if (!done) {
        browser.close();
        reject(new Error('m3u8 not found in time'));
      }
    }, 15000);
  });
}

async function handleM3U8(url, filename) {
  const res = await axios.get(url);
  const baseUrl = url.split('?')[0];
  const root = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

  const lines = res.data.split('\n');
  const rewritten = lines.map(line => {
    if (line.trim().endsWith('.ts')) {
      const full = root + line.trim();
      console.log('🔗 TS:', full);
      return full;
    }
    return line;
  }).join('\n');

  const filepath = path.join(__dirname, `${filename}.m3u8`);
  fs.writeFileSync(filepath, rewritten, 'utf8');
  console.log(`✅ Saved ${filename}.m3u8`);
}

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

//http://localhost:3000/scan?url=https://dabac.link/flash4&filename=my_video_playlist
