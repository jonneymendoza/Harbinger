// Quick test: Can we bypass Cloudflare with proper Playwright config?
const { chromium } = require('playwright');

(async () => {
  console.log('[*] Testing full stealth mode...');
  
  // This is what our backend container uses - let's replicate it exactly
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', 
      '--disable-gpu',
      //'--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--window-size=1920,1080',
    ],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    screen: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
  });

  // Add maximum possible stealth
  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4] });
    navigator.languages = ['en-US'];
    window.innerWidth = 1920;
    window.innerHeight = 1080;
    delete window.__webdriver_script_func;
    delete window._sharedHostInfo; 
    delete window._sharedHostPort;
  `);

  // Try to visit a known-working page with full Cloudflare bypass approach
  for (const url of ['https://www.arsenal.com/news/men', 'https://www.arsenal.com']) {
    try {
      console.log(`\n[*] Trying: ${url}`);
      
      // Set referrer first to mimic natural navigation
      await context.setExtraHTTPHeaders({ 
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="127", "Google Chrome";v="127"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      });
      
      const page = await context.newPage();
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const title = await page.title();
      const bodyContent = await page.evaluate(() => document.body?.textContent?.substring(0, 200));
      const linkCount = await page.$$eval('a', els => els.length);
      
      console.log(`[+] Title: ${title}`);
      console.log(`[+] Links on page: ${linkCount}`);
      console.log(`[+] Body preview: ${bodyContent?.substring(0, 100) || 'empty'}`);
      
      if (title.includes('Access Denied')) {
        console.log('[!] Blocked - Access Denied');
      } else if (bodyContent?.includes('challenge-platform') || bodyContent?.includes('cf-ray')) {
        console.log('[!] Cloudflare challenge page detected');
      } else {
        console.log('[✓] Success! Page loads with content.');
        break; // Good URL found
      }
      
      await page.close();
    } catch (err) {
      console.log(`[!] Error: ${err.message}`);
    }
    
    // Wait before next attempt to avoid aggressive rate limiting
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();
})();
