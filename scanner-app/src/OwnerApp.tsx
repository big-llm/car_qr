import React, { useState, useEffect } from 'react';
import { 
  Car, Bell, Settings, Send, LayoutDashboard, ShieldAlert,
  CheckCircle2, Phone, LogOut, RefreshCw, Activity
} from 'lucide-react';
import { auth } from './lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, User } from 'firebase/auth';
import QRCode from 'react-qr-code';
import './App.css';

const API_BASE_URL = '/api/user';

export default function OwnerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [jwt, setJwt] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState(true);
  
  // App views
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'alerts' | 'settings'>('dashboard');

  // OTP State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState('');

  // Data
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken(true);
        setJwt(token);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (jwt && user) {
      if (activeTab === 'dashboard') loadDashboard();
      if (activeTab === 'vehicles') fetchVehicles();
      if (activeTab === 'alerts') fetchAlerts();
    }
  }, [jwt, activeTab, user]);

  const authFetch = async (endpoint: string, options: any = {}) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${jwt}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const loadDashboard = async () => {
    setLoadingData(true);
    try {
      const [vData, aData] = await Promise.all([
        authFetch('/vehicles'),
        authFetch('/alerts')
      ]);
      setVehicles(vData);
      setAlerts(aData);
      setProfile(await authFetch('/profile').catch(()=>null));
    } catch(e) { console.error(e); }
    setLoadingData(false);
  };

  const fetchVehicles = async () => {
    setLoadingData(true);
    try { setVehicles(await authFetch('/vehicles')); } catch(e) {}
    setLoadingData(false);
  };

  const fetchAlerts = async () => {
    setLoadingData(true);
    try { setAlerts(await authFetch('/alerts')); } catch(e) {}
    setLoadingData(false);
  };

  // === AUTHENTICATION ===
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'owner-recaptcha', { size: 'invisible' });
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return alert('Enter a valid phone (+1...)');
    setAuthStatus('Sending SMS...');
    try {
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
    } catch (err: any) {
      alert("Failed to send OTP. Check phone number format.");
      if(window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
    } finally { setAuthStatus(''); }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setAuthStatus('Verifying...');
    try {
      if (confirmationResult) await confirmationResult.confirm(otp);
      // Let onAuthStateChanged handle the rest
    } catch (err) {
      alert('Invalid OTP code.');
    } finally { setAuthStatus(''); }
  };

  const handleLogout = () => { auth.signOut(); };

  // Actions
  const handleAlertResponse = async (alertId: string, responseCode: string) => {
    try {
      await authFetch(`/alerts/${alertId}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseCode })
      });
      fetchAlerts();
    } catch(e) { alert("Failed to respond"); }
  };

  const handleRegenerateQR = async (vehicleId: string) => {
     if(!window.confirm("IMPORTANT: This will invalidate your physically printed QR sticker immediately. Anyone scanning the old sticker will see an error. Are you sure?")) return;
     try {
       await authFetch(`/vehicles/${vehicleId}/qr-regenerate`, { method: "PUT" });
       fetchVehicles();
     } catch(e) { alert("Failed to regenerate"); }
  };


  if (loadingUser) {
    return <div className="loader"><div className="spinner"></div><p>Loading Portal...</p></div>;
  }

  // === LOGIN VIEW ===
  if (!user) {
    return (
      <div className="container fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
          <ShieldAlert size={48} style={{ margin: '0 auto' }} />
        </div>
        <h1>Owner Portal</h1>
        <p style={{marginBottom: "2rem"}}>Securely log in to manage your vehicles and respond to active incident alerts directly from your phone.</p>
        
        <form onSubmit={showOtpInput ? verifyOTP : requestOTP}>
          {!showOtpInput ? (
            <div className="input-group">
              <label>Registered Phone Number</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0 1rem' }}>
                 <Phone size={18} color="var(--text-secondary)" style={{marginRight: '0.5rem'}} />
                 <input type="tel" placeholder="+1 234 567 8900" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '1rem 0', width: '100%', outline: 'none', color: 'white' }} autoFocus />
              </div>
            </div>
          ) : (
            <div className="input-group fade-in">
              <label>SMS Verification Code</label>
              <input type="number" placeholder="Enter 6-Digit Code" value={otp} onChange={(e) => setOtp(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px' }} autoFocus />
            </div>
          )}

          <div id="owner-recaptcha"></div>
          
          <button className="btn-primary" disabled={!!authStatus} type="submit" style={{ marginTop: '1.5rem' }}>
            {authStatus ? (<><div className="spinner" style={{width: '16px', height: '16px', borderWidth: '2px'}}></div> {authStatus}</>) : (<><Send size={18} /> {showOtpInput ? 'Secure Login' : 'Send Code'}</>)}
          </button>
        </form>
      </div>
    );
  }

  // === AUTHENTICATED MOBILE-OPTIMIZED VIEWS ===
  const unreadCount = alerts.filter(a => a.status === 'delivered' || a.status === 'sent').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background-color)', color: 'white', maxWidth: '600px', margin: '0 auto', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
      {/* Top Header */}
      <header style={{ padding: '1.25rem 1.5rem', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
         <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><ShieldAlert size={20} color="var(--accent-color)"/> My Garage</h2>
         {profile?.name && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hi, {profile.name}</span>}
      </header>

      {/* Main Tab Content */}
      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', paddingBottom: '80px' }}>
         {activeTab === 'dashboard' && (
           <div className="fade-in">
             <h1 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Overview</h1>
             
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div onClick={()=>setActiveTab('vehicles')} style={{ background: 'var(--surface-color)', padding: '1.5rem 1rem', borderRadius: '16px', border: '1px solid var(--surface-border)', cursor: 'pointer', textAlign: 'center' }}>
                  <Car size={24} color="var(--accent-color)" style={{margin: '0 auto 0.5rem'}}/>
                  <h2 style={{ fontSize: '2rem', margin: 0 }}>{vehicles.length}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Vehicles</p>
                </div>
                <div onClick={()=>setActiveTab('alerts')} style={{ background: 'var(--surface-color)', padding: '1.5rem 1rem', borderRadius: '16px', border: '1px solid var(--surface-border)', cursor: 'pointer', textAlign: 'center', position: 'relative' }}>
                  {unreadCount > 0 && <span style={{position:'absolute', top: '10px', right: '10px', background: 'var(--danger-color)', width: '12px', height: '12px', borderRadius: '50%'}}></span>}
                  <Bell size={24} color="#f59e0b" style={{margin: '0 auto 0.5rem'}}/>
                  <h2 style={{ fontSize: '2rem', margin: 0 }}>{alerts.length}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Total Alerts</p>
                </div>
             </div>

             <h3 style={{fontSize:'1.1rem', marginBottom: '1rem'}}>Recent Activity</h3>
             {loadingData ? <div className="spinner"></div> : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {alerts.slice(0, 3).map(alert => (
                   <div key={alert.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Activity size={20} color="var(--text-secondary)" />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'capitalize' }}>{alert.type.replace('_',' ')}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>{alert.status}</span>
                   </div>
                 ))}
                 {alerts.length === 0 && <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>No recent alerts to display.</p>}
               </div>
             )}
           </div>
         )}

         {activeTab === 'vehicles' && (
           <div className="fade-in">
             <h1 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>My Vehicles</h1>
             <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Manage connected vehicles and download official QR tags.</p>
             
             {loadingData ? <div className="spinner"></div> : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 {vehicles.map(v => {
                   const scanUrl = `${window.location.protocol}//${window.location.host}/qr/${v.qrToken}`;
                   return (
                     <div key={v.id} style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                           <div>
                             <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{v.licensePlate}</h2>
                             <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>{v.make} {v.model}</p>
                           </div>
                           <button onClick={() => handleRegenerateQR(v.id)} className="btn-outline" style={{ padding: '0.4rem', border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)' }} title="Invalidate old QR">
                             <RefreshCw size={16}/>
                           </button>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                           <div style={{ background: 'white', padding: '5px', borderRadius: '8px' }}>
                             <QRCode value={scanUrl} size={60} level={"L"} />
                           </div>
                           <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, marginBottom: '0.25rem' }}>SECURE ID TOKEN:</p>
                              <code style={{ fontSize: '0.7rem', wordBreak: 'break-all', display: 'block', color: 'var(--accent-color)' }}>{v.qrToken}</code>
                           </div>
                        </div>
                     </div>
                   )
                 })}
                 {vehicles.length === 0 && <p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>No vehicles registered under this number.</p>}
               </div>
             )}
           </div>
         )}

         {activeTab === 'alerts' && (
           <div className="fade-in">
             <h1 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Incident Alerts</h1>
             <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Live monitoring of all active QR scans and incident reports.</p>
             
             {loadingData ? <div className="spinner"></div> : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {alerts.map(a => {
                    const isNew = a.status !== 'responded';
                    const veh = vehicles.find(v => v.id === a.vehicleId);
                    return (
                     <div key={a.id} style={{ background: isNew ? 'rgba(56, 189, 248, 0.05)' : 'var(--surface-color)', border: isNew ? '1px solid var(--accent-color)' : '1px solid var(--surface-border)', padding: '1.25rem', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                           <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>{new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <span style={{ fontSize: '0.75rem', color: isNew ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 'bold' }}>{a.status.toUpperCase()}</span>
                        </div>
                        
                        <h3 style={{ margin: 0, fontSize: '1.1rem', textTransform: 'capitalize' }}>❗️ {a.type.replace('_',' ')}</h3>
                        <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Car size={14} style={{display:'inline', verticalAlign:'sub'}}/> {veh ? veh.licensePlate : 'Unknown Vehicle'}</p>
                        
                        {isNew && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                             <button onClick={() => handleAlertResponse(a.id, 'on_my_way')} className="btn-primary" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                               On My Way
                             </button>
                             <button onClick={() => handleAlertResponse(a.id, 'acknowledged')} className="btn-outline" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                               Acknowledge
                             </button>
                          </div>
                        )}
                        {a.status === 'responded' && (
                          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontSize: '0.85rem' }}>
                             <CheckCircle2 size={16}/> Responded ({a.ownerResponse?.replace(/_/g, ' ')})
                          </div>
                        )}
                     </div>
                 )})}
                 {alerts.length === 0 && <p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>No alerts found.</p>}
               </div>
             )}
           </div>
         )}

         {activeTab === 'settings' && (
           <div className="fade-in">
             <h1 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Account Settings</h1>
             <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Authenticated as: <strong style={{color:'white'}}>{user.phoneNumber}</strong></p>
                
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Notification Preferences</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" defaultChecked style={{width: '20px', height: '20px'}}/> Direct SMS Alerts
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" style={{width: '20px', height: '20px'}}/> WhatsApp Integration (Beta)
                </label>

                <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)', margin: '1.5rem 0' }} />
                
                <button onClick={handleLogout} className="btn-danger" style={{ width: '100%', padding: '1rem' }}>
                  <LogOut size={18} /> Logout Device
                </button>
             </div>
           </div>
         )}
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <nav style={{ display: 'flex', justifyContent: 'space-around', position: 'fixed', bottom: 0, width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--surface-border)', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
         <button onClick={()=>setActiveTab('dashboard')} style={{ background: 'none', border: 'none', color: activeTab==='dashboard'?'var(--accent-color)':'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <LayoutDashboard size={22}/>
            <span style={{fontSize: '0.65rem'}}>Home</span>
         </button>
         <button onClick={()=>setActiveTab('vehicles')} style={{ background: 'none', border: 'none', color: activeTab==='vehicles'?'var(--accent-color)':'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <Car size={22}/>
            <span style={{fontSize: '0.65rem'}}>Vehicles</span>
         </button>
         <button onClick={()=>setActiveTab('alerts')} style={{ background: 'none', border: 'none', color: activeTab==='alerts'?'var(--accent-color)':'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', position: 'relative' }}>
            {unreadCount > 0 && <span style={{position:'absolute', top: '10px', right: '15px', background: 'var(--danger-color)', width: '10px', height: '10px', borderRadius: '50%'}}></span>}
            <Bell size={22}/>
            <span style={{fontSize: '0.65rem'}}>Alerts</span>
         </button>
         <button onClick={()=>setActiveTab('settings')} style={{ background: 'none', border: 'none', color: activeTab==='settings'?'var(--accent-color)':'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <Settings size={22}/>
            <span style={{fontSize: '0.65rem'}}>Settings</span>
         </button>
      </nav>
    </div>
  );
}
