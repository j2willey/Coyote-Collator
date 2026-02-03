const { chromium, devices } = require('@playwright/test');

/**
 * Utility to handle "Human Speed" and "Interactive mode"
 */
async function getContext(options = {}) {
    const isInteractive = process.argv.includes('--interactive');
    const waitArg = process.argv.find(a => a.startsWith('--wait='));
    const waitTime = waitArg ? parseFloat(waitArg.split('=')[1]) * 1000 : 1000;

    const browser = await chromium.launch({
        headless: !isInteractive,
    });

    let contextOptions = {};
    if (options.mobile) {
        // Emulate iPhone 14 Pro Max
        const iPhone14 = devices['iPhone 14 Pro Max'];
        contextOptions = { ...iPhone14 };
    }

    const context = await browser.newContext(contextOptions);

    // Bypass Judge Profile Modal by pre-setting localStorage
    await context.addInitScript(() => {
        localStorage.setItem('judge_info', JSON.stringify({
            name: 'Demo Judge',
            email: 'demo@coyote.org',
            unit: 'Troop 1'
        }));
    });

    const page = await context.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    async function sleep(ms) {
        if (!isInteractive) return;

        // Setup listener in the page to detect skip keys
        await page.evaluate(() => {
            window._skipWait = false;
            const listener = (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    window._skipWait = true;
                    document.removeEventListener('keydown', listener);
                }
            };
            document.addEventListener('keydown', listener);
        });

        const start = Date.now();
        while (Date.now() - start < ms) {
            const skipped = await page.evaluate(() => window._skipWait);
            if (skipped) break;
            await new Promise(r => setTimeout(r, 100));
        }
    }

    return {
        browser,
        page,
        isInteractive,
        waitTime,
        sleep,
        async finish() {
            if (isInteractive) {
                console.log("Demo finished. Press SPACE or ENTER in the browser to close.");
                await page.evaluate(() => {
                    window._finished = false;
                    const finisher = (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            window._finished = true;
                            document.removeEventListener('keydown', finisher);
                        }
                    };
                    document.addEventListener('keydown', finisher);
                });

                while (true) {
                    const shouldFinish = await page.evaluate(() => window._finished);
                    if (shouldFinish) break;
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            await browser.close();
        },
        async startDemo() {
            // Explicitly request index.html to avoid desktop redirect to admin.html
            await page.goto('http://localhost:3000/index.html');
            if (isInteractive) {
                console.log("Interactive mode active. Waiting 5 seconds...");
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    };
}

module.exports = { getContext };
