from sqlalchemy.orm import Session
from typing import Any
import models

def check_manager_access(db: Session, manager: models.User, target_user_id: str) -> bool:
    """
    Check if manager has active manager scope for target user's company.
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
    Check if user has active manager scope in the specified company.
    """
    if getattr(user, "is_platform_admin", False):
        return True
        
    active_cid = getattr(user, "active_company_id", None)
    active_role = getattr(user, "active_role", None)
    
    if str(active_cid) == str(company_id) and active_role == "manager":
        return True
        
    return False
