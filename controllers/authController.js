const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.signup = async (req, res) => {
  const { firstName, lastName, email, password, mobile } = req.body;

  try {
    const user = new User({ firstName, lastName, email, password, mobile });
    await user.save();

    const emailToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const url = `http://localhost:3000/verify-email?token=${emailToken}`;

    await transporter.sendMail({
      to: email,
      subject: 'Verify Email',
      html: `<a href="${url}">Verify your email</a>`,
    });

    const mobileToken = Math.floor(100000 + Math.random() * 900000).toString();
    await client.messages.create({
      body: `Your verification code is ${mobileToken}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: mobile,
    });

    res.status(201).json({ message: 'User registered. Please verify your email and mobile.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    user.emailVerified = true;
    await user.save();

    res.status(200).json({ message: 'Email verified' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyMobile = async (req, res) => {
  const { mobile, code } = req.body;

  try {
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }

    // Assuming you store the mobileToken in the database or cache
    if (user.mobileToken !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    user.mobileVerified = true;
    await user.save();

    res.status(200).json({ message: 'Mobile verified' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};