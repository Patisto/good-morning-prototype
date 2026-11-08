import net from 'node:net';
import tls, { TLSSocket } from 'node:tls';
import type { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';

type MailSocket = Socket | TLSSocket;

type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
};

export type EmailMessage = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

class SMTPChannel {
    private buffer = '';
    private activeLines: string[] = [];
    private replies: string[][] = [];
    private waiters: { resolve: (lines: string[]) => void; reject: (error: Error) => void }[] = [];

    private readonly onData = (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8');
        const lines = this.buffer.split('\r\n');
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
            this.activeLines.push(line);
            if (/^\d{3} /.test(line)) {
                const response = this.activeLines;
                this.activeLines = [];
                const waiter = this.waiters.shift();
                if (waiter) waiter.resolve(response);
                else this.replies.push(response);
            }
        }
    };
    private readonly onError = (error: Error) => {
        while (this.waiters.length) this.waiters.shift()!.reject(error);
    };

    constructor(private readonly socket: MailSocket) {
        socket.on('data', this.onData);
        socket.on('error', this.onError);
    }

    close() {
        this.socket.off('data', this.onData);
        this.socket.off('error', this.onError);
    }

    async response(): Promise<string[]> {
        if (this.replies.length) return this.replies.shift()!;
        return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    }

    async command(command: string, accepted: number[]) {
        this.socket.write(`${command}\r\n`);
        const response = await this.response();
        const code = Number(response[response.length - 1]?.slice(0, 3));
        if (!accepted.includes(code)) throw new Error(`SMTP command failed (${code}): ${response.join(' ')}`);
    }
}

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim();
const addressPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function configuration(): SmtpConfig {
    const host = env('SMTP_HOST', 'smtp-relay.brevo.com');
    const port = Number(env('SMTP_PORT', '587'));
    const user = env('SMTP_USER');
    const password = env('SMTP_PASSWORD');
    const from = env('SMTP_FROM');
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from)
        throw new Error('SMTP is not configured. Set SMTP_FROM and valid SMTP connection settings.');
    if (!user || !password) throw new Error('SMTP_USER and SMTP_PASSWORD are required for Brevo SMTP.');
    if (!addressPattern.test(from.match(/<([^>]+)>/)?.[1] ?? from))
        throw new Error('SMTP_FROM must contain a valid email address.');
    if (/[\r\n]/.test(from)) throw new Error('SMTP_FROM cannot contain line breaks.');
    return { host, port, user, password, from, secure: env('SMTP_SECURE', port === 465 ? 'true' : 'false') === 'true' };
}

function connect(config: SmtpConfig): Promise<MailSocket> {
    return new Promise((resolve, reject) => {
        const socket = config.secure
            ? tls.connect({ host: config.host, port: config.port, servername: config.host })
            : net.connect({ host: config.host, port: config.port });
        const connectedEvent = config.secure ? 'secureConnect' : 'connect';
        const onError = (error: Error) => reject(error);
        socket.once('error', onError);
        socket.once(connectedEvent, () => {
            socket.off('error', onError);
            resolve(socket);
        });
    });
}

function headerSubject(subject: string) {
    if (/[\r\n]/.test(subject)) throw new Error('Email subject cannot contain line breaks.');
    return /^[\x20-\x7e]*$/.test(subject)
        ? subject
        : `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

/** Send a plain-text message using SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
 * SMTP_PASSWORD and SMTP_FROM environment variables.
 */
export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
    const config = configuration();
    if (!addressPattern.test(to)) throw new Error('Email recipient must be a valid email address.');
    if (!subject.trim()) throw new Error('Email subject is required.');
    const formattedSubject = headerSubject(subject);
    const envelopeFrom = config.from.match(/<([^>]+)>/)?.[1] ?? config.from;
    let socket = await connect(config);
    socket.setTimeout(20000, () => socket.destroy(new Error('SMTP timed out.')));
    let channel = new SMTPChannel(socket);
    try {
        const greeting = await channel.response();
        if (!/^220 /.test(greeting[greeting.length - 1] ?? '')) throw new Error(`SMTP greeting failed: ${greeting.join(' ')}`);
        await channel.command('EHLO good-morning.local', [250]);
        if (!config.secure) {
            await channel.command('STARTTLS', [220]);
            channel.close();
            socket = await new Promise<TLSSocket>((resolve, reject) => {
                const secured = tls.connect({ socket: socket as Socket, servername: config.host }, () => resolve(secured));
                secured.once('error', reject);
            });
            channel = new SMTPChannel(socket);
            await channel.command('EHLO good-morning.local', [250]);
        }
        if (config.user) {
            await channel.command('AUTH LOGIN', [334]);
            await channel.command(Buffer.from(config.user).toString('base64'), [334]);
            await channel.command(Buffer.from(config.password).toString('base64'), [235]);
        }
        await channel.command(`MAIL FROM:<${envelopeFrom}>`, [250]);
        await channel.command(`RCPT TO:<${to}>`, [250, 251]);
        await channel.command('DATA', [354]);
        const boundary = `gm-${randomUUID()}`;
        const body = html
            ? `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}\r\n--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n--${boundary}--`
            : `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}`;
        const normalizedBody = body.replace(/\r\n|\r|\n/g, '\r\n').replace(/^\./gm, '..');
        socket.write(`Date: ${new Date().toUTCString()}\r\nFrom: ${config.from}\r\nTo: ${to}\r\nSubject: ${formattedSubject}\r\nMIME-Version: 1.0\r\n${normalizedBody}\r\n.\r\n`);
        const sent = await channel.response();
        if (!/^250 /.test(sent[sent.length - 1] ?? '')) throw new Error(`SMTP message failed: ${sent.join(' ')}`);
        await channel.command('QUIT', [221]);
    }
    finally {
        channel.close();
        socket.end();
    }
}
