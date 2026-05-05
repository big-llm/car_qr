import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Building2,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  PhoneOff,
  ScanQrCode,
  ShieldCheck,
  Smartphone,
  Users,
  Zap
} from 'lucide-react';
import './LandingPage.css';

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 }
};

const incidents = [
  {
    icon: Clock,
    title: 'Blocked parking',
    copy: 'The scanner sends a clear request instead of waiting, shouting, or leaving a public phone number.'
  },
  {
    icon: AlertCircle,
    title: 'Urgent vehicle issue',
    copy: 'Open window, lights on, minor scrape, towing risk, or emergency contact needs a fast private path.'
  },
  {
    icon: PhoneOff,
    title: 'Privacy risk',
    copy: 'Dashboard phone numbers invite spam. A QR relay keeps owner and scanner details controlled.'
  }
];

const flowSteps = [
  {
    title: 'Scan the sticker',
    copy: 'Any phone camera opens a branded contact page with safe vehicle context.'
  },
  {
    title: 'Verify by OTP',
    copy: 'Scanner verification reduces repeated spam and creates accountability.'
  },
  {
    title: 'Send the alert',
    copy: 'The owner gets an instant alert with the issue type and optional message.'
  },
  {
    title: 'Show the response',
    copy: 'The scanner sees live status such as on my way, delayed, or need a call.'
  }
];

const ownerControls = [
  'Add multiple vehicles and assign one QR per vehicle',
  'Deactivate damaged or suspicious stickers from the dashboard',
  'Review alert history, issue type, scanner verification, and response time',
  'Keep phone number hidden throughout public scan sessions'
];

const audienceCards = [
  {
    icon: CarFront,
    title: 'Owners',
    copy: 'A calm dashboard for QR activation, vehicle profiles, alerts, quick replies, and sticker status.'
  },
  {
    icon: ScanQrCode,
    title: 'Scanners',
    copy: 'A short mobile flow that needs no app install and never exposes the owner phone number.'
  },
  {
    icon: Building2,
    title: 'Societies and fleets',
    copy: 'A safer communication layer for apartment parking, office lots, delivery teams, and guarded premises.'
  }
];

const trustItems = [
  {
    icon: LockKeyhole,
    title: 'No payment on scan page',
    copy: 'Public QR pages should ask only for the issue context, not bank or payment details.'
  },
  {
    icon: ShieldCheck,
    title: 'Branded trust cues',
    copy: 'A clear HTTPS domain, vehicle hint, QR ID, and support link help scanners know they are in the right place.'
  },
  {
    icon: Gauge,
    title: 'Abuse throttling',
    copy: 'Rate limits, OTP checks, and alert logs make the system harder to misuse.'
  },
  {
    icon: FileCheck2,
    title: 'Audit history',
    copy: 'Owners can review scans, outcomes, and sticker status after every incident.'
  }
];

const plans = [
  {
    name: 'Personal',
    price: '₹199',
    detail: 'Best for one car or bike owner',
    points: ['1 smart QR sticker', 'Private alerts', 'Basic scan history']
  },
  {
    name: 'Family',
    price: '₹399',
    detail: 'For multi-vehicle households',
    points: ['3 QR stickers', 'Shared emergency contacts', 'Sticker deactivate controls']
  },
  {
    name: 'Community',
    price: 'Talk to us',
    detail: 'For societies, offices, and fleets',
    points: ['Bulk vehicle onboarding', 'Admin reporting', 'Priority support']
  }
];

const faqs = [
  {
    question: 'Will the scanner see my phone number?',
    answer: 'No. The scanner sends a message through the platform, and the owner receives the alert without exposing their phone number.'
  },
  {
    question: 'Does the scanner need an app?',
    answer: 'No. The flow works from the phone camera and browser, which is important because most scans happen in a hurry on mobile.'
  },
  {
    question: 'What if the QR is abused?',
    answer: 'OTP verification, rate limits, deactivation controls, and audit logs reduce repeated misuse and make the history reviewable.'
  },
  {
    question: 'Where should the sticker be placed?',
    answer: 'Use a visible windshield or dashboard position with clear branding, QR ID, and a short safety line so scanners trust the page.'
  }
];

const LandingPage: React.FC = () => {
  return (
    <div className="landing-container">
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="nav-logo" href="/" aria-label="SmartVehicle home">
          <span className="logo-mark"><CarFront size={21} /></span>
          <span>SmartVehicle</span>
        </a>

        <div className="nav-links">
          <a href="#flow">How it works</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <a href="/login">Owner login</a>
        </div>

        <a href="/register" className="nav-cta">
          Register vehicle
          <ArrowRight size={17} />
        </a>
      </nav>

      <main>
        <section className="hero-section">
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="visible"
            variants={reveal}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow">Privacy-first vehicle contact</span>
            <h1>A private way for strangers to contact your vehicle.</h1>
            <p>
              SmartVehicle turns a QR sticker into a secure alert channel for blocked parking,
              emergencies, and everyday vehicle issues without publishing phone numbers.
            </p>

            <div className="hero-actions">
              <a href="/register" className="btn btn-primary">
                Get your QR sticker
                <ArrowRight size={18} />
              </a>
              <a href="#flow" className="btn btn-secondary">
                View scan flow
                <ChevronRight size={18} />
              </a>
            </div>

            <div className="hero-proof" aria-label="Product highlights">
              <div>
                <strong>&lt; 30 sec</strong>
                <span>target alert path</span>
              </div>
              <div>
                <strong>0</strong>
                <span>phone numbers shown</span>
              </div>
              <div>
                <strong>OTP</strong>
                <span>scanner verification</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-product"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            aria-label="Product preview"
          >
            <div className="vehicle-panel">
              <div className="windshield">
                <div className="sticker-preview">
                  <span>SMARTVEHICLE</span>
                  <ScanQrCode size={88} />
                  <small>Scan to alert owner</small>
                </div>
                <div className="plate-chip">MH 01 AB 4821</div>
              </div>
              <div className="car-line" />
            </div>

            <motion.div
              className="alert-card"
              animate={{ y: [0, -9, 0] }}
              transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
            >
              <span><BellRing size={15} /> Live alert</span>
              <strong>Blocking vehicle</strong>
              <p>Verified scanner is waiting near Gate B.</p>
            </motion.div>

            <div className="phone-preview">
              <div className="phone-top">
                <span>Owner app</span>
                <small>Just now</small>
              </div>
              <div className="message-preview">
                <MessageSquareText size={18} />
                <div>
                  <strong>Parking alert received</strong>
                  <span>Respond without sharing your number.</span>
                </div>
              </div>
              <div className="reply-stack">
                <button type="button">On my way</button>
                <button type="button">Need 5 minutes</button>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="signal-strip" aria-label="Trust signals">
          <div><ShieldCheck size={19} /> Phone number hidden</div>
          <div><Smartphone size={19} /> No app for scanner</div>
          <div><Zap size={19} /> Live owner alert</div>
          <div><Users size={19} /> Works for societies and fleets</div>
        </section>

        <section className="problem-section section-shell">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Real daily problem</span>
              <h2>The moment is stressful. The interface should be calm.</h2>
            </div>
            <p>
              Most people scan from a phone, standing beside a vehicle, with limited patience.
              The page has to explain trust, capture the issue, and send the alert quickly.
            </p>
          </div>

          <div className="incident-grid">
            {incidents.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  className="incident-card"
                  key={item.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  variants={reveal}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <span className="icon-chip"><Icon size={22} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="flow-section" id="flow">
          <div className="section-shell flow-layout">
            <div className="flow-copy">
              <span className="eyebrow">Mobile scan journey</span>
              <h2>Four taps from scan to owner response.</h2>
              <p>
                The scanner flow must feel official, short, and safe. The owner flow must feel
                fast enough for parking pressure and controlled enough for privacy.
              </p>
            </div>

            <div className="flow-board">
              {flowSteps.map((step, index) => (
                <motion.div
                  className="flow-step"
                  key={step.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-70px' }}
                  variants={reveal}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="audience-section section-shell">
          <div className="section-heading">
            <span className="eyebrow">Product experience</span>
            <h2>Built for the three people who actually use it.</h2>
          </div>

          <div className="audience-grid">
            {audienceCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  className={`audience-card audience-card-${index + 1}`}
                  key={item.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  variants={reveal}
                  transition={{ duration: 0.48, delay: index * 0.08 }}
                >
                  <Icon size={27} />
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="owner-section section-shell">
          <div className="owner-dashboard">
            <div className="dashboard-top">
              <div>
                <span>Vehicle dashboard</span>
                <strong>MH 01 AB 4821</strong>
              </div>
              <span className="status-pill">Active QR</span>
            </div>
            <div className="dashboard-metric-row">
              <div><strong>14</strong><span>Alerts</span></div>
              <div><strong>4.8m</strong><span>Avg response</span></div>
              <div><strong>2</strong><span>Vehicles</span></div>
            </div>
            <div className="dashboard-list">
              <div><CheckCircle2 size={17} /> Parking issue resolved</div>
              <div><CheckCircle2 size={17} /> Scanner OTP verified</div>
              <div><CheckCircle2 size={17} /> Phone number remained hidden</div>
            </div>
          </div>

          <div className="owner-copy">
            <span className="eyebrow">Owner controls</span>
            <h2>Enough control for trust, not so much that setup feels heavy.</h2>
            <div className="control-list">
              {ownerControls.map((item) => (
                <div key={item}>
                  <CheckCircle2 size={19} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="security-section" id="security">
          <div className="section-shell security-layout">
            <div className="security-copy">
              <span className="eyebrow">QR trust and safety</span>
              <h2>QR products need visible proof that the scan is safe.</h2>
              <p>
                Parking-related QR scams are a known user fear. Your public scan page should
                feel verified, branded, and narrowly focused on vehicle contact.
              </p>
            </div>

            <div className="trust-grid">
              {trustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="trust-item" key={item.title}>
                    <Icon size={23} />
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pricing-section section-shell" id="pricing">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">Simple business model</span>
              <h2>Plans should be easy to compare on a phone.</h2>
            </div>
            <p>
              For this kind of product, fewer plans work better. Users are buying peace of mind,
              not reading a long SaaS pricing table in a parking lot.
            </p>
          </div>

          <div className="plan-grid">
            {plans.map((plan, index) => (
              <article className={`plan-card ${index === 1 ? 'featured-plan' : ''}`} key={plan.name}>
                {index === 1 && <span className="plan-badge">Popular</span>}
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <p>{plan.detail}</p>
                <div className="plan-points">
                  {plan.points.map((point) => (
                    <span key={point}><CheckCircle2 size={16} /> {point}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="faq-section section-shell">
          <div className="section-heading">
            <span className="eyebrow">Buyer questions</span>
            <h2>Answer the concerns before checkout.</h2>
          </div>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="section-shell cta-panel">
            <div>
              <span className="eyebrow">Start with one sticker</span>
              <h2>Make your vehicle reachable without making your number public.</h2>
            </div>
            <a href="/register" className="btn btn-primary cta-button">
              Register vehicle
              <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="section-shell footer-layout">
          <a className="nav-logo footer-logo" href="/">
            <span className="logo-mark"><CarFront size={21} /></span>
            <span>SmartVehicle</span>
          </a>
          <p>Private vehicle contact platform for QR stickers, parking alerts, and verified scanner messages.</p>
          <div>
            <a href="#flow">How it works</a>
            <a href="#security">Security</a>
            <a href="/login">Owner login</a>
          </div>
        </div>
      </footer>

      <div className="mobile-action-bar">
        <a href="/register" className="btn btn-primary">
          Register vehicle
          <ArrowRight size={17} />
        </a>
      </div>
    </div>
  );
};

export default LandingPage;
