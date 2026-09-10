import { chromium } from '@playwright/test';
const browser = await chromium.launch();
for (const width of [412, 1280]) {
  const page = await browser.newPage({ viewport: {width, height: 900} });
  await page.addInitScript(() => {localStorage.setItem('planning:e2e-demo-enabled','1');localStorage.setItem('planning:guide-seen-v1:demo','1');});
  await page.goto('http://127.0.0.1:5173/?local-test=1');
  const nav = page.locator('nav[aria-label="Navigation principale"]:visible');
  await nav.getByRole('button', {name:'Ma paie', exact:true}).click();
  await page.waitForTimeout(500);
  console.log(JSON.stringify({width, pay:await page.locator('.pay-app-screen').boundingBox(),header:await page.locator('.top-header').boundingBox()}));
  console.log(JSON.stringify({width, nav: await nav.boundingBox(), buttons:await nav.locator('button').evaluateAll(nodes=>nodes.map(node=>({text:node.innerText,box:node.getBoundingClientRect().toJSON(),transform:getComputedStyle(node).transform,margin:getComputedStyle(node).margin,padding:getComputedStyle(node).padding}))) }));
  await nav.screenshot({path:`previews/nav-alignment-${width}.png`});
  await page.close();
}
await browser.close();
