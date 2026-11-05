import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign Chromium ResizeObserver loop notifications from triggering uncaught error overlays
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (
        typeof event.message === 'string' &&
        (event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
          event.message.includes('ResizeObserver loop limit exceeded'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );

  if (typeof window.ResizeObserver !== 'undefined') {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class SafeResizeObserver extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => {
            if (!Array.isArray(entries) || entries.length === 0) return;
            callback(entries, observer);
          });
        });
      }
    };
  }
}

createRoot(document.getElementById('root')!).render(<App />);

