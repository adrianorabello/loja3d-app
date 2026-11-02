import { Inject, Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { API_ORIGIN } from 'app/core/api/api.config';
import { ChatEvent } from './chat.model';

@Injectable({providedIn: 'root'})
export class ChatRealtimeService
{
    readonly events = new Subject<ChatEvent>();
    readonly status = new BehaviorSubject<'offline' | 'connecting' | 'connected'>('offline');
    private socket: WebSocket | null = null;
    private timer: ReturnType<typeof setTimeout>;
    private ticket: Subscription;
    private generation = 0;
    private active = false;
    private attempts = 0;
    private lastFrame = 0;
    private heartbeat: ReturnType<typeof setInterval>;

    constructor(private http: HttpClient, @Inject(API_ORIGIN) private origin: string, private zone: NgZone)
    {
        window.addEventListener('online', () => { if ( this.active ) { this.connect(this.generation); } });
        window.addEventListener('offline', () => this.socket?.close());
    }

    start(): void
    {
        this.stop();
        this.active = true;
        this.connect(this.generation);
    }

    stop(): void
    {
        this.active = false;
        this.generation++;
        clearTimeout(this.timer);
        clearInterval(this.heartbeat);
        this.ticket?.unsubscribe();
        const previous = this.socket;
        this.socket = null;
        previous?.close();
        this.status.next('offline');
    }

    private connect(generation: number): void
    {
        if ( !this.active || generation !== this.generation || !navigator.onLine || this.socket ) { return; }
        clearTimeout(this.timer);
        this.ticket?.unsubscribe();
        this.status.next('connecting');
        this.ticket = this.http.post<{ticket: string}>('api/v1/chat/ws-ticket', {}).subscribe({
            next: response => {
                if ( generation !== this.generation ) { return; }
                const url = new URL('/api/v1/chat/ws', this.origin || window.location.origin);
                url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                const socket = new WebSocket(url.toString());
                this.socket = socket;
                this.lastFrame = Date.now();
                socket.onopen = () => socket.send(JSON.stringify({type: 'authenticate', ticket: response.ticket}));
                socket.onmessage = event => this.zone.run(() => {
                    if ( generation !== this.generation ) { return; }
                    this.lastFrame = Date.now();
                    let frame: ChatEvent;
                    try { frame = JSON.parse(event.data); }
                    catch (error) {
                        console.error('Invalid chat realtime frame', error);
                        socket.close();
                        return;
                    }
                    if ( frame.v !== 1 || typeof frame.type !== 'string' ) { socket.close(); return; }
                    if ( frame.type === 'ping' ) { socket.send('{"type":"pong"}'); return; }
                    if ( frame.type === 'ready' ) {
                        this.attempts = 0;
                        this.status.next('connected');
                    }
                    this.events.next(frame);
                });
                socket.onclose = () => this.zone.run(() => {
                    if ( generation !== this.generation ) { return; }
                    this.socket = null;
                    clearInterval(this.heartbeat);
                    this.retry(generation);
                });
                socket.onerror = () => socket.close();
                this.heartbeat = setInterval(() => {
                    if ( Date.now() - this.lastFrame > 45000 ) { socket.close(); }
                }, 10000);
            },
            error: (error: HttpErrorResponse) => {
                console.error('Chat connection failed', error.status);
                if ( error.status === 401 || error.status === 403 ) {
                    this.active = false;
                    this.status.next('offline');
                    return;
                }
                this.retry(generation);
            }
        });
    }

    private retry(generation: number): void
    {
        if ( !this.active || generation !== this.generation ) { return; }
        this.status.next('offline');
        const delay = Math.min(30000, 1000 * Math.pow(2, this.attempts++)) * (0.8 + Math.random() * 0.4);
        this.timer = setTimeout(() => this.connect(generation), delay);
    }
}
