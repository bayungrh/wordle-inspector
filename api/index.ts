process.env.TZ = 'Asia/Jakarta';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import simpcache from 'simpcache';
import chrome from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

const cache = simpcache();

async function wordleWord(): Promise<string> {
  const options = process.env.AWS_REGION
    ? {
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless
      }
    : {
        args: [],
        executablePath: process.platform === 'win32'
          ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'linux'
          ? '/usr/bin/google-chrome'
          : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      };
  const browser = await puppeteer.launch(options);
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.goto('https://www.nytimes.com/games/wordle/index.html');
  await page.setCacheEnabled(false);
  await page.reload({ waitUntil: 'networkidle2' });
  // const cookies = await page.cookies();

  // await page.waitForTimeout(10000);
  const localStorageData = await page.evaluate(() => {
    let json = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      json[key] = localStorage.getItem(key);
    }
    return json;
  });

  if ('nyt-wordle-state' in localStorageData) {
    const worldeState = JSON.parse(localStorageData['nyt-wordle-state']);
    await browser.close();
    return worldeState.solution;
  }
  
  await browser.close();
  return '';
}

export default async function (req: VercelRequest, res: VercelResponse) {
  let word = '';
  const forceCache = req.query.forceCache;
  const cacheKey = 'WORDLE:WORD';
  const cacheValue = cache.get(cacheKey);

  if (cacheValue && forceCache !== 'true') {
    word = cacheValue;
  } else {
    word = await wordleWord();
    if (word !== '') {
      cache.set(cacheKey, word, (1000 * 60) * 60); //expires in 1hour
    }
  }
  res.send(`<label style="font-size: 17pt;">Today's Wordle is:</label> <h1>:: ${word} ::</h1>`);
};
