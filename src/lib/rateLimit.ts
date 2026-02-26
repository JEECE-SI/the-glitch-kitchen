import { NextRequest } from 'next/server';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
    interval: number;
    uniqueTokenPerInterval: number;
}

export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = { interval: 60000, uniqueTokenPerInterval: 10 }
): Promise<{ success: boolean; remaining: number; reset: number }> {
    const identifier = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'anonymous';

    const now = Date.now();
    const key = `${identifier}`;

    if (!store[key] || store[key].resetTime < now) {
        store[key] = {
            count: 0,
            resetTime: now + config.interval,
        };
    }

    store[key].count++;

    const remaining = Math.max(0, config.uniqueTokenPerInterval - store[key].count);
    const success = store[key].count <= config.uniqueTokenPerInterval;

    // Cleanup old entries every 100 requests
    if (Math.random() < 0.01) {
        Object.keys(store).forEach(k => {
            if (store[k].resetTime < now) {
                delete store[k];
            }
        });
    }

    return {
        success,
        remaining,
        reset: store[key].resetTime,
    };
}
