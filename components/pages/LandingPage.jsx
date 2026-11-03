'use client';
import ProtectedImage from '@/components/ui/ProtectedImage';


import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate } from 'framer-motion';
import { ArrowRight, Shield, Globe, Server, Code, Layers, Zap, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/components/ui/theme-provider';
import WalkthroughTooltip from '@/components/ui/WalkthroughTooltip';

// --- Utility Components ---

// Noise Texture Overlay
const NoiseOverlay = () => (
  <div
    className="fixed inset-0 pointer-events-none z-[50] opacity-[0.035] mix-blend-overlay"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
    }}
  />
);

const MagneticButton = ({ children, className, onClick, variant = 'primary' }) => {
  return (
    <motion.button
      className={className}
      onClick={onClick}
      whileHover={{
        scale: 1.03,
        y: -2,
        boxShadow: "0 0 24px rgba(139, 92, 246, 0.45)"
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
        {children}
      </span>
    </motion.button>
  );
};

const TransformCard = ({ icon, title, description, delay }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;

    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: delay, duration: 0.8, type: "spring", bounce: 0.3 }}
      style={{ perspective: 1000 }}
      className="h-full"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-full text-left group cursor-pointer"
      >
        {/* Background & Border */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl bg-card/40 backdrop-blur-xl group-hover:bg-card/60 transition-colors duration-300" />

        {/* Radial Hover Glow */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-soft-light"
          style={{
            background: useMotionTemplate`radial-gradient(400px circle at ${useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"])} ${useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"])}, rgba(var(--primary-rgb), 0.3), transparent 60%)`,
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 p-8 h-full flex flex-col transform-gpu transition-transform duration-300 group-hover:translate-z-10 group-hover:-translate-y-2">
          {/* Icon */}
          <div className="mb-6 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-white/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 shadow-lg shadow-primary/5">
            {icon}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/90 transition-colors duration-300 flex-grow">
            {description}
          </p>

          {/* Bottom Decoration */}
          <div className="mt-6 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
        </div>
      </motion.div>
    </motion.div>
  );
};

const AnimatedText = ({ text, className }) => {
  return (
    <span className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_auto] animate-gradient-x ${className}`}>
      {text}
    </span>
  );
}


// --- Main Page Component ---

export default function LandingPage({ onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const scrollRef = useRef(null);

  // Scroll Animations
  const { scrollYProgress } = useScroll({ target: scrollRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, 50]);

  return (
    <div ref={scrollRef} className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary-foreground relative font-sans">
      <NoiseOverlay />

      {/* Walkthrough Tooltip */}
      <WalkthroughTooltip
        storageKey="landing-walkthrough-v1"
        title="Welcome to Splitter"
        message={`Splitter is a federated social network. Think of it like email - you can join any server and still connect with everyone.

Each server is independently run but they all talk to each other. Your data stays with your chosen community, and you control your identity.

No single company owns your social network anymore.`}
        position="right"
      />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-background/60 border-b border-white/5 supports-[backdrop-filter]:bg-background/20"
      >
        <div
          className="flex items-center space-x-2 group cursor-pointer"
          onClick={() => onNavigate('landing')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ProtectedImage
              src="/logo.png"
              alt="Logo"
              style={{
                height: '66px',
                width: 'auto',
                objectFit: 'contain',
                filter: isDarkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
              }}
            />
            <span
              className="text-2xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, var(--primary-cyan), var(--accent-magenta))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block'
              }}
            >
              SPLITTER
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground relative w-10 h-10 flex items-center justify-center"
          >
            <motion.span
              initial={false}
              animate={{ rotate: isDarkMode ? 0 : 90, scale: isDarkMode ? 1 : 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              🌙
            </motion.span>
            <motion.span
              initial={false}
              animate={{ rotate: isDarkMode ? -90 : 0, scale: isDarkMode ? 0 : 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              ☀️
            </motion.span>
          </button>

          <div className="hidden md:flex space-x-3">
            <MagneticButton
              onClick={() => onNavigate('login')}
              className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:bg-white/5 rounded-full"
              variant="secondary"
            >
              Log in
            </MagneticButton>
            <MagneticButton
              onClick={() => onNavigate('signup')}
              className="px-6 py-2.5 text-sm font-semibold text-white rounded-full bg-primary/90 hover:bg-primary shadow-lg shadow-primary/25 overflow-hidden relative"
            >
              Start Building
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative h-[110vh] flex items-center justify-center overflow-hidden">
        {/* Energetic Aurora Background - Time Based Only */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Primary Blob */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20 blur-[120px] mix-blend-screen opacity-30 dark:opacity-40"
          />
          {/* Secondary Wandering Blob */}
          <motion.div
            animate={{
              x: [-100, 100, -100],
              y: [-50, 50, -50],
              scale: [0.8, 1.1, 0.8]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/3 w-[40vw] h-[40vw] rounded-full bg-indigo-500/10 blur-[100px] mix-blend-plus-lighter opacity-30 dark:opacity-40"
          />
        </div>

        {/* Hero Content */}
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          className="container px-4 md:px-6 relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center justify-center h-full pb-20"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl hover:bg-white/10 transition-colors cursor-default"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/80">Federated Social Network</span>
            </motion.div>

            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.9]">
              <span className="block relative z-10 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60 pb-2">
                Social
              </span>
              <span className="block relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-indigo-500 animate-gradient-x bg-[length:200%_auto] pb-4">
                Reimagined
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light tracking-wide">
              A federated network with browser-managed <span className="text-foreground font-normal">identity</span>,
              <span className="text-foreground font-normal"> private audiences</span>, and <span className="text-foreground font-normal">encrypted conversations</span>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
              <MagneticButton
                onClick={() => onNavigate('signup')}
                className="w-full sm:w-auto px-10 py-5 text-lg font-bold text-white rounded-2xl bg-gradient-to-r from-primary to-purple-600 shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300"
              >
                Claim Your ID
              </MagneticButton>
              <MagneticButton
                onClick={() => onNavigate('instances')}
                className="w-full sm:w-auto px-10 py-5 text-lg font-bold text-foreground bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Live Network
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </MagneticButton>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Prompt */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 cursor-pointer z-20 group"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground group-hover:text-foreground transition-colors">Explore</span>
          <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-muted-foreground/50 to-transparent group-hover:via-primary transition-colors duration-500"></div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-32 relative z-10 bg-background/50 backdrop-blur-sm -mt-20 rounded-t-[3rem] border-t border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.1)]">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50, rotateX: -5 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ perspective: 1000 }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Defy the <AnimatedText text="Algorithm" />
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're rebuilding the social stack. No black boxes. No engagement farming. Just pure connection.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-2 md:px-0">
            <TransformCard
              icon={<Shield className="w-6 h-6" />}
              title="Sovereign Identity"
              description="Your private identity keys stay in your browser. Public keys let your server verify your identity."
              delay={0.1}
            />
            <TransformCard
              icon={<Globe className="w-6 h-6 text-purple-500" />}
              title="Global Federation"
              description="Connect independently hosted instances through signed ActivityPub messages and configured peers."
              delay={0.2}
            />
            <TransformCard
              icon={<Server className="w-6 h-6 text-indigo-500" />}
              title="Community Hosted"
              description="Run your own instance or join one that shares your values. Complete autonomy."
              delay={0.3}
            />
            <TransformCard
              icon={<Code className="w-6 h-6 text-pink-500" />}
              title="Open Source"
              description="Auditable code. Transparent algorithms. Built by the community, for the community."
              delay={0.4}
            />
            <TransformCard
              icon={<Layers className="w-6 h-6 text-cyan-500" />}
              title="Identity Recovery"
              description="Export a passphrase-encrypted recovery file and restore your verified identity keys on another device."
              delay={0.5}
            />
            <TransformCard
              icon={<Zap className="w-6 h-6 text-amber-500" />}
              title="Independent Communities"
              description="Each instance sets its own moderation policy while exchanging content with its configured network."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-40 relative overflow-hidden">
        {/* Abstract Background for Section */}
        <div className="absolute inset-0 bg-muted/20 skew-y-3 scale-110 pointer-events-none origin-top-right mix-blend-multiply dark:mix-blend-overlay" />

        <div className="container px-4 md:px-6 max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

            <motion.div
              initial={{ opacity: 0, x: -50, rotateY: 5 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ perspective: 1000 }}
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-10 leading-none">
                Humanity, <br />
                <span className="text-primary">Not Metrics.</span>
              </h2>
              <div className="space-y-8 text-lg text-muted-foreground/90 leading-relaxed font-light">
                <p>
                  The current web optimizes for addiction. We optimize for agency.
                  <strong className="text-foreground block mt-3 text-xl font-normal">Splitter is different by design.</strong>
                </p>
                <div className="space-y-4 pt-4">
                  {[
                    "Follow-based social feeds",
                    "End-to-End Encrypted DMs",
                    "Community-driven moderation",
                    "No advertising in your feed"
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 text-foreground p-4 rounded-xl bg-card border border-border/50 hover:bg-card/80 transition-all hover:translate-x-2 cursor-default group"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <span className="font-medium">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Visual Element */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
              className="relative"
            >

              <div className="relative p-1 rounded-[2.5rem] bg-gradient-to-br from-white/20 to-white/0 shadow-2xl overflow-hidden backdrop-blur-3xl border border-white/10 group">
                <div className="bg-background/80 rounded-[2.3rem] p-8 md:p-12 h-full w-full overflow-hidden relative transition-all duration-500 group-hover:bg-background/90">
                  {/* Inner Glow */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-500" />

                  {/* Content */}
                  <div className="relative z-10 space-y-8">
                    {/* Bubble 1 */}
                    <div className="flex gap-4 items-end">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-400 to-orange-400 shadow-lg ring-2 ring-background"></div>
                      <div className="bg-muted p-5 rounded-3xl rounded-bl-sm border border-border/50 text-base max-w-[85%] shadow-sm transform transition-transform group-hover:translate-x-1">
                        <p>Is it true that I own my data?</p>
                      </div>
                    </div>

                    {/* Bubble 2 */}
                    <div className="flex gap-4 items-end flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 shadow-lg ring-2 ring-background"></div>
                      <div className="bg-primary/10 p-5 rounded-3xl rounded-br-sm border border-primary/20 text-base max-w-[85%] text-foreground shadow-sm transform transition-transform group-hover:-translate-x-1">
                        <p className="font-medium">Your private keys stay in your browser. Keep an encrypted recovery file so you can restore them on another device.</p>
                      </div>
                    </div>

                    {/* Encryption Status */}
                    <div className="flex gap-4 items-center justify-center py-2 opacity-60">
                      <div className="h-px bg-border flex-1"></div>
                      <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        <span>ECDH encrypted messaging</span>
                      </div>
                      <div className="h-px bg-border flex-1"></div>
                    </div>

                    {/* Bubble 3 */}
                    <div className="flex gap-4 items-end">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-400 to-orange-400 shadow-lg ring-2 ring-background"></div>
                      <div className="bg-muted p-5 rounded-3xl rounded-bl-sm border border-border/50 text-base max-w-[85%] shadow-sm transform transition-transform group-hover:translate-x-1">
                        <p>Finally. The web feels fun again. ✨</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-40 relative overflow-hidden flex items-center justify-center">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="container px-4 md:px-6 text-center max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl md:text-8xl font-bold mb-8 tracking-tighter">
              Start your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">Exodus.</span>
            </h2>
            <p className="text-2xl text-muted-foreground/80 max-w-2xl mx-auto mb-12 font-light">
              Join the federated network that puts you back in control.
            </p>
            <MagneticButton
              onClick={() => onNavigate('signup')}
              className="px-12 py-6 text-xl font-bold text-white rounded-full bg-foreground hover:bg-foreground/90 transition-all duration-300 shadow-2xl hover:shadow-xl"
            >
              Get Started Now
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 bg-background border-t border-white/5 relative z-10">
        <div className="container px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-muted-foreground text-sm">
          <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">S</div>
            <p>© 2026 Splitter Protocol. Open Source.</p>
          </div>
          <div className="flex gap-8 opacity-70 hover:opacity-100 transition-opacity">
            <a href="https://github.com/EliteGamer007/splitter/blob/main/README.md" className="hover:text-primary transition-colors">Docs</a>
            <a href="https://github.com/EliteGamer007/splitter/blob/main/PRIVACY.md" className="hover:text-primary transition-colors">Privacy</a>
            <a href="https://github.com/EliteGamer007/Splitter-frontend" className="hover:text-primary transition-colors">GitHub</a>
            <button onClick={() => onNavigate('instances')} className="hover:text-primary transition-colors">Instances</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
