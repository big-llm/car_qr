import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminApp from './AdminApp.tsx'
import OwnerApp from './OwnerApp.tsx'

const RootApp = () => {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminApp />
  }
  if (window.location.pathname.startsWith('/owner')) {
    return <OwnerApp />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
