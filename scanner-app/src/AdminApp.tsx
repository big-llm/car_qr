import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, LogIn, Users, Plus, LogOut, Car, 
  LayoutDashboard, QrCode as QrIcon, Bell, Trash2, RefreshCw
} from 'lucide-react';
import QRCode from 'react-qr-code';
import './App.css';

const API_BASE_URL = '/api/admin';

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'scanners' | 'vehicles' | 'qrcodes' | 'alerts'>('dashboard');

  // Shared Data States
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [scanners, setScanners] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({ totalUsers: 0, totalVehicles: 0, totalAlerts: 0 });

  // Load Data
  useEffect(() => {
    if (token) {
      if (activeTab === 'dashboard') fetchMetrics();
      if (activeTab === 'users' || activeTab === 'vehicles') fetchUsers(); // Need users for vehicle assignment
      if (activeTab === 'scanners') fetchScanners();
      if (activeTab === 'vehicles' || activeTab === 'qrcodes') fetchVehicles();
      if (activeTab === 'alerts') fetchAlerts();
    }
  }, [token, activeTab]);

  const authFetch = async (url: string, options: any = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) { handleLogout(); throw new Error("Session expired"); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setToken(data.token);
      localStorage.setItem("admin_token", data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("admin_token");
    setUsers([]);
    setVehicles([]);
    setAlerts([]);
  };

  // === DATA FETCHERS ===
  const fetchMetrics = async () => {
    try { setMetrics(await authFetch(`${API_BASE_URL}/dashboard-metrics`)); } catch(e) { console.error(e); }
  };
  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await authFetch(`${API_BASE_URL}/users`)); } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const fetchScanners = async () => {
    setLoading(true);
    try { setScanners(await authFetch(`${API_BASE_URL}/scanners`)); } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const fetchVehicles = async () => {
    setLoading(true);
    try { setVehicles(await authFetch(`${API_BASE_URL}/vehicles`)); } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const fetchAlerts = async () => {
    setLoading(true);
    try { setAlerts(await authFetch(`${API_BASE_URL}/alerts`)); } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // === ACTIONS ===
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch(`${API_BASE_URL}/users`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: newPhone, name: newName })
      });
      setNewPhone(''); setNewName('');
      fetchUsers();
    } catch(err: any) { alert(err.message); }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await authFetch(`${API_BASE_URL}/users/${userId}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      fetchUsers();
    } catch(err: any) { alert(err.message); }
  };

  const [newVehUser, setNewVehUser] = useState('');
  const [newVehPlate, setNewVehPlate] = useState('');
  const [newVehMake, setNewVehMake] = useState('');
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch(`${API_BASE_URL}/vehicles`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newVehUser, licensePlate: newVehPlate, make: newVehMake, model: "" })
      });
      setNewVehUser(''); setNewVehPlate(''); setNewVehMake('');
      fetchVehicles();
    } catch(err: any) { alert(err.message); }
  };

  const deleteVehicle = async (vehId: string) => {
    if(!window.confirm("Are you sure?")) return;
    try {
      await authFetch(`${API_BASE_URL}/vehicles/${vehId}`, { method: "DELETE" });
      fetchVehicles();
    } catch(err: any) { alert(err.message); }
  };

  const regenerateQR = async (vehId: string) => {
    if(!window.confirm("This will invalidate the old QR code physically printed. Continue?")) return;
    try {
      await authFetch(`${API_BASE_URL}/vehicles/${vehId}/qr-regenerate`, { method: "PUT" });
      fetchVehicles();
    } catch(err: any) { alert(err.message); }
  };


  // === LOGIN SCREEN ===
  if (!token) {
    return (
      <div className="container fade-in">
         <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
           <ShieldCheck size={48} style={{ margin: '0 auto' }} />
         </div>
         <h1>Admin Control Panel</h1>
         
         {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
         
         <form onSubmit={handleLogin}>
           <div className="input-group">
             <label>Administrator ID</label>
             <input type="text" value={userid} onChange={e => setUserid(e.target.value)} required />
           </div>
           <div className="input-group">
             <label>Secure Password</label>
             <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
           </div>
           <button className="btn-primary" type="submit"><LogIn size={18} /> Enter System</button>
         </form>
      </div>
    );
  }

  // === MAIN DASHBOARD LAYOUT ===
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', background: 'var(--background-color)', color: 'white' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '260px', background: 'rgba(15, 23, 42, 0.8)', borderRight: '1px solid var(--surface-border)', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '2.5rem', color: 'var(--accent-color)' }}>
          <ShieldCheck /> Smart Admin
        </h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('dashboard')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <LayoutDashboard size={18}/> Dashboard
          </button>
          <button className={activeTab === 'users' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('users')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <Users size={18}/> Vehicle Owners
          </button>
          <button className={activeTab === 'scanners' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('scanners')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <ShieldCheck size={18}/> Public Scanners
          </button>
          <button className={activeTab === 'vehicles' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('vehicles')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <Car size={18}/> Vehicles
          </button>
          <button className={activeTab === 'qrcodes' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('qrcodes')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <QrIcon size={18}/> QR Codes (Print)
          </button>
          <button className={activeTab === 'alerts' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveTab('alerts')} style={{ textAlign: 'left', display: 'flex', gap: '0.75rem', border: 'none' }}>
            <Bell size={18}/> Alert Monitoring
          </button>
        </nav>

        <button onClick={handleLogout} className="btn-danger" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <LogOut size={16} /> Secure Logout
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
        
        {/* DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '2rem' }}>Platform Overview</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
               <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                 <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={18}/> Registered Users</p>
                 <h2 style={{ fontSize: '2.5rem' }}>{metrics.totalUsers}</h2>
               </div>
               <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                 <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Car size={18}/> Total Vehicles</p>
                 <h2 style={{ fontSize: '2.5rem' }}>{metrics.totalVehicles}</h2>
               </div>
               <div style={{ background: 'var(--surface-color)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
                 <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={18}/> Alerts Processed</p>
                 <h2 style={{ fontSize: '2.5rem' }}>{metrics.totalAlerts}</h2>
               </div>
            </div>
          </div>
        )}

        {/* USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '2rem' }}>Registered Vehicle Owners</h1>
            
            <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--surface-border)' }}>
              <h3>Register New User</h3>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <input type="text" placeholder="Owner Name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }} required/>
                <input type="tel" placeholder="Phone Number (+1234567890)" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }} required/>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}><Plus size={16}/> Add User</button>
              </form>
            </div>

            {loading ? <div className="spinner"></div> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'var(--surface-color)', borderRadius: '12px', overflow: 'hidden' }}>
                 <thead>
                   <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                     <th style={{ padding: '1rem' }}>User Name</th>
                     <th style={{ padding: '1rem' }}>Phone Number</th>
                     <th style={{ padding: '1rem' }}>Joined</th>
                     <th style={{ padding: '1rem' }}>Status</th>
                     <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {users.map(u => (
                     <tr key={u.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                       <td style={{ padding: '1rem' }}>{u.name || '-'}</td>
                       <td style={{ padding: '1rem' }}>{u.phoneNumber}</td>
                       <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                       <td style={{ padding: '1rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: u.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: u.status === 'active' ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '0.8rem' }}>{u.status}</span>
                       </td>
                       <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button onClick={() => toggleUserStatus(u.id, u.status)} className="btn-outline" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: 'none' }}>
                            {u.status === 'active' ? 'Block Access' : 'Unblock'}
                          </button>
                       </td>
                     </tr>
                   ))}
                   {users.length === 0 && <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>No users found</td></tr>}
                 </tbody>
              </table>
            )}
          </div>
        )}

        {/* SCANNERS MANAGEMENT */}
        {activeTab === 'scanners' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '2rem' }}>Public Scanner Registry</h1>
            
            <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--surface-border)' }}>
               <p style={{ color: 'var(--text-secondary)' }}>This array tracks individuals who have securely authenticated via OTP to push an alert. They do not have access to properties.</p>
            </div>

            {loading ? <div className="spinner"></div> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'var(--surface-color)', borderRadius: '12px', overflow: 'hidden' }}>
                 <thead>
                   <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                     <th style={{ padding: '1rem' }}>Phone Number</th>
                     <th style={{ padding: '1rem' }}>Total Alerts Triggered</th>
                     <th style={{ padding: '1rem' }}>Last Scanned Date</th>
                     <th style={{ padding: '1rem' }}>Account Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {scanners.map(s => (
                     <tr key={s.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                       <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>{s.phoneNumber}</td>
                       <td style={{ padding: '1rem' }}>{s.totalScans} events</td>
                       <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(s.lastScan).toLocaleString()}</td>
                       <td style={{ padding: '1rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: s.status === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: s.status === 'blocked' ? '#ef4444' : '#10b981', borderRadius: '4px', fontSize: '0.8rem' }}>
                             {s.status === 'blocked' ? 'BANNED' : 'CLEAN'}
                          </span>
                       </td>
                     </tr>
                   ))}
                   {scanners.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>No public scanners recorded</td></tr>}
                 </tbody>
              </table>
            )}
          </div>
        )}

        {/* VEHICLES MANAGEMENT */}
        {activeTab === 'vehicles' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '2rem' }}>Vehicle Fleet</h1>
            
            <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--surface-border)' }}>
              <h3>Register & Assign Vehicle</h3>
              <form onSubmit={handleCreateVehicle} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
                <select value={newVehUser} onChange={e => setNewVehUser(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'transparent', color: 'white', border: '1px solid var(--surface-border)' }} required>
                  <option value="" disabled>Select Owner...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.phoneNumber}</option>)}
                </select>
                <input type="text" placeholder="License Plate" value={newVehPlate} onChange={e => setNewVehPlate(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }} required/>
                <input type="text" placeholder="Make/Model (Optional)" value={newVehMake} onChange={e => setNewVehMake(e.target.value)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }}/>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}><Plus size={16}/> Register Vehicle</button>
              </form>
            </div>

            {loading ? <div className="spinner"></div> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'var(--surface-color)', borderRadius: '12px', overflow: 'hidden' }}>
                 <thead>
                   <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                     <th style={{ padding: '1rem' }}>Plate Number</th>
                     <th style={{ padding: '1rem' }}>Owner ID</th>
                     <th style={{ padding: '1rem' }}>QR Security</th>
                     <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {vehicles.map(v => {
                     const owner = users.find(u => u.id === v.userId);
                     return (
                     <tr key={v.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                       <td style={{ padding: '1rem', fontWeight: 'bold' }}>{v.licensePlate} <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal', display: 'block'}}>{v.make}</span></td>
                       <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{owner ? (owner.name || owner.phoneNumber) : v.userId}</td>
                       <td style={{ padding: '1rem' }}>
                         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '0.3rem', borderRadius: '4px', fontFamily: 'monospace' }}>{v.qrToken.split('-')[0]}***</span>
                            <button onClick={() => regenerateQR(v.id)} className="btn-outline" style={{ padding: '0.3rem', width: 'auto', border: 'none' }} title="Invalidate and cycle new Token"><RefreshCw size={14}/></button>
                         </div>
                       </td>
                       <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button onClick={() => deleteVehicle(v.id)} className="btn-danger" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: 'none' }}>
                            <Trash2 size={14} /> Remove
                          </button>
                       </td>
                     </tr>
                   )})}
                   {vehicles.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>No vehicles found</td></tr>}
                 </tbody>
              </table>
            )}
          </div>
        )}

        {/* QR CODES (PRINT HUB) */}
        {activeTab === 'qrcodes' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '2rem' }}>QR Print & Distribution Hub</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Download official vehicle QR tags below.</p>
            
            {loading ? <div className="spinner"></div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {vehicles.map(v => {
                   const scanUrl = `${window.location.protocol}//${window.location.host}/qr/${v.qrToken}`;
                   return (
                     <div key={v.id} style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', color: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <div style={{ background: 'white', padding: '10px', borderRadius: '12px' }}>
                          <QRCode value={scanUrl} size={150} level={"H"} />
                        </div>
                        <h3 style={{ marginTop: '1rem', fontSize: '1.2rem', letterSpacing: '2px' }}>{v.licensePlate}</h3>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', wordBreak: 'break-all', marginTop: '0.5rem' }}>{v.qrToken}</p>
                        <button className="btn-outline" style={{ marginTop: '1rem', borderColor: '#0f172a', color: '#0f172a', padding: '0.5rem' }} onClick={() => {
                          const svg = document.getElementById(`qr-${v.id}`);
                          if(svg) { /* HTML5 Download SVG logic could be injected here, but for MVP print screen works */ window.print() }
                        }}>
                          Print Sticker
                        </button>
                     </div>
                   )
                })}
              </div>
            )}
          </div>
        )}

        {/* ALERTS MONITORING */}
        {activeTab === 'alerts' && (
           <div className="fade-in">
             <h1 style={{ marginBottom: '2rem' }}>Real-time Alert Activity</h1>
             
             {loading ? <div className="spinner"></div> : (
               <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'var(--surface-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '1rem' }}>Timestamp</th>
                      <th style={{ padding: '1rem' }}>Alert Type</th>
                      <th style={{ padding: '1rem' }}>Vehicle Ref</th>
                      <th style={{ padding: '1rem' }}>Full Sender ID</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(a.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '1rem' }}>
                           <span style={{ padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.1)', borderRadius: '15px', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                              {a.type.replace('_', ' ')}
                           </span>
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{a.vehicleId.slice(0,6)}...</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{a.senderPhone}</td>
                        <td style={{ padding: '1rem' }}>
                           <span style={{ padding: '0.2rem 0.5rem', background: a.status === 'delivered' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: a.status === 'delivered' ? '#10b981' : '#f59e0b', borderRadius: '4px', fontSize: '0.8rem' }}>
                             {a.status.toUpperCase()}
                           </span>
                        </td>
                      </tr>
                    ))}
                    {alerts.length === 0 && <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>No alert history yet</td></tr>}
                  </tbody>
               </table>
             )}
           </div>
        )}
      </main>
    </div>
  );
}
