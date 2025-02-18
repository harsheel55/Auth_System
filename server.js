const https = require('https');
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const crypto = require('crypto');
const User = require('./models/User');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Connect to the database
connectDB("Database successfully connected");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Twilio Setup
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Passport Google OAuth setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await User.findOrCreate({ googleId: profile.id });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

app.use(passport.initialize());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Google OAuth routes
app.get('/auth/google', 
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Sign Up Route
app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;

  // Validate password length
  if (password.length < 8) {
    return res.status(400).send('Password must be at least 8 characters long');
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('Email already exists');
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      isVerified: false,
      isPhoneVerified: false,
      verificationToken,
    });

    // Save user to database
    await newUser.save();

    // Send verification email
    const verificationUrl = `http://localhost:${process.env.PORT}/verify-email/${verificationToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification',
      text: `Please verify your email by clicking on the following link: ${verificationUrl}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        return res.status(500).send('Error sending email');
      }
      res.status(200).send('User created successfully, please check your email to verify your account');
    });
  } catch (error) {
    res.status(500).send('Error during sign up');
  }
});

// Verify Email Route
app.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).send('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).send('Email verified successfully');
  } catch (error) {
    res.status(500).send('Error verifying email');
  }
});

// Mobile Verification Route (using Twilio)
app.post('/verify-phone', async (req, res) => {
  const { phone } = req.body;
  
  // Generate random OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  try {
    // Send OTP via SMS using Twilio
    const message = await twilioClient.messages.create({
      body: `Your verification code is ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    res.status(200).send('OTP sent successfully');
  } catch (error) {
    res.status(500).send('Error sending OTP');
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send('Invalid credentials');
    }

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(400).send('Please verify your email before logging in');
    }

    res.status(200).send('Login successful');
  } catch (error) {
    res.status(500).send('Error during login');
  }
});

// HTTPS options for server
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
};

const PORT = process.env.PORT || 3000;

https.createServer(options, app).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
