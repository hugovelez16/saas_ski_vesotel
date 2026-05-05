from database import SessionLocal
import crud
import schemas
from uuid import UUID

db = SessionLocal()
user = db.query(crud.models.User).first()
company = db.query(crud.models.Company).first()

if user and company:
    work_log = schemas.WorkLogCreate(
        type="particular",
        startDate="2026-05-05",
        endDate="2026-05-05",
        userId=user.id,
        companyId=company.id
    )
    try:
        log = crud.create_work_log(db, work_log)
        print("Success! Log ID:", log.id)
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No user or company found.")
