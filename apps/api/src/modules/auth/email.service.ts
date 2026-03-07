import nodemailer from 'nodemailer';
import { loadConfig } from '@openvault/config';

const config = loadConfig();

// Create a transporter using SMTP or falling back to a mock for development
const transporter = nodemailer.createTransport({
    host: config.smtp?.host || 'smtp.ethereal.email',
    port: config.smtp?.port || 587,
    secure: config.smtp?.secure || false, // true for 465, false for other ports
    auth: {
        user: config.smtp?.user || 'test',
        pass: config.smtp?.pass || 'test',
    },
});

export const sendActivationEmail = async (email: string, name: string, activationUrl: string) => {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e0e0e0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: #EEF2FF; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                    <span style="font-size: 32px;">✉️</span>
                </div>
                <h1 style="color: #1F2937; font-size: 24px; margin: 0;">Welcome to OpenVault, ${name}!</h1>
            </div>
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Thank you for creating your account. Please click the button below to activate your account and start using OpenVault.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${activationUrl}" style="background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Activate My Account</a>
            </div>
            <p style="color: #6B7280; font-size: 13px; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${activationUrl}" style="color: #4F46E5; word-break: break-all;">${activationUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                This link expires in 10 minutes. If you did not create an account, please ignore this email.<br/>
                &copy; ${new Date().getFullYear()} OpenVault. All rights reserved.
            </p>
        </div>
    </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"OpenVault" <${config.smtp?.user}>`,
            to: email,
            subject: 'Activate Your OpenVault Account',
            html: htmlContent,
        });
        console.log('Activation email sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send activation email:', error);
    }
};

export const sendPasswordResetEmail = async (email: string, code: string) => {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e0e0e0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: #EEF2FF; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                    <span style="font-size: 32px;">🔑</span>
                </div>
                <h1 style="color: #1F2937; font-size: 24px; margin: 0;">Password Reset</h1>
            </div>
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                We received a request to reset your OpenVault password. Use the verification code below to proceed with your password reset.
            </p>
            <div style="background: #F3F4F6; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="color: #6B7280; font-size: 13px; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Your Verification Code</p>
                <span style="color: #1F2937; font-size: 36px; font-weight: bold; letter-spacing: 10px; display: block;">${code}</span>
                <p style="color: #9CA3AF; font-size: 12px; margin: 12px 0 0 0;">This code expires in 10 minutes</p>
            </div>
            <p style="color: #6B7280; font-size: 14px; line-height: 1.5;">
                Enter this code on the password reset page to set your new password. If you did not request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                &copy; ${new Date().getFullYear()} OpenVault. All rights reserved.
            </p>
        </div>
    </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: '"OpenVault Security" <noreply@openvault.com>',
            to: email,
            subject: 'Your Password Reset Code — OpenVault',
            html: htmlContent,
        });
        console.log('Password reset email sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send password reset email:', error);
    }
};

export const sendSecondaryVerificationCode = async (email: string, code: string) => {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e0e0e0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: #EEF2FF; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                    <span style="font-size: 32px;">🔐</span>
                </div>
                <h1 style="color: #1F2937; font-size: 24px; margin: 0;">Secondary Verification</h1>
            </div>
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                You requested a secondary verification code. Use the code below to complete the action.
            </p>
            <div style="background: #F3F4F6; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="color: #6B7280; font-size: 13px; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Your Code</p>
                <span style="color: #1F2937; font-size: 36px; font-weight: bold; letter-spacing: 10px; display: block;">${code}</span>
                <p style="color: #9CA3AF; font-size: 12px; margin: 12px 0 0 0;">Do not share this code with anyone</p>
            </div>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                &copy; ${new Date().getFullYear()} OpenVault. All rights reserved.
            </p>
        </div>
    </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: '"OpenVault Security" <noreply@openvault.com>',
            to: email,
            subject: 'Your Verification Code — OpenVault',
            html: htmlContent,
        });
        console.log('Secondary verification email sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send secondary verification email:', error);
    }
};

export const sendLoginVerificationCode = async (email: string, code: string) => {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e0e0e0;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: #EEF2FF; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                    <span style="font-size: 32px;">🔐</span>
                </div>
                <h1 style="color: #1F2937; font-size: 24px; margin: 0;">Login Verification</h1>
            </div>
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Someone is trying to log in to your OpenVault account. Use the verification code below to complete sign-in.
            </p>
            <div style="background: #F3F4F6; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="color: #6B7280; font-size: 13px; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Code</p>
                <span style="color: #1F2937; font-size: 36px; font-weight: bold; letter-spacing: 10px; display: block;">${code}</span>
                <p style="color: #9CA3AF; font-size: 12px; margin: 12px 0 0 0;">This code expires in 10 minutes</p>
            </div>
            <p style="color: #6B7280; font-size: 14px; line-height: 1.5;">
                If you did not attempt to log in, please change your password immediately as someone may have your credentials.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                &copy; ${new Date().getFullYear()} OpenVault. All rights reserved.
            </p>
        </div>
    </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: '"OpenVault Security" <noreply@openvault.com>',
            to: email,
            subject: 'Your Login Verification Code — OpenVault',
            html: htmlContent,
        });
        console.log('Login verification email sent: %s', info.messageId);
    } catch (error) {
        console.error('Failed to send login verification email:', error);
    }
};
