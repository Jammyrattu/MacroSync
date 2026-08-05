import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from '@/lib/serviceWorker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After render, not before: the worker is only needed for offline fallback and
// push, and neither is worth delaying first paint for.
registerServiceWorker()
