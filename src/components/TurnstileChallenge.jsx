import { Turnstile } from '@marsidev/react-turnstile';
import React from 'react';

const RETRYABLE_ERROR_PREFIXES = ['1106', '2005', '300', '600'];

function isRetryableError(errorCode) {
    const code = String(errorCode || '');
    return RETRYABLE_ERROR_PREFIXES.some(prefix => code.startsWith(prefix));
}

export default function TurnstileChallenge({ siteKey, onToken, onError }) {
    const handleError = errorCode => {
        onToken('');
        if (isRetryableError(errorCode)) return false;
        onError?.(String(errorCode || 'unknown'));
        return true;
    };

    return (
        <div className="flex min-h-[65px] w-full items-center justify-center" aria-label="Verificação de segurança">
            <Turnstile
                siteKey={siteKey}
                onSuccess={onToken}
                onExpire={() => onToken('')}
                onTimeout={() => onToken('')}
                onUnsupported={() => { onToken(''); onError?.('unsupported'); }}
                onError={handleError}
                options={{
                    action: 'login',
                    theme: 'light',
                    size: 'flexible',
                    language: 'pt-BR',
                    retry: 'auto',
                    retryInterval: 3000,
                    refreshExpired: 'auto',
                    refreshTimeout: 'auto',
                }}
                scriptOptions={{
                    id: 'cloudflare-turnstile-script',
                    onError: () => onError?.('script-load'),
                }}
            />
        </div>
    );
}
