import React, { useState, useEffect } from 'react';
import { 
  Car, Bell, Settings, Send, LayoutDashboard, ShieldAlert,
  CheckCircle2, Phone, LogOut, RefreshCw, Activity, Clock, MessageCircle,
  Plus, Trash2, Edit3, Mail, Lock
} from 'lucide-react';
import { auth, db, requestFcmToken } from './lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, User as AuthUser } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { motion } from "framer-motion";
import './App.css';

const API_BASE_URL = '/api/user';

type OwnerAppProps = {
  initialMode?: 'login' | 'register';
};

export default function OwnerApp({ initialMode = 'login' }: OwnerAppProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jwt, setJwt] = useState<string>('');
  const [loadingUser, setLoadingUser] = useState(true);
  
  // App views
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'alerts' | 'profile'>('dashboard');

  // Owner email/password auth
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerAddress, setRegisterAddress] = useState('');

  // Data
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [newAlertToast, setNewAlertToast] = useState<any>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Authentication State
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');

  // Vehicle CRUD
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // History filters
  const [historyVehicleId, setHistoryVehicleId] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser && !currentUser.email) {
        await auth.signOut();
        setUser(null);
        setJwt('');
        setLoadingUser(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken(true);
        setJwt(token);
      } else {
        setJwt('');
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (jwt && user) {
      if (activeTab === 'dashboard') loadDashboard();
      if (activeTab === 'vehicles') fetchVehicles();
      if (activeTab === 'alerts') loadAlertsView();
      if (activeTab === 'profile') loadProfile();
    }
  }, [jwt, activeTab, user]);

  useEffect(() => {
    if (!user || !jwt) return;

    // Listen for alerts where ownerId matches current user
    // We don't use orderBy here to avoid requiring a composite index
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const allAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Sort by timestamp descending in memory
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setAlerts(allAlerts);
      
      // Handle "New Alert" notification logic
      const latestAlert = allAlerts[0];
      if (latestAlert && latestAlert.status === 'pending') {
        const isVeryRecent = (Date.now() - new Date(latestAlert.timestamp).getTime()) < 10000;
        if (isVeryRecent) {
           setNewAlertToast(latestAlert);
           if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
           try {
             // Play a subtle high-tech notification sound
             const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
             audio.volume = 0.7;
             audio.play().catch(() => {});
           } catch(e) {}
        }
      }
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [user, jwt]);

  const handleFcmToken = async (token: string) => {
    try {
      await authFetch('/fcm-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (e) {
      console.warn('Failed to sync FCM token:', e);
    }
  };

  const enableNotifications = async () => {
    const token = await requestFcmToken();
    if (token) {
      await handleFcmToken(token);
      setNotificationPermission('granted');
      alert('Push notifications enabled successfully!');
    } else {
      if (Notification.permission === 'denied') {
        alert('Push notifications are blocked by your browser. Please allow them in your site settings.');
      }
      setNotificationPermission(Notification.permission);
    }
  };

  useEffect(() => {
    if (user && jwt && notificationPermission === 'granted') {
      requestFcmToken().then(token => {
        if (token) handleFcmToken(token);
      });
    }
  }, [user, jwt]);

  useEffect(() => {
    if (newAlertToast) {
      const timer = setTimeout(() => setNewAlertToast(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [newAlertToast]);

  const authFetch = async (endpoint: string, options: any = {}) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${jwt || (await auth.currentUser?.getIdToken())}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const authFetchWithToken = async (endpoint: string, token: string, options: any = {}) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const loadDashboard = async () => {
    setLoadingData(true);
    try {
      const vData = await authFetch('/vehicles');
      setVehicles(vData);
      // Alerts are managed exclusively by the real-time onSnapshot listener
      setProfile(await authFetch('/profile').catch(() => null));
    } catch(e) { console.error(e); }
    setLoadingData(false);
  };

  const fetchVehicles = async () => {
    setLoadingData(true);
    try { setVehicles(await authFetch('/vehicles')); } catch(e) {}
    setLoadingData(false);
  };

  const loadProfile = async () => {
    setLoadingData(true);
    try { setProfile(await authFetch('/profile')); } catch(e) { console.error(e); }
    setLoadingData(false);
  };

  const loadAlertsView = async () => {
    setLoadingData(true);
    try {
      // Only fetch vehicles (for the filter dropdown) — alerts come from real-time listener
      const vData = await authFetch('/vehicles');
      setVehicles(vData);
    } catch(e) { console.error(e); }
    setLoadingData(false);
  };

  // === AUTHENTICATION ===
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return alert('Enter your email and password.');
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      return alert('Passwords do not match.');
    }
    if (authMode === 'register' && !registerPhone) {
      return alert('Enter the owner phone number for alert notifications.');
    }
    if (authMode === 'register' && registerPhone && !/^\+[1-9]\d{1,14}$/.test(registerPhone)) {
      return alert('Enter the owner contact phone in international format, like +919876543210.');
    }

    setAuthStatus(authMode === 'register' ? 'Creating owner account...' : 'Signing in...');
    try {
      if (authMode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        if (registerName) {
          await updateProfile(credential.user, { displayName: registerName });
        }
        const token = await credential.user.getIdToken(true);
        await authFetchWithToken('/register', token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: registerName,
            phoneNumber: registerPhone,
            address: registerAddress
          })
        });
        setJwt(token);
        window.history.replaceState(null, '', '/owner');
      } else {
        const credential = await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const token = await credential.user.getIdToken(true);
        setJwt(token);
        window.history.replaceState(null, '', '/owner');
      }
    } catch (err: any) {
      alert(err.message || 'Authentication failed.');
    } finally { setAuthStatus(''); }
  };

  const handleLogout = () => {
    auth.signOut();
    setJwt('');
    setProfile(null);
    setVehicles([]);
    setAlerts([]);
    setAuthPassword('');
    setAuthConfirmPassword('');
  };

  const resetVehicleForm = () => {
    setShowVehicleForm(false);
    setEditingVehicleId(null);
    setVehiclePlate('');
    setVehicleName('');
    setVehicleMake('');
    setVehicleModel('');
  };

  const startEditVehicle = (vehicle: any) => {
    setShowVehicleForm(true);
    setEditingVehicleId(vehicle.id);
    setVehiclePlate(vehicle.licensePlate || '');
    setVehicleName(vehicle.vehicleName || '');
    setVehicleMake(vehicle.make || '');
    setVehicleModel(vehicle.model || '');
  };

  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      licensePlate: vehiclePlate,
      vehicleName,
      make: vehicleMake,
      model: vehicleModel
    };

    try {
      await authFetch(editingVehicleId ? `/vehicles/${editingVehicleId}` : '/vehicles', {
        method: editingVehicleId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      resetVehicleForm();
      fetchVehicles();
    } catch (err: any) {
      alert(err.message || "Failed to save vehicle");
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!window.confirm("Delete this vehicle and invalidate its QR code?")) return;
    try {
      await authFetch(`/vehicles/${vehicleId}`, { method: "DELETE" });
      fetchVehicles();
    } catch (err: any) {
      alert(err.message || "Failed to delete vehicle");
    }
  };

  // Actions
  const handleAlertResponse = async (alertId: string, responseCode: string) => {
    try {
      await authFetch(`/alerts/${alertId}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseCode })
      });
      // Do NOT call fetchAlerts() here — the onSnapshot listener updates alerts state automatically
    } catch(e: any) { 
      alert(e.message || "Failed to respond"); 
    }
  };

  const refreshHistory = async () => {
    const params = new URLSearchParams();
    if (historyVehicleId) params.set('vehicleId', historyVehicleId);
    if (historyStatus) params.set('status', historyStatus);
    if (historyFrom) params.set('from', historyFrom);
    if (historyTo) params.set('to', historyTo);

    setLoadingData(true);
    try {
      setAlerts(await authFetch(`/alerts/history?${params.toString()}`));
    } catch (err: any) {
      alert(err.message || "Failed to load history");
    } finally {
      setLoadingData(false);
    }
  };

  const handleRegenerateQR = async (vehicleId: string) => {
     if(!window.confirm("IMPORTANT: This will invalidate your physically printed QR sticker immediately. Anyone scanning the old sticker will see an error. Are you sure?")) return;
     try {
       await authFetch(`/vehicles/${vehicleId}/qr-regenerate`, { method: "PUT" });
       fetchVehicles();
     } catch(e) { alert("Failed to regenerate"); }
  };

  const handleDownloadSticker = async (vehicle: any) => {
    // Create a temporary hidden sticker element for capturing
    const sticker = document.createElement('div');
    sticker.id = 'temp-sticker';
    sticker.style.position = 'fixed';
    sticker.style.top = '0';
    sticker.style.left = '-2000px';
    sticker.style.width = '400px';
    sticker.style.padding = '30px';
    sticker.style.background = 'white';
    sticker.style.borderRadius = '20px';
    sticker.style.textAlign = 'center';
    sticker.style.color = '#0f172a';
    sticker.style.fontFamily = 'sans-serif';
    sticker.innerHTML = `
      <div style="border: 4px solid #0ea5e9; padding: 25px; border-radius: 20px; background: white;">
        <h1 style="margin: 0; color: #0ea5e9; font-size: 32px; letter-spacing: 2px;">SAVIOUR</h1>
        <p style="margin: 5px 0 25px; font-weight: bold; font-size: 14px; color: #64748b;">SMART VEHICLE CONTACT</p>
        
        <div style="background: white; padding: 20px; display: inline-block; border-radius: 15px; border: 2px solid #e2e8f0; margin-bottom: 20px;">
          <img id="qr-image-${vehicle.id}" width="220" height="220" />
        </div>
        
        <p style="margin: 0; font-weight: 900; font-size: 24px; color: #0f172a; letter-spacing: 1px;">SCAN ME</p>
        <p style="margin: 5px 0 25px; font-size: 13px; color: #64748b;">In case of emergency or wrong parking</p>
        
        <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0;">
           <span style="font-size: 20px; font-weight: bold; color: #0ea5e9; letter-spacing: 1px;">${vehicle.licensePlate}</span>
        </div>
        
        <p style="margin-top: 25px; font-size: 10px; color: #94a3b8; font-style: italic;">Powered by Saviour Smart Systems</p>
      </div>
    `;
    document.body.appendChild(sticker);

    // Wait for QR image to load
    const qrImg = document.getElementById(`qr-image-${vehicle.id}`) as HTMLImageElement;
    qrImg.src = await generateQRDataURL(vehicle.id);

    try {
      // Use higher scale for print quality
      const canvas = await html2canvas(sticker, { 
        scale: 3,
        useCORS: true,
        backgroundColor: null
      });
      const imgData = canvas.toDataURL('image/png');
      
      // A6-ish size for the PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [105, 148] 
      });
      
      pdf.setProperties({ title: `Saviour_Sticker_${vehicle.licensePlate}` });
      pdf.addImage(imgData, 'PNG', 5, 5, 95, 138);
      pdf.save(`Sticker-${vehicle.licensePlate}.pdf`);
    } catch(e) {
      console.error(e);
      alert("Failed to generate sticker. Please try again.");
    } finally {
      document.body.removeChild(sticker);
    }
  };

  const generateQRDataURL = (vehicleId?: string): Promise<string> => {
    return new Promise((resolve) => {
      const selector = vehicleId ? `.qr-hidden-${vehicleId} svg` : `.qr-hidden svg`;
      const svg = document.querySelector(selector) as SVGElement;
      if (!svg) return resolve("");
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx?.scale(2, 2);
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
  };


  if (loadingUser) {
    return <div className="loader"><div className="spinner"></div><p>Loading Portal...</p></div>;
  }

  // === LOGIN VIEW ===
  if (!user) {
    return (
      <div className="container fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
          <Car size={48} style={{ margin: '0 auto' }} />
        </div>
        <h1>{authMode === 'register' ? 'Create Owner Account' : 'Owner Login'}</h1>
        <p style={{marginBottom: "2rem"}}>{authMode === 'register' ? 'Register with email and password, then manage vehicles and QR tags.' : 'Use your owner email and password. OTP is only used by public scanners.'}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button type="button" onClick={() => { setAuthMode('login'); window.history.replaceState(null, '', '/login'); }} className={authMode === 'login' ? 'btn-primary' : 'btn-outline'} style={{ padding: '0.7rem' }}>Login</button>
          <button type="button" onClick={() => { setAuthMode('register'); window.history.replaceState(null, '', '/register'); }} className={authMode === 'register' ? 'btn-primary' : 'btn-outline'} style={{ padding: '0.7rem' }}>Register</button>
        </div>
        
        <form onSubmit={handleEmailAuth}>
          {authMode === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <input type="text" placeholder="Full name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
              <input type="tel" placeholder="Owner alert phone (+919876543210)" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} required />
              <input type="text" placeholder="Address or parking location" value={registerAddress} onChange={(e) => setRegisterAddress(e.target.value)} />
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0 1rem', marginBottom: '0.75rem' }}>
               <Mail size={18} color="var(--text-secondary)" style={{marginRight: '0.5rem'}} />
               <input type="email" placeholder="owner@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '1rem 0', width: '100%', outline: 'none', color: 'var(--text-primary)' }} autoFocus />
            </div>
            <label>Password</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0 1rem' }}>
               <Lock size={18} color="var(--text-secondary)" style={{marginRight: '0.5rem'}} />
               <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '1rem 0', width: '100%', outline: 'none', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {authMode === 'register' && (
            <div className="input-group fade-in" style={{ marginTop: '0.75rem' }}>
              <label>Confirm Password</label>
              <input type="password" placeholder="Confirm password" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} style={{ padding: '1rem', borderRadius: '12px' }} />
            </div>
          )}
          
          <button className="btn-primary" disabled={!!authStatus} type="submit" style={{ marginTop: '1.5rem' }}>
            {authStatus ? (<><div className="spinner" style={{width: '16px', height: '16px', borderWidth: '2px'}}></div> {authStatus}</>) : (<><Send size={18} /> {authMode === 'register' ? 'Create Account' : 'Secure Login'}</>)}
          </button>
        </form>
      </div>
    );
  }

  // === AUTHENTICATED MOBILE-OPTIMIZED VIEWS ===
  const activeAlertStatuses = ['pending', 'delivered', 'pending_retry'];
  const unreadCount = alerts.filter(a => activeAlertStatuses.includes(a.status)).length;

  return (
    <div className="owner-shell">
      {/* Top Header */}
      <header className="owner-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
         <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><ShieldAlert size={20} color="var(--accent-color)"/> SmartVehicle Garage</h2>
         {profile?.name && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hi, {profile.name}</span>}
      </header>

      {/* Main Tab Content */}
      <main className="owner-main">
         {newAlertToast && (
           <div className="alert-toast fade-in" style={{ position: 'fixed', top: '20px', left: '20px', right: '20px', zIndex: 1000, background: 'var(--accent-color)', color: 'white', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Bell className="shake" size={24} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>New Vehicle Alert!</p>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>{newAlertToast.type.replace('_',' ')} reported</p>
              </div>
              <button onClick={() => { setActiveTab('alerts'); setNewAlertToast(null); }} style={{ background: 'white', color: 'var(--accent-color)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>View</button>
              <button onClick={() => setNewAlertToast(null)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '1.2rem', padding: '0.5rem', cursor: 'pointer' }}>×</button>
           </div>
         )}

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

             {notificationPermission !== 'granted' && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                 style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: '16px', padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
               >
                 <div style={{ background: '#f59e0b', padding: '0.75rem', borderRadius: '12px', color: 'white' }}>
                   <Bell size={24} />
                 </div>
                 <div style={{ flex: 1 }}>
                   <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#b45309' }}>Enable Live Notifications</h3>
                   <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#92400e' }}>Get instant push alerts when someone scans your car, even if the app is closed.</p>
                 </div>
                 <button onClick={enableNotifications} className="btn-primary" style={{ padding: '0.6rem 1.2rem', whiteSpace: 'nowrap' }}>
                   Enable Now
                 </button>
               </motion.div>
             )}

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
             <button onClick={() => setShowVehicleForm(true)} className="btn-primary" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
               <Plus size={16}/> Add Vehicle
             </button>

             {showVehicleForm && (
               <form onSubmit={saveVehicle} style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 <input type="text" placeholder="License plate" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} required />
                 <input type="text" placeholder="Vehicle name" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} />
                 <input type="text" placeholder="Make" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} />
                 <input type="text" placeholder="Model" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                   <button type="submit" className="btn-primary" style={{ padding: '0.75rem' }}>{editingVehicleId ? 'Save Changes' : 'Create Vehicle'}</button>
                   <button type="button" onClick={resetVehicleForm} className="btn-outline" style={{ padding: '0.75rem' }}>Cancel</button>
                 </div>
               </form>
             )}
             
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
                           <div style={{ display: 'flex', gap: '0.35rem' }}>
                             <button onClick={() => startEditVehicle(v)} className="btn-outline" style={{ padding: '0.4rem', border: 'none', width: 'auto' }} title="Edit vehicle">
                               <Edit3 size={16}/>
                             </button>
                             <button onClick={() => handleRegenerateQR(v.id)} className="btn-outline" style={{ padding: '0.4rem', border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)', width: 'auto' }} title="Invalidate old QR">
                               <RefreshCw size={16}/>
                             </button>
                             <button onClick={() => deleteVehicle(v.id)} className="btn-danger" style={{ padding: '0.4rem', border: 'none', width: 'auto' }} title="Delete vehicle">
                               <Trash2 size={16}/>
                             </button>
                           </div>
                        </div>
                        
                        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                           <div style={{ background: 'white', padding: '5px', borderRadius: '8px' }}>
                             <QRCode value={scanUrl} size={60} level={"L"} />
                           </div>
                           <div style={{ flex: 1 }}>
                               <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, marginBottom: '0.25rem' }}>SECURE ID TOKEN:</p>
                               <code style={{ fontSize: '0.7rem', wordBreak: 'break-all', display: 'block', color: 'var(--accent-color)', marginBottom: '1rem' }}>{v.qrToken}</code>
                               <button onClick={() => handleDownloadSticker(v)} className="btn-primary" style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', background: 'var(--accent-color)' }}>
                                  <Send size={14}/> Download Sticker
                               </button>
                           </div>
                           {/* Hidden QR for PDF Generation */}
                           <div className={`qr-hidden qr-hidden-${v.id}`} style={{ display: 'none' }}>
                               <QRCode value={scanUrl} size={256} />
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
             <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Live monitoring plus last 1 year alert history.</p>

             <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--surface-border)', marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
               <select value={historyVehicleId} onChange={(e) => setHistoryVehicleId(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }}>
                 <option value="">All vehicles</option>
                 {vehicles.map(v => <option key={v.id} value={v.id}>{v.licensePlate}</option>)}
               </select>
               <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }}>
                 <option value="">All statuses</option>
                 <option value="delivered">Delivered</option>
                 <option value="responded">Responded</option>
                 <option value="resolved">Resolved</option>
                 <option value="expired">Expired</option>
                 <option value="failed">Failed</option>
               </select>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                 <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                 <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
               </div>
               <button onClick={refreshHistory} className="btn-outline" style={{ padding: '0.75rem' }}>
                 <RefreshCw size={16}/> Apply History Filters
               </button>
             </div>
             
             {loadingData ? <div className="spinner"></div> : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {alerts.map(a => {
                    const isNew = activeAlertStatuses.includes(a.status);
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                             <button onClick={() => handleAlertResponse(a.id, 'on_my_way')} className="btn-primary" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                                On My Way
                             </button>
                             <button onClick={() => handleAlertResponse(a.id, 'call_me')} className="btn-outline" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                                <Phone size={14}/> Call Me
                             </button>
                             <button onClick={() => handleAlertResponse(a.id, 'will_take_time')} className="btn-outline" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                                <Clock size={14}/> Will Take Time
                             </button>
                             <button onClick={() => handleAlertResponse(a.id, 'not_my_vehicle')} className="btn-outline" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                                Not My Vehicle
                             </button>
                          </div>
                        )}
                        {a.status === 'pending_retry' && (
                          <div style={{ marginTop: '1rem', color: '#f59e0b', fontSize: '0.85rem' }}>
                            Notification retry queued after a delivery failure.
                          </div>
                        )}
                        {a.status === 'responded' && (
                          <>
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontSize: '0.85rem' }}>
                               <MessageCircle size={16}/> Responded ({a.ownerResponse?.replace(/_/g, ' ')})
                            </div>
                            <button onClick={() => handleAlertResponse(a.id, 'resolved')} className="btn-outline" style={{ padding: '0.6rem', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                              <CheckCircle2 size={16}/> Mark Resolved
                            </button>
                          </>
                        )}
                        {a.status === 'resolved' && (
                          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontSize: '0.85rem' }}>
                             <CheckCircle2 size={16}/> Resolved
                          </div>
                        )}
                        {a.status === 'expired' && (
                          <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                             Alert expired without a response.
                          </div>
                        )}
                     </div>
                 )})}
                 {alerts.length === 0 && <p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>No alerts found.</p>}
               </div>
             )}
           </div>
         )}

         {activeTab === 'profile' && (
           <div className="fade-in">
             <h1 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Profile</h1>
             <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                 {!editingProfile ? (
                   <>
                    <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>Authenticated as: <strong style={{color:'var(--text-primary)'}}>{user?.email}</strong></p>
                    <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <p style={{ margin: '0.2rem 0' }}>Name: <strong style={{color:'var(--text-primary)'}}>{profile?.name || 'Not Set'}</strong></p>
                      <p style={{ margin: '0.2rem 0' }}>Alert Phone: <strong style={{color:'var(--text-primary)'}}>{profile?.phoneNumber || 'Not Set'}</strong></p>
                      <p style={{ margin: '0.2rem 0' }}>Address: <strong style={{color:'var(--text-primary)'}}>{profile?.address || 'Not Set'}</strong></p>
                      <p style={{ margin: '0.2rem 0' }}>WhatsApp: <strong style={{color:'var(--text-primary)'}}>{profile?.whatsappNumber || 'Not Set'}</strong></p>
                    </div>
                    
                    <button onClick={() => {
                        setEditingProfile(true);
                        setEditName(profile?.name || '');
                        setEditPhone(profile?.phoneNumber || '');
                        setEditAddress(profile?.address || '');
                        setEditWhatsapp(profile?.whatsappNumber || '');
                        setEditAltPhone(profile?.alternativeNumber || '');
                      }} className="btn-outline" style={{ width: '100%', marginBottom: '1.5rem', padding: '0.8rem' }}>
                      <Settings size={16} /> Edit Profile Details
                    </button>
                   </>
                 ) : (
                   <div className="fade-in">
                     <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Edit Contact Profile</h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input type="text" placeholder="Full Name" value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} />
                        <input type="tel" placeholder="Primary alert phone (+919876543210)" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} />
                        <input type="text" placeholder="WhatsApp Number" value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} />
                        <input type="text" placeholder="Alternative Phone" value={editAltPhone} onChange={e => setEditAltPhone(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} />
                        <textarea placeholder="Physical Address" value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', minHeight: '80px' }} />
                     </div>
                     <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                        <button onClick={async () => {
                          try {
                            await authFetch('/profile', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: editName, phoneNumber: editPhone, address: editAddress, whatsappNumber: editWhatsapp, alternativeNumber: editAltPhone })
                            });
                            setEditingProfile(false);
                            loadProfile();
                          } catch(e: any) { alert(e.message || "Failed to save"); }
                        }} className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>Save</button>
                        <button onClick={() => setEditingProfile(false)} className="btn-outline" style={{ flex: 1, padding: '0.75rem' }}>Cancel</button>
                     </div>
                   </div>
                 )}
                
                {!editingProfile && (
                  <>
                     <h3 style={{ fontSize: '1rem', marginBottom: '1rem', marginTop: '1.5rem' }}>Notification Preferences</h3>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                       <input
                         type="checkbox"
                         style={{width: '20px', height: '20px'}}
                         checked={profile?.notificationPreferences?.push !== false}
                         onChange={async (e) => {
                           try {
                             await authFetch('/profile', {
                               method: 'PUT',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({ notificationPreferences: { ...profile?.notificationPreferences, push: e.target.checked } })
                             });
                             loadProfile();
                           } catch {}
                         }}
                       />
                       System Push Notifications
                     </label>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                       <input
                         type="checkbox"
                         style={{width: '20px', height: '20px'}}
                         checked={true}
                         disabled
                       />
                       Real-time Dashboard Alerts (Always On)
                     </label>

                     <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)', margin: '1.5rem 0' }} />
                     
                     <button onClick={handleLogout} className="btn-danger" style={{ width: '100%', padding: '1rem' }}>
                       <LogOut size={18} /> Logout Device
                     </button>
                   </>
                )}
             </div>
           </div>
         )}
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <nav className="owner-nav">
         <button className={activeTab==='dashboard' ? 'is-active' : ''} onClick={()=>setActiveTab('dashboard')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <LayoutDashboard size={22}/>
            <span style={{fontSize: '0.65rem'}}>Home</span>
         </button>
         <button className={activeTab==='vehicles' ? 'is-active' : ''} onClick={()=>setActiveTab('vehicles')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <Car size={22}/>
            <span style={{fontSize: '0.65rem'}}>Vehicles</span>
         </button>
         <button className={activeTab==='alerts' ? 'is-active' : ''} onClick={()=>setActiveTab('alerts')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', position: 'relative' }}>
            {unreadCount > 0 && <span style={{position:'absolute', top: '10px', right: '15px', background: 'var(--danger-color)', width: '10px', height: '10px', borderRadius: '50%'}}></span>}
            <Bell size={22}/>
            <span style={{fontSize: '0.65rem'}}>Alerts</span>
         </button>
         <button className={activeTab==='profile' ? 'is-active' : ''} onClick={()=>setActiveTab('profile')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <Settings size={22}/>
            <span style={{fontSize: '0.65rem'}}>Profile</span>
         </button>
      </nav>
    </div>
  );
}
