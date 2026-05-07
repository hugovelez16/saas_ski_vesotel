"""
Main API Application Module.

This module defines the FastAPI application, API endpoints, and middleware configuration.
It serves as the entry point for the backend service.
"""
from fastapi import FastAPI, Depends, HTTPException, status, Form, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Any
from uuid import UUID
from datetime import timedelta, datetime, date
import crud, models, schemas, auth, email_utils, os, asyncio
from database import SessionLocal, engine, get_db
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
# import shopify_routes

# Create tables if they don't exist (Legacy approach, now using Alembic)
# models.Base.metadata.create_all(bind=engine)

def check_manager_access(db: Session, manager: models.User, target_user_id: str) -> bool:
    """
    SRE: Check if manager has active manager scope for target user's company.
    """
    is_platform_admin = getattr(manager, "is_platform_admin", False)
    if is_platform_admin:
        return True
        
    active_cid = getattr(manager, "active_company_id", None)
    active_role = getattr(manager, "active_role", None)
    
    if not active_cid or active_role != "manager":
        return False
        
    # Check if target_user is a member of THIS active company
    access = db.query(models.CompanyMember).filter(
        models.CompanyMember.user_id == target_user_id,
        models.CompanyMember.company_id == active_cid,
        models.CompanyMember.is_active == True
    ).first()
    
    return bool(access)

def is_manager_of_company(db: Session, user: models.User, company_id: Any) -> bool:
    """
    SRE: Check if user has active manager scope in the specified company.
    """
    if getattr(user, "is_platform_admin", False):
        return True
        
    active_cid = getattr(user, "active_company_id", None)
    active_role = getattr(user, "active_role", None)
    
    if str(active_cid) == str(company_id) and active_role == "manager":
        return True
        
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI.
    Handles startup logic (waiting for DB) and shutdown logic.
    """
    # Database readiness check (Wait for DB)
    # Total timeout: 60 seconds (30 retries * 2 seconds)
    retries = 30
    print("Checking database connection...")
    while retries > 0:
        try:
            db = SessionLocal()
            # Simple query to validate connection
            db.execute(text("SELECT 1"))
            db.close()
            print("Database connection established successfully.")
            break
        except OperationalError:
            retries -= 1
            if retries == 0:
                print("Could not connect to database after 60 seconds. Exiting.")
                # The app will likely fail to start properly, but we've tried our best.
                break
            print(f"Database not ready yet. Retrying in 2 seconds... ({retries} attempts remaining)")
            await asyncio.sleep(2)
    
    yield
    # Shutdown logic can be added here if needed (e.g. closing Redis connections)

app = FastAPI(
    title="Vesotel Gestor Jornada API",
    description="API for managing work logs and user settings.",
    root_path="/api",
    lifespan=lifespan
)
# app.include_router(shopify_routes.router)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    origin = request.headers.get("origin")
    print(f"Incoming Request: {request.method} {request.url.path} | Origin: {origin}")
    try:
        return await call_next(request)
    except Exception as e:
        print(f"Request Failed: {e}")
        raise e

# CORS Configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [origin.strip() for origin in allowed_origins_env.split(",")] if allowed_origins_env else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """
    Step 1: Validate email/password.
    If 2FA is enabled, return provisional token.
    Otherwise, create session and return full tokens.
    """
    user = crud.get_user_by_email(db, form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if 2FA is required
    if user.is_2fa_enabled:
        # Issue provisional token (short lived, specific scope)
        # SRE: Use user ID as sub
        provisional_token = auth.create_access_token(
            data={"sub": str(user.id), "scope": "2fa_pending"},
            expires_delta=timedelta(minutes=5)
        )
        # Set provisional access token as cookie
        response.set_cookie(
            key="access_token",
            value=provisional_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=300 # 5 mins
        )
        return {
            "access_token": "cookie", # Signal that it's in a cookie
            "token_type": "bearer",
            "requires_2fa": True
        }

    # No 2FA: Create full session with default scope
    access_token, refresh_token = auth.generate_user_tokens(db, user)
    
    # Store session in DB
    auth.create_session(
        db, 
        user_id=str(user.id), 
        refresh_token=refresh_token,
        device_name=request.headers.get("user-agent"),
        ip_address=request.client.host
    )
    
    # Set HttpOnly Cookies for both tokens
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True, 
        samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

    return {
        "access_token": "cookie", 
        "token_type": "bearer",
        "requires_2fa": False
    }

# Legacy email-based /resend-2fa removed. TOTP provides self-contained timing.

@app.post("/verify-2fa", response_model=schemas.Token)
async def verify_2fa(
    data: schemas.Verify2FA, 
    response: Response,
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Verify TOTP code and issue final tokens.
    """
    if not current_user.is_2fa_enabled or not current_user.otp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled for this user")
    
    # Decrypt secret
    decrypted_secret = auth.decrypt_secret(current_user.otp_secret)
    
    if not auth.verify_totp_code(decrypted_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Issue Full Tokens with default scope
    access_token, refresh_token = auth.generate_user_tokens(db, current_user)
    
    # Create Session
    auth.create_session(
        db, 
        user_id=str(current_user.id), 
        refresh_token=refresh_token,
        device_name=request.headers.get("user-agent"),
        ip_address=request.client.host
    )

    # Cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

    return {
        "access_token": "cookie", 
        "token_type": "bearer",
        "requires_2fa": False
    }

@app.post("/refresh-token")
async def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    session = auth.get_session_by_token(db, refresh_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or revoked session")
    
    # Verify JWT integrity & expiry
    try:
        # SRE: Use PUBLIC_KEY and RS256
        payload = auth.jwt.decode(refresh_token, auth.PUBLIC_KEY, algorithms=[auth.ALGORITHM])
        if payload.get("type") != "refresh":
             raise auth.JWTError()
        user_id = payload.get("sub")
    except auth.JWTError:
        auth.revoke_session(db, refresh_token)
        raise HTTPException(status_code=401, detail="Token expired or corrupted")
    
    # Issue new Access Token matching current context if possible
    # We can fetch the user and generate new tokens
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Try to extract current cid/role from headers/cookies if needed, 
    # but for refresh we'll just stick to defaults or last known.
    # Actually, generate_user_tokens defaults are fine here.
    new_access_token, _ = auth.generate_user_tokens(db, user)
    
    # Set as cookie
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {"access_token": "cookie", "token_type": "bearer"}

@app.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    # 1. Get tokens from cookies
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    
    # 2. Blacklist Access Token (if exists)
    if access_token:
        auth.blacklist_token(access_token)
        
    # 3. Revoke Session in DB (if exists)
    if refresh_token:
        auth.revoke_session(db, refresh_token)
        
    # 4. Clear Cookies
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("admin_access_token") # Also clear backups if any
    response.delete_cookie("admin_refresh_token")
    
    return {"message": "Logged out successfully"}

@app.post("/auth/switch-scope", response_model=schemas.Token)
async def switch_scope(
    data: schemas.TokenData, 
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """
    SaaS: Switch active company and role context.
    Issues NEW JWT cookies.
    """
    # Platform Admins can switch to ANY company and ANY role, OR reset to pure admin
    if current_user.role == models.UserRole.admin:
        if not data.company_id:
            # Special case: Reset to Admin ONLY context
            access_token, refresh_token = auth.generate_user_tokens(
                db, current_user, company_id=None, role=None, force_none=True,
                scope=getattr(current_user, "token_scope", None)
            )
        else:
            requested_role = data.company_role or "manager"
            access_token, refresh_token = auth.generate_user_tokens(
                db, current_user, company_id=data.company_id, role=requested_role,
                scope=getattr(current_user, "token_scope", None)
            )
    else:
        # Verify membership and role for regular users
        if not data.company_id:
            raise HTTPException(status_code=400, detail="company_id is required")
            
        membership = db.query(models.CompanyMember).filter(
            models.CompanyMember.user_id == current_user.id,
            models.CompanyMember.company_id == data.company_id,
            models.CompanyMember.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="You are not a member of this company")
            
        requested_role = data.company_role or "worker"
        if requested_role == "manager":
            if membership.role not in [models.CompanyRole.admin, models.CompanyRole.manager]:
                raise HTTPException(status_code=403, detail="Insufficient permissions for manager scope")
            
        access_token, refresh_token = auth.generate_user_tokens(
            db, current_user, company_id=data.company_id, role=requested_role,
            scope=getattr(current_user, "token_scope", None)
        )
    
    response.set_cookie(
        key="access_token", value=access_token, httponly=True, secure=True, samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="lax",
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    
    return {"access_token": "cookie", "token_type": "bearer", "requires_2fa": False}

@app.post("/admin/stop-impersonation")
async def stop_impersonation(
    request: Request,
    response: Response
):
    """
    SRE: Restore Admin session from backup cookies.
    """
    admin_access = request.cookies.get("admin_access_token")
    admin_refresh = request.cookies.get("admin_refresh_token")
    
    if not admin_access or not admin_refresh:
        # If no backup, just logout
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return {"message": "Impersonation ended (no backup found)"}
        
    # Restore main cookies from backups
    response.set_cookie(
        key="access_token",
        value=admin_access,
        httponly=True,
        secure=True, 
        samesite="lax",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=admin_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    
    # Clear backups
    response.delete_cookie("admin_access_token")
    response.delete_cookie("admin_refresh_token")
    
    return {"message": "Returned to admin session"}

@app.post("/admin/impersonate/{user_id}", response_model=schemas.Token)
async def impersonate_user(
    user_id: UUID,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """
    Impersonation: Global admin can log in as any user.
    """
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only global administrators can impersonate users"
        )
    
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # SRE: Backup current admin session before impersonating
    current_access = request.cookies.get("access_token")
    current_refresh = request.cookies.get("refresh_token")
    
    # Generate Hardened Tokens for the target user (ID as sub, shorter life, specific scope)
    # We use generate_user_tokens but override with shorter expiry and scope
    access_token, _ = auth.generate_user_tokens(db, target_user)
    
    # Re-decode to update scope and exp (auth.py doesn't expose it easily in generate_user_tokens)
    payload = auth.jwt.decode(access_token, auth.PRIVATE_KEY, algorithms=[auth.ALGORITHM])
    payload.update({
        "scope": "impersonated",
        "exp": datetime.utcnow() + timedelta(minutes=10)
    })
    access_token = auth.jwt.encode(payload, auth.PRIVATE_KEY, algorithm=auth.ALGORITHM)
    refresh_token = auth.create_refresh_token(data={"sub": str(target_user.id)})
    
    # Set Backup Cookies ONLY if we are starting a primary impersonation (not nested)
    # We detect this if there is no 'admin_refresh_token' already set.
    if current_access and current_refresh and not request.cookies.get("admin_refresh_token"):
        response.set_cookie(
            key="admin_access_token",
            value=current_access,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        response.set_cookie(
            key="admin_refresh_token",
            value=current_refresh,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        )
    
    # Create Session for the target user (marked as impersonated in audit)
    auth.create_session(
        db, 
        user_id=str(target_user.id), 
        refresh_token=refresh_token,
        device_name=f"IMPERSONATED by Admin ({current_user.email})",
        ip_address=request.client.host
    )
    
    # Set Cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600 # 10 mins
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

    return {
        "access_token": "cookie", 
        "token_type": "bearer",
        "requires_2fa": False
    }

@app.post("/users/", response_model=schemas.UserCreate)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    """
    db_user = auth.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.post("/work-logs", response_model=schemas.WorkLogResponse)
def create_work_log(work_log: schemas.WorkLogCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    """
    Create a new work log entry.
    """
    # Verify current_user.id matches work_log.user_id or user is manager/admin of the target company
    if str(work_log.user_id) != str(current_user.id):
        if not is_manager_of_company(db, current_user, work_log.company_id):
             raise HTTPException(status_code=403, detail="Cannot create work logs for other users")
        
    try:
        return crud.create_work_log(db=db, work_log=work_log)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/work-logs/bulk", response_model=schemas.WorkLogResponse)
def create_work_log_bulk(
    work_log_bulk: schemas.WorkLogBulkCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_verified_user)
):
    """
    Create multiple work log entries at once (for managers).
    """
    # Authorization check: must be manager of the company
    if not is_manager_of_company(db, current_user, work_log_bulk.company_id):
         raise HTTPException(status_code=403, detail="Only managers can create bulk work logs")
        
    try:
        logs = crud.create_work_log_bulk(db=db, work_log_bulk=work_log_bulk)
        return logs # Returns the first one created as a representative
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/work-logs", response_model=List[schemas.WorkLogResponse])
def read_work_logs(
    skip: int = 0, 
    limit: int = 100, 
    user_id: str = None, # Optional filter via query param
    company_id: str = None, # Optional filter via query param
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_verified_user)
):
    """
    Retrieve work logs. 
    Users can only see their own. Admins can filter by user_id or see their own if not specified.
    Supervisors can filter by company_id for their companies.
    """
    target_user_id = current_user.id
    target_company_id = company_id or getattr(current_user, "active_company_id", None)
    
    # Permission Logic
    if getattr(current_user, "is_platform_admin", False):
        # Admin can do anything
        if user_id:
            target_user_id = user_id
        else:
            target_user_id = None 
            # Existing behavior: target_user_id = current_user.id
            if not company_id and not user_id and not start_date and not end_date:
               target_user_id = current_user.id # Default to self if ABSOLUTELY no filters
        
        final_user_id = target_user_id

    else:
        # Check for Supervisor Permission dynamically (as "supervisor" role doesn't exist on User model)
        # Check if user is manager/admin of the requested company OR if they are checking availability for a user in their managed company
        is_supervisor_request = False
        
        if target_company_id:
             if is_manager_of_company(db, current_user, UUID(target_company_id) if isinstance(target_company_id, str) else target_company_id):
                 is_supervisor_request = True
                 target_user_id = None # See all logs for this company
                 if user_id:
                     target_user_id = user_id # Filter specific user in this company

        if is_supervisor_request:
             final_user_id = target_user_id
        else:
            # Regular user or Manager accessing outside their scope
            # Check generically if manager manages this user via any company
            if user_id and str(user_id) != str(current_user.id):
                 if check_manager_access(db, current_user, user_id):
                     final_user_id = user_id
                 else:
                     raise HTTPException(status_code=403, detail="Not authorized to view other users' logs")
            else:
                 final_user_id = current_user.id
    
    work_logs = crud.get_work_logs(
        db, 
        skip=skip, 
        limit=limit, 
        user_id=str(final_user_id) if final_user_id else None, 
        company_id=target_company_id,
        start_date=start_date,
        end_date=end_date
    )
    return work_logs

@app.delete("/work-logs/{work_log_id}")
def delete_work_log(work_log_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    # Verify ownership
    log = db.query(models.WorkLog).filter(models.WorkLog.id == work_log_id).first()
    if not log:
         raise HTTPException(status_code=404, detail="Work log not found")
    if str(log.user_id) != str(current_user.id) and not getattr(current_user, "is_platform_admin", False): # Assuming role field exists
         raise HTTPException(status_code=403, detail="Not authorized")
         
    crud.delete_work_log(db, work_log_id)
    return {"ok": True}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_verified_user),
    token: str = Depends(auth.get_token_from_request)
):
    # Detect impersonation from JWT scope
    is_impersonated = False
    if token:
        try:
            payload = auth.jwt.decode(token, auth.PUBLIC_KEY, algorithms=[auth.ALGORITHM])
            if payload.get("scope") == "impersonated":
                is_impersonated = True
        except:
            pass

    # Self-healing for legacy user jandrobamo
    if current_user.email == "jandrobamo@gmail.com":
        membership = db.query(models.CompanyMember).filter(
            models.CompanyMember.user_id == current_user.id
        ).first()
        
        if not membership:
            # Find Escuela Nacional
            company = db.query(models.Company).filter(models.Company.name == "Escuela Nacional").first()
            if company:
                new_member = models.CompanyMember(
                    user_id=current_user.id,
                    company_id=company.id,
                    role=models.CompanyRole.worker,
                    is_active=True
                )
                db.add(new_member)
                db.commit()
                db.refresh(current_user)

    # Compute flags (is_manager and is_active_worker)
    memberships = db.query(models.CompanyMember).filter(
        models.CompanyMember.user_id == current_user.id,
        models.CompanyMember.is_active == True
    ).all()
    
    current_user.is_manager = any(m.role in [models.CompanyRole.manager, models.CompanyRole.admin] for m in memberships)
    current_user.is_active_worker = len(memberships) > 0

    # Construct response with impersonated flag and active context
    user_data = schemas.UserResponse.model_validate(current_user)
    user_data.is_impersonated = is_impersonated
    
    # Attach transient context from auth logic
    user_data.is_platform_admin = getattr(current_user, "is_platform_admin", False)
    user_data.active_company_id = getattr(current_user, "active_company_id", None)
    user_data.active_role = getattr(current_user, "active_role", None)
    
    return user_data

@app.get("/users/me/companies", response_model=List[schemas.CompanyResponse])
def read_user_companies(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    """
    Get companies the current user is a member of.
    """
    if getattr(current_user, "is_platform_admin", False):
        companies = db.query(models.Company).all()
        results = []
        for company in companies:
            results.append({
                "id": company.id,
                "name": company.name,
                "fiscal_id": company.fiscal_id,
                "tax_config": company.tax_config,
                "worklog_definitions": company.worklog_definitions,
                "created_at": company.created_at,
                "updated_at": company.updated_at,
                "settings": company.settings if isinstance(company.settings, dict) else {},
                "role": "admin"
            })
        return results
    return crud.get_user_companies(db, str(current_user.id))

@app.get("/users/{user_id}", response_model=schemas.UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    is_platform_admin = getattr(current_user, "is_platform_admin", False)
    if not is_platform_admin and not check_supervisor_access(db, current_user, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users", response_model=List[schemas.UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@app.post("/users", response_model=schemas.UserResponse)
async def create_user_admin(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Option A: Random Password + Email
    import random
    import string
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    user.password = temp_password # Override with temp
    
    created_user = crud.create_user(db=db, user=user)
    
    # Set must_change_password
    created_user.must_change_password = True
    db.commit()
    
    # Send Email
    if user.send_email:
        await email_utils.send_welcome_email(user.email, temp_password)
    
    # Company Linkage
    if user.company_id:
        crud.join_company(db, str(created_user.id), str(user.company_id))
        created_user.default_company_id = user.company_id
        db.commit()
    
    return created_user

    return db_user

@app.put("/users/{user_id}/status")
def toggle_user_status(user_id: str, is_active: bool, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")
    user = crud.update_user_status(db, user_id=user_id, is_active=is_active)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Status updated", "is_active": user.is_active}




@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(user: schemas.UserSelfUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    # Create a full UserUpdate object but only with allowed fields
    db_user = crud.update_user(db, str(current_user.id), schemas.UserUpdate(**user.dict()))
    return db_user

@app.post("/users/me/change-password")
def change_password(data: schemas.PasswordChange, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    # Verify current password
    if not auth.verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    # Update password
    current_user.hashed_password = auth.get_password_hash(data.new_password)
    current_user.must_change_password = False
    
    db.commit()
    return {"message": "Password updated successfully"}

@app.post("/users/{user_id}/reset-password-email")
async def reset_password_via_email(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    """
    Admin only: Reset user password to a random one and email it.
    """
    if not getattr(current_user, "is_platform_admin", False):
        # Manager check? maybe later. For now Admin explicitly requested.
        # Check manager access
        is_manager = check_manager_access(db, current_user, user_id)
        if not is_manager:
             raise HTTPException(status_code=403, detail="Not authorized")

    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Generate random password
    import random
    import string
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    
    # Update User
    user.hashed_password = auth.get_password_hash(temp_password)
    user.must_change_password = True
    db.commit()
    
    # Send Email
    try:
        await email_utils.send_welcome_email(user.email, temp_password)
    except Exception as e:
        print(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email. Password was reset but email failed.")
        
    return {"message": "Password reset and email sent"}

@app.put("/work-logs/{work_log_id}", response_model=schemas.WorkLogResponse)
def update_work_log(
    work_log_id: str, 
    work_log: schemas.WorkLogCreate, 
    apply_to_group: bool = False,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_verified_user)
):
    # Verify ownership or management
    log = db.query(models.WorkLog).filter(models.WorkLog.id == work_log_id).first()
    if not log:
         raise HTTPException(status_code=404, detail="Work log not found")
         
    is_owner = str(log.user_id) == str(current_user.id)
    is_manager = is_manager_of_company(db, current_user, log.company_id)
    
    if not is_owner and not is_manager and not getattr(current_user, "is_platform_admin", False):
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Only managers/admins can apply to group
    if apply_to_group and not is_manager and not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Only managers can perform cascading updates")

    updated_log = crud.update_work_log(db, work_log_id, work_log, apply_to_group=apply_to_group)
    return updated_log

@app.get("/companies", response_model=List[schemas.CompanyResponse]) 
def read_companies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    companies = db.query(models.Company).offset(skip).limit(limit).all()
    return companies

# --- DEPRECATED: Legacy Rate Endpoints (Replaced by JSONB rates_config in CompanyMember) ---
# @app.get("/users/me/rates", response_model=List[schemas.UserCompanyRateResponse])
# def read_user_rates(company_id: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
#     query = db.query(models.UserCompanyRate).filter(models.UserCompanyRate.user_id == current_user.id)
#     if company_id:
#         query = query.filter(models.UserCompanyRate.company_id == company_id)
#     return query.all()

# @app.get("/users/{user_id}/rates", response_model=List[schemas.UserCompanyRateResponse])
# def read_user_rates_admin(user_id: str, company_id: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
#     if current_user.role != "admin" and not check_supervisor_access(db, str(current_user.id), user_id):
#         raise HTTPException(status_code=403, detail="Not authorized")
#     query = db.query(models.UserCompanyRate).filter(models.UserCompanyRate.user_id == user_id)
#     if company_id:
#         query = query.filter(models.UserCompanyRate.company_id == company_id)
#     return query.all()

# @app.put("/users/me/rates", response_model=schemas.UserCompanyRateResponse)
# def update_user_rates(rates: schemas.UserCompanyRateCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
#     return crud.update_user_rates(db, str(current_user.id), rates)

# @app.put("/users/{user_id}/rates", response_model=schemas.UserCompanyRateResponse)
# def update_user_rates_admin(user_id: str, rates: schemas.UserCompanyRateCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
#     if current_user.role != "admin" and not check_supervisor_access(db, str(current_user.id), user_id):
#         raise HTTPException(status_code=403, detail="Not authorized")
#     return crud.update_user_rates(db, user_id, rates)

@app.get("/users/{user_id}/companies", response_model=List[schemas.CompanyResponse])
def read_user_companies_admin(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    is_platform_admin = getattr(current_user, "is_platform_admin", False)
    if not is_platform_admin and not check_supervisor_access(db, current_user, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_user_companies(db, user_id, include_inactive=True)

# --- Admin Company Management ---

@app.post("/companies", response_model=schemas.CompanyResponse)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.create_company(db, company)

@app.put("/companies/{company_id}", response_model=schemas.CompanyResponse)
def update_company(company_id: str, company: schemas.CompanyUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    print(f"Update attempt for company {company_id} by user {current_user.email} (role: {current_user.role})")
    print(f"Data: {company.model_dump(exclude_unset=True)}")
    
    if not is_manager_of_company(db, current_user, company_id):
        print(f"Access denied for user {current_user.email} on company {company_id}")
        raise HTTPException(status_code=403, detail="Not authorized to update this company")
        
    db_company = crud.update_company(db, company_id, company)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return db_company



@app.get("/companies/detailed", response_model=List[schemas.CompanyWithMembers])
def read_companies_detailed(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    # If admin, return all
    if current_user.role == "admin":
        return db.query(models.Company).all()

    # If not admin, check for permissions
    # 1. Supervisor permissions (manager/admin of specific companies)
    supervisor_memberships = db.query(models.CompanyMember).filter(
        models.CompanyMember.user_id == current_user.id,
        models.CompanyMember.role.in_([models.CompanyRole.manager, models.CompanyRole.admin]),
        models.CompanyMember.is_active == True
    ).all()
    
    allowed_company_ids = {m.company_id for m in supervisor_memberships}

    # 2. Worker Daily Report permissions
    # Check if user is a member of any company that has this feature enabled
    # We can fetch all active memberships of the user
    user_memberships = db.query(models.CompanyMember).options(joinedload(models.CompanyMember.company)).filter(
        models.CompanyMember.user_id == current_user.id,
        models.CompanyMember.is_active == True
    ).all()

    for m in user_memberships:
        company = m.company # The Company relationship
        if company and company.settings:
             modules = company.settings.get("modules", {})
             if modules.get("worker_daily_report", True) is True:
                 allowed_company_ids.add(company.id)

    if allowed_company_ids:
        companies = db.query(models.Company).filter(models.Company.id.in_(allowed_company_ids)).all()
        return companies

    raise HTTPException(status_code=403, detail="Not authorized")

@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: str, user: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    if not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized")
    db_user = crud.update_user(db, user_id, user)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

# Legend Device management endpoints removed.

# --- Company Member Management ---





@app.get("/companies/{company_id}/members", response_model=List[schemas.CompanyMemberResponse])
def read_company_members(company_id: str, status: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    """
    Get members of a company. 
    Restricted to Admin or Supervisors (TODO: Supervisor check).
    For now, Admin only or members of the company?
    Let's allow Admin for now.
    """
    if not is_manager_of_company(db, current_user, company_id):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    return crud.get_company_members(db, company_id, status)

@app.post("/companies/{company_id}/members/add", response_model=schemas.CompanyMemberResponse)
def add_company_member(company_id: str, member_data: schemas.TokenData, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Admin: Add a user to a company directly by email (bypass request).
    """
    if not is_manager_of_company(db, current_user, company_id):
         raise HTTPException(status_code=403, detail="Not authorized")
    
    user_to_add = crud.get_user_by_email(db, member_data.email)
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User email not found")

    # Verify company
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Check if exists
    existing = crud.join_company(db, str(user_to_add.id), company_id)
    
    # If it was inactive or just created, force active and ensure role is set (healing)
    needs_update = False
    if not existing.is_active:
        existing.is_active = True
        needs_update = True
    
    if not existing.role: # Heal potential legacy NULLs
        existing.role = models.CompanyRole.worker
        needs_update = True

    if existing.rates_config is None: # Heal missing JSONB field
        existing.rates_config = {}
        needs_update = True

    if needs_update:
        db.commit()
        db.refresh(existing)
        
    return existing

@app.put("/companies/{company_id}/members/{user_id}/status", response_model=schemas.CompanyMemberResponse)
def update_member_status(company_id: str, user_id: str, status: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Approve/Reject company membership.
    """
    if not is_manager_of_company(db, current_user, company_id):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    member = crud.update_company_member_status(db, company_id, user_id, status)
    if not member:
        raise HTTPException(status_code=404, detail="Member request not found")
    
    return member



@app.get("/companies/{company_id}", response_model=schemas.CompanyResponse)
def read_company(company_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    company = crud.get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Access control
    if current_user.role == "admin":
        return company
    
    membership = db.query(models.CompanyMember).filter(
        models.CompanyMember.user_id == current_user.id,
        models.CompanyMember.company_id == company_id,
        models.CompanyMember.is_active == True
    ).first()
    
    if not membership:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    return company

@app.get("/companies/{company_id}/rates-v2", response_model=List[schemas.CompanyMemberResponse])
def read_company_rates(company_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Allow Admin or Manager of this company
    if not is_manager_of_company(db, current_user, company_id):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    return crud.get_company_rates(db, company_id)

@app.put("/companies/{company_id}/members/{user_id}", response_model=schemas.CompanyMemberResponse)
def update_company_member(company_id: str, user_id: str, member_data: schemas.CompanyMemberUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_manager = is_manager_of_company(db, current_user, company_id)
    is_self = str(user_id) == str(current_user.id)
    
    # DEBUG
    print(f"DEBUG: update_company_member - company_id={company_id}, user_id={user_id}, current_user_id={current_user.id}, is_manager={is_manager}, is_self={is_self}")
    
    if not is_manager and not is_self:
         raise HTTPException(status_code=403, detail=f"Not authorized. is_manager={is_manager}, is_self={is_self}, user_id={user_id}, current_user_id={current_user.id}")
    
    # Security: Non-managers cannot promote themselves or change their membership status
    if not is_manager:
        # Create a clean update object with only allowed fields to avoid setting others to None
        member_data = schemas.CompanyMemberUpdate(
            ratesConfig=member_data.rates_config,
            settings=member_data.settings
        )
    
    member = crud.update_company_member(db, company_id, user_id, member_data)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member






# --- New Security Endpoints (2FA & Sessions) ---

@app.post("/2fa/setup", response_model=schemas.TOTPSetupResponse)
async def setup_2fa(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Generates a new TOTP secret for the user (not active yet)."""
    secret = auth.generate_totp_secret()
    # Provisionally store or just return? Best to return and verify before saving as enabled.
    # However, we need to save the secret somewhere to verify the first code.
    current_user.otp_secret = auth.encrypt_secret(secret)
    current_user.is_2fa_enabled = False # Not enabled until verified
    db.commit()
    
    uri = auth.get_totp_uri(secret, current_user.email)
    return {"secret": secret, "qr_code_uri": uri}

@app.post("/2fa/activate")
async def activate_2fa(
    data: schemas.TOTPActivate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Verifies the first code and enables 2FA."""
    if not current_user.otp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated")
    
    decrypted_secret = auth.decrypt_secret(current_user.otp_secret)
    if not auth.verify_totp_code(decrypted_secret, data.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    current_user.is_2fa_enabled = True
    db.commit()
    return {"message": "2FA activated successfully"}

@app.post("/2fa/disable")
async def disable_2fa(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Disables 2FA (Requires verified user)."""
    current_user.is_2fa_enabled = False
    current_user.otp_secret = None
    db.commit()
    return {"message": "2FA disabled"}

@app.get("/sessions", response_model=List[schemas.SessionResponse])
async def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Lists all active sessions for the user."""
    return [s for s in current_user.sessions if s.is_active]

@app.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_verified_user)
):
    """Revokes a specific session."""
    session = db.query(models.UserSession).filter(
        models.UserSession.id == session_id,
        models.UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_active = False
    db.commit()
    return {"message": "Session revoked"}

@app.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Revokes the current session and clears the cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        auth.revoke_session(db, refresh_token)
    
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


