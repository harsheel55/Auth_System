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
  try {
    console.log("Signup request received:", req.body);

    const { firstName, lastName, email, password, mobile } = req.body;
    if (!firstName || !lastName || !email || !password || !mobile) {
      return res.status(400).send('All fields are required');
    }

    const existingUser = await User.findOne({ email });
    console.log("Existing user:", existingUser);

    if (existingUser) {
      return res.status(400).send('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    const verificationToken = crypto.randomBytes(20).toString('hex');

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      mobile,
      isVerified: false,
      isPhoneVerified: false,
      verificationToken,
    });

    await newUser.save();
    console.log("User saved successfully");

    const verificationUrl = `http://localhost:${process.env.PORT}/verify-email/${verificationToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification',
      text: `Verify your email: ${verificationUrl}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Email sending error:", err);
        return res.status(500).send(`Error sending email: ${err.message}`);
      }
      res.status(200).send('User created successfully, check email');
    });

  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send(error.message);
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
  const { mobile } = req.body;
  
  // Generate random OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  try {
    // Send OTP via SMS using Twilio
    const message = await twilioClient.messages.create({
      body: `Your verification code is ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: mobile,
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
