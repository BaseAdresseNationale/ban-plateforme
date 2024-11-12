import nodemailer from 'nodemailer'

const {SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD} = process.env

// Set up SMTP transporter
export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD
  }
})
