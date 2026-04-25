import React, { useEffect, useState } from 'react';
import {
  Bell,
  Car,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  QrCode as QrIcon,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users
} from 'lucide-react';
import QRCode from 'react-qr-code';
import './App.css';

const API_BASE_URL = '/api/admin';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Vehicle Owners', icon: Users },
  { id: 'scanners', label: 'Public Scanners', icon: ShieldCheck },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'qrcodes', label: 'QR Codes', icon: QrIcon },
  { id: 'alerts', label: 'Alert Monitoring', icon: Bell }
] as const;

type TabId = typeof tabs[number]['id'];

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [scanners, setScanners] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalUsers: 0,
    totalVehicles: 0,
    totalAlerts: 0,
    activeAlerts: 0,
    failedAlerts: 0,
    pendingNotificationRetries: 0,
    mostReportedVehicles: [],
    peakUsageHours: []
  });
  const [userQuery, setUserQuery] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newAltPhone, setNewAltPhone] = useState('');
  const [newVehUser, setNewVehUser] = useState('');
  const [newVehPlate, setNewVehPlate] = useState('');
  const [newVehMake, setNewVehMake] = useState('');
  const [newVehName, setNewVehName] = useState('');

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'dashboard') fetchMetrics();
    if (activeTab === 'users' || activeTab === 'vehicles') fetchUsers(userQuery);
    if (activeTab === 'scanners') fetchScanners();
    if (activeTab === 'vehicles' || activeTab === 'qrcodes') fetchVehicles(vehicleQuery);
    if (activeTab === 'alerts') fetchAlerts();
  }, [token, activeTab, userQuery, vehicleQuery]);

  const authFetch = async (url: string, options: any = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      localStorage.setItem('admin_token', data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('admin_token');
    setUsers([]);
    setScanners([]);
    setVehicles([]);
    setAlerts([]);
  };

  const fetchMetrics = async () => {
    try {
      setMetrics(await authFetch(`${API_BASE_URL}/dashboard-metrics`));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async (q = '') => {
    setLoading(true);
    try {
      setUsers(await authFetch(`${API_BASE_URL}/users?q=${encodeURIComponent(q)}`));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchScanners = async () => {
    setLoading(true);
    try {
      setScanners(await authFetch(`${API_BASE_URL}/scanners`));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async (q = '') => {
    setLoading(true);
    try {
      setVehicles(await authFetch(`${API_BASE_URL}/vehicles?q=${encodeURIComponent(q)}`));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      setAlerts(await authFetch(`${API_BASE_URL}/alerts`));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newOwnerPassword,
          phoneNumber: newPhone,
          name: newName,
          address: newAddress,
          whatsappNumber: newWhatsapp,
          alternativeNumber: newAltPhone
        })
      });
      setNewEmail('');
      setNewOwnerPassword('');
      setNewPhone('');
      setNewName('');
      setNewAddress('');
      setNewWhatsapp('');
      setNewAltPhone('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await authFetch(`${API_BASE_URL}/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch(`${API_BASE_URL}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newVehUser,
          licensePlate: newVehPlate,
          vehicleName: newVehName,
          make: newVehMake,
          model: ''
        })
      });
      setNewVehUser('');
      setNewVehPlate('');
      setNewVehMake('');
      setNewVehName('');
      fetchVehicles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteVehicle = async (vehId: string) => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      await authFetch(`${API_BASE_URL}/vehicles/${vehId}`, { method: 'DELETE' });
      fetchVehicles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const regenerateQR = async (vehId: string) => {
    if (!window.confirm('Invalidate the old QR code and generate a new one?')) return;
    try {
      await authFetch(`${API_BASE_URL}/vehicles/${vehId}/qr-regenerate`, { method: 'PUT' });
      fetchVehicles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="container fade-in">
          <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--accent-color)' }}>
            <ShieldCheck size={48} style={{ margin: '0 auto' }} />
          </div>
          <h1>Admin Control Panel</h1>
          <p style={{ textAlign: 'center', marginBottom: '1.75rem' }}>Secure access for platform operations, abuse monitoring, and owner management.</p>
          {error && <div className="notice notice-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Administrator ID</label>
              <input type="text" value={userid} onChange={(e) => setUserid(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Secure Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit"><LogIn size={18} /> Enter System</button>
          </form>
        </div>
      </div>
    );
  }

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2>SmartVehicle Admin</h2>
            <p>Operations, trust, and realtime monitoring</p>
          </div>
        </div>

        <nav className="admin-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <button onClick={handleLogout} className="btn-danger">
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <div>
            <h1>{activeTabLabel}</h1>
            <p>Readable, responsive controls for the whole platform.</p>
          </div>
        </div>

        <div className="admin-content">
          {activeTab === 'dashboard' && (
            <>
              <div className="metric-grid fade-in">
                <div className="metric-card">
                  <div className="metric-label"><Users size={18} /> Registered Users</div>
                  <div className="metric-value">{metrics.totalUsers}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Car size={18} /> Total Vehicles</div>
                  <div className="metric-value">{metrics.totalVehicles}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Bell size={18} /> Alerts Processed</div>
                  <div className="metric-value">{metrics.totalAlerts}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Bell size={18} /> Active Alerts</div>
                  <div className="metric-value">{metrics.activeAlerts}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><RefreshCw size={18} /> Pending Retries</div>
                  <div className="metric-value">{metrics.pendingNotificationRetries}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><ShieldCheck size={18} /> Failed Alerts</div>
                  <div className="metric-value">{metrics.failedAlerts}</div>
                </div>
              </div>

              <div className="panel-grid fade-in">
                <div className="panel">
                  <h3>Most Reported Vehicles</h3>
                  {metrics.mostReportedVehicles?.length ? (
                    metrics.mostReportedVehicles.map((item: any) => (
                      <div key={item.vehicleId} className="panel-row">
                        <code>{item.vehicleId}</code>
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No alert history yet.</div>
                  )}
                </div>

                <div className="panel">
                  <h3>Peak Usage Hours</h3>
                  {metrics.peakUsageHours?.length ? (
                    metrics.peakUsageHours.map((item: any) => (
                      <div key={item.hour} className="panel-row">
                        <span className="subtle">{String(item.hour).padStart(2, '0')}:00</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No hourly usage yet.</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <div className="fade-in stack">
              <div className="toolbar">
                <div className="search-field">
                  <input type="text" placeholder="Search by name, email, phone, or address" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                </div>
              </div>

              <div className="form-card">
                <h3>Register New Owner</h3>
                <form onSubmit={handleCreateUser} className="form-grid">
                  <input type="text" placeholder="Owner name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  <input type="email" placeholder="Owner login email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                  <input type="password" placeholder="Temporary password" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} minLength={6} required />
                  <input type="tel" placeholder="Primary phone (+1234567890)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
                  <input type="text" placeholder="WhatsApp number" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} />
                  <input type="text" placeholder="Alternative phone" value={newAltPhone} onChange={(e) => setNewAltPhone(e.target.value)} />
                  <input className="span-2" type="text" placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
                  <button className="btn-primary span-2" type="submit"><Plus size={16} /> Add User</button>
                </form>
              </div>

              <div className="table-card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User Info</th>
                        <th>Contact Channels</th>
                        <th>Address</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.name || '-'}</strong>
                            {u.email && <div className="subtle" style={{ marginTop: '0.25rem' }}>{u.email}</div>}
                            <div className="subtle" style={{ marginTop: '0.25rem' }}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td>
                            <div>P: {u.phoneNumber}</div>
                            {u.whatsappNumber && <div className="subtle">W: {u.whatsappNumber}</div>}
                            {u.alternativeNumber && <div className="subtle">A: {u.alternativeNumber}</div>}
                          </td>
                          <td className="subtle">{u.address || '-'}</td>
                          <td>
                            <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{u.status}</span>
                          </td>
                          <td>
                            <button onClick={() => toggleUserStatus(u.id, u.status)} className="btn-outline icon-button" style={{ width: 'auto', paddingInline: '0.9rem' }}>
                              {u.status === 'active' ? 'Block' : 'Unblock'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!loading && users.length === 0 && <div className="empty-state">No users found.</div>}
              </div>
            </div>
          )}

          {activeTab === 'scanners' && (
            <div className="fade-in stack">
              <div className="panel">
                <h3>Public Scanner Registry</h3>
                <p>Tracks verified scanners who have authenticated with OTP and sent alerts through the public flow.</p>
              </div>

              <div className="table-card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Phone Number</th>
                        <th>Total Alerts Triggered</th>
                        <th>Last Scanned</th>
                        <th>Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanners.map((s) => (
                        <tr key={s.id}>
                          <td className="mono">{s.phoneNumber}</td>
                          <td>{s.totalScans} events</td>
                          <td className="subtle">{new Date(s.lastScan).toLocaleString()}</td>
                          <td><span className={`badge ${s.status === 'blocked' ? 'badge-danger' : 'badge-success'}`}>{s.status === 'blocked' ? 'Banned' : 'Clean'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!loading && scanners.length === 0 && <div className="empty-state">No public scanners recorded.</div>}
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="fade-in stack">
              <div className="toolbar">
                <div className="search-field">
                  <input type="text" placeholder="Search by plate, name, or make" value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} />
                </div>
              </div>

              <div className="form-card">
                <h3>Register and Assign Vehicle</h3>
                <form onSubmit={handleCreateVehicle} className="form-grid">
                  <select value={newVehUser} onChange={(e) => setNewVehUser(e.target.value)} required>
                    <option value="">Select owner</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.phoneNumber}</option>)}
                  </select>
                  <input type="text" placeholder="Vehicle name" value={newVehName} onChange={(e) => setNewVehName(e.target.value)} />
                  <input type="text" placeholder="License plate" value={newVehPlate} onChange={(e) => setNewVehPlate(e.target.value)} required />
                  <input type="text" placeholder="Make or model" value={newVehMake} onChange={(e) => setNewVehMake(e.target.value)} />
                  <button className="btn-primary span-2" type="submit"><Plus size={16} /> Register Vehicle</button>
                </form>
              </div>

              <div className="table-card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Plate Number</th>
                        <th>Owner</th>
                        <th>QR Security</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => {
                        const owner = users.find((u) => u.id === v.userId);
                        return (
                          <tr key={v.id}>
                            <td>
                              <strong>{v.licensePlate}</strong>
                              <div className="subtle" style={{ marginTop: '0.25rem' }}>{v.vehicleName || 'Generic Vehicle'}</div>
                              <div className="subtle">{v.make}</div>
                            </td>
                            <td className="subtle">{owner ? (owner.name || owner.phoneNumber) : v.userId}</td>
                            <td>
                              <span className="badge badge-neutral mono">{v.qrToken.split('-')[0]}***</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <button onClick={() => regenerateQR(v.id)} className="btn-outline icon-button" style={{ width: 'auto', paddingInline: '0.9rem' }}><RefreshCw size={14} /> Reset QR</button>
                                <button onClick={() => deleteVehicle(v.id)} className="btn-danger icon-button" style={{ width: 'auto', paddingInline: '0.9rem' }}><Trash2 size={14} /> Remove</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!loading && vehicles.length === 0 && <div className="empty-state">No vehicles found.</div>}
              </div>
            </div>
          )}

          {activeTab === 'qrcodes' && (
            <div className="fade-in stack">
              <div className="panel">
                <h3>QR Print Hub</h3>
                <p>Download or print official vehicle QR tags for onboarding and sticker replacement.</p>
              </div>
              <div className="panel-grid">
                {vehicles.map((v) => {
                  const scanUrl = `${window.location.protocol}//${window.location.host}/qr/${v.qrToken}`;
                  return (
                    <div key={v.id} className="panel" style={{ textAlign: 'center' }}>
                      <div style={{ background: '#fff', borderRadius: '18px', padding: '1rem', display: 'inline-flex' }}>
                        <QRCode value={scanUrl} size={150} level="H" />
                      </div>
                      <h3 style={{ marginTop: '1rem' }}>{v.licensePlate}</h3>
                      <p className="subtle" style={{ wordBreak: 'break-all' }}>{v.qrToken}</p>
                      <button className="btn-outline" onClick={() => window.print()}>Print Sticker</button>
                    </div>
                  );
                })}
              </div>
              {!loading && vehicles.length === 0 && <div className="empty-state surface-card">No vehicles available for printing.</div>}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="fade-in stack">
              <div className="panel">
                <h3>Realtime Alert Activity</h3>
                <p>Monitor sender context, alert type, owner delivery status, and escalation patterns.</p>
              </div>

              <div className="table-card">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Alert Type</th>
                        <th>Scanner Context</th>
                        <th>Sender</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.id}>
                          <td className="subtle">{new Date(a.timestamp).toLocaleString()}</td>
                          <td><span className="badge badge-neutral">{a.type.replace('_', ' ')}</span></td>
                          <td>
                            <div className="subtle">IP: {a.metadata?.ip || 'N/A'}</div>
                            <div className="subtle" style={{ marginTop: '0.2rem' }}>{a.metadata?.userAgent || 'N/A'}</div>
                            {a.metadata?.location && <div className="subtle" style={{ marginTop: '0.2rem' }}>Loc: {a.metadata.location.lat}, {a.metadata.location.lng}</div>}
                          </td>
                          <td style={{ fontWeight: 700 }}>{a.senderPhone}</td>
                          <td>
                            <span className={`badge ${a.status === 'delivered' ? 'badge-success' : a.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{a.status.toUpperCase()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!loading && alerts.length === 0 && <div className="empty-state">No alert history yet.</div>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
