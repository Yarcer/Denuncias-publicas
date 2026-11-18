import { useEffect, useRef, useState } from 'react';
import './TurnstileWidget.css';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error('Turnstile no pudo inicializarse.'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile.'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

type TurnstileWidgetProps = {
  action: 'register' | 'anonymous_login' | 'create_report';
  onToken: (token: string) => void;
  resetVersion: number;
};

export default function TurnstileWidget({
  action,
  onToken,
  resetVersion,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [loadError, setLoadError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ||
    (import.meta.env.DEV ? '1x00000000000000000000AA' : '');
  const widgetKey = `${siteKey ?? ''}:${action}`;

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;

    let active = true;

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            onTokenRef.current(token);
            setLoadError(null);
          },
          'expired-callback': () => {
            onTokenRef.current('');
            setLoadError({
              key: widgetKey,
              message: 'La verificación venció. Completala nuevamente.',
            });
          },
          'error-callback': () => {
            onTokenRef.current('');
            setLoadError({
              key: widgetKey,
              message:
                'No se pudo completar la verificación. Revisá tu conexión e intentá nuevamente.',
            });
          },
        });
      })
      .catch(() => {
        if (active) {
          setLoadError({
            key: widgetKey,
            message:
              'No se pudo cargar la verificación de seguridad. Revisá tu conexión e intentá nuevamente.',
          });
        }
      });

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onTokenRef.current('');
    };
  }, [action, siteKey, widgetKey]);

  useEffect(() => {
    if (resetVersion > 0 && widgetIdRef.current && window.turnstile) {
      onTokenRef.current('');
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetVersion]);

  return (
    <div className="turnstile-field">
      <div ref={containerRef} />
      {(!siteKey || loadError?.key === widgetKey) && (
        <p className="turnstile-message" role="alert">
          {!siteKey
            ? 'Falta configurar la clave pública de Turnstile.'
            : loadError?.message}
        </p>
      )}
    </div>
  );
}
