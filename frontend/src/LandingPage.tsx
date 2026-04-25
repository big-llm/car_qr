import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CarFront,
  Clock,
  MessageSquareText,
  PhoneOff,
  ScanQrCode,
  ShieldCheck,
  Zap
} from 'lucide-react';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="nav-logo">
          <CarFront size={28} />
          <span>SmartVehicle</span>
        </div>
        <div className="nav-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#features">Features</a>
          <a href="/login">Owner Login</a>
        </div>
        <a href="/register" className="nav-cta">Register Vehicle</a>
      </nav>

      <section className="hero-section">
        <motion.div className="hero-content" initial="initial" animate="animate" variants={fadeIn}>
          <span className="hero-badge">Privacy-first vehicle contact</span>
          <h1>Contact any car owner instantly <span style={{ color: 'var(--primary)' }}>without sharing numbers.</span></h1>
          <p>
            Solve parking conflicts and emergencies with a secure QR sticker that sends the owner an instant alert while keeping both sides private.
          </p>
          <div className="hero-btns">
            <a href="/register" className="btn-primary">Get Your QR Code</a>
            <a href="#how-it-works" className="btn-outline">See How it Works</a>
          </div>
        </motion.div>

        <motion.div
          className="hero-image"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="mockup-container">
            <div className="mockup-screen">
              <div className="nav-logo" style={{ marginTop: '0.6rem' }}>
                <CarFront size={22} />
                <span style={{ fontSize: '1rem' }}>SmartVehicle</span>
              </div>
              <div className="mockup-qr">
                <ScanQrCode size={88} color="#0d7a52" />
              </div>
              <div style={{ padding: '1.6rem', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.45rem' }}>Scan to alert</h3>
                <p style={{ fontSize: '0.9rem', color: '#6c6257', margin: 0 }}>
                  Send a secure message to the owner of MH 01 AB 1234 in seconds.
                </p>
              </div>
              <div style={{ width: '82%', height: '42px', background: '#0d7a52', borderRadius: '14px', marginTop: '0.5rem' }} />
            </div>
          </div>

          <motion.div
            style={{
              position: 'absolute',
              top: '9%',
              right: '2%',
              background: 'rgba(255,255,255,0.95)',
              padding: '0.9rem 1rem',
              borderRadius: '18px',
              boxShadow: '0 16px 32px rgba(24,20,14,0.12)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <ShieldCheck color="var(--primary)" />
            <span style={{ fontWeight: 700, color: '#1f1b16' }}>Privacy protected</span>
          </motion.div>
        </motion.div>
      </section>

      <section id="how-it-works" className="problem-section">
        <div className="section-tag">The problem</div>
        <h2>Tired of parking conflicts?</h2>
        <div className="problem-grid">
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><Clock size={30} /></div>
            <h3>Wasted time</h3>
            <p>Waiting around for a blocked driver with no reliable way to reach them.</p>
          </motion.div>
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><AlertCircle size={30} /></div>
            <h3>Stressful confrontations</h3>
            <p>Parking pressure gets personal fast when people cannot communicate clearly.</p>
          </motion.div>
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><PhoneOff size={30} /></div>
            <h3>Privacy risks</h3>
            <p>Leaving your number on the dashboard invites spam, misuse, and data scraping.</p>
          </motion.div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-tag" style={{ color: 'var(--accent)' }}>The solution</div>
        <h2 style={{ color: '#fff' }}>Smart, secure, and simple</h2>
        <div className="features-grid">
          <div className="feature-item">
            <Zap size={40} color="var(--accent)" />
            <h3>Instant alerts</h3>
            <p>Owners receive a live notification the moment someone scans the QR sticker.</p>
          </div>
          <div className="feature-item">
            <PhoneOff size={40} color="var(--accent)" />
            <h3>No app required</h3>
            <p>Any smartphone can scan and send an alert without exposing anyone's contact details.</p>
          </div>
          <div className="feature-item">
            <ShieldCheck size={40} color="var(--accent)" />
            <h3>Total privacy</h3>
            <p>The platform acts as a secure relay so phone numbers never need to be shared.</p>
          </div>
          <div className="feature-item">
            <MessageSquareText size={40} color="var(--accent)" />
            <h3>Quick responses</h3>
            <p>Owners can reply with one tap to show they are coming, delayed, or need a call back.</p>
          </div>
        </div>
      </section>

      <section style={{ padding: '6rem 1rem', background: 'rgba(255,255,255,0.55)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div className="section-tag">Interactive demo</div>
            <h2 style={{ textAlign: 'left' }}>See the flow in seconds</h2>
            <p style={{ textAlign: 'left', marginBottom: '2rem' }}>
              A simple scan becomes a secure conversation. No app install, no exposed phone numbers, no awkward guesswork.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ textAlign: 'left', margin: 0 }}><strong>1.</strong> Someone scans the QR sticker on your car.</p>
              <p style={{ textAlign: 'left', margin: 0 }}><strong>2.</strong> You receive a secure alert right away.</p>
              <p style={{ textAlign: 'left', margin: 0 }}><strong>3.</strong> You answer with a quick status update.</p>
            </div>
          </div>

          <div style={{ flex: '1 1 320px', minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '28px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(56,40,20,0.08)' }}>
            <motion.div
              style={{ width: '240px', height: '450px', background: '#fff', borderRadius: '32px', border: '8px solid #2f2c28', padding: '1.5rem', boxShadow: '0 24px 44px rgba(24,20,14,0.12)' }}
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '1rem' }}>Notification • Just now</div>
              <div style={{ background: '#f7f2eb', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                <p style={{ fontSize: '0.8rem', textAlign: 'left', margin: 0, fontWeight: 700 }}>Alert: MH 01 AB 1234</p>
                <p style={{ fontSize: '0.7rem', textAlign: 'left', margin: '5px 0 0' }}>Someone needs you to move your car.</p>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                <div style={{ padding: '0.6rem', background: 'var(--primary)', color: 'white', borderRadius: '10px', fontSize: '0.7rem', textAlign: 'center' }}>On my way!</div>
                <div style={{ padding: '0.6rem', border: '1px solid #ddd', borderRadius: '10px', fontSize: '0.7rem', textAlign: 'center' }}>Coming in 5 mins</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section style={{ padding: '3.5rem 1rem', borderTop: '1px solid rgba(56,40,20,0.08)', borderBottom: '1px solid rgba(56,40,20,0.08)', background: 'rgba(255,251,247,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck size={22} /> <span>Verified OTP security</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={22} /> <span>Realtime alerts</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PhoneOff size={22} /> <span>Privacy-first contact</span></div>
        </div>
      </section>

      <section className="final-cta">
        <motion.div className="cta-box" whileInView={{ scale: [0.97, 1] }} transition={{ duration: 0.5 }}>
          <h2>Ready to secure your vehicle?</h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.05rem', opacity: 0.82 }}>
            Join owners who want a faster, calmer, more private way to handle parking issues.
          </p>
          <a href="/register" className="btn-primary" style={{ background: 'white', color: 'var(--dark)' }}>Get Your QR Sticker Now</a>
        </motion.div>
      </section>

      <footer style={{ padding: '3rem 1rem 4rem', background: '#181510', color: 'white', textAlign: 'center' }}>
        <div className="nav-logo" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
          <CarFront size={28} />
          <span>SmartVehicle</span>
        </div>
        <p style={{ opacity: 0.58 }}>© 2026 Smart Vehicle Contact Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
