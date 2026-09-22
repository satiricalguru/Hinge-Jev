"""End-to-end local workbench checks. Run with the server already running.

Uses installed Chrome if available, otherwise Playwright's bundled Chromium.
Screenshots are generated artifacts; no live Jev call is made.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get('HINGE_URL', 'http://127.0.0.1:5173')

with sync_playwright() as p:
    channel = 'chrome' if Path('/Applications/Google Chrome.app').exists() else None
    browser = p.chromium.launch(headless=True, channel=channel)
    page = browser.new_page(viewport={'width': 1440, 'height': 1120}, device_scale_factor=1)
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='Every decision has a turning point.')).to_be_visible()
    page.screenshot(path=str(ROOT / 'docs' / 'studio.png'), full_page=True)
    theme = page.get_by_role('button', name='Switch to dark mode')
    expect(theme).to_be_visible()
    theme.click()
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    expect(page.get_by_role('button', name='Switch to light mode')).to_be_visible()
    page.wait_for_timeout(350)
    page.screenshot(path=str(ROOT / 'docs' / 'studio-dark.png'), full_page=True)
    page.reload()
    page.wait_for_load_state('networkidle')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.get_by_role('button', name='Switch to light mode').click()
    assert page.locator('html').get_attribute('data-theme') == 'light'
    page.get_by_role('button', name='Explore this decision').click()
    expect(page.get_by_role('status')).to_contain_text('No model request was made')
    page.get_by_role('button', name='Dismiss notification').click()
    page.get_by_role('button', name='Staging only', exact=True).click()
    expect(page.get_by_role('heading', name='Should these records be recoverable?')).to_be_visible()
    assert page.locator('.world-card.eliminated').count() == 3
    page.get_by_role('button', name='Yes, keep an archive').click()
    expect(page.get_by_role('heading', name='Archive staging', exact=True)).to_be_visible()
    expect(page.locator('.decision-badge')).to_have_text('Proposal ready')
    page.get_by_role('button', name='Inspect the decision').click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    with page.expect_download() as downloaded:
        page.get_by_role('button', name='Export receipt', exact=True).click()
    download = downloaded.value
    receipt_path = '/tmp/hinge-browser-receipt.json'
    download.save_as(receipt_path)
    receipt = json.loads(Path(receipt_path).read_text())
    assert receipt['provider']['source'] == 'fixture'
    assert receipt['decision']['kind'] == 'act'
    assert len(receipt['confirmations']) == 2
    assert len(receipt['digest']) == 64
    page.get_by_role('button', name='Reset decision').click()
    page.get_by_role('button', name='Decision policy').click()
    page.get_by_role('slider', name='Interruption cost').fill('20')
    expect(page.locator('.decision-badge')).to_have_text('Human review')
    page.get_by_role('slider', name='Interruption cost').fill('1')
    page.get_by_role('slider', name='Probability stress').fill('0.3')
    expect(page.locator('.metric').first).to_contain_text('23.0')
    page.get_by_role('slider', name='Probability stress').fill('0.06')
    page.get_by_role('button', name='Decision policy').click()
    page.get_by_role('button', name='Something else', exact=True).click()
    expect(page.locator('.decision-badge')).to_have_text('Human review')
    for scenario in ['release', 'sharing', 'atlas']:
        page.get_by_label('Choose a situation').select_option(scenario)
        assert page.locator('.world-card').count() == 5
    page.get_by_role('button', name='The method', exact=True).click()
    expect(page.get_by_role('heading', name='Make uncertainty useful.')).to_be_visible()
    page.get_by_role('button', name='Build with Hinge', exact=True).click()
    expect(page.get_by_role('heading', name='A small engine. A different reflex.')).to_be_visible()
    expect(page.get_by_role('heading', name='Use Jev as a typed decision model')).to_be_visible()
    expect(page.get_by_role('link', name='Pydantic AI Typesafe guide')).to_have_attribute('href', 'https://pydantic.dev/docs/ai/models/typesafe/')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Integration page overflows at 390px'
    page.set_viewport_size({'width': 1440, 'height': 1120})
    page.get_by_role('button', name='Decision studio', exact=True).click()
    page.get_by_role('button', name='Live Jev', exact=True).click()
    health = page.request.get(BASE + '/api/health').json()
    if not health['liveAvailable']:
        expect(page.get_by_role('button', name='Evaluate with Jev')).to_be_disabled()
    expect(page.get_by_label('Request to evaluate')).to_be_editable()
    page.get_by_label('Request to evaluate').fill('Custom request')
    expect(page.locator('.decision-badge')).to_have_text('Awaiting evaluation')
    page.get_by_role('button', name='Example data', exact=True).click()
    for width in [390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.wait_for_load_state('networkidle')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Overflow at {width}'
        page.screenshot(path=str(ROOT / 'docs' / f'mobile-{width}.png'), full_page=True)
    page.get_by_role('button', name='Staging only', exact=True).click()
    expect(page.get_by_role('heading', name='Should these records be recoverable?')).to_be_visible()
    assert not failures, failures
    browser.close()
    print('PASS: desktop/mobile flow, scenario switching, policy controls, modal keyboard, export, provider mode, and no browser errors.')
    print(f'Receipt: {receipt_path}')
