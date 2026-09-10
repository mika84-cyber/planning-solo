import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { localStorage.setItem('planning:e2e-demo-enabled', '1'); localStorage.setItem('planning:guide-seen-v1:demo', '1'); });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:5173/?local-test=1');
await page.getByRole('heading', {name:'Aujourd’hui', exact:true}).waitFor();
for (const [key, label] of [['home','Accueil'],['leave','Congés'],['pay','Ma paie'],['docs','Docs'],['expos','Expos'],['colleagues','Collègues']]) {
  await page.locator('.mobile-bottom-navigation').getByRole('button', {name:label, exact:true}).click();
  await page.waitForTimeout(700);
  await page.screenshot({path:`previews/audit-${key}.png`, fullPage:true});
  console.log(JSON.stringify({page:key, text:(await page.locator('body').innerText()).slice(0,12500), width:await page.evaluate(()=>document.documentElement.scrollWidth), viewport:390}));
}
console.log(JSON.stringify({errors}));
await browser.close();
