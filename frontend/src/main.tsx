import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminApp from './AdminApp.tsx'
import OwnerApp from './OwnerApp.tsx'
import LandingPage from './LandingPage.tsx'

const RootApp = () => {
  const path = window.location.pathname;
  
  if (path.startsWith('/admin')) {
    return <AdminApp />
  }
  if (path.startsWith('/login')) {
    return <OwnerApp initialMode="login" />
  }
  if (path.startsWith('/register')) {
    return <OwnerApp initialMode="register" />
  }
  if (path.startsWith('/owner')) {
    return <OwnerApp initialMode="login" />
  }
  
  // If it's the root path exactly, show landing page
  if (path === '/' || path === '/index.html') {
    return <LandingPage />
  }

  // Otherwise, fallback to the Scanner App (which handles its own sub-routing for /qr/:token)
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
