import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  CarFront, AlertCircle, Send, CheckCircle2, 
  ShieldAlert, History, User as UserIcon, 
  Scan, LogOut, ChevronRight, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Using relative routing through Express
const API_BASE_URL = '/api/scanner';

type Vehicle = {
  id: string;
  licensePlateMasked: string;
  vehicleName: string;
  make: string;
  model: string;
};

const getDeviceId = () => {
  const storageKey = 'scanner_device_id';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  localStorage.setItem(storageKey, next);
  return next;
};

// --- Animations Config ---
const springTransition = { type: "spring", stiffness: 100, damping: 20 } as const;
const fadeInVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 }
};

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'profile'>('scan');
  
  const [token, setToken] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data for History & Profile
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  // States for strict Firebase OTP flow
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  
  // Alert Status States
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [alertSent, setAlertSent] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [ownerResponse, setOwnerResponse] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [sendingStatus, setSendingStatus] = useState('');

  useEffect(() => {
    // 1. Extract QR token from URL
    const pathParts = window.location.pathname.split('/');
    let foundToken = new URLSearchParams(window.location.search).get('token');
    if (pathParts.includes('qr')) {
      foundToken = pathParts[pathParts.indexOf('qr') + 1];
    }

    if (foundToken) {
      setToken(foundToken);
      fetchVehicleInfo(foundToken);
      // Restore persisted alert state for this QR token
      const savedAlertId = sessionStorage.getItem(`alert_${foundToken}`);
      if (savedAlertId) {
        setActiveAlertId(savedAlertId);
        setAlertSent(true);
        setAlertStatus('pending');
      }
    } else {
      setLoading(false);
    }

    // 2. Auth State Listener
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser as AuthUser | null);
      if (currentUser) {
        persistScannerSession(currentUser as AuthUser).catch(() => {});
        loadScannerProfile();
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync data and check for active alerts on the current vehicle
  useEffect(() => {
    if (user) {
      if (activeTab === 'profile') loadScannerProfile();
      
      // Always load history to check for active alerts if we're on a vehicle page
      loadHistory().then(historyData => {
        if (historyData && vehicle && !activeAlertId) {
          const activeAlert = historyData.find((a: any) => 
            a.vehicleId === vehicle.id && 
            (a.status === 'pending' || a.status === 'responded')
          );
          if (activeAlert) {
            setActiveAlertId(activeAlert.id);
            setAlertSent(true);
            setAlertStatus(activeAlert.status);
            if (activeAlert.ownerResponse) setOwnerResponse(activeAlert.ownerResponse);
          }
        }
      });
    }
  }, [activeTab, user, vehicle]);

  // Real-time: Firestore onSnapshot + guaranteed polling in parallel
  useEffect(() => {
    if (!activeAlertId) return;

    const TERMINAL = ['responded', 'resolved', 'expired', 'failed'];

    const applyUpdate = (status: string, ownerResponse: string | null) => {
      setAlertStatus(status);
      if (ownerResponse) setOwnerResponse(ownerResponse);
      if (TERMINAL.includes(status) && token) {
        sessionStorage.removeItem(`alert_${token}`);
      }
    };

    // 1. Firestore onSnapshot — fires instantly when owner responds
    const unsubFirestore = onSnapshot(
      doc(db, 'alerts', activeAlertId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data: any = snapshot.data();
        applyUpdate(data.status, data.ownerResponse || null);
      },
      () => {} // silently ignore Firestore auth errors — polling covers it
    );

    // 2. HTTP polling — guaranteed fallback every 4 seconds, no auth needed
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/qr/alert/${activeAlertId}/public-status`);
        if (!res.ok) return;
        const data = await res.json();
        applyUpdate(data.status, data.ownerResponse || null);
        if (TERMINAL.includes(data.status)) clearInterval(pollInterval);
      } catch (_) {}
    };

    poll(); // immediate first check
    const pollInterval = setInterval(poll, 4000);

    return () => {
      unsubFirestore();
      clearInterval(pollInterval);
    };
  }, [activeAlertId, token]);

  // --- API Calls ---

  const persistScannerSession = async (currentUser: AuthUser) => {
    const jwtToken = await currentUser.getIdToken();
    await fetch(`${API_BASE_URL}/session`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${jwtToken}` }
    });
  };

  const loadScannerProfile = async () => {
    if (!user) return;
    try {
      const jwtToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/profile`, {
        headers: { "Authorization": `Bearer ${jwtToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {}
  };

  const loadHistory = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const jwtToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/history`, {
        headers: { "Authorization": `Bearer ${jwtToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        return data;
      }
    } catch (e) {} finally { setLoadingData(false); }
    return null;
  };

  const fetchVehicleInfo = async (qrToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/qr/${qrToken}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vehicle not registered.");
      setVehicle(data.vehicle);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Auth Flow ---

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return setError('Invalid phone number.');
    
    setError('');
    setSendingStatus('Contacting Network...');
    try {
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phone, (window as any).recaptchaVerifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
    } catch (err: any) {
      setError("Failed to dispatch OTP.");
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally { setSendingStatus(''); }
  };

  const verifyOTPAndSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setError('');
    setSendingStatus('Verifying Identity...');
    try {
      if (confirmationResult) {
         const credential = await confirmationResult.confirm(otp);
         await persistScannerSession(credential.user);
         await executeAlert();
      }
    } catch (err) {
      setError('Invalid 6-Digit Code.');
      setSendingStatus('');
    }
  };

  const handleActionSelect = async (actionId: string) => {
    setSelectedAction(actionId);
    if (user) {
      setSendingStatus('Transmitting...');
      await executeAlert(actionId);
    }
  };

  const executeAlert = async (actionToSend = selectedAction) => {
    setError('');
    let location = null;
    try {
      if ("geolocation" in navigator) {
        try {
          const position: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = { lat: position.coords.latitude, lng: position.coords.longitude };
        } catch (e) {}
      }

      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Authentication synchronization error.");
      const jwtToken = await currentUser.getIdToken(true);

      const res = await fetch(`${API_BASE_URL}/qr/${token || 'none'}/alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`,
          "X-Device-Id": getDeviceId()
        },
        body: JSON.stringify({ type: actionToSend, location })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActiveAlertId(data.alertId);
      setAlertSent(true);
      setAlertStatus('pending');
      // Persist so page refresh restores this state
      if (token) sessionStorage.setItem(`alert_${token}`, data.alertId);
    } catch (err: any) {
      setError(err.message || 'Transmission failed.');
      setSelectedAction('');
    } finally { setSendingStatus(''); }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setActiveTab('scan');
    setProfile(null);
    setHistory([]);
  };

  // --- Render Helpers ---

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="owner-shell">
      {/* Header Branding */}
      <header className="owner-topbar">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="admin-brand"
        >
          <div className="admin-brand-mark"><Scan size={20} /></div>
          <div>
            <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Scanner Portal</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Community Vehicle Guard</p>
          </div>
        </motion.div>
      </header>

      <main className="owner-main" style={{ paddingBottom: '5rem' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'scan' && (
            <motion.div 
              key="scan"
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springTransition}
              className="fade-in"
            >
              {!token ? (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                   <div className="vehicle-icon" style={{ margin: '0 auto 1.5rem' }}><Scan size={32} /></div>
                   <h3>Ready to Scan</h3>
                   <p>Point your camera at a SmartVehicle QR tag to contact the owner safely.</p>
                </div>
              ) : (
                <>
                  {vehicle && (
                    <div className="surface-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                       <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div className="vehicle-icon"><CarFront size={28} /></div>
                          <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{vehicle.licensePlateMasked}</h2>
                            <p style={{ margin: 0, opacity: 0.7 }}>{vehicle.make} {vehicle.model}</p>
                          </div>
                       </div>
                    </div>
                  )}

                  {!alertSent ? (
                    <div className="stack">
                      <div className="section-heading">
                        <p style={{ margin: 0, fontWeight: 700 }}>Select Issue Type</p>
                      </div>
                      <div className="action-grid">
                        {[
                          { id: 'blocking_vehicle', label: 'Blocking my vehicle', icon: <CarFront size={20}/> },
                          { id: 'blocking_road', label: 'Blocking the road', icon: <AlertCircle size={20}/> },
                          { id: 'lights_on', label: 'Lights left on', icon: <Activity size={20}/> },
                          { id: 'emergency', label: 'Urgent Emergency', icon: <ShieldAlert size={20}/> }
                        ].map((action) => (
                          <button
                            key={action.id}
                            disabled={!!sendingStatus}
                            onClick={() => handleActionSelect(action.id)}
                            className={`btn-outline ${selectedAction === action.id ? 'is-active' : ''}`}
                            style={{ justifyContent: 'flex-start', padding: '1.2rem' }}
                          >
                            {action.icon}
                            {action.label}
                            {selectedAction === action.id && <motion.div layoutId="active" className="badge-success" style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>Selected</motion.div>}
                          </button>
                        ))}
                      </div>

                      {selectedAction && !user && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="panel" 
                          style={{ marginTop: '1rem', border: '1px solid var(--accent-color)' }}
                        >
                          {!showOtpInput ? (
                            <form onSubmit={requestOTP}>
                              <h3 style={{ marginBottom: '0.5rem' }}>Identity Verification</h3>
                              <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Enter your phone to send this alert safely.</p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                  type="tel" 
                                  placeholder="+91..." 
                                  value={phone} 
                                  onChange={(e) => setPhone(e.target.value)} 
                                  style={{ flex: 1 }}
                                />
                                <button type="submit" disabled={!!sendingStatus} className="btn-primary" style={{ width: 'auto' }}>
                                  <ChevronRight size={20} />
                                </button>
                              </div>
                            </form>
                          ) : (
                            <form onSubmit={verifyOTPAndSendAlert}>
                              <h3 style={{ marginBottom: '0.5rem' }}>Verification Code</h3>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                  type="number" 
                                  placeholder="6-digit OTP" 
                                  value={otp} 
                                  onChange={(e) => setOtp(e.target.value)} 
                                  style={{ flex: 1 }}
                                />
                                <button type="submit" disabled={!!sendingStatus} className="btn-primary" style={{ width: 'auto' }}>
                                  <Send size={18} />
                                </button>
                              </div>
                            </form>
                          )}
                        </motion.div>
                      )}
                    </div >
                  ) : (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={springTransition}
                      className="stack"
                    >
                      {/* Vehicle context strip */}
                      {vehicle && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                          <CarFront size={16} color="var(--text-secondary)" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{vehicle.licensePlateMasked}</span>
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{vehicle.make} {vehicle.model}</span>
                        </div>
                      )}

                      {/* Main status card */}
                      <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
                        <AnimatePresence mode="wait">
                          {alertStatus === 'responded' || alertStatus === 'resolved' ? (
                            <motion.div key="responded" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springTransition}>
                              <div style={{ width: '64px', height: '64px', background: 'var(--success-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <CheckCircle2 size={30} color="var(--success-color)" />
                              </div>
                              <h2 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>Owner Responded</h2>
                              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>The vehicle owner has acknowledged your alert.</p>
                              {ownerResponse && (
                                <div style={{ marginTop: '1.25rem', padding: '0.9rem 1.2rem', background: 'var(--success-soft)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--success-color)' }}>
                                  {ownerResponse.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  if (token) sessionStorage.removeItem(`alert_${token}`);
                                  setAlertSent(false);
                                  setSelectedAction('');
                                  setActiveAlertId(null);
                                  setOwnerResponse(null);
                                  setAlertStatus(null);
                                }}
                                className="btn-outline"
                                style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}
                              >
                                Send Another Alert
                              </button>
                            </motion.div>
                          ) : alertStatus === 'expired' ? (
                            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <div style={{ width: '64px', height: '64px', background: 'var(--warning-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <AlertCircle size={30} color="var(--warning-color)" />
                              </div>
                              <h2 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>Alert Expired</h2>
                              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>No response was received within the time window.</p>
                              <button
                                onClick={() => {
                                  if (token) sessionStorage.removeItem(`alert_${token}`);
                                  setAlertSent(false);
                                  setSelectedAction('');
                                  setActiveAlertId(null);
                                  setAlertStatus(null);
                                }}
                                className="btn-primary"
                                style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}
                              >
                                Send New Alert
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 1.25rem' }}>
                                <motion.div
                                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-soft)' }}
                                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                />
                                <div style={{ position: 'relative', width: '64px', height: '64px', background: 'var(--accent-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Send size={26} color="var(--accent-color)" />
                                </div>
                              </div>
                              <h2 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>Alert Transmitted</h2>
                              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Waiting for the owner to respond. Stay nearby.</p>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginTop: '1.5rem', padding: '0.75rem 1.25rem', background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                                <motion.div
                                  style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}
                                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Awaiting Owner Response</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Bottom portal hint */}
                      {user && (
                        <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                          <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', width: 'auto', padding: '0.5rem' }}>
                            View your alert history
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springTransition}
            >
              <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>My Activity</h1>
              {loadingData ? <div className="spinner"></div> : (
                <div className="stack">
                   {history.map((h, i) => (
                     <motion.div 
                       key={h.id}
                       initial={{ opacity: 0, x: -10 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: i * 0.05 }}
                       className="surface-card" 
                       style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
                     >
                        <div style={{ background: h.status === 'responded' ? 'var(--success-soft)' : 'rgba(0,0,0,0.05)', padding: '0.75rem', borderRadius: '10px' }}>
                           <CarFront size={18} color={h.status === 'responded' ? 'var(--success-color)' : 'var(--text-secondary)'} />
                        </div>
                        <div style={{ flex: 1 }}>
                           <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{h.type.replace('_',' ')}</p>
                           <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>{new Date(h.timestamp).toLocaleDateString()} • {h.status}</p>
                        </div>
                        <ChevronRight size={16} opacity={0.3} />
                     </motion.div>
                   ))}
                   {history.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No past alerts recorded.</p>}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springTransition}
            >
              <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Scanner Profile</h1>
              <div className="panel stack">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '56px', height: '56px', background: 'var(--accent-color)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                       {profile?.name ? profile.name[0].toUpperCase() : <UserIcon />}
                    </div>
                    <div>
                       <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{profile?.name || 'Scanner Buddy'}</h2>
                       <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>{user?.phoneNumber}</p>
                    </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div className="metric-card" style={{ padding: '1rem', textAlign: 'center' }}>
                       <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Total Scans</p>
                       <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{profile?.totalScans || 0}</p>
                    </div>
                    <div className="metric-card" style={{ padding: '1rem', textAlign: 'center' }}>
                       <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Status</p>
                       <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--success-color)' }}>Verified</p>
                    </div>
                 </div>

                 <button onClick={handleLogout} className="btn-danger" style={{ marginTop: '1rem' }}>
                    <LogOut size={18} /> Logout Session
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="notice notice-danger" style={{ marginTop: '1rem' }}>
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}
      </main>

      {/* Bottom Navigation */}
      {user && (
        <nav className="owner-nav">
          <button 
            className={activeTab === 'scan' ? 'is-active' : ''} 
            onClick={() => setActiveTab('scan')}
          >
            <Scan size={20} />
            <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>Scan</span>
          </button>
          <button 
            className={activeTab === 'history' ? 'is-active' : ''} 
            onClick={() => setActiveTab('history')}
          >
            <History size={20} />
            <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>History</span>
          </button>
          <button 
            className={activeTab === 'profile' ? 'is-active' : ''} 
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={20} />
            <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>Profile</span>
          </button>
        </nav>
      )}

      <div id="recaptcha-container"></div>
    </div>
  );
}

export default App;
