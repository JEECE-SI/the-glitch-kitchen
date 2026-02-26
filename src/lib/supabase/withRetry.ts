import { PostgrestError } from '@supabase/supabase-js';

interface RetryConfig {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
}

export async function withRetry<T>(
    operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
    config: RetryConfig = {}
): Promise<{ data: T | null; error: PostgrestError | null }> {
    const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2 } = config;
    
    let lastError: PostgrestError | null = null;
    let currentDelay = delayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            
            if (result.error) {
                lastError = result.error;
                
                // Don't retry on client errors (4xx)
                if (result.error.code && result.error.code.startsWith('4')) {
                    return result;
                }
                
                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    return result;
                }
                
                console.warn(`[withRetry] Attempt ${attempt + 1} failed, retrying in ${currentDelay}ms...`, result.error.message);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                currentDelay *= backoffMultiplier;
            } else {
                return result;
            }
        } catch (error: any) {
            lastError = {
                message: error.message || 'Unknown error',
                details: error,
                hint: '',
                code: 'NETWORK_ERROR',
                name: 'NetworkError'
            };
            
            if (attempt === maxRetries) {
                return { data: null, error: lastError };
            }
            
            console.warn(`[withRetry] Network error on attempt ${attempt + 1}, retrying in ${currentDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            currentDelay *= backoffMultiplier;
        }
    }

    return { data: null, error: lastError };
}
