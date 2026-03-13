"""
Authentication Module.

This module handles password hashing, token creation/verification, and current user retrieval.
It uses OAuth2 with Password Flow and JWT tokens.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, crud, schemas
from database import get_db
import os
import pyotp
from cryptography.fernet import Fernet
import secrets

# Secret key for JWT signing. 
# WARNING: In production, this must be a strong secret loaded from environment variables.
SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # Reduced for security with Refresh Tokens
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Encryption key for OTP secrets
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
fernet = Fernet(ENCRYPTION_KEY.encode())

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def encrypt_secret(secret: str) -> str:
    return fernet.encrypt(secret.encode()).decode()

def decrypt_secret(encrypted_secret: str) -> str:
    return fernet.decrypt(encrypted_secret.encode()).decode()

def verify_password(plain_password, hashed_password):
    """Verifies a plain:hashed password match."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Generates a Bcrypt hash for a password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JWT access token with an expiration time."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    """Creates a long-lived JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh", "jti": secrets.token_hex(16)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_user_tokens(user_email: str):
    """
    Utility to generate both access and refresh tokens for a user.
    Used during login and impersonation.
    """
    access_token = create_access_token(data={"sub": user_email})
    refresh_token = create_refresh_token(data={"sub": user_email})
    return access_token, refresh_token

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
        
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    
    # Check if this is a restricted token (2FA pending)
    # The login endpoint will issue a token with scope="2fa_pending"
    # Endpoints requiring full auth should use get_verified_user
    return user

async def get_verified_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Returns user only if token is fully authenticated (not 2fa_pending).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    two_fa_exception = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="2FA Verification Required",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        scope: str = payload.get("scope", "")
        print(f"DEBUG: auth check - email={email} scope={scope}")
        if email is None:
            raise credentials_exception
        if scope == "2fa_pending":
             raise two_fa_exception
             
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
        
    user = crud.get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

# --- TOTP 2FA Logic ---

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def get_totp_uri(secret: str, email: str, issuer_name: str = "Vesotel System") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer_name)

def verify_totp_code(secret: str, code: str) -> bool:
    totp = pyotp.totp.TOTP(secret)
    return totp.verify(code)

# --- Session Management ---

def create_session(db: Session, user_id: str, refresh_token: str, device_name: str = None, ip_address: str = None):
    session = models.UserSession(
        user_id=user_id,
        refresh_token=refresh_token,
        device_name=device_name,
        ip_address=ip_address,
        last_active=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    return session

def get_session_by_token(db: Session, refresh_token: str):
    return db.query(models.UserSession).filter(
        models.UserSession.refresh_token == refresh_token,
        models.UserSession.is_active == True
    ).first()

def revoke_session(db: Session, refresh_token: str):
    session = get_session_by_token(db, refresh_token)
    if session:
        session.is_active = False
        db.commit()
    return session

# TOTP is now the primary 2FA method. Legacy email-based 2FA logic removed.

# Legacy Device Token logic removed in favor of UserSession
