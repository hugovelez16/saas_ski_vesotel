from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List
import os

conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM = os.getenv("MAIL_FROM", "noreply@vesotel.com"),
    MAIL_PORT = int(os.getenv("MAIL_PORT", 1025)),
    MAIL_SERVER = os.getenv("MAIL_SERVER", "localhost"),
    MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Vesotel"),
    MAIL_STARTTLS = os.getenv("MAIL_STARTTLS", "False").lower() == "true",
    MAIL_SSL_TLS = os.getenv("MAIL_SSL_TLS", "False").lower() == "true",
    USE_CREDENTIALS = os.getenv("USE_CREDENTIALS", "False").lower() == "true",
    VALIDATE_CERTS = os.getenv("VALIDATE_CERTS", "False").lower() == "true",
)


def get_html_template(title: str, body_content: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ max-width: 150px; }}
            .content {{ background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }}
            .code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #D32F2F; text-align: center; margin: 20px 0; display: block; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #888; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #D32F2F; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }}
            h1 {{ color: #1a1a1a; margin-top: 0; }}
            p {{ margin-bottom: 15px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h2 style="color: #D32F2F; font-weight: 800; font-size: 24px; margin: 0;">VESOTEL</h2>
        </div>
        <div class="content">
            <h1>{title}</h1>
            {body_content}
        </div>
        <div class="footer">
            <p>&copy; 2026 Vesotel Gestor Jornada. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </body>
    </html>
    """

async def send_2fa_code(email: EmailStr, code: str):
    html_content = get_html_template(
        "Verification Code",
        f"""
        <p>Hello,</p>
        <p>Use the following code to complete your login verification. This code is valid for 15 minutes.</p>
        <div class="code">{code}</div>
        <p>If you did not request this code, please ignore this email.</p>
        """
    )
    
    message = MessageSchema(
        subject="Your Vesotel Verification Code",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"SMTP ERROR: {str(e)}")
        raise e
# Legacy send_2fa_code removed. TOTP does not require per-login email.

async def send_welcome_email(email: EmailStr, password: str):
    html_content = get_html_template(
        "Welcome to Vesotel",
        f"""
        <p>Hello,</p>
        <p>Welcome to <strong>Vesotel</strong>! Your account has been successfully created.</p>
        <p>Here are your temporary credentials:</p>
        <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> {email}</p>
            <p style="margin: 0;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 1.1em; background: #eee; padding: 2px 6px; border-radius: 3px;">{password}</span></p>
        </div>
        <p>Please change your password immediately after logging in.</p>
            <a href="https://clasesski.vesotel.com" class="button" style="color: white;">Log In Now</a>
        </div>
        """
    )
    
    message = MessageSchema(
        subject="Welcome to Vesotel Team",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    fm = FastMail(conf)
    await fm.send_message(message)

async def send_notification_email(email: EmailStr, subject: str, message_text: str, action_url: str = "https://clasesski.vesotel.com"):
    html_content = get_html_template(
        subject,
        f"""
        <p>Hello,</p>
        <p>{message_text}</p>
        <div style="text-align: center; margin-top: 25px;">
            <a href="{action_url}" class="button" style="color: white;">View Dashboard</a>
        </div>
        """
    )
    
    message = MessageSchema(
        subject=f"Vesotel Notification: {subject}",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        print(f"SMTP ERROR: {str(e)}") 
        # Don't raise, just log, so we don't block the main action
