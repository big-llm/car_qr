import React from 'react';
import { motion } from 'framer-motion';
import { 
  CarFront, 
  ShieldCheck, 
  Zap, 
  PhoneOff, 
  ScanQrCode, 
  MessageSquareText, 
  Clock,
  AlertCircle
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
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <CarFront size={32} />
          <span>SmartVehicle</span>
        </div>
        <div className="nav-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#features">Features</a>
          <a href="/owner">Owner Login</a>
        </div>
        <a href="/owner" className="nav-cta">Register Vehicle</a>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div 
          className="hero-content"
          initial="initial"
          animate="animate"
          variants={fadeIn}
        >
          <span className="hero-badge">Privacy-First Vehicle Contact</span>
          <h1>Contact Any Car Owner Instantly — <span style={{color: 'var(--primary)'}}>Without Numbers.</span></h1>
          <p>
            The modern way to solve parking conflicts. Alert vehicle owners about obstructions or emergencies securely and anonymously via a simple QR scan.
          </p>
          <div className="hero-btns">
            <a href="/owner" className="btn-primary">Get Your QR Code</a>
            <a href="#how-it-works" className="btn-secondary">See How it Works</a>
          </div>
        </motion.div>

        <motion.div 
          className="hero-image"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="mockup-container">
            <div className="mockup-screen">
              <div className="nav-logo" style={{marginTop: '1rem'}}>
                <CarFront size={24} />
                <span style={{fontSize: '1.1rem'}}>SmartVehicle</span>
              </div>
              <div className="mockup-qr">
                <ScanQrCode size={80} color="#00704A" />
              </div>
              <div style={{padding: '2rem', textAlign: 'center'}}>
                <h3 style={{marginBottom: '0.5rem'}}>Scan to Alert</h3>
                <p style={{fontSize: '0.9rem', color: '#666'}}>Scan this code to contact the owner of vehicle MH 01 AB 1234</p>
              </div>
              <div style={{width: '80%', height: '40px', background: '#00704A', borderRadius: '10px', marginTop: '1rem'}}></div>
            </div>
          </div>
          {/* Floating elements */}
          <motion.div 
            style={{position: 'absolute', top: '10%', right: '5%', background: 'white', padding: '1rem', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', display: 'flex', gap: '0.5rem', alignItems: 'center'}}
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <ShieldCheck color="var(--primary)" />
            <span style={{fontWeight: 600}}>Privacy Protected</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section id="how-it-works" className="problem-section">
        <div className="section-tag">The Problem</div>
        <h2>Tired of parking conflicts?</h2>
        <div className="problem-grid">
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><Clock size={32} /></div>
            <h3>Wasted Time</h3>
            <p>Spending 20 minutes waiting for a driver who blocked you in without any way to reach them.</p>
          </motion.div>
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><AlertCircle size={32} /></div>
            <h3>Heated Arguments</h3>
            <p>Conflicts arise when people can't communicate effectively during parking stresses.</p>
          </motion.div>
          <motion.div className="problem-card" variants={fadeIn} initial="initial" whileInView="animate">
            <div className="card-icon"><PhoneOff size={32} /></div>
            <h3>Privacy Risks</h3>
            <p>Leaving your phone number on the dashboard exposes you to prank calls and data harvesting.</p>
          </motion.div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="features-section" id="features">
        <div className="section-tag" style={{color: 'var(--accent)'}}>The Solution</div>
        <h2 style={{color: 'white'}}>Smart, Secure & Simple</h2>
        <div className="features-grid">
          <div className="feature-item">
            <Zap size={40} color="var(--accent)" />
            <h3>Instant Alerts</h3>
            <p>Receive real-time notifications on your phone the moment someone scans your vehicle's QR code.</p>
          </div>
          <div className="feature-item">
            <PhoneOff size={40} color="var(--accent)" />
            <h3>No App Required</h3>
            <p>Anyone with a smartphone can scan the code. No need to download or register for guest scanners.</p>
          </div>
          <div className="feature-item">
            <ShieldCheck size={40} color="var(--accent)" />
            <h3>Total Anonymity</h3>
            <p>We act as a secure bridge. Your phone number is never shared with the person scanning.</p>
          </div>
          <div className="feature-item">
            <MessageSquareText size={40} color="var(--accent)" />
            <h3>Interactive Response</h3>
            <p>Let the scanner know you're coming with one-tap quick responses like "On my way!".</p>
          </div>
        </div>
      </section>

      {/* Live Demo Simulation */}
      <section style={{padding: '8rem 5%', background: 'white'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '4rem', flexWrap: 'wrap'}}>
          <div style={{flex: 1, minWidth: '300px'}}>
            <div className="section-tag">Interactive Demo</div>
            <h2 style={{textAlign: 'left'}}>Experience the flow in seconds</h2>
            <p style={{textAlign: 'left', marginBottom: '2rem'}}>See how a simple scan turns into a secure conversation. No apps, no numbers shared, just instant communication.</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
              <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                <div style={{width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', paddingTop: '4px'}}>1</div>
                <p style={{textAlign: 'left', margin: 0}}><strong>The Scan:</strong> Someone scans your vehicle's QR sticker.</p>
              </div>
              <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                <div style={{width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', paddingTop: '4px'}}>2</div>
                <p style={{textAlign: 'left', margin: 0}}><strong>The Alert:</strong> You get a secure SMS alert immediately.</p>
              </div>
              <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                <div style={{width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', paddingTop: '4px'}}>3</div>
                <p style={{textAlign: 'left', margin: 0}}><strong>The Response:</strong> You reply with one tap to reassure the scanner.</p>
              </div>
            </div>
          </div>
          
          <div style={{flex: 1, minWidth: '300px', position: 'relative', height: '500px', background: '#f9f9f9', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--surface-border)'}}>
             {/* Simple Animated Demo */}
             <motion.div 
               style={{width: '240px', height: '450px', background: 'white', borderRadius: '30px', border: '8px solid #333', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}}
               animate={{ y: [0, 10, 0] }}
               transition={{ repeat: Infinity, duration: 3 }}
             >
                <div style={{fontSize: '0.7rem', color: '#999', marginBottom: '1rem'}}>Notification • Just now</div>
                <div style={{background: '#F7F7F7', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--primary)'}}>
                   <p style={{fontSize: '0.8rem', textAlign: 'left', margin: 0, fontWeight: 700}}>Alert: MH 01 AB 1234</p>
                   <p style={{fontSize: '0.7rem', textAlign: 'left', margin: '5px 0 0'}}>Someone needs you to move your car.</p>
                </div>
                <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                   <div style={{padding: '0.6rem', background: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '0.7rem', textAlign: 'center'}}>On my way!</div>
                   <div style={{padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.7rem', textAlign: 'center'}}>Coming in 5 mins</div>
                </div>
             </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section style={{padding: '4rem 5%', borderTop: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)', background: 'white'}}>
        <div style={{display: 'flex', justifyContent: 'center', gap: '4rem', opacity: 0.6, flexWrap: 'wrap'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><ShieldCheck size={24}/> <span>Verified OTP Security</span></div>
           <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Zap size={24}/> <span>Firebase Powered</span></div>
           <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><PhoneOff size={24}/> <span>Privacy Certified</span></div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="final-cta">
        <motion.div 
          className="cta-box"
          whileInView={{ scale: [0.95, 1] }}
          transition={{ duration: 0.5 }}
        >
          <h2>Ready to secure your vehicle?</h2>
          <p style={{marginBottom: '3rem', fontSize: '1.2rem', opacity: 0.8}}>Join thousands of owners protecting their peace of mind and privacy.</p>
          <a href="/owner" className="btn-primary" style={{background: 'white', color: 'var(--dark)'}}>Get Your QR Sticker Now</a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{padding: '4rem 5%', background: '#111', color: 'white', textAlign: 'center'}}>
        <div className="nav-logo" style={{justifyContent: 'center', marginBottom: '2rem'}}>
          <CarFront size={32} />
          <span>SmartVehicle</span>
        </div>
        <p style={{opacity: 0.5}}>© 2026 Smart Vehicle Contact Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
