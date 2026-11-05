import net from 'node:net';
import tls, { TLSSocket } from 'node:tls';
import type { Socket } from 'node:net';

type MailSocket = Socket | TLSSocket;
class SMTPChannel {
    private buffer = '';
    private replies: string[][] = [];
    private waiters: { resolve: (lines: string[]) => void; reject: (error: Error) => void }[] = [];
    private readonly onData = (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8');
        const lines = this.buffer.split('\r\n');
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
            const current = this.activeLines;
            current.push(line);
            if (/^\d{3} /.test(line)) {
                this.activeLines = [];
                const waiter = this.waiters.shift();
                if (waiter) waiter.resolve(current); else this.replies.push(current);
            }
        }
    };
    private activeLines: string[] = [];
    private readonly onError = (error: Error) => { while (this.waiters.length) this.waiters.shift()!.reject(error); };
    constructor(readonly socket: MailSocket) {
        socket.on('data', this.onData);
        socket.on('error', this.onError);
    }
    close() { this.socket.off('data', this.onData); this.socket.off('error', this.onError); }
    async response() {
        if (this.replies.length) return this.replies.shift()!;
        return new Promise<string[]>((resolve, reject) => this.waiters.push({ resolve, reject }));
    }
    async command(command: string, accepted: number[]) {
        this.socket.write(`${command}\r\n`);
        const response = await this.response();
        const code = Number(response[response.length - 1]?.slice(0, 3));
        if (!accepted.includes(code)) throw new Error(`SMTP command failed (${code}): ${response.join(' ')}`);
    }
}

function env(name: string, fallback = '') { return (process.env[name] ?? fallback).trim(); }
export async function sendEmail(to: string, subject: string, body: string) {
    const host = env('SMTP_HOST'), port = Number(env('SMTP_PORT', '465'));
    const user = env('SMTP_USER'), password = env('SMTP_PASSWORD');
    const fromHeader = env('SMTP_FROM', user);
    const from = fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader;
    if (!host || !port || !from) throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT and SMTP_FROM.');
    const secure = env('SMTP_SECURE', port === 465 ? 'true' : 'false') === 'true';
    let socket: MailSocket;
    if (secure) socket = await new Promise<TLSSocket>((resolve, reject) => {
        const connection = tls.connect({ host, port, servername: host }, () => resolve(connection));
        connection.once('error', reject);
    });
    else socket = await new Promise<Socket>((resolve, reject) => {
        const connection = net.connect({ host, port }, () => resolve(connection));
        connection.once('error', reject);
    });
    socket.setTimeout(20000, () => socket.destroy(new Error('SMTP timed out.')));
    let channel = new SMTPChannel(socket);
    try {
        const greeting = await channel.response();
        if (!/^220 /.test(greeting[greeting.length - 1] ?? '')) throw new Error(`SMTP greeting failed: ${greeting.join(' ')}`);
        await channel.command('EHLO good-morning.local', [250]);
        if (!secure) {
            await channel.command('STARTTLS', [220]);
            channel.close();
            socket = await new Promise<TLSSocket>((resolve, reject) => {
                const connection = tls.connect({ socket: socket as Socket, servername: host }, () => resolve(connection));
                connection.once('error', reject);
            });
            channel = new SMTPChannel(socket);
            await channel.command('EHLO good-morning.local', [250]);
        }
        if (user) {
            await channel.command('AUTH LOGIN', [334]);
            await channel.command(Buffer.from(user).toString('base64'), [334]);
            await channel.command(Buffer.from(password).toString('base64'), [235]);
        }
        await channel.command(`MAIL FROM:<${from}>`, [250]);
        await channel.command(`RCPT TO:<${to}>`, [250, 251]);
        await channel.command('DATA', [354]);
        const safeBody = body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
        socket.write(`From: ${fromHeader}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${safeBody}\r\n.\r\n`);
        const sent = await channel.response();
        if (!/^250 /.test(sent[sent.length - 1] ?? '')) throw new Error(`SMTP message failed: ${sent.join(' ')}`);
        await channel.command('QUIT', [221]);
    }
    finally {
        channel.close();
        socket.end();
    }
}
