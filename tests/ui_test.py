# UI-próf með Playwright: python3 tests/ui_test.py (þjónninn þarf að vera í gangi á :8765)
import json, os, sys, time
from playwright.sync_api import sync_playwright
URL = 'http://127.0.0.1:8765/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
errs = []
def sqpos(page, name):  # miðja reits
    el = page.locator('.sq[data-sq="%d"]' % ((int(name[1]) - 1) * 8 + 'abcdefgh'.index(name[0])))
    b = el.bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2
def click(page, name):
    x, y = sqpos(page, name); page.mouse.click(x, y)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1400, 'height': 900})
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.sq'); pg.screenshot(path=OUT + '/ui_start.png')
    # hvítur: e2-e4 með smelli, svo drag d2-d4 á eftir svari
    pg.click('#btnPlay'); click(pg, 'e2'); click(pg, 'e4')
    pg.wait_for_function("document.getElementById('status').textContent.includes('Þinn leikur')", timeout=10000)
    n = pg.locator('#moves span').count(); print('leikir á lista eftir 1 umferð:', n)
    x1, y1 = sqpos(pg, 'd2'); x2, y2 = sqpos(pg, 'd4')
    pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, steps=4); pg.mouse.move(x2, y2, steps=4); pg.mouse.up()
    pg.wait_for_function("document.getElementById('status').textContent.includes('Þinn leikur')", timeout=10000)
    print('leikir á lista eftir drag:', pg.locator('#moves span').count())
    pg.screenshot(path=OUT + '/ui_playing.png')
    pg.click('#btnResign'); pg.wait_for_selector('#newCard:not([hidden])'); time.sleep(0.5)
    print('staða:', pg.inner_text('#status')); print('Elo:', pg.inner_text('#elo'))
    # svartur: tölvan á að opna
    pg.click('#colorSeg button[data-c="b"]'); pg.click('#btnPlay')
    pg.wait_for_function("document.getElementById('status').textContent.includes('Þinn leikur')", timeout=10000)
    print('svartur: leikir á lista (tölvan opnaði):', pg.locator('#moves span').count())
    pg.screenshot(path=OUT + '/ui_black.png')
    pg.click('#btnResign'); pg.wait_for_selector('#newCard:not([hidden])')
    # sjálfsþjálfun
    pg.select_option('#trainN', '5'); pg.click('#btnTrain')
    pg.wait_for_function("document.getElementById('trainMsg').textContent.includes('æfingaleikir búnir')", timeout=120000)
    print(pg.inner_text('#trainMsg')); pg.screenshot(path=OUT + '/ui_after.png', full_page=True)
    pg.reload(); pg.wait_for_selector('.sq'); time.sleep(0.5)
    print('eftir endurhleðslu: leikir lærðir', pg.inner_text('#lHuman'), 'sjálfsþj.', pg.inner_text('#lSelf'), 'Elo', pg.inner_text('#elo'))
    br.close()
print('villur:', errs)
d = os.path.join(os.path.dirname(__file__), '..', 'data'); print(sorted(os.listdir(d)))
print(open(os.path.join(d, 'results.csv'), encoding='utf-8-sig').read())
