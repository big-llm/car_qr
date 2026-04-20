import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, User } from 'firebase/auth';
import { CarFront, AlertCircle, Phone, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
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

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States for strict Firebase OTP flow
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  
  // Options
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [alertSent, setAlertSent] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [ownerResponse, setOwnerResponse] = useState<string | null>(null);
  const [sendingStatus, setSendingStatus] = useState('');

  useEffect(() => {
    // 1. Intercept URL Hash / Search variables to extract cryptographic QR token natively
    const pathParts = window.location.pathname.split('/');
    let foundToken = new URLSearchParams(window.location.search).get('token');
    
    if (pathParts.includes('qr')) {
      foundToken = pathParts[pathParts.indexOf('qr') + 1];
    }

    if (foundToken) {
      setToken(foundToken);
      fetchVehicleInfo(foundToken);
    } else {
      setError("Invalid or missing QR Code Token.");
      setLoading(false);
    }

    // 2. Map Firebase Auto-Login Session Hook to persist the user session efficiently
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Poll for Owner Reaction
  useEffect(() => {
    let interval: any;
    if (activeAlertId && !ownerResponse && user) {
       interval = setInterval(async () => {
         try {
           const tokenObj = await user.getIdToken(true);
           const res = await fetch(`${API_BASE_URL}/qr/alert/${activeAlertId}/status`, {
             headers: { 'Authorization': `Bearer ${tokenObj}` }
           });
           if (!res.ok) return;
           const data = await res.json();
           if (data.status === 'responded') {
              setOwnerResponse(data.ownerResponse);
              clearInterval(interval);
           }
         } catch(e) {}
       }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeAlertId, ownerResponse, user]);

  const fetchVehicleInfo = async (qrToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/qr/${qrToken}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vehicle not securely registered.");
      setVehicle(data.vehicle);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google Invisible Recaptcha injection for Anti-Bot protection 
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return setError('Invalid phone number. Ensure you have the + Country Code (e.g., +15551234567).');
    
    setError('');
    setSendingStatus('Contacting Network...');
    try {
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to dispatch OTP. Make sure billing/Firebase Auth is strictly configured.");
      if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
      }
    } finally {
      setSendingStatus('');
    }
  };

  const verifyOTPAndSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setError('');
    setSendingStatus('Verifying Identity...');
    try {
      // Execute cryptographically sound OTP challenge against Firebase
      if (confirmationResult) {
         await confirmationResult.confirm(otp);
      }
      
      // If code was physically correct, Auth state validates seamlessly. Push the Alert payload.
      await executeAlert();
    } catch (err) {
      setError('Invalid 6-Digit Code. Please re-enter.');
      setSendingStatus('');
    }
  };

  const handleActionSelect = async (actionId: string) => {
    setSelectedAction(actionId);
    
    // Auto-Fast-Track logic for cached pre-verified profiles. 
    if (user) {
      setSendingStatus('Transmitting over secure channel...');
      await executeAlert(actionId);
    }
  };

  const executeAlert = async (actionToSend = selectedAction) => {
    setError('');
    let location = null;

    try {
      // Opt-in Geolocation tracking for better detailing
      if ("geolocation" in navigator) {
        try {
          const position: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = { lat: position.coords.latitude, lng: position.coords.longitude };
        } catch (e) {
          console.log("Location access denied or timed out.");
        }
      }

      // Wait physically to ensure the User Object is synced from the SDK cache.
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("A fatal authentication synchronization error occurred.");
      
      const jwtToken = await currentUser.getIdToken(true);

      const res = await fetch(`${API_BASE_URL}/qr/${token}/alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ 
          type: actionToSend,
          location: location 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("ACCESS REVOKED: You have been blocked for excessive activity.");
        }
        throw new Error(data.error);
      }

      setActiveAlertId(data.alertId);
      setAlertSent(true);
    } catch (err: any) {
      setError(err.message || 'Transmission blocked by network limits.');
      setSelectedAction('');
    } finally {
      setSendingStatus('');
    }
  };

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
        <p>Scanning Crypto Registry...</p>
      </div>
    );
  }

  // Fallback failure node 
  if (error && !vehicle) {
    return (
      <div className="container">
         <div style={{ textAlign: 'center', color: 'var(--danger-color)', marginBottom: '1rem' }}>
           <ShieldAlert size={48} />
         </div>
         <h1>Scan Unrecognized</h1>
         <p>{error}</p>
      </div>
    );
  }

  // Delivery confirmation
  if (alertSent) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center' }}>
         {ownerResponse ? (
           <div className="fade-in">
             <div style={{ color: 'var(--success-color)', marginBottom: '1rem' }}>
               <CarFront size={64} style={{ margin: '0 auto' }} />
             </div>
             <h1>Owner Responded!</h1>
             <p>The vehicle owner has replied to your alert:</p>
             <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid var(--success-color)', borderRadius: '12px', padding: '1.5rem', marginTop: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success-color)', textTransform: 'capitalize' }}>
                {ownerResponse.replace(/_/g, ' ')}
             </div>
             <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Thank you for keeping the community running smoothly.</p>
           </div>
         ) : (
           <div className="fade-in">
             <div style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>
               <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
             </div>
             <h1>Message Relayed!</h1>
             <p>The vehicle owner has been securely notified of the incident involving your alert.</p>
             
             <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', width: '32px', height: '32px', borderWidth: '3px' }}></div>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>Waiting for owner response...</p>
             </div>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="container fade-in">
      <div className="vehicle-info">
        <div className="vehicle-icon">
          <CarFront color="white" size={24} />
        </div>
        <div className="vehicle-details">
          <h2>{vehicle?.licensePlateMasked}</h2>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{vehicle?.vehicleName || 'Vehicle Identified'}</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block' }}>{vehicle?.make} {vehicle?.model}</span>
        </div>
      </div>

      <h1>Notify Owner</h1>
      <p style={{marginBottom: "1rem"}}>Select an incident code to instantly push a notification to this owner.</p>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {!selectedAction ? (
        <div className="action-grid fade-in">
          <button className="btn-danger" onClick={() => handleActionSelect('blocking_vehicle')}>
            <AlertCircle size={18} /> Blocking my car
          </button>
          <button className="btn-outline" onClick={() => handleActionSelect('blocking_road')}>
            Blocking the road
          </button>
          <button className="btn-outline" onClick={() => handleActionSelect('lights_on')}>
            Lights left on
          </button>
          <button className="btn-outline" onClick={() => handleActionSelect('emergency')}>
             Emergency / Damage
          </button>
        </div>
      ) : (
        <div className="fade-in">
          {!user ? (
            <form onSubmit={showOtpInput ? verifyOTPAndSendAlert : requestOTP} style={{ marginTop: "1rem" }}>
               <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>
                 Verify Identity
               </h3>
               <p style={{ fontSize: '0.85rem', marginTop: '-0.5rem', color: "var(--text-secondary)" }}>To eliminate spam, an automated text will verify your line.</p>
               
               {!showOtpInput ? (
                 <div className="input-group">
                   <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0 1rem', marginTop: '1rem' }}>
                      <Phone size={18} color="var(--text-secondary)" style={{marginRight: '0.5rem'}} />
                      <input 
                        type="tel" 
                        placeholder="+1 234 567 8900" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        style={{ border: 'none', background: 'transparent', padding: '1rem 0', width: '100%', fontSize: '1rem', outline: 'none', color: 'white' }}
                        autoFocus
                      />
                   </div>
                 </div>
               ) : (
                 <div className="input-group fade-in" style={{ marginTop: '1rem' }}>
                   <input 
                     type="number" 
                     placeholder="Enter 6-Digit Code" 
                     value={otp}
                     onChange={(e) => setOtp(e.target.value)}
                     style={{ padding: '1rem', borderRadius: '12px', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '8px' }}
                     autoFocus
                   />
                 </div>
               )}

               <div id="recaptcha-container"></div>
               
               <button className="btn-primary" disabled={!!sendingStatus} type="submit" style={{ marginTop: '1.5rem' }}>
                 {sendingStatus ? (
                    <><div className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}}></div> System Handoff...</>
                 ) : (
                    <><Send size={18} /> {showOtpInput ? 'Secure Verification' : 'Send Code'}</>
                 )}
               </button>
               
               {!sendingStatus && (
                 <button type="button" className="btn-outline" style={{ marginTop: '0.75rem', border: 'none', background: 'transparent' }} onClick={() => setSelectedAction('')}>
                   Cancel
                 </button>
               )}
            </form>
          ) : (
            <div className="loader" style={{ marginTop: "2rem" }}>
              <div className="spinner"></div>
              <p>{sendingStatus || "Securely channeling..."}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
