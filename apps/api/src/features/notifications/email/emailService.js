
import nodemailer from 'nodemailer';
import { log } from '../../../shared/logging/logger.js';

// Create transporter lazily (on first use)
let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        const config = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };

        // Skip auth if no user provided (for development/testing)
        if (!config.auth.user) {
            delete config.auth;
        }

        transporter = nodemailer.createTransport(config);
    }
    return transporter;
};

/**
 * Send an email with retry logic
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    const fromAddress = process.env.SMTP_FROM || 'IT-Hub <noreply@example.com>';

    // Skip if SMTP not configured
    if (!process.env.SMTP_HOST) {
        log.warn('SMTP not configured, skipping email send', { to, subject });
        return { success: false, error: 'SMTP not configured' };
    }

    const mailOptions = {
        from: fromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text
    };

    try {
        const result = await getTransporter().sendMail(mailOptions);
        log.info('Email sent successfully', {
            messageId: result.messageId,
            to: mailOptions.to,
            subject
        });
        return { success: true, messageId: result.messageId };
    } catch (error) {
        log.error('Failed to send email', {
            error: error.message,
            to: mailOptions.to,
            subject
        });

        // One retry after 5 seconds
        // NOTE: In production code, we might want to avoid await in the request handler if this is blocking.
        // But the task requirements specified retry logic.
        // For testing purposes, we might need to adjust this delay or mock it.
        // Using 100ms for test environment if detected might be better, but sticking to logic.
        // Actually, for tests, we can't easily skip the wait unless we mock setTimeout.
        // I will stick to the delay but the test has a 10s timeout, so 5s delay is fine.

        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
            const retryResult = await getTransporter().sendMail(mailOptions);
            log.info('Email sent on retry', { messageId: retryResult.messageId });
            return { success: true, messageId: retryResult.messageId };
        } catch (retryError) {
            log.error('Email failed after retry', { error: retryError.message });
            return { success: false, error: retryError.message };
        }
    }
};

// For testing - allows injecting a mock transporter
export const __setTransporter = (mockTransporter) => {
    transporter = mockTransporter;
};
