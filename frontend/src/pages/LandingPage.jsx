// src/pages/LandingPage.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Typography,
  useTheme,
  Avatar,
  ListItemIcon,
  List,
  ListItem,
  ListItemText,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  useScrollTrigger,
  Slide,
  Card,
  CardContent,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import {
  TrendingUp,
  ShowChart,
  UploadFile,
  Security,
  ArrowForward,
  CheckCircleOutline,
  BarChart,
  AccountBalanceWallet,
  NotificationsActive,
  Menu as MenuIcon,
  Close as CloseIcon,
  Insights, // Placeholder icon
  VerifiedUser, // Placeholder icon
  Assessment, // Icon for "Portfolio Tracker"
  AdminPanelSettings, // Icon for "Secure and Private"
  Devices, // Icon for "Multi-Device Access"
} from "@mui/icons-material";
import { Fade, Slide as RevealSlide } from "react-awesome-reveal";


// --- Data (Simulating import from a data file) ---

const navItems = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const features = [
  {
    icon: <UploadFile />,
    title: "Seamless Import",
    description: "Easily import your investment data from various brokers via CSV or direct integration (coming soon).",
  },
  {
    icon: <TrendingUp />,
    title: "Performance Insights",
    description: "Track your portfolio's growth, ROI, and performance metrics with interactive charts.",
  },
  {
    icon: <ShowChart />,
    title: "Advanced Analytics",
    description: "Dive deep into your asset allocation, diversification, and risk exposure with powerful tools.",
  },
  {
    icon: <Security />,
    title: "Bank-Grade Security",
    description: "Your data is encrypted and securely stored, ensuring privacy and peace of mind.",
  },
];

// Data from the new FeaturesPage content
const visualFeatures = [
  {
    title: "Best Portfolio Tracker",
    description: "Stay on top of your investments with real-time insights and analytics.",
    icon: <Assessment sx={{ fontSize: 80 }} />,
  },
  {
    title: "Secure and Private",
    description: "Your data is encrypted and protected with top-grade security.",
    icon: <AdminPanelSettings sx={{ fontSize: 80 }} />,
  },
  {
    title: "Multi-Device Access",
    description: "Use the app on desktop, tablet, or mobile – synced across all.",
    icon: <Devices sx={{ fontSize: 80 }} />,
  },
];


const howItWorksSteps = [
  {
    icon: <AccountBalanceWallet />,
    title: "Connect Your Accounts",
    description: "Link your brokerage accounts or upload your data in minutes.",
  },
  {
    icon: <BarChart />,
    title: "Visualize Your Portfolio",
    description: "See all your investments in one clear, consolidated dashboard.",
  },
  {
    icon: <NotificationsActive />,
    title: "Stay Informed",
    description: "Get insights, track goals, and make smarter investment decisions.",
  },
];

const pricingData = {
  monthly: [
    {
      title: "Free", price: "$0", subtitle: "Perfect for getting started",
      features: ["1 Portfolio", "Basic Performance Tracking", "Limited Analytics", "Email Support", "Export to CSV"],
      popular: false,
    },
    {
      title: "Premium", price: "$29", subtitle: "For serious investors",
      features: ["Unlimited Portfolios", "Advanced Analytics", "Real-time Alerts", "Priority Support", "Custom Reports", "API Access"],
      popular: true,
    },
  ],
  yearly: [
    {
      title: "Free", price: "$0", subtitle: "Perfect for getting started",
      features: ["1 Portfolio", "Basic Performance Tracking", "Limited Analytics", "Email Support", "Export to CSV"],
      popular: false,
    },
    {
      title: "Premium", price: "$290", subtitle: "For serious investors", originalPrice: "$348",
      features: ["Unlimited Portfolios", "Advanced Analytics", "Real-time Alerts", "Priority Support", "Custom Reports", "API Access"],
      popular: true,
    },
  ],
};

const whyTrustUsItems = [
    {
        icon: <CheckCircleOutline color="primary" />,
        primary: "Holistic View",
        secondary: "Consolidate all your investments from different brokers into one comprehensive dashboard.",
    },
    {
        icon: <CheckCircleOutline color="primary" />,
        primary: "Actionable Insights",
        secondary: "Go beyond simple tracking with analytics that help you understand performance drivers.",
    },
    {
        icon: <CheckCircleOutline color="primary" />,
        primary: "User-Centric Design",
        secondary: "An intuitive and easy-to-navigate platform designed for investors of all levels.",
    },
    {
        icon: <CheckCircleOutline color="primary" />,
        primary: "Dedicated Support",
        secondary: "Our team is here to help you get the most out of our platform.",
    },
];

// --- Common Styled Components ---

const SectionTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2), // Adjusted margin for sections with subtitles
  fontWeight: "bold",
  color: theme.palette.text.primary,
  position: "relative",
  display: "inline-block",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: -theme.spacing(1.5),
    left: "50%",
    transform: "translateX(-50%)",
    width: "60px",
    height: "4px",
    backgroundColor: theme.palette.primary.main,
    borderRadius: theme.shape.borderRadius,
  },
}));

const SectionSubtitle = styled(Typography)(({ theme }) => ({
    maxWidth: 600,
    margin: '0 auto',
    paddingBottom: theme.spacing(6),
    color: theme.palette.text.secondary,
}));


const HeroButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 6),
  borderRadius: theme.shape.borderRadius * 5,
  fontWeight: 700,
  fontSize: "1.1rem",
  margin: theme.spacing(1),
  textTransform: "none",
  boxShadow: `0 4px 15px 0 ${alpha(theme.palette.common.black, 0.05)}`,
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    transform: "translateY(-3px)",
    boxShadow: `0 6px 20px 0 ${alpha(theme.palette.common.black, 0.1)}`,
  },
}));

// --- Section-Specific Components ---

// Navigation Bar Component
const StyledAppBar = styled(AppBar)(({ theme, scrolled }) => ({
  backgroundColor: scrolled ? alpha(theme.palette.background.paper, 0.95) : "transparent",
  backdropFilter: scrolled ? "blur(20px)" : "none",
  borderBottom: scrolled ? `1px solid ${theme.palette.divider}` : "none",
  boxShadow: scrolled ? theme.shadows[1] : "none",
  transition: "all 0.3s ease-in-out",
}));
const NavButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.primary,
  textTransform: "none",
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius * 2,
  transition: "all 0.2s ease-in-out",
  "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main },
}));
const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  cursor: "pointer",
}));
const MobileDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": { width: 280, backgroundColor: theme.palette.background.paper, padding: theme.spacing(2) },
}));
function HideOnScroll({ children }) {
  const trigger = useScrollTrigger();
  return <Slide appear={false} direction="down" in={!trigger}>{children}</Slide>;
}

const NavigationBar = () => {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const renderNavButton = (item) => {
      const isAnchor = item.href.startsWith("#");
      return (
          <NavButton
              key={item.label}
              component={isAnchor ? 'a' : RouterLink}
              href={isAnchor ? item.href : undefined}
              to={isAnchor ? undefined : item.href}
          >
              {item.label}
          </NavButton>
      );
  };

  const drawer = (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <LogoText variant="h5">InvestTracker</LogoText>
        <IconButton onClick={handleDrawerToggle} edge="end"><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {navItems.map((item) => (
          <Button key={item.label} component={item.href.startsWith("#") ? 'a' : RouterLink} to={item.href} href={item.href} fullWidth onClick={handleDrawerToggle} sx={{ justifyContent: "flex-start", textTransform: "none", py: 1.5, color: "text.primary", "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, } }}>
            {item.label}
          </Button>
        ))}
        <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button component={RouterLink} to="/login" variant="outlined" fullWidth sx={{ textTransform: "none", py: 1.5 }}>Sign In</Button>
          <Button component={RouterLink} to="/signup" variant="contained" fullWidth sx={{ textTransform: "none", py: 1.5 }}>Get Started</Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <HideOnScroll>
        <StyledAppBar position="fixed" elevation={0} scrolled={scrolled}>
          <Container maxWidth="lg">
            <Toolbar sx={{ justifyContent: "space-between", py: 1 }}>
              <LogoText variant="h5" component={RouterLink} to="/">InvestTracker</LogoText>
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
                {navItems.map(renderNavButton)}
              </Box>
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
                <Button component={RouterLink} to="/login" sx={{ textTransform: "none", color: "text.primary", "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) } }}>Sign In</Button>
                <Button component={RouterLink} to="/signup" variant="contained" sx={{ textTransform: "none", borderRadius: theme.shape.borderRadius * 2, px: 3 }}>Get Started</Button>
              </Box>
              <IconButton color="inherit" aria-label="open drawer" edge="end" onClick={handleDrawerToggle} sx={{ display: { md: "none" }, color: "text.primary" }}><MenuIcon /></IconButton>
            </Toolbar>
          </Container>
        </StyledAppBar>
      </HideOnScroll>
      <MobileDrawer variant="temporary" anchor="right" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }}>{drawer}</MobileDrawer>
    </>
  );
};

// Hero Section Component
const HeroContainer = styled(Box)(({ theme }) => ({
  background: theme.palette.background.default,
  color: theme.palette.text.primary,
  paddingTop: theme.spacing(20),
  paddingBottom: theme.spacing(15),
  position: "relative",
  overflow: "hidden",
}));

const Hero = () => {
    const theme = useTheme();
    return (
        <HeroContainer id="hero">
        <Container maxWidth="lg">
            <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={6}>
                <RevealSlide direction="left" triggerOnce>
                <Typography variant="h2" component="h1" gutterBottom fontWeight="bold" color="text.primary" sx={{ mb: 2, lineHeight: 1.2 }}>
                    Your Financial Future,
                    <Box component="span" sx={{ color: theme.palette.secondary.light, display: "block" }}>
                    Clearly Visualized.
                    </Box>
                </Typography>
                <Typography variant="h5" paragraph color="text.secondary" sx={{ mb: 4, opacity: 0.9 }}>
                    Take control of your investments. Monitor performance, analyze strategies, and achieve your financial goals with our intuitive platform.
                </Typography>
                <Box>
                    <HeroButton variant="contained" color="secondary" size="large" component={RouterLink} to="/signup" endIcon={<ArrowForward />}>Get Started Free</HeroButton>
                    <HeroButton variant="outlined" color="primary" size="large" component={RouterLink} to="/login" sx={{ "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) } }}>Sign In</HeroButton>
                </Box>
                </RevealSlide>
            </Grid>
            <Grid item xs={12} md={6}>
                <RevealSlide direction="right" triggerOnce>
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative", mt: { xs: 4, md: 0 } }}>
                    <Insights sx={{ fontSize: { xs: 200, sm: 300, md: 400 }, color: alpha(theme.palette.primary.main, 0.2) }} />
                </Box>
                </RevealSlide>
            </Grid>
            </Grid>
        </Container>
        </HeroContainer>
    );
};

// Features Section Component
const FeatureItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4), textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.02) : theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  transition: "transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out",
  height: '100%',
  "&:hover": { transform: "translateY(-8px)", boxShadow: theme.shadows[theme.palette.mode === "dark" ? 6 : 10], borderColor: theme.palette.primary.main },
}));
const FeatureIconWrapper = styled(Avatar)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main,
  width: theme.spacing(8), height: theme.spacing(8), marginBottom: theme.spacing(2.5),
  "& .MuiSvgIcon-root": { fontSize: theme.spacing(4.5) },
}));

const FeaturesSection = () => (
    <Box id="features" sx={{ py: 10 }}>
        <Container maxWidth="lg">
        <Fade direction="up" triggerOnce>
            <SectionTitle variant="h3" component="h2" align="center" sx={{ mb: 6 }}>Unlock Powerful Investment Tools</SectionTitle>
        </Fade>
        <Box sx={{ display: "grid", gap: 4, justifyContent: "center", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {features.map((feature, index) => (
            <Fade key={feature.title} direction="up" delay={index * 100} triggerOnce>
                <FeatureItem elevation={0}>
                <FeatureIconWrapper>{feature.icon}</FeatureIconWrapper>
                <Typography variant="h6" component="h3" gutterBottom fontWeight="medium" color="text.primary">{feature.title}</Typography>
                <Typography variant="body2" color="text.secondary">{feature.description}</Typography>
                </FeatureItem>
            </Fade>
            ))}
        </Box>
        </Container>
    </Box>
);

// --- NEW --- Visual Features Section (from FeaturesPage)
const VisualFeatureCard = styled(Card)(({ theme }) => ({
    textAlign: 'center',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius * 2,
    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
    '&:hover': {
        transform: 'translateY(-8px)',
        boxShadow: theme.shadows[theme.palette.mode === "dark" ? 6 : 10],
    }
}));

const VisualFeaturesSection = () => {
    const theme = useTheme();
    return (
        <Box sx={{ py: 10, bgcolor: 'background.paper' }}>
            <Container maxWidth="lg">
                <Box textAlign="center">
                    <Fade direction="up" triggerOnce>
                        <SectionTitle variant="h3" component="h2">
                            Explore Our Powerful Features
                        </SectionTitle>
                        <SectionSubtitle variant="h6">
                            Discover how we help you grow and manage your portfolio efficiently.
                        </SectionSubtitle>
                    </Fade>
                </Box>
                <Grid container spacing={4}>
                    {visualFeatures.map((feature, index) => (
                        <Grid item xs={12} md={4} key={index}>
                            <Fade direction="up" delay={index * 150} triggerOnce>
                                <VisualFeatureCard elevation={0}>
                                    <Box sx={{ 
                                        color: 'primary.main', 
                                        pt: 5, 
                                        pb: 3, 
                                        bgcolor: alpha(theme.palette.primary.main, 0.05) 
                                    }}>
                                        {feature.icon}
                                    </Box>
                                    <CardContent sx={{ p: 3, flexGrow: 1 }}>
                                        <Typography variant="h5" component="h3" fontWeight="bold" gutterBottom>
                                            {feature.title}
                                        </Typography>
                                        <Typography color="text.secondary">
                                            {feature.description}
                                        </Typography>
                                    </CardContent>
                                </VisualFeatureCard>
                            </Fade>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
};


// How It Works Section
const HowItWorksStep = styled(Box)(({ theme }) => ({
  textAlign: "center", padding: theme.spacing(3),
  "& .MuiSvgIcon-root": { fontSize: theme.spacing(7), color: theme.palette.secondary.main, marginBottom: theme.spacing(2) },
}));

const HowItWorksSection = () => {
    const theme = useTheme();
    return (
        <Box id="how-it-works" sx={{ py: 10, bgcolor: "background.default" }}>
            <Container maxWidth="md">
            <Fade direction="up" triggerOnce>
                <SectionTitle variant="h3" component="h2" align="center" sx={{ mb: 6 }}>Get Started in 3 Simple Steps</SectionTitle>
            </Fade>
            <Grid container spacing={5} justifyContent="center">
                {howItWorksSteps.map((step, index) => (
                <Grid item xs={12} sm={4} key={step.title}>
                    <Fade direction="up" delay={index * 150} triggerOnce>
                    <HowItWorksStep>
                        <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", fontSize: "1.2rem", fontWeight: "bold" }}>{index + 1}</Box>
                        {step.icon}
                        <Typography variant="h6" component="h3" gutterBottom fontWeight="medium" color="text.primary">{step.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{step.description}</Typography>
                    </HowItWorksStep>
                    </Fade>
                </Grid>
                ))}
            </Grid>
            </Container>
        </Box>
    );
};

// Pricing Section
const PricingCard = styled(Paper)(({ theme, popular }) => ({
  padding: theme.spacing(4), textAlign: "center", borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.background.paper, border: popular ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
  position: "relative", transition: "all 0.3s ease-in-out",
  "&:hover": { transform: "translateY(-8px)", boxShadow: theme.shadows[theme.palette.mode === "dark" ? 8 : 12] },
}));
const PopularBadge = styled(Box)(({ theme }) => ({
  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
  backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText,
  padding: theme.spacing(0.5, 2), borderRadius: theme.shape.borderRadius * 3,
  fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase",
}));
const BillingToggle = styled(Box)(({ theme }) => ({
  display: "flex", backgroundColor: theme.palette.background.default, // Changed to default
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius * 3,
  padding: theme.spacing(0.5), justifyContent: "center",
}));
const ToggleButton = styled(Button)(({ theme, active }) => ({
  textTransform: "none", fontWeight: 600, padding: theme.spacing(1, 3),
  borderRadius: theme.shape.borderRadius * 2.5,
  backgroundColor: active ? theme.palette.primary.main : "transparent",
  color: active ? theme.palette.primary.contrastText : theme.palette.text.primary,
  "&:hover": { backgroundColor: active ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.08) },
}));

const PricingSection = () => {
    const theme = useTheme();
    const [billingCycle, setBillingCycle] = useState("monthly");

    return (
        <Box id="pricing" sx={{ py: 10, bgcolor: "background.paper" }}>
            <Container maxWidth="lg">
            <Fade direction="up" triggerOnce>
                <Box textAlign="center">
                    <SectionTitle variant="h3" component="h2">Simple, Transparent Pricing</SectionTitle>
                    <SectionSubtitle variant="h6">
                        Choose the plan that fits your investment journey. Start free and upgrade as you grow.
                    </SectionSubtitle>
                </Box>
            </Fade>

            <Fade direction="up" delay={100} triggerOnce>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 6 }}>
                <BillingToggle>
                    <ToggleButton active={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")}>Monthly</ToggleButton>
                    <ToggleButton active={billingCycle === "yearly"} onClick={() => setBillingCycle("yearly")}>Yearly
                    <Box component="span" sx={{ ml: 1, px: 1, py: 0.25, bgcolor: "success.main", color: "success.contrastText", borderRadius: 1, fontSize: "0.7rem", fontWeight: "bold" }}>Save 17%</Box>
                    </ToggleButton>
                </BillingToggle>
                </Box>
            </Fade>

            <Grid container spacing={4} justifyContent="center" alignItems="stretch">
                {pricingData[billingCycle].map((plan, index) => (
                <Grid item xs={12} sm={6} md={5} key={plan.title}>
                    <Fade direction="up" delay={index * 150} triggerOnce>
                    <PricingCard elevation={0} popular={plan.popular} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        {plan.popular && <PopularBadge>Most Popular</PopularBadge>}
                        <Box sx={{ flexGrow: 1}}>
                            <Typography variant="h5" component="h3" fontWeight="bold" color="text.primary" gutterBottom>{plan.title}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{plan.subtitle}</Typography>
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h3" component="div" fontWeight="bold" color="text.primary" sx={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
                                    {plan.price}
                                    <Typography variant="h6" component="span" color="text.secondary" sx={{ ml: 1 }}>/{billingCycle === "monthly" ? "month" : "year"}</Typography>
                                </Typography>
                                {plan.originalPrice && <Typography variant="body2" color="text.secondary" sx={{ textDecoration: "line-through", mt: 0.5 }}>{plan.originalPrice}/year</Typography>}
                            </Box>
                            <List sx={{ mb: 4, p:0 }}>
                            {plan.features.map((feature, i) => (
                                <ListItem key={i} sx={{ py: 0.5, px: 0 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}><CheckCircleOutline sx={{ fontSize: 20, color: plan.popular ? "primary.main" : "success.main" }} /></ListItemIcon>
                                <ListItemText primary={feature} primaryTypographyProps={{ variant: "body2", color: "text.primary" }}/>
                                </ListItem>
                            ))}
                            </List>
                        </Box>
                        <Button variant={plan.popular ? "contained" : "outlined"} color="primary" fullWidth size="large" component={RouterLink} to={plan.title === "Free" ? "/signup" : "/signup?plan=premium"}
                        sx={{ mt: 'auto', textTransform: "none", fontWeight: 600, py: 1.5, borderRadius: theme.shape.borderRadius * 2, ...(plan.popular && { background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`, "&:hover": { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` } })}}>
                        {plan.title === "Free" ? "Get Started Free" : "Start Premium Trial"}
                        </Button>
                    </PricingCard>
                    </Fade>
                </Grid>
                ))}
            </Grid>

            <Fade direction="up" delay={300} triggerOnce>
                <Box sx={{ textAlign: "center", mt: 6 }}>
                <Typography variant="body2" color="text.secondary">All plans include a 30-day money-back guarantee. No questions asked.</Typography>
                </Box>
            </Fade>
            </Container>
        </Box>
    )
};

// Why Trust Us Section
const WhyTrustUsSection = () => {
    const theme = useTheme();
    return (
        <Box sx={{ py: 10, bgcolor: "background.default" }}>
            <Container maxWidth="lg">
            <Fade direction="up" triggerOnce><SectionTitle variant="h3" component="h2" align="center" sx={{ mb: 6 }}>Why Investors Trust Us</SectionTitle></Fade>
            <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={6}>
                    <Fade direction="left" triggerOnce>
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <VerifiedUser sx={{ fontSize: { xs: 200, sm: 250, md: 300 }, color: alpha(theme.palette.secondary.main, 0.2) }} />
                        </Box>
                    </Fade>
                </Grid>
                <Grid item xs={12} md={6}>
                <Fade direction="right" triggerOnce>
                    <List>
                    {whyTrustUsItems.map((item) => (
                        <ListItem key={item.primary} sx={{ py: 1.5 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.primary} secondary={item.secondary} primaryTypographyProps={{ fontWeight: "medium", color: "text.primary" }} secondaryTypographyProps={{ color: "text.secondary" }}/>
                        </ListItem>
                    ))}
                    </List>
                </Fade>
                </Grid>
            </Grid>
            </Container>
        </Box>
    )
};

// Call To Action Section
const CallToActionSection = () => (
    <Box sx={{ py: 10, bgcolor: "background.paper" }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Fade direction="up" triggerOnce>
          <Typography variant="h3" component="h2" gutterBottom fontWeight="bold" color="text.primary">
            Ready to Elevate Your Investment Strategy?
          </Typography>
        </Fade>
        <Fade direction="up" delay={100} triggerOnce>
          <Typography variant="h6" color="text.secondary" paragraph sx={{ mb: 4 }}>
            Join thousands of investors who are making smarter decisions. Sign up today and take the first step towards financial clarity.
          </Typography>
        </Fade>
        <Fade direction="up" delay={200} triggerOnce>
          <HeroButton variant="contained" color="primary" size="large" component={RouterLink} to="/signup" endIcon={<ArrowForward />}>
            Start Tracking for Free
          </HeroButton>
        </Fade>
      </Container>
    </Box>
);

// Footer Section
const PageFooterContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.secondary,
  padding: theme.spacing(4, 2),
  textAlign: "center",
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const PageFooter = () => (
    <PageFooterContainer>
      <Container maxWidth="lg">
        <Typography variant="body2">© {new Date().getFullYear()} InvestTracker. All rights reserved.</Typography>
        <Box sx={{ mt: 1 }}>
          <Button component={RouterLink} to="/privacy" color="inherit" size="small" sx={{ textTransform: "none", mx: 1 }}>Privacy Policy</Button>
          <Button component={RouterLink} to="/terms" color="inherit" size="small" sx={{ textTransform: "none", mx: 1 }}>Terms of Service</Button>
        </Box>
      </Container>
    </PageFooterContainer>
);

// --- Main LandingPage Component ---
const LandingPage = () => {
  return (
    <Box sx={{ overflowX: "hidden", bgcolor: "background.default" }}>
      <NavigationBar />
      <main>
        <Hero />
        <FeaturesSection />
        <VisualFeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <WhyTrustUsSection />
        <CallToActionSection />
      </main>
      <PageFooter />
    </Box>
  );
};

export default LandingPage;